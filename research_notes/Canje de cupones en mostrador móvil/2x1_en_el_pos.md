# Como se cobra un 2x1 / BOGO / "producto gratis" en el POS gastronomico

Fecha: 2026-10-03. Presupuesto: ~16 busquedas/fetches. Las citas marcadas **[snippet]** vienen
solo del resumen del buscador (no se abrio la pagina o la pagina no lo contenia); el resto se
leyo en la pagina fuente.

## Takeaway

- **La hipotesis del owner es parcialmente cierta, pero no esta demostrada como "lo mas comun".**
  No encontre evidencia directa (foros de operadores, Reddit) de que los bares carguen
  "Promo 2x1 cerveza" como producto propio — las busquedas en Reddit no devolvieron hilos utiles.
  Lo que SI esta probado es que **en los POS baratos/simples que usan los locales chicos de
  LATAM (Loyverse) NO existe descuento automatico por cantidad**, asi que el 2x1 solo puede
  hacerse (i) como descuento manual que el cajero aplica al ticket, o (ii) — inferencia — como
  articulo propio a precio de uno. En ese segmento la hipotesis del owner es plausible.
- **En los POS "de gama" (Square, Toast, Wansoft) el modelo nativo es el opuesto: se cargan los
  dos items y una regla de descuento (BOGO / NxM) baja el precio del segundo**, automatica o
  aplicada por el cajero. El ticket muestra 2 lineas + una linea/ajuste de descuento.
- **Happy hour, en cambio, se modela casi siempre como PRECIO por franja horaria** (Toast
  "time-specific price" / menu de happy hour; Lightspeed "happy hour pricing rules"; Maxirest
  descuentos por dia/sector/franja), no como cupon.
- **Recompensa "producto gratis" de un programa de fidelidad (Toast, Square): el item se carga a
  precio normal y la recompensa se aplica como descuento del 100% sobre esa linea.** El item TIENE
  que estar en la orden; si no esta, Square anula la recompensa y devuelve los puntos.
- **Puntos sobre el item gratis/descontado: se calculan sobre el monto neto pagado** (Toast:
  post-descuento, pre-impuesto [snippet]; Square: con 10% de descuento y $9 pagados se ganan 9
  puntos; con acumulacion por item, los items descontados no suman [snippet]).
- **Implicancia para CheckPass:** el modelo mas compatible con el resto de la industria es
  "item a precio de lista + linea de descuento del cupon", y otorgar puntos/sellos sobre el
  neto. Pero el mostrador tiene que tolerar el caso del owner (producto "Promo 2x1" ya cargado
  en el catalogo) sin doble descuento.

## Cited Findings

### Square (automatico por regla de precio)
- Square ofrece descuentos automaticos que se aplican al checkout cuando la venta cumple
  condiciones; "you can use a quantity discount to set up a Buy One, Get One Free deal, or use a
  discount schedule to set up Happy Hour offers" [snippet].
  https://squareup.com/help/us/en/article/3955-create-and-manage-discounts
- En el foro de Square el moderador indica crear un descuento automatico en *Items & services >
  Items > Discounts* con reglas "Exact quantity", "Minimum quantity" o "Buy one, get one". Un
  vendedor con "buy 6, get 1 free" se queja: "customers get free items all over there cart and it
  does not stay organized" (2025-11-24). Leido en la pagina.
  https://community.squareup.com/t5/Orders-Menu-Items-Catalog/Customizing-Buy-One-Get-One-Deals/td-p/826351
- El motor de Square es un "Pricing Rule" que aplica un descuento a productos especificos; con 3
  donas y un BOGO + 10%, aplica BOGO a 2 y 10% a la tercera [snippet].
  https://developer.squareup.com/blog/discounting-at-square/

### Toast (BOGO como tipo de descuento + precio por horario)
- BOGO es un tipo de descuento con seccion "Buy Items" y "Get Items"; el "get" puede ser % off,
  $ off o **precio fijo** (ej. "$1.00"), aplicado al primer item elegible, al mas barato o al mas
  caro. "On the POS, it will auto-add the discount to the selected BOGO items"; alternativamente
  el mozo lo aplica a mano seleccionando items y el boton de descuento. Leido en la pagina.
  https://support.toasttab.com/en/article/BOGO-Buy-One-Get-One-Discounts
- Happy hour: Toast tiene "Time Specific Price" (ej. $10 de 12 a 14 y $12 el resto) y
  menu-specific pricing para armar un menu de happy hour aparte [snippet]. El slug del articulo es
  literalmente "Building-Happy-Hour-Menus-w-Menu-Specific-Pricing".
  https://support.toasttab.com/en/article/Building-Happy-Hour-Menus-w-Menu-Specific-Pricing-1493004445781
- Recompensa por item (Toast Loyalty): "The order must contain a qualifying item." "All
  applicable modifiers on the selected free item(s), including sizes, will be discounted." Las
  redenciones aparecen "in the Discounts report under the assigned discount name". Leido en la
  pagina. => el gratis es un DESCUENTO sobre un item cargado, no un item a $0.
  https://support.toasttab.com/en/article/Optimize-Toast-Loyalty-with-Item-Based-Rewards
- "Loyalty points are earned on the post-discount, pre-tax amount for all items" [snippet].
  https://support.toasttab.com/en/article/Toast-Loyalty-FAQ-1492794694913

### Square Loyalty (producto gratis = descuento 100%)
- Ejemplo oficial: recompensa "Free Latte or Cappuccino" que "specifies a FIXED_PERCENTAGE
  discount of 100.0, which represents a free item". "If an order ID was specified when creating
  the reward but the item isn't included in the order, Square deletes the reward after the order
  is paid and returns the points to the buyer's loyalty account." Leido en la pagina.
  https://developer.squareup.com/docs/loyalty-api/loyalty-rewards
