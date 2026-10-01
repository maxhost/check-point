# Capacidades de Apple Wallet y Google Wallet más allá de una tarjeta de fidelidad (para una red de varios comercios)

Fecha de la investigación: 2026-09-29. Fuentes primarias: developers.google.com/wallet, payments.developers.google.com/terms/aup, developer.apple.com (docs JSON, HIG, Wallet Developer Guide de archivo, App Review Guidelines). Confianza: **A** = cita textual de doc oficial leída; **B** = doc oficial resumida por la herramienta de fetch o snippet de búsqueda; **C** = terceros / foros; **SIN VERIFICAR** = marcado explícito.

Nota de método: los fetch de Google se hicieron con un modelo que resume la página; las frases entre comillas son las que devolvió como textuales, pero conviene re-abrir la página antes de citarlas en una spec (regla del repo: una cita es un puntero, no una verificación). Las citas de Apple salen de los JSON/HTML oficiales descargados con curl y extraídos a texto (más confiables).

## 1. Google Wallet: cuota de notificaciones — ¿por objeto, por usuario o por issuer? ¿Cuentan los mensajes de clase?

### Takeaway
La regla documentada es **por pase (objeto)**: máx. 3 mensajes con push (`TEXT_AND_NOTIFY`) y, aparte, máx. 3 actualizaciones de campo con push, cada una en ventana de 24 h. Si el límite es por objeto, N objetos (p. ej. un offer por comercio) tendrían en teoría N cuotas propias; pero Google no documenta cómo se comportan los mensajes de **clase** frente a la cuota, y se reserva el throttling por spam, así que no se puede afirmar que multiplicar objetos multiplique la atención de forma fiable.

