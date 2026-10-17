# Plan — costo y margen de ganancia por producto (2026-10-13/14)

Conversacion de diseño owner + Claude (solo pensar, sin implementar). Este archivo guarda lo decidido, las etapas y
el prompt pendiente de la pieza 1.3. Las decisiones que ya tienen spec mandan desde su spec: aca solo se resumen.

## Objetivo

Que el comerciante vea, por producto, cuanto le cuesta producirlo y cuanto le queda, en plata:

> **Pizza Muzzarella · $10**
> Producirla te cuesta **$2,54**. Te quedan **$7,46** por cada una.
> De cada $10 que cobrás, $2,54 se van en ingredientes.

Y despues: punto de equilibrio en el Dashboard e ingenieria de menu, siempre traducidos a dinero («+$155/mes»), no a
porcentajes. El markup no se muestra nunca.

## Decisiones del owner (esta conversacion)

- **Costo de insumo = promedio ponderado movil**:
  `(stock actual × costo actual + cantidad comprada × precio nuevo) / (stock actual + cantidad comprada)`. FIFO
  descartado (dos costos distintos para la misma pizza el mismo dia).
- **El costo se congela en cada linea de venta** al vender: si sube un insumo, no cambia la ganancia de lo ya vendido.
- **Stock por local**, no por comercio (se hizo ya: migrar despues es mas caro). Con un solo local no se muestra selector.
- **Cada venta cobrada descuenta stock por receta**, del local de la venta. Nunca se bloquea una venta: el stock
  puede quedar negativo (señal de problema operativo, visible en Stock). **El POS nunca muestra nada de stock.**
- **Producto sin elaboracion** (gaseosa, cafe de reventa) = receta de un insumo; entra al margen igual.
- **IVA:** catalogo sin IVA y POS vende sin IVA (no somos sistema de facturacion). **Costo de compra = lo pagado, IVA
  incluido, sin desglosar** («ese dinero se fue»). En Marca se guardan cobra IVA / tasa de venta / recupera IVA, sin
  usarlos hoy en ningun calculo (usos futuros: vender con IVA facturado; estimar IVA recuperable con tasas por
  categoria del SRI/ARCA).
- **Costo real** (merma): no se anota cada perdida. Conteos periodicos de los insumos clave; factor de perdida =
  consumo real / consumo teorico, aplicado al costo. Objetivo del owner: «variar en centavos, no en dolares».
- **Para llevar:** packaging como stock que se descuenta al marcar la orden «para llevar». **Comisiones:** se marca el
  medio de pago en la venta y en settings la comision de cada medio.
- **Costos fijos** por local y en staff. **No se reparten en el costo del producto**: se muestran como punto de
  equilibrio («te faltan $690 / 92 muzzas; los cubrís el dia 24»). Es importante para el Dashboard del merchant.
- **Periodo:** siempre el mes en curso; en analitica, historicos (3/6/9/12 meses, mismo periodo del año anterior).
- Pais de los comercios hoy: Ecuador (moneda USD). El modelo no se ata a un pais.

## Etapas (replanificadas 2026-10-14, objetivo: Smart Menu)

Decision del owner: **todo lo que el Smart Menu y el punto de equilibrio van a necesitar entra AHORA al plan**, aunque
hoy valga 0 (packaging, comisiones, costos fijos): «sacar cosas que necesitaremos en una semana no es ahorrar
trabajo, es ignorarlo». Los cupones entran porque ya se aplican en el POS al vender y al acreditar sellos/puntos.

| # | Pieza | Depende de | Estado / nota |
|---|---|---|---|
| 0 | Stock por local + consumo por receta al cobrar | — | ✅ spec 0227 implementada (ADR 0145) |
| 1.1 | Costo promedio ponderado por insumo y local | 0 | ✅ spec 0228 implementada (ADR 0146), QA PASS, integrada local |
| 1.2 | Datos fiscales del comercio en Marca (se guardan, no calculan) | — | ✅ spec 0229 implementada, QA PASS; 2 filas TASKS propuestas en la spec |
| **2** | **Costo de lo vendido:** cada movimiento de consumo guarda el costo promedio del momento; costo de la venta = suma de sus consumos | 1.1 | ✅ spec 0230 implementada (`fe5fb583`, migracion 0085), QA PASS (`docs/factory/0230-0231-qa.md`), en PROD (incluida en `origin/main` `5b834ca0`, verificado 2026-10-16). Redondeo a la unidad minima de la moneda; estados completo / incompleto / pendiente |
| **F** | ~~Costos fijos por local y staff~~ → **reemplazada por G (Gastos)** | — | 0231 en PROD (backend sin UI, 0 filas en PROD). **Se borra** su modelo de costos fijos en G (owner 2026-10-16). La spec 0231 sigue diciendo `estado: cerrada` |
| **R1** | **Recetas independientes y combos** (ver seccion propia): producto = (receta, cantidad), opcion combo, revisiones en 2 niveles, expansion al cobrar, migracion; el consumo guarda receta y composicion | 0, 2 | ✅ spec 0232 implementada + ADR 0148, QA PASS (`docs/factory/0232-implementation-qa.md`), en PROD (`origin/main` `5b834ca0`). Retiró la UI vieja de Recetas; **recuperada con wizard** (Catálogo | Combo) en `7564d290` (L1, typecheck/lint/22 tests OK; lista sin costo hasta la 1.3; QA del owner en el browser pendiente) |
| **1.3** | Lectura del costo por receta y por producto (suma × cantidad) | R1, 1.1 | ✅ spec 0234 implementada, QA PASS (`docs/factory/0234-qa.md`), en PROD (`0ef18bb2` ⊂ `origin/main` `5b834ca0`): costo de receta, precio, ganancia y margen % en la lista de Recetas por local; sin margen si falta costo; precio del catálogo sin IVA. Ficha del Catálogo queda para despues (ADR de enganche) |
| **P1** | **Medio de pago y comisiones** | — | ✅ backend en PROD (spec 0233 + ADR 0149): `sale.closed` v2, comisión congelada por revisión. Selector mínimo en el POS. Pantallas → N |
| **P2** | **Para llevar y packaging:** el POS marca la orden «para llevar»; el packaging es stock y se descuenta | R1, P1 (mismo cierre) | **parqueada** (owner 2026-10-15): ideas exploradas en `docs/PARQUEADO.md`; costo de envase = 0 mientras tanto |
| **P3** | **Cupones y recompensas en la ganancia:** el descuento del cupon/recompensa se atribuye a la venta y a sus lineas; producto gratis = ingreso 0 con su costo | 2 | **cerrada en este arco** (owner 2026-10-15): el cupón de campaña por línea, gratis/2x1 a su línea y unidades regaladas con costo ya los implementó P1 (0233, en PROD). Premio → cupón y mostrador: `docs/PARQUEADO.md` (2026-10-15). Costo real del cupón: va en SM-datos. Sin spec 0235 ni ADR 0150. Hoy nadie canjea premios por mostrador (owner) |
| **SM-datos** | (→ dentro de AN) Lectura agregada por rango (mes en curso + historicos) y local: unidades, cobrado, descuentos, costo recetas, packaging, comision, ganancia — por producto, receta y composicion. Incluye punto de equilibrio (fijos vs ganancia del mes) | 2, R1, F, P1–P3 | backend del Smart Menu y del Dashboard |
| **SM** | Smart Menu (tabla, 4 grupos, acciones y simulador en plata) + punto de equilibrio en el Dashboard | SM-datos | UI: owner + Claude |
| **6** | **Costo real por conteos:** conteos periodicos de los insumos clave → factor de merma por insumo (consumo real / teorico) aplicado al costo; reglas en «Notas para las etapas futuras» | 2 (y R1 para el teorico por receta) | **en el plan** (owner 2026-10-14). El ajuste por conteo ya existe en Stock. Entra al costo de lo vendido como `costo promedio × factor` (factor 1 hasta esta pieza) |
| **EV** | **Eventos de venta encendidos en PROD** (`MODULE_EVENTS_ENABLED`) | 0, 2, P1 | ✅ 2026-10-16: push `5b834ca0`, flag en Vercel Production, redeploy READY; venta de prueba en F5 → 1 `sale.closed` v2 con 2 entregas (leído por SQL 00:39 UTC). Cron de reintentos en cron-job.org cada 1 h (owner). Doc `docs/factory/release-module-events-2026-10-16.md` (GPT: faltaba la llamada a reintentos y el cierre) |
| **N** | **Espacio core «Negocio»:** Medios de pago (+comisión), Regional y Fiscal (mudados desde Marca); permiso `business`, ruta `/backoffice/business`; medios al core, POS consume; comisión calculada en la transacción de cierre | P1 | ✅ **local** (GPT, 2026-10-16): spec 0235 `implementada`, QA PASS (`docs/factory/0235-qa.md`), en `main` local `e2cd4544`, **sin push ni migración PROD**. Para publicar: puente `e5eaa741` → migraciones 0093–0095 en PROD → drenaje → retiro de compatibilidad (worker en curso). CI de `origin/main` rojo (deadlock Stock / teardown permisos), worker arreglándolo |
| **G** | **Gastos** (módulo `expenses`, renombra `profitability`): registro de pagos dictado/foto, criterio de caja, sueldos como nombre libre; tablas nuevas, se borra la 0231 | N (en serie) | decisiones del owner cerradas (2026-10-16, «Preguntas de G»); prompt (spec 0236 + ADR 0151) **ajustado al ADR 0152** (2026-10-16: decisión 13 y `module_event`). Listo para lanzar |
| **AN** | **Analíticas core**: lo que el dueño abre cada mañana (ver «AN — visión del owner»). Base expansible por rubro; ADR 0021 como antecedente | EV, N, G (implementación) | **ADR 0152 aceptado** (owner, 2026-10-16). Su ADR va **antes de la spec de G**. Absorbe SM-datos y el punto de equilibrio (por concepto, «Preguntas de G» 1) |

**Regla transversal a decidir en las specs:** lo que es por orden (comision, cupon sobre el total, bolsa) se reparte
entre las lineas para la rentabilidad por producto. Recomendacion: proporcional al importe de cada linea.

**Olas sugeridas:** A = 2 ‖ F · B = R1 (‖ F si no termino) · C = 1.3 ‖ P1 (P1 despues de R1 si comparten el cierre) ·
D = P2 ‖ P3 ‖ 6 · E = SM-datos · F = SM (UI). Todo es dinero → **piso L2**.

## Recetas independientes y combos (2026-10-14) — CERRADO por el owner

Caso: restaurante con «Almuerzo» a precio cerrado ($3) cuyo contenido cambia cada dia; «Combo 1» que una semana es
hamburguesa + Coca y otra pizza + Pepsi; «Docena de empanadas». Comun tambien en Argentina («menu del dia», combos).

**Cambio de concepto:** **producto** = lo que se vende en el POS; **receta** = composicion de stock que da forma a un
producto actual o futuro. **Una receta existe sin necesidad de estar atada a un producto**: puede haber mas recetas
que productos. Esto reemplaza sub-recetas, «preparaciones» y copias.

**Modelo:**
- **Receta** = siempre **1 unidad** de algo (1 empanada, 1 sopa, 1 pizza), con nombre y revisiones propias. El
  rendimiento dictado («para 12 uso 1,2 kg») ya se normaliza por unidad al guardar (como hoy).
- **Nombre:** al crearla desde un producto hereda el nombre del producto y es editable. Si la cantidad del producto
  es > 1, conviene proponer otro nombre («Empanada de carne», no «Docena de empanadas»).
- **Producto = lista de (receta, cantidad)**, versionada. Producto normal: como maximo **1** receta, con cantidad
  (Docena de empanadas = Empanada de carne × 12). Producto **combo**: **varias** recetas, cada una con cantidad.
- **Opcion en el catalogo «☐ Es un combo o menú»** (copy propuesto): habilita elegir mas de una receta. Reemplaza
  la idea de «producto rotativo». La docena surtida (6 carne + 6 pollo) es un combo.
- **Opcion B (owner):** receta por unidad + cantidad en el producto (descartada A: receta por lo que se vende, que
  duplica recetas). **Red de seguridad UX obligatoria:** en revisar se muestra el efecto real de una venta
  («Cada venta de Docena de empanadas descuenta 12 × Empanada de carne → 1,2 kg de carne · 12 tapas…»). La IA puede
  sugerir la cantidad (nombre «docena» → 12, rendimiento dictado), el merchant confirma.
- **El combo se arma SOLO en Recetas, nada inline:** Recetas → Nueva receta → producto Combo 4 → elegir recetas
  existentes → cantidades y revision → crear. Si el almuerzo lleva una sopa nueva, primero se crea la sopa.
- **Cambio diario = editar la composicion:** Combo 4 = A + B + C; mañana se edita y A se cambia por D; se guarda,
  listo. **No hay «recetas guardadas A/B/C con una activa»**: las composiciones anteriores quedan como historial.
- **Revisiones en dos niveles:** editar la sopa versiona la sopa (ingredientes); editar el combo versiona la
  composicion (que recetas y cuantas), no el detalle de cada receta.
