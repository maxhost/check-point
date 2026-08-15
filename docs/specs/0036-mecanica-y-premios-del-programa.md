---
spec: 0036
fecha: 2026-08-14
resumen: El wizard del programa de fidelización gana dos piezas que la acreditación en mostrador (0030) necesita para validar y ejecutar: la mecánica de acumulación (otorgar X por bloque de $Y, por bloques con floor y sin arrastre; Sellos además "1 por compra") en el paso de términos, y un paso de premios (producto del catálogo / premio libre / % de descuento) con costo en puntos auto-sugerido y editable, más una métrica de valor en el preview.
disjunta: no
estado: implementada
archivos: apps/merchant (loyalty), migración Drizzle, Neon, pruebas y docs
---

# 0036 — Mecánica de acumulación y premios del programa

> **Nada de código empieza sin esta spec en `cerrada`.** Cerrada el 2026-08-14 con las decisiones
> de mecánica y premios resueltas con el owner (ver «Decisiones cerradas»). Es el **prerequisito
> duro de la spec 0030** (acreditación en mostrador): 0030 no puede validar ni ejecutar
> otorgamiento/canje sin la mecánica y los premios que esta spec define.

## Problema

El programa de fidelización (specs 0024/0027) define **qué es** (Puntos/Sellos), nombres de
unidad, objetivo de Sellos, términos y diseño de tarjeta — pero **no define cómo se otorga valor**
ni **qué se canjea**. No existe una regla "por cada $Y de compra, X puntos/sellos", ni la
definición de los premios. Sin eso, la acreditación en mostrador (0030) no tiene nada que validar
ni ejecutar, y el owner no puede razonar el balance económico del programa (cuánto gasta un cliente
antes de ganarse un premio; cuándo regalar algo deja de ser rentable).

El owner necesita configurar esto en **minutos, sin soporte**, viendo siempre el dinero detrás de
los puntos.

## Decisiones cerradas (owner, 2026-08-14)

1. **Acumulación por bloques enteros con `floor`, sin arrastre.** `otorgado = floor(total / Y) × X`.
   El sobrante se descarta y no se acumula entre transacciones. Ej.: `10 pts cada $3`, compra $7 →
   20 pts (el $1 se pierde).
2. **Dos modos de sello, a elección del owner:** `por compra` (1 sello por transacción, sin mirar
   monto) **o** `por monto` (X sellos cada $Y). **Puntos siempre es por monto.**
3. **Premios con selector de tipo** (colapsa 4 casos en 3): producto del catálogo (gratis) / premio
   libre (texto) / % de descuento. Sin reglas abstractas ("categoría N", "bajo $X") ni catálogo de
   redención separado (diferidos).
4. **Estructura de premios por modalidad:** Sellos = completar la tarjeta → **1 premio** (sin costo
   por-premio). Puntos = **1..N canjes**, cada uno con **costo en puntos** (ej. café 50 pts, cerveza
   100 pts).
5. **Costo en puntos = gasto-objetivo, calculado (no IA), auto-sugerido y editable.** La UI muestra
   el **$-equivalente en vivo** al lado del costo. La métrica de balance no se persiste.
6. **Métrica de valor en el preview** ("por cada $1 en premios, generás ~$N en ventas"), enmarcada
   como **ventas** (no ganancia), asumiendo que todos canjean (el breakage es ganancia extra).
7. **Sin regla global de mínimo de gasto** (ya está en el `points_cost` de cada premio).
8. **La ejecución del canje es de la 0030.** Esta spec **define** premios y mecánica; 0030 otorga y
   canjea (atómico + auditoría).
9. **Programas de prueba previos**: quedan "sin mecánica" hasta editarse; migración aditiva, **sin
   `DELETE` destructivo** (el owner autorizó descartarlos, pero nullable lo hace innecesario).

Ver **ADR 0036** para el modelo de datos y el fundamento.

## Alcance

**Entra:**

- **Mecánica de acumulación** en `core.loyalty_program` (3 columnas dedicadas nullable + checks):
  `accrual_mode` (`per_amount`/`per_purchase`), `accrual_grant` (X), `accrual_block_amount` (Y en la
  moneda del negocio; `null` si `per_purchase`). Validación server + checks DB.
