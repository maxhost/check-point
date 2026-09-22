---
spec: 0090
fecha: 2026-09-21
estado: cerrada
resumen: Importacion asistida de catalogo desde 1-10 fotos o un PDF de hasta 10 paginas. Subida temporal firmada a R2; el analisis NO corre en nuestra funcion —el adaptador lo delega en el proveedor (`background: true`) y lo retomamos por un callback firmado, con un reconciliador externo para el webhook perdido—; borrador persistido y revisable, resolucion explicita de duplicados y precios ambiguos, y aceptacion idempotente que crea categorias y productos en bulk dentro de una transaccion. Un analisis por negocio por dia, centralizado en entitlements, y los fallos no consumen cupo. SIN UI: la pantalla la construye el owner por fuera con `specs/0090-contratos-de-api.md`.
disjunta: no
archivos: apps/merchant/src/server/schema/catalog-import.ts, apps/merchant/src/server/catalog-import/**, apps/merchant/src/server/entitlements/catalog.ts, apps/merchant/src/app/api/catalog/imports/**, apps/merchant/src/app/api/internal/catalog-imports/**, apps/merchant/drizzle, .github/workflows, tests
---

# 0090 — Importacion de catalogo desde imagen o PDF

> **Nada de codigo empieza sin esta spec en `cerrada`.** Diseno en ADR 0082 **y su enmienda del
> 2026-09-21 (§8-§12)**, que es donde viven las seis decisiones que esta version incorpora.

## Problema

El CRUD de catalogo existe (spec 0034), pero cargar un menu inicial exige repetir a mano la
estructura que el comercio ya tiene en papel, fotos o PDF. Hace falta una API estable —consumible
por la web y por una app movil— sin permitir que una extraccion probabilistica escriba directo en
el catalogo.

**Esta es la segunda version de la spec.** La primera se reviso contra el arbol antes de
implementarla y tenia siete bloqueantes y tres afirmaciones de mecanismo falsas. Lo que cambio y
por que esta en la enmienda del ADR 0082; lo que sigue ya esta corregido.

## Alcance

**Entra:**

- Una importacion recibe **un PDF** o **1-10 imagenes** de paginas (JPEG, PNG, WebP, HEIC/HEIF).
- Subida directa firmada a R2 privado; originales temporales, nunca activos del negocio.
- Normalizacion de imagenes antes del proveedor; conteo de paginas del PDF **sin dependencias**.
- Analisis **delegado al proveedor** y retomado por callback firmado, con reconciliador.
- Contrato `CatalogExtractionProvider` con forma **diferida**, adaptadores `fake` y `openai`.
- Borrador persistido, editable y versionado; deteccion conservadora de duplicados.
- Aceptacion idempotente y transaccional que crea categorias y productos en bulk.
- Email al merchant cuando el borrador queda listo (o cuando falla).
- Limite de analisis por negocio **centralizado en el catalogo de entitlements**, con ventana.
- Metricas de uso, duracion y resultado, sin contenido del menu.

**No entra:**

- **La UI.** No se toca un solo `.tsx`. El contrato para quien construya la pantalla es
  `specs/0090-contratos-de-api.md` (ADR 0070: el arco del alta entrega API y endpoints).
- Extraer o recortar fotografias de productos desde el menu.
- Precio de costo, disponibilidad por local, edicion masiva posterior.
- Modificar, fusionar o borrar entidades existentes del catalogo.
- Cuotas por plan, cobro por uso o limite comercial (ADR 0082 §7).
- OCR propio, fine-tuning, fallback automatico entre proveedores.
- Adaptadores Anthropic/Kimi: el contrato los admite sin tocar el dominio, pero no se escriben acá.
- Inventario, variantes, descripciones, impuestos, promociones.
- Web push al merchant (el aviso de esta spec es email; el push es otra feature).

## Diseno

### 1. Flujo, estados y quien mueve cada transicion

```text
POST /imports            -> pending_upload   (reserva + URLs firmadas)
PUT a R2 (el cliente)
POST /imports/:id/analyze-> 202 + queued     ... y dentro de after(): prepara, submitea, analyzing
callback del proveedor   -> ready | failed   (verifica firma, busca el resultado, valida, persiste)
reconciliador (*/5)      -> rescata queued viejos y analyzing con lease vencido
POST /imports/:id/accept -> accepted         (transaccion + borrado de originales)
```

| Estado | Significado | Transiciones permitidas |
|---|---|---|
| `pending_upload` | reserva creada; faltan archivos | `queued`, `cancelled`, `expired` |
| `queued` | uploads confirmados; falta submitear al proveedor | `analyzing`, `failed`, `cancelled`, `expired` |
| `analyzing` | submiteado; `provider_job_id` guardado | `ready`, `failed`, `cancelled`, `expired` |
| `ready` | borrador revisable | `accepted`, `cancelled`, `expired` |
| `accepted` | catalogo creado | terminal |
| `failed` | fallo con error saneado; un nuevo intento crea otro import | terminal |
| `cancelled` | cancelado por el merchant | terminal |
| `expired` | vencio | terminal |

**`analyzing` NO es un pozo, y esto es correccion de un bloqueante:** lleva `lease_until`. Un
worker o un `after()` que muere no deja al negocio sin poder importar nunca mas — el reconciliador
lo vuelve a `queued` (hasta `max_attempts`) o lo cierra en `failed`. El precedente propio es
`wallet_push_queue` clavado en `sending` y re-reclamado para siempre.

**Cancelar durante `analyzing` es explicito:** escribe `cancel_requested_at` **y** deja el estado
en `analyzing`; el callback o el reconciliador, al llegar, descartan el resultado y cierran en
`cancelled` limpiando los originales. `DELETE` sobre `pending_upload|queued|ready` pasa a
`cancelled` directo.

Solo puede existir **un import no terminal por negocio** (indice unico parcial). Crear otro
responde `409 catalog_import_in_progress`. Los estados terminales nunca retroceden.

### 2. Limites, preparacion y conteo de paginas

- Un PDF: maximo **20 MB** y **10 paginas**. Imagenes: **1-10**, **10 MB cada una**, **50 MB total**.
- Maximo **250 productos** en un borrador; excederlo **falla explicitamente**, no trunca.
- Los tipos se detectan **por bytes** (`server/assets/image.ts` ya lo hace con `sharp`); la
  extension y el `content-type` del cliente no son autoridad.
- GIF, SVG, ofimaticos y PDF cifrado/protegido se rechazan.
- Imagenes: se corrige orientacion, se convierte a JPEG, lado mayor 2048 px. **Secuencialmente,
  nunca `Promise.all`**: con `MAX_INPUT_PIXELS_FALLBACK` (50 MP) diez decodificaciones en paralelo
  son ~2 GB de pixeles.
- **El PDF se cuenta con `node:zlib`, sin dependencias** (ADR 0082 §11): se rechaza si hay
  `/Encrypt` en el trailer; se inflan los streams y se toma el **maximo** de dos senales —objetos
  `/Type /Page` y el `/Count` del nodo raiz—. **Si ninguna senal da nada, se rechaza**
  (`422 unsupported_catalog_file`): fallar cerrado es el punto, porque el escaneo naive devuelve
  **0** en un PDF con `/ObjStm` y un documento de 400 paginas pasaria un check de `<=10`.
- **Limite declarado del contador:** no valida que el PDF sea renderizable, ignora object streams
  con compresion no-Flate, y un menu que contuviera el texto literal `/Type /Page` se sobre-cuenta.
  Las tres fallan del lado seguro (rechazan un archivo valido; no dejan pasar uno grande).

Estos son limites del producto. No se elevan porque un proveedor tolere mas.

### 3. Modelo de datos

`core.catalog_import`:

```text
id uuid pk
business_id uuid not null -> core.business on delete cascade
created_by_user_id text not null
status text not null check (conjunto cerrado de §1)
source_kind text not null check ('pdf','images')
file_count integer not null
page_count integer nullable
draft jsonb nullable
draft_version integer not null default 0
provider text nullable
model text nullable
prompt_version text nullable
schema_version text nullable
provider_job_id text nullable            -- el id diferido del proveedor
provider_request_id text nullable        -- diagnostico; NUNCA al DTO publico
input_tokens integer nullable            -- integer, no bigint: el driver devuelve bigint como STRING
output_tokens integer nullable
duration_ms integer nullable
attempt_count integer not null default 0
lease_until timestamptz nullable         -- sin esto, `analyzing` es un pozo
cancel_requested_at timestamptz nullable
notified_at timestamptz nullable         -- el email sale UNA vez por import
accepted_summary jsonb nullable          -- {categoriesCreated, productsCreated, productsWithoutPrice}
failure_code text nullable
failure_detail text nullable             -- saneado: sin prompt, archivo ni secreto
created_at, updated_at, expires_at timestamptz not null
accepted_at, cancelled_at, cleaned_at timestamptz nullable
```

Indices: unico parcial de **un import no terminal por `business_id`**; unico `provider_job_id`
cuando no es null (es la llave con la que entra el callback); indice por `status, lease_until` para
el reconciliador. **No hay columna de idempotency key**: la idempotencia del `accept` sale del lock
del import mas su estado `accepted` (ADR 0082 §13.3).

`core.catalog_import_file`:

```text
id uuid pk
import_id uuid not null -> catalog_import on delete cascade
business_id uuid not null
position integer not null
original_name text not null
declared_content_type text not null
byte_size integer not null
object_key text not null                 -- jamas cruza al cliente
status text not null check ('reserved','uploaded','validated','deleted')
created_at, uploaded_at, deleted_at timestamptz
unique(import_id, position)
```

`core.catalog_import_cleanup`: cola de reintento propia, misma forma que
`core.product_asset_cleanup` (`object_key` unico, `attempt_count`, `not_before`, `last_error`). **No
se reusa esa tabla**: su worker borra por *prefijo de producto* (`deleteProductPrefix`), no por
clave arbitraria.

El `object_key` lleva business/import/file en UUID no adivinables.

### 4. Contrato del proveedor, con forma diferida

```ts
type ExtractedProduct = {
  sourceId: string;
  name: string;
  /** Decimal en STRING, como todo el dinero de este repo (`numeric(12,2)`). `null` = sin precio. */
  unitPrice: string | null;
  priceStatus: "detected" | "ambiguous";
  sourceText: string | null;
};