- **Venta:** descuenta stock y (mas adelante) congela costo de la suma; guarda la version de la composicion y la de
  cada receta. La etapa 0 ya captura una lista de versiones por linea (`core.module_resource_version` tiene `slot`;
  el evento de cierre guarda `resourceVersions[]`): encaja, pero la spec debe definir la expansion. Hoy la receta y
  sus revisiones se identifican por producto (`recipes.line.product_id`, `recipes.revision.product_id`): pasan a
  identidad propia + tabla producto ↔ receta. **Migracion:** cada receta actual queda con el nombre de su producto,
  asignada a el con cantidad 1; nada de lo que funciona cambia.
- **Rentabilidad = la de la receta** (tambien la pizza). Se analiza en **«Smart Menu»** (ex etapa 4), no en la UI de
  Recetas ni de Catalogo. Para combos: rentabilidad por composicion («Almuerzo con lentejas + pollo $1,35; con
  camarones $0,35») y pizzas vendidas sueltas vs dentro de combos.
- Sin tandas (todo por unidad). Dos almuerzos el mismo dia = dos productos. Cambiar con ordenes abiertas:
  improbable, no se diseña para eso. Combos con eleccion del cliente («Coca o Pepsi») = modificadores POS, fuera.

**Piezas:** **R1** recetas independientes + producto = lista (receta, cantidad) + opcion combo + revisiones en dos
niveles + expansion al cobrar + migracion → **1.3** lectura por receta y por producto (suma) → **R1-UI** (pendiente
de pensar: lista con buscador, recientes y filtros para gran volumen de recetas; modal del combo; vista previa del
descuento). Descartados: preparaciones, partes, copiar.

**Siguiente paso acordado:** pensar la UI (el owner pidio cerrar el modelo antes).

El prompt de la 1.3 de abajo **se reescribe** (tiene que leer por receta y por producto).

## R1 — huecos cerrados con el owner (2026-10-14, para el prompt de spec + ADR)

Cerrado por el owner:
- **«Es un combo» se marca en Recetas**, al elegir el producto: marcado habilita cargar mas de una receta (no en Catalogo:
  seria un punto de enganche core).
- Editar una receta cambia todo lo que la usa **desde la venta siguiente**; lo vendido no cambia.
- **Un combo no contiene otro combo.**
- **Recetas a nivel de comercio**, una para todos los locales («locales de barrio, compran en un solo sitio»).
- **No se borra, se archiva.** Nombre de receta **unico sin distinguir mayusculas** (entre activas).
- **Una receta vive sin producto** (p. ej. 20 sopas que solo se usan en el Menu); asociarla es opcional.
- **Version de cada receta = la vigente al CERRAR la venta** (resuelta por fecha de revision), **sin bloqueo** por
  ordenes abiertas (owner acepto la recomendacion; reemplaza su idea de bloquear).
- **Cantidad con decimales** en la composicion (Media pizza = Pizza × 0,5); la UX se ve despues.
- **Stock y costo por local se quedan** (no es contradiccion: recetas compartidas, stock/costo/fijos por local). Compra
  central = **una carga por local** («10 kg al A, 5 kg al B»): sin compra repartida ni transferencias por ahora.
- **Costo manual del catalogo** (`product.unit_cost`): con receta el campo se oculta y si tenia valor se reemplaza por el
  de la receta; sin receta queda manual como hoy. Va en **1.3** (necesita enganche core «un modulo aporta el costo del
  producto», ADR) y toca P3 (`reward-fields.tsx` lo usa como costo del cupon). Sin historial extra: la evolucion del
  costo sale de los costos congelados por venta de la 0230.

Tecnico, directo a la spec: el consumo es unico por (orden, linea, insumo) → con un combo, dos recetas que comparten
insumo chocan; la clave tiene que incluir la receta.

## P1 — decisiones del owner (2026-10-14)

Codigo leido: `pos/server/close.ts` — la orden POS no guarda total ni medio de pago; el cupon solo se aplica con cliente
identificado (`grantWithCouponInTx` → `core.order`); el evento `sale.closed` no lleva precios ni medio; precios con
`toFixed(2)` fijo.

1. **Lista de medios que el comercio amplia o recorta.** Base: Efectivo, Tarjeta debito, Tarjeta credito,
   Transferencia, QR. **Por pais** desde el alta (Ecuador: DeUna en lugar de QR, Payphone, y los que se usen ahi).
2. **Lista de pagos por orden** (medio mixto) en el modelo.
3. **Efectivo por defecto; elegir uno es obligatorio** al cobrar.
4. **Comision congelada en cada venta, por medio y a nivel comercio**: % y/o fijo, uno, otro o ambos. **Catalogo
   nuestro** de proveedores de la industria por pais con su forma de cobro: al cargar los medios del pais el comercio
   ya tiene la base y ajusta lo que corresponda; si el medio solo cobra %, no se muestra el input de fijo.
5. **Base = lo cobrado** despues del descuento (vendes 10, descontas 1, comision sobre 9).
6. **El POS solo marca el medio; la comision se configura y calcula en Rentabilidad** (suscrita al cierre).
7. Propina / cargo por servicio 10 %: **fuera**. 8. Anular venta cobrada: **fuera**.
4a. **Un solo nivel:** cada entrada es un medio con su comision; el catalogo sugiere entradas por pais.
4b. El catalogo trae **solo la forma de cobro** (%, fijo o ambos), sin tasas; sin cargar = 0 con aviso.
4c. **Catalogo de plataforma** (core, solo lectura, por migracion, sin pantalla admin); pais sin datos = lista base;
    se carga **al prender el POS**; los que ya lo tienen, en la migracion. **Hoy solo se investiga Ecuador.**
4d. Quitar = **archivar**. **Efectivo nunca se archiva.**

## P3 — decisiones del owner (2026-10-15)

Codigo leido: cupones de campaña se aplican en el cierre POS solo con cliente identificado (`grant-coupon.ts`,
`coupon-discount.ts`); el descuento queda en `core.coupon_redemption.discount_amount` ligado a `core.order`, **no por
linea**. Premios del programa (`core.reward_redemption`: `catalog_product`, `discount`, `custom`) se canjean **fuera del
POS**, sin orden ni linea: no descuentan stock ni registran costo.

1. Descuento sobre el total → **proporcional al importe de cada linea** (resto de redondeo en la ultima linea).
   Pendiente: owner pregunto el impacto en el Smart Menu.
2. Producto gratis / 2x1 → el descuento va a esa linea; la unidad gratis = ingreso 0 con costo completo. Ok.
3. Sellos/puntos extra: no tocan dinero, $0.
4. «Custom»: se deja como hoy (sin importe).
5. **Premios: opcion (a)** — se canjean **dentro del POS como linea de la orden** (producto a $0 o % a la orden),
   descuentan stock y cuentan su costo. Hoy el POS no tiene canje de premios: es un cambio de flujo.
6. Costo del cupon: el Smart Menu usa el real (descuento + costo del producto regalado) cuando hay receta; el manual
   solo sin receta.
7. **P1 incluye ya el descuento por linea en la version 2 del evento** (owner: ajustar la spec 0233 en curso).

**Ronda 2 (2026-10-15) — reemplaza el punto 5:** **todo es un cupon.** «Cambias 100 puntos por un cafe» **emite un cupon**
por un cafe que se activa y se consume como cualquier cupon: si requiere compra, al pagar en el POS (escaneo); el
producto gratis, en el POS como linea a $0 si el comercio tiene POS, o en el **mostrador** si no tiene (emite el aviso de
venta con esa linea a $0: descuenta stock y congela costo). **Los puntos se descuentan al emitir el cupon.** Canjes
viejos: no hay (PROD limpia). Pieza propia **P3, L2, con ADR**. Abierto: puntos de un cupon de premio que vence sin
usarse (recomendacion Claude: devolverlos). Hoy el canje NO emite cupon (`counter/redemptions.ts` →
`core.reward_redemption`) y todo cupon exige campaña (`campaign_coupon.campaign_id` not null).

## F rediseñada — Gastos, Medios y Analíticas (decisiones del owner, 2026-10-15/16)

Reemplaza el enfoque de la 0231 («Rentabilidad»: costos fijos + sueldo en la ficha de Equipo + comisiones).

1. **El módulo es «Gastos», no «Rentabilidad», y solo recibe gastos.** Owner: «pagué de alquiler 900, de agua 20, compré
   una garrafa por 3.2, pagué a Luis su sueldo 450». Espacio propio en el menú. Registro de pagos dictado o por foto: la
   IA crea las entradas, el dueño confirma (como Stock y Recetas). Sin carga inicial obligatoria.
2. Fijos y variables: de acuerdo.
3. **Mes del gasto = criterio de caja** (owner 2026-10-16, reemplaza lo anterior «luz, agua y gas = mes anterior»): el
   gasto cuenta en el mes en que sale la plata. «Pagué 15 de luz hoy, eso corresponde a un consumo del mes pasado, pero
   es un gasto del mes en curso. El dinero sale hoy».
4. **Sueldos en Gastos**, no en la ficha de Equipo. «Luis» es un nombre dentro de Gastos, sin alta en Equipo. Horas
   extra = otro gasto («Luis horas extras 40»).
5. **Medios de pago pasan al core, en el espacio core «Negocio»** (owner 2026-10-16; antes había dicho Configuración → Medios y después Marca; Negocio también recibe Regional y Fiscal desde Marca),
   con la comisión dentro de cada medio. Se configura una vez. **El POS los consume.** La comisión de cada venta =
   medio elegido en la venta × su porcentaje; **tiene que quedar congelada** (owner: que un cambio de comisión no
   recalcule el histórico). Hoy ya es así (ADR 0149): cada cambio de comisión crea una revisión inmutable, la venta
   captura el id de la revisión vigente al cerrar y el resultado se guarda con su porcentaje
   (`profitability/server/commissions/apply.ts`). Al mover a core se conserva ese mecanismo.
6. **Toda la información va a Analíticas (core):** punto de equilibrio, cuánto gané, cuánto perdí, cuántos clientes
   vinieron esta semana. Coincide con el ADR 0021 (analíticas universales y lentes por rubro), nunca construido.
7. **Menú: sin agrupar por ahora.** Gastos entra como un ítem más. Agrupar cuando haya 2–3 rubros (una barbería tiene
   Catálogo pero no Recetas ni Smart Menu). Reordenar el menú = L0.

**Hallazgos a decidir (Claude, no son decisiones del owner):**
- Hoy los medios de pago son del **módulo POS** (`modules/pos/server/payment-methods.ts`); la comisión la guarda y calcula
  `profitability` sobre el evento core `sale.closed` y el recurso genérico `payment_method` (no importa al POS). Mover
  medios + comisión a core: ADR (cerrado por el owner el qué; falta el cómo).
- Cómo lee Analíticas los datos de los módulos sin nombrarlos (core nunca importa módulos): ADR de enganche pendiente
  (es el mismo que el punto de equilibrio en el Dashboard).
- Qué se reusa de la 0231 (`fixed_cost`, `_period`, `_allocation`, `staff_person`, rutas `costs`/`totals`,
  `/api/staff/people`, ADR 0147) y qué se borra: revisión de Claude pendiente.
- Sugerencia de Claude sin confirmar: estimar los recurrentes aún no cargados con el último valor, marcados «estimado».

### Revisión de la 0231 para Gastos (Claude, 2026-10-16, leído en el código)

**Corregido el 2026-10-16:** con criterio de caja, la base de la 0231 (monto por mes repartido por local) sirve. Lo que
no entra hoy: montos que cambian mes a mes (cada pago = editar un período), gastos sueltos (garrafa 3,2) y sueldos (exige
`staff_person`, un costo por persona: no entra «Luis horas extras 40»). **Recomendación: adaptar las tablas de la 0231**
(cada pago = fila con fecha y mes; sueldo = nombre libre; sin FK ni único por persona) en vez de un modelo nuevo; la spec
lo confirma contra el código.

- **Se reusa:** la idea y el código del reparto por local (`single|equal|manual`, allocation por local); la aritmética de
  dinero (`profitability/arithmetic.ts`, helper core `@mi-pasaporte/domain/financial`); las categorías
  (`rent, gas, electricity, water, other, personnel`) como punto de partida; el permiso propio del módulo.
- **Se adapta o borra (sin UI):** tablas `fixed_cost`, `fixed_cost_period`, `fixed_cost_allocation` y rutas `costs`,
  `costs/:costId`, `costs/:costId/period`, `costs/:costId/stop`, `totals` (adaptar); `people`, `salary.ts` y la FK de
  costo → `staff_person` (borrar). Del contrato: `staffAction`/`staffPanel` si nadie más los usa (ADR 0147
  queda parcialmente reemplazado).
- **Se queda:** `core.staff_person` (Equipo lo usa: `server/staff-create.ts`, `/api/staff/people`). Hallazgo a decidir:
  la «persona sin acceso» de la 0231 existía para cargarle sueldo; con sueldos como nombre libre en Gastos, ¿se borra?
- **Se mueve a core con los medios:** `profitability.commission_revision` y `payment_commission` + la suscripción a
  `sale.closed` (`commissions/apply.ts`), y los medios del comercio (hoy esquema POS). Migración con datos reales (P1 en
  PROD): L2 mínimo, ADR.
- **Sin verificar:** si PROD tiene filas en las tablas de la 0231 (sin UI, probablemente ninguna). Requiere autorización
  para un SELECT de solo lectura.