### Cited Findings
- Offers: «You may send a maximum of 3 messages that trigger a push notification in a 24 hour period.» Al pasarse: `QuotaExceededException`; se recomienda seguir con `TEXT` (sin push). Confianza A/B — [Trigger Push Notifications | Offers](https://developers.google.com/wallet/retail/offers/use-cases/trigger-push-notifications)
- Loyalty: dos cuotas separadas, cada una «a maximum of 3 … in a 24 hour period»: (a) actualizaciones de campo con `notifyPreference` = `notifyOnUpdate`, (b) mensajes `TEXT_AND_NOTIFY`. El resumen de la página las describe como aplicadas «per pass». Confianza B — [Trigger Push Notifications | Loyalty cards](https://developers.google.com/wallet/retail/loyalty-cards/use-cases/trigger-push-notifications)
- Campos de loyalty que disparan notificación de actualización: `LoyaltyClass`: `rewardsTier`, `secondaryRewardsTier`, `programName`; `LoyaltyObject`: `loyaltyPoints.balance`, `secondaryLoyaltyPoints.balance`. Confianza B — [misma página](https://developers.google.com/wallet/retail/loyalty-cards/use-cases/trigger-push-notifications)
- Búsqueda (snippet de Google): «Both message and update notifications are limited to 3 per pass within a 24-hour period to prevent spamming»; la misma regla aparece en todos los verticales (loyalty, offers, eventos, boarding, transporte, genérico). Confianza B — [resultados en developers.google.com, p. ej. Generic](https://developers.google.com/wallet/generic/use-cases/trigger-push-notifications)
- Google puede reducir la cuota si considera que hay spam (snippet): «Google may throttle your push notification delivery quota if it deems you are spamming your users.» Confianza B (snippet, no re-leído en la página) — [Trigger Push Notifications (Generic)](https://developers.google.com/wallet/generic/use-cases/trigger-push-notifications)
- Los links dentro de mensajes tienen que ser del pase (snippet): «it is a violation of the Acceptable Use Policy to send users to links not related to the pass». Confianza B — [misma familia de páginas](https://developers.google.com/wallet/retail/offers/use-cases/trigger-push-notifications)
- Campo `messages[]` del objeto: «All users of this object will receive its associated messages. The maximum number of these fields is 10.» Confianza A/B — [REST loyaltyobject](https://developers.google.com/wallet/reference/rest/v1/loyaltyobject)
- **Mensajes de clase:** la página de Offers muestra ejemplos a nivel objeto y a nivel clase pero, según el fetch, «does not clarify whether messages added at the class level notify all objects within that class or count separately against the quota». Confianza B — [Offers push](https://developers.google.com/wallet/retail/offers/use-cases/trigger-push-notifications)
- **Contradicción:** la FAQ de Offers dice «Developer authored push notifications are not currently supported by Google Wallet» y lista solo avisos automáticos. Contradice las páginas de «Trigger Push Notifications»; lo más probable es que la FAQ esté vieja. Confianza B — [Offers FAQ](https://developers.google.com/wallet/retail/offers/resources/faq)
- Límite de la API: «Calls to the Google Wallet API are rate limited to 20 requests per second». Confianza B — [Offers FAQ](https://developers.google.com/wallet/retail/offers/resources/faq)

### Inferences
- Si la cuota es por objeto, una red que emite **un offer object por oferta de comercio** tendría 3+3 push/24 h por cada objeto, además de la tarjeta de fidelidad. Es una lectura literal de «per pass», no está confirmada, y el throttling discrecional por spam puede anularla en cualquier momento. Fatiga del usuario aparte.
- Un mensaje de clase le llega a todos los objetos de la clase (por el diseño clase/objeto), pero no se sabe si genera un push por objeto ni si consume la cuota de cada uno. No hay que diseñar sobre eso sin probarlo en un issuer de prueba.

### Gaps
- No encontré documentación oficial de si la cuota es también por usuario o por issuer (además de por objeto). Nada lo dice explícitamente.
- No verifiqué qué hace el push de un mensaje de clase respecto de la cuota. Hay que medirlo en una cuenta demo.

## 2. Google Wallet: Offer vs Loyalty, linked offers, auto linked passes, Value Added Opportunities, varios pases en un JWT

### Takeaway
Hay cuatro formas de sumar contenido de ofertas alrededor de la tarjeta: (1) `linkedOfferIds` (offers dentro de la vista de la tarjeta de fidelidad, se muestran hasta 5 y el usuario no tiene que guardarlos), (2) Auto Linked Passes (`linkedObjectIds`, hasta 50 pases agrupados, **mismo issuer ID**), (3) módulos de Value Added (tarjetas con link dentro del pase, sin push) y (4) un JWT de «Save to Google Wallet» que guarda varios objetos de distintos tipos a la vez. La AUP limita (2) a **promociones del mismo issuer** y con el mismo propósito.

### Cited Findings
- `linkedOfferIds[]`: «A list of offer objects linked to this loyalty card. The offer objects must already exist.» Confianza A/B — [REST loyaltyobject](https://developers.google.com/wallet/reference/rest/v1/loyaltyobject)
- Linked offers (snippet oficial): «Unlike standalone offers, linked offers do not require a user to explicitly save the offer. Linked offers will appear in a loyalty card view between the card section and the details section. Only a maximum of 5 linked offers are displayed in the carousel.» Se linkean con insert/update/patch o con `modifyLinkedOfferObjects`, y un PATCH puede llevar solo `linkedOfferIds`. Confianza B (snippet; la URL de la página específica dio 404 al abrirla) — [búsqueda sobre loyalty cards / linked offers](https://developers.google.com/wallet/retail/loyalty-cards/use-cases/pass-customization)
- `linkedObjectIds[]`: «a list of other objects such as event ticket, loyalty, offer, generic, giftcard, transit and boarding pass that should be automatically attached to this loyalty object.» Confianza A/B — [REST loyaltyobject](https://developers.google.com/wallet/reference/rest/v1/loyaltyobject)
- Auto Linked Passes: «enable sending additional Google Wallet passes to users, pre-linking them to an existing primary pass for a grouped experience». Requisitos: el primario y el linkeado usan el **mismo issuer ID**, el objeto linkeado ya tiene que existir y no se puede anidar. «Maximum of 50 linked passes per primary pass». La entrega push es «best-effort» y el usuario puede desactivar los pases linkeados. Confianza B — [Auto Linked Passes | Loyalty](https://developers.google.com/wallet/retail/loyalty-cards/use-cases/auto-linked-passes)
- Value Added Opportunities (loyalty): «Modules will be displayed in the bottom section of the pass and can link to issuer content.» Header de 60 caracteres, cuerpo de 50, URI obligatoria (web o deep link), `displayInterval` con start y end. Límite en esta página: «A maximum of 15 value added modules are allowed per class / per object». No menciona notificaciones. Confianza B — [Value Added Opportunities | Loyalty](https://developers.google.com/wallet/retail/loyalty-cards/use-cases/value-added-opportunities)
- **Contradicción:** la referencia REST dice `valueAddedModuleData[]` «Maximum of ten on the object» — [REST loyaltyobject](https://developers.google.com/wallet/reference/rest/v1/loyaltyobject). La página de uso dice 15. Hay que verificarlo con la API. Confianza del conflicto: A/B.
- También existe la página [Value Added Opportunities | Offers](https://developers.google.com/wallet/retail/offers/use-cases/value-added-opportunities) (confirmado por búsqueda; no la abrí).
- Varios pases en un JWT: «Multiple passes can be added to the user's Google Wallet account when clicking the "Add to Google Wallet" button. Each pass being added can be a different pass type (except for Vaccine Cards and Test Records).» El ejemplo incluye `offerObjects` junto con `eventTicketObjects`. Confianza B — [Add multiple pass types | Offers](https://developers.google.com/wallet/retail/offers/use-cases/save-multiple-pass-types)
- La página JWT de Offers no documenta un límite de objetos por JWT ni de largo del URL (según el fetch). Confianza B — [JWT | Offers](https://developers.google.com/wallet/retail/offers/use-cases/jwt)

### Inferences
- Para una red, la vía más barata en atención es `linkedOfferIds`: las ofertas aparecen dentro de la tarjeta sin que el usuario haga nada, pero solo se ven 5 en el carrusel. No encontré documentado que linkear un offer dispare un push.
- Los offers como objetos propios permiten, en teoría, cuota y ubicaciones propias (ver §1 y §3), a costa de pedirle al usuario que los guarde o de usar Auto Linked Passes.
- Si la red es el issuer único (una sola cuenta de issuer que emite para todos los comercios), el requisito de «mismo issuer» se cumple técnicamente. La lectura de la AUP (§5) es otra cosa.

### Gaps
- No encontré el límite de objetos por JWT ni de longitud del link de guardado.
- No pude abrir la página específica de linked offers (404). Los datos vienen de snippets oficiales.

## 3. Google Wallet: notificaciones por cercanía (merchantLocations) y aviso de vencimiento

### Takeaway
Son automáticas y las decide Google: hasta 10 `merchantLocations` por clase y 10 por objeto, con radio, permanencia y frecuencia **no publicados**. El usuario tiene que tener las notificaciones activas y ubicación precisa «always on». El campo viejo `locations` ya no dispara geo-notificaciones. Los offers reciben un aviso automático **48 h antes de vencer**.

### Cited Findings
- «You can add up to 10 locations per class and 10 per object» (`MerchantLocations`). «Google will send notifications to users when they are nearby. Google decides how close a user needs to be and how long they need to stay in the area before the notification is sent.» Confianza A/B — [Offers push](https://developers.google.com/wallet/retail/offers/use-cases/trigger-push-notifications)
- Requisito del usuario: tener «enabled notifications and granted precise, always on location access to the Google Wallet app». Confianza B — [Loyalty push](https://developers.google.com/wallet/retail/loyalty-cards/use-cases/trigger-push-notifications)
- `merchantLocations[]`: «There is a maximum of ten on the object. Any additional MerchantLocations added beyond the 10 will be rejected.» `locations[]` (deprecado): «This field is currently not supported to trigger geo notifications.» Confianza A/B — [REST loyaltyobject](https://developers.google.com/wallet/reference/rest/v1/loyaltyobject)
- Snippet: el geofence funciona cuando el usuario está dentro de un radio de una coordenada «and dwells there». En offers la notificación es «sticky» y al tocarla se abre el pase. Confianza B — [búsqueda en developers.google.com](https://developers.google.com/wallet/reference/rest/v1/MerchantLocation)
- Vencimiento del offer: «Offer card: Expiry reminder - 48 hours before the offer card expires.» Es automático. Confianza B — [Offers FAQ](https://developers.google.com/wallet/retail/offers/resources/faq)
- El pase genérico tiene avisos opcionales: «Upcoming» 24 h antes del intervalo y «Expiry» 48 h antes del fin, activados con `enabledNotification`. Confianza B — [Generic notifications](https://developers.google.com/wallet/generic/use-cases/notifications)

### Inferences
- Un offer por comercio con las `merchantLocations` de ese comercio le da a cada oferta su propio disparador por cercanía (10 locales por objeto) y su propio aviso de vencimiento, sin gastar la cuota de push. Pero la frecuencia la maneja Google y no se puede prometer.
- Una tarjeta única de la red está limitada a 10 + 10 ubicaciones. En una red con muchos comercios no alcanza, así que habría que repartir ubicaciones entre objetos o ir rotándolas.

### Gaps
- No hay publicado un radio, un tiempo de permanencia ni un tope diario del aviso por cercanía. No sé si se deduplica entre varios pases del mismo lugar.
- No se sabe si el aviso de vencimiento a 48 h cuenta contra la cuota de 3 (probablemente no, porque es del sistema, pero **SIN VERIFICAR**).

## 4. Apple Wallet: estilos (storeCard vs coupon), relevancia, changeMessage, varios pases, límites

### Takeaway
Apple **no tiene cuota de push publicada**. Cada update con `changeMessage` genera una notificación, pero el HIG prohíbe usarla para marketing. La relevancia es una **sugerencia pasiva en la pantalla bloqueada**, no una notificación: 10 ubicaciones y 10 UUIDs de beacon por pase, y en coupon y store card es solo por ubicación con radio chico (sin fecha relevante). No encontré un aviso automático de vencimiento para coupons: Wallet oculta los pases vencidos. Se pueden agregar varios pases a la vez.

### Cited Findings
- «A pass can have only 10 relevant locations. If your pass needs more locations, such as a coupon for a chain of stores, start with the best ones. Update the pass to change the array of relevant locations.» Confianza A — [Showing a Pass on the Lock Screen](https://developer.apple.com/documentation/walletpasses/showing-a-pass-on-the-lock-screen)
- Beacons: «Add up to ten different UUIDs for iBeacons to the `beacons` array … To include more than ten beacons in the array, use the UUID to group the beacons and give each beacon in a group a different major and minor Bluetooth identifier.» Confianza A — [misma página](https://developer.apple.com/documentation/walletpasses/showing-a-pass-on-the-lock-screen)
- «Coupons, store cards, and generic passes must provide locations if you added any other type of relevance information to the pass object.» La fecha relevante (`relevantDate`) es para boarding passes, event tickets y generic passes. Confianza A — [misma página](https://developer.apple.com/documentation/walletpasses/showing-a-pass-on-the-lock-screen)
- `maxDistance`: «The maximum distance, in meters, from a location in the `locations` array at which the pass is relevant. The system uses the smaller of this distance or the default distance.» `relevantDate`: «This object is deprecated. Use `relevantDates` instead.» Confianza A — [Pass (walletpasses)](https://developer.apple.com/documentation/walletpasses/pass)
- `relevantDates`: «An object that represents a date interval that the system uses to show a relevant pass» (`startDate`/`endDate`, o `date` con el intervalo que calcula Wallet). Confianza A — [Pass.RelevantDates](https://developer.apple.com/documentation/walletpasses/pass/relevantdates-data.dictionary)
- Tabla 4-2 de la guía de archivo: Coupon, «Relevant date: Not supported. Relevant locations: Required if relevance information is provided. Interpreted with a small radius. Relevant if any location matches.» Store card: lo mismo. Boarding pass y event ticket: «large radius». Confianza A (doc de archivo, puede estar desactualizada) — [Wallet Developer Guide: Pass Design and Creation](https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html)
- La relevancia es pasiva: «It doesn't present alerts or post notifications. This is in contrast to the notification posted when a pass updates». Texto relevante: «Don't include your organization name in the relevant text, and don't include instructions to the user, such as "Redeem this pass at XYZ."» Confianza A — [misma guía](https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html)
- Terceros (no oficial): cupones aparecen «around 100 m» y boarding passes «around 1,000 m». Confianza C — snippet de búsqueda, sin fuente primaria. **SIN VERIFICAR**.
- HIG, change messages: «Use change messages only for updates to time-critical information. A change message interrupts people, so send one only for updates they need to know about. … Never use a change message for marketing or other noncritical communication.» Confianza A — [HIG Wallet](https://developer.apple.com/design/human-interface-guidelines/wallet)
- HIG, vencimiento: «Wallet automatically hides expired passes to reduce crowding … set the expiration date, relevant date, and voided properties of each pass correctly». No menciona un aviso previo al vencimiento. Confianza A — [HIG Wallet](https://developer.apple.com/design/human-interface-guidelines/wallet)
- HIG, varios pases: «Add related passes as a group. If your app generates multiple passes … add all passes at once … If your website distributes a group of passes … bundle them together so people can download them all at once.» Y: «If people decline your suggestion, don't ask them again.» Confianza A — [HIG Wallet](https://developer.apple.com/design/human-interface-guidelines/wallet)
- PassKit: «To add multiple passes without presenting this view controller multiple times, use the [addPasses] method of [PKPassLibrary].» Confianza A — [PKAddPassesViewController](https://developer.apple.com/documentation/passkit/pkaddpassesviewcontroller)
- Throttling: no hay límites documentados de push para Wallet. Hay reportes de que el dispositivo deja de pedir el pase tras pushes frecuentes aunque APNs responda 200, y se atribuye a throttling. Confianza C — [Apple Dev Forums 807401](https://developer.apple.com/forums/thread/807401), [PassKit Support](https://help.passkit.com/en/articles/11905171-understanding-push-notifications-for-apple-and-google-wallet-passes)

### Inferences
- En Apple, separar ofertas en coupons da 10 ubicaciones más por cada pase y un `changeMessage` propio. Pero la relevancia no notifica (solo sugiere en la pantalla bloqueada) y el `changeMessage` no puede ser marketing según el HIG. Un aviso tipo «nueva oferta» enviado como change message choca de frente con la guía.
- Para el aviso de vencimiento en Apple habría que usar un `changeMessage` propio en el campo de vencimiento, y es discutible si eso es «time-critical».

### Gaps
- No encontré límite de pases por usuario ni de pases por `.pkpasses`.
- No verifiqué cambios de iOS 18/26 en cómo se muestran las sugerencias por ubicación, fuera de la deprecación de `relevantDate` a favor de `relevantDates`. Ningún resultado primario habló de un cambio para coupon o store card.

## 5. Políticas: ¿se puede usar la notificación de un pase para promocionar a OTROS comercios?

### Takeaway
**Google lo prohíbe explícitamente en los pases linkeados**: un issuer no puede promocionar productos u ofertas de otro issuer a través de un pase relacionado, y los links de los mensajes tienen que estar relacionados con el pase. **Apple** limita los pases a pagos, ofertas e identificación, y prohíbe usar el change message para marketing. En ninguno de los dos hay una regla escrita sobre redes o coaliciones multi-comercio.

### Cited Findings
- Google AUP, sección «Auto-Added Linked Passes & Value-Added Recommendations». El pase relacionado tiene que: «Be connected to the same issuer as the original Pass (i.e. an issuer cannot promote a separate issuer's products or offers through a related pass)»; «Be connected to the purpose of the original Pass that the user has added, such as: A promotion of a similar nature (e.g. offers for a different product offered by the same issuer)»; «Not be a repetition of the content of the original Pass or other related Passes»; «Not allow the selling of additional unrelated passes by the same issuer or other issuers to users.» Confianza A/B — [Google Pay and Wallet APIs AUP](https://payments.developers.google.com/terms/aup)
- La AUP no tiene (según el fetch) una sección específica sobre mensajes o push, ni sobre co-branding o varios comercios en un pase. Confianza B — [AUP](https://payments.developers.google.com/terms/aup)
- Los links en mensajes tienen que ser de un sitio o app relacionado con el pase. Un link no relacionado viola la AUP. Confianza B (snippet) — [Offers push](https://developers.google.com/wallet/retail/offers/use-cases/trigger-push-notifications)
- App Review Guidelines 3.1.x (iv): «Wallet passes can be used to make or receive payments, transmit offers, or offer identification (such as movie tickets, coupons, and VIP credentials). Other uses may result in the rejection of the app and the revocation of Wallet credentials.» Confianza A — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- App Review 1.5: «ensure that Wallet passes include valid contact information from the issuer and are signed with a dedicated certificate assigned to the brand or trademark owner of the pass.» Confianza A — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- HIG: «Never use a change message for marketing or other noncritical communication.» Confianza A — [HIG Wallet](https://developer.apple.com/design/human-interface-guidelines/wallet)

### Inferences
- En Google, si la red emite con **un solo issuer** (el de la red) y la tarjeta es «de la red», un offer del comercio X linkeado a esa tarjeta se puede defender como «del mismo issuer y del mismo propósito». Si cada comercio es un issuer distinto, queda prohibido. Es un área gris que conviene validar con Google antes de construir sobre ella.
- En Apple, la regla 1.5 («certificate assigned to the brand or trademark owner of the pass») sugiere que un pase con la marca de un comercio debería firmarlo el dueño de la marca. Una red que firma coupons con la marca de cada comercio podría chocar con esto; con la marca de la red, no. Es una inferencia, **SIN VERIFICAR** con Apple.

### Gaps
- No encontré una política de Apple ni de Google que hable de coaliciones o agregadores de fidelidad.

## 6. Implementaciones multi-comercio o de agregador documentadas

### Takeaway
Lo único documentado es **Smart Tap con varios `redemptionIssuers`**: una misma clase (p. ej. un programa de fidelidad) se puede canjear por NFC en comercios distintos, cada uno con su propio Redemption Issuer ID y Collector ID.

### Cited Findings
- «A single pass class can have multiple Redemption Issuers»; para canjear una clase, el ID del Redemption Issuer tiene que estar en `redemptionIssuers`. «the same loyalty program, represented by a LoyaltyClass, might be redeemable at different merchants.» Cada Redemption Issuer se mapea a un Collector ID por comercio. Confianza B — [Smart Tap: Issuer account configuration](https://developers.google.com/wallet/smart-tap/introduction/issuer-configuration), [Merchant configuration](https://developers.google.com/wallet/smart-tap/introduction/merchant-configuration)
- Smart Tap necesita una terminal con Smart Tap: «It must be a SmartTap capable terminal.» Confianza B — [Offers FAQ](https://developers.google.com/wallet/retail/offers/resources/faq)

### Inferences
- Smart Tap resuelve el canje en varios comercios, no el alcance. Además exige hardware NFC certificado, que es poco probable en comercios chicos.

### Gaps
- No encontré casos públicos documentados (en docs oficiales) de coaliciones que usen offers por comercio en Google o Apple Wallet.
