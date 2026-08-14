---
spec: 0026
fecha: 2026-08-13
estado: en curso
resumen: El Owner sube el diseño de imagen del sello de un programa de Sellos, procesado y servido desde R2 con el mismo pipeline seguro de la marca y borrado diferido al guardar.
disjunta: no
archivos: apps/merchant, esquema/migraciones, R2, pruebas y docs
---

# 0026 — Diseño de sello del programa de fidelización en R2

## Problema

La modalidad **Sellos** del programa de fidelización (spec 0024) ya reserva
`stampImageObjectKey` en el modelo, pero **no existe UI para cargar el diseño del sello** ni
pipeline para subir/procesar/servir esa imagen. Hoy el campo se persiste como string libre sin
validación de formato (marcado como menor en la revisión de 0024). La spec 0025 difirió
explícitamente el logo de sellos a su propia spec: esta.

## Alcance

**Entra:**

- Input de imagen de sello en el **editor del programa**, visible sólo en la modalidad Sellos,
  con diseño consistente con el resto del formulario (mismo estilo de campos y botones).
- Reutiliza el pipeline R2 privado de la spec 0025: upload temporal con URL firmada de corta
  vida, procesamiento server con `sharp` sobre bytes reales, variantes WebP + PNG, clave
  versionada definitiva, endpoint público de lectura y limpieza idempotente de huérfanos.
- Formatos de entrada: **PNG, JPEG/JPG y WebP**; hasta 5 MB y 2048 × 2048 px; validación del
  formato real por bytes (nunca por el `Content-Type` del cliente); SVG rechazado.
- **Sin fondo transparente**: la alfa se aplana sobre fondo blanco al procesar, para un sello
  de aspecto sólido y consistente en la tarjeta. *(Decisión a confirmar con el Owner; ver
  «Abierto». Si se prefiere conservar transparencia es un cambio de una línea en el pipeline.)*
- **Borrado diferido, igual que la marca**: seleccionar una imagen nueva **no** elimina la
  anterior de R2; un botón **«Quitar»** marca la remoción en el borrador. El cambio efectivo
  (promover la nueva versión o borrar la anterior) ocurre **sólo al Guardar el programa**.
- Preview local, loading/error, toasts, mobile-first, accesibilidad y auditoría de la operación
  (el evento `edited` del programa ya cubre el guardado; se incluye el cambio de sello en su
  `details`).

**No entra:**

- Aplicar el sello en el wallet consumer o en la ficha pública (pertenece a las specs de
  consumer). Aquí sólo se expone la URL pública estable.
- Crop/edición visual, múltiples imágenes por programa, animaciones.
- Cambiar el modelo de estados del programa (spec 0024) ni sus términos.

## Decisiones de diseño

### Reutilización del pipeline (ADR aparte)

El procesamiento (`normalizeLogo` con `sharp`) y el firmado/claves de R2 (`server/r2.ts`) de la
0025 son genéricos. Lo específico de marca es el cableado a `businesses` y `brandAssetUploads`.
Se **extrae un módulo de assets reutilizable** (sesión de upload firmada + normalización +
promoción a clave versionada + borrado diferido + cleanup) parametrizado por entidad y prefijo
de clave, y el sello se apoya en él. Evita duplicar el endurecimiento ya revisado. La decisión
y su alcance van a un ADR.

### Esquema

`core.loyalty_program` gana metadata mínima del sello, análoga a la de marca:

```text
stamp_image_object_key?   (ya existe, reservado)
stamp_image_version       (entero, arranca en 0; +1 en cada cambio de imagen, para caché)
```

- `stamp_image_object_key` es interno, nunca una URL pública ni una autoridad del navegador.
- La clave definitiva sigue el patrón no adivinable
  `loyalty/{businessId}/{programId}/{assetId}/stamp.webp` y `.png`.

### Rutas

