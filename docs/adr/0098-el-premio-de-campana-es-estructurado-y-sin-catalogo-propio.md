---
adr: 0098
fecha: 2026-09-27
estado: aceptada
resumen: El premio de una campaña NO sale de un catalogo de premios propio: se define en la campaña con un TIPO y sus campos obligatorios — producto gratis y 2x1 (producto del catalogo de productos o texto), descuento (% o monto en la moneda del negocio), sellos o puntos extra (solo el que corresponde al programa, se acreditan al canjear en el mostrador, no cuentan como visita) — mas texto visible editable, una REGLA opcional sin limite de UX que ve el cliente en su cuenta y el cajero al escanear, y un costo por canje. El cupon copia todo al emitirse. Cashback extra queda fuera hasta que exista el cashback (PARQUEADO #61).
---

# 0098 — El premio de campaña es estructurado y sin catalogo propio

## Contexto

El ADR 0091 §4 dejo el «catalogo de premios» como feature propia, dependencia de la Bienvenida.
Hoy el premio de una campaña es texto: `core.campaign` lleva `coupon_label` (1..40),
`coupon_cost`, `coupon_max_redemptions` y un `coupon_product_id` solo informativo
(`schema/campaign.ts:66-69`); el cupon emitido copia nombre y costo
(`schema/campaign-coupon.ts`: `label_snapshot`, `cost_snapshot`). El programa de fidelidad tiene sus
propios premios con tipo (`loyalty_reward.reward_type in ('catalog_product','custom','discount')`).

Antes de diseñar el catalogo, el owner pidio investigar si hacia falta (2026-09-27). Informe:
`reports/Catálogo de premios en fidelización.md` (fuera de git). Lo que decidio:

- **Las herramientas para comercios chicos no tienen catalogo de premios para campañas.**
  SumUp/Fivestars: AutoPilot pide «Promotion name» y «Expiration period» (verificado en
  `help.sumup.com/.../create-and-send-loyalty-campaigns`). Perkstar define el premio dentro de la
  tarjeta o la promocion; su evento `reward.redeemed` trae `rewardTierId`, `promotionName`,
  `promotionRewardText` y `cost` (verificado en `developers.perkstar.co.uk/reference/webhook-events.md`).
  Stamp Me, Smile.io, LoyaltyLion y Yotpo: por funcion. Los catalogos compartidos (Punchh, Thanx,
  Paytronix, Voucherify) existen donde el sistema calcula el descuento sobre el ticket del POS.
- **Todas congelan el premio al emitirlo**; ninguna documenta costo por premio.
- **No hay evidencia de comercios pidiendo un catalogo**; las quejas son premios rigidos y lentitud
  en el mostrador. Sin voces LatAm y sin Reddit accesible: evidencia por ausencia, declarada.

El owner planteo dos riesgos de no tener catalogo:

- **Estadisticas:** lo que se mide por campaña no cambia (el cupon apunta a su campaña). Lo que se
  pierde con texto libre es comparar entre campañas por premio. Se resuelve con TIPO + producto
  copiados al cupon: el catalogo de productos ya da el id estable del premio mas comun.
- **Seguridad:** un catalogo no protege nada nuevo — el snapshot ya impide cambiar un cupon emitido,
  el cupon no se adivina (atado al cliente, validado en el servidor al escanear el pase, un canje) y
  el canje registra usuario y local. Un catalogo agregaria una referencia mas a aislar por negocio.

## Decision (del owner, 2026-09-27)

1. **No hay catalogo de premios.** El premio vive en la campaña; el unico catalogo es el de
   productos, que ya existe.
2. **El premio tiene tipo**, y cada tipo sus campos obligatorios:

   | Tipo | Campos |
   |---|---|
   | Producto gratis | producto del catalogo **o** texto |
   | 2x1 | producto del catalogo **o** texto |
   | Descuento | valor y unidad: **%** o **monto** |
   | Sellos extra / Puntos extra | cantidad |

3. **El texto visible se arma solo** a partir del tipo y los campos, y el comercio lo puede editar.
4. **Descuento en % o en monto.** El monto se expresa en la moneda del negocio
   (`business.currency_code`, ISO 4217): el simbolo depende de ella (AR$, $, €). La API devuelve el
   codigo de moneda; nunca un simbolo fijo.
5. **Regla opcional** («solo medianos»): la ve el **cliente en su cuenta** una vez que tiene el
   cupon y el **cajero al escanear**. No va en el pase ni en el push ni en la pagina de alta. **Sin
   limite de largo de UX** (otros idiomas son mas largos); solo un techo tecnico contra abuso.
6. **Sellos y puntos extra:**
   - se ofrece **solo el que corresponde** al programa del negocio (sellos → sellos extra; puntos →
     puntos extra; sin programa activo → ninguno) y la API rechaza el otro;
   - se **acreditan al canjear en el mostrador**, no al emitir;
   - **no cuentan como visita**: no crean una compra; lo acreditado queda en el canje del cupon;
   - si al canjear el programa ya no es de esa unidad (cambio o cierre), **el canje se rechaza** y
     el cupon queda sin usar.
7. **Cashback extra queda fuera** hasta que exista el programa de cashback (PARQUEADO #61: hoy
   `cashback` es solo un literal; `loyalty-program/validation.ts:11` habilita `points`/`stamps`).
8. **El cupon copia todo al emitirse** (tipo, producto, valores, texto, regla, costo): editar la
   campaña o borrar el producto no cambia un cupon ya dado (misma regla del ADR 0093 §1).

## Consecuencias

- La spec de implementacion migra las columnas `coupon_*` de `core.campaign` y de
  `core.campaign_coupon`; prod tiene 0 campañas con cupon a la fecha del ADR 0093, a re-medir
  antes de migrar.
- Es la primera vez que una campaña toca el saldo del programa. Supersede para el caso «extras al
  canjear» la frase de la spec 0065 «el cupon no modifica saldos». El NO a sellos/puntos dobles del
  ADR 0096 sigue en pie: aquello multiplicaba una compra; esto es un regalo fijo canjeado en persona.
- El cliente necesita ver sus cupones con su regla: nace una superficie de consumidor (API) que hoy
  no existe.
- Queda posible sumar un catalogo despues sin romper nada (con POS, cadenas o datos de premios
  repetidos): el cupon ya tiene la forma para apuntarle.

## Alternativas descartadas

- **Catalogo de premios reutilizable** (spec 0021, ADR 0091 §4 como estaba): agrega una entidad a
  mantener sin demanda observada; lo que da (comparar por premio) sale del tipo + producto.
- **Texto libre solo:** pierde la comparacion por premio y deja el valor del descuento sin dato.
- **Extras acreditados al emitir:** regala saldo a quien nunca vuelve y no exige visita.
- **Extras como compra de $0:** inflaria las visitas que leen las audiencias (#3/#4/#5, ritmo).
