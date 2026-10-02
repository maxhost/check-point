# Diseño y publicación de pases en Google Wallet

Estado verificado el 2026-10-01: la clase real `3388000000023188934.mipasaporte_identity`
usa **Trama viva** y Google respondió `reviewStatus=approved` tras el `PATCH`. El owner
aprobó el aspecto en Android usando una clase de QA. Sigue sin verificarse en Console
si el emisor tiene acceso de publicación para cuentas fuera del grupo de prueba;
también falta probar QR y enlace con un pase real ya guardado y otro nuevo.

## Qué cambia a quién

| Recurso | Contenido en CheckPass Club | Alcance de la actualización |
|---|---|---|
| `LoyaltyClass` compartida | Emisor, programa, logo, hero, fondo, etiquetas y plantilla | Todos los objetos que referencian esa clase, incluidos pases ya guardados y futuros. |
| `LoyaltyObject` | Identidad del miembro, QR, enlace a programas, novedades y ubicaciones | Ese pase/miembro. Un `object.heroImage` tiene prioridad sobre `class.heroImage`. |
| PNG público | Arte referenciado por URL en la clase o el objeto | Google lo descarga; usar URL HTTPS estable y **nueva URL versionada** para cada revisión del arte. |

Google Wallet dibuja la tarjeta. El logo y la trama no están embebidos en la app ni en
el JWT de guardado. El constructor de objetos en
`packages/domain/src/server/wallet/google-object.ts` asigna siempre
`<issuerId>.mipasaporte_identity`; el provisionador
`scripts/google-wallet/provision-class.mjs` define la presentación de esa clase.
Por eso un cambio de clase no exige reemitir objetos, cambiar QR ni pedir al usuario
que quite y vuelva a guardar el pase. La propagación visual depende de la
sincronización de Google Wallet; comprobarla en un teléfono real.

## Publicar un nuevo estilo para toda la comunidad

