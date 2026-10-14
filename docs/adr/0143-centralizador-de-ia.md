---
adr: 0143
fecha: 2026-10-13
estado: aceptada
resumen: Toda funcion con IA pasa por UN servicio del core (`server/ai/`) — un adaptador por proveedor, un proveedor falso, modelo por entorno, imagenes normalizadas en un solo lugar, logs sin contenido y UN registro de uso (`core.ai_request`) — al que cada funcion le pasa una TAREA que declara ella misma (prompt, esquema, modelo, modo). El core no lista tareas: Stock y Recetas las declaran en su carpeta y el menu en el core. No hay API HTTP de IA: cada funcion conserva su ruta y sus guards. Primera etapa: menu (segundo plano + webhook), dictado y foto de Stock y Recetas (la foto de la 0223 se rehace como primer uso). `stock.draft_request` y las columnas de uso de `core.catalog_import` se copian al registro nuevo y se borran (0080 aditiva y 0081 copia y borra, las dos en el push unico con POS y Mesas). Sin `AI_PROVIDER` no hay falso: error. Amplia el ADR 0082 §2/§8 y reemplaza el §2 y el §5 del ADR 0142.
---

# 0143 — Centralizador de IA

## Contexto

- Owner 2026-10-13 (textual): «estamos usando IA para fotos del menu, con texto para stock y recetas, y ahora tambien
  ia para fotos de stock y recetas. no convendria mover esa funcionalidad a un "controlador central" para que podamos
  re-usarla o extenderla a mas funciones en el futuro de forma facil? teniendo API para enviarle informacion y para
  recibirla de vuelta? por ejemplo, si mañana quisiera me lo invento, crear ordenes con la voz».
- Decisiones del owner del 2026-10-13 (no volver a preguntar):
  1. **Todas** las funciones con IA pasan al centralizador en la primera etapa, **la importacion del menu incluida** (con
     su modo en segundo plano + webhook).
  2. La foto de Stock y Recetas (spec 0223, ADR 0142) **no se commitea como esta**: se rehace como **primer uso** del
     centralizador, reaprovechando lo escrito.
  3. **Registro de uso unico**: el historial existente se copia al registro nuevo «y luego eliminamos el viejo (no
     dejamos tablas sin usar)».
  4. Vigente del ADR 0142: foto con hasta 3 fotos, la receta del producto abierto, sin limite de uso (solo registro).
- **Medido 2026-10-13** — hoy hay DOS clientes de OpenAI escritos a mano y DOS registros de uso:
  - **Menu** (`server/catalog-import/`): adaptador propio `providers/openai.ts` (Responses API, `background: true` +
    `store: true` `:92-93`, sin tools `:96`, `input_image`/`input_file` con `detail: "high"` `:66-84`, diagnostico de
    errores con huella de la clave y sin cuerpo `:16-42,139-204`), webhook Standard Webhooks
    (`providers/openai-callback.ts:31`), proveedor por entorno `CATALOG_EXTRACTION_PROVIDER` / `CATALOG_EXTRACTION_MODEL`
    (default `gpt-5-mini`) / `CATALOG_EXTRACTION_PROMPT_VERSION` (`providers/provider.ts:25-48`), falso determinista
    (`providers/fake.ts:21-90`), reconciliador (`reconcile.ts:38`, disparado por
    `.github/workflows/catalog-import-reconcile.yml`), cupo por plan (`quota.ts:57-136`).
  - **Dictado** (`modules/stock/`): `openAiStructured` sincrono, `store: false`, sin tools, `json_schema` estricto
    (`draft-openai.ts`, HEAD `:119-140`); entorno `STOCK_DRAFT_PROVIDER ?? CATALOG_EXTRACTION_PROVIDER ?? "fake"`,
    `STOCK_DRAFT_MODEL` (default `gpt-6-luna`), `STOCK_DRAFT_REASONING_EFFORT` (`draft-provider.ts`, HEAD `:56-67`).
    **Recetas importa el adaptador de Stock** (`recipes/draft-provider.ts:1-5`): el unico cliente de IA de un modulo vive
    dentro de otro modulo.
  - **Registros de uso**: `stock.draft_request` (`packages/db/src/schema/modules/stock.ts:121`; migraciones 0076 y 0077)
    y, en el menu, **columnas de uso mezcladas con el estado del trabajo** en `core.catalog_import`
    (`packages/db/src/schema/catalog-import.ts:76-87`: `provider`, `model`, `prompt_version`, `schema_version`,
    `provider_request_id`, `input_tokens`, `output_tokens`, `duration_ms`, junto a `status`, `provider_job_id`,
    `lease_until`, `attempt_count`, `draft`).
  - **Normalizacion de imagenes**: el menu usa `normalizeImageToJpeg` del dominio
    (`packages/domain/src/server/assets/image.ts:70`: tope de pixeles de entrada contra bombas, formato real por bytes,
    EXIF, lado mayor 2048, JPEG); la foto de la 0223 (sin commitear) escribio OTRA con `sharp` a mano
    (`modules/stock/photo-input.ts:31-68`, 2000 px, sin tope de pixeles).
  - Logs: cinco eventos distintos con forma distinta (`catalog_import_openai_request_failed`,
    `catalog_import_provider_start_failed`, `module_draft_openai_failed`, `stock_draft_failed`, `recipe_draft_failed`).