**Cómo lee Analíticas a los módulos (opciones para el ADR de enganche):**
- **A — proveedores registrados (recomendación Claude):** cada módulo declara en `SERVER_MODULES` una función que
  devuelve hechos genéricos (p. ej. «gastos por mes y local», «costo de lo vendido»), igual que hoy declara
  `eventSubscriptions`. Analíticas las llama sin nombrar módulos. Simple, datos al día.
- **B — eventos:** cada módulo publica hechos al log del core (`expense.recorded`…) y Analíticas arma su proyección (lo que
  describe el ADR 0021). Más robusto a escala, bastante más maquinaria (proyecciones, reintentos, correcciones).

### Decisiones del owner sobre la revisión (2026-10-16) — mandan sobre la revisión de arriba

1. **Tablas de la 0231: se eliminan** (`fixed_cost`, `fixed_cost_period`, `fixed_cost_allocation` y sus rutas) y se crean
   tablas nuevas con la forma de Gastos (registro de pagos). Owner: «un cambio pequeño… dejaría tablas sin usar o sin
   sentido».
2. **Analíticas = opción C:** cada módulo es dueño de su detalle (con procedencia, para cruces); Analíticas guarda
   **resúmenes por día** (comercio × local × día × dato) que actualiza con eventos, y el Dashboard lee los resúmenes.
   **Filtros por fecha clave:** año en curso, últimos 3, 6 y 9 meses. Owner: que entrar al Dashboard no obligue a
   Postgres a calcular todo en ese momento. Antes del ADR, GPT mide con datos de prueba.
3. **Personas sin acceso de Equipo: se quedan** (no molestan).
4. **Medios y Gastos NO en paralelo; se cambia el nombre interno del módulo** (`profitability` → nombre de Gastos), porque
   será confuso en el código.

5. **Nombre interno: `expenses`** (owner 2026-10-16).

**PROD leído (solo lectura, autorizado por el owner, 2026-10-16, Neon `main`):** 4 comercios. Tablas de la 0231
(`fixed_cost`, `_period`, `_allocation`): **0 filas**. `commission_revision` y `payment_commission`: **0**. Módulo
`profitability`: **ningún comercio lo tiene en `core.business_module`**; **0 miembros** con el permiso `profitability`.
Medios: `pos.payment_method` **22 filas**, `pos.payment_method_initialization` 4, `pos.order_payment` **2** (pagos reales
que apuntan a medios), `pos.pos_order` 17. `core.module_event`: 0 (la publicación de eventos está apagada en PROD).
→ Borrar la 0231 y renombrar el módulo no toca datos reales; mover medios a core **sí** (22 medios + 2 pagos).

### Preguntas de G — respuestas del owner (2026-10-16)

1. **Punto de equilibrio del mes en curso (owner de acuerdo con la propuesta de Claude, 2026-10-16).** Owner: con
   criterio de caja, el 15 del mes faltan alquiler, internet y sueldos → «tu punto de equilibrio son $120» sería falso.
   Queda: Analíticas lo calcula por **concepto** (categoría + nombre normalizado: «alquiler», «personal · Luis»); si el
   concepto ya se pagó este mes usa lo real, si no el promedio de los últimos meses marcado «estimado»; los gastos
   sueltos entran por su promedio mensual; al cerrar el mes queda el real. Primer mes sin historia: «se calcula al
   cerrar tu primer mes con gastos», nunca un número falso. **Para G:** cada gasto guarda un concepto estable (la IA
   reconoce «pagué a Luis», «sueldo Luis» y «Luis 450» como el mismo). El cálculo vive en AN.
2. **Permiso propio** (`expenses`) además del owner.
3. **Local:** cada gasto va a un local o a «todo el negocio»; por defecto el local donde está el dueño. Sin reparto
   `equal/manual`.
4. ~~**Editar y borrar** libremente **solo dentro del mes en curso**; los meses pasados quedan congelados (histórico).~~
   **Reemplazado (owner, 2026-10-16): «no congelemos los meses pasados y listo».** Se edita, borra y registra en
   cualquier mes, también con fecha de un mes pasado.
5. **Categorías fijas + «otro» con texto libre.**
6. **Foto:** no se guarda como comprobante. Se conserva hasta que el gasto se guarda (por si hay que reanalizarla en
   ese momento) y después se descarta.
7. **G publica eventos** (`expense.recorded/updated/deleted`) desde ya, para los resúmenes por día de AN.
8. **Fijo / variable lo marca la IA**, no lo elige el dueño ni lo deduce la categoría: lo que se consume (agua, gas) es
   variable; lo que no aparece de la nada (alquiler) es fijo. Se muestra como un check **que el dueño puede corregir
   sin estar obligado** (owner de acuerdo, 2026-10-16).

## AN — visión del owner (2026-10-16) — diseñar juntos, no está cerrado

Owner: «analíticas lo vamos a pensar no solo desde lo que nos dan los comercios de restauración, necesitamos pensarlo
como una base expansible a diferentes categorías y rubros, porque es lo que le permitirá accionar al dueño de un
negocio, desde un odontólogo, una cafetería, una panadería, un barbero, un taller mecánico, etc. La analítica es lo que
el dueño de un comercio local abre cada mañana antes de abrir las puertas y ve "hoy espero que suceda esto, necesito
preparar esto, tengo que lograr esto antes de esto"». También: «esto no será tan simple como crees».

**Orden corregido (2026-10-16):** N (terminar CI y publicación) → **diseño de AN (ADR, con el owner)** → G (spec +
implementación, eventos con la forma del ADR de AN) → AN (implementación) → Smart Menu → 6. El diseño de AN no toca
código: corre mientras se termina N. Error de Claude: el prompt de G mandaba resolver los eventos dentro de G, o sea
diseñar la entrada de Analíticas sin Analíticas.

**Ya decidido que entra en AN:** opción C (cada módulo dueño de su detalle + resúmenes por día; filtros año en curso,
3/6/9 meses; Dashboard sin calcular todo al entrar) y punto de equilibrio por concepto con estimados («Preguntas de G» 1).

**Preguntas abiertas que Claude ya tenía (para la sesión de diseño):** qué muestra la primera versión; ventas
anteriores al 2026-10-16 (eventos apagados: ¿backfill o desde el encendido?); «clientes que vinieron esta semana» sale
de pases/sellos (core), ¿entra?

### AN — lo que el owner imagina ver (2026-10-16, sesión de diseño)

**Camino:** el owner dice lo que imagina ver → se buscan productos que lo hagan (o mejor) → se juega e idea qué da
valor al dueño. No se arranca por el inventario de eventos.

**A quién sirve:** el comerciante de barrio hace todo él, con uno o dos empleados en el mejor caso; lleva stock, excel o
libreta; le cuesta calcular el punto de equilibrio; no sabe los márgenes reales; intuye la demanda pero no la anticipa;
pierde y gana dinero sin saberlo; no sabe qué implica una decisión (promoción, descuento, no hacerlo); conoce solo a
los clientes frecuentes.

**Propósito:** que el dueño pueda **accionar**, no solo ver gráficos. El histórico se cuenta en frases que entiende, no
en gráficos de picos. Ejemplos del owner (textuales):
- «El valor de tu stock es de $500 aproximadamente»
- «En los últimos 6 meses tus insumos subieron en promedio un 10%, y las subas se dieron aproximadamente cada 21 días»
- «Hoy es martes, sueles vender estos productos con más frecuencia»
- «Te estás quedando sin harina, revisa tu stock, porque queda para preparar unas 20 masas de pizza y al ritmo actual
  se acabarán probablemente el viernes»
- «Hoy probablemente sea un día de ventas bajo, trata de recomendar este plato de tu menú que tiene mayores márgenes»
- «Tienes que vender $x hoy para alcanzar el punto de equilibrio en x días»

**Períodos (owner):** mes en curso, 3, 6, 9 y 12 meses (reemplaza «año en curso, 3/6/9» de arriba). Quizás
comparativa contra el mismo período del año anterior (*a decidir*).

**Investigación de mercado:** `docs/analisis-analiticas-mercado-2026-10-16.md` (tres informes; evidencia casi toda de
proveedores).

### AN — decisiones del owner sobre la investigación (2026-10-16)

- **Todo vive en Analíticas.** Dentro de esa pantalla, un **inbox** con los mensajes accionables. Es «la parte más
  smart»: como si tuvieras un empleado por departamento y este fuera el email donde te mandan lo que hay y las acciones
  concretas que necesitan de vos. Invita a hacer lo que falta, corregir, completar, crear, diseñar.
- **Dato faltante = invitación** en el inbox, no se oculta.
- **Sí:** clientes habituales que se están yendo; alerta al cargar la factura del proveedor (suba de insumo → plato);
  resumen de ayer («puede ser interesante»); meta de hoy; suba de insumos.
- **«Se acaba el viernes» con rango** (margen de error aceptable). **Sin plazo del proveedor:** obligaría a cargarlo y
  mantenerlo, y no se sostiene.
- **Merma:** sale del stock y los ajustes que ya existen, por cálculo; la consistencia se sabrá en el mundo real.
- **Recomendar plato: dinámico**, disparado por una situación («hoy será un día bajo, recomendá los de más margen»), no
  una matriz fija.
- **Confirmar/romper creencias → función de Smart Menu «diseñar nueva carta»**: «este es el menú que mejor rinde, produce
  el 70% de los ingresos; los otros se pueden eliminar, ahorrás $x sin impacto significativo en ventas».
- **Simular la promo antes de lanzarla no es de Analíticas:** va en el módulo de fidelización/marketing. Analíticas
  mide el resultado: «el cupón 20% te costó $X y te generó $Y; tus ventas subieron/bajaron $Z».
- **Contexto externo: le gusta mucho, «podría ser muy potente».** Clima: buscar API gratis. Feriados nacionales tienen
  calendarios públicos por país, no por ciudad; eventos del barrio no tienen calendario. Encargó investigar qué
  software (restauración, hotelería, odontología, etc.) ya lo hace, cómo, y qué resultado le da al dueño.

### AN — contexto externo y criterio de valor (owner, 2026-10-16)

- **Contexto externo empieza como DATO en la base, asociado a la actividad (p. ej. ventas con clima), sin ninguna
  acción para el owner.** Objetivo: ir juntando histórico desde ya; lo accionable viene después.
- **El dueño como fuente: no ahora** (5 locales en la red).
- **Siguiente análisis:** para qué se usa cada software investigado y qué datos le da al dueño → por cada capacidad:
  ¿nos interesa? si sí, ¿cómo hacerlo sin fricción para el dueño de barrio? ¿qué impacto tiene en él?
- **Criterio de valor:** el comerciante de barrio quiere **ahorrar dinero, ahorrar tiempo o ganar más dinero**; su
  preocupación usual es traer más clientes, pero «quizás un cliente que te deja $5 de ganancia no sea ni siquiera tan
  rentable como ahorrarle $10 optimizando su stock».

### AN — tabla capacidad→valor: respuestas del owner (2026-10-16)

- **Turnos vacíos y recordatorios:** sí, más adelante, cuando haya agenda.
- **Conteo de inventario:** ya existe en stock y es solo de insumos de producción, no del producto final; correcto así.
  El panadero NO carga «40 medialunas, 20 panes»: la producción se infiere de ventas + stock + ajustes.
- **Turnos y costo de personal:** fuera.
- **Contabilidad / flujo de caja:** no la versión compleja; aprender de patrones y proyectar con el tiempo. Idea del
  owner: **plan de crecimiento realista** — «si hoy facturás $1000 y te quedan $500, para ganar $1000 tendrías que
  crecer acá, vender más esto, más clientes por esto… ¿es realista? necesitás 10 mesas y tenés 5: ni lleno llegás; o
  vendé más del plato de mayor margen y llegás a $800, no a $1000».
- **De acuerdo:** el resumen de ayer es la primera tarjeta; orden de valor margen → costos → stock → clientes; todo
  dato sale de algo que el dueño ya hace y si falta se invita a completar; Gastos alimenta meta del día, suba y margen.
- **Facturación SRI: fuera.** CheckPass no factura fiscalmente ni busca reemplazar a quien lo hace.
- Pendiente de explicar: cuadre de caja y anulaciones.

**Merma y producción (owner, 2026-10-16):**
- La diferencia del ajuste por conteo contra el stock teórico ES la merma; **no se pide motivo**: el owner pone una
  nota si quiere. Lo importante es avisar.
- **Compras no cargadas: no se persigue.** Se asume que cargan; si no, todo es inconsistente, no solo la merma.
- **Sobrante de producción (lo hecho y no vendido):** preferencia por **inferencia, sin carga manual**. Aceptable como
  respaldo: preguntar cada tanto por UN producto distinto (hoy medialunas, mañana pan de maíz), nunca todos. Nivel de
  ambición del owner: «armar una balanza que vaya debajo del canasto y sacar cantidades por merma de peso».
- **Inferencia del sobrante: fuera** hasta que se ocurra un método (owner, 2026-10-16; ni hora de agotamiento, ni foto,
  ni balanza por ahora). En su lugar, solo lo vendido: **«los martes se suelen vender 30 medialunas»** — el comerciante
  sabe cuánto tiene y se prepara. No se le dice cuánto producir.
- **Anulaciones: sí, ya** (el POS las registra).

