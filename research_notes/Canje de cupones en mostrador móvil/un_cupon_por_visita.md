# ¿Es norma "un cupon por visita / por transaccion"?

Fecha: 2026-10-03. Presupuesto: 16 busquedas/fetches. Casi todo viene de resumenes de busqueda
(no del texto completo de la pagina); se marca **[snippet]** lo que no se leyo en la fuente. Solo
la pagina de ayuda de Target se leyo completa (McDonald's y Groupon devolvieron 403 al fetch).

## Takeaway

- **Si, en las cadenas de comida rapida y en las apps de marca el default es "una oferta/recompensa
  por pedido o visita, no combinable"**: McDonald's (una oferta por persona y por visita), Starbucks
  (una recompensa por transaccion, que no se combina con promos), Taco Bell (1 por pedido, no
  combinable), Dunkin' (no combinable), Domino's online (un cupon por pedido). La regla del owner
  esta alineada con la norma de la categoria mas cercana a CheckPass (comercio con mostrador).
- **El limite casi siempre es POR TRANSACCION/PEDIDO**; "por visita" se usa como sinonimo
  coloquial (Square define "visita" = cada compra). Ademas aparecen limites por dia, por semana o
  por periodo (McDonald's "Deal Drop": 1 oferta por dia; Mercado Pago: topes por semana/mes y por
  usuario), y "una vez por cliente" para ofertas puntuales.
- **Las excepciones documentadas tienen estructura, no son "todo vale"**:
  1. *Por nivel*: Target permite 1 cupon de fabricante + 1 oferta de categoria + 1 oferta de item
     por item, pero **una sola oferta storewide (de toda la compra) por transaccion**. Es el patron
     "un descuento de item + uno de ticket".
  2. *Excepciones nombradas*: Starbucks deja combinar el modificador de 25 Stars con un BOGO;
     Domino's deja combinar su "$3 Carryout Tip" con un cupon mas.
  3. *Configurable por el comercio, por descuento*: Toast tiene la casilla "Allow with other
     discounts" en cada descuento (opt-in); Groupon usa "no combinable salvo que el comercio lo
     permita"; Punchh (PAR) agrego "multiple redemptions / stacked discounting" como capacidad
     enterprise.
- **La plataforma generalista para pymes que NO limita (Square) es la que mas quejas recibe**: el
  foro de Square tiene pedidos repetidos de "una recompensa por transaccion" porque los clientes
  apilan todo, y Square responde que restringir recompensas cuando hay cupon "no esta soportado".
  Es evidencia de que los comerciantes chicos *quieren* el limite, no de que lo sufran.
- **Recomendacion inferida**: mantener "1 beneficio por compra" como default, y si el comercio
  quiere incentivar ventas distintas, la excepcion estandar es una bandera por cupon
  ("combinable con otras promociones", opt-in y apagada por defecto), no levantar el limite global.

## Cited Findings

### Comida rapida / apps de marca
- **McDonald's (EE.UU.)**: "You can only redeem one deal per person, per visit"; para deals se
  exige estar en MyMcDonald's Rewards. [snippet]
  https://www.mcdonalds.com/us/en-us/faq/how-many-mcdonald-s-deals-can-be-used-at-a-time.html
  · https://www.mcdonalds.com/us/en-us/contact-us/help-center/deals.html
- **McDonald's (Irlanda, T&C de promo digital)**: "There is one Offer per day during this
  promotion"; "Each Offer is one-time use per customer only and cannot be used in conjunction with
  any other Offer or promotion". [snippet]
  https://www.mcdonalds.com/ie/en-ie/terms-and-conditions/digital-sales-promotion.html
- **Workaround conocido**: hacer pedidos separados con intervalo entre ellos para usar varios
  deals/rewards — o sea, el limite es por transaccion y se esquiva partiendo la compra. [snippet]
  https://parade.com/news/this-hack-lets-you-redeem-multiple-mcdonalds-rewards-at-once
- **Starbucks Rewards**: una recompensa por transaccion; no se combinan tiers distintos en un mismo
  pedido; los canjes de Stars no se apilan con promos (BOGO, bonus); excepcion: el modificador de
  25 Stars si se combina con un BOGO. [snippet — el resumen mezcla los Terms oficiales con blogs
  de terceros; la excepcion de 25 Stars viene de un blog, no confirmada en los Terms]
  https://www.starbucks.com/rewards/terms/ · https://thekrazycouponlady.com/tips/money/starbucks-rewards-program
- **Taco Bell Rewards**: recompensas de un solo uso, intransferibles, "cannot be combined with any
  other offer"; limite 1 por pedido. [snippet, fuente: hilos de Slickdeals que citan la letra
  chica] https://slickdeals.net/f/18301768-taco-bell-rewards-members-buy-a-5-or-10-piece-nuggets-get-a-free-crunchy-or-soft-beef-taco-1x-per-account
