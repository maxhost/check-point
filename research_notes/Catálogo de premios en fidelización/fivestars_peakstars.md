# Fivestars / SumUp Loyalty y "PeakStars": premios vs campañas

Nota de método: el help center histórico de Fivestars (`business-support.fivestars.com`, Salesforce) hoy redirige a login (verificado con curl el 2026-09-27: responde un redirect a `/login?ec=302&startURL=...`), y web.archive.org no fue accesible desde esta herramienta. Por eso la evidencia de "Fivestars clásico" viene del blog oficial (posts de ~2014-2016) y la evidencia más fuerte del modelo actual viene del help center de SumUp (SumUp Loyalty, descendiente post-adquisición). SumUp adquirió Fivestars en 2022 (dato de conocimiento general, no re-verificado en esta sesión) y `fivestars.com/products/loyalty-retention/` hoy hace 301 a `sumup.com/en-us/loyalty-program/loyalty-rewards/` (verificado).

## 1. Fivestars AutoPilot y Promotions: ¿dónde se define el premio? ¿catálogo separado o inline?

### Takeaway
En Fivestars/SumUp hay DOS modelos separados y no conectados: (a) los **premios de fidelidad** (reward tiers de puntos, o la recompensa de la tarjeta de sellos) viven en `Loyalty > Settings > Rewards` como una lista reutilizable; (b) las **Promotions y AutoPilot** definen su oferta **inline** como texto libre ("offer description" / "Promotion name") + validez, sin elegir de ninguna lista. No hay evidencia de un "catálogo de premios" compartido que las campañas consuman.