**Inbox (owner, 2026-10-16):**
- **Las 13 tarjetas del borrador de Claude: aprobadas** («no son 100 posibilidades, son 13, es genial»); se suman más
  aprendiendo. Borrador: resumen de ayer; qué se vende hoy (día de semana); meta del día; invitación a cargar gastos
  fijos; suba de insumo → plato; margen bajo/negativo; producto sin costo; insumo que se acaba (rango); merma por
  conteo; anulaciones anómalas; habitual que pasó su frecuencia; resultado de promo; día flojo → recomendar margen.
- **Hasta 5 a la vez**, descartables; **el resumen de ayer cuenta entre las 5**; al aceptar o descartar entra otra solo
  si hay algo que avisar.
- **Cada tarjeta tiene un PESO y aparece por CONTEXTO, cuando se necesita**, no todos los días. Ejemplo del owner:
  margen bajo no se muestra a diario; tiene sentido si faltan 10 días para cerrar el mes y se está a $x del punto de
  equilibrio, para ajustar y garantizar llegar.
- **Períodos (mes en curso, 3/6/9/12) son un filtro del histórico en NÚMEROS, no del inbox**: cómo crecieron las
  ventas en 3 meses, cómo subió el costo del stock en 6, cuánto se ahorró en 9. **Cuadre/cierre de caja: fuera.**
- **Proyecciones (flujo de caja, plan de crecimiento con techo): parqueado** (`docs/PARQUEADO.md`), solo son fiables con
  histórico y hoy no hay.

### AN — decisiones del owner para la spec (2026-10-17)

Contexto leído en el código ese día: el único evento que existe es `sale.closed` (POS); compras y ajustes de stock,
anulaciones, cupones, canjes y visitas no publican eventos.

1. **Una spec, 3 etapas**, cada una sale a live por separado: AN-1 resúmenes, inbox, histórico, contexto externo
   (junta datos desde el día 1) y tarjetas de ventas + Gastos (1, 2, 3, 4, 13); AN-2 eventos de Stock y Recetas →
   tarjetas 5–9; AN-3 anulaciones, clientes y promos → 10–12.
2. **El inbox va en el Dashboard** (reemplaza el cartel «Aquí verás cómo va todo»); el histórico en números en un ítem
   de menú «Analíticas». Permiso nuevo `analytics`: dueño siempre, staff solo si se lo dan.
3. **Ventas = solo POS.** Owner: «hoy no tenemos forma, solo podemos saber lo que se vendió desde POS… tendrá que
   existir en el futuro un módulo de calendarios o citas que será el equivalente a POS para esos negocios».
4. **Tarjeta 10 = tickets abiertos anulados** (el POS no anula ventas cobradas).
5. **Todo dato de Analíticas nace como evento** en la tx de su origen (ADR 0153). Owner: «lo correcto es hacer que
   cada módulo guarde los datos como venta cerrada del POS para seguir un patrón consistente».
6. **Analíticas es core** (owner): «no se activa o desactiva por switch ni variable de entorno». Se retira
   `MODULE_EVENTS_ENABLED`: `sale.closed` se publica siempre.
7. **Hallazgos de la 0237:** la 6 y la 7 entran en AN-1; empieza limpio en el deploy de AN-1 (no procesa eventos
   anteriores); local sin ciudad queda sin contexto; «cuánto ahorraste» a PARQUEADO.
8. **Piso de la tarjeta 9 (merma) en cualquier moneda** (2026-10-17, al preguntar GPT en AN-2): el owner había dicho
   «3 unidades de la moneda del local» y lo corrigió porque no sirve en COP, ARS o CLP. Queda: lo que faltó vale al
   menos **un ticket promedio de los últimos 28 días** o el 1% de la venta semanal, lo mayor; sin conversión. Sin
   ventas en esos 28 días, aparece con cualquier faltante que tenga costo.

## Prompt — AN-1 (spec 0237; 2026-10-17; lanzar cuando el owner lo diga)

```
# Encargo: implementar la etapa AN-1 de Analíticas (spec 0237)

Mandan docs/specs/0237-analiticas-inbox-y-resumenes-diarios.md, ADR 0152 y ADR 0153. Implementá SOLO la etapa
AN-1 (tabla «Etapas» de la spec): resúmenes diarios por evento, suscriptor core, inbox con las tarjetas 1, 2, 3,
4, 6, 7 y 13 en el Dashboard, histórico en «Analíticas», contexto externo guardado sin mostrar, y el retiro de
MODULE_EVENTS_ENABLED (§2.5). Las decisiones de producto están cerradas: no se reabren.

## Reglas
- Flujo de ADR 0144 y docs/AGENT-WORKFLOW.md: coordinador, hasta dos implementadores en worktrees propios desde
  dev, QA independiente. Asignación explícita: esquema `analytics`, `core.location.city_id`, UNA migración
  nueva, framework de eventos y contrato de módulos, limitada a lo que pide la 0237.
- Analíticas es core: sin switch de módulo ni variable de entorno.
- Core nunca importa ni nombra un módulo (ADR 0138/0139): traductores y acciones por contrato.
- Node 24; DB solo con tools/neon-test.sh, nunca DATABASE_URL.
- Pruebas: las de «Pruebas pertinentes» de la 0237 para AN-1, focales; sin verify global ni mutaciones.
- No push, no deploy, no migración ni lectura de PROD. No editar INDEX, TASKS ni el estado de Claude.

## Pendiente que no bloquea
La clave de Visual Crossing puede no estar todavía: implementá con proveedor simulado y dejá la prueba real
de la API (primer paso del §5) para cuando el owner la cargue.

## Fuera de alcance
AN-2 y AN-3 (tarjetas 5, 8, 9, 10, 11, 12 y sus eventos), mostrar clima o calendario al comerciante, quitar la
variable de Vercel.

## Entrega
Candidato local en dev con QA PASS y handoff en docs/factory/ (SHAs, pruebas reales, fallos, migración
preparada). Avisá cualquier hallazgo que contradiga la spec antes de resolverlo por tu cuenta.
```

## Prompt — AN-2 (spec 0237 §6; 2026-10-17; lanzar recién con AN-1 aceptada por QA e integrada en dev)

```
# Encargo: implementar la etapa AN-2 de Analíticas (spec 0237 §6: stock y costos)

Mandan docs/specs/0237-analiticas-inbox-y-resumenes-diarios.md (§6 y lo común de §1–§3), ADR 0152 y ADR 0153.
AN-1 ya está integrada en dev: AN-2 se apoya en su suscriptor core, sus resúmenes y su inbox; no los rediseña.
Las decisiones de producto están cerradas: no se reabren.

## Primero
Leé el handoff de AN-1 en docs/factory/ y confirmá el §6 contra el código real. Si algo de la spec no encaja con
lo que AN-1 construyó, avisá al owner antes de resolverlo por tu cuenta.

## Qué entra
- Stock publica stock.purchase.recorded y stock.adjustment.recorded en la misma tx del movimiento (entradas por
  lote: un evento por línea), con lo que pide el §6; traductores puros (ADR 0153).
- Recetas: su traductor de recipes.consumption.applied suma stock_consumption y stock_on_hand; se suscribe a
  stock.purchase.recorded y publica recipes.product_cost.changed cuando cambia el costo promedio.
- Métricas de AN-2 del §1 (incluido el tipo gauge en analytics.daily_gauge).
- Tarjetas 5 (suba de insumo, evaluada en la delivery de recipes.product_cost.changed), 8 (insumo que se acaba,
  con rango) y 9 (merma por conteo), con los textos, pesos y acciones del §6.
- Histórico: valor del stock y subas de insumos (§4).

## Reglas
- Flujo de ADR 0144 y docs/AGENT-WORKFLOW.md: coordinador, hasta dos implementadores en worktrees propios desde
  dev, QA independiente. Migración nueva solo si hace falta, una.
- Analíticas es core: sin switch ni variable de entorno. Core nunca importa ni nombra un módulo (ADR 0138/0139).
- El corte del conteo de Stock no se altera con los eventos nuevos ni con deliveries de Analíticas (§2.4).
- Node 24; DB solo con tools/neon-test.sh, nunca DATABASE_URL.
- Pruebas focales: un caso Neon por evento nuevo (atómico con su movimiento, local correcto, sin alterar el
  corte) y unit por tarjeta con sus bordes (mínimo de un mes en la 8, umbral de monto en la 9, decaimiento).
  Sin verify global ni mutaciones.
- No push, no deploy, no migración ni lectura de PROD. No editar INDEX, TASKS ni el estado de Claude.

## Fuera de alcance
AN-3 (tarjetas 10, 11, 12 y sus eventos), mostrar clima o calendario, cambiar las tarjetas de AN-1.

## Entrega
Candidato local en dev con QA PASS y handoff en docs/factory/ (SHAs, pruebas reales, fallos, migración si hubo).
```

## Prompt — AN-3 (spec 0237 §7; 2026-10-17; lanzar recién con AN-2 aceptada por QA e integrada en dev)

```
# Encargo: implementar la etapa AN-3 de Analíticas (spec 0237 §7: anulaciones, clientes y promos)

Mandan docs/specs/0237-analiticas-inbox-y-resumenes-diarios.md (§7 y lo común de §1–§4), ADR 0152 y ADR 0153.
AN-1 y AN-2 ya están integradas en dev: AN-3 se apoya en su suscriptor core, sus resúmenes y su inbox; no los
rediseña. Las decisiones de producto están cerradas: no se reabren.

## Primero
Leé los handoffs de AN-1 y AN-2 en docs/factory/ y confirmá el §7 contra el código real (voidPosOrder, alta de
core.order que es visita, alta de core.coupon_redemption, fin de campaña). Si algo de la spec no encaja, avisá al
owner antes de resolverlo por tu cuenta.

## Qué entra
- POS publica pos.order.voided en la tx de voidPosOrder; core publica visit.recorded y coupon.redeemed en la tx de
  su origen, con lo que pide el §7; traductores puros (ADR 0153), los de core en su registro.
- Métricas de AN-3 del §1: voided_tickets, visits, promo_discount/promo_sales (desde sale.closed v2+ con
  discountOrigin y desde coupon.redeemed, sin contar dos veces un canje que ya viajó en la venta POS).
- Tarjetas 10 (anulaciones), 11 (habitual que se va) y 12 (resultado de promo), con los textos, umbrales, pesos y
  acciones del §7. Tarjeta 11: verificá si Marketing permite mandar un cupón a un cliente; si no, la acción es «ver
  cliente» (H5). Informá cuál quedó.
- Histórico: clientes y promos (§4).
- Prueba real de Visual Crossing con la clave de apps/merchant/.env.local (diferida de AN-1 por el owner): una
  llamada real de pronóstico y observado para Cuenca, guardada por la ruta interna. Nunca imprimas la clave.

## Reglas
- Flujo de ADR 0144 y docs/AGENT-WORKFLOW.md: coordinador, hasta dos implementadores en worktrees propios desde
  dev, QA independiente. Migración nueva solo si hace falta, una, sin tocar las anteriores.
- Analíticas es core: sin switch ni variable de entorno. Core nunca importa ni nombra un módulo (ADR 0138/0139).
- El corte del conteo de Stock no se altera (§2.4).
- Node 24; DB solo con tools/neon-test.sh y la DB de replay válida, nunca DATABASE_URL.
- Pruebas focales: un caso Neon por evento nuevo (atómico con su origen, local correcto, sin alterar el corte) y
  unit por tarjeta con sus bordes (mínimo de un mes y max(3, media + 2 desvíos) en la 10; ≥ 4 visitas y la regla
  de mediana en la 11; sin doble conteo de canjes en la 12). Sin verify global ni mutaciones.
- No push, no deploy, no migración ni lectura de PROD. No editar INDEX, TASKS ni el estado de Claude.

## Fuera de alcance
Rendimiento de la evaluación (parqueado por el owner), «cuánto ahorraste» (PARQUEADO), mostrar clima o calendario,
cambiar las tarjetas de AN-1 y AN-2.

## Entrega
Candidato local en dev con QA PASS y handoff en docs/factory/ (SHAs, pruebas reales, fallos, migración si hubo,
resultado de la llamada real al clima).
```

## Prompt — Gastos (spec 0236 + ADR 0151; 2026-10-16; ajustado al ADR 0152 el mismo día; N ya está en `dev`)