- **Dunkin' Rewards**: "Offers cannot be combined with any other offer, promotion or coupon";
  ejemplos de limite por periodo: "Limit one free classic donut per member per Wednesday".
  [snippet, via Slickdeals] https://slickdeals.net/f/17858958-dunkin-app-full-list-of-november-deal-drops-plus-free-donut-wednesday-each-week-w-drink-purchase
- **Domino's**: online/app un solo cupon por pedido (por telefono se permiten varios); excepcion:
  el "$3 Carryout Tip" se combina con hasta un cupon mas. [snippet, fuentes de foro/Slickdeals]
  https://slickdeals.net/f/17599443-domino-s-tip-3-get-a-coupon-for-3

### Retail
- **Target** (leido completo): "Only one manufacturer coupon (paper or digital), one Target
  category offer, and one Target item level offer can be combined per item." / "Only one storewide
  offer per guest can be used per transaction." / Los cupones de item se pueden usar junto con un
  cupon de categoria/storewide (ej. $1 off + $5 off en $15 de cuidado personal).
  https://www.target.com/help/articles/promotions-coupons/coupon-deals
- **Kroger**: un cupon (tienda o fabricante) por item; la mayoria de cupones digitales "limit 1
  per account", con eventos "Limit 5" por transaccion. [snippet, fuentes de terceros]
  https://www.krogerkrazy.com/kroger-digital-coupons-questions-answered-my-recommendations/

### Plataformas POS / loyalty
- **Square Loyalty**: se pueden canjear varias recompensas de *distinto* tier en el mismo pedido,
  pero no varias del mismo tier; una recompensa de loyalty se puede aplicar junto con un descuento
  de campaña de marketing; "restringir recompensas en una venta con cupon/promo aplicado no esta
  soportado"; pedidos de comerciantes de "one reward per transaction" en el foro de Feature
  Requests, sin plan de implementarlo. [snippet]
  https://developer.squareup.com/docs/loyalty-api/loyalty-rewards ·
  https://community.squareup.com/t5/Feature-Requests/Limit-Loyalty-Points-Redemptions-per-Transaction/idc-p/849092 ·
  https://community.squareup.com/t5/Feature-Requests/Discount-Stacking/idc-p/849005
- **Square, definicion de "visita"**: el programa por visitas da un punto por compra con monto
  minimo opcional; "visita" = cada compra (online incluida). Para la facturacion, "loyalty visit" =
  inscribirse, ganar un punto o canjear una recompensa. [snippet]
  https://community.squareup.com/t5/Archived-Discussions-Read-Only/Questions-about-Loyalty-program-s-quot-Per-Visit-quot-option/td-p/65854
- **Toast**: un cheque admite varios descuentos solo si cada uno tiene activado "Allow with other
  discounts" (Advanced Properties); orden de aplicacion: primero los de item, despues los de cheque.
  En Toast Loyalty, las promos de puntos dobles no se suman: se aplica la que mas da. [snippet]
  https://support.toasttab.com/en/article/Discounting-Items-and-Checks ·
  https://doc.toasttab.com/doc/platformguide/adminDiscountPricing.html ·
  https://support.toasttab.com/en/article/Toast-Loyalty-FAQ-1492794694913
- **Punchh (PAR) Redemptions 2.0**: agrega "multiple redemptions, single-scan flow,
  auto-redemption, proportional discounting, stacked discounting" — presentado como capacidad
  nueva, lo que implica que el modelo anterior era de un canje por cheque. [snippet]
  https://developers.partech.com/docs/dev-portal-pos/tutorials/modules/6-redemptions/overview
- **Loyverse**: los puntos se canjean como descuento en el ticket (1 punto = 1 unidad de moneda,
  monto parcial permitido); no se encontro regla sobre combinarlos con otros descuentos. [snippet]
  https://help.loyverse.com/help/points-discounts

### Marketplaces de cupones / pagos LATAM
- **Groupon**: letra chica universal "cannot be combined with other offers, except as permitted by
  the merchant"; restaurantes suelen poner "limit 1 per table"/"limit N per table"; "one per visit"
  se distingue de "one per customer" (el primero deja volver a usarlo en otra visita). [snippet]
  https://www.groupon.co.uk/pages/universal-fine-print · https://clubthrifty.com/use-a-groupon-twice/