1. Diseñar logo y hero según la [guía de marca de Google](https://developers.google.com/wallet/retail/loyalty-cards/resources/brand-guidelines).
   Trama viva usa logo PNG de 660 × 660 y hero PNG de 1032 × 812. Mantener el QR
   despejado y verificar lista, pase abierto y detalles en Android.
2. Crear archivos y URLs con versión nueva, por ejemplo `wallet-logo-v3.png` y
   `wallet-hero-v3.png`. Publicarlos primero en `https://my.checkpass.club/` o en
   un dominio público estable de R2. Confirmar `200`, `image/png` y acceso sin sesión.
   No reemplazar los bytes de una URL que Google ya conoce.
3. Cambiar `LOGO_URL`, `HERO_URL` y, si corresponde, los campos de `classBody()` en
   `scripts/google-wallet/provision-class.mjs`. Probar el payload y desplegar el código
   fuente/los PNG. El script es la fuente de verdad: una ejecución futura volverá a
   aplicar los valores que contiene.
4. Con `GOOGLE_WALLET_ISSUER_ID` y `GOOGLE_WALLET_SA_JSON_FILE` apuntando al emisor y
   a una clave local protegida, ejecutar desde la raíz del repo:

   ```sh
   node scripts/google-wallet/provision-class.mjs --inspect > /ruta/segura/clase-antes.json
   node scripts/google-wallet/provision-class.mjs --class-suffix qa_diseno_v2 --apply
   node scripts/google-wallet/provision-class.mjs --class-suffix qa_diseno_v2 --inspect
   ```

   `--inspect` solo lee. La clase de QA no cambia la real: emitir un objeto ficticio
   que referencie el sufijo de QA y probarlo en Android. Su QR no demuestra que el
   mostrador funcione.
5. Tras aprobar el QA, actualizar **la clase real sin `--class-suffix`** y leerla de
   nuevo:

   ```sh
   node scripts/google-wallet/provision-class.mjs --apply
   node scripts/google-wallet/provision-class.mjs --inspect
   ```

   El script hace `GET`, calcula un `PATCH` de presentación y conserva los campos de
   clase ajenos a ese diseño. Si no hay diferencias, no escribe. Google puede revisar
   una actualización; confirmar `reviewStatus=approved` en la lectura posterior.
6. Abrir en Android **un pase real guardado antes del cambio** y guardar **otro pase
   real nuevo**. Confirmar logo, hero, nombre, QR escaneable en mostrador y enlace
   «Ver mis programas». Si el pase viejo tarda, reabrir Wallet y comprobar conexión
   antes de intentar reemitirlo. Registrar fecha y resultado en el handoff.

El cambio de clase es global y no dispara por sí mismo un mensaje individual al
miembro. No usar `addMessage` para refrescar diseño: ese flujo notifica.

### Permiso del emisor para llegar a cualquier usuario

`reviewStatus=approved` describe la **clase**. El acceso general se concede al
**emisor** por separado. Verificar en Google Pay & Wallet Console → Google Wallet API
si ya tiene *publishing access*. En modo demo solo pueden guardar pases las cuentas
Admin, Developer o de prueba; completar Business Profile y solicitar
*Request publishing access* si falta. Google ya no exige screenshots para enviar
la solicitud. No declarar «live para todos» hasta ver ese permiso y probar el flujo
de guardado con una cuenta que no sea de prueba. Véase
[solicitud de acceso](https://developers.google.com/wallet/retail/loyalty-cards/test-and-go-live/request-publishing-access)
y [checklist de lanzamiento](https://developers.google.com/wallet/retail/loyalty-cards/test-and-go-live/launch-checklist).

### Reversión

Conservar la salida previa de `--inspect` fuera del repo. Restaurar **solo** campos de
presentación por `PATCH`, incluidos los campos que antes no existían si hay que
quitarlos; probar la operación primero en una clase de QA. No hacer `PUT` parcial:
borraría campos no incluidos. No cambiar IDs de clase/objeto, QR, callbacks, enlaces
ni ubicaciones. También hay que devolver el código del provisionador al estilo
anterior o una ejecución posterior reaplicará el estilo nuevo.

## Pases especiales y patrocinios futuros

**El pase de identidad actual es uno por miembro y comparte una clase.** Cambiar su
logo o hero de clase para un patrocinador mostraría esa campaña a *toda* la comunidad,
incluidos los pases ya guardados. La segmentación requiere trabajo de producto y de
emisión adicional:

| Objetivo | Mecanismo de Google | Trabajo necesario aquí |
|---|---|---|
| Campaña para toda la comunidad | Nuevo hero en la clase compartida | Seguir el procedimiento global anterior; definir inicio, fin y vuelta a Trama viva. |
| Hero especial para ciertos miembros, conservando la identidad | `LoyaltyObject.heroImage` en los objetos elegidos; prevalece sobre el hero de clase | Definir audiencia y vigencia; añadir el hero a emisión y `PATCH` de objetos existentes; probar retorno al diseño base. El provisionador de clase no hace esto hoy. |
| Credencial de evento distinta o diseño completo para un patrocinador | Clase nueva y objetos nuevos, posiblemente otro tipo de pase según la función | Spec propia: emisión, IDs, guardado, QR, callback, caducidad y UX para que el usuario entienda por qué aparece otro pase. El código actual solo reconoce la clase de identidad. |

El hero a nivel de objeto permite una edición limitada sin crear una segunda
credencial. El logo, fondo y plantilla de la clase compartida seguirían siendo los
de CheckPass Club. Para un pase de evento realmente distinto, crear otra clase y
un flujo explícito; **no** cambiar el `classId` del pase de identidad como atajo.
Antes de ofrecer patrocinios comercialmente, definir qué recibe el miembro, cuánto
dura la campaña y cómo vuelve el diseño base; validar el arte en las guías de Google.

## Registro de Trama viva

- PNG públicos: `https://my.checkpass.club/wallet-logo-trama-v1.png` y
  `https://my.checkpass.club/wallet-trama-hero-v1.png`.
- Clase de QA: `<issuerId>.qa_trama_viva_0122`; aspecto aprobado por el owner en Android.
- Clase real: `3388000000023188934.mipasaporte_identity`; `PATCH` aplicado el
  2026-10-01. `--inspect` posterior: `issuerName=CheckPass Club`,
  `programName=Mi CheckPass`, URLs Trama viva, fondo `#0f2a3a`, etiqueta `Miembro`,
  plantilla de tarjeta/lista y `reviewStatus=approved`.
- Antes del cambio: `issuerName=Mi CheckPass`, `programName=Mi CheckPass`, logo
  `/wallet-logo-v2.png`, fondo `#0f2a3a`; `heroImage`, `accountNameLabel` y
  `classTemplateInfo` ausentes. Snapshot de operación en
  `/private/tmp/checkpass-wallet-class-before-trama-2026-10-01.json` (archivo local;
  puede desaparecer al limpiar temporales).
- Pendiente: confirmar publishing access del emisor en Console y QA funcional de
  un pase real existente y uno nuevo. La prueba con QR ficticio no cubre esos casos.

## Fuentes de Google

- [Clases y objetos: alcance de `PATCH`](https://developers.google.com/wallet/retail/loyalty-cards/use-cases/updates).
- [Plantilla de loyalty, precedencia de `object.heroImage`](https://developers.google.com/wallet/retail/loyalty-cards/resources/template).
- [Referencia de `LoyaltyObject.heroImage`](https://developers.google.com/wallet/reference/rest/v1/loyaltyobject).
- [Referencia de `LoyaltyClass.reviewStatus`](https://developers.google.com/wallet/reference/rest/v1/loyaltyclass).