## Decision

### 1. Un servicio del core, no una API HTTP

El centralizador es una **interfaz interna** del servidor de merchant, en el core: `apps/merchant/src/server/ai/`.
**No hay una ruta HTTP de IA.** Cada funcion conserva su ruta, sus guards (sesion, permiso, modulo encendido, negocio de
la sesion) y su contrato, y adentro llama al servicio. Una API HTTP abierta («mandale cualquier cosa a la IA») seria:

- un **agujero de costo**: cualquier sesion valida podria gastar tokens sin el cupo ni las validaciones de la funcion;
- un **agujero de seguridad**: el prompt, el esquema y el modelo los decidiria el navegador, cuando hoy los decide el
  servidor por diseño (ADR 0082 §2: «el navegador no elige proveedor, modelo ni costo»).

El «API para enviarle informacion y recibirla de vuelta» que pide el owner es esta interfaz: entra una tarea + texto,
imagenes o PDF + contexto; sale el JSON validado + el uso.

### 2. La TAREA la declara su dueño; el core no lista tareas

Contrato de modulos (ADR 0138/0139/0141): el core nunca importa ni nombra un modulo. Por eso el servicio **no tiene una
lista de tareas**: recibe un objeto `AiTask` (id, version, instrucciones, esquema, modelo por defecto, modo, limites,
validador, salida del falso) que declara quien la usa:

- Stock declara las suyas en `modules/stock/ai-tasks.ts`, Recetas en `modules/recipes/ai-tasks.ts` (sin importar nada
  de Stock para la IA);
- el menu (catalogo es core) declara la suya en `server/catalog-import/menu-task.ts`;
- un futuro «orden por voz» del POS seria una tarea en `modules/pos/` y una ruta del POS: **cero archivos del core**.

El id de una tarea es `<area>.<nombre>` (`stock.entry_photo`). La base valida **su forma**, nunca la lista (mismo criterio
que los permisos de modulo, ADR 0139).

### 3. Un adaptador por proveedor, dos modos

- `server/ai/providers/openai.ts` es el **unico** cliente de OpenAI del repo (Responses API con `fetch`, cero paquetes —
  ADR 0082 §2). Siempre: sin tools, `json_schema` estricto, las instrucciones como mensaje `system`, el texto/contexto
  como `input_text`, imagenes como `input_image` y PDF como `input_file` con `detail: "high"`, timeout 45 s (el
  despachador de modulos corta a los 60). Para el menu, que hoy manda el prompt dentro del mensaje del usuario, es un
  cambio: se cubre con una corrida real antes de cerrar.
- **Sincrono** (`store: false`): dictado y foto. Responde en el mismo pedido.
- **En segundo plano** (`background: true`, `store: true`): el menu. Devuelve un `jobId`; el resultado se retoma por
  el webhook firmado o por el reconciliador (ADR 0082 §8, sin cambios). La verificacion de la firma se muda tal cual.
- El **estado del trabajo** en segundo plano (cola, lease, intentos, `provider_job_id`, borrador) sigue siendo de la
  funcion (`core.catalog_import`): el servicio no es un motor de colas. Pero toda salida de un trabajo por un camino que
  no pasa por el resultado del proveedor (cancelar, vencer, fallar sin poll) **cierra su fila de uso** con
  `closeAiJob`: ninguna fila queda `pending` con el trabajo terminado.
- Proveedor falso unico (`server/ai/providers/fake.ts`): devuelve la salida cruda que declara la tarea (`task.fake`) y
  pasa por el mismo validador. Es para tests y local: determinista, sin clave y sin costo.
- Proveedor por entorno con **una** variable (`AI_PROVIDER`) y modelo por tarea con un nombre derivado del id
  (`AI_MODEL_<ID>`, `AI_REASONING_<ID>`): el core no conoce los nombres de las tareas y no hay una variable por modulo.
  Reemplaza `CATALOG_EXTRACTION_*`, `STOCK_DRAFT_*` y `STOCK_PHOTO_*`.
- **`AI_PROVIDER` es obligatoria** (owner 2026-10-13: «devolvemos un error no un fake si no hay proveedor
  seleccionado»): sin ella el servicio contesta «no configurado» en todos los entornos; el falso solo existe con
  `AI_PROVIDER=fake` explicito. Hoy, sin variable, el menu y el dictado caen al falso y un deploy mal configurado
  devolveria analisis vacios con cara de reales.
- `core.catalog_import.draft_version` (legacy, nadie la usa) se borra en la migracion que borra lo viejo (owner
  2026-10-13).
