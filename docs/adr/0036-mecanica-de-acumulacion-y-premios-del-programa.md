---
fecha: 2026-08-14
resumen: El programa de fidelización gana una mecánica de acumulación explícita (otorgar X por bloque de $Y, por bloques con floor y sin arrastre; Sellos además admite modo "1 por compra") y una tabla de premios (`loyalty_reward`) con tres tipos (producto del catálogo / premio libre / % de descuento); la mecánica va en columnas dedicadas nullable con checks (criterio de ADR 0030) y los premios en tabla relacional; el costo en puntos es el gasto-objetivo hecho visible, calculado —no IA— y editable.
estado: aceptada
---

# ADR 0036 — Mecánica de acumulación y premios del programa

## Contexto

El programa de fidelización (specs 0024/0027) hoy define **qué es** (Puntos o Sellos), sus
nombres de unidad, el objetivo de Sellos, los términos y el diseño de la tarjeta — pero **no
define cómo se otorga valor**. No hay ninguna regla que diga "por cada $Y de compra se otorgan
X puntos/sellos", ni qué se canjea con esos puntos/sellos. Sin esa mecánica, la acreditación en
mostrador (spec 0030) no tiene nada que **validar ni ejecutar**: es su prerequisito duro.

El owner necesita configurar esto en minutos, sin soporte, y entender el **balance económico**
del programa (cuánto gasta un cliente antes de ganarse un premio; cuándo regalar algo deja de
ser rentable). El catálogo de productos (0034) ya existe y le da a los premios una fuente de
nombre/precio/imagen sin trabajo nuevo.

Precedentes en el repo: ADR 0030 eligió **columnas dedicadas nullable + checks a nivel DB** para
atributos estructurados del programa (rechazó `jsonb` para el diseño de tarjeta); `configuration`
jsonb queda para lo poco estructurado (nombres de unidad, target). La moneda del negocio vive en
`business.currency_code` (0034).

## Decisión

### 1. Mecánica de acumulación en columnas dedicadas nullable

Tres columnas nuevas en `core.loyalty_program` (siguiendo ADR 0030, no `jsonb`):

- `accrual_mode` `text` — `'per_amount'` | `'per_purchase'`.
- `accrual_grant` `integer` — X: unidades (puntos o sellos) otorgadas por bloque.
- `accrual_block_amount` `numeric(12,2)` — Y: monto de compra por bloque (en la moneda del
  negocio). `null` cuando `accrual_mode = 'per_purchase'`.

Semántica del otorgamiento (la ejecuta 0030, se fija acá):

- **`per_amount`**: `otorgado = floor(total / Y) × X`. **Por bloques enteros**: el sobrante se
  descarta y **no se arrastra** entre transacciones. Ej.: `10 pts cada $3`, compra $7 → `floor(7/3)=2` bloques → **20 pts** (el $1 sobrante se pierde).
- **`per_purchase`** (solo Sellos): X sellos por transacción, sin importar el monto. Ej.: 1 sello
  por compra.
- **Puntos siempre es `per_amount`** (no tiene sentido "1 punto por compra"); Sellos elige entre
  los dos modos.

Checks a nivel DB (tolerando `NULL`, estilo `business_*_color_check`):

- `accrual_mode IS NULL OR accrual_mode IN ('per_amount','per_purchase')`.
- `accrual_grant IS NULL OR accrual_grant > 0`.
- `accrual_block_amount IS NULL OR accrual_block_amount > 0`.
- Pareja: `accrual_mode = 'per_amount'` ⇒ `accrual_block_amount IS NOT NULL`;
  `accrual_mode = 'per_purchase'` ⇒ `accrual_block_amount IS NULL`.
- `kind = 'points'` ⇒ `accrual_mode` es `'per_amount'` o `NULL` (Puntos no admite `per_purchase`).

**Nullable** para que la migración sea aditiva y no rompa filas existentes; pero el **server exige
la mecánica al guardar** un programa de una modalidad habilitada (no se puede activar sin ella).
Un programa sin mecánica (dato viejo) **no es acreditable**: 0030 lo bloquea con un mensaje claro.

### 2. Premios en tabla relacional `loyalty_reward`

Los premios son 1..N por programa (Puntos) o exactamente 1 (Sellos), pueden referenciar un
producto del catálogo, y tienen orden: es relacional, no cabe en columnas ni en `jsonb`. Tabla
nueva `core.loyalty_reward`:

- `id` uuid pk; `program_id` FK → `loyalty_program` (`ON DELETE CASCADE`); `business_id` FK →
  `business` (`ON DELETE CASCADE`, denormalizado para scoping/aislamiento, como los eventos).
- `reward_type` `text` — `'catalog_product'` | `'custom'` | `'discount'`.
- `label` `text` **not null** — nombre mostrado. Para `catalog_product` es un **snapshot** del
  nombre al definir (queda legible aunque el producto se edite o borre); para `custom` lo escribe
  el owner; para `discount` se deriva ("20% de descuento").
