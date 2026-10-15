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
| **2** | **Costo de lo vendido:** cada movimiento de consumo guarda el costo promedio del momento; costo de la venta = suma de sus consumos | 1.1 | ✅ spec 0230 implementada (`fe5fb583`, migracion 0085), QA PASS (`docs/factory/0230-0231-qa.md`), en `dev` y `main` local, sin push. Redondeo a la unidad minima de la moneda; estados completo / incompleto / pendiente |
| **F** | **Costos fijos por local y staff** (alquiler, servicios, sueldos) | — | ✅ 0231 implementada (backend, sin UI) + ADR 0147 aceptado, QA PASS (`docs/factory/0231-qa.md`), en `main` local `d1e0710f`, sin push (2026-10-15). La spec sigue diciendo `estado: cerrada`. Modulo «Rentabilidad» (`profitability`), permiso propio, por local via `locationAction`, sueldo en la ficha de Equipo (tambien personal sin acceso, n locales, reparto igual guardado por local) |
| **R1** | **Recetas independientes y combos** (ver seccion propia): producto = (receta, cantidad), opcion combo, revisiones en 2 niveles, expansion al cobrar, migracion; el consumo guarda receta y composicion | 0, 2 | spec 0232 + ADR 0148 en redaccion (worktree `r1-0232-spec`, sin commit, 2026-10-15) |
| **1.3** | Lectura del costo por receta y por producto (suma × cantidad) | R1, 1.1 | contrato para la ficha del producto |
| **P1** | **Medio de pago y comisiones:** el POS marca el medio al cobrar; en settings, comision por medio (% y/o fijo); sin configurar = 0 | — | spec 0233 + ADR 0149: preguntas al owner respondidas, sin documento todavia (worktree `p1-0233-docs`, 2026-10-15). Investigacion Ecuador: `docs/investigacion-medios-de-pago-ecuador-2026-10-15.md` |
| **P2** | **Para llevar y packaging:** el POS marca la orden «para llevar»; el packaging es stock y se descuenta | R1, P1 (mismo cierre) | a decidir en su spec: packaging por producto (entrada «solo para llevar» en la composicion del producto) y/o por orden (bolsa) |
| **P3** | **Cupones y recompensas en la ganancia:** el descuento del cupon/recompensa se atribuye a la venta y a sus lineas; producto gratis = ingreso 0 con su costo | 2 | el cupon se aplica hoy en el cierre POS (`grantWithCouponInTx`). A decidir: recompensas canjeadas fuera del POS (mostrador sin lineas de producto) |
| **SM-datos** | Lectura agregada por rango (mes en curso + historicos) y local: unidades, cobrado, descuentos, costo recetas, packaging, comision, ganancia — por producto, receta y composicion. Incluye punto de equilibrio (fijos vs ganancia del mes) | 2, R1, F, P1–P3 | backend del Smart Menu y del Dashboard |
| **SM** | Smart Menu (tabla, 4 grupos, acciones y simulador en plata) + punto de equilibrio en el Dashboard | SM-datos | UI: owner + Claude |
| **S1** | **Profesional que hizo el servicio y su comision** (% o fijo por venta) — barberias, salones, spa | P1 (mismo cierre) | **fuera** (owner 2026-10-14). Hoy el POS guarda quien cobro, no quien hizo el servicio |
| **S2** | **Duracion del servicio** en el catalogo → ganancia por hora en el Smart Menu | — | **fuera** (owner 2026-10-14) |
| **6** | **Costo real por conteos:** conteos periodicos de los insumos clave → factor de merma por insumo (consumo real / teorico) aplicado al costo; reglas en «Notas para las etapas futuras» | 2 (y R1 para el teorico por receta) | **en el plan** (owner 2026-10-14). El ajuste por conteo ya existe en Stock. Entra al costo de lo vendido como `costo promedio × factor` (factor 1 hasta esta pieza) |

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

## Prompt pendiente — P3 (spec 0234 + ADR 0150; lanzar cuando el owner lo diga)

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
- Números: **spec 0234**, **ADR 0150**.
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