type ProviderExtraction = {
  categories: Array<{ sourceId: string; name: string; products: ExtractedProduct[] }>;
  warnings: string[];
  usage: { inputTokens: number | null; outputTokens: number | null };
  providerRequestId: string | null;
};

type StartResult =
  | { kind: "completed"; extraction: ProviderExtraction }
  | { kind: "deferred"; jobId: string };

interface CatalogExtractionProvider {
  readonly id: string;
  /** Submitea. El adaptador decide si contesta ya o delega. */
  start(input: CatalogExtractionInput): Promise<StartResult>;
  /** Solo los diferidos. `pending` es una respuesta valida, no un error. */
  poll?(jobId: string): Promise<
    | { status: "pending" }
    | { status: "done"; extraction: ProviderExtraction }
    | { status: "failed"; code: string }
  >;
  /** Solo los diferidos. Devuelve el jobId si la firma es valida; `null` si no. */
  verifyCallback?(headers: Headers, rawBody: string): { jobId: string } | null;
}
```

**La plata va en string decimal**, no en `number`: el resto del repo maneja `numeric(12,2)` con
`parseOptionalMoney` → `toFixed(2)` (`server/catalog/validation.ts:22-38`) y esa funcion se reusa,
no se escribe una segunda representacion del dinero.

`sourceId` es opaco y unico dentro del resultado; **nunca** se usa como id de base. Los nombres
pasan por los limites del catalogo (**producto 120, categoria 60** — `validation.ts:111,152`) y se
sanean: sin caracteres de control, espacios colapsados. `warnings` lleva tope de cantidad y largo.
La salida **siempre** se valida contra un esquema cerrado propio, aunque el proveedor prometa JSON
Schema; y **el documento del merchant es entrada no confiable: su texto es dato, nunca instruccion**
(el adaptador no habilita tools).

Configuracion de servidor:

```text
CATALOG_EXTRACTION_PROVIDER=fake|openai
CATALOG_EXTRACTION_MODEL=<modelo del adaptador>
CATALOG_EXTRACTION_PROMPT_VERSION=v1
OPENAI_API_KEY=<secreto, solo si provider=openai>
OPENAI_WEBHOOK_SECRET=<whsec_..., solo si provider=openai>
```

Sin proveedor o clave valida, el import termina `failed` con `provider_unavailable` y el resto del
catalogo sigue funcionando. **No hay fallback silencioso.**

### 5. Forma del borrador

```jsonc
{
  "version": 3,
  "categories": [{
    "draftId": "opaque",
    "name": "Bebidas calientes",
    "resolution": { "kind": "create" },   // use_existing+categoryId | uncategorized | discard
    "duplicateCandidate": { "categoryId": "uuid", "name": "Bebidas calientes" },
    "products": [{
      "draftId": "opaque",
      "name": "Cappuccino",
      "unitPrice": null,
      "priceStatus": "ambiguous",
      "sourceText": "Cappuccino $3,5?",
      "include": true,
      "duplicateCandidate": { "productId": "uuid", "name": "Cappuccino" }
    }]
  }],
  "warnings": []
}
```

**Precios — DOS estados, y ninguno bloquea (ADR 0082 §9 enmendada):**

- `detected` → `unitPrice` con el valor leido, string decimal.
- `ambiguous` → **`unitPrice: null`** y el `sourceText` con lo que el modelo vio. Cubre las dos
  situaciones que antes eran dos estados: el menu no dice el precio, y el modelo no pudo confirmar
  lo que leyo.

**`ambiguous` NO bloquea `accept`**, y la razon es que ya no entra un valor incorrecto: entra
`null`, que es un estado legal del catalogo. El bloqueo de la §6 original existia porque ahi el
precio dudoso se normalizaba a **`0`** — cero es un precio **falso que parece valido**. Con `null`
no hay nada que proteger, y bloquear volveria inimportable justo el menu que mas necesita la
feature. **No existe `priceConfirmed`**: existia solo para desbloquear.

**Duplicados:** igualdad de `lower(trim(name))` dentro del negocio, **la misma normalizacion que el
indice real** `core_product_category_name_unique` sobre `lower(name)` (`schema/catalog.ts:30-33`),
sabiendo que las categorias nuevas se guardan trimmeadas (`validation.ts:151`) y que una fila vieja
con espacios al borde es el unico caso donde las dos normalizaciones difieren. No hay fuzzy merge.
`duplicateCandidate` es **aviso**: para producto, `include:false` lo descarta e `include:true` crea
uno nuevo aunque haya candidato. Para categoria:

- `create`: crea nueva; si el nombre sigue duplicado al aceptar, es conflicto.
- `use_existing`: exige `categoryId` del mismo negocio.
- `uncategorized`: sus productos incluidos nacen sin categoria.
- `discard`: exige que cada producto este `include:false` o reasignado a otra categoria del
  borrador. **No se pierden productos implicitamente.**

### 6. API publica

Todas las rutas de `/api/catalog/imports/*` pasan por `requireApiPermission(request, "catalog")` —owner siempre, integrante con
el toggle— reusando `api/catalog/_auth.ts`. Ningun `businessId`, `objectKey`, proveedor, modelo ni
costo se elige desde el cuerpo.

**Los errores llevan `code`, y eso es trabajo nuevo:** el `catalogError` actual
(`api/catalog/_auth.ts`) devuelve **`{error}` pelado**. Nace un `CatalogImportError` con `code` y su
responder, sin tocar las seis rutas que ya usan el viejo. Forma:
`{ "error": "copy en espanol", "code": "estable" }`.

El detalle de cada ruta, con cuerpos y la lista cerrada de `code`, es **normativo en
`specs/0090-contratos-de-api.md`**. Acá quedan solo las reglas que el implementador necesita:

| Ruta | Regla que no se deduce |
|---|---|
| `POST /api/catalog/imports` | Valida cantidad/tamano declarados y que sea **un PDF o solo imagenes**, nunca mezcla. Devuelve las URLs firmadas. Chequea el cupo (§8). **Se APROPIA de un import abandonado en `pending_upload`** —lo cancela y crea el nuevo— porque la pantalla real cierra el modal sin llamar a `DELETE` y sin esto el merchant queda trabado hasta que venza (ADR 0082 §13.2). En `queued`/`analyzing`/`ready` responde `409 catalog_import_in_progress`: hay trabajo pago en vuelo, y descartar un `ready` **quema el analisis del dia**. |
| `POST /api/catalog/imports/{id}/uploads` | **Re-firma** los archivos que siguen en `reserved`, solo en `pending_upload`. Existe porque una URL firmada dura ~10 min y 50 MB por datos moviles puede pasarse: sin esta ruta, una subida cortada obliga a empezar el import de cero. **No** cambia `position` ni crea filas. |
| `POST /api/catalog/imports/{id}/analyze` | **Barato y sincronico:** lee solo la **cabecera** de cada objeto (`readObjectAtMost` con tope chico) para sniffear bytes y poder contestar `422` en el momento; marca los uploads, pasa a `queued`, responde **202**, y **dentro de `after()`** prepara (normaliza / cuenta paginas), submitea y pasa a `analyzing`. Repetir en `queued|analyzing|ready` devuelve el estado actual **sin** otra llamada al proveedor. |
| `GET /api/catalog/imports` | Devuelve el **unico import no terminal** del negocio o `{ "import": null }`. Es como la pantalla retoma despues de un reload sin guardar nada en el cliente; misma allow-list que la de abajo. |
| `GET /api/catalog/imports/{id}` | Allow-list. **No** devuelve `objectKey`, `provider_job_id`, `provider_request_id`, tokens, costo ni respuestas crudas. En `failed`, `error` es `{code,message}` saneado. |
| `PUT /api/catalog/imports/{id}/draft` | Solo en `ready`. Optimistic locking por `draft_version`. Revalida ids del negocio, nombres, precios, tope de 250 y resoluciones. |
| `POST /api/catalog/imports/{id}/accept` | Transaccion + `SELECT ... FOR UPDATE` del import. Ver §7. |
| `DELETE /api/catalog/imports/{id}` | Cancela; en `analyzing` escribe `cancel_requested_at` (§1). `accepted` responde `409 catalog_import_already_accepted`. **Nunca toca catalogo.** |

**`accept` no exige cuerpo** (ADR 0082 §13.1): opera sobre el borrador tal como esta guardado, y
`version` es **opcional** — si viene, se valida; si no, no hay nada que comparar porque nadie edito.
En orden, bajo el lock:

1. verifica `ready` y, si vino, `draft_version`;
2. revalida candidatos y resoluciones contra el catalogo **actual**;
3. crea cada categoria `create` una vez y resuelve `use_existing`;
4. crea los productos incluidos con `unitCost:null`, sin imagen, `availableAllLocations:true` y
   **cero** filas `product_location`;
5. escribe `accepted`, `accepted_at` y `accepted_summary` (con `productsWithoutPrice`);
6. **despues del commit**, encola el borrado de originales.

**201** la primera vez; **200** con el mismo `accepted_summary` en cualquier repeticion — la
idempotencia **la da el lock mas el estado `accepted`, no una clave del cliente**, asi que un doble
clic no puede crear el catalogo dos veces ni depende de que la pantalla haga algo bien. Una unicidad
violada al crear categoria se traduce
con el helper que ya existe (`isUniqueViolation`, `server/catalog/categories.ts:7-14`) a `409
catalog_import_conflict` — **un 23505 no se escapa como 500**.

### 7. Callback del proveedor, reconciliador y limpieza

**`POST /api/internal/catalog-imports/provider-callback`** — entrada **publica y no autenticada por
sesion**. En este orden, sin excepcion:

1. **verifica la firma antes de cualquier otra cosa** (`verifyCallback` del adaptador: HMAC-SHA256
   sobre `id.timestamp.body` con `node:crypto`, header `v1,<firma>`, secreto `whsec_` en base64);
2. rechaza si `webhook-timestamp` esta fuera de una tolerancia de **5 minutos** (replay);
3. toma **solo el id** del payload y lo resuelve contra `provider_job_id`. **Un id desconocido
   responde 200 y se ignora** (no filtra existencia ni deja al proveedor reintentando para siempre);
4. **va a buscar el resultado a la API del proveedor.** El cuerpo del webhook no se cree;
5. valida contra el esquema propio, enriquece duplicados, persiste el borrador, pasa a `ready`,
   registra tokens/duracion y **manda el email** si `notified_at` es null;
6. si hay `cancel_requested_at`, o el import ya salio de `analyzing`, es **no-op idempotente**.

**`POST /api/internal/catalog-imports/reconcile`** — con el `CRON_SECRET` que ya usan las internas.
Reclama con `FOR UPDATE SKIP LOCKED` y:

- `queued` viejo (el `after()` murio antes de submitear) → prepara y submitea;
- `analyzing` con `lease_until` vencido → `poll(jobId)`; `pending` renueva el lease, `done`
  persiste, `failed` cierra;
- agotado `max_attempts` → `failed` con codigo saneado;
- `cancel_requested_at` → cierra en `cancelled` y limpia.

Lo dispara un workflow nuevo en `.github/workflows/` cada 5 minutos, con el patron ya usado por
`wallet-push-cron.yml`: secret `CATALOG_IMPORT_RECONCILE_ENDPOINT` **con `www.`** (el apex hace 308
y el `curl` no lleva `-L`). **No** se agrega un cron a `vercel.json`: los dos que hay son el maximo
del plan y un tercero hace que Vercel rechace el deploy entero.

**Limpieza**, colgada del `assets-cleanup` diario que ya existe: expira los no terminales con
`expires_at <= now()`, borra cada objeto de forma idempotente, marca los archivos `deleted` y el
import `cleaned_at` solo al completar, y reintenta lo pendiente sin tocar catalogo. Al aceptar o
cancelar, el borrado se intenta **en el momento** y cae a la cola si falla (patron
`cleanupProductPrefixNow`). `expires_at` se calcula desde `created_at` y **se extiende al pasar a
`ready`**, para que revisar un menu largo no venza mientras se revisa.

### 8. El limite de analisis, centralizado

Vive en el catalogo de `server/entitlements/`, junto a `locations.max`, con **ventana** ademas de
`byPlan`, porque el requisito del owner es poder moverlo (1/dia → 10/semana → 5/mes por plan) sin
tocar codigo:

```text
"catalog.imports.analyses"  -> { window: "day", byPlan: { none: 1, free: 1, plus: 1 } }
"catalog.imports.attempts"  -> { window: "day", byPlan: { none: 3, free: 3, plus: 3 } }
```

- **`analyses` lo consume solo un analisis que llego a `ready`.** Un fallo del proveedor o nuestro
  **no** le cuesta el dia al merchant (decision del owner, ADR 0082 §10).
- **`attempts`** cuenta todo submit al proveedor, para que un loop de fallos no queme plata.
- Se cuentan filas de `catalog_import` en la ventana; no nace tabla de contadores.
- Excedido: **`429 catalog_import_rate_limited`** con `retryAfterSeconds` en el cuerpo y el header
`Retry-After` — la pantalla no hardcodea el cupo, muestra lo que le devuelve el servidor.

No es cuota comercial (ADR 0082 §7 sigue en pie): es un control operativo, y hace falta porque el
guard compartido **no tiene rate limit** (`api-permission.ts` / `api-owner.ts`: ni una linea).

### 9. Seguridad, privacidad y observabilidad

- Aislamiento por `business_id` de import, files, categorias y candidatos. **Lo ajeno devuelve el
  mismo 404 que lo inexistente.**
- **La URL firmada ata la clave y el `content-type`, NO el tamano.** `createTemporaryUploadUrl`
  (`server/r2.ts:72-95`) firma un `PutObjectCommand` sin `ContentLength`, asi que **lo que protege
  es el tope de lectura del servidor**, no la firma — y la prosa de esta spec no dice lo contrario.
  Ademas ese helper **rechaza hoy todo `byteSize > 5 MB`** (`MAX_LOGO_BYTES`, `r2.ts:9`): hay que
  **parametrizar el tope** o esta feature no puede firmar ni una foto de 10 MB.
- Deteccion por bytes, lectura acotada, tope de paginas y guarda de bomba de decodificacion.
- Secretos solo en entorno (ADR 0024). `OPENAI_WEBHOOK_SECRET` se compara en tiempo constante.
- Evento estructurado por transicion: `importId`, negocio, estado, duracion, proveedor/modelo,
  tokens. **Jamas el documento, ni los nombres de los productos.**
- Metricas: creados / ready / accepted / failed / expired, latencia p50-p95, archivos y paginas,
  productos, ambiguos, correcciones del merchant, tokens.
- **Cuando exista `core.activity_log` (spec B del ADR 0079, hoy inexistente), aceptar un import
  escribe ahi en la misma transaccion.** Queda dicho para que no se descubra despues.
- El aviso al merchant de que el archivo se procesa con un proveedor externo **es de la UI y lo
  escribe el owner** (ADR 0082 §12). No es un pendiente de esta spec.

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/server/schema/catalog-import.ts` + barrel | crear |
| `apps/merchant/drizzle/*` | migracion **aditiva** |
| `apps/merchant/src/server/catalog-import/{types,validation,core,draft,accept,prepare,pdf-pages,notify,cleanup,reconcile}.ts` | crear |
| `apps/merchant/src/server/catalog-import/providers/{provider,fake,openai,openai-schema,openai-callback}.ts` | crear |
| `apps/merchant/src/server/entitlements/catalog.ts` | editar (dos claves con ventana) |
| `apps/merchant/src/server/r2.ts` | editar (**parametrizar el tope de bytes** del presign) |
| `apps/merchant/src/app/api/catalog/imports/**` | crear las rutas (reservar, listar el activo, analizar, consultar, guardar borrador, aceptar, cancelar) |
| `apps/merchant/src/app/api/internal/catalog-imports/{provider-callback,reconcile}/route.ts` | crear |
| `apps/merchant/src/app/api/internal/assets-cleanup/route.ts` | editar (suma la limpieza del import) |
| `.github/workflows/catalog-import-reconcile.yml` | crear |
| `apps/merchant/src/server/*catalog-import*.test.ts` | crear unitarias |
| `apps/merchant/src/server/*catalog-import*.neon.integration.test.ts` | crear integracion |
| `docs/INDEX.md`, `docs/TASKS.md` | actualizar tras el PASS |

**Ningun `.tsx`.** Si el implementador siente que necesita tocar uno, la spec esta mal y se para.

El hook `file-size` corta a **300 lineas**: `openai.ts` se divide desde el principio (prompt y
esquema aparte), no cuando el hook lo frene.

### Disjunta?

**No.** Extiende catalogo, schema compartido, entitlements, `r2.ts` y el cleanup. Se implementa en
serie sobre el arbol vigente.

## Definition of Done

- [ ] Reservar + subir un PDF o 1-10 fotos directo a R2 sin cruzar el limite de body de la Function;
  formatos, tamanos y paginas invalidos tienen `code` estable.
- [ ] `analyze` responde **202 en el orden de un segundo** y el trabajo largo **no** vive en nuestra
  funcion: hay `provider_job_id` guardado y el callback lo retoma.
- [ ] El callback **rechaza una firma invalida y un timestamp viejo antes de tocar la base**, ignora
  un id desconocido con 200, y **no** confia en el cuerpo: el resultado se trae de la API.
- [ ] Un `after()` muerto o un webhook perdido **no** cuelgan el import: el reconciliador lo rescata
  y ningun estado queda sin salida.
- [ ] `fake` determinista y adaptador `openai` configurable; el dominio y las rutas **no** importan
  tipos del SDK de ningun proveedor (y no se instala ningun paquete nuevo).
- [ ] Salida no conforme rechazada antes de persistir; los DTO no filtran `objectKey`, job id,
  request id, tokens ni respuestas crudas.
- [ ] Un precio `ambiguous` **acepta sin bloquear** y nace con `unit_price` **null** — nunca `0`—, y
  `accept` devuelve `productsWithoutPrice`.
- [ ] Resolver o descartar categorias **nunca** pierde productos implicitamente ni toca existentes.
- [ ] `accept` es todo-o-nada, **idempotente sin que el cliente mande nada** (dos POST seguidos: un
  solo set de filas y el mismo resumen), y deja productos globales sin costo ni imagen.
- [ ] Un import abandonado en `pending_upload` **no traba** el siguiente; uno en `ready` **no se
  descarta** en silencio.
- [ ] El PDF de 10 paginas pasa y el que no se puede contar **se rechaza**; el naive con `/ObjStm`
  no cuela.
- [ ] Owner y staff con `catalog` importan; sin permiso, el contrato 0086; lo ajeno, 404 indistinguible.
- [ ] El cupo diario es **un valor del catalogo de entitlements con ventana**, un fallo **no** lo
  consume, y excederlo es `429` con `code`.
- [ ] Email al quedar `ready` (y al fallar), **una sola vez** por import, con el fake de consola en
  los tests.
- [ ] Originales borrados al aceptar, cancelar y expirar; el cleanup reintenta sin tocar catalogo.
- [ ] `format:check`, `lint`, `typecheck`, `test`, integracion Neon y `build` pasan. **`test:e2e` NO
  aplica** —cero `.tsx` y cero CSS— y se demuestra con `git diff --stat`.
- [ ] Revisor independiente en contexto fresco emite **PASS** con evidencia ejecutada.

## Plan de pruebas y verificacion

- [ ] Unit: matriz de formatos, mezcla PDF/imagenes, limites 1/10/11, 20/50 MB, 250/251 productos,
  HEIC convertido, PDF cifrado, deteccion por bytes.
- [ ] Unit del contador de paginas **con PDFs sinteticos construidos en el test**: uno plano, uno con
  `/ObjStm` (donde el naive da 0), uno con `/Encrypt`, uno indescifrable → rechazo.
- [ ] Unit: `fake`; esquema invalido; `poll` devolviendo `pending`/`done`/`failed`; sin fallback.
- [ ] Unit de firma: firma valida, firma alterada un byte, timestamp de hace 10 minutos, secreto
  equivocado, cuerpo alterado con firma vieja → los cuatro rechazan.
- [ ] Unit: maquina de estados; ningun estado sin salida; terminales no retroceden; `analyze` y
  `DELETE` idempotentes; `cancel_requested_at` durante `analyzing`.
- [ ] Unit: duplicados exactos con la normalizacion del **indice**; resoluciones de categoria; un
  `ambiguous` que **acepta** con `null`.
- [ ] Unit de entitlements: la ventana y el `byPlan` **con los valores transcritos a mano** (no
  leidos del catalogo, que es la copia muerta que `entitlements-catalog.test.ts` ya descarta).
- [ ] Integracion Neon: dos reconciliadores concurrentes reclaman una vez; un import activo por
  negocio; lease vencido re-reclamado.
- [ ] Integracion Neon: accept en transaccion (fallo intermedio deja **cero** filas); **dos accept
  seguidos** dejan un solo set de filas y devuelven el mismo resumen; 23505 de categoria → 409 y no
  500.
- [ ] Integracion Neon: `POST /imports` con uno abandonado en `pending_upload` **crea el nuevo**;
  con uno en `ready` **responde 409 y el borrador sigue existiendo**.
- [ ] Integracion Neon: owner y staff con `catalog` pasan; sin permiso falla; import/categoria ajena
  devuelve el mismo 404.
- [ ] Integracion Neon: el cupo no lo consume un `failed`, y si lo consume un `ready`.
- [ ] Integracion R2 fake: aceptar/cancelar/expirar encolan y completan el borrado; repetir es no-op.
- [ ] Contract test **por valor exacto** de cada DTO y cada `code`.
- [ ] Comandos: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, la integracion Neon
  del repo, `pnpm build`. (`test:e2e` no aplica: se demuestra con `git diff --stat`.)
- [ ] Corpus manual de 15-25 menus reales antes de fijar el modelo productivo: foto clara, inclinada,
  con poca luz, dos columnas, coma y punto decimal, sin precio, PDF digital y escaneado. Registrar
  precision, error de precio y tokens. **Esto NO es gate de la spec**: es la evaluacion que el ADR
  0082 §2 exige antes de produccion.

### Presupuesto de mutaciones y condicion de corte (ADR 0062)

**Nueve mutaciones**, y cada fila dice que oraculo tiene que morder. El implementador registra el
`shasum` limpio antes de mutar, etiqueta `MUTATION` y revierte con `diff` contra la copia limpia
(skill `protocolo-de-verificacion`). Las filas marcadas **(existente)** nombran un mecanismo ya en
el arbol, verificado al cerrar esta spec; las demas nombran codigo que esta spec crea, y el
implementador **anota archivo:linea en la bitacora** al medirlas.

| # | Mutacion | Tiene que ponerse rojo |
|---|---|---|
| M1 | Aceptar una firma invalida en `verifyCallback` (devolver el jobId igual) | el unit de firma: byte alterado y secreto equivocado |
| M2 | Sacar la tolerancia de timestamp | el caso de replay de hace 10 minutos |
| M3 | Confiar en el cuerpo del webhook en vez de traer el resultado de la API | el test que manda un payload con un borrador **falso** y espera que NO se persista |
| M4 | Borrar `lease_until` del reclamo del reconciliador | integracion: dos reconciliadores concurrentes / lease vencido |
| M5 | Guardar el precio `ambiguous` como **`0`** en vez de `null` al aceptar | el caso que asevera `unit_price is null` para un ambiguo. **Es la mutacion mas importante de la tabla**: `0` es un precio falso que parece valido, y era la razon de ser del bloqueo que esta spec saco |
| M6 | Sacar el chequeo de `accepted` bajo el lock del `accept` | integracion: dos POST seguidos → un solo set de filas y el mismo resumen |
| M7 | Agregar `objectKey` (y en una segunda pasada `providerJobId`) al DTO del `GET` | el contract test por valor exacto |
| M8 | Contar el cupo tambien cuando el import termina `failed` | integracion: un `failed` **no** consume el dia |
| M9 | Hacer que `POST /imports` se apropie tambien de un import en `ready` | el caso que asevera 409 **y** que el borrador sigue existiendo: descartarlo quema el analisis del dia |

**Ademas, dos mutaciones sobre mecanismo existente que NO se repiten** porque ya tienen oraculo en
el arbol: `isUniqueViolation` (`catalog/categories.ts:7-14`) y el sniff por bytes de
`server/assets/image.ts`.

**Condicion de corte:** si dos vueltas seguidas de revision terminan en «el fix abrio la
siguiente», se corta y lo que quede se **declara**. **Lo que queda afuera por escrito:** la
precision real del modelo (es el corpus manual, no un test), el comportamiento del webhook real de
OpenAI en produccion (no hay como recibirlo en local: se cubre con el camino de `poll` y firma
sintetica) y cualquier propiedad de pantalla, que no existe en esta spec.

## Despliegue

La migracion es **aditiva** (tablas y columnas nuevas, nada que el codigo viejo lea), asi que
**puede aplicarse antes del deploy** — la regla del repo es que solo una migracion que archiva,
borra o renombra va despues.

**Decision del owner (2026-09-21): se aplica DIRECTO a la rama `main` de Neon, sin rama efimera.**
«Estamos en desarrollo». Consecuencia que queda declarada: las pruebas de integracion corren contra
**la misma base que usa la app**, asi que cada test crea y borra sus propias filas y **ninguna
prueba trunca una tabla ni borra por rango**. Orden: PASS del revisor → migracion en `main` con el
comando de la skill `gotchas-del-repo` → deploy → verificar `check-runs` del sha exacto → QA del
owner.

**Configuracion que no es codigo y sin la cual la feature no anda en prod** (paso del owner):
crear el endpoint de webhook en el dashboard del proveedor apuntando a
`https://www.checkpass.club/api/internal/catalog-imports/provider-callback` —**con `www.`**— y
cargar `OPENAI_API_KEY`, `OPENAI_WEBHOOK_SECRET`, `CATALOG_EXTRACTION_*` en Vercel, mas el secret
`CATALOG_IMPORT_RECONCILE_ENDPOINT` en GitHub. Con `CATALOG_EXTRACTION_PROVIDER=fake` todo el arco
se desarrolla y se testea sin nada de eso.

## Handoff requerido

El implementador y el revisor usan `docs/AGENT-WORKFLOW.md`: **un** implementador para toda la spec
y **un** revisor independiente al final (ADR 0071). El revisor parte de esta spec y del diff,
ejecuta sus propios casos y emite PASS antes de que alguien cambie el estado a `implementada`.

## Abierto

Nada bloquea la implementacion. El modelo concreto se confirma con el corpus antes de produccion:
es configuracion y evaluacion, no una reapertura del contrato.