```
# Encargo: SPEC chica + ADR — módulo Gastos (`expenses`, reemplaza a `profitability`)
# Solo documentos. Nada de código ni migración generada en este encargo.

## Reglas
- Leé CLAUDE.md, docs/TRABAJO-EN-PARALELO.md, docs/VERIFICACION.md, docs/MODULOS.md, la spec 0235 y el ADR 0150
  (tal como quedaron integrados). Del plan `docs/plan-margen-ganancia-2026-10-14.md` solo: «F rediseñada — Gastos,
  Medios y Analíticas» con sus subsecciones, incluida «Preguntas de G — respuestas del owner». Del ADR 0152
  (Analíticas, aceptado) solo §4 «Eventos que Gastos (G) tiene que publicar»: manda sobre cualquier otra mención de
  eventos de este encargo.
- No edites docs/INDEX.md, docs/TASKS.md ni los docs de estado de Claude. Sin push.
- Nivel L2 (dinero + migración a PROD): spec CHICA (`docs/specs/TEMPLATE-CHICA.md`) + ADR. Números: **spec 0236,
  ADR 0151** (verificá que sigan libres).
- N (0235) ya está integrado en `dev`; partí de `dev` actualizado (los dos tocan `profitability`).

## Orden obligatorio
1. Verificá «Lo que hay hoy» contra el código. Si aparece una decisión de producto que no está abajo, preguntale al
   owner (con tu recomendación) y esperá. No hay preguntas abiertas conocidas.
2. Escribí la spec y el ADR.
3. Detenete y entregá. No implementes.

## Para qué sirve
El dueño registra lo que paga («pagué de alquiler 900, de agua 20, compré una garrafa por 3.2, pagué a Luis su sueldo
450») dictando o con una foto; la IA arma las entradas y el dueño confirma. Es la fuente de gastos para el punto de
equilibrio y lo que el comercio gana o pierde, que calculará Analíticas (pieza AN, después; diseño en el ADR 0152).

## Lo que hay hoy (leído en el código el 2026-10-16; verificalo después de N)
- Módulo `apps/merchant/src/modules/profitability/` (label «Rentabilidad»): costos fijos de la 0231 (`fixed_cost`,
  `fixed_cost_period`, `fixed_cost_allocation`, rutas `costs*` y `totals`, `salary.ts` con FK a `staff_person`,
  `arithmetic.ts`, `intervals.ts`). N ya le sacó las comisiones.
- **PROD (leído 2026-10-16):** tablas de la 0231 con **0 filas**; ningún comercio tiene el módulo encendido; 0 miembros
  con el permiso `profitability`.
- IA por módulo (spec 0224 / ADR 0143): cada módulo declara sus tareas (`modules/stock/ai-tasks.ts`,
  `modules/recipes/ai-tasks.ts`) sobre `server/ai/task.ts`; el borrador se valida contra el negocio después
  (`modules/stock/draft.ts`). La entrada dictada/foto de Stock (`stock/ui/stock-input-modal.tsx`) es el modelo a seguir.
- Eventos: `server/module-events/publish.ts` hoy solo publica `sale.closed` (tipo fijo en `types.ts`); encendidos en
  PROD desde el 2026-10-16.

## Decisiones del owner (no se reabren)
1. Módulo **Gastos**, id interno **`expenses`** (renombra `profitability`). Solo gastos. Ítem propio del menú, sin
   agrupar. Sin carga inicial obligatoria.
2. **Las tablas de la 0231 se eliminan** con sus rutas y código (también `salary.ts` y la FK a `staff_person`); se
   crean tablas nuevas de registro de pagos. Las personas sin acceso de Equipo se quedan.
3. Registro **dictado o por foto**: la IA crea las entradas, el dueño confirma (como Stock y Recetas).
4. **Criterio de caja:** el gasto cuenta en el mes en que sale la plata.
5. **Sueldos como nombre libre** dentro de Gastos («Luis 450», «Luis horas extras 40»), sin alta en Equipo.
6. **Concepto estable por gasto** (categoría + nombre normalizado: «alquiler», «personal · Luis»): la IA reconoce
   «pagué a Luis», «sueldo Luis» y «Luis 450» como el mismo concepto. Lo necesita AN para estimar lo no pagado del mes.
7. **Categorías fijas + «otro» con texto libre.**
8. **Fijo / variable lo marca la IA** (lo que se consume, como agua o gas, es variable; el alquiler es fijo), visible
   como un check que el dueño **puede corregir sin estar obligado**. No lo deduce la categoría.
9. **Local:** cada gasto va a un local o a «todo el negocio»; por defecto el local donde está el dueño. Sin reparto
   `equal/manual`. **«Todo el negocio» se guarda sin local** (null), nunca con un local elegido (owner, 2026-10-16).
10. **Meses pasados NO se congelan** (owner, 2026-10-16: «no congelemos los meses pasados y listo»): se edita, borra y
    registra un gasto en cualquier mes, también con fecha de un mes pasado. Reemplaza lo anterior («solo dentro del mes
    en curso»).
11. **Foto:** no se guarda como comprobante. Se conserva hasta que el gasto se guarda (por si hay que reanalizarla en
    ese momento) y después se descarta. Nada en R2 de forma permanente.
12. **Permiso propio `expenses`** además del owner (los sueldos son sensibles).
13. **Publica eventos desde ya** (`expense.recorded`, `expense.updated`, `expense.deleted`) para los resúmenes por día
    de AN, aunque AN todavía no exista. Forma fijada por el ADR 0152 §4: versionados; fecha de pago (día local), monto
    en unidades menores y moneda del comercio, categoría, concepto estable, fijo/variable, local o «todo el negocio»;
    `updated` y `deleted` llevan el **estado completo resultante**, no un delta. El evento tiene que bastarse solo: AN
    lo leerá después sin consultar las tablas del módulo.
14. Fuera de G: estimados y punto de equilibrio (AN los calcula con el concepto y el check fijo/variable).

## La spec y el ADR tienen que dejar escrito
- Esquema nuevo (gasto: fecha de pago, monto y moneda del comercio, categoría, concepto, nombre libre, fijo/variable,
  local o todo el negocio, quién lo cargó) y migración: borrar tablas 0231, renombrar módulo y permiso, sin filas que
  migrar (verificá de nuevo en PROD con autorización del owner antes de implementar).
- Cómo la IA empareja el concepto con los conceptos ya usados por el comercio (como `itemId` en Stock) y qué pasa si
  se equivoca (el dueño lo corrige al confirmar).
- «Día del pago» y su mes según la zona horaria del comercio. Editar, borrar o registrar en un mes pasado está
  permitido (decisión 10): cada cambio publica su evento con el estado completo.
- Cómo se generaliza `module_event` para publicar `expense.*` (hoy `publish.ts` solo publica `sale.closed`; mínimo
  necesario, sin construir Analíticas). Resolvé los dos hallazgos del ADR 0152 §4:
  - `module_event` es único por (comercio, tipo, `source_id`): el `source_id` de cada `expense.updated` tiene que ser
    el de esa edición, no el del gasto, o la segunda edición choca;
  - `location_id` es obligatorio y un gasto de «todo el negocio» no tiene local: **va null** (decisión 9). Decí qué
    cambia en `module_event` para permitirlo y verificá que `sale.closed` y el corte del conteo de Stock
    (`modules/stock/count.ts`, que filtra por local) sigan igual.
  Si exige más que eso, decilo como hallazgo.
- Dónde vive la foto mientras dura el borrador y cómo se descarta.
- Qué se borra (rutas, tablas, código, textos «Rentabilidad», permiso viejo) sin redirects a rutas borradas.
- Pruebas mínimas y enfocadas: alta confirmada desde un borrador, concepto reconocido entre dos pagos, edición de un
  gasto de un mes pasado que publica su evento, gasto de «todo el negocio» sin local, permiso (owner sí; staff solo con `expenses`), aislamiento entre comercios, evento
  publicado. No suites enteras.

## Fuera de alcance
Analíticas (resúmenes por día, vocabulario de métricas, inbox: son de AN), punto de equilibrio, estimados, Smart Menu,
medios de pago y comisiones (ya en N), reparto entre locales, comprobantes guardados, gastos recurrentes automáticos.

## Entrega
`docs/specs/0236-...md` y `docs/adr/0151-...md` en `dev`, con las decisiones del owner citadas. Sin push. Lista de
hallazgos a decidir aparte, sin escribirlos como decisión del owner.
```

## Prompt — encender `MODULE_EVENTS_ENABLED` en PROD (2026-10-16; lanzar cuando el owner lo diga)

```
# Encargo: encender la publicación de eventos de módulos en PROD
# Operación, no funcionalidad. Sin código nuevo salvo que algo falle.

## Reglas
- Leé CLAUDE.md, docs/TRABAJO-EN-PARALELO.md, docs/VERIFICACION.md y la skill gotchas-del-repo.
- No edites docs/INDEX.md, docs/TASKS.md ni los docs de estado de Claude.
- Cada paso en PROD (push, variable en Vercel, redeploy) necesita la autorización explícita del owner en ese
  momento. Pedila paso por paso; no la infieras de este encargo.
- Suites Neon solo con tools/neon-test.sh. De un .env o de Vercel se imprime la CLAVE y metadatos, nunca el valor.
- Nivel: operación PROD que toca stock y dinero → piso L2 en verificación (no hace falta spec).

## Orden obligatorio
1. Revisá y mostrale al owner el plan de pasos de abajo con lo que verificaste. Detenete y esperá su OK.
2. Ejecutá paso por paso, pidiendo autorización en cada operación PROD.

## Para qué sirve
Hoy `MODULE_EVENTS_ENABLED` está apagado en PROD (`server/module-events/publish.ts:60`): las ventas cierran pero no
se guarda `sale.closed` en `core.module_event` (PROD: 0 filas, 2 pagos reales). Sin eventos no se descuenta stock por
receta, no se congela el costo de lo vendido (0230) ni se calcula la comisión (0233). El owner quiere que quede
registrando siempre: de ahí salen stock, costos y, más adelante, Analíticas.

## Lo que hay hoy (verificalo)
- Flag: `process.env.MODULE_EVENTS_ENABLED !== "true"` → no publica. OFF por defecto desde la 0227.
- Reintentos: `GET /api/internal/module-events/retry` con `Authorization: Bearer CRON_SECRET`. El cron lo configura
  el OWNER en cron-job.org (ADR 0118); no lo configures por él.
- `dev` va 16 commits delante de `origin/main`; entre ellos `036615c0` (fix del transaction-timeout en el COMMIT del
  reintento de Stock). **Tiene que estar en PROD antes de encender.**
- PROD: 4 comercios; Stock y Recetas activos en 2. Desde el encendido, sus ventas empiezan a descontar insumos.

## Pasos
1. Subir `dev` a `main` (merge --ff-only, gates locales, push con autorización). Deploy de Vercel `READY` con ese sha.
2. Confirmar que existen `CRON_SECRET` en Vercel PROD (solo clave y metadatos) y que el owner tiene el job de
   cron-job.org apuntando a la ruta de reintentos. Si no existe, avisale: lo crea él.
3. Cargar `MODULE_EVENTS_ENABLED=true` en Vercel Production y redeploy (con autorización).
4. Pedirle al owner que cierre UNA venta de prueba en el POS de un comercio con Stock+Recetas.
5. Verificar por SQL de solo lectura en PROD: la fila en `core.module_event` (tipo, versión 2, local, orden), sus
   filas en `core.module_event_delivery` en estado aplicado, el consumo de stock de esa venta y el resultado de
   comisión (o «sin configurar», nunca 0 inventado). Llamar una vez a la ruta de reintentos y ver que responde ok.
6. Si algo falla: volver a poner el flag en `false` (con autorización) y reportar con la evidencia.

## Fuera de alcance
- No se reprocesan las 17 órdenes anteriores: quedan sin evento (decisión de diseño de 0227/0149).
- Generalizar `module_event` para eventos de otros módulos (hoy solo `sale.closed`, `location_id` obligatorio): va en
  el ADR de Analíticas, no acá.

## Entrega
`docs/factory/release-module-events-<fecha>.md`: sha subido, cada autorización con su hora, resultado SQL de la venta
de prueba (ids, sin datos personales), estado final del flag. Commit en `dev`, sin push extra.
```

## Prompt — Negocio + medios de pago al core (spec 0235 + ADR 0150; 2026-10-16)

Owner 2026-10-16: «vamos con Negocio… Marca para el branding, Negocio para las configuraciones del negocio que incluso
en el futuro pueden ser un montón de cosas». Sobre quién tiene `brand` hoy: «no me importa, mientras el owner del
negocio conserve el acceso a la nueva sección Negocio es suficiente».

