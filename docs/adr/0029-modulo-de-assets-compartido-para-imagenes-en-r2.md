---
fecha: 2026-08-13
resumen: El pipeline de imagen endurecido (detección por bytes, límites, WebP+PNG) se extrae a un módulo compartido reutilizado por marca y por el sello de fidelización; el rastreo de uploads temporales usa una tabla por entidad, no una tabla genérica, para no migrar las tablas de marca ya en producción.
estado: aceptada
---

# ADR 0029 — Módulo de assets compartido para imágenes en R2

## Contexto

La spec 0025 implementó un pipeline seguro de imágenes en R2 para el logo de marca:
detección de formato por bytes reales con `sharp`, límites de tamaño/dimensiones/píxeles,
variantes WebP + PNG, clave versionada, endpoint público inmutable, borrado diferido al
guardar y limpieza idempotente. La spec 0026 (diseño de sello) necesita **el mismo
endurecimiento** para la imagen del sello de un programa de Sellos. Duplicar ese pipeline
—que ya pasó por revisión independiente— sería frágil y divergiría con el tiempo. Además
`brand.ts` (420 líneas) supera el límite del hook `file-size`, así que reutilizar su lógica
obliga a dividirlo.

## Decisión

- **Pipeline de imagen compartido.** Se extrae la normalización endurecida (hoy `normalizeLogo`
  en `brand.ts`) a `server/assets/image.ts` como `normalizeImage(input, opts?)`: valida el
  formato real (`jpeg`/`png`/`webp`, SVG y tipos falsos rechazados con `422`), aplica
  `limitInputPixels` y el tope de 2048², y produce `{ webp, png }`. **Conserva el canal alfa**
  por defecto (decisión de 0026: la tarjeta pinta los recuadros en blanco). `opts.flatten`
  queda disponible para aplanar sobre un color si alguna superficie futura lo pide. Marca y
  sello usan esta única función; `brand.ts` se divide para consumirla y bajar de 300 líneas.
- **Primitivas de R2 reutilizadas tal cual.** `server/r2.ts` (firmado de subida, lectura
  acotada `readObjectAtMost`, `getPrivateObject`, `putLogoVariants`/put genérico, borrado) ya
  es genérico y se reutiliza; sólo se generalizan nombres de claves donde haga falta.
- **Rastreo de uploads temporales por entidad, no genérico.** En lugar de generalizar las
  tablas vivas de marca (`brand_asset_upload`, `brand_asset_cleanup`) —que ya están en
  producción y funcionando— se crea una tabla paralela `core.loyalty_asset_upload` (misma
  forma: id, businessId, programId, objectKey, contentType, byteSize, expiresAt, consumedAt) y
  se reutiliza la cola de limpieza. Es una decisión de **menor riesgo de migración**: no se
  toca una feature verificada para habilitar otra. El costo es una tabla casi idéntica; si
  aparece una tercera entidad con assets, se reconsiderará una tabla genérica con `scope`.
- **Almacenamiento del sello.** `core.loyalty_program.stamp_image_object_key` (ya reservado) +
  nueva columna `stamp_image_version` (entero, default 0, +1 en cada cambio) para invalidar
  caché. Claves definitivas no adivinables `loyalty/{businessId}/{programId}/{assetId}/stamp.{webp,png}`.
- **Borrado diferido idéntico a marca.** Subir o quitar sólo cambia el borrador; la promoción a
  la clave definitiva y el borrado de la versión anterior ocurren al guardar el programa
  (`PUT /api/loyalty-program` con `stampAction` `keep`/`replace`/`remove`), reusando el guard de
  estado (`active`) y la auditoría (`edited`). El cron `assets-cleanup` barre también los
  uploads y borrados pendientes de sellos.

## Consecuencias

- Una sola implementación endurecida de imagen: los arreglos de seguridad valen para marca y
  sello a la vez; no hay dos copias que diverjan.
- `brand.ts` queda dividido y bajo el límite de tamaño, con su comportamiento verificado por los
  tests existentes (unit + integración Neon).
- La tabla paralela evita una migración riesgosa sobre marca; a cambio hay algo de duplicación
  estructural, aceptada explícitamente y acotada a dos entidades.
- El sello reutiliza el endpoint público inmutable y la semántica de borrado diferido ya
  probadas, reduciendo superficie nueva.

## Relación

Implementa el pipeline reutilizable que la spec 0025 dejó anticipado ("R2 reutilizará este
pipeline en su propia spec") y habilita la spec 0026. No cambia el modelo de estados del
programa (ADR 0027) ni su auditoría (ADR 0028); el cambio de sello viaja dentro del guardado
del programa y su evento `edited`.