- `POST /api/loyalty-program/stamp-upload`: crea un upload temporal autorizado (owner + negocio)
  y devuelve una URL firmada limitada a `PUT`, TTL corto, tamaño y clave esperada.
- `PUT /api/loyalty-program`: el payload del programa acepta `stampAction`
  (`keep` | `replace` | `remove`) y, para `replace`, el identificador del upload temporal. Se
  valida y promueve como parte de la misma operación de guardado. Sólo Sellos.
- `GET /api/public/loyalty/{businessId}/{programId}/stamp?v={stampImageVersion}`: lectura
  pública de una variante existente, `Cache-Control: public, max-age=31536000, immutable`;
  `404` sin imagen/programa y sin enumerar claves R2.
- `GET /api/internal/assets-cleanup`: el cron existente (0025) también barre los uploads
  temporales y las eliminaciones pendientes de sellos.

### Invariantes production-grade (heredadas de 0025)

- Sólo el owner del negocio cambia el sello de su programa; ningún `business_id`/`program_id`
  ni clave R2 llega desde el navegador sin validarse contra el patrón interno.
- Una versión de sello tiene WebP y PNG o no se publica; la DB nunca referencia un asset
  parcialmente generado.
- La imagen anterior se elimina sólo después de persistir la nueva como vigente; si falla la
  promoción o el borrado, se conserva la referencia vigente y la limpieza idempotente reintenta.
- Validación real: 5 MB, magic bytes, PNG/JPEG/WebP, ≤ 2048², límite de píxeles anti-bomba,
  SVG rechazado.

## UI

```text
editor de programa (modalidad Sellos)
  └─ campo "Diseño del sello"
       ├─ preview (imagen vigente o borrador)
       ├─ botón "Subir imagen"  → valida, sube a R2 temporal, muestra preview local
       └─ botón "Quitar"        → marca remoción en el borrador
  (ningún cambio toca R2 definitivo ni la DB hasta "Guardar cambios")
```

El estilo del campo replica los del editor (`.loyalty-panel`, mismos labels/botones). En
modalidad Puntos el campo no aparece.

## Migración

1. Añadir `stamp_image_version` con default `0` y backfill trivial; `stamp_image_object_key` ya
   existe y queda como está (vacío en los programas actuales).
2. Constraint de versión `>= 0` representable en Drizzle.
3. Aplicar y verificar en Neon (rama aislada) antes de desplegar.

## Definition of Done

- [ ] En un programa de Sellos, el Owner sube una imagen (PNG/JPEG/WebP ≤ 5 MB, ≤ 2048²); el
  backend detecta el formato real, aplana la transparencia y genera WebP + PNG servidas por la
  URL pública sin exponer R2.
- [ ] SVG, tipo falso, imagen corrupta/sobredimensionada, clave ajena y payload inválido se
  rechazan con `422`/`403` correctos, con cobertura automatizada.
- [ ] Subir/Quitar no muta R2 ni la DB hasta Guardar; la imagen anterior sólo se elimina tras
  persistir el nuevo estado; hay limpieza idempotente de huérfanos.
- [ ] La modalidad Puntos no muestra el campo ni acepta sello por API.
- [ ] El campo es consistente con el resto del editor, responsive, accesible, con preview,
  loading, error y toasts.
- [ ] Migración aplicada/verificada en Neon; unitarias e integración (incluida la del pipeline
  de assets reutilizado) verdes; build pasa.
- [ ] PASS de revisor independiente antes de marcar `implementada`.

## Abierto

- **Transparencia**: la spec asume aplanar la alfa sobre **fondo blanco** («sin fondo
  transparente», pedido del Owner). Alternativas: conservar transparencia (alfa en WebP/PNG) o
  aplanar sobre un color de marca. Confirmar antes de implementar.
- **Endpoint público ahora vs. después**: se define la URL pública estable ya, aunque el wallet
  consumer que la consumirá llegue en otra spec.
