---
spec: 0123
fecha: 2026-10-01
estado: cerrada
resumen: Adaptar Trama viva al pase de identidad de Apple Wallet, conservando el QR y la actualización de pases emitidos.
disjunta: no
archivos: packages/domain/src/server/wallet/apple.ts, packages/domain/src/server/wallet/apple-art.ts, packages/domain/src/server/wallet/pass-version.ts, apps/merchant/src/server/wallet.test.ts, docs/design-explorations/apple-wallet-trama-viva.html, docs/design-explorations/apple-wallet-trama-strip-v1.svg, docs/wallet-go-live.md, docs/INDEX.md, docs/PARQUEADO.md, docs/TASKS.md
---

# 0123 — Pase Apple Wallet «Trama viva»

## Estado de la propuesta

**Dirección visual aprobada por el owner el 2026-10-02:** «iPhone · strip visible» de la [maqueta](../design-explorations/apple-wallet-trama-viva.html). Esta spec queda cerrada para implementación. La vista sin `strip` documenta únicamente el comportamiento de respaldo que debe verificarse en iOS reciente y Apple Watch; no es una alternativa de diseño seleccionada. La maqueta es una aproximación: Apple Wallet decide la composición final, el recorte, la tipografía y el QR. El QR de la maqueta es ficticio. El [arte vectorial](../design-explorations/apple-wallet-trama-strip-v1.svg) y sus [PNG @2x](../design-explorations/apple-wallet-trama-strip-v1@2x.png) y [@3x](../design-explorations/apple-wallet-trama-strip-v1@3x.png) fijan la composición aprobada.

La [spec 0122](0122-pase-google-wallet-trama-viva.md) fijó la dirección de marca y se publicó en Google. Apple usa hoy un `storeCard` azul oscuro con nombre, última novedad y QR, pero su `icon.png` y `logo.png` son cuadrados sólidos de 16 × 16 px y no incluye ilustración. Esta spec adapta la misma pertenencia a la red local al lenguaje de Apple, sin atribuir al usuario un nivel, beneficio o estatus que el producto no tenga.

## Qué permite Apple

| Superficie | Regla de Apple | Decisión para CheckPass Club |
|---|---|---|
| Tipo | `storeCard` es apropiado para fidelización; tiene encabezado, campo principal, hasta cuatro campos secundarios/auxiliares combinados, código y reverso. | Conservar `storeCard` y el pase único de identidad. |
| Encabezado | Logo e identidad visibles también en la lista de pases; `icon.png` se usa en superficies como avisos. | Símbolo «C» marfil y nombre `CheckPass Club`; exportar icono y logo nítidos en @2x/@3x. |
| Imagen | La guía visual de Apple indica `strip.png` de 375 × 144 pt para `storeCard`; el texto del campo principal puede superponerse. | Reinterpretar los dos trazos en un lienzo horizontal, concentrados a la derecha; dejar azul libre detrás del nombre. |
| Color | `backgroundColor`, `foregroundColor` y `labelColor` determinan la tarjeta y legibilidad. | Conservar azul `#0f2a3a`, texto blanco y etiquetas claras. El marfil y coral viven en el arte. |
| Código | Wallet dibuja el código a partir de `barcodes`/`barcode`. | Mantener el QR nativo y su token opaco, sin dibujar ni decorar el código. |
| Reverso | Campos extensos e información de contacto del emisor. | Mantener «Ver mis programas» y agregar `hola@checkpass.club`, publicado en las páginas legales del sitio. |
| Watch | La documentación de `storeCard` dice que el strip y el reverso no aparecen en Apple Watch. | Asegurar que logo, nombre, color y QR comuniquen el pase sin la ilustración. |

