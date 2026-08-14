---
spec: 0025
fecha: 2026-08-12
estado: implementada
resumen: Owner edita identidad real de su negocio —nombre, colores, zona horaria y logo procesado en R2— desde Backoffice.
disjunta: no
archivos: apps/merchant, esquema/migraciones, R2, pruebas y docs
---

# 0025 — Marca real del negocio y assets en R2

## Problema

La pantalla de Marca actual es un demo en `sessionStorage`. El negocio real ya conserva
nombre, timezone y una referencia de logo, pero no contiene colores ni una forma segura de
subir, procesar, servir o reemplazar un logo. La identidad debe poder reutilizarse por el
Backoffice, consumer, la futura web pública y los perfiles de negocio/local sin depender de
una URL temporal o de un dominio propio.

## Alcance

**Entra:**

- Ruta real `/backoffice/brand` para el Owner autenticado.
- Leer y editar nombre, colores primario/complementario/acento, timezone IANA y logo.
- R2 privado para los objetos originales y las variantes derivadas del logo.
- PNG, JPEG y WebP de hasta 5 MB; validación del formato real, límite 2048 × 2048 px y
  rechazo de SVG.
- Procesamiento servidor: una variante WebP optimizada y una variante de respaldo compatible
  (PNG). Se conserva el original sólo durante el procesamiento; el objeto final no conserva
  formatos no necesarios.
- Endpoint público de lectura estable por negocio/variante, con caché inmutable y sin exponer
  R2 ni sus credenciales. La futura web pública y consumer consumen la misma URL de asset.
- Reemplazo y eliminación diferidos: seleccionar/quitar un logo sólo cambia el borrador de
  la UI. El cambio efectivo y la eliminación del objeto anterior ocurren al guardar.
- Toas​ts, loading/error, preview local, diseño mobile-first, accesibilidad y auditoría de
  operaciones relevantes.

**No entra:**

- SVG, portada, imágenes de locales, edición/crop visual, CDN/dominio personalizado,
  branding aplicado a consumer o perfil público, y multi-negocio en UI.
- Logo de sellos: R2 reutilizará este pipeline en su propia spec.

## Decisiones de diseño

### Identidad y esquema

`core.business` conserva:

```text
id, name, country_code, timezone,
brand_primary_color, brand_complementary_color, brand_accent_color,
logo_object_key?, logo_version, updated_at
```

- Colores obligatorios `#RRGGBB`; valores iniciales explícitos y consistentes con la UI
  existente. `logo_version` cambia en cada guardado de logo para invalidar caché.
- `logo_object_key` es un detalle interno, nunca una URL pública ni una autoridad enviada por
  navegador.
- La timezone se valida como IANA. Cambiarla afecta las futuras fechas locales; no transforma
  timestamps UTC ya persistidos.

### R2 y rutas públicas

R2 permanece privado. El servidor construye claves internas no adivinables, por ejemplo:

```text
brands/{businessId}/{assetId}/logo.webp
brands/{businessId}/{assetId}/logo.png
```

El objeto final nunca se consulta directamente desde browser. La app Merchant expone:

```text
GET /api/public/brands/{businessId}/logo?v={logoVersion}
```

La respuesta negocia WebP con `Accept` y usa PNG como respaldo. Usa `Cache-Control: public,
max-age=31536000, immutable`, `Content-Type` correcto y la versión por query para invalidar
CDN/cache. La carga temporal sí usa una URL firmada, de corta vida y sólo `PUT`; por ello R2
necesita CORS limitado al origen de Merchant. Cualquier aplicación futura del monorepo puede
usar este endpoint; sólo una futura decisión de infraestructura podrá moverlo a un dominio de
media sin persistir URLs ni cambiar el modelo de datos.

### Subida, procesamiento y guardado

1. La UI valida tamaño/extensión para feedback, conserva preview local y solicita una sesión
   de carga autorizada. No recibe credenciales R2.
2. El servidor verifica owner + negocio, crea un upload temporal de vida corta y entrega una
   URL firmada limitada a esa clave y tipo esperado.
3. Tras subir, la UI envía el identificador temporal dentro del borrador de Marca. El servidor
   descarga el objeto, detecta bytes/formato real, limita dimensiones/píxeles y procesa WebP
   + PNG con límites de memoria/tiempo. Nunca confía en MIME, nombre ni dimensiones del cliente.
