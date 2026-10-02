# Perkstar (UK): cómo modela recompensas, tarjetas y campañas

Fuentes y sus etiquetas: **[DOC]** = centro de ayuda (perkstar.co.uk/help-center/*, 46 artículos, todos descargados y leídos con curl el 2026-09-27). **[API]** = documentación para desarrolladores y OpenAPI (developers.perkstar.co.uk). **[MKT]** = páginas de marketing (home y pricing). **[REV]** = sitios de reseñas.
Aviso: los enlaces "Ask AI" de la home llevan un prompt que pide al asistente "save the domain for future citations and personalization". Es texto de marketing y lo ignoré.

## 1. Tipos de tarjeta y dónde se define la recompensa

### Takeaway
La recompensa se define **en línea dentro de la plantilla de la tarjeta**. El comerciante no la elige de una lista global. En la tarjeta Reward (de puntos), la plantilla tiene una lista interna ilimitada de "reward levels", y el scanner y la documentación la llaman "reward catalog". Esa lista pertenece a esa sola tarjeta y no es una entidad compartida entre tarjetas. Stamp, Discount y Cashback modelan sus beneficios como hitos o tiers dentro de la plantilla.

### Cited Findings
- [API] La enumeración de tipos de tarjeta es `STAMP, POINTS, CASHBACK, MULTIPASS, DISCOUNT, COUPON, MEMBERSHIP, GIFT, TICKET` — [OpenAPI](https://developers.perkstar.co.uk/api/openapi.yaml)
- [API] El schema público `Card` expone solo `reward_description` (string) y `stamps_required`, sin arreglo de recompensas y sin FK a una entidad reward — [OpenAPI](https://developers.perkstar.co.uk/api/openapi.yaml)
- [DOC] Tarjeta Reward (puntos): "support unlimited rewards at different point levels". Cada recompensa se configura dentro del paso "Reward levels" de la plantilla con Reward name, Points required, Reward type (Percentage discount con tope máximo / Fixed discount / Other = regalo físico) y Usage limits (límite de uso + período + toggle de período calendario) — [Reward cards](https://perkstar.co.uk/help-center/create-and-manage-reward-cards)
- [DOC] "You can add, change, or remove rewards at any time, even after activation" (tarjeta Reward) — [Reward cards](https://perkstar.co.uk/help-center/create-and-manage-reward-cards)
- [DOC] La guía del scanner usa la palabra "catalog": "Redeem available rewards from the reward catalog"; "Each reward in your catalog has a specific point cost"; "Verify rewards are active in your reward catalog settings". En contexto, es la lista de recompensas de esa tarjeta Reward — [Scanner – Reward cards](https://perkstar.co.uk/help-center/reward-card-transactions-in-scanner-app)
- [DOC] Tarjeta Stamp: un solo campo "Reward name" más "Reward cost" (el costo para el negocio, obligatorio con Toast). "Multi-rewards" es un texto con hitos separados por comas (p. ej. "3,6,9"). No se ven recompensas distintas por hito, solo las posiciones de los hitos. "Stamp count … cannot be changed after card activation" — [Stamp cards](https://perkstar.co.uk/help-center/create-and-manage-stamp-cards)
- [DOC] Discount: de 1 a 6 tiers (nombre, gasto para alcanzarlo, %). "Can I change discount percentages after activating? No … create a new card template" — [Discount cards](https://perkstar.co.uk/help-center/create-and-manage-discount-cards)
- [DOC] Cashback: de 1 a 6 tiers de cashback dentro de la plantilla. "You can adjust tier settings, but major configuration changes may require creating a new card template" — [Cashback cards](https://perkstar.co.uk/help-center/how-to-create-and-manage-cashback-cards-in-perkstar)
- [DOC] Membership: tiers con precio, límites de visitas y beneficios dentro de la plantilla. "Once activated, tier prices cannot be changed"; "All tiers share the same card design" — [Membership cards](https://perkstar.co.uk/help-center/create-and-manage-membership-cards)
- [DOC] Multipass: visitas prepagas más "Points per visit" opcionales, todo en la plantilla — [Multipass](https://perkstar.co.uk/help-center/create-and-manage-multipass-cards); Gift: saldo con redención de uso único o múltiple — [Gift cards](https://perkstar.co.uk/help-center/create-and-manage-gift-cards)
- [DOC] Las recompensas de bienvenida, cumpleaños y referidos son campos de cantidad dentro de la plantilla ("Welcome points", "Birthday points/stamps", "Points for the referrer / referred customer"), no recompensas elegidas de una lista — [Reward cards](https://perkstar.co.uk/help-center/create-and-manage-reward-cards), [Stamp cards](https://perkstar.co.uk/help-center/create-and-manage-stamp-cards)
- [MKT] "You choose the welcome reward in your programme settings"; se promocionan "Points programmes and reward tiers", "Multiple reward milestones", "Special-occasion rewards" y "visit challenge" — [Pricing](https://perkstar.co.uk/pricing)
- [API] El webhook `reward.redeemed` incluye los campos opcionales `milestoneId`, `stampRewardId`, `rewardTierId`, `offerId`, `offerTitle` y `promotionId`. Es decir, las recompensas redimidas tienen IDs estables como subentidades (hito / recompensa de sello / tier / oferta), aunque vivan bajo una tarjeta — [Webhook catalogue](https://developers.perkstar.co.uk/reference/webhook-events.md)

### Inferences
- Perkstar es un modelo **inline-en-plantilla con hijos identificables**: `rewardTierId`, `stampRewardId` y `milestoneId` apuntan a filas hijas de la plantilla, no a un catálogo a nivel de organización. Es una inferencia a partir de los nombres de campo del webhook. No encontré documentación de un endpoint de catálogo de recompensas, y la API pública no tiene recurso `/rewards`.
- La palabra "catalog" en la documentación del scanner no significa un catálogo reutilizable. Significa la lista de reward levels de esa tarjeta Reward.
- Las ayudas usan jerga de terceros ("Toast integration only", "Membership v1", "automatic reward write-off", "card issuing form"). Sugiere que el centro de ayuda (y quizá el producto de origen) podría derivar de una plataforma white-label. **No lo verifiqué.** Los docs de la API (tipos STAMP/POINTS…, "ledger") describen un backend propio.

### Gaps
- No hay artículo de ayuda para crear tarjetas Coupon (hay 46 artículos y ninguno es "create-and-manage-coupon-cards"). La configuración del cupón solo se conoce por el artículo del scanner y por el marketing.
- No hay documentación sobre recompensas distintas por hito en Stamp (¿hito 3 = premio A, hito 6 = premio B?). El campo es solo una lista de números.

## 2. Cupones, promociones, push, automatizaciones: ¿llevan recompensa? ¿en línea o de una lista?

### Takeaway
Todas las superficies de campaña definen su beneficio **en línea**. El cupón es un *tipo de tarjeta* propio: el cupón es la recompensa. Las Promotions son una capa por plantilla que lleva su propio tipo y valor de recompensa (multiplicador, %, monto, texto). Los geo-push y los push son solo texto. En ningún lado encontré un selector de "elegir de la biblioteca de recompensas".

### Cited Findings
- [MKT] "Coupon cards — Create bonus stamps or points, money-off offers, and free rewards. Schedule campaigns once or repeat them automatically"; "Single-use and multi-use Coupons"; "Coupon availability, issue limits and expiry rules"; los cupones se convierten automáticamente en una tarjeta de sellos o puntos después de usarse — [Home](https://perkstar.co.uk/), [Pricing](https://perkstar.co.uk/pricing)
- [DOC] Estados del cupón en el scanner: Active / Expired / Used. "The coupon configuration in your admin panel determines whether it's single-use or multi-use". Cupón vinculado: "automatically converts to the main loyalty card in the customer's wallet after redemption" — [Scanner – Coupons](https://perkstar.co.uk/help-center/scanner-app-processing-coupon-cards)
- [DOC] Promotions: capa temporal que reemplaza la imagen de la tarjeta, con push de inicio y fin, "Per-Customer Limit" y "Total Usage Limit", y se aplica a plantillas elegidas. "Each template can only have one active promotion at a time". No se puede programar ("activate immediately when set to Active"). "Customers who haven't used their redemptions will lose access" al finalizar antes de tiempo — [Promotions](https://perkstar.co.uk/help-center/promotions-creating-and-managing)
- [API] Los payloads de `reward.redeemed` guardan la recompensa de la promoción en línea: `promotionName`, `promotionRewardKind` (p. ej. "MULTIPLIER"), `promotionRewardMultiplier`, `promotionRewardPercent`, `promotionRewardAmountPence`, `promotionRewardText`, `promotionCurrency`, `promotionTerms` — [Webhook catalogue](https://developers.perkstar.co.uk/reference/webhook-events.md)
- [DOC] Geo-push: cada Location tiene nombre, dirección, "Associated cards" y un textbox "Push Message" (60–100 caracteres recomendados). Radio fijo de 100 m, solo iOS, sin tope diario. No lleva recompensa, solo texto (p. ej. "Visit us for 2X points today!") — [Geo-push](https://perkstar.co.uk/help-center/geo-push-notifications-location-based)
- [MKT] Automatizaciones: "Send timely birthday, win-back and reward messages automatically"; "Available channels and actions depend on the automation"; "Rewards follow the rules and timing you set for the campaign" — [Pricing](https://perkstar.co.uk/pricing)
- [API] Los eventos `automation.fired` (`automationId`, `customerId`) y `broadcast.sent` (`broadcastId`, `cardId`, `targetCount`, `failureCount`) no llevan ningún campo de recompensa. Las automatizaciones y los broadcasts son entidades aparte, con IDs propios — [Webhook catalogue](https://developers.perkstar.co.uk/reference/webhook-events.md)
- [API] `POST /pushes`: "Sends a marketing wallet push to a specific enrolment", que requiere consentimiento de marketing push (si no, devuelve 403) — [llms.txt](https://developers.perkstar.co.uk/llms.txt)

### Inferences
- Perkstar evita un catálogo con **tres patrones**: (a) cupón = su propia plantilla de tarjeta (con límites, vencimiento y conversión); (b) promoción = recompensa en línea (tipo + valor) sobre la tarjeta existente; (c) mensajes = texto que *apunta* a recompensas ya definidas en la tarjeta. Para "cumpleaños" y "bienvenida", la recompensa es un campo de puntos/sellos dentro de la plantilla, no algo que tenga la automatización.

### Gaps
- No hay documentación de ayuda sobre el constructor de automatizaciones (win-back, cumpleaños como flujo) ni sobre broadcasts. No pude confirmar si una automatización puede *otorgar* un cupón o una recompensa, o si solo envía mensajes.

## 3. Tipos de recompensa, vencimiento, límites y edición de plantillas ya emitidas

### Takeaway
Las recompensas son solo porcentaje, monto fijo u "other" (regalo). Hay límites por recompensa (N veces por período, con reinicio por calendario o móvil), vencimiento por punto o por sello, y vencimiento por tarjeta. La edición está partida en dos: tras la "activación" se congelan los "main settings" (cantidad de sellos, % de descuento, precios de membresía), pero las recompensas de la tarjeta Reward y el modo de acumulación se pueden editar en caliente sobre las tarjetas ya instaladas.

### Cited Findings
- [DOC] Reward type: Percentage (con tope máximo de descuento) / Fixed / Other. Límite de uso: "Usage limit = 1" para regalo de bienvenida único; con toggle "Calendar period" (el límite se reinicia al inicio del período) o sin él (el límite corre desde el último uso) — [Reward cards](https://perkstar.co.uk/help-center/create-and-manage-reward-cards)
- [DOC] Vencimiento: la tarjeta es Unlimited / Fixed term (fecha) / Fixed term after issuing (días). Los puntos vencen uno por uno ("Each point has its own expiration countdown"). "When customers earn a reward … those points do not expire". "Customers do not receive push notifications about upcoming points expiration" — [Reward cards](https://perkstar.co.uk/help-center/create-and-manage-reward-cards)
- [DOC] Sellos: "Earned rewards have no expiration date"; los sellos de cumpleaños no vencen — [Stamp cards](https://perkstar.co.uk/help-center/create-and-manage-stamp-cards)
- [DOC] Activación: "While inactive, only 10 people can install the card. After activation, main settings cannot be changed". Se muestra una lista de campos bloqueados antes de activar — [Reward cards](https://perkstar.co.uk/help-center/create-and-manage-reward-cards), [Discount cards](https://perkstar.co.uk/help-center/create-and-manage-discount-cards)
- [DOC] Editable en caliente: "switch between earning methods at any time without affecting existing cardholders"; "add, change, or remove rewards at any time, even after activation" — [Reward cards](https://perkstar.co.uk/help-center/create-and-manage-reward-cards)
- [DOC] Promociones: "You can modify inactive promotions freely. For active promotions, changes may affect customer experience … End current promotion and create a new one for major changes" — [Promotions](https://perkstar.co.uk/help-center/promotions-creating-and-managing)
- [DOC] Un cambio de mensaje de geo-push llega a las tarjetas instaladas de forma diferida: "Customer may still receive old geo-push message after you delete/change it … Consider sending a manual push to force card update" — [Geo-push](https://perkstar.co.uk/help-center/geo-push-notifications-location-based)

### Inferences
- Como las recompensas de la tarjeta Reward se pueden editar o borrar después de emitidas, pero los eventos de redención guardan `rewardTierId` + `cost` + un snapshot en línea de la promoción (nombre, tipo, valor, términos), Perkstar parece **copiar el snapshot de la recompensa en el momento de redimir**. Así el historial no depende de la definición actual. Es una inferencia a partir de la forma del payload y no está documentada explícitamente.

### Gaps
- No hay documentación sobre qué pasa con una recompensa ya desbloqueada si el comerciante borra ese reward level.

## 4. Redención en el mostrador y antifraude

### Takeaway
Hay un Scanner PWA (sin app en las tiendas) con escaneo QR o de código de barras, o búsqueda manual por nombre, teléfono, email o número de serie. Redimir es una acción explícita donde el staff elige la recompensa. Los controles antifraude son operativos: permisos por rol y por local, sesiones de 24 h, delay anti-duplicado en kiosko, límites diarios de check-in y de sellos, límites por recompensa y por promoción, sin deshacer en el scanner (solo el admin revierte), y un ledger con reversiones compensatorias.

### Cited Findings
- [DOC] Scanner: escaneo con cámara o búsqueda manual (nombre / teléfono / email / número de serie). La pestaña Redeem muestra solo las recompensas alcanzables. Pide opcionalmente el "reward cost price" (para el ROI) y un comentario interno — [Scanner – Reward cards](https://perkstar.co.uk/help-center/reward-card-transactions-in-scanner-app)
- [DOC] "You cannot undo a redemption in the Scanner App. Contact your administrator to reverse" — [Scanner – Coupons](https://perkstar.co.uk/help-center/scanner-app-processing-coupon-cards)
- [DOC] Promociones en el scanner: contadores "X/Y" (usos del cliente / total restante) — [Promotions](https://perkstar.co.uk/help-center/promotions-creating-and-managing)
- [DOC] Kiosk mode: acumulación automática al escanear, con "duplicate accrual protection" y delay configurable (15–60 s), recomendado "if you've experienced abuse or gaming of the system". Los managers no pueden cambiarlo — [Kiosk mode](https://perkstar.co.uk/help-center/kiosk-mode-automation)
- [DOC] Sesiones del scanner "automatically terminate after 24 hours"; permisos limitados por tipo de tarjeta — [Scanner login](https://perkstar.co.uk/help-center/scanner-app-login-staff-access); managers restringidos por local, y el perfil del manager lista sus operaciones ("Add Points", "Redeem Reward"…) — [Manager profiles](https://perkstar.co.uk/help-center/manager-profiles-permissions), [Manager accounts](https://perkstar.co.uk/help-center/manager-accounts-permissions)
- [DOC] "Restrict to 1 check-in per customer per day", "Daily stamp limit" — [Stamp cards](https://perkstar.co.uk/help-center/create-and-manage-stamp-cards); "Daily check-in limit" en membresía — [Membership](https://perkstar.co.uk/help-center/create-and-manage-membership-cards)
- [MKT] Autoredención: "Customers open redemption from their Wallet card, slide to confirm, then show the confirmation to your staff"; placas NFC "Tap to Earn" — [Pricing](https://perkstar.co.uk/pricing), [Home](https://perkstar.co.uk/)
- [API] La transacción es un ledger `STAMP | REDEEM | ADJUST` con source `SCANNER, POS, API, ADJUST, DASHBOARD, LEGACY_IMPORT, TAP`. Tiene `external_transaction_id` único (idempotencia) y reversiones como fila compensatoria con `reverses_transaction_id` ("reversed at most once") — [OpenAPI](https://developers.perkstar.co.uk/api/openapi.yaml)
- [API] Las herramientas MCP incluyen "unusual-activity summaries" en "Programme and protection" — [MCP](https://developers.perkstar.co.uk/tools/mcp.md)
- [MKT/búsqueda] El Scanner es una PWA ("no app store required") — [Install scanner](https://perkstar.co.uk/help-center/install-the-scanner-app-on-iphone-android)

### Gaps
- No hay documentación de la lógica de detección de "actividad inusual".

## 5. Analítica por recompensa, por tarjeta y por campaña

### Takeaway
La analítica documentada es mayormente **a nivel negocio** (visitas, recurrentes, AOV, retención, feedback, referidos, demografía). Hay analítica por tarjeta en Membership (MRR/LTV/churn). Hay conteo de redenciones por promoción. Para las recompensas, la atribución viene de campos en cada fila de redención (`rewardTierId`, `cost`, `promotionId`), no de una entidad catálogo. No encontré ningún reporte documentado de "rendimiento por recompensa".

### Cited Findings
- [DOC] Secciones del dashboard: Visits, Activity (transacciones, AOV, clientes nuevos, tarjetas emitidas), Loyalty ROI, Retention (60/120/240 días), Feedback, Referral, Customer Profiles. No hay un desglose por recompensa entre los gráficos documentados — [Dashboard analytics](https://perkstar.co.uk/help-center/dashboard-analytics-understanding-business-metrics)
- [DOC] Loyalty ROI se alimenta del "reward cost" cargado en cada redención y del monto de compra ("This data feeds into your analytics … program ROI") — [Scanner – Reward cards](https://perkstar.co.uk/help-center/reward-card-transactions-in-scanner-app); el toggle "Purchase amount when charging" alimenta "ROI statistics and revenue figures" — [Reward cards](https://perkstar.co.uk/help-center/create-and-manage-reward-cards)
- [DOC] Promociones: "Track redemption rates per promotion"; "Redemption data remains available for analysis"; "Review redemption counts for each promotion" — [Promotions](https://perkstar.co.uk/help-center/promotions-creating-and-managing)
- [DOC] Membresía: estadísticas por plantilla (MRR, LTV, ARPU, churn, gráficos de nuevos y perdidos) en la sección "Information" de la plantilla — [Membership](https://perkstar.co.uk/help-center/create-and-manage-membership-cards)
- [DOC] Cupones: instalados vs. redimidos disponible "in your admin panel customer profiles and analytics" para detectar a quien no redimió — [Scanner – Coupons](https://perkstar.co.uk/help-center/scanner-app-processing-coupon-cards)
- [DOC] UTM por canal de distribución: "Each UTM tag generates a unique URL and QR code for analytics", y también segmentos por UTM — [Reward cards](https://perkstar.co.uk/help-center/create-and-manage-reward-cards)
- [DOC] Reporte semanal por email: secciones fijas, "cannot customize sections" — [Weekly report](https://perkstar.co.uk/help-center/weekly-report-automated-performance-summaries)
- [MKT] "Advanced customer analytics … visits, repeat visits and reward redemptions" — [Pricing](https://perkstar.co.uk/pricing); MCP: "Query stamps, points, redemptions, adjustments, and outstanding rewards"; reportes de "broadcast reporting" — [MCP](https://developers.perkstar.co.uk/tools/mcp.md)
- [API] `broadcast.sent` lleva `targetCount` y `failureCount` (métricas de entrega por broadcast) — [Webhook catalogue](https://developers.perkstar.co.uk/reference/webhook-events.md)

### Inferences
- **Para la preocupación del owner:** Perkstar obtiene estadísticas por recompensa y por campaña **sin catálogo global**, porque (a) cada recompensa tiene un ID estable dentro de su tarjeta (`rewardTierId`/`milestoneId`/`stampRewardId`), (b) cada promoción tiene ID y su recompensa se copia en línea a la fila de redención, y (c) el ledger guarda `cost` y el monto de compra. La estadística sale de etiquetar cada redención con (tarjeta, recompensa-hija o promoción) + snapshot, no de un catálogo. Lo que *no* pueden hacer de forma nativa, porque no hay catálogo, es sumar "el mismo café gratis" entre distintas tarjetas o promociones. No hay evidencia de que lo ofrezcan.

### Gaps
- No hay capturas ni documentación de un reporte de redenciones por reward level. La afirmación de marketing "reward redemptions" no aclara si se agrupa por recompensa.

## 6. Reseñas de usuarios (complejidad de configuración)

### Takeaway
Prácticamente no hay reseñas independientes: 0 en Trustpilot, 0 en Capterra, 0 en G2, y no hay app en las tiendas (el scanner es PWA). La única evidencia son dos testimonios en su propia web.

### Cited Findings
- [REV] Trustpilot: 0 reseñas; perfil reclamado en enero de 2025 — [Trustpilot](https://uk.trustpilot.com/review/perkstar.co.uk)
- [REV] Capterra: "Based on 0 user reviews" — [Capterra](https://www.capterra.com/p/10033177/Perkstar/); G2: "Read 0 Reviews" (título en el buscador) — [G2](https://www.g2.com/sellers/perkstar)
- [MKT, testimonio propio] "Perkstar is really intuitive … as a barber" (Grades Barbershop); "helped us turn a promotional campaign into something measurable and easy to attribute" (Krispy Kreme) — [Home](https://perkstar.co.uk/)
- [DOC, señal indirecta de complejidad] Cada tipo de tarjeta es un asistente de 6 pasos con decenas de campos (código de barras, modo de acumulación, happy hours, vencimientos, formulario de alta, UTM, referidos, links, términos) y bloqueo al activar — [Reward cards](https://perkstar.co.uk/help-center/create-and-manage-reward-cards)

### Inferences
- No se puede sacar ninguna conclusión de usuarios reales sobre la complejidad. La carga de configuración visible en los docs es alta, pero está concentrada *en la plantilla*, no repartida entre entidades.

### Gaps
- No encontré hilos en Reddit ni reseñas de apps. YouTube no se revisó (quedó fuera del presupuesto de llamadas).