Fuentes oficiales: [Human Interface Guidelines de Wallet](https://developer.apple.com/design/human-interface-guidelines/wallet), [Creating a store card pass](https://developer.apple.com/documentation/walletpasses/creating-a-store-card-pass), [Pass Designer](https://developer.apple.com/documentation/walletpasses/creating-a-pass-with-pass-designer), [Pass JSON](https://developer.apple.com/documentation/walletpasses/pass).

### Incompatibilidad que debe resolverse en dispositivo

La guía visual vigente (actualizada en junio de 2026) y la página de `storeCard` siguen describiendo el `strip` para este tipo de pase. Sin embargo, la tabla de compatibilidad de Pass Designer indica `strip` para `storeCard` solo antes de iOS 26, aunque el texto de esa misma página sigue explicando su uso en tarjetas de tienda. Las fuentes no permiten asegurar que la ilustración se vea en las versiones recientes de iOS. **Antes de aprobar una publicación, generar un pase de QA firmado y comprobarlo en iPhone real con iOS 26/27 y en una versión anterior disponible.** Registrar si aparece `strip`, si el nombre conserva contraste y si Wallet cambia la disposición. Si el `strip` no aparece en el iOS objetivo, la dirección visual se debe revisar con el owner: publicar solo el logo y color no equivale a llevar Trama viva completa a Apple.

## Composición propuesta

1. **Al reconocer el pase:** `logo.png` con la «C» marfil, seguido de «CheckPass Club». El icono usa el mismo símbolo a escala pequeña. El nombre funciona incluso sin `strip`.
2. **En la zona principal:** «Titular» y el nombre real del miembro, dibujados por Wallet. El archivo `strip` solo contiene los dos trazos marfil y coral sobre azul; deja los primeros ~220 pt tranquilos para el nombre. No lleva textos ni promesas de beneficios.
3. **Debajo:** «Última novedad» conserva el aviso actual; el QR conserva posición y función nativas. La ilustración no toca el código.
4. **Al girar el pase:** «Ver mis programas» y `hola@checkpass.club` como contacto del emisor. Las promociones de un comercio no se mezclan con el pase global.

El `strip` de 375 × 144 pt se exportará como `strip.png`, `strip@2x.png` (750 × 288 px) y `strip@3x.png` (1125 × 432 px), según los tamaños 2x/3x de Apple. `icon.png` corresponde a 38 × 38 pt; el logo tendrá altura máxima de 50 pt y ancho entre 50 y 160 pt. Las versiones de alta densidad usan las dimensiones multiplicadas por 2 y 3; no se agrandan los cuadrados actuales de 16 px como arte final. Los PNG de exploración son una muestra del `strip`, aún no assets de producción ni archivos firmados del pase.

## Contrato de implementación

- Incorporar PNG finales al paquete `.pkpass` que genera `packages/domain/src/server/wallet/apple.ts`. Su `manifest.json` debe incluir cada archivo con su hash y firmarse de nuevo. Mantener `formatVersion`, `passTypeIdentifier`, `teamIdentifier`, `serialNumber`, `authenticationToken`, `webServiceURL`, `locations`, `storeCard`, `barcode` y `barcodes` funcionalmente iguales.
- Usar el mismo Pass Type ID y número de serie al regenerar cada pase instalado. Cambiar el arte del constructor solo afecta emisiones nuevas y las respuestas de actualización que el iPhone descargue; los pases guardados requieren el canal PassKit/APNs ya previsto. [Apple: actualización de pases](https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes).
- Incrementar la revisión visual que usa `pass-version.ts` para que el servicio detecte una nueva versión del pase incluso si no cambian los datos del miembro. Enviar el aviso PassKit vacío a registros existentes, permitir que Wallet descargue el `.pkpass` nuevo y verificar el resultado en un pase viejo. La firma y el manifiesto deben corresponder a los bytes finales.
- Agregar el contacto público `hola@checkpass.club` al reverso. El correo figura en las páginas legales del sitio; no incrustar correo personal, secretos o URL de prueba.
- Mantener `CheckPass Club` en `organizationName` y `logoText`. Revisar `description` para que describa el pase a VoiceOver, por ejemplo «Pase de miembro de CheckPass Club», sin usarla como eslogan visible.
- Las futuras variantes patrocinadas necesitarán una spec aparte: derechos de imagen, vigencia, consentimiento, prioridad de marca y comportamiento cuando el arte no se muestre. No sustituir el emisor ni convertir este pase de identidad en publicidad cambiante dentro de esta entrega.

## QA antes de publicar

1. Comparar el pase actual y el nuevo en iPhone: lista de Wallet, pase abierto y reverso. Probar nombre corto y largo, tamaño de texto grande y pantalla pequeña. Registrar versión exacta de iOS y captura con datos/QR de prueba.
2. Comprobar en iOS 26/27 si aparece `strip`; contrastar con una versión anterior disponible. Si se omite, resolver la propuesta visual antes de publicar.
3. Escanear el QR de prueba antes y después; comprobar que el token y el enlace a programas no cambien.
4. Instalar un pase nuevo y actualizar uno ya emitido con mismo Pass Type ID y serial. Comprobar `manifest.json`, firma válida, respuesta del web service y recepción de APNs; observar el diseño final en Wallet.
5. Verificar Apple Watch si hay dispositivo disponible. Como mínimo, inspeccionar que el pase sin `strip` en la maqueta sigue siendo identificable.
6. Documentar resultados en `docs/wallet/`. La dirección visual ya fue aprobada; el QA del render real y el PASS independiente siguen `docs/AGENT-WORKFLOW.md` antes de marcar la implementación como terminada.

## Definition of Done técnico

- [x] El `.pkpass` incluye icono, logo y `strip` a 1x, 2x y 3x, con PNG válidos y dimensiones de Apple. El manifiesto contiene el hash de cada archivo y la firma cubre el manifiesto. Verificación estructural local con firmante de prueba, 2026-10-02.
- [x] El nombre, el QR, la última novedad, el enlace a programas y la identidad del pase no cambian de contrato; el reverso muestra el contacto público. Verificación de payload local, 2026-10-02.
- [x] La revisión visual hace que el web service ofrezca el nuevo paquete a un pase previamente emitido, incluso sin novedad nueva. La revisión se elevó a `2026-10-02T14:00:00Z`; la comprobación funcional en dispositivo sigue abajo.
- [x] Prueba automatizada del paquete y sus imágenes, `pnpm run typecheck`, `pnpm run lint`, prueba de Wallet y build de consumer pasan localmente el 2026-10-02.
- [ ] QA en iPhone confirma el `strip` en la versión objetivo y un pase nuevo/viejo; el resultado se anota antes de poner el arte en producción.
- [ ] Revisión independiente según `docs/AGENT-WORKFLOW.md` antes de marcar `implementada`.

Evidencia y límites de la implementación local: [handoff 0123](../handoff-0123-apple-wallet-trama-viva-2026-10-02.md). La prueba con firmante de desarrollo no acredita instalación real en iPhone.

## Fuera de alcance

Cambiar QR, token, identidad del pase, tipo de pase, modelo de membresía, avisos, geofences o rutas de backend. Tampoco se actualiza Apple en producción durante esta etapa de diseño.

### Disjunta?

**No.** El constructor de Apple y el canal de actualización comparten archivos con las specs de Wallet vigentes. La migración de arte debe serializarse respecto a cambios de emisión y push.

## Decisión del owner

El owner eligió «iPhone · strip visible» el 2026-10-02 y autorizó cerrar la spec para implementar. La compatibilidad real del `strip` en iOS reciente queda como gate de QA técnico antes de publicar.