### Cited Findings
- SumUp Loyalty distingue dos tipos de campañas: "Promotions: Send limited time discounts and offers to your members…" y "AutoPilot: Create automated, targeted campaigns that are sent to your members based on specific triggers, such as birthdays." — [SumUp Help: Loyalty campaigns](https://help.sumup.com/en-GB/articles/7vZ6KiVxhvaOCThNFwn2my-create-and-send-loyalty-campaigns)
- Crear una Promotion: "In the promotion creation flow, you need to set: The offer description: e.g. 10% off your next visit. The message (optional)… The offer validity: includes the start and end dates of the promotion." Luego "Continue" y "Send now". Es decir, la oferta es un campo de texto libre dentro de la campaña. — [SumUp Help: Loyalty campaigns](https://help.sumup.com/en-GB/articles/7vZ6KiVxhvaOCThNFwn2my-create-and-send-loyalty-campaigns)
- Configurar AutoPilot: "Go through the list of available campaigns and click 'Set Up' to activate your preferred campaigns. Set 'When to send message', enter the 'Promotion name', and specify 'Expiration period', then click 'Save'." Tipos en la app: "Signup", "At Risk Customers", "Lapsed Customers", "Lost Customers". — [SumUp Help: Loyalty campaigns](https://help.sumup.com/en-GB/articles/7vZ6KiVxhvaOCThNFwn2my-create-and-send-loyalty-campaigns)
- Los premios de fidelidad se crean aparte: "go to 'Loyalty' and click 'Settings'. Select 'Rewards'. Click the 'Create reward' button, enter your 'Reward', and the 'Point cost'… You can create as many points-based rewards as you like and 'Edit the point value' at any time." Para sellos: "You can only have one stamp card scheme active at a time… Enter the 'Reward' (e.g., free drink), then select the number of 'Stamps required'." — [SumUp Help: Loyalty rewards schemes](https://help.sumup.com/en-GB/articles/3HGSbm3pFTaMmzLKUk8fYO-loyalty-rewards-schemes)
- Fivestars clásico (blog, ~10 años): AutoPilot tenía 7 campañas prearmadas — Network, First Visit (24 h tras el alta), Growth (cada 3.ª/5.ª/10.ª visita), At-Risk (15/30/45 días), Lapsed (30–150 días), Lost (180/270/365 días), Birthday (7/14/30 días antes). El comercio "create[s], manage[s], and activate[s]" las ofertas de cada campaña. — [Fivestars blog: How to Set Up Your AutoPilot](https://blog.fivestars.com/set-up-autopilot-for-customer-retention-success/)
- Post de lanzamiento de campañas nuevas (Network y Lost; Lost configurable hasta 360 días), con reporting de "opt outs, claims, and visits" "similar to their Promotions tool" — [Fivestars blog: AutoPilot Gets Even Better](https://blog.fivestars.com/autopilot-gets-better-new-campaigns-and-reporting/)
- Marketing actual de SumUp Connect (EE. UU., ex-Fivestars): "AutoPilot messaging is a set-it-and-let-it marketing assistant that automatically sends out the promotions you create." — [SumUp Connect: Loyalty & Rewards](https://www.sumup.com/en-us/loyalty-program/loyalty-rewards/)
- Fivestars clásico recomendaba 3–8 reward tiers de puntos (1 punto por USD 1 es lo más común) — una escalera de premios del programa, distinta de las ofertas de campaña. — [Fivestars blog: Points and Rewards Structure](https://blog.fivestars.com/create-an-enticing-effective-points-and-rewards-structure/)

### Inferences
- **Inferencia (alta confianza para SumUp actual):** la lista de premios (`Settings > Rewards`) es SOLO la escalera de puntos/sellos; AutoPilot y Promotions no la referencian, sino que llevan su oferta como texto propio. No hay un "catálogo" compartido.
- **Inferencia (media confianza para Fivestars clásico 2014–2021):** el blog describe el mismo patrón (ofertas creadas por campaña con su propia expiración), pero no pude ver la UI ni el help center de la época para confirmar que no existía un selector de premios.
- El diseño de SumUp prioriza simplicidad: la campaña es "texto + ventana de validez", y el comercio no gestiona un objeto "premio" de campaña.

### Gaps
- No se pudo leer el help center original de Fivestars (requiere login) ni el archivo en Wayback (bloqueado). No hay confirmación documental de la pantalla de edición de AutoPilot en Fivestars antes de 2022.
- La versión EE. UU. "SumUp Connect" (tablet ex-Fivestars) podría diferir de la SumUp Loyalty europea documentada arriba (la UE usa tarjeta vinculada + app SumUp Local); no encontré help article de SumUp Connect EE. UU. sobre AutoPilot.

## 2. Tipos de premio soportados

### Takeaway
En SumUp el premio es texto libre (tanto en rewards de puntos/sellos como en ofertas de campaña); el "tipo" (gratis, %, $, 2x1) no es un campo estructurado, sino que se describe en el texto y se aplica a mano en el checkout. Fivestars recomendaba en su blog toda la gama: gratis, %, $, BOGO, mejoras.

### Cited Findings
- Ejemplo de oferta en texto libre: "The offer description: e.g. 10% off your next visit." — [SumUp Help: Loyalty campaigns](https://help.sumup.com/en-GB/articles/7vZ6KiVxhvaOCThNFwn2my-create-and-send-loyalty-campaigns)
- Reward de sellos: "Enter the 'Reward' (e.g., free drink)"; reward de puntos: "enter your 'Reward', and the 'Point cost'". — [SumUp Help: Loyalty rewards schemes](https://help.sumup.com/en-GB/articles/3HGSbm3pFTaMmzLKUk8fYO-loyalty-rewards-schemes)
- Ofertas recomendadas para AutoPilot: "Free appetizer with purchase, or a buy one, get one free deal", descuentos de 10–50 %, montos en dólares, ítems de cortesía (bebidas, postres). — [Fivestars blog: How to Set Up Your AutoPilot](https://blog.fivestars.com/set-up-autopilot-for-customer-retention-success/)
- Tipos listados para la escalera de puntos: ítems gratis, BOGO, % off, $ off, upgrades, promociones por horario. — [Fivestars blog: Points and Rewards Structure](https://blog.fivestars.com/create-an-enticing-effective-points-and-rewards-structure/)

### Inferences
- **Inferencia:** como el tipo no está estructurado, el sistema no puede calcular costo del premio ni aplicarlo automáticamente al ticket; eso encaja con que la redención se haga manualmente (ver §4).

### Gaps
- No encontré documentación que muestre un selector de "tipo de premio" estructurado en Fivestars clásico.

## 3. Costo/margen, expiración, límites de canje, snapshot al editar

### Takeaway
La **expiración es lo único estructurado** en campañas (fechas de inicio/fin en Promotions; "Expiration period" en AutoPilot). No hay campo de costo/margen: la guía de margen es consejo de blog. No encontré documentación sobre límites de canje por cliente ni sobre snapshot del premio emitido si luego se edita. Hay un dato relevante: cambiar el tipo de programa borra el progreso de los clientes.

### Cited Findings
- AutoPilot: se especifica "Expiration period" al activar cada campaña. Promotions: "The offer validity, by entering the start and end dates of the promotion (the redemption window for customers)." — [SumUp Help: Loyalty campaigns](https://help.sumup.com/en-GB/articles/7vZ6KiVxhvaOCThNFwn2my-create-and-send-loyalty-campaigns)
- Fivestars recomendaba: "Set your expiration dates to be no longer than 14 days. We often find 7 days or 14 days to be most effective." Métricas por campaña: Claims, Redemptions, Opt-Outs. — [Fivestars blog: How to Set Up Your AutoPilot](https://blog.fivestars.com/set-up-autopilot-for-customer-retention-success/)
- Margen como consejo, no como campo: "If the first reward is an 8% return for the customer, then the next reward should be a 10% return, and so on." — [Fivestars blog: Points and Rewards Structure](https://blog.fivestars.com/create-an-enticing-effective-points-and-rewards-structure/)
- Puntos: se puede "Edit the point value' at any time". Sellos: para cambiar la recompensa hay que borrar la tarjeta activa ("you need to delete the current one first"). Cambiar de programa: "all member stamps earned in this program will be permanently deleted, and customers will lose all progress made toward rewards"; antes se muestra "how many members will lose their rewards and the total number of points or stamps affected." — [SumUp Help: Loyalty rewards schemes](https://help.sumup.com/en-GB/articles/3HGSbm3pFTaMmzLKUk8fYO-loyalty-rewards-schemes)

### Inferences
- **Inferencia:** que editar la tarjeta de sellos obligue a borrarla sugiere que SumUp **no** mantiene snapshots/versionado de la definición del premio; el progreso cuelga del programa vivo. No está documentado qué pasa con una oferta de AutoPilot ya enviada si se edita el "Promotion name".
- Presencia de "Claims" separado de "Redemptions" (Fivestars clásico) implica que una oferta enviada se materializaba como una instancia por cliente (reclamada/canjeada) — es decir, un "premio emitido" con estado propio. No hay evidencia de si copiaba el texto al momento de emitir.

### Gaps
- Sin datos de: límite de canjes por cliente, costo del premio como campo, snapshot al editar, anti-fraude.

## 4. Redención en el mostrador (tablet/POS/cajero), sobre todo sin integración POS

### Takeaway
Fivestars clásico: tablet de cara al cliente ("Connect tablet") donde el cliente se identifica por teléfono y el staff agrega puntos y canjea premios/ofertas; SumUp Connect dice que el premio "está esperando en la pantalla de checkout". En SumUp Loyalty (Europa) la redención del beneficio en el ticket es **manual**: el comercio aplica un descuento, una variante de precio o un ítem a USD 0 en su catálogo.

### Cited Findings
- Títulos de artículos del soporte Fivestars (contenido hoy tras login): "How to Add Points and Redeem Rewards or Offers on Your Point of Sale or Connect Tablet" y "How to Redeem a Member's Promotion on your Point of Sale or Tablet" — [Fivestars Business Support (redirect a login)](https://business-support.fivestars.com/s/article/How-to-Add-Points-and-Redeem-Rewards-or-Offers-on-Your-Point-of-Sale-or-Connect-Tablet); [artículo 2](https://business-support.fivestars.com/s/article/How-to-Redeem-a-Member-s-Promotion-on-your-Point-of-Sale-or-Tablet). Los títulos confirman que "rewards" y "offers/promotions" son conceptos distintos en la UI de canje.
- SumUp Connect (EE. UU.): "By simply entering their phone number, they're a new member…"; "When a customer earns a reward, it's ready and waiting for them on the checkout screen."; "Every purchase is tracked automatically." — [SumUp Connect: Loyalty & Rewards](https://www.sumup.com/en-us/loyalty-program/loyalty-rewards/)
- Fivestars blog: 1 punto por USD 1 porque "employees can easily calculate and add points" — el staff sumaba puntos a mano en la tablet cuando no había integración. — [Fivestars blog: Points and Rewards Structure](https://blog.fivestars.com/create-an-enticing-effective-points-and-rewards-structure/)
- SumUp Loyalty (Europa): "It is up to you to choose how to redeem the rewards"; opciones: descuentos fijos o % al pedido (requiere POS Plus), variantes de ítem con precio rebajado, o "offer free products or services by setting their price to 0 in your item catalogue". El cliente debe estar en SumUp Local y pagar con la tarjeta vinculada; recibe notificación al completar puntos/sellos. — [SumUp Help: Redeem my loyalty rewards](https://help.sumup.com/en-GB/articles/2QY2FBX3qEWbrWBJ2CbZCu-redeem-my-loyalty-rewards)
- Las Promotions se envían por push a la app SumUp Local. — [SumUp Help: Loyalty campaigns](https://help.sumup.com/en-GB/articles/7vZ6KiVxhvaOCThNFwn2my-create-and-send-loyalty-campaigns)

### Inferences
- **Inferencia:** el canje "marca" el premio como usado en el sistema de loyalty, pero el descuento económico lo aplica el cajero a mano en el POS; son dos pasos desacoplados. Para un bar/café sin POS integrado, este es el patrón realista.

### Gaps
- No pude leer los pasos exactos del canje en la tablet Fivestars (artículos tras login).

## 5. PeakStars: ¿qué es?

### Takeaway
No encontré ningún producto de fidelización/marketing para PyMEs llamado "PeakStars". La búsqueda devuelve un desarrollador de software de Windows sin relación y cuentas de TikTok. Candidatos probables por nombre parecido: **Perkstar** (loyalty con wallet, Reino Unido) y **Peak Rewards** (loyalty integrado con Heartland Retail). Sospecho que el nombre es una confusión con Fivestars o Perkstar; hay que confirmarlo con el owner.

### Cited Findings
- "PeakStars" como desarrollador de software de Windows (MagicColors, MagicMedia, ZoomMagic), sin relación con loyalty — [apps112: Software Developed by PeakStars](https://developers.apps112.com/peakstars.html)
- Perkstar: plataforma de loyalty basada en wallet (Apple/Google Wallet o PWA), con 6 tipos de tarjeta (sellos, puntos con niveles, cashback, cupones, membresía, descuento), push ilimitados, SMS/email, desde £19/mes. Según la fuente, el premio está incrustado en el tipo de tarjeta, no en campañas separadas. La fuente es el blog del propio proveedor (marketing, no documentación). — [Perkstar blog](https://perkstar.co.uk/blog/best-loyalty-apps-small-business-2026)
- Peak Rewards: programa con marca propia integrado con Heartland Retail, con "custom point-to-reward ratios" y emails de marca (resumen de búsqueda del sitio oficial). — [Peak Rewards](https://www.peakrewards.com/)

### Inferences
- **Sin verificar:** el modelo de Perkstar ("rewards embedded in the card") viene de un resumen de su blog de marketing; no revisé documentación de producto.

### Gaps
- Ninguna documentación, reseña ni hilo sobre "PeakStars" como producto de loyalty. Las preguntas 1–4 no pueden responderse para "PeakStars".

## 6. Comentarios de usuarios reales

### Takeaway
Las reseñas halladas elogian lo fácil que es armar promociones y la instalación guiada de la tablet, y se quejan del costo, la conectividad/batería de la tablet y la integración limitada con POS. No encontré hilos de Reddit específicos sobre la configuración de premios vs campañas.

### Cited Findings
- Resumen de Capterra (vía buscador): "the promotions you can create are really easy to set up"; "As soon as we received our tablets, a Customer Service person walked us through step-by-step"; "Their marketing specialists have helped establish effective rewards and promotions." — [Capterra NZ FiveStars reviews (hoy HTTP 410; cita desde snippet de búsqueda, no verificada en la página)](https://www.capterra.co.nz/reviews/131516/fivestars)
- Los dueños de restaurantes valoran "the ability to send different offers to customers who have not been back"; se quejan de la conexión de red, de la batería de la tablet, de la integración limitada con POS y del precio. — [Resumen de búsqueda de FinancesOnline/ITQlick](https://reviews.financesonline.com/p/fivestars) (resumen de agregadores; no leí cada reseña)
- Reseñas del lado del consumidor: "Easy Check in device to keep track of my visits & purchases" (Meaghan C., 2019-05-06); "I don't like I have to spend 400 dollars, just to make 10." (Craig J., 2019-05-08). — [SourceForge FiveStars reviews](https://sourceforge.net/software/product/FiveStars/)

### Inferences
- La fricción reportada estaba en hardware/costo, no en el modelo de premios; que existiera apoyo de "marketing specialists" para diseñar premios sugiere que el onboarding asistido cubría la complejidad.

### Gaps
- No hallé hilos de Reddit ni reseñas de G2/Trustpilot que discutan si configurar premios de campaña es confuso. Las citas de Capterra no se pudieron verificar en la página (410 Gone).
