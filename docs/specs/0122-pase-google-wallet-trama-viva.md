---
spec: 0122
fecha: 2026-10-01
estado: cerrada
resumen: Rediseñar el pase único de identidad en Google Wallet con el lenguaje Trama viva para expresar pertenencia a la red de comercios locales, sin afectar el QR ni los avisos existentes.
disjunta: no
archivos: scripts/google-wallet/provision-class.mjs, scripts/google-wallet/provision-class.test.mjs, apps/consumer/public/wallet-logo-trama-v1.png, apps/consumer/public/wallet-trama-hero-v1.png, docs/design-explorations/trama-viva-hero-reference.svg, docs/wallet-go-live.md, docs/handoff-0122-google-wallet-trama-viva-2026-10-01.md, docs/specs/0122-pase-google-wallet-trama-viva.md, docs/INDEX.md, docs/PARQUEADO.md, docs/TASKS.md
---

# 0122 — Pase Google Wallet «Trama viva»

## Problema

El pase de Google Wallet funciona como credencial de identidad y acceso: un pase por consumidor para toda la red, QR personal, nombre y enlace a sus programas. La clase compartida se provisiona hoy con `issuerName` y `programName` iguales a «Mi CheckPass», un color azul y un logo circular. No tiene imagen hero ni plantilla explícita para la lista y la cara de la tarjeta. Comunica utilidad, pero todavía no comunica que pertenecer a CheckPass Club es elegir y sostener comercios locales.

Esta spec materializa la dirección **Trama viva**, elegida por el owner el 2026-10-01 tras la [exploración visual](../design-explorations/google-wallet-pase.html). El owner aprobó el contrato visual y funcional de esta spec el 2026-10-01 y autorizó cerrarla para implementación. La maqueta fija intención, paleta y ritmo, pero Google Wallet conserva el render final, el QR y la tipografía.

## Alcance

**Entra:** arte final y assets estables para Google; definición exacta de la `LoyaltyClass`; presentación de los datos del objeto ya existente; migración de la clase compartida que usan pases guardados; pruebas del payload y QA en Android real.

**Fuera:** rediseño de Apple Wallet, nuevo tipo de pase, pase por comercio, niveles de membresía, puntos globales, promociones en la cara del pase, QR nuevo, cambios en check-in, enlaces de cuenta, geofences o políticas de push. Apple tendrá una spec de arte propia que reutilice la dirección visual si se decide.

## Decisión de experiencia

La credencial debe expresar **«soy parte de una red local»** con un signo reconocible y cercano, sin comunicar lujo ni una categoría superior de miembros. La marca sigue siendo el emisor; ningún comercio adquiere el control del color, logo o hero de este pase global. El arte no muestra negocios particulares ni beneficios efímeros.

### Vista del pase

1. **Encabezado:** logo circular con la «C» de CheckPass Club; `issuerName = "CheckPass Club"` y `programName = "Mi CheckPass"`. Esta combinación evita el texto repetido actual. Se usa el encabezado estándar, no `wideProgramLogo`, para preservar el símbolo circular en la lista y la vista abierta.
2. **Campo principal:** una sola fila `oneItem` que referencia `object.accountName`, con etiqueta `accountNameLabel = "Miembro"`. Se conserva el nombre completo recibido del perfil; si está vacío, el fallback actual del constructor sigue siendo «Mi CheckPass» hasta que se resuelva en la cuenta. No se muestra un nivel de membresía inventado.
3. **QR:** permanece generado por Google desde `object.barcode.type = QR_CODE` y `object.barcode.value = qrToken`. El valor, `accountId` y `serialNumber` no se convierten en texto decorativo. No se agrega `barcode.alternateText`: Google lo reserva para un equivalente legible del valor que sirva cuando el QR no pueda escanearse, y una frase de marca no cumpliría esa función. El identificador opaco puede seguir apareciendo debajo del QR; se registra su aspecto en QA, sin alterar el contrato funcional. No se coloca ilustración ni imagen sobre el QR.
4. **Hero:** ilustración abstracta de dos trazos anchos que se entrecruzan; evoca personas, recorridos y comercios conectados. Sin palabra, frase, logo, número, mapa real ni iconos de pago dentro de la imagen. Debe sentirse distintiva vista a tamaño de teléfono y dejar aire en los extremos. La imagen usa el área que Google asigna bajo el contenido principal; el render exacto no se reproduce en CSS propio.
5. **Detalles:** se conserva el enlace «Ver mis programas», las novedades y los turnos cercanos existentes. No se agrega una fila «Comunidad / Local» de la maqueta: implicaría otro `textModulesData` permanente cuando el objeto ya usa módulos para novedades y ubicaciones. La pertenencia se comunica mediante nombre, arte y contexto del producto.
6. **Lista de pases:** `listTemplateOverride.firstRowOption.fieldOption` referencia `class.programName` y `secondRowOption` referencia `object.accountName`. El logo y el color de fondo siguen presentes. No se usa `thirdRowOption`, que Google marca como obsoleto. En listas y grupos donde Google altere la segunda fila, el primer renglón y logo conservan la identificación de CheckPass.