```
# Encargo: SPEC chica + ADR — espacio core «Negocio» y medios de pago al core
# Solo documentos. Nada de código ni migración generada en este encargo.

## Reglas
- Leé CLAUDE.md, docs/TRABAJO-EN-PARALELO.md, docs/VERIFICACION.md, docs/MODULOS.md, la spec 0233 y el ADR 0149.
  Del plan `docs/plan-margen-ganancia-2026-10-14.md` solo: «P1 — decisiones del owner» y «F rediseñada — Gastos,
  Medios y Analíticas» (con sus subsecciones).
- No edites docs/INDEX.md, docs/TASKS.md ni los docs de estado de Claude. Sin push.
- Nivel L2 (dinero + migración a PROD con datos reales): spec CHICA (`docs/specs/TEMPLATE-CHICA.md`) + ADR.
  Números: **spec 0235, ADR 0150** (quedaron libres: P3 cerró sin spec).
- **Conservar el selector de medio que hoy tiene el POS al cobrar.** Cambia de dónde lee, no se borra.
- **Conservar Marca** con su identidad (logo, colores, nombre): solo se le sacan Regional y Fiscal.

## Orden obligatorio
1. Hacele al owner las preguntas de abajo (con tu recomendación) y esperá sus respuestas.
2. Recién después escribí la spec y el ADR.
3. Detenete y entregá. No implementes.

## Para qué sirve
Los medios de pago y su comisión son del comercio, no del POS. Una barbería que no usa el POS también cobra con
tarjeta o DeUna. El owner decidió: **los medios pasan al core y se editan en un espacio core nuevo, «Negocio», con
la comisión dentro de cada medio; el POS (y en el futuro otros módulos) los consume.** «Negocio» junta las
configuraciones del negocio (hoy: Medios de pago, Configuración regional, Datos fiscales; en el futuro, más cosas).
Marca queda solo para el branding. Además el módulo
`profitability` va a pasar a ser **Gastos** (`expenses`), que solo guarda gastos: las comisiones tienen que salir de
ese módulo en este encargo (Gastos va después, en serie).

## Lo que hay hoy (leído en el código el 2026-10-16; verificalo)
- Catálogo de plataforma: `core.payment_method_catalog` (ya es core, solo lectura, por país).
- Medios del comercio: `pos.payment_method` (id, business_id, catalog_id, name, charge_shape, is_cash, status) e
  inicialización `pos.payment_method_initialization`; se cargan con `onEnable: initializePaymentMethods` del POS
  (`modules/pos/server/routes.ts`) y se exponen como recurso genérico (`resourceProviders`).
- Rutas en `modules/pos/server/payment-routes.ts`: `GET payment-methods`, `GET payment-method-catalog`,
  `POST payment-methods`, `POST payment-methods/:id/archive`. UI del POS: `modules/pos/ui/pos-payment-actions.ts`.
- Pagos por orden: `pos.order_payment` con `method_id` + `method_provider_id` (default `"pos"`), `method_name`,
  `charge_shape`, importe; FK a `pos.payment_method`.
- Comisión: `profitability.commission_revision` (revisiones inmutables: percent, fixed, original_fixed, moneda) y
  `profitability.payment_commission` (resultado por pago); cálculo en
  `modules/profitability/server/commissions/{config,apply,read}.ts`, suscrito a `sale.closed`. Rutas
  `GET commissions`, `PUT commissions/:methodId`, `GET sale-commissions/:sourceOrderId`.
- **Congelado (ADR 0149), se conserva tal cual:** cada cambio de comisión crea una revisión inmutable; la venta
  captura al cerrar el id de la revisión vigente; el resultado se guarda con su porcentaje. Un cambio de comisión
  nunca recalcula ventas pasadas (el owner lo pidió explícitamente).
- Marca: `app/backoffice/brand/` (guardia: permiso `brand`). Hoy incluye Configuración regional
  (`regional-fields.tsx`) y Datos fiscales (`fiscal-fields.tsx`), que también los ve quien tiene `brand`. El tour de
  Marca (`brand-tour-definitions.ts`) y el checklist de arranque (`server/onboarding/`) los referencian: verificalo.
- Permisos core: `packages/db/src/permissions-catalog.ts` + check `business_membership_permissions_check` en la base.
- «Configuración» (`app/backoffice/settings/`) es otra cosa: solo owner, toggles de módulos y sus paneles. No se toca.
- **PROD (leído 2026-10-16):** 4 comercios; `pos.payment_method` **22 filas**, `pos.payment_method_initialization` 4,
  `pos.order_payment` **2**, `commission_revision` 0, `payment_commission` 0, `core.module_event` 0.

## Decisiones del owner (no se reabren)
1. Medios de pago y comisión → **core**, en el espacio nuevo **«Negocio»** → Medios de pago. El POS consume.
1b. **«Negocio» es core, no un módulo** (no se apaga). Secciones: **Medios de pago, Configuración regional, Datos
    fiscales**. Regional y Fiscal se **mudan** desde Marca tal como están (se borran de Marca). Marca = branding.
1c. **El owner siempre tiene acceso a Negocio**; hay un **permiso propio** para delegarlo a alguien del staff. A quién
    tiene `brand` hoy no se le da el permiso nuevo automáticamente (owner: «no me importa, mientras el owner conserve
    el acceso»).
1d. Menú: «Negocio» entra como un ítem más, sin agrupar (owner: agrupar cuando haya 2–3 rubros).
2. La comisión se configura dentro de cada medio, una vez (no mes a mes).
3. Comisión de una venta = medio elegido en la venta × su configuración, **congelada al cerrar**.
4. Lo de P1 sigue: lista que el comercio amplía o recorta, catálogo por país con forma de cobro y sin tasas, medios
   libres, quitar = archivar, **Efectivo nunca se archiva**, base = lo cobrado tras el descuento, pagos mixtos.
5. El módulo `profitability` se renombra a `expenses` en el encargo de Gastos (no en este); acá solo se le sacan
   las comisiones.

## Preguntas para el owner (con tu recomendación)
- Cuándo se cargan los medios: antes era «al prender el POS». Recomendación: al crear el comercio; los 4 actuales,
  en la migración (ya los tienen).
- Id del permiso nuevo y ruta de la pantalla: proponé (p. ej. permiso `business`, ruta `/backoffice/business`).
- Dónde se calcula la comisión: al cerrar la venta (el core ya tiene la configuración a mano, sin suscriptor) o
  después como hoy. Proponé en el ADR con costo y beneficio.
- Medio sin comisión cargada: el plan P1 dice «0 con aviso» y el ADR 0149 trata la falta de configuración como
  «sin dato». Verificá cuál está implementado y preguntale al owner cuál queda.

## La spec y el ADR tienen que dejar escrito
- Esquema core destino y migración de PROD: conservar los **ids** de los 22 medios y los **2 pagos**, qué pasa con
  `method_provider_id = "pos"` en los pagos existentes, y el orden de despliegue sin dejar al POS sin medios.
- Que el congelado por revisión de la 0149 se mantiene igual, con un test que lo pruebe (cambiar la comisión no mueve
  una venta ya cerrada).
- Qué se borra del POS, de `profitability` y de Marca (rutas, tablas, código, pasos del tour), sin dejar redirects a
  rutas borradas; cómo quedan el tour y el checklist.
- Migración del permiso: alta en el catálogo y en el check de la base, sin backfill a nadie.
- La pantalla Negocio con sus tres secciones; Medios de pago: lista, agregar desde el catálogo del país o libre, archivar, comisión por
  medio mostrando solo los campos de su forma de cobro.
- Pruebas mínimas y enfocadas: migración con datos como los de PROD, cierre POS con el medio desde core, congelado,
  aislamiento entre comercios, acceso a Negocio (owner sí; staff solo con el permiso; `brand` solo ya no ve
  fiscal/regional). No suites enteras.

## Fuera de alcance
Gastos y el renombre del módulo, Analíticas, generalizar `module_event`, propinas, anulaciones, diferidos,
comisión por local o por profesional.

## Entrega
`docs/specs/0235-...md` y `docs/adr/0150-...md` en `dev`, con las respuestas del owner citadas. Sin push. Lista de
hallazgos a decidir aparte, sin escribirlos como decisión del owner.
```

## Notas para las etapas futuras

- **Etapa 2:** congelar `costo promedio × factor vigente` (factor = 1 hasta la etapa 6), para no migrar de nuevo.
- **Etapa 3:** con varios productos se acumula ganancia en $ y se traduce a unidades al final. Mensaje tipo: «Este mes
  tenes $3.000 de fijos; llevas $2.310 de ganancia; te faltan $690. Al ritmo de esta semana los cubris el dia 24».
- **Etapa 4:** cuadrantes por categoria (ganancia por unidad × unidades vendidas): estrella / caballo / puzzle /
  perro, cada uno con una accion en $. Diferencial Checkpass: empujar los puzzles con cupon o push y medir «el cupon
  te costo $60 y trajo $340». El simulador debe decir «si vendes igual que hoy…».
- **Etapa 6:** factor < 1 (compra no cargada / conteo mal hecho) no se aplica, se avisa; factor muy alto (> ~1,25)
  se avisa antes de aplicar. Hasta dos conteos, factor 1 y la ficha dice «segun receta». Contar solo los 10–15
  insumos que pesan el 80 % del costo.

## IVA en Ecuador (investigado 2026-10-14, fuentes de prensa/estudios, no la ley; revisar con contador antes de mostrar «IVA recuperable»)

- Comida preparada en restaurantes/cafeterias: 15 %. Hubo una rebaja temporal al 8 % en un feriado de 2026 (Decreto 368).
- El IVA va por linea en la factura electronica del SRI: un ticket puede mezclar 0 % y 15 % (p. ej. panaderia: pan
  basico INEN 2945 al 0 %, pasteleria al 15 %). En compras: leche nacional y pan basico 0 %, procesados 15 %.
- Fuentes: primicias.ec (alimentacion 15 %, pan INEN 2945), elcomercio.com (SRI corrige pan y leche), nmslaw.com.ec
  (circular sobre procesados), extra.ec (8 % en feriado).

## Prompt pendiente — pieza 1.3 (lanzar cuando el owner lo diga)

````markdown
# Encargo: SPEC de la pieza 1.3 — lectura del costo y la ganancia de un producto
# Solo spec. Nada de código en este encargo.

## Reglas
Leé antes: `CLAUDE.md`, `docs/TRABAJO-EN-PARALELO.md`, `docs/MODULOS.md`,
`docs/specs/0227-stock-por-local-y-consumo-por-receta.md`, `docs/specs/0228-costo-promedio-ponderado-por-insumo-y-local.md`,
`apps/merchant/src/modules/recipes/{cost,read}.ts`, `apps/merchant/src/modules/recipes/server/routes.ts`,
`packages/db/src/schema/{catalog.ts,modules/recipes.ts}`.
- No editar `docs/INDEX.md`, `docs/TASKS.md` ni `docs/estado/*`. Sin push. Nivel: piso L2 (dinero).
- **Orden obligatorio:** (1) le preguntás al owner lo que figura abajo y esperás sus respuestas; (2) escribís la
  spec chica (`docs/specs/TEMPLATE-CHICA.md`, siguiente número libre); (3) te detenés. Lo que el owner no respondió
  va como *hallazgo a decidir*.

## Para qué sirve
Es el contrato que va a consumir la ficha del producto (la UI se piensa después, no es parte de esto):
«Pizza Muzzarella · $10. Producirla te cuesta $2,54. Te quedan $7,46 por cada una. De cada $10 que cobrás, $2,54 se
van en ingredientes».

## Decisiones del owner (no se reabren)
1. **Costo = Σ (cantidad por unidad de la receta × costo promedio del insumo en ese local)**, con el costo de la
   spec 0228. El precio es el del catálogo, sin IVA. Ningún dato fiscal entra en el cálculo.
2. **Costo incompleto:** si un insumo de la receta no tiene costo, se devuelve el costo parcial marcado como
   incompleto y la lista de insumos sin precio («faltan precios de: orégano»). No se esconde.
3. **Local:** si el comercio tiene un solo local, se usa ese. Con varios, el criterio de la spec 0227.
4. Un producto sin elaboración (gaseosa) es una receta de un insumo: entra igual.
5. Solo lectura, sin pantallas.

## Preguntas para el owner (con tu recomendación)
- **¿Extender la lectura de Recetas que ya existe o crear una ruta nueva?** Mirá qué devuelve hoy y recomendá.
- **¿Un producto o también la lista?** Además del detalle de un producto, ¿una lectura de todos los productos con
  su costo y ganancia por local? (Sirve para la ficha y más adelante para la ingeniería de menú.)
- **Qué se devuelve ya calculado y qué calcula la UI:** ganancia, % de ingredientes, «de cada $X…». Recomendación
  de partida: el backend devuelve los números (costo, ganancia, % ingredientes) y la UI arma las frases.
- **Producto sin receta, sin precio, o con el módulo de recetas apagado:** qué responde cada caso.

## La spec tiene que dejar escrito
La forma exacta de la respuesta (campos, tipos, decimales), los casos borde y un **documento de consumo** con
ejemplos reales de request/response: pizza $10 / costo $2,54, una receta incompleta y una gaseosa. Pruebas mínimas:
cálculo con el costo promedio, costo incompleto, producto sin receta, local único por defecto, aislamiento entre
comercios y entre locales.

## Fuera de alcance
Pantallas, costo congelado en la venta, ganancia de lo vendido, punto de equilibrio, ingeniería de menú, datos
fiscales.

## Entrega
Preguntas hechas y respuestas, path de la spec y hallazgos abiertos.
````

## Prompts pendientes — piezas 2 y F (2026-10-14, en paralelo; lanzar cuando el owner lo diga)

Revisado el codigo antes de escribirlos (`stock/consumption.ts`, `stock/local.ts`, `recipes/server/consumption*.ts`,
`module-events/types.ts`, esquemas `stock`, `location`, `business_membership`, `permissions-catalog.ts`). Numeros de
spec reservados para que no choquen: **0230 = pieza 2**, **0231 = F**.

### Pieza 2

````markdown
# Encargo: SPEC de la pieza 2 — costo de lo vendido
# Solo spec. Nada de código en este encargo.

## Reglas
Leé antes: `CLAUDE.md`, `docs/TRABAJO-EN-PARALELO.md`, `docs/MODULOS.md`, specs `0227` y `0228` (y ADR 0145/0146),
`apps/merchant/src/modules/stock/{consumption,local,numbers}.ts`, `apps/merchant/src/modules/decimal.ts`,
`apps/merchant/src/modules/recipes/server/{consumption,consumption-snapshot}.ts`,
`apps/merchant/src/server/module-events/{types,publish}.ts`, `packages/db/src/schema/modules/stock.ts`,
`packages/db/src/schema/module-event.ts`. Del plan `docs/plan-margen-ganancia-2026-10-14.md` solo las filas 2, R1 y 6
de la tabla de etapas y «Notas para las etapas futuras».
- No editar `docs/INDEX.md`, `docs/TASKS.md` ni `docs/estado/*`. Sin push. Nivel: piso L2 (dinero).
- Número de spec: **0230** (la pieza F va en paralelo con la 0231).
- **Orden obligatorio:** (1) le preguntás al owner lo que figura abajo y esperás sus respuestas; (2) escribís la
  spec chica (`docs/specs/TEMPLATE-CHICA.md`); (3) te detenés. Lo que el owner no respondió va como *hallazgo a decidir*.

