# Apple Wallet: posibilidades y límites del diseño

Investigación contrastada con la documentación oficial de Apple el 2026-10-02.
Aplicación concreta: pase de identidad **CheckPass Club**, tipo `storeCard`, definido
en `packages/domain/src/server/wallet/apple.ts`. La [spec 0123](../specs/0123-pase-apple-wallet-trama-viva.md)
fija Trama viva; la [guía de actualización](apple-wallet-update-existing-passes.md)
explica cómo llevar una revisión a pases instalados.

## Quién dibuja la tarjeta

Wallet compone la tarjeta a partir de `pass.json` y los PNG del `.pkpass`. El emisor
elige contenido, colores e imágenes **dentro del tipo de pase**; Apple controla
tipografía, posiciones, tamaños finales, recortes, código y vistas compactas. La
maqueta HTML sirve para decidir el arte, no para predecir cada píxel en iPhone.

Para CheckPass Club, `storeCard` corresponde al uso de membresía/fidelización.
Cambiar a `generic`, cupón, entrada o un formato póster cambia la estructura y
requiere otra decisión de producto y QA. No es un modo de obtener un lienzo libre
para el pase de identidad existente. [Apple: tipos y metadatos](https://developer.apple.com/documentation/walletpasses/defining-the-metadata-of-your-wallet-pass),
[tarjeta de tienda](https://developer.apple.com/documentation/walletpasses/creating-a-store-card-pass).

## Superficies del `storeCard`

| Elemento | Qué admite | Límite para diseñar |
|---|---|---|
| Encabezado | `logo.png` y `logoText`; `organizationName` identifica al emisor. | Logo y nombre deben reconocer el pase también cuando Wallet lo muestra compacto. No se fija libremente su posición. |
| Icono | `icon.png` cuadrado. | Se usa en el pase y en otras superficies como avisos; Wallet aplica las esquinas. |
| Imagen principal | `strip.png` horizontal detrás del campo principal. | El nombre puede quedar sobre la imagen; dejar fondo tranquilo y contraste detrás del texto. No insertar texto, QR ni CTA en el PNG. |
| Campos | Un campo principal; hasta cuatro secundarios y auxiliares combinados en una fila. `backFields` para detalles extensos. | Wallet puede omitir campos de la cara cuando los valores son largos. Evitar datos permanentes que compitan con el nombre y QR. |
| Colores | `backgroundColor`, `foregroundColor`, `labelColor`; arte PNG. | Son colores de la tarjeta, no CSS, gradientes o control de tipografía. Comprobar contraste en el teléfono. |
| Código | `barcodes` con QR u otros formatos admitidos. | Wallet lo genera y optimiza; la imagen del pase no debe dibujar otro código ni interferir en el escaneo. |
| Reverso | Enlaces, condiciones y contacto. | No reemplaza el campo principal. Apple recomienda información de contacto del emisor. |

El pase actual usa la «C» marfil, `logoText = CheckPass Club`, azul `#0f2a3a`,
nombre como campo principal, última novedad como secundario, QR nativo y
`hola@checkpass.club` en el reverso. El arte Trama viva sitúa los trazos a la
derecha del `strip` para mantener legible el nombre. [Apple HIG: Wallet](https://developer.apple.com/design/human-interface-guidelines/wallet),
[Apple: `storeCard`](https://developer.apple.com/documentation/walletpasses/creating-a-store-card-pass).

### Tamaños del arte

| Archivo | Tamaño lógico | @2x | @3x |
|---|---:|---:|---:|
| `icon.png` | 38 × 38 pt | 76 × 76 px | 114 × 114 px |
| `logo.png` | 50 × 50 pt en nuestro caso; Apple admite 50–160 pt de ancho y 50 pt de alto | 100 × 100 px | 150 × 150 px |
| `strip.png` | 375 × 144 pt | 750 × 288 px | 1125 × 432 px |

Exportar PNG sin texto incrustado y con poco peso. Incluir 1x, @2x y @3x en el
paquete para cubrir densidades; el [HIG actual](https://developer.apple.com/design/human-interface-guidelines/wallet)
destaca @2x/@3x. El generador de este repo usa
`packages/domain/scripts/generate-apple-art.mjs`; las fuentes están en
`docs/design-explorations/apple-wallet-trama-strip-v1.svg` y
`apps/consumer/public/wallet-logo-trama-v1.png`. Genera los nueve PNG como bytes
embebidos en `apple-art.ts`, que el constructor firma en cada pase.

### Qué no ofrece esta tarjeta

- `storeCard` no admite un fondo de arte libre de tamaño completo como los pases
  póster. `background.png`/`artwork.png`, miniaturas y `footer.png` tienen reglas
  propias de otros tipos de pase; agregarlos al ZIP no convierte al `storeCard` en
  un póster. [Apple HIG: imágenes por tipo](https://developer.apple.com/design/human-interface-guidelines/wallet).
- No hay CSS, fuentes propias, sombras programables ni posición arbitraria del QR.
  La cara puede cambiar entre iPhone, versiones de iOS y Apple Watch.
- Un patrocinio global dentro de `apple-art.ts` aparece en todos los pases nuevos
  y en cada pase viejo que se refresque. Una variante por persona requiere guardar
  la elección y reproducirla tanto al emitir como al responder PassKit. No vender
  el `strip` como inventario garantizado sin medir su presencia en iOS objetivo.

### Compatibilidad que se debe medir

La [guía visual vigente](https://developer.apple.com/design/human-interface-guidelines/wallet)
y la [guía de `storeCard`](https://developer.apple.com/documentation/walletpasses/creating-a-store-card-pass)
describen el `strip`, mientras la [tabla de Pass Designer](https://developer.apple.com/documentation/walletpasses/creating-a-pass-with-pass-designer)
lo marca solo para versiones anteriores a iOS 26, aunque su propia explicación lo
mantiene para tarjetas de tienda. También hay descripciones distintas sobre la
presencia o el recorte del `strip` en Apple Watch. Por eso **el render real en iPhone
y Watch tiene prioridad sobre la maqueta y estas tablas**. Documentar versión de
iOS/watchOS, lista, pase abierto, reverso, nombre largo y QR. Si no se muestra la
trama en el sistema objetivo, volver a decidir el diseño antes de prometerlo.

## Archivo `.pkpass`

Un pase distribuible contiene `pass.json`, los PNG, `manifest.json` con hash por
archivo y una firma separada del manifiesto con el certificado Pass Type ID. Cambiar
una imagen obliga a reconstruir y firmar el **paquete entero**. Mantener
`passTypeIdentifier`, `serialNumber` y `authenticationToken` al actualizar el pase;
el QR también permanece estable en el pase de identidad de CheckPass Club. [Apple:
construir un pase](https://developer.apple.com/documentation/walletpasses/building-a-pass),
[Apple: actualizar un pase](https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes).