- `product_id` uuid **nullable** FK → `product` (`ON DELETE SET NULL`) — solo `catalog_product`.
  Si el producto se borra, el premio conserva su `label` (snapshot) y queda marcado como "sin
  producto vinculado" hasta que el owner lo re-elija; 0030 bloquea canjear un premio roto.
- `discount_percent` `integer` **nullable** — solo `discount` (1..100).
- `points_cost` `integer` **nullable** — costo en puntos. **Requerido en Puntos** (cada premio
  cuesta puntos); **`null` en Sellos** (el premio se desbloquea al completar la tarjeta, no tiene
  costo por-premio).
- `position` `integer` not null — orden de despliegue.
- `created_at`/`updated_at`.

Checks: `reward_type` en el enum; `discount_percent IS NULL OR (1..100)`; `points_cost IS NULL OR
> 0`; pareja `reward_type = 'discount'` ⇔ `discount_percent IS NOT NULL`.

Invariantes cross-row (validadas en server, no en DB): Sellos ⇒ exactamente 1 premio con
`points_cost = NULL`; Puntos ⇒ 1..N premios, cada uno con `points_cost > 0`.

**Reescritura atómica**: al guardar el programa, los premios se **borran y re-insertan** dentro de
la misma transacción que el resto del `saveProgram` (patrón de reemplazo total; los premios no
tienen estado propio que preservar). Esto evita reconciliar diffs y mantiene el round-trip simple.

### 3. El costo en puntos es el gasto-objetivo, calculado (no IA)

El costo en puntos de un premio es **aritmética cerrada**, no criterio: con tasa `X pts / $Y`, un
premio de `C` puntos exige gastar `C × Y / X`. La IA sería no determinista, cara y podría sugerir
un número que hace perder dinero — **se descarta para asignar costos**.

- La UI **sugiere** un `points_cost` (semilla editable, para evitar la página en blanco) y el owner
  lo ajusta.
- Al lado de cada premio, la UI muestra **en vivo el equivalente en $** ("50 pts ≈ $15 de compra"),
  que es la herramienta de balance real: el owner ve el dinero detrás de los puntos y juzga la
  rentabilidad sin cargar márgenes.
- Métrica de refuerzo en el preview: **"por cada $1 en premios, tu programa te genera ~$N en
  ventas"**, enmarcada como **ventas** (no ganancia), con dos honestidades: asume que **todos
  canjean** (los que no, son ganancia pura por breakage) y para Sellos `per_purchase` se muestra
  "N compras por premio" (no hay monto fijo). Si el producto del premio tiene `coste` cargado
  (0034), se puede mostrar de yapa la ganancia estimada — **opcional**, no requerido.

Todo el cálculo de la métrica es **UI/derivado**: no se persiste ni es responsabilidad de la DB.

### 4. Fuera de alcance (deliberado, para operar en minutos)

- **Reglas de premio abstractas** ("cualquier producto de la categoría N", "cualquiera bajo $X"):
  potentes pero complican el canje en mostrador y casi ningún owner las necesita el día 1. Se
  difieren; si aparecen pedidos reales se agregan como tipo de premio nuevo.
- **Catálogo de redención separado**: sería una segunda base a poblar antes de operar — juega en
  contra del objetivo. Se reusa el catálogo de venta como fuente + premio libre + descuento.
- **Regla global de "mínimo de gasto antes de canjear"**: redundante — ya está codificada en el
  `points_cost` de cada premio (su gasto-objetivo). No se agrega.
- **La ejecución del canje** (descontar puntos / resetear la tarjeta de sellos, atómico + auditoría)
  es de la spec 0030, no de acá. Este ADR define; 0030 ejecuta.
- **Imagen del premio libre**: el premio-producto ya trae imagen del catálogo; el premio libre
  arranca texto-solo. La imagen opcional es un fast-follow que reusa el pipeline de ADR 0029.

## Consecuencias

- Migración **aditiva** (`0019`): 3 columnas + checks en `loyalty_program` y tabla `loyalty_reward`
  con sus checks/índices. Nullable ⇒ no rompe datos existentes; los programas de prueba previos
  quedan "sin mecánica" hasta editarse (el owner autorizó descartarlos/re-crearlos; no se hace un
  `DELETE` destructivo en la migración).
- La validación de mecánica/premios vive en `loyalty-program/validation.ts`, reforzada por los
  checks de DB como segunda línea; `saveProgram` persiste mecánica + premios en la misma
  transacción.
- El DTO (`toClientProgram`) expone `accrual` y la lista de premios (no son secretos; ningún
  `*ObjectKey`). La UI calcula el $-equivalente y la métrica de valor.
- Habilita la spec 0030 (acreditación): ya tiene la tasa para acreditar y las definiciones de
  premio para canjear.
- Si en el futuro los premios ganan reglas abstractas o imagen propia, se extiende `reward_type`
  y/o se agrega la maquinaria de assets — sin reescribir lo de hoy.