- La salida **siempre** se valida con el validador propio de la tarea, aunque el proveedor prometa `strict` (ADR 0082 §2).

### 4. Un solo registro de uso: `core.ai_request`

Una fila por pedido a la IA: negocio, usuario, tarea, version, modo, proveedor, modelo, estado (`pending` / `ok` /
`failed`), cuanto entro (caracteres, imagenes, archivos), cuanto salio (items), tokens, duracion. **Nunca** el texto,
la imagen, el PDF ni lo que el modelo leyo. Vive en el core porque es del servicio; un modulo escribe en el a traves del
servicio (modulo → core). Ninguna FK a un modulo.

Aplicando la decision 3 del owner: `stock.draft_request` se copia y se **borra**; de `core.catalog_import` se copian y
se **borran las columnas de uso** — la tabla queda, porque es el estado del trabajo del menu (cola, lease, webhook,
borrador, cupo de analisis), no un registro de uso. El cupo de **intentos** del menu (ADR 0083), que hoy cuenta
`provider is not null` (`quota.ts:66-69`), pasa a contar filas de `core.ai_request` de la tarea del menu: es el mismo
hecho («el proveedor acepto el submit»), registrado en el lugar unico.

### 5. Limites por tarea: enganche, no motor

No se agregan limites nuevos (owner: sin limite en dictado y foto). El enganche es `countAiRequests(negocio, tarea,
desde)` del servicio, que ya usa el cupo del menu; un limite futuro es una clave del catalogo de entitlements + la ruta de
la funcion que la consulta, como hace hoy el menu.

### 6. Imagenes: una sola normalizacion

Toda imagen que va a la IA pasa por `normalizeImageToJpeg` del dominio (la del menu: tope de pixeles, formato por
bytes, EXIF, 2048 px, JPEG). La lectura de las fotos de un `multipart` (cantidad, tamaños, tipo por bytes) es una pieza
del servicio (`server/ai/image-input.ts`) que usan Stock y Recetas; el reescalado del navegador a 2000 px queda (ADR
0142 §4: entrar en los 4,5 MB de Vercel).

### 7. Logs

Un solo evento por falla, `ai_request_failed`, con tarea, proveedor, modelo, motivo y el diagnostico seguro que ya tenia
el menu (estado HTTP, tipo/codigo/param del error del proveedor, request id, huella `sha256[0..12]` y largo de la clave,
host). **Nunca** la clave, el prompt, el texto, la imagen, el PDF ni la respuesta.

## Relacion con otros ADR

- **ADR 0082**: amplia el §2 (el contrato propio y el proveedor intercambiable pasan a ser del servicio, no solo del
  menu) y el §8 (el modo en segundo plano y la verificacion del webhook pasan al servicio; el flujo y la ruta del
  webhook no cambian). Los §1, §3-§7 y §9-§13 siguen.
- **ADR 0083**: sigue; cambia DONDE se cuenta el submit aceptado (§4 de este ADR).
- **ADR 0142**: sigue en sus decisiones de producto (mismo borrador, sincrono, no se guarda la foto, el navegador
  achica, sin limite). **Reemplaza** el §2 en lo tecnico (el modelo de fotos sale de `AI_MODEL_<ID>`, no de
  `STOCK_PHOTO_MODEL ?? CATALOG_EXTRACTION_MODEL`; la normalizacion es la del dominio) y el §5 (el registro es
  `core.ai_request`, no columnas nuevas en `stock.draft_request`).

## Consecuencias

- Sumar una funcion con IA = declarar una tarea donde vive la funcion + su ruta con sus guards. El adaptador, el falso,
  la configuracion, los logs y el registro ya estan.
- Cambiar de proveedor (Anthropic, otro) = un adaptador nuevo en `server/ai/providers/`, sin tocar funciones.
- Dos migraciones: la **0080 es aditiva** (crea `core.ai_request`; el codigo de PROD no la ve) y la **0081 copia y
  borra** (`stock.draft_request`, las columnas de uso y `draft_version` de `core.catalog_import`). El codigo nuevo no lee
  ni escribe lo que borra la 0081, asi que las dos van en el push unico con POS y Mesas (owner 2026-10-13: «no vamos a
  hacer como dije todavia el push, lo vamos a hacer con el centralizador de ia tambien»), aplicadas detras de la 0079 en
  la misma corrida. Separar la 0081 solo servia para volver con el instant rollback de Vercel, y en este push eso no
  existe: la 0079 mueve tablas del POS, asi que el rollback es snapshot de Neon + rollback de Vercel (spec 0224
  §Migracion a PROD).
- Cambian nombres de variables de entorno: hay que crear las nuevas en Vercel antes del push.
- Lo que no cubre: una segunda tarea en segundo plano. El webhook de OpenAI es uno por proyecto y hoy lo atiende el menu
  (`app/api/internal/catalog-imports/provider-callback`); si aparece otra, el ruteo del webhook por tarea es otro ADR.