La frase de producto fuera de Wallet, para explicar el pase al guardarlo, es **«Tu pase para volver a los lugares que hacen ciudad»**. No se incrusta en la imagen ni se agrega a la cara de Wallet en esta spec. La vista debe funcionar sin ese texto promocional.

### Arte y paleta

| Elemento | Decisión |
|---|---|
| Fondo de clase | `#0f2a3a`, color sólido actual de marca; texto de Wallet con contraste alto. |
| Trama | Dos bandas curvas de ancho generoso: verde marfil `#d8e5cf` y coral cálido `#df7759`, con cruces deliberados y espacio azul entre trazos. Sin efecto metálico, brillo, relieve ni degradado de fondo. |
| Logo circular | PNG 660 × 660 px o mayor, cuadrado con fondo azul y «C» marfil; contenido dentro del margen seguro circular del 15 %. Derivar del logo actual, revisar a escala pequeña. |
| Hero | PNG 1032 × 812 px, proporción 1032:812. Exportar fielmente la [referencia vectorial aprobable](../design-explorations/trama-viva-hero-reference.svg): dos cintas de 112 y 104 unidades sobre fondo azul; no añadir texto ni efectos. La composición deja margen vertical respecto al borde de la imagen. |
| Rutas públicas | `https://my.checkpass.club/wallet-logo-trama-v1.png` y `https://my.checkpass.club/wallet-trama-hero-v1.png`. URLs HTTPS estables, versionadas, sin query de despliegue. No cambiar el contenido de una URL ya referenciada por Google; usar `-v2` para una corrección posterior. |