## Para qué sirve
Que cada venta cobrada quede con su costo de ingredientes congelado: si mañana sube la harina, la ganancia de lo ya
vendido no cambia. Es la base del Smart Menu y del punto de equilibrio, y empieza a acumular historia desde ya.

## Lo que ya hay (leído en el código el 2026-10-14; verificalo)
- El suscriptor `sale.closed` de Recetas expande la revisión capturada en el cierre y llama a `applyConsumption`, que
  inserta un movimiento `kind='consumption'` (cantidad negativa) por (orden, línea, insumo), idempotente por índice
  único y con chequeo de «snapshot conflict» en la reentrega. Corre asíncrono, en la transacción de entrega del evento,
  con reintentos, y ya toma `FOR UPDATE` los pares `stock.item_location` del local.
- El promedio de la 0228 está en `stock.item_location.weighted_average_unit_cost` (6 decimales; null = desconocido,
  0 = conocido cero). El CHECK de consumo hoy exige `total_cost null`.
- Según git local, 0227/0228 están en `main` local sin push: en PROD no habría consumos sin costo. Confirmalo.

## Decisiones del owner (no se reabren)
1. Cada movimiento de consumo guarda **costo promedio del insumo en ese local × factor de pérdida**. Factor = 1 hasta
   la etapa 6, pero se guarda ya para no migrar de nuevo.
2. **El costo se congela:** compras, conteos o cambios de receta posteriores nunca cambian el costo de lo ya vendido.
3. **Costo de la venta = suma de sus consumos**; el de una línea, la suma de los consumos de esa línea.
4. Costo de compra = lo pagado, IVA incluido. Ningún dato fiscal entra en el cálculo.
5. Nunca se bloquea ni se demora una venta por esto. El POS no muestra nada.

## Preguntas para el owner (con tu recomendación)
- **«Costo del momento»:** el consumo se aplica asíncrono. Si entra una compra entre el cobro y la aplicación, ¿vale el
  costo al aplicar? Recomendación: sí, el del momento de aplicación, leído bajo el lock del par, sin recalcular después
  (mismo criterio de imprecisión que el owner aceptó en la 0228, pregunta 7).
- **Insumo sin costo:** recomendación: el movimiento queda con costo null (no 0) y la venta se lee como costo parcial
  marcado incompleto con la lista de insumos sin precio (el criterio que el owner fijó para la pieza 1.3).
- **Qué se guarda:** recomendación: costo unitario (6 decimales) y factor por separado en el movimiento; el importe se
  deriva y se redondea a centavos una sola vez al sumar la venta. Compará con guardar el importe y recomendá.
- **Cómo se lee:** ¿ruta nueva, o solo guardar + una función de servidor con test? Recomendación: lo segundo; la
  lectura agregada la define SM-datos. Si queda código sin uso hoy, proponé la fila de `TASKS` dentro de la spec.
- **Venta sin consumo** (producto sin receta, Recetas o Stock apagado, consumo pendiente o fallido): ¿cómo se distingue
  de costo $0? Recomendación: estados distintos, nunca 0 por defecto.

## La spec tiene que dejar escrito
Columnas nuevas y CHECKs; cómo convive con la idempotencia de `applyConsumption` (una reentrega no recalcula el costo;
si el costo entra o no en la comparación del conflicto); escalas y redondeo con un ejemplo numérico (el de la 0228:
promedio 2.666667, se venden 3 unidades); por qué R1 no la rompe (R1 cambia la expansión, no el movimiento); y si la
migración necesita backfill. Pruebas mínimas: costo congelado ante una compra posterior, insumo sin costo, factor 1,
reentrega idempotente sin cambiar el costo, suma de la venta con redondeo, aislamiento entre comercios y entre locales.

## Fuera de alcance
Recetas independientes y combos (R1), costo por producto (1.3), medio de pago y comisiones, packaging, cupones,
conteos y factor real (etapa 6), pantallas, Smart Menu, punto de equilibrio.

## Entrega
Preguntas hechas y respuestas, path de la spec, hallazgos abiertos y si hace falta migración (no la generes: el número
se asigna al implementar, porque F también puede migrar).
````

### Pieza F

````markdown
# Encargo: SPEC de la pieza F — costos fijos por local y staff
# Solo spec. Nada de código en este encargo.

## Reglas
Leé antes: `CLAUDE.md`, `docs/TRABAJO-EN-PARALELO.md`, `docs/MODULOS.md`, `packages/db/src/schema/business.ts`
(tabla `location`), `packages/db/src/schema/membership.ts`, `packages/db/src/permissions-catalog.ts`,
`apps/merchant/src/modules/{contract,registry}.ts`, `apps/merchant/src/modules/stock/{manifest,local}.ts` (ejemplo de
módulo y de cómo se elige el local). Del plan `docs/plan-margen-ganancia-2026-10-14.md` solo las filas F, SM-datos y
SM de la tabla de etapas y la nota «Etapa 3».
- No editar `docs/INDEX.md`, `docs/TASKS.md` ni `docs/estado/*`. Sin push. Nivel: piso L2 (dinero).
- Número de spec: **0231** (la pieza 2 va en paralelo con la 0230).
- **Orden obligatorio:** (1) le preguntás al owner lo que figura abajo y esperás sus respuestas; (2) escribís la
  spec chica (`docs/specs/TEMPLATE-CHICA.md`); (3) te detenés. Lo que el owner no respondió va como *hallazgo a decidir*.

## Para qué sirve
Cargar lo que el comercio paga cada mes aunque no venda (alquiler, luz, internet, sueldos) para mostrar después el
punto de equilibrio: «Este mes tenés $3.000 de fijos; llevás $2.310 de ganancia; te faltan $690».

## Lo que ya hay (leído en el código el 2026-10-14; verificalo)
- Locales: `core.location` (nombre, `status` active/archived). Nada de costos.
- El staff es `core.business_membership` con `role='staff'`: **es por comercio, no tiene local asignado**, y solo
  existe quien entra a la app (un cocinero que no la usa no tiene fila).
- Permisos: catálogo core de 7 (`brand`, `catalog`, `counter`, `locations`, `loyalty`, `marketing`, `staff`); los
  módulos declaran los suyos en su manifiesto (Stock declara `stock`).
- Hoy no hay nada de costos fijos. Comercios en Ecuador (USD); el modelo no se ata a un país.

## Decisiones del owner (no se reabren)
1. Costos fijos **por local** y **de staff** (sueldos).
2. **No se reparten en el costo del producto:** se usan como punto de equilibrio contra la ganancia del mes.
3. Periodo: el mes en curso; en analítica, históricos (3/6/9/12 meses, mismo periodo del año anterior).
4. Sin configurar = 0. Nunca bloquea nada.

## Preguntas para el owner (con tu recomendación)
- **Sueldos:** ¿atados a un integrante del equipo o líneas libres («Sueldo cocinero»)? Recomendación: líneas libres
  de tipo personal, sin atarlas a la membresía (quien no usa la app también cobra).
- **Local:** con varios locales, ¿cada costo va a un local o puede ser de todo el comercio (contador, software)?
  Recomendación: un local o «todo el comercio»; cómo se reparte lo general en el punto de equilibrio por local lo
  decide SM-datos.
- **Historial:** si el alquiler sube en marzo, los meses anteriores tienen que conservar el valor viejo para los
  históricos. Recomendación: vigencia por mes (desde / hasta) y editar = cerrar la vigencia y abrir otra.
- **Periodicidad:** recomendación: solo importe mensual (lo anual se carga dividido); proponé otra si ves razón.
- **Quién lo ve y lo edita** (los sueldos son sensibles): recomendación: permiso propio, que el staff no tenga por
  defecto.
- **Dónde vive:** ¿módulo propio (`modules/<id>/`) o core? Recomendá según `docs/MODULOS.md`.

## La spec tiene que dejar escrito
Modelo (tablas, importes en la moneda del comercio con 2 decimales), contrato HTTP (alta, edición, baja, lista por
local), cómo se calcula «total de fijos del mes M, por local y del comercio» con un ejemplo, y qué pasa con un local
archivado. Pruebas mínimas: alta/edición/baja, permisos, total del mes con cambio de vigencia, aislamiento entre
comercios y entre locales.

## Fuera de alcance
Cálculo del punto de equilibrio contra la ganancia (SM-datos), Dashboard, pantallas (las piensan owner + Claude),
reparto en el costo del producto, costo de lo vendido, comisiones, IVA, nómina (horas, cargas sociales, pagos).

## Entrega
Preguntas hechas y respuestas, path de la spec, hallazgos abiertos y si hace falta migración (no la generes: el número
se asigna al implementar, porque la pieza 2 también puede migrar).
````

## Prompt pendiente — R1 (spec 0232 + ADR 0148; lanzar cuando el owner lo diga)

````markdown
# Encargo: SPEC + ADR de la pieza R1 — recetas independientes y combos
# Solo documentos. Nada de código en este encargo.

## Reglas
Leé antes: `CLAUDE.md`, `docs/TRABAJO-EN-PARALELO.md`, `docs/MODULOS.md`, specs `0227`, `0228`, `0230` (sobre todo
«Compatibilidad R1») y ADR 0138/0139/0145, `packages/db/src/schema/modules/recipes.ts`,
`packages/db/src/schema/module-event.ts`, `apps/merchant/src/modules/recipes/{recipes,read,cost}.ts`,
`apps/merchant/src/modules/recipes/server/{routes,consumption,consumption-snapshot}.ts`,
`apps/merchant/src/server/module-events/{publish,types}.ts`, `apps/merchant/src/modules/stock/consumption.ts`.
Del plan `docs/plan-margen-ganancia-2026-10-14.md`: las secciones «Recetas independientes y combos» y «R1 — huecos
cerrados con el owner».
- No editar `docs/INDEX.md`, `docs/TASKS.md` ni `docs/estado/*`. Sin push. Nivel: piso L2 (dinero + migración).
- Números: **spec 0232**, **ADR 0148**.
- **Orden obligatorio:** (1) si al leer el código falta una decisión de producto, se la preguntás al owner y esperás;
  (2) escribís la spec (`docs/specs/TEMPLATE-CHICA.md`) y el ADR; (3) te detenés. Lo no respondido va como
  *hallazgo a decidir*.

## Para qué sirve
Que un restaurante pueda vender «Almuerzo $3» cuyo contenido cambia cada día, «Docena de empanadas» o «Combo 1»,
y que cada venta descuente stock y congele el costo de lo que realmente llevaba. Base de 1.3, P2, etapa 6 y Smart Menu.

## Lo que hay hoy (leído en el código el 2026-10-14; verificalo)
- La receta **es** el producto: `recipes.line` y `recipes.revision` se identifican por `product_id`; borrar el producto
  borra sus líneas. Todas las rutas son `/:productId` (ver, guardar, dictado, foto).
- Al guardar, se crea una revisión inmutable y se apunta `core.module_resource_version` (product, `recipes`, slot
  `recipe`) a ella. El cierre del POS captura ese único puntero por producto en el evento `sale.closed`.
- El consumo es único por (orden, línea, insumo). La 0230 dice que R1 consolida un insumo repetido dentro de una línea.

## Decisiones del owner (no se reabren)
1. **Receta** = 1 unidad de algo, con nombre y revisiones propias, **a nivel de comercio** (una para todos los locales).
   Puede existir **sin producto** (p. ej. 20 sopas que solo se usan en el Menú).
2. **Producto = lista de (receta, cantidad)**, versionada. Normal: como máximo 1 receta. **Combo:** varias. La cantidad
   admite decimales (Media pizza = Pizza × 0,5). **Un combo no contiene otro combo.** Sin sub-recetas.
3. **«Es un combo» se marca en Recetas**, al elegir el producto; marcado habilita más de una receta. Nada en Catálogo.
   El combo se arma solo en Recetas, con recetas existentes.
4. Cambiar el almuerzo = **editar la composición**; las anteriores quedan como historial. **Revisiones en dos
   niveles:** editar la sopa versiona la sopa; editar el combo versiona la composición.
5. **Cada venta usa la versión de la composición y de cada receta vigentes al CERRAR la venta**, aunque el consumo se
   aplique después. **Sin bloqueos** por órdenes abiertas. Lo vendido nunca cambia.
6. **No se borra, se archiva.** Borrar un producto no borra sus recetas. Nombre de receta **único entre activas, sin
   distinguir mayúsculas**.
7. **Migración:** cada receta actual queda con el nombre de su producto, asignada a él × 1. Nada de lo que funciona
   cambia para el comerciante.
8. Stock y costo siguen por local (0227/0228); la receta es compartida. Rentabilidad = la de la receta, también por
   composición (Smart Menu). La UI de Recetas (lista, buscador, modal del combo) se piensa después con el owner.

## Lo que la spec y el ADR tienen que resolver (proponé y justificá)
- **Cómo se resuelve la versión de cada receta al cerrar** sin cambiar el core si es posible (p. ej. revisión de la
  composición capturada por el puntero + revisión de cada receta vigente a `closedAt`). Si hace falta tocar el core o
  el payload del evento, decilo y justificalo en el ADR.