- Acumulacion: con regla "item based" los compradores "don't earn points for discounted items";
  con regla por gasto, si pago $9 tras 10% de descuento, gana 9 puntos [snippet].
  https://developer.squareup.com/docs/loyalty-api/walkthrough1/redeem-points
- Foro: no parece haber forma de impedir que se ganen puntos en la misma transaccion donde se
  canjea una recompensa, salvo la combinacion acumulacion-por-item + recompensa en $ sobre el
  total [snippet].
  https://community.squareup.com/t5/Square-Loyalty/I-am-looking-into-the-Square-Loyalty-program-but-I-have-a-few/td-p/684002

### Loyverse (POS gratuito muy usado por pymes LATAM): sin descuento por cantidad
- Hilo en espanol (2019-2020): "Solo es posible crear descuentos manuales, ya sea una descuento
  por cantidad o por porcentaje, y añadirlos al ticket de forma manual. No hay una opción para
  descuentos automáticos." Respuesta oficial (2020-03-23): "No es posible obtener un descuento que
  depende automáticamente de la cantidad de artículos que compra un cliente." No se menciona el
  workaround de crear un articulo "2x1". Leido en la pagina.
  https://loyverse.town/topic/2350-%C2%BFes-posible-realizar-un-descuento-dependiendo-de-la-cantidad-de-productos-que-compre-un-cliente/
- Descuentos: % (a item o ticket) o monto fijo (solo al ticket) [snippet].
  https://help.loyverse.com/help/how-create-and-configure-discounts

### LATAM: Wansoft (MX), Maxirest (AR), Fudo (AR)
- Wansoft define tipos de promocion: descuento en articulo; combinacion de articulos con
  descuento; articulo de menor precio gratis; "combinacion de menor precio gratis" (2x1, 3x2);
  combo con descuento prorrateado (precio final del combo fijo, el descuento se reparte entre los
  componentes). Ejemplo literal: "2x1 en bebidas preparadas (Con alcohol o sin alcohol)." Leido
  en la pagina (no dice si la aplicacion es automatica o manual).
  https://soporte.wansoft.net/hc/es-419/articles/18352051724301-Descripci%C3%B3n-y-ejemplos-de-los-tipos-de-promociones
- Maxirest: "El sistema además nos permitirá crear y modificar descuentos según día, sector, y
  franjas horarias." Leido en la pagina. Sin mencion de 2x1.
  https://ayuda.maxirest.com/configuraciones-generales-y-horarias
- Fudo: combos asociando productos existentes (ej. cafe + 2 medialunas) y descuento % por
  cliente aplicado automaticamente [snippet]. No encontre doc de 2x1 en Fudo.
  https://soporte.fu.do/es/articles/11730960-clientes

### Lightspeed
- Reseñas de terceros dicen que tiene "happy hour pricing rules" por horario; otra reseña dice lo
  contrario (sin promociones horarias) [snippet, contradictorio].
  https://theretailexec.com/tools/best-bar-pos-software/

## Inferences

1. **Por que la hipotesis del owner tiene sentido en LATAM**: si el POS del local (Loyverse,
   planilla, caja registradora) no tiene regla por cantidad, el camino de menor friccion para el
   cajero es un boton "Promo 2x1 cerveza" a precio de una; ademas deja el reporte de ventas
   limpio (sin descuentos). El patron "combo con precio final" de Wansoft y los combos de Fudo
   son la version formal de lo mismo. Es inferencia: no hay fuente de operador que lo diga.
2. **Pero el estandar de la industria para cupones/recompensas es "item + descuento"**: Toast y
   Square modelan BOGO y "gratis" como descuento sobre items cargados, y exigen que el item este
   en la orden. Eso tambien permite reportar cuanto costo la promo.
3. **Distinguir dos cosas que el owner mezcla**: (a) la *promo permanente del local* (happy hour,
   2x1 de los jueves) — suele ser precio/menu/producto propio, no cupon; (b) el *cupon validado de
   CheckPass* (beneficio individual del cliente). Para (b) el patron de la industria es descuento
   sobre el item; para (a) el patron es producto/precio. Si el local ya tiene "Promo 2x1" como
   producto, aplicar ademas el cupon seria doble beneficio.
4. **Puntos**: el consenso (Toast, Square por gasto) es acumular sobre el neto pagado; el item
   gratis no suma. Coincide con dar puntos/sellos "sobre el monto cobrado".
5. Para el modo "monto rapido" (sin carrito), el unico modelo posible es descontar el valor del
   item gratis del monto, o registrar el canje aparte con monto 0 — no hay forma de "regla por
   carrito".

## Gaps

- **No encontre evidencia de operadores reales** (Reddit r/barowners/r/bartenders, foros AR/UY/MX)
  sobre como cargan un 2x1 en la practica: las busquedas no devolvieron hilos. La afirmacion "lo
  comun es cargarlo como producto propio" queda **sin verificar** (ni refutada).
- No se consultaron Clover, Bistrosoft, Restó/Tango, Poster POS ni el POS de iFood/PedidosYa.
- Fudo y Lightspeed: solo snippets; la info de Lightspeed es contradictoria.
- Toast: "puntos post-descuento" y Square "item-based no suma descontados" son [snippet]; no
  abri las paginas.
- No hay datos cuantitativos de prevalencia (que % de bares usa cada metodo).
- Siguiente paso util: preguntar a 3-5 comercios piloto como cargan hoy su 2x1 (pantalla del
  POS), que es mas barato y mas fiable que seguir buscando en la web.