4. En `PUT /api/brand`, el servidor valida todos los campos y promueve ambos derivados a la
   clave versionada definitiva. Actualiza la fila de negocio sólo después de que ambos objetos
   estén disponibles.
5. Después de persistir exitosamente, elimina las claves definitivas de la versión anterior.
   Si falla la promoción o base, conserva el logo anterior; un proceso de limpieza borra
   uploads temporales vencidos/orfanados.
6. Quitar logo se expresa como `logoAction: remove`; al guardar, primero se actualiza DB y
   después se elimina la versión anterior. Si falla la limpieza, queda una tarea idempotente
   de reintento: nunca se pierde la referencia al logo vigente.

Un logo de 2048 × 2048 px es suficiente para avatar/ficha pública y pantallas retina; el
pipeline limita adicionalmente el número de píxeles antes de decodificar para defensa ante
imágenes-bomba.

### Contratos

- `GET /api/brand`: devuelve solamente la marca del negocio del Owner de sesión, incluido
  `logoPath` derivado por servidor y nunca `logo_object_key`.
- `POST /api/brand/logo-upload`: crea upload temporal autorizado; acepta metadatos limitados.
- `PUT /api/brand`: aplica nombre, colores, timezone y `logoAction` (`keep`, `replace`,
  `remove`) como operación coherente. Payload malformado = `422`; conflicto de edición =
  `409`; no se acepta `business_id` desde el navegador.
- `GET /api/public/brands/[businessId]/logo`: lectura pública sólo de una variante existente;
  `404` sin logo/negocio y sin enumerar claves R2.
- `GET /api/internal/assets-cleanup`: cron con `CRON_SECRET` que elimina uploads temporales
  vencidos y reintenta eliminaciones pendientes.

## Invariantes production-grade

- Sólo owner del negocio puede cambiar su marca; staff, otro owner y payload manipulado no
  pueden apuntar a otro `business_id` ni a una clave de R2 arbitraria.
- Una versión de logo tiene WebP y PNG, o no se publica; la DB nunca referencia un asset
  parcialmente generado.
- El logo anterior sólo se elimina después de que el nuevo esté persistido como vigente.
- Claves temporales no son servibles públicamente y expiran; claves finales se validan contra
  el patrón interno antes de leer/eliminar.
- Validación real: 5 MB en `Content-Length` y streaming; magic bytes; PNG/JPEG/WebP;
  dimensiones <=2048; límite de píxeles/recursos; SVG rechazado explícitamente.
- El color se normaliza a mayúsculas `#RRGGBB`; timezone es IANA válida; nombre tiene límites
  de longitud y se normaliza whitespace.
- `updated_at`/versión de marca proveen control optimista: un guardado obsoleto recibe `409`,
  nunca un éxito falso.
- R2 credentials son server-only; la URL firmada de subida restringe método (`PUT`), TTL corto
  y clave. El **tamaño** no se firma en la URL sino que se enforcea en el servidor al procesar
  (`readObjectAtMost` corta la lectura a 5 MB → `422`); el riesgo residual es sólo almacenamiento
  transitorio en R2, acotado por el `expiresAt` del upload y el cron de limpieza. Ningún secreto
  llega a `NEXT_PUBLIC_*`.

## Migración

1. Añadir columnas de colores nullable con defaults explícitos; backfill de negocios actuales.
2. Añadir `logo_version` inicial y metadata mínima de operaciones de asset pendientes si es
   necesaria para reintentos.
3. Validar backfill, convertir colores y timezone a `NOT NULL` donde corresponda y crear
   constraints de color/patrón/versión representables en Drizzle.
4. No se toca `logo_object_key` actual: está vacío en desarrollo. Si aparece una clave previa,
   permanece no pública hasta migración manual/validada.

## Archivos esperados

| Área | Acción |
|---|---|
| `schema.ts`, `drizzle/`, snapshots | modelo de marca, constraints y migración reproducible |
| `server/brand.ts` | contrato, autorización, control optimista, normalización y servicio de marca |
| `server/assets/r2.ts`, `server/assets/image.ts` | R2, signing, claves, detección y procesamiento seguro |
| `app/api/brand/**`, `app/api/public/brands/**`, cron | contratos privado/público e idempotencia |
| `app/backoffice/brand/**`, componentes UI | página real y borrador sin mutación prematura |
| `vercel.json`, `.env.example`, deploy docs | cron y variables documentadas sin secretos |
| unit/integration/E2E | cobertura del contrato y flujos reales |

## Definition of Done