- **Fave**: el limite de compra varia por partner y se lee en la Fine Print de cada deal. [snippet]
  https://help.myfave.com/hc/en-us/articles/115001996667-How-many-FaveDeals-can-I-buy-at-a-time
- **Mercado Pago (Argentina), descuentos con QR**: clausula tipica "no acumulable con otras
  promociones y/o beneficios vigentes"; topes por transaccion (ej. $12.000), por semana y cliente
  (ej. $15.000) o mensuales por usuario; algunas promos "sin tope". [snippet, prensa]
  https://www.cronista.com/finanzas-mercados/atencion-supermercados-el-importante-descuento-sin-tope-de-reintegro-que-ofrece-mercado-pago-los-miercoles/ ·
  https://www.iprofesional.com/actualidad/456394-mercado-pago-ofrece-descuentos-de-hasta-el-30-por-ciento-en-pagos-con-qr-y-18-cuotas-sin-interes

### Impacto de negocio (abuso / margen)
- Cifras de proveedores antifraude (sesgo comercial, metodologia no verificada): US$ 89 mil
  millones anuales perdidos por abuso de promociones en EE.UU.; 73 % de retailers lo sufrieron en
  12 meses; el "stacking" de codigos figura entre las formas mas comunes; 42 % de comercios admite
  tolerar algo de abuso antes que invertir en frenarlo; el abuso sin control "puede erosionar
  15–25 % del margen" de la promo. [snippet]
  https://www.voucherify.io/blog/how-to-prevent-coupon-fraud-and-abuse ·
  https://www.referralcandy.com/blog/promo-code-abuse-prevention-protecting-your-margins-while-rewarding-loyal-customers/ ·
  https://www.uniqodo.com/glossary/what-is-coupon-stacking

## Inferences

1. **La regla del owner es la norma de su categoria.** En comercio con mostrador (QSR, cafe) el
   patron dominante es "1 oferta por pedido + no combinable". El ejemplo del owner (2x1 al pedir →
   no 10 % al pagar) es exactamente lo que McDonald's, Starbucks y Taco Bell prohiben.
2. **"Visita" en la industria = transaccion.** Nadie encontrado define visita como presencia fisica
   o ventana de tiempo; se define como compra. Para CheckPass conviene escribir la regla como "un
   beneficio por compra" y, si preocupa el ticket partido (el hack de McDonald's), sumar un
   cooldown por cliente y comercio (ej. 1 por dia), que tambien es un patron documentado
   (McDonald's Deal Drop, Dunkin' "per Wednesday", Mercado Pago por semana).
3. **La excepcion mas defendible es la bandera por cupon "combinable", opt-in.** Toast (casilla por
   descuento) y Groupon ("salvo que el comercio lo permita") muestran que la combinacion se habilita
   cupon por cupon, nunca como default. El patron "1 de item + 1 de ticket" (Target) es mas
   complejo y propio de retail con muchos SKUs; para pymes LATAM de mostrador probablemente no paga
   su complejidad.
4. **Recompensa de loyalty vs cupon de marketing son dos cosas distintas en varias plataformas**
   (Square los deja combinar; Starbucks no). Si CheckPass tiene sellos/puntos *y* cupones, hay que
   decidir explicitamente si el canje de un premio de tarjeta cuenta como "el beneficio" de la
   compra. Es un hallazgo a decidir, no algo que la regla actual cubra sola.
5. **Comunicacion**: lo observado es texto fijo en la letra chica de cada oferta ("limit 1 per
   order", "no acumulable") mas el sistema que impide agregar un segundo cupon (Domino's online,
   McDonald's app). Enforcement en caja: el POS rechaza el segundo descuento salvo que este marcado
   combinable (Toast). No se encontro documentacion de UX especifica (ej. mensaje de error).

## Gaps

- No se cubrieron (sin resultado util o sin presupuesto): **Burger King, Chick-fil-A, Subway, CVS,
  Thanx, Paytronix (limite por cheque), Rappi/PedidosYa en local**.
- Casi todos los hallazgos son **[snippet]**: McDonald's y Groupon dieron 403; Starbucks, Taco
  Bell, Dunkin', Domino's y Kroger vienen via blogs/foros de cupones, no del T&C leido.
- **Sin evidencia independiente de satisfaccion del cliente** frente a limites de stacking (no se
  encontro encuesta academica o de industria tipo Restaurant Business / QSR / Loyalty360).
- Las estadisticas de abuso vienen de **vendedores de software antifraude** y son de e-commerce, no
  de mostrador; tratarlas como orden de magnitud, no como dato.
- No se encontro como las apps *muestran* el limite en pantalla (copy de error, badges
  "no combinable"); haria falta revisar las apps directamente.