- **Paso de mecánica dentro del paso de términos (paso 3)**: bloque estructurado con inputs X e Y (y
  el toggle de modo en Sellos), **con ejemplo en vivo** ("10 puntos cada $3 gastados en el local" /
  "1 sello por cada $5 gastados en el local"). El texto de TOS sigue siendo su propio textarea; la
  mecánica **no** se mezcla en el markdown.
- **Paso de premios (paso 4, nuevo)**: tabla `core.loyalty_reward` (1..N para Puntos, 1 para Sellos).
  Cada premio: tipo (`catalog_product`/`custom`/`discount`), `label`, `product_id` (solo catálogo),
  `discount_percent` (solo descuento), `points_cost` (solo Puntos), `position`. Selector de producto
  del catálogo (reusa el listado de 0034), premio libre (texto), descuento (%). Costo en puntos
  **auto-sugerido + editable** con **$-equivalente en vivo**.
- **Preview (paso 5)**: resumen + **métrica de valor** (ventas por $1 de premio / "N compras por
  premio" en Sellos `per_purchase`).
- Persistencia atómica en `saveProgram`: mecánica en las columnas; premios **borrados y
  re-insertados** en la misma transacción. Migración aditiva `0019` verificada en Neon efímero y
  aplicada a prod.
- `toClientProgram` expone `accrual` y la lista de premios (no son secretos; ningún `*ObjectKey`).

**No entra (explícito):**

- **La acreditación en mostrador** (otorgar/canjear, consola de staff, carrito, auto-enrolamiento):
  es la spec 0030. Esta spec solo deja la mecánica y los premios listos para que 0030 los consuma.
- **Reglas de premio abstractas** ("cualquiera de la categoría N", "cualquiera bajo $X") y **catálogo
  de redención separado**: diferidos (ADR 0036).
- **Imagen del premio libre**: fast-follow. El premio-producto ya trae imagen del catálogo (0034/
  0035); el premio libre arranca **texto-solo**. La imagen opcional reusa el pipeline de ADR 0029 y
  se agrega en una pasada corta si el owner lo pide.
- **Cálculo fino de margen/ganancia** obligatorio: el $-equivalente alcanza para el día 1; la
  ganancia estimada (si el producto tiene `coste`) queda como extra opcional, no bloqueante.
- **Regla global de mínimo de gasto** (redundante) y **cambiar `kind`** de un programa existente
  (como hoy, el `kind` queda fijo al editar).
- Tocar el flujo de **cierre** del programa ni la auditoría por eventos existente.

## Diseño

### Arquitectura de referencia

- ADR 0020 — programa único por negocio. ADR 0024/0027 — programa mutable, términos, cierre fechado
  (no se modifican).
- ADR 0034 — catálogo de productos (fuente de `product_id`/precio/imagen) y `business.currency_code`
  (la moneda de `accrual_block_amount`).
- **ADR 0036 (nuevo)** — mecánica de acumulación (columnas dedicadas) + premios (tabla relacional) +
  costo en puntos = gasto-objetivo calculado.

### Modelo de datos

**Mecánica** — 3 columnas nuevas en `core.loyalty_program` (`server/schema/loyalty.ts`), nullable:

| Columna (TS) | Columna SQL | Tipo | Notas |
|---|---|---|---|
| `accrualMode` | `accrual_mode` | `text` nullable | `'per_amount'` \| `'per_purchase'` |
| `accrualGrant` | `accrual_grant` | `integer` nullable | X: unidades por bloque |
| `accrualBlockAmount` | `accrual_block_amount` | `numeric(12,2)` nullable | Y: monto por bloque; `null` si `per_purchase` |

Checks (tolerando `NULL`, estilo `business_*_color_check` / los de 0027):

- `loyalty_program_accrual_mode_check`: `accrual_mode IS NULL OR accrual_mode IN ('per_amount','per_purchase')`.
- `loyalty_program_accrual_grant_check`: `accrual_grant IS NULL OR accrual_grant > 0`.
- `loyalty_program_accrual_block_amount_check`: `accrual_block_amount IS NULL OR accrual_block_amount > 0`.
- `loyalty_program_accrual_pair_check`: `(accrual_mode = 'per_amount' AND accrual_block_amount IS NOT NULL) OR (accrual_mode = 'per_purchase' AND accrual_block_amount IS NULL) OR accrual_mode IS NULL`.
- `loyalty_program_accrual_points_mode_check`: `kind <> 'points' OR accrual_mode IS NULL OR accrual_mode = 'per_amount'`.

**Premios** — tabla nueva `core.loyalty_reward` (`server/schema/loyalty.ts`):

| Columna (TS) | Columna SQL | Tipo | Notas |
|---|---|---|---|
| `id` | `id` | uuid pk | |
| `programId` | `program_id` | uuid not null | FK → `loyalty_program` `ON DELETE CASCADE` |
| `businessId` | `business_id` | uuid not null | FK → `business` `ON DELETE CASCADE` (scoping) |
| `rewardType` | `reward_type` | `text` not null | `'catalog_product'`\|`'custom'`\|`'discount'` |
| `label` | `label` | `text` not null | nombre mostrado; snapshot en `catalog_product` |
| `productId` | `product_id` | uuid nullable | FK → `product` `ON DELETE SET NULL` (solo catálogo) |
| `discountPercent` | `discount_percent` | `integer` nullable | solo `discount`, 1..100 |
| `pointsCost` | `points_cost` | `integer` nullable | requerido en Puntos; `null` en Sellos |
| `position` | `position` | `integer` not null | orden |
| `createdAt`/`updatedAt` | | timestamptz | |

Checks: `reward_type` en el enum; `discount_percent IS NULL OR (>=1 AND <=100)`; `points_cost IS
NULL OR > 0`; pareja `(reward_type = 'discount') = (discount_percent IS NOT NULL)`. Índice
`(program_id, position)` y `(business_id)`.

**Invariantes cross-row (server, no DB):**

- `kind = 'stamps'` ⇒ **exactamente 1** premio, `points_cost = null`.
- `kind = 'points'` ⇒ **1..N** premios, cada uno `points_cost > 0`, `reward_type` válido.
- `reward_type = 'catalog_product'` ⇒ `product_id` presente **al crear** (pertenece al negocio) y
  `label` = nombre del producto (snapshot). `custom` ⇒ `label` no vacío, `product_id`/`discount`
  null. `discount` ⇒ `discount_percent` 1..100, `label` derivable, `product_id` null.

La mecánica **no** va en `configuration` jsonb (mismo criterio que el diseño de 0027:
`validation.ts:96`).

### API / acciones

Sin endpoint nuevo: creación y edición siguen por `PUT /api/loyalty-program` (`route.ts`, 201/200).
`ProgramInput` (`core.ts`) gana dos campos:

```text
accrual: {
  mode: 'per_amount' | 'per_purchase'
  grant: number            // entero > 0
  blockAmount: number | null  // > 0 si per_amount; null si per_purchase
}
rewards: Array<{
  type: 'catalog_product' | 'custom' | 'discount'
  label: string
  productId?: string | null
  discountPercent?: number | null
  pointsCost?: number | null
}>
```

- **Entrada válida:** `accrual` presente y coherente con `kind`/modo; `rewards` respeta las
  invariantes cross-row → persiste columnas + reescribe la tabla de premios.
- **Errores esperados (`422` con mensaje por caso, patrón `validateClosingWindow`/`validateCardDesign`):**
  `accrual` ausente o incoherente (Puntos con `per_purchase`; `per_amount` sin `blockAmount`;
  `grant`/`blockAmount` ≤ 0); Sellos con ≠1 premio o premio con `pointsCost`; Puntos con premio sin
  `pointsCost` o `pointsCost` ≤ 0; `catalog_product` con `productId` que no pertenece al negocio o
  inexistente; `discount_percent` fuera de 1..100.
- **Salida:** `toClientProgram` agrega `accrual` (los 3 campos) y `rewards` (lista ordenada por
  `position`, cada premio con su `productId`/`label`/`discountPercent`/`pointsCost` y, para
  `catalog_product`, el `imagePath` público del producto vía el DTO del catálogo). Sin `*ObjectKey`.

### Validación (server)

Nuevas funciones en `loyalty-program/validation.ts`, llamadas desde `validateProgramInput`:

- `validateAccrual(kind, raw)` → normaliza `{ mode, grant, blockAmount }`; aplica las reglas de modo
  por `kind`; **requiere** la mecánica (una modalidad habilitada no se guarda sin ella).
- `validateRewards(kind, raw, businessProducts)` → valida las invariantes cross-row, resuelve
  `catalog_product` contra los productos del negocio (pertenencia + snapshot de `label`), normaliza
  `discount`/`custom`, asigna `position` por orden de llegada. Devuelve la lista lista para insertar.

`saveProgram` (`loyalty-program.ts`): escribe las 3 columnas de mecánica en INSERT/UPDATE y, en la
**misma transacción** (`db.batch`, como en la creación con auditoría de 0028), **borra todos los
`loyalty_reward` del programa y re-inserta** la lista nueva. Sin cambios en R2/sello ni en eventos.

### UI / Wizard

Reorganización de `apps/merchant/src/app/backoffice/loyalty/`:

- **Paso 3 (términos) gana un bloque de mecánica** (`steps/step-terms.tsx` o sub-componente
  `steps/accrual-fields.tsx` si cruza `file-size`): inputs X (`grant`) y Y (`blockAmount`), toggle de
  modo en Sellos (`por compra` / `por monto`), y una **línea de ejemplo en vivo** que arma la frase
  con la moneda del negocio ("Otorgás **10 puntos cada $3** gastados en el local" / "**1 sello por
  cada $5**" / "**1 sello por compra**"). El textarea de TOS queda separado.
- **Paso 4 (premios) nuevo** (`steps/step-rewards.tsx` + `use-rewards.ts` para no cruzar
  `file-size`): lista editable de premios. Por premio, selector de tipo:
  - **Producto del catálogo**: buscador/selector que reusa el listado de productos (0034); toma
    nombre + imagen del producto; `label` = nombre (snapshot).
  - **Premio libre**: campo de texto (`label`).
  - **Descuento %**: input de porcentaje (1..100); `label` derivado.
  - En **Puntos**, cada premio tiene **costo en puntos** con **auto-sugerencia editable** y el
    **$-equivalente en vivo** debajo (`≈ $X de compra para canjear`), derivado de `accrual`. En
    **Sellos**, un solo premio, sin costo.
  - Auto-sugerencia del costo: semilla derivada de la tasa + un múltiplo del precio del premio
    (cuando es producto con precio); editable. Es UI, no se persiste la fórmula.
- **Paso 5 (preview)** (`steps/step-review.tsx`): resumen del programa + **métrica de valor**:
  - Puntos/Sellos `per_amount` con premios con valor monetario (producto con precio): "por cada $1
    en premios, tu programa te genera ~$N en ventas" — `N = gastoParaCanjear / valorDelPremio`,
    promediado o en rango sobre los premios con precio; nota "asume que todos canjean; los que no,
    son ganancia".
  - Sellos `per_purchase`: "N compras por cada premio" (`N = target`), sin ratio en $.
  - Premios sin valor monetario (custom/discount sin precio de referencia): se muestra el
    gasto-para-canjear ("hay que gastar ~$X"), sin ratio.
  - Todo **UI/derivado**; ningún cálculo se persiste.
- **Validación por paso (UI):** X entero > 0; Y > 0 si `per_amount`; al menos 1 premio válido; en
  Puntos, cada premio con costo > 0. «Siguiente» deshabilitado hasta validar.

### Cálculo de otorgamiento (fijado acá, ejecuta 0030)

- `per_amount`: `otorgado = floor(total / blockAmount) × grant`. Sobrante descartado, sin arrastre.
- `per_purchase`: `otorgado = grant` por transacción.
- `gastoParaCanjear(pointsCost) = pointsCost × blockAmount / grant` (Puntos).
- `gastoParaCompletar` (Sellos `per_amount`) `= target × blockAmount`; (`per_purchase`) = `target`
  compras.

### Split de archivos (hook `file-size`, LIMIT=300)

- `validation.ts` (217) → `validateAccrual`/`validateRewards` pueden empujarlo sobre 300: extraer a
  `loyalty-program/accrual.ts` y/o `loyalty-program/rewards.ts` si hace falta.
- `loyalty-program.ts` (~277) → si la reescritura de premios lo cruza, mover el armado del batch a un
  helper en submódulo.
- `steps/step-rewards.tsx` + `use-rewards.ts` nuevos; `step-terms.tsx` gana el bloque de mecánica
  (vigilar 300, extraer `accrual-fields.tsx` si cruza).

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/server/schema/loyalty.ts` | editar — 3 columnas de mecánica + checks; tabla `loyalty_reward` |
| `apps/merchant/drizzle/0019_*.sql` + `meta/` | crear — migración aditiva |
| `apps/merchant/src/server/loyalty-program/core.ts` | editar — tipos `AccrualInput`/`RewardInput`; extender `ProgramInput` |
| `apps/merchant/src/server/loyalty-program/validation.ts` | editar — `validateAccrual`/`validateRewards` (o extraer a submódulos) |
| `apps/merchant/src/server/loyalty-program/accrual.ts` | crear (si split) — validación/normalización de mecánica |
| `apps/merchant/src/server/loyalty-program/rewards.ts` | crear (si split) — validación/armado de premios |
| `apps/merchant/src/server/loyalty-program.ts` | editar — mecánica en INSERT/UPDATE; batch de reescritura de premios en `saveProgram` |
| `apps/merchant/src/server/loyalty-program/client-view.ts` | editar — exponer `accrual` + `rewards` en el DTO |
| `apps/merchant/src/app/backoffice/loyalty/steps/step-terms.tsx` | editar — bloque de mecánica + ejemplo en vivo |
| `apps/merchant/src/app/backoffice/loyalty/steps/accrual-fields.tsx` | crear (si split) |
| `apps/merchant/src/app/backoffice/loyalty/steps/step-rewards.tsx` | crear — paso 4 |
| `apps/merchant/src/app/backoffice/loyalty/steps/step-review.tsx` | editar — métrica de valor |
| `apps/merchant/src/app/backoffice/loyalty/use-rewards.ts` | crear — estado de premios |
| `apps/merchant/src/app/backoffice/loyalty/use-loyalty-program.ts` | editar — payload `accrual`/`rewards`, hidratación al editar |
| `apps/merchant/src/app/backoffice/loyalty/program-editor.tsx` | editar — orden de pasos (agregar premios) |
| `apps/merchant/src/app/backoffice/loyalty/*.css` (globals del panel) | editar — estilos de mecánica/premios |
| `apps/merchant/src/server/loyalty-program/*.test.ts` | crear/editar — unit de `validateAccrual`/`validateRewards` + otorgamiento |
| `apps/merchant/tests/integration/*loyalty*` | crear/editar — persistencia mecánica + round-trip de premios + checks |
| `docs/adr/0036-*.md`, `docs/INDEX.md`, `docs/TASKS.md` | editar (ADR ya creado) |

### Disjunta?

**No.** Toca el dominio loyalty (`schema/loyalty.ts`, `loyalty-program/*`, `backoffice/loyalty/*`) y
crea tablas (`accrual_*`, `loyalty_reward`) que la **spec 0030 (abierta)** va a consumir y extender;
0030 depende directamente de esta. Debe **serializarse antes de 0030** (que es el orden previsto).
Las specs 0024/0025/0026/0027 que comparten estos archivos están `implementada`. Se implementa sola.

### Archivos compartidos (deja listos el orquestador antes de despachar)

| Qué | Quién | Cuándo |
|---|---|---|
| Contratos `AccrualInput`/`RewardInput` (tipos TS en `core.ts`) | orquestador | antes de despachar |
| Cómo llega el listado de productos del negocio al selector de premio (reusa API/loader de catálogo 0034) | orquestador | antes de despachar |
| Forma del DTO de premio en `toClientProgram` (incluye `imagePath` del producto vía DTO de catálogo) | orquestador | antes de despachar |

## Definition of Done

- [x] El wizard de **Puntos** incluye, en el paso de términos, la mecánica `X puntos cada $Y` con
      ejemplo en vivo; y un **paso de premios** con 1..N canjes, cada uno con costo en puntos
      auto-sugerido/editable y **$-equivalente en vivo**.
- [x] El wizard de **Sellos** incluye el toggle `por compra` / `por monto` (con X/Y cuando aplica) y
      ejemplo en vivo; y **1 premio** (producto/libre/descuento) sin costo por-premio.
- [x] La mecánica se persiste en `accrual_mode`/`accrual_grant`/`accrual_block_amount`; los premios en
      `loyalty_reward`; ambos en la **misma transacción** que `saveProgram`.
- [x] La API valida mecánica y premios con las invariantes por `kind` → `422` con mensaje por caso;
      el server **exige** la mecánica para guardar una modalidad habilitada.
- [x] El DTO expone `accrual` + `rewards` (ordenados) e incluye `imagePath` del producto en premios de
      catálogo; **no** serializa ningún `*ObjectKey`.
- [x] El **preview** muestra la métrica de valor (ventas por $1 de premio, o "N compras por premio" en
      Sellos `per_purchase`), con la nota de que asume canje total.
- [x] `floor(total / Y) × X`, sin arrastre, verificado por unit del cálculo de otorgamiento.
- [x] Migración `0019` aplicada/verificada en Neon efímero **y** en prod; los checks rechazan
      mecánica/premio inválidos a nivel DB.
- [x] Ningún archivo supera `file-size` (300); los splits están hechos.
- [x] Gates verdes: typecheck 3/3, lint, prettier, unit, build 3/3.
- [x] **PASS de revisor independiente** (`AGENT-WORKFLOW.md`).

## Plan de pruebas y verificación

- [ ] **Unit** (`accrual`): `validateAccrual` acepta `per_amount` con `grant`/`blockAmount` > 0;
      rechaza Puntos con `per_purchase`; rechaza `per_amount` sin `blockAmount`; rechaza `grant`/
      `blockAmount` ≤ 0; exige mecánica presente.
- [ ] **Unit** (cálculo de otorgamiento): `floor(7/3)×10 = 20`; `floor(20/10)×1 = 2`; `per_purchase`
      → `grant` fijo; `gastoParaCanjear(100, Y=3, X=10) = 30`.
- [ ] **Unit** (`rewards`): Sellos exige exactamente 1 premio sin `pointsCost`; Puntos exige `pointsCost`
      > 0 en cada premio; `discount_percent` fuera de 1..100 → 422; `catalog_product` con `productId`
      ajeno/inexistente → 422; snapshot de `label` desde el producto.
- [ ] **Unit** (`client-view`): `toClientProgram` incluye `accrual` + `rewards` ordenados y sigue
      **omitiendo** `stampImageObjectKey`/cualquier `*ObjectKey`.
- [ ] **Integración Neon** (rama efímera): crear Puntos con mecánica + 2 premios → columnas y filas
      persistidas; editar cambiando la mecánica y los premios → round-trip (los premios viejos se
      borran, entran los nuevos); INSERT con `accrual_block_amount` ≤ 0 o `discount_percent = 200`
      rechazado por el check (error de DB, no 200); crear Sellos `per_purchase` con `accrual_block_amount`
      null OK y con 1 premio.
- [ ] **Regresión**: un programa preexistente sin mecánica (columnas null) hidrata el wizard sin
      crashear y **no** es acreditable (documentado para 0030).
- [ ] **Aislamiento**: el selector de premio de catálogo solo ofrece productos del negocio del owner;
      un `productId` de otro negocio → 422.
- [ ] **Comandos exactos**: `pnpm --filter @mi-pasaporte/merchant typecheck`, `... lint`, `... test`
      (unit), `pnpm build`, e integración Neon en rama efímera creada/borrada vía MCP.
- [ ] **Verificación manual (owner, en vivo sobre Vercel)**: crear un programa de Puntos con
      `10 pts cada $3`, agregar café (producto del catálogo, 50 pts) y una cerveza (100 pts), ver el
      $-equivalente y la métrica de valor; activar; reabrir en edición y confirmar hidratación;
      crear un programa de Sellos `por monto` (`1 sello cada $5`) y otro `por compra`, con su premio;
      verificar mobile.

## Handoff requerido

Implementador y revisor usan el formato de `docs/AGENT-WORKFLOW.md`. El revisor produce un `PASS`
independiente —verificado contra Neon real y contra los checks de DB— antes de pasar la spec a
`implementada`.

## Abierto

Nada bloqueante. Las decisiones de mecánica y premios están cerradas (ver «Decisiones cerradas»).
Detalles menores a resolver **en implementación** (sin impacto en contrato ni modelo de datos): la
fórmula exacta de la auto-sugerencia del costo en puntos (múltiplo del precio) y la presentación
precisa de la métrica de valor (promedio vs. rango) — ambas son UI derivada. La **imagen del premio
libre** queda como fast-follow explícito fuera de esta spec.