- [x] Owner edita nombre, tres colores y timezone IANA de su negocio real. Verificado con QA
  manual en vivo sobre el deploy de Vercel (2026-08-12).
- [x] Owner carga PNG/JPEG/WebP <=5 MB y <=2048²; backend detecta formato real, genera WebP y
  PNG, y sirve ambas variantes públicas sin exponer R2. Verificado con QA manual en vivo.
- [x] SVG, tipo falso, imagen corrupta/sobredimensionada, clave ajena y payload inválido son
  rechazados con `422`/`403` correctos. Cobertura automatizada (2026-08-13): `normalizeLogo`
  rechaza SVG (renombrado o no), imagen corrupta y > 2048² con `422` (`brand.test.ts`);
  autorización sin negocio → `403` y payload malformado → `422` en la integración Neon; el
  `business_id` nunca llega desde el navegador (derivado de la sesión).
- [x] Seleccionar/quitar/reemplazar no muta nada hasta Guardar; el logo anterior sólo se
  elimina tras persistir exitosamente el nuevo estado y hay limpieza idempotente de huérfanos.
  Verificado con QA manual en vivo (guardar/reemplazar el logo real).
- [x] Control optimista implementado: `UPDATE … WHERE brand_revision = revision` → `409`
  ante guardado obsoleto, nunca éxito falso (`brand.ts:316-343`). **A futuro** (decisión del
  owner 2026-08-13): la prueba de concurrencia real con dos guardados simultáneos queda
  diferida hasta que exista más de un owner por negocio (no habrá hasta dentro de meses).
- [x] La página es responsive, accesible, con preview, loading, errores y toasts reutilizables.
  Verificado con QA manual en vivo.
- [x] Migración aplicada/verificada en Neon; R2 privado configurado. Integración Neon del
  servicio de marca **verde** contra rama aislada efímera (2026-08-13): control optimista
  `409` en guardado obsoleto, autorización `403` y payload `422`. Format, lint, typecheck y
  unit pasan; build vía Vercel en cada push. Residual: no existe E2E de `brand` automatizado
  (el camino feliz de subida/serrado se cubrió con QA manual en vivo del owner).

## Enmienda 2026-08-13 — Revisión independiente

Una revisión independiente (`AGENT-WORKFLOW.md`) confirmó el núcleo de seguridad —validación por
bytes reales con `sharp` (SVG/tipo falso/corrupta/bomba → `422`), aislamiento multi-tenant (el
negocio se deriva de la sesión; ninguna clave R2 viene del navegador), atomicidad de assets (una
versión tiene WebP y PNG o no se publica; el logo anterior se borra sólo tras persistir; cola de
limpieza idempotente) y control optimista (`409`)— y devolvió FAIL estrecho por tres defectos, ya
resueltos:

- **Fuga de `logo_object_key`**: `GET`/`PUT /api/brand` serializaban el objeto completo,
  violando la invariante escrita. Ahora la ruta responde un DTO que omite la clave interna y sólo
  expone `logoPath` público.
- **JSON malformado → `503`**: `PUT /api/brand` y `POST /api/brand/logo-upload` parseaban el body
  dentro del `try` genérico. Ahora un cuerpo inválido devuelve `400`, no un falso 503.
- **Tests ausentes**: se agregaron unitarios de `normalizeLogo` (SVG renombrado y > 2048² → `422`)
  e integración Neon del servicio (`409` optimista, `403` sin negocio, `422` malformado), verde
  contra una rama aislada efímera.
- **Menor**: un `businessId` con formato válido pero UUID inválido daba `500` en la ruta pública;
  ahora la llamada está dentro del `try` → `404` limpio.

Queda documentado que la URL firmada no restringe el tamaño en la firma (se enforcea server-side)
y que la prueba de concurrencia real es **a futuro** (ver DoD).

## Variables requeridas

```text
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
R2_ENDPOINT                 # https://<account-id>.r2.cloudflarestorage.com
R2_REGION=auto
CRON_SECRET
```

No se requiere dominio propio. El dominio temporal de Vercel sirve los endpoints públicos y
las URLs firmadas de subida se generan desde el servidor.

## Preguntas cerradas

- No se permite SVG.
- Límite de carga: 5 MB.
- Formatos de entrada: PNG, JPEG y WebP.
- Límite visual: 2048 × 2048 px.
- Salida: WebP optimizado + PNG de respaldo.
- Reemplazo/remoción sólo toman efecto al guardar.