- **Procedencia del consumo:** el Smart Menu tiene que poder atribuir costo por receta dentro de un combo («pizzas
  sueltas vs dentro de combos»). Elegí entre consolidar el insumo por línea (lo que anticipa la 0230) + guardar la
  procedencia aparte, o incluir la receta en la clave del consumo. No alterar costos ya congelados.
- **Lectura del efecto de una venta** para la vista previa obligatoria («cada venta de Docena descuenta 12 × Empanada
  de carne → 1,2 kg de carne…»): el contrato tiene que poder darla.
- **Contrato HTTP nuevo** (recetas por id propio, composición del producto, combo, archivar) y qué pasa con las rutas
  `/:productId` actuales, el dictado y la foto (ADR 0070 §17: lo viejo se borra).
- **Migración** de datos (sin cambiar comportamiento) y corte con el aplicador de la 0230.
- **Pregunta para el owner:** archivar una receta que algún producto usa hoy. Recomendación: se bloquea, mostrando dónde
  se usa.

## Pruebas mínimas
Migración (cada producto con receta vende y descuenta igual que antes), combo con dos recetas que comparten insumo,
cantidad decimal, versión al cerrar (editar después del cierre no cambia el consumo), receta sin producto no descuenta
nada, archivar, nombre duplicado, aislamiento entre comercios.

## Fuera de alcance
UI de Recetas, costo por receta y por producto y el costo del catálogo (1.3), packaging y «para llevar» (P2), medio de
pago (P1), cupones (P3), conteos (6), compra repartida o transferencias entre locales, modificadores del POS
(«Coca o Pepsi»), precios por local.

## Entrega
Preguntas hechas y respuestas, paths de la spec y del ADR, hallazgos abiertos y si hace falta migración (no la generes).
````

## Prompt pendiente — P1 (spec 0233 + ADR 0149; lanzar cuando el owner lo diga)

````markdown
# Encargo: SPEC + ADR de la pieza P1 — medio de pago y comisiones
# Solo documentos. Nada de código en este encargo.

## Reglas
Leé antes: `CLAUDE.md`, `docs/TRABAJO-EN-PARALELO.md`, `docs/MODULOS.md`, ADR 0138/0139/0141/0145, specs `0230` y
`0231` (módulo Rentabilidad, en implementación), `apps/merchant/src/modules/pos/server/{close,lines,order-input}.ts`,
`apps/merchant/src/modules/pos/ui/pos-checkout.tsx`, `packages/db/src/schema/modules/pos.ts`,
`apps/merchant/src/server/module-events/{publish,types}.ts`, `apps/merchant/src/modules/contract.ts`,
`packages/db/src/schema/business.ts` (`country_code`, `currency_code`). Del plan
`docs/plan-margen-ganancia-2026-10-14.md`: la sección «P1 — decisiones del owner».
- No editar `docs/INDEX.md`, `docs/TASKS.md` ni `docs/estado/*`. Sin push. Nivel: piso L2 (dinero).
- Números: **spec 0233**, **ADR 0149** (R1 tiene reservados 0232/0148).
- **Orden obligatorio:** (1) si al leer el código falta una decisión de producto, se la preguntás al owner y esperás;
  (2) escribís la spec (`docs/specs/TEMPLATE-CHICA.md`) y el ADR; (3) te detenés. Lo no respondido va como
  *hallazgo a decidir*.

## Para qué sirve
Saber con qué cobró cada venta y cuánto se lleva el procesador, para que la ganancia del Smart Menu y el punto de
equilibrio descuenten la comisión real.

## Lo que hay hoy (leído en el código el 2026-10-14; verificalo)
- La orden POS no guarda total ni medio de pago; el total sale de las líneas al cerrar.
- El cupón solo se aplica con cliente identificado (`grantWithCouponInTx` crea `core.order` con el total descontado);
  una venta sin cliente no deja registro del cobrado fuera de sus líneas.
- El evento `sale.closed` (versión 1) lleva productos y cantidades, sin precios ni medio.
- Precios del cierre con `toFixed(2)` fijo (la 0230 ya redondea por unidad mínima de la moneda).

## Decisiones del owner (no se reabren)
1. **Lista de medios por comercio**, que el comercio amplía o archiva. Un solo nivel: cada entrada es un medio con su
   comisión (p. ej. «Tarjeta de crédito (Datafast)»).
2. **Catálogo de plataforma** (core, solo lectura para comercios, mantenido por migración, sin pantalla de admin):
   medios sugeridos por país con su **forma de cobro** (solo %, solo fijo o ambos), **sin tasas**. País sin datos =
   lista base: Efectivo, Tarjeta débito, Tarjeta crédito, Transferencia, QR. El contenido de Ecuador está en
   `docs/investigacion-medios-de-pago-ecuador-2026-10-15.md` (usá su tabla y sus notas; no inventes otros proveedores).
3. La lista se carga **al prender el POS** según el país del comercio; los comercios con POS ya prendido la reciben en
   la migración.
4. **Quitar = archivar** (las ventas viejas lo nombran). **Efectivo nunca se archiva.**
5. **Cada orden guarda una lista de pagos** (medio + importe), aunque la UI empiece con uno solo. **Efectivo
   preseleccionado; elegir medio es obligatorio** para cobrar.
6. **Comisión por medio, a nivel comercio:** %, fijo por transacción, o ambos, según la forma del medio (si solo cobra
   %, no hay fijo). Sin cargar = 0, con aviso de que falta.
7. **Base de la comisión = lo cobrado** después del descuento (vendés 10, descontás 1: comisión sobre 9).
8. **La comisión se congela en cada venta**: cambiarla después no altera lo vendido.
9. **El POS solo marca el medio. La comisión se configura y se calcula en Rentabilidad** (módulo de la 0231), al
   recibir la venta cerrada, como Stock con el consumo. El POS no depende de Rentabilidad.
10. Rentabilidad no es solo gastronomía (barberías, salones, spa): copy genérico.

## Lo que la spec y el ADR tienen que resolver (proponé y justificá)
- **Evento:** qué agrega la versión nueva de `sale.closed` (pagos, importes cobrados, moneda) y cómo conviven
  suscriptores de la versión 1 (Stock/Recetas). Ningún suscriptor puede frenar ni demorar un cobro.
- **Cobrado** con y sin cliente/cupón: de dónde sale el importe que se congela y que la suma de pagos lo iguale.
- **Dónde vive cada tabla:** catálogo (core), medios del comercio (POS) y comisión (Rentabilidad), respetando
  `MODULOS.md` (FK módulo→módulo solo hacia lo que se requiere; Rentabilidad no debería requerir POS).
- **Redondeo** de la comisión a la unidad mínima de la moneda (mismo criterio de la 0230) y ejemplo numérico.
- Contrato HTTP de medios (listar, agregar desde el catálogo o libre, archivar) y de comisiones; permisos (POS para
  medios; Rentabilidad para comisiones).
- Implementación en serie después de la 0231 (mismo módulo Rentabilidad).

## Pruebas mínimas
Cierre exige medio y la suma de pagos = cobrado; comisión %, fija y ambas; comisión congelada ante un cambio
posterior; base después del cupón; medio archivado no aparece al cobrar pero se lee en ventas viejas; Efectivo no se
archiva; país sin catálogo recibe la lista base; aislamiento entre comercios.

## Fuera de alcance
Pantallas definitivas (la UI la piensan owner + Claude; el POS sí necesita el selector mínimo para cobrar: proponelo
como mínimo), propina y cargo por servicio, anular ventas cobradas, dividir la cuenta entre comensales, retenciones
fiscales del procesador, contenido del catálogo de países distintos de Ecuador, comisión del profesional.

## Entrega
Preguntas hechas y respuestas, paths de la spec y del ADR, hallazgos abiertos y si hace falta migración (no la generes).
````

## Prompt pendiente — P3 (spec 0235 + ADR 0150; lanzar cuando el owner lo diga)

````markdown
# Encargo: SPEC + ADR de la pieza P3 — premios como cupones y su costo
# Solo documentos. Nada de código en este encargo.

## Reglas
Leé antes: `CLAUDE.md`, `docs/TRABAJO-EN-PARALELO.md`, `docs/MODULOS.md`, ADR 0119 y 0120 y spec 0148 (canje de
cupones: mandan sobre esta pieza en todo lo que no cambie abajo), spec 0230, spec **0233 (P1, en redacción: la versión
2 de `sale.closed` con pagos y descuento por línea)**, `packages/db/src/schema/{campaign-coupon,campaign-turn,
reward-redemption,loyalty-reward,reward-checks,order}.ts`, `apps/merchant/src/server/counter/{grant-coupon,
coupon-discount,redemptions}.ts`, `apps/merchant/src/modules/pos/server/close.ts`,
`apps/merchant/src/server/module-events/{publish,types}.ts`. Del plan `docs/plan-margen-ganancia-2026-10-14.md`: la
sección «P3 — decisiones del owner» (las dos rondas).
- No editar `docs/INDEX.md`, `docs/TASKS.md` ni `docs/estado/*`. Sin push. Nivel: **L2** (dinero + fidelización).
- Números: **spec 0235**, **ADR 0150** (0234 la tomó la 1.3).
- **Orden obligatorio:** (1) si al leer el código falta una decisión de producto, se la preguntás al owner y esperás;
  (2) escribís la spec (`docs/specs/TEMPLATE-CHICA.md`) y el ADR; (3) te detenés. Lo no respondido va como
  *hallazgo a decidir*.

## Para qué sirve
Que todo lo que el comercio regala o descuenta (cupones de campaña y premios del programa) quede atado a una venta,
descuente stock y entre en la ganancia con su costo real. Si no, el Smart Menu muestra ganancia inflada y la etapa 6
confunde lo regalado con merma.

## Lo que hay hoy (leído en el código el 2026-10-15; verificalo)
- Cupón de campaña: el cajero identifica al cliente en la orden POS y el cupón activo se aplica al cerrar
  (`grantWithCouponInTx`). El descuento queda en `coupon_redemption.discount_amount`, ligado a `core.order`, no por
  línea. Todo cupón exige campaña (`campaign_coupon.campaign_id` not null).
- Premio del programa (`loyalty_reward`: `catalog_product`, `discount` %, `custom`): se canjea en el mostrador,
  descuenta puntos/sellos y registra `reward_redemption`, **sin emitir cupón ni ligarse a una venta**: no descuenta
  stock ni registra costo.
- PROD no tiene canjes de premios: no hay historial que migrar.

## Decisiones del owner (no se reabren)
1. **Todo es un cupón.** Canjear puntos/sellos por un premio («100 puntos por un café») **emite un cupón** que el
   cliente activa y consume como cualquier otro (mismas reglas de la 0148/ADR 0119, salvo lo que cambia acá).
2. **Los puntos/sellos se descuentan al emitir el cupón.**
3. **Dónde se consume:** si requiere compra (% de descuento, 2x1), **en el POS al pagar**, y entra al reparto por línea
   de la 0233. **Producto gratis:** en el POS como línea a $0 si el comercio tiene POS; **en el mostrador** si no tiene.
4. **Producto gratis en el mostrador emite el mismo aviso que una venta** (una línea de ese producto a $0): Stock y
   Recetas descuentan y congelan el costo (0230) sin cambios, y el core no conoce a los módulos.
5. La unidad regalada = **ingreso 0 con su costo completo**. 2x1: el descuento va entero a esa línea.
6. **Costo del cupón para el Smart Menu:** el real (descuento + costo de lo regalado) cuando hay receta; el costo
   manual del cupón solo cuando no la hay.
7. Sellos/puntos extra: $0 en la ganancia. Cupón y premio «custom»: como hoy, sin importe.
8. Regla vigente de la 0148 que se conserva: canjear un premio del programa **no cuenta** como el beneficio de la
   visita (no excluye usar un cupón de campaña).

## Lo que la spec y el ADR tienen que resolver (proponé y justificá)
- **Modelo:** cómo un cupón existe sin campaña (origen = canje de premio), qué pasa con `reward_redemption` (se
  conserva como registro del canje que emitió el cupón, o se reemplaza) y con los tipos de premio actuales.
- **Pregunta para el owner:** el cupón de premio que **vence sin usarse**, ¿devuelve los puntos? Recomendación:
  sí; si no, el cliente pierde puntos sin haber recibido nada.
- Cómo se aplica la regla de un cupón por cliente, comercio y día de la 0148 a los cupones de premio (punto 8).
- El aviso de venta desde el mostrador: mismo evento que el POS (versión de la 0233) o uno propio; idempotencia; local.
- Qué ve el cliente en la PWA y qué ve el mostrador (contrato, no diseño).

## Pruebas mínimas
Canje emite cupón y descuenta puntos una sola vez; producto gratis en el mostrador descuenta stock y congela costo;
producto gratis en el POS como línea a $0; % de premio en el POS repartido por línea; cupón de premio no cuenta como
el beneficio de la visita; vencimiento según lo que responda el owner; aislamiento entre comercios.

## Fuera de alcance
Pantallas definitivas (owner + Claude), 2x1 como tipo nuevo de premio, costo de la fidelización (sellos/puntos extra),
anular ventas, cupones «custom» con importe, el reparto por línea en sí (es de la 0233).

## Entrega
Preguntas hechas y respuestas, paths de la spec y del ADR, hallazgos abiertos y si hace falta migración (no la generes).
````