Los colores de la trama viven solo en el PNG hero; Google recibe un único `hexBackgroundColor`. Las dimensiones son las recomendadas por la [guía de marca de Google Wallet](https://developers.google.com/wallet/retail/loyalty-cards/resources/brand-guidelines). El arte final debe contrastarse en pantalla real antes de tocar la clase de producción.

## Especificación técnica

### Clase y objeto

`scripts/google-wallet/provision-class.mjs` es la fuente de la forma deseada de la clase `<issuerId>.mipasaporte_identity`. El identificador de clase **no cambia**: los pases ya guardados la referencian y el callback de guardado compara ese ID. La operación de actualización usa `PATCH` con solo los campos propiedad de esta spec: `issuerName`, `programName`, `programLogo`, `heroImage`, `hexBackgroundColor`, `accountNameLabel`, `classTemplateInfo` y el `reviewStatus` requerido por Google. Lee la clase antes de escribir y no elimina `callbackOptions`, `merchantLocations`, mensajes u otros campos ajenos. Cuando el payload deseado ya coincide, informa «sin cambios» y no envía el `PATCH`.

Forma objetivo de los campos nuevos o cambiados (sin credenciales ni IDs):

```json
{
  "issuerName": "CheckPass Club",
  "programName": "Mi CheckPass",
  "programLogo": { "sourceUri": { "uri": "https://my.checkpass.club/wallet-logo-trama-v1.png" } },
  "heroImage": { "sourceUri": { "uri": "https://my.checkpass.club/wallet-trama-hero-v1.png" } },
  "hexBackgroundColor": "#0f2a3a",
  "accountNameLabel": "Miembro",
  "classTemplateInfo": {
    "cardTemplateOverride": {
      "cardRowTemplateInfos": [
        { "oneItem": { "item": { "firstValue": { "fields": [{ "fieldPath": "object.accountName" }] } } } }
      ]
    },
    "listTemplateOverride": {
      "firstRowOption": { "fieldOption": { "fields": [{ "fieldPath": "class.programName" }] } },
      "secondRowOption": { "fields": [{ "fieldPath": "object.accountName" }] }
    }
  }
}
```

El JSON efectivo del `PATCH` agrega `reviewStatus: "UNDER_REVIEW"` solo cuando Google lo requiere para editar la clase aprobada; el resultado y estado final se inspeccionan antes de considerarlo terminado. La clase existente puede tener `classTemplateInfo` previo fuera de esta spec: el script conserva sus propiedades no gestionadas al construir el `PATCH`, en vez de reemplazarlas de forma accidental. La [documentación de actualización](https://developers.google.com/wallet/retail/loyalty-cards/use-cases/updates) señala que `PATCH` sustituye arrays completos, por lo que se debe inspeccionar el objeto recibido y enviar enteros los arrays que se pretendan alterar. No se modifican arrays de mensajes o ubicaciones.

`buildLoyaltyObject` conserva IDs, `accountName`, `accountId`, QR, `merchantLocations`, `textModulesData` y `linksModuleData`. No requiere cambios: la presentación nueva vive en la clase. El `PATCH` periódico del objeto no altera las propiedades de clase. No cambian secretos, rutas HTTP, tablas ni migraciones.

### Publicación y compatibilidad

1. Generar el PNG del logo y hero y servirlos desde el dominio estable antes de actualizar la clase. Comprobar respuesta `200`, `Content-Type: image/png` y visualización sin autenticación desde un dispositivo fuera de la sesión.
2. Validar los assets y el payload en una clase de prueba del mismo issuer, con IDs y objetos de prueba aislados. Capturar lista y pase abierto en Android. Verificar que Google muestra el logo, el nombre y la trama sin tapar el QR.
3. Leer la clase real con `--inspect`, guardar una copia **sin credenciales** de los campos necesarios para revertir, y aplicar el `PATCH` idempotente. La actualización de la clase alcanza a los objetos que ya la referencian; comprobar al menos un pase previamente guardado y uno nuevo. No crear una segunda credencial en el dispositivo del usuario.
4. Si el pase previamente guardado no refresca en el tiempo de QA, cerrar y reabrir Wallet y verificar conectividad antes de tocar IDs o emitir duplicados. Si Google rechaza la clase o el render falla, restaurar los campos de presentación previos mediante `PATCH`; preservar callbacks, objeto y QR.
5. Revisar `reviewStatus` y acceso de publicación después del cambio. No asumir que aprobación previa implica aprobación automática del arte nuevo. Documentar captura, fecha y resultado en el handoff de implementación.

No se publican secretos, JWTs, valores QR ni IDs de consumidores en capturas o logs. Los screenshots usan cuentas de prueba y se oculta el QR real al compartirlos fuera del equipo.

### Referencias oficiales

- [Plantilla de Loyalty Pass](https://developers.google.com/wallet/retail/loyalty-cards/resources/template): encabezado fijo, filas, barcode y vista de lista.
- [Referencia de Barcode](https://developers.google.com/wallet/reference/rest/v1/Barcode): `alternateText` es un equivalente legible para cuando falla el escaneo.
- [ClassTemplateInfo](https://developers.google.com/wallet/reference/rest/v1/ClassTemplateInfo): forma de `cardTemplateOverride` y `listTemplateOverride`.
- [Guía de marca](https://developers.google.com/wallet/retail/loyalty-cards/resources/brand-guidelines): proporciones y márgenes del arte, fondo y logo.
- [Actualización de pases](https://developers.google.com/wallet/retail/loyalty-cards/use-cases/updates): efectos de `PATCH` y alcance de una clase compartida.

### Arquitectura de referencia

- [ADR 0033](../adr/0033-proveedor-de-wallet-apple-passkit-y-google-wallet.md): un pase de identidad global por consumidor; la clase y el QR conservan su alcance.
- [ADR 0014](../adr/0014-qr-wallet-y-checkin-con-defensa-en-capas.md): el QR porta un token opaco, no información personal.
- [ADR 0103](../adr/0103-los-beneficios-viven-en-la-cuenta-y-la-wallet-solo-avisa.md): beneficios en la cuenta; Wallet identifica y avisa.
- [Spec 0029](0029-pase-de-wallet-apple-google.md) y [spec 0033](0033-canal-de-actualizacion-y-push-de-wallet.md): emisión y avisos que permanecen operativos.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/consumer/public/wallet-logo-trama-v1.png` | Crear asset versionado. |
| `apps/consumer/public/wallet-trama-hero-v1.png` | Crear asset versionado. |
| `docs/design-explorations/trama-viva-hero-reference.svg` | Referencia visual fuente para exportar el hero sin reinterpretar la composición. |
| `scripts/google-wallet/provision-class.mjs` | Extender forma de clase, lectura/inspección, actualización idempotente y preservación de campos ajenos. |
| `scripts/google-wallet/provision-class.test.mjs` | Crear pruebas puras del payload y de la actualización sin conexión a Google. |
| `docs/wallet-go-live.md` | Actualizar secuencia de publicación, assets y revisión de clase. |
| `docs/handoff-0122-google-wallet-trama-viva-2026-10-01.md` | Registrar evidencia local y QA pendiente. |
| `docs/INDEX.md`, `docs/PARQUEADO.md`, `docs/TASKS.md` | Registrar la spec, el estado de entrega y separar pendiente de Apple. |

El nombre visible de Google se resuelve solo en la clase; `WALLET_BRAND` en `core.ts` alimenta también Apple y queda fuera del cambio.

### Disjunta?

**No.** Comparte el proveedor de Wallet, el test general y la documentación de publicación con cualquier arco de emisión o push activo. Serializar respecto a cambios de clase, callbacks o QR. Los assets pueden prepararse antes, pero el `PATCH` de la clase real es un solo paso controlado.

## Definition of Done

QA visual en Android aprobado por el owner el 2026-10-01 con el pase de prueba:
«perfecto, funcionó, quedó hermoso». El QR de ese pase era ficticio; la prueba funcional
con un pase real y la actualización de la clase compartida siguen pendientes.

- [ ] Los PNG finales cumplen dimensiones, margen seguro y ausencia de texto incrustado; el hero expresa dos trazos entrelazados sin perder legibilidad al reducirse.
- [ ] La clase de prueba muestra «CheckPass Club»/«Mi CheckPass», logo circular, fondo azul y trama; lista con nombre de programa y miembro. Se registra si Google muestra el identificador opaco junto al QR.
- [ ] El pase abierto muestra nombre de miembro, QR operativo y hero; el QR escanea el mismo `qrToken` que el pase previo.
- [ ] El enlace «Ver mis programas», última novedad y turnos cercanos continúan accesibles; las notificaciones existentes no cambian de contrato.
- [ ] El provisionador deja intactos `callbackOptions` y cualquier campo de clase ajeno a esta spec, es idempotente y no revela secretos en salida.
- [ ] Un pase ya guardado recibe la presentación nueva tras la actualización de la clase sin crear un segundo pase; un guardado nuevo usa la misma clase.
- [ ] Hay capturas de Android de lista, pase abierto y detalle; se registra versión de Wallet, tamaño de pantalla y fecha. La revisión de Google y publicación quedan verificadas antes de declarar la implementación terminada.
- [ ] Revisor independiente emite `PASS` según `docs/AGENT-WORKFLOW.md`.

## Plan de pruebas y verificación

1. **Pruebas puras:** generar el objeto con nombres largos y vacíos; verificar QR, clase y enlaces sin introducir `alternateText` decorativo. Ejercitar forma de `classBody` y cálculo del `PATCH` con una clase que ya tenga `callbackOptions`, `classTemplateInfo` extra y mensajes; comprobar preservación, igualdad idempotente y ausencia de cambios a arrays ajenos.
2. **Validación de assets:** inspeccionar `file`/dimensiones, confirmar PNG y abrir las rutas públicas por HTTPS. La comprobación de los URLs reales solo ocurre después de desplegar los assets.
3. **Verificación del repo:** `node --test scripts/google-wallet/provision-class.test.mjs`, `pnpm exec vitest run apps/merchant/src/server/wallet.test.ts`, `pnpm run typecheck` y `pnpm run build` desde la raíz. La suite existente del objeto sirve de regresión; no se edita para repetir un contrato que no cambia. Registrar comando y resultado exactos en el handoff.
4. **Android real:** cuenta de prueba con pase guardado antes del cambio y otra que lo guarde después; comparar lista, tarjeta y detalle con la maqueta y el contrato. Escanear ambos QR en el mostrador de prueba. Probar nombre largo, fuente grande y tema claro/oscuro del teléfono. Verificar apertura del enlace y presencia de una novedad y un turno cercanos preparados para QA.
5. **Reversión ensayada:** sobre la clase de prueba, restaurar por `PATCH` los campos visuales anteriores y comprobar que objeto, callback, QR y avisos siguen intactos. Para producción conservar el payload visual anterior antes de aplicar.

## Handoff requerido

Implementador y revisor siguen `docs/AGENT-WORKFLOW.md`, con capturas y campos de la clase redactados sin tokens. El revisor verifica por separado la clase real y el Android de QA antes de marcar `implementada`.

## Abierto

Ningún punto bloqueante. El owner aprobó esta spec el 2026-10-01; los criterios de QA en Android y la revisión de Google siguen siendo condiciones de entrega de la implementación.
