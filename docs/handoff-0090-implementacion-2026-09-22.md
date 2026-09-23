# Handoff — Spec 0090 (implementación)

Estado: **implementado** (pendiente de PASS del revisor y de la migración a Neon, que aplica el
orquestador). **No marqué la spec como `implementada` ni toqué `docs/INDEX.md`.**

## Archivos tocados

### Creados — dominio

- `apps/merchant/src/server/schema/catalog-import.ts` — las tres tablas, con el **único parcial**
  de un import abierto por negocio, el único de `provider_job_id` y el índice del reconciliador.
- `apps/merchant/src/server/catalog-import.ts` — barrel.
- `apps/merchant/src/server/catalog-import/types.ts` — contrato del proveedor, `CatalogImportError`
  y la lista **cerrada** de `code`.
- `apps/merchant/src/server/catalog-import/validation.ts` — límites, saneado, esquema cerrado de la
  salida del proveedor.
- `apps/merchant/src/server/catalog-import/sniff.ts` — detección por bytes de la cabecera.
- `apps/merchant/src/server/catalog-import/pdf-pages.ts` — contador con `node:zlib`.
- `apps/merchant/src/server/catalog-import/core.ts` — reservar, listar el activo, consultar,
  cancelar, DTO.
- `apps/merchant/src/server/catalog-import/uploads.ts` — re-firma (salió de `core.ts` por el hook
  `file-size`).
- `apps/merchant/src/server/catalog-import/analyze.ts` — el `202` barato y sincrónico.
- `apps/merchant/src/server/catalog-import/prepare.ts` — reclamo con lease, preparación, submit.
- `apps/merchant/src/server/catalog-import/finish.ts` — aterrizaje del resultado y `failImport`.
- `apps/merchant/src/server/catalog-import/draft.ts` — construcción y revalidación del borrador.
- `apps/merchant/src/server/catalog-import/draft-save.ts` — el `PUT` con optimistic locking.
- `apps/merchant/src/server/catalog-import/accept.ts` — transacción + `FOR UPDATE`.
- `apps/merchant/src/server/catalog-import/callback.ts` — el orden firma → id → API.
- `apps/merchant/src/server/catalog-import/reconcile.ts` — el reconciliador.
- `apps/merchant/src/server/catalog-import/cleanup.ts` — vencimiento, purga y cola propia.
- `apps/merchant/src/server/catalog-import/notify.ts` — email una sola vez.
- `apps/merchant/src/server/catalog-import/quota.ts` — el cupo contado con filas.
- `apps/merchant/src/server/catalog-import/providers/{provider,fake,openai,openai-schema,openai-callback}.ts`
- `apps/merchant/src/server/entitlements/window.ts` — la ventana como aritmética pura.

### Creados — rutas

- `apps/merchant/src/app/api/catalog/imports/_auth.ts` (guard + responder con `code`)
- `apps/merchant/src/app/api/catalog/imports/route.ts` (`POST`, `GET` del activo)
- `apps/merchant/src/app/api/catalog/imports/[id]/route.ts` (`GET`, `DELETE`)
- `apps/merchant/src/app/api/catalog/imports/[id]/{uploads,analyze,draft,accept}/route.ts`
- `apps/merchant/src/app/api/internal/catalog-imports/{provider-callback,reconcile}/route.ts`

### Creados — migración, workflow y tests

- `apps/merchant/drizzle/0042_clean_risque.sql` + `drizzle/meta/0042_snapshot.json` (**generada,
  NO aplicada**)
- `.github/workflows/catalog-import-reconcile.yml`
- Unit: `catalog-import-{validation,extraction,pdf-pages,signature,draft,provider,contract,callback,accept,accept-states,states,attempts,notify}.test.ts`,
  `entitlements-window.test.ts`
- Soportes: `catalog-import-accept-double.ts`, `catalog-import-integration-support.ts`
- Integración Neon (se saltean sin la env):
  `catalog-import.neon.integration.test.ts`, `catalog-import-quota.neon.integration.test.ts`,
  `catalog-import-accept.neon.integration.test.ts`,
  `catalog-import-reconcile.neon.integration.test.ts`

### Editados

- `apps/merchant/src/server/schema.ts` — una línea de re-export.
- `apps/merchant/src/server/r2.ts` — `createTemporaryUploadUrl` gana `maxBytes` y
  `expiresInSeconds` (default `MAX_LOGO_BYTES`, o sea **cero cambio de comportamiento para las
  tres subidas existentes**); nace `catalogImportObjectKey`.
- `apps/merchant/src/server/assets/image.ts` — se extrae `guardedResize` + `asAssetImageError` y
  nace `normalizeImageToJpeg`. `normalizeImage` conserva su firma y su salida.
- `apps/merchant/src/server/catalog/validation.ts` — `parseOptionalMoney` pasa a exportada.
- `apps/merchant/src/server/catalog/categories.ts` — `isUniqueViolation` pasa a exportada.
- `apps/merchant/src/server/entitlements/catalog.ts` — tipo `EntitlementWindow`, campo `window?` y
  las **dos claves nuevas**.
- `apps/merchant/src/server/entitlements/index.ts` — re-exporta los helpers de ventana.
- `apps/merchant/src/app/api/internal/assets-cleanup/route.ts` — suma
  `cleanupExpiredCatalogImports()`.

### Correcciones del orquestador (2026-09-22), posteriores a la primera entrega

- **`catalog.imports.attempts` CABLEADO** (`prepare.ts:87-99` + `quota.ts:115-136`):
  `withinAttemptBudget` se consulta en `runAnalysis` **después del reclamo y antes del
  `provider.start()`**, y cierra en `failed` con `catalog_import_rate_limited`. Deja de ser
  andamiaje. **No nace ningún `429` no documentado**: se cruza en el camino de fondo, donde nadie
  espera un HTTP, y el contrato ya cubre `failed` con su `{code,message}`.
- **`callbackUrl` BORRADO**: el campo de `CatalogExtractionInput`, su uso en `prepare.ts` y
  `callbackUrlFromEnv` con sus dos envs no listadas por la spec. `rg 'callbackUrl|APP_BASE_URL|
  CATALOG_IMPORT_CALLBACK_BASE_URL' apps/merchant/src` → **sin rastros**. El tipo quedó consistente
  (typecheck verde).
- **`notify.ts`: el destinatario cae al OWNER activo del negocio** cuando el buzón de
  `created_by_user_id` no sirve (vacío o `@staff.invalid`). Antes, un import pedido por un
  integrante no le llegaba a **nadie**.
- `docs/TASKS.md` — **solo** el bloque de la bitácora de mutaciones (lo abrí antes de medir porque
  el protocolo lo exige; ahora dice «todas revertidas»). **No toqué el estado de la spec.** Si
  preferís que ese bloque no viva ahí, borralo: el registro completo está en este archivo.

**CERO `.tsx` y CERO CSS.** Los 20 `.tsx`/`.css` que aparecen en `git status` son el WIP del owner
y estaban modificados antes de que yo empezara; ninguno está en la lista de arriba.

## Comandos ejecutados y resultado

- `TURBO_FORCE=1 pnpm run typecheck` — **3 successful, 3 total; `Cached: 0 cached`** (forzado).
- `pnpm run lint` — `eslint .`, **sin salida** (exit 0).
- `pnpm run test` — **169 archivos passed / 105 skipped (274)**, **1713 tests passed / 581 skipped
  (2294)**. Baseline: 155/1586 (101 skipped). Delta: **+14 archivos de unit, +127 tests pasando,
  +4 archivos de integración (21 tests) en `skipped`**, que es exactamente lo esperado sin la env
  de Neon. (Corrida previa a las correcciones: 167/1701; el delta de +2 archivos y +12 tests son
  `catalog-import-attempts.test.ts` (6) y `catalog-import-notify.test.ts` (6), y el +1 skipped es
  el caso de integración del techo de intentos.)
- `TURBO_FORCE=1 pnpm run build` — **3 successful, 3 total; `Cached: 0 cached`**. Las ocho rutas
  aparecen en el manifiesto:
  `/api/catalog/imports`, `/api/catalog/imports/[id]`, `.../[id]/{accept,analyze,draft,uploads}`,
  `/api/internal/catalog-imports/{provider-callback,reconcile}`.
- `pnpm run format:check` — **ROJO, y los 10 archivos son los HEREDADOS** (`backoffice/catalog/*.tsx`,
  `globals.css`): exactamente los mismos 10 que ya estaban rojos antes de que empezara. **Ninguno
  mío.** Mis archivos los formateé con `pnpm exec prettier --write <rutas>` y vuelven `(unchanged)`.
- `pnpm --filter @mi-pasaporte/merchant db:generate` — `drizzle/0042_clean_risque.sql`. **NO corrí
  `db:migrate`.**
- Barrido del hook `file-size` sobre los 40 archivos nuevos/editados: **ninguno pasa de 300**;
  control positivo con un archivo de 543 líneas → `EXIT=2`, así que el barrido discrimina.
- `grep -rn 'MUTATION|MUTACION' apps/*/src packages` → **ARBOL LIMPIO**.

## DoD

- [x] **Reservar + subir sin cruzar el límite de body.** El cliente hace `PUT` directo a R2 con URL
  firmada; la Function solo firma. Formatos/tamaños/páginas tienen `code` estable — 12 casos en
  `catalog-import-validation.test.ts` que aseveran `{status, code}`, no solo que tiró.
- [x] **`analyze` responde 202 y el trabajo largo no vive en nuestra función.** La ruta solo lee
  `SNIFF_BYTES` (4 KB) de cada objeto y encola; `runAnalysis` va en `after()`. `provider_job_id` se
  guarda en `prepare.ts` y el callback lo retoma. Evidencia: `catalog-import-states.test.ts`
  («desde `pending_upload` confirma los uploads y encola») + el 202 de la ruta.
  **[ ] La latencia real del 202 no la medí** — sin base ni R2 no hay número que reportar.
- [x] **El callback rechaza firma inválida y timestamp viejo ANTES de tocar la base**, ignora un id
  desconocido con 200 y **no confía en el cuerpo**. Evidencia: 13 casos de firma + el caso «con
  firma inválida contesta 401 y NO toca la base» que cuenta `accesosAlaBase === 0`, y el oráculo de
  M3 (payload con borrador falso → se persiste lo de la API).
- [~] **Un `after()` muerto o un webhook perdido no cuelgan el import.** El código existe
  (`reconcile.ts`: `queued` viejo → `runAnalysis`; `analyzing` con lease vencido → `poll`;
  `cancel_requested_at` → cierra; `attemptCount > MAX_ATTEMPTS` → `failed`) y la máquina de estados
  tiene su batería. **[ ] El rescate contra la base NO lo pude ejecutar** (sin env): vive en
  `catalog-import-reconcile.neon.integration.test.ts`, escrito y en `skipped`.
- [x] **`fake` determinista y `openai` configurable; cero tipos de SDK y cero paquetes nuevos.**
  11 casos en `catalog-import-provider.test.ts`; `package.json` sin tocar.
- [x] **Salida no conforme rechazada antes de persistir; los DTO no filtran nada interno.**
  `catalog-import-extraction.test.ts` + el contract test por valor exacto (`toEqual` del objeto
  completo **y** `Object.keys` **y** un barrido del JSON serializado contra 9 secretos).
- [x] **Un `ambiguous` acepta sin bloquear y nace con `unit_price` null — nunca `0`**, y `accept`
  devuelve `productsWithoutPrice`. Tres capas: extracción, borrador y `accept` (mutación M5).
- [x] **Resolver o descartar categorías nunca pierde productos implícitamente ni toca existentes.**
  `assertResolved` + los casos de `discard`/`use_existing`/`uncategorized`. El `accept` solo hace
  `INSERT`: no hay un `update` ni un `delete` de `product`/`product_category` en `accept.ts`.
- [~] **`accept` todo-o-nada e idempotente sin que el cliente mande nada.** Medido en la capa pura
  (M6: dos llamadas, cero inserts la segunda, mismo resumen). **[ ] La atomicidad REAL —que un
  fallo intermedio deje cero filas— no la ejecuté**: es transacción de Postgres y vive en
  `catalog-import-accept.neon.integration.test.ts`.
- [~] **Un abandonado en `pending_upload` no traba; uno en `ready` no se descarta.** La mitad del
  409 está medida sin base (M9). **[ ] «El borrador sigue existiendo» exige releer la fila** y está
  en la suite de integración.
- [x] **El PDF de 10 páginas pasa, el que no se puede contar se rechaza, y el naive con `/ObjStm`
  no cuela.** 9 casos con PDFs sintéticos, incluido el contraste explícito contra el escaneo naive
  (que devuelve 0 sobre el mismo archivo donde el nuestro devuelve 40).
- [~] **Owner y staff con `catalog` importan; sin permiso, el contrato 0086; lo ajeno, 404
  indistinguible.** El guard es `requireApiPermission(request, "catalog")`, el mismo de las otras
  seis rutas, y el 404 indistinguible tiene su caso unitario. **[ ] Los vectores con sesión real
  (staff con y sin permiso) están en integración**, no ejecutados.
- [~] **El cupo es un valor del catálogo con ventana, un fallo no lo consume, y el exceso es 429.**
  El valor y la ventana están medidos (`entitlements-window.test.ts`, valores transcritos a mano);
  el **techo de submits** está cableado y medido con sus **dos** oráculos (regla + cableado,
  M10a/M10b). **[ ] «Un fallo no consume el cupo de análisis» se cuenta con filas y no lo
  ejecuté** (M8, integración).
- [x] **Email al quedar `ready` y al fallar, una sola vez, con el fake de consola.**
  `catalog-import-notify.test.ts`, 6 casos sobre `consoleEmailOutbox`: los dos asuntos, la caída al
  owner cuando el autor es un integrante, el `no_recipient` cuando ningún buzón sirve, el
  `already_notified` cuando otro ganó la marca, y que el cuerpo no lleva ids internos.
  **[ ] La unicidad bajo concurrencia real** la da el `UPDATE … WHERE notified_at IS NULL …
  RETURNING` y **eso sí exige la base**.
- [~] **Originales borrados al aceptar, cancelar y expirar; el cleanup reintenta sin tocar
  catálogo.** El código existe y `cleanup.ts` no importa `products` ni `productCategories` (verificable
  con `rg`). **[ ] El ciclo encolar→completar→repetir-es-no-op no lo ejecuté.**
- [x] **`format:check`, `lint`, `typecheck`, `test` y `build` pasan** (el `format:check` con los 10
  heredados, ninguno mío). **`test:e2e` NO aplica**: cero `.tsx` y cero CSS míos.
  **[ ] La integración Neon no corrió**: no tengo la env.
- [ ] **Revisor independiente en contexto fresco emite PASS.** No es mío.

## Bitácora de mutaciones

Protocolo: `git status --short` (los siete archivos son `??`, sin blob → copia a `/tmp/m0090/`),
`shasum` limpio antes de mutar, fila abierta en `docs/TASKS.md` **antes** de medir, etiqueta
`MUTATION` en el código, medición, y reversión con `diff` contra la copia limpia + `shasum`.

| id | archivo:línea del mecanismo | shasum limpio | invariante | resultado **EJECUTADO** |
|---|---|---|---|---|
| M1 | `catalog-import/providers/openai-callback.ts:54` (`if (!matchesAny(...))`) | `3b8008ad91364e76b94dcd27018fc675904d8dba` | la firma rechaza lo que no firmó el proveedor | **ROJO — 5 failed / 25 passed**. Muerden: «un byte alterado en la firma NO pasa», «el secreto equivocado NO pasa», «un cuerpo alterado con la firma vieja NO pasa», «una firma de otra VERSION no se acepta», «cambiar el id la invalida». Aserción: `expected { ok: true, … } to deeply equal { ok: false, reason: 'bad_signature' }`. Alcance: `catalog-import-{signature,callback,provider}.test.ts`. |
| M2 | `catalog-import/providers/openai-callback.ts:50` (`if (drift > CALLBACK_TOLERANCE_SECONDS)`) | `3b8008ad91364e76b94dcd27018fc675904d8dba` | la ventana de replay de 5 minutos | **ROJO — 2 failed / 17 passed**: «un timestamp de hace 10 minutos NO pasa (replay)» y «la tolerancia es de 5 minutos». Alcance: `catalog-import-{signature,callback}.test.ts`. |
| M3 | `catalog-import/callback.ts:60` (el `provider.poll(verified.jobId)`) | `e1780ec882c9e382e4ef0529e4fee3f75fe2fea8` | el cuerpo del webhook NO se cree: el resultado se trae de la API | **ROJO — 1 failed / 5 passed**: «persiste lo que devolvió la API, NO el borrador que venía en el cuerpo». Aserción: `expected '{"status":"ready","draft":{"version":…' to contain 'Café de verdad'` — o sea persistió el borrador **inyectado**. |
| M4 | `catalog-import/prepare.ts:59-62` y `catalog-import/reconcile.ts:60,88` (`isNull(leaseUntil)` + `lte(leaseUntil, now)`) | `fc91d6b904105229c8e7ccf6bb50844826085bbb` / `1aca5d1fc50b1d9163bd65e29c00a86097923c29` | el lease hace que dos reconciliadores reclamen una sola vez | **PENDIENTE — requiere Neon. NO aplicada.** Oráculo ya escrito: `catalog-import-reconcile.neon.integration.test.ts` → «dos reconciliadores concurrentes reclaman la fila UNA sola vez» (`polls.length === 1`) y «una fila con el lease VIVO no se reclama». No inventé el rojo. |
| M5 | `catalog-import/accept.ts:197` (`unitPrice: product.unitPrice`) | `176654521b5afab20f7b2634f4ed19ee80c7e315` | un precio ambiguo nace `null`, nunca `0` | **ROJO — 1 failed / 22 passed**: «un producto AMBIGUO nace con `unitPrice` null, NUNCA con 0». Aserción: **`expected '0.00' to be null`**. Alcance: `catalog-import-{accept,accept-states,draft}.test.ts`. |
| M6 | `catalog-import/accept.ts:51` (`if (row.status === "accepted")` bajo el `FOR UPDATE`) | `176654521b5afab20f7b2634f4ed19ee80c7e315` | el chequeo de `accepted` bajo el lock hace idempotente al doble clic | **ROJO — 1 failed / 9 passed**, aserción `promise… expected { created: true, … } to deeply equal { created: false, … }`. **Se midió DOS veces:** la primera dio rojo **por el motivo equivocado** (`CatalogImportError: El borrador no es válido`, porque el doble describía una fila `accepted` con `draft: null` — una fila que la base no produce: el `accept` no borra el `draft`). Se arregló **el doble**, se verificó verde en limpio, se **re-aplicó** la mutación y ahí sí el rojo habla de la propiedad. |
| M7 | `catalog-import/core.ts:46` (`toImportDTO`, allow-list campo por campo) | `a5368fb89c1e417afdc965bd500c22804ef1dd23` | el DTO no filtra claves internas | **ROJO en las DOS pasadas.** (a) agregando `objectKey`: 2 failed — `expected { …(9) } to deeply equal { …(8) }` y `expected '…' not to contain '22222222-…'` (el businessId). (b) agregando `providerJobId`: 2 failed — el mismo de forma y `not to contain 'resp_secreto'`. Alcance: `catalog-import-contract.test.ts`. |
| M8 | `catalog-import/quota.ts:71` (`isNotNull(catalogImports.draft)` como discriminante) | `d34f8634150896a8b3365e9bdc3174ac85563326` | un import `failed` no consume el cupo del día | **PENDIENTE — requiere Neon. NO aplicada.** Oráculo ya escrito: `catalog-import-quota.neon.integration.test.ts` → «un import `failed` de hoy NO consume el análisis del día» (espera 201) y su control positivo, «un análisis que llegó a borrador SÍ lo consume» (espera 429 + `Retry-After`). Lo intenté acotar a un unit: el discriminante es un predicado de la cláusula `WHERE`, y un doble de `./db` no lo evalúa — un unit ahí mediría el doble, no el código. |
| M9 | `catalog-import/core.ts:120` (`open.status !== "pending_upload"`) | `a5368fb89c1e417afdc965bd500c22804ef1dd23` | `POST /imports` no se apropia de un `ready` | **ROJO en la mitad medible sin base — 1 failed / 15 passed**: «con uno en `ready` abierto responde 409 y NO escribe nada». Aserción: **`promise resolved "{ import: { …(8) }, …(1) }" instead of rejecting`**. También se midió dos veces: la primera el rojo era un `TypeError` por cola de resultados corta (motivo equivocado), se alargó la cola del doble y se re-midió. **[ ] La otra mitad —«el borrador sigue existiendo» tras el 409— sigue PENDIENTE y requiere Neon** (`catalog-import.neon.integration.test.ts`). |

| M10a **(la REGLA)** | `catalog-import/quota.ts:135` (`return used <= limit`) | `d34f8634150896a8b3365e9bdc3174ac85563326` | `withinAttemptBudget` deniega cuando el conteo supera el tope | **ROJO — 2 failed / 20 passed**. Mutación: `return true` (el presupuesto nunca deniega). Muerden «uno por encima del tope, NO» (`expected true to be false`) y «agotado el techo, cierra en `failed`» (`expected 'submitted' to be 'failed'`). Alcance: `catalog-import-{attempts,states}.test.ts` + la suite de reconcile. |
| M10b **(el CABLEADO)** | `catalog-import/prepare.ts:92` (la llamada a `withinAttemptBudget` antes del `provider.start()`) | `fc91d6b904105229c8e7ccf6bb50844826085bbb` | `runAnalysis` CONSULTA el techo antes de submitear | **ROJO — 1 failed / 21 passed**, `expected 'submitted' to be 'failed'`. **Y el dato que justifica el par: los TRES casos de la REGLA quedaron VERDES bajo esta mutación.** O sea que sin el oráculo de cableado, borrar la llamada habría pasado con la regla «bien testeada» — exactamente el modo de falla que el repo ya pagó dos veces en un día. |

**Estado final: ninguna mutación sobrevive.** `diff` vacío contra las siete copias de `/tmp/m0090/`
y los `shasum` de los diez archivos coinciden; `grep -rn 'MUTATION|MUTACION' apps/*/src packages`
→ sin resultados.

## Hallazgos a decidir, límites (intentados) y bloqueos

### Correcciones aplicadas tras la revisión del orquestador (2026-09-22)

Tres de los seis hallazgos que había subido **no eran menú para el owner** y el orquestador los
devolvió como arreglos. Quedan acá como registro de qué cambió y por qué:

1. **`catalog.imports.attempts` cableado.** Tenía razón: la spec §8 ya había tomado la decisión
   («`attempts` cuenta todo submit al proveedor, para que un loop de fallos no queme plata»), así
   que no era una decisión abierta sino andamiaje mío. El argumento del contrato tampoco la
   bloqueaba: el techo se cruza en el camino de fondo, donde nadie espera un HTTP, y el import
   cierra en `failed`, que el contrato ya cubre. **Dos oráculos, no uno** (M10a/M10b), y el de
   cableado demostró su valor: bajo M10b los tres casos de la regla quedaron **verdes**.
2. **`callbackUrl` borrado** (`types.ts`, `prepare.ts`, `callbackUrlFromEnv`). Misma regla del
   repo. El argumento «un proveedor futuro lo va a necesitar» es exactamente el caso que la regla
   prohíbe: el día que exista ese adaptador, el campo vuelve con su consumidor.
3. **El email cae al owner activo del negocio** cuando el buzón de quien pidió el análisis no
   sirve. **Decisión del ORQUESTADOR, 2026-09-22, y reversible — NO del owner.** Está escrita así
   en el docblock de `recipientFor` (`notify.ts`) para que nadie la lea como acordada.

### Hallazgos a decidir — NO los resolví yo; los sube el orquestador

1. **La ventana del cupo es UTC, no la zona del negocio.** `core.business.timezone` existe, pero el
   catálogo de entitlements no tiene cómo expresar una zona y dos negocios con el mismo cupo verían
   cortes distintos. Declarado en el docblock de `entitlements/window.ts` con la salida
   (`windowTimezone`). **Nadie lo acordó: va como hallazgo, no como aceptado.**
2. **`catalog.imports.attempts` cuenta FILAS con `attempt_count > 0`, no submits.** La spec dice
   «cuenta todo submit al proveedor» y también «se cuentan filas de `catalog_import` en la ventana;
   no nace tabla de contadores». Las dos frases no coinciden si un import reintenta: implementé la
   segunda (una fila submiteada = un intento), que es la que acota el loop `cancelar → crear →
   analizar`. Los reintentos DENTRO de un import los acota `MAX_ATTEMPTS = 3`, que es un tope
   distinto y complementario.
3. **Refactoricé `server/assets/image.ts`**, archivo compartido por marca, sello y producto, para
   extraer `guardedResize`/`asAssetImageError` y agregar `normalizeImageToJpeg`. La alternativa sin
   tocarlo —reusar `normalizeImage` y re-encodear su PNG— **la medí y la descarté**: paga un encode
   PNG con `compressionLevel: 9` por página, o sea el trabajo más caro del pipeline, diez veces,
   dentro de un `after()` con techo de 60 s. `normalizeImage` conserva firma, guards y salida, y sus
   tests siguen verdes.

### Límites — intentados, no supuestos

- **No pude ejecutar nada contra Neon**: no tengo `NEON_INTEGRATION_DATABASE_URL`. Las 4 suites se
  saltean limpio (21 tests en `skipped`) y `pnpm run test` sigue verde. **No afirmo que pasen.**
- **M8 acotado a la parte exacta que es real:** intenté bajarlo a un unit y el obstáculo es
  concreto — el discriminante es un predicado del `WHERE` y el doble de `./db` no evalúa
  predicados, así que un unit ahí mediría el doble. Un oráculo unitario honesto necesitaría
  `.toSQL()` y eso pinnea la sintaxis, no el comportamiento.
- **M9 NO estaba enteramente bloqueado**, y eso sí lo intenté: la mitad del `409` se mide sin base
  con tres casos nuevos de `createImport` en `catalog-import-states.test.ts`, y la mutación da rojo
  por el motivo correcto. Solo «el borrador sobrevive» necesita releer la fila.
- **M10 tampoco estaba bloqueado, y esa era la parte que importaba.** El techo de intentos tiene
  dos preguntas distintas: *qué filas cuenta* (predicado del `WHERE` → es M8, requiere Neon) y
  *qué decide con ese conteo y quién la consulta* (→ medible con el conteo doblado, y es lo que
  M10a/M10b pinnean). **El caso con el predicado real está escrito** en
  `catalog-import-quota.neon.integration.test.ts` («agotado el techo de intentos, el submit se
  cierra en `failed` sin llamar al proveedor») y queda PENDIENTE — requiere Neon.
- **El webhook real de OpenAI no se puede recibir en local** (lo declara la spec): cubierto con
  firma sintética + el camino de `poll`.
- **La precisión del modelo** es el corpus manual del ADR 0082 §2, que no es gate de esta spec.
- **La latencia del 202** no la medí: sin R2 ni base no hay número.

### Bloqueos

Ninguno. La migración está generada y **sin aplicar**, como pediste.

### Para el despliegue (recordatorio, no acción mía)

- `pnpm --filter @mi-pasaporte/merchant db:migrate` con `DATABASE_URL_UNPOOLED` (host **sin**
  `-pooler`), después del PASS.
- Secret de GitHub `CATALOG_IMPORT_RECONCILE_ENDPOINT` **con `www.`** (el apex hace 308 y el `curl`
  del workflow no lleva `-L`).
- Con `CATALOG_EXTRACTION_PROVIDER=fake` todo el arco anda sin clave ni webhook.

---

## Handoff — Spec 0090, VUELTA 2 (los cuatro arreglos del FAIL del revisor)

Estado: **implementado** (los cuatro hallazgos cerrados). **No marqué la spec como
`implementada`, no commiteé, no toqué `docs/INDEX.md`.**

El encargo fue explícito en que **no hay ningún defecto vivo en el camino de producción**: en
H5 el defecto era del archivo, y en H1/H2/H3/H4 **el código de hoy es correcto y lo que faltaba
era la prueba que lo pinnea**. No se cambió una sola línea de lógica de negocio.

### Archivos tocados

**Creados**

- `apps/merchant/src/server/catalog-import-predicado.ts` — el evaluador de predicados de los
  dobles de `./db` (soporte de test, no camino de producción) y la cadena honesta.
- `apps/merchant/src/server/catalog-import-routes.test.ts` — H3: la allow-list pinneada sobre
  **la respuesta de la ruta**, no sobre la función.
- `apps/merchant/src/server/catalog-import-cleanup.test.ts` — H4: las 183 líneas de `cleanup.ts`
  que tenían cero tests.

**Editados**

- `apps/merchant/src/server/catalog-import/validation.ts` — H5: los bytes de control literales
  del regex de `sanitizeText` pasan a escapes Unicode. **Cero cambio de semántica** (medido).
- `apps/merchant/src/server/catalog-import-extraction.test.ts` — H5: lo mismo en el string del
  test.
- `apps/merchant/src/server/catalog-import-states.test.ts` — H2: el doble evalúa el `where`; el
  caso cruzado pasa a medir lo que su título dice, más su control positivo.
- `apps/merchant/src/server/catalog-import-accept-double.ts` — el doble de la transacción evalúa
  el `where` de los `SELECT`.
- `apps/merchant/src/server/catalog-import-accept-states.test.ts` — H1: el caso cruzado de
  `accept` sin base, con control positivo.
- `apps/merchant/src/server/catalog-import-accept.neon.integration.test.ts` — H1: el caso cruzado
  contra Neon (segundo negocio sembrado) con su control positivo.
- `docs/TASKS.md` — solo el bloque de bitácora de la vuelta 2 (abierto **antes** de medir).

**CERO `.tsx`, CERO CSS, cero `pnpm format`, cero paquetes nuevos.** `package.json` sin tocar.

### H5 — los bytes de control literales

Reproducido antes de tocar nada:

- `git diff --no-index --stat /dev/null <archivo>` → `Bin 0 -> 9724 bytes` y
  `Bin 0 -> 5263 bytes`. (Los archivos son `??`, así que `git diff --stat` a secas no los ve;
  `--no-index` da la misma detección binaria **sin tocar el índice**.)
- `rg -n 'sanitizeText' .../validation.ts` → `binary file matches (found NUL byte around offset
  4794)`, **exit 0, cero líneas**. Con `-a`: 8 hits.
- Los bytes exactos, localizados con `python3`: `validation.ts:141` traía los bytes crudos
  `0x00`, `0x1f` y `0x7f` dentro del char class; `catalog-import-extraction.test.ts:168` traía
  `0x00` y `0x07` crudos dentro del string.

Arreglo: el char class pasa a los escapes `u0000`-`u001f` + `u007f`, y el string del test a
`"  Café" + los dos escapes + "  con   leche "`.

**Las tres verificaciones que el encargo exigió, ejecutadas:**

1. `git diff --no-index --stat` ya **no** dice `Bin`: `validation.ts | 270 +++...` y
   `catalog-import-extraction.test.ts | 180 +++...`.
2. `rg -n 'sanitizeText' <archivo>` **sin `-a`** devuelve las 8 líneas de `validation.ts`
   (127, 139, 168, 185, 198, 209, 229, 259) y las 3 del test (5, 168, 169).
3. **La semántica no cambió, y se midió, no se supuso.** Antes de editar capturé el conjunto de
   code points que el regex reemplaza (extrayendo el literal del archivo y evaluándolo):
   **33 code points, `0x00`-`0x1f` más `0x7f`**. Después del arreglo: **33, idénticos**
   (`JSON.stringify(antes) === JSON.stringify(despues)` → `true`). **Control positivo del
   método**: el mismo cálculo con un escape mal escrito (tres dígitos en vez de cuatro) da
   **119** code points y la comparación devuelve `false`, o sea la comparación discrimina.
   Y para el string del test: los code points del literal parseado son **idénticos**
   (`32,32,67,97,102,233,0,7,...`), así que el test sigue mordiendo los mismos caracteres.
   `vitest` de los dos archivos de saneado: **20 passed**.

Nota sobre el orden: `prettier` partió la línea 168 del test en tres (solo un wrap), y la
comparación de code points se re-ejecutó **después** del formateo.

### H1 + H2 — el aislamiento por negocio ya tiene oráculo, y NO necesitó Neon

**La causa raíz de H2 era el doble, no el test.** El `./db` doblado encadenaba `where()`
devolviendo la misma cadena y **descartaba el predicado**, así que `estado.filas = [[]]` medía
«si la base no devuelve filas, tiramos 404» — cierto con y sin el filtro.

Arreglo: `catalog-import-predicado.ts` **evalúa** el `where` de los `SELECT` contra las filas
que el test sembró (`=`, `<>`, `<=`, `<`, `>=`, `>`, `in`, `is null`, `is not null`; ante un `or`
o un operando que no sabe leer **tira**, no miente). Dos decisiones que son afirmaciones sobre la
base y quedan escritas en el docblock:

- **El `RETURNING` de un `UPDATE` no se filtra.** En Postgres el `WHERE` mira la fila vieja y el
  `RETURNING` devuelve la nueva: `UPDATE ... WHERE status='pending_upload' ... RETURNING *`
  devuelve `status='queued'`. Filtrarlo describiría una base que no existe. (Lo cacé midiendo:
  con el filtro puesto sobre el `RETURNING`, el caso «confirma los uploads y encola» se caía.)
- **Una clave ausente en la fila del doble no restringe.** Las filas de estos dobles son parciales
  a propósito (`{ total: 0 }`, `{ id: "cat-1" }`); la que quiera ser distinguida por una columna
  tiene que traerla. Los vectores cruzados **traen** su `businessId`.

Con eso, el caso de `catalog-import-states.test.ts:173` pasó a medir lo que su título dice: siembra
una fila **existente, `ready` y cancelable**, cuyo único defecto es el negocio. **No se borró
ningún test**; se le agregó el **control positivo** (la misma fila con el `businessId` del
llamador **sí** se cancela).

Y el caso cruzado de `accept` está en dos lugares:

- `catalog-import-accept-states.test.ts` — sin base, con el doble honesto, más control positivo.
- `catalog-import-accept.neon.integration.test.ts` — con un **segundo negocio sembrado**, mirando
  las filas de `core.product` y `core.product_category` **de los dos negocios**, más control
  positivo. Queda en `skipped` sin la env.

**RE-MEDICIÓN, EJECUTADA:**

- **RM3** (borrar `eq(businessId)` de `requireImport`, `core.ts:97`) → **ROJO, 1 failed / 134
  passed**. Aserción: `promise resolved "{ import: { ...(8) } }" instead of rejecting` — el
  `cancelImport` del atacante **canceló el import de la víctima** y devolvió su DTO. El control
  positivo quedó verde en la misma corrida.
- **RM4** (borrar `eq(businessId)` del `SELECT ... FOR UPDATE`, `accept.ts:43`) → **ROJO, 1 failed
  / 134 passed**. Aserción: `promise resolved "{ created: true, result: { ...(4) } }" instead of
  rejecting`, con `categoriesCreated: 1, productsCreated: 1` — es exactamente el riesgo que el
  revisor describió: el menú de la víctima materializado como catálogo del atacante.
  **El límite «requiere Neon» era falso: lo intenté y un doble honesto alcanza.**

Alcance de las dos: `vitest run src/server/catalog-import` — **19 archivos** (15 unit más 4 de
integración en `skipped`), o sea todas las suites que pueden ver esos archivos.

### H3 — la allow-list, pinneada sobre la respuesta de la ruta

`catalog-import-routes.test.ts` dobla `./api-permission` (para elegir el caller sin sesión) y
`./db`, y siembra la fila **completa**: `providerJobId: "resp_secreto"`,
`providerRequestId: "req_secreto"`, `inputTokens`/`outputTokens`, `failureDetail`, `leaseUntil`,
`createdByUserId`, `businessId`, `provider`, `model`. Cuatro casos:

- `GET /api/catalog/imports` → `Object.keys(cuerpo.import).sort()` **igual al conjunto exacto** de
  las ocho claves del contrato §4.
- `GET /api/catalog/imports/{id}` → lo mismo.
- Barrido del **texto serializado** de las dos respuestas contra 10 secretos.
- Sin import activo, `{ import: null }`.

**RE-MEDICIÓN, EJECUTADA:**

- **RM6** (devolver la fila cruda en `route.ts:43`) → **ROJO, 2 failed / 133 passed**. Aserciones:
  `expected [ 'acceptedAt', ...(30) ] to deeply equal [ 'draft', 'error', 'expiresAt', ...(5) ]` y
  `expected '{"import":...' not to contain 'resp_secreto'`. **`catalog-import-contract.test.ts` se
  quedó VERDE** bajo la mutación, que es precisamente por qué el oráculo faltaba.
- **RM6b** (lo mismo en `[id]/route.ts:22`) → **ROJO, 2 failed / 133 passed**, mismas dos
  aserciones sobre el caso del `GET` por id. La medí porque, sin ella, el assert de la segunda
  ruta sería una afirmación sin ejecutar.

### H4 — `cleanup.ts` pasa de 0 a 10 casos

`catalog-import-cleanup.test.ts`, con un doble de `deleteObjectKeys` y el `./db` honesto:

- encolar un trabajo por archivo **vivo**; un archivo ya `deleted` no se reencola (el
  `ne(status,'deleted')`, evaluado);
- purgar: borra el original, escribe `status:'deleted'` y marca `cleaned_at`;
- **repetir es no-op**: la fila se siembra como la dejó la corrida anterior —`deleted`, que es el
  valor que el `set` del caso de arriba **escribe**— y el `ne` la deja afuera: cero llamadas más
  a R2. (No es un `[]` inventado: el estado sembrado es el que el propio código produce, y eso
  está aseverado en el caso previo.)
- un fallo de R2 deja `pending: 1` y **no** marca `cleaned_at`;
- la cola: drena lo vencido, **no** toca un trabajo con `not_before` futuro, y un fallo reprograma
  con backoff (`attemptCount: 3`, `notBefore` más 8 min, `lastError`);
- la corrida diaria: vence **solo** lo vencido y borra **solo** sus originales.

**RE-MEDICIÓN, EJECUTADA:**

- **RM11** (borrar `lte(catalogImports.expiresAt, now)`, `cleanup.ts:118`) → **ROJO, 2 failed /
  133 passed**. Aserciones: `expected 2 to be 1` (venció también el import **abierto y no vencido
  de otro negocio**) y `expected { expired: 1, ... } to deeply equal { expired: 0, ... }`.
  **El límite «el predicado de vencimiento necesita base» también era falso**: lo intenté y el
  doble honesto lo caza. Los vectores usan `expiresAt` de 2020 y 2099, así que **no dependen del
  reloj** (`cleanupExpiredCatalogImports` llama a `new Date()` y no toma un `now` inyectable;
  fingir el reloj con `vi.setSystemTime` sin `useFakeTimers` no funcionaba y se descartó).

### Comandos ejecutados y resultado

- `TURBO_FORCE=1 pnpm run typecheck` — **3 successful, 3 total; `Cached: 0 cached`** (forzado).
- `pnpm run lint` — `eslint .`, sin salida, **exit 0**.
- `pnpm run test` — **171 archivos passed / 105 skipped (276)**, **1730 tests passed / 583 skipped
  (2313)**. Antes de esta vuelta: 169/105 (274) y 1713/581 (2294). Delta: **más 2 archivos**
  (`catalog-import-routes.test.ts`, `catalog-import-cleanup.test.ts`), **más 17 tests pasando**
  (4 más 10 más 1 control positivo en states más 2 en accept-states) y **más 2 skipped** (los dos
  casos nuevos de la suite Neon de `accept`).
- `pnpm run format:check` — **ROJO con los MISMOS 10 archivos heredados del owner**
  (`backoffice/catalog/*.tsx` y `globals.css`). Ninguno mío: `prettier --check` sobre los 9
  archivos que toqué devuelve *All matched files use Prettier code style!*
- Barrido del hook `file-size` sobre los 9 archivos tocados: **ninguno pasa de 300** (el mayor,
  `catalog-import-states.test.ts`, 290). **Control positivo**: un archivo de 453 líneas da
  `EXIT=2` con el mensaje «Dividir, no extender», así que el barrido discrimina.
- `rg -n 'MUTATION|MUTACION' apps/` → **sin hits** (exit 1), con control positivo (un archivo con
  la etiqueta da hit, exit 0). `.claude/hooks/no-mutations-left.sh` → **EXIT=0**.
- **NO corrí `pnpm run build`, `pnpm test:e2e`, `db:generate` ni `db:migrate`.**

### DoD de esta vuelta

- [x] **H5 cerrado.** `git diff --stat` deja de decir `Bin`; `rg` sin `-a` devuelve líneas; el
  conjunto de caracteres saneados es **idéntico** (33 code points) con control positivo del
  método de comparación; 20 tests de saneado verdes.
- [x] **H1 más H2 cerrados.** El título del caso de `states` y su cuerpo dicen lo mismo, con
  control positivo; el caso cruzado de `accept` existe sin base **y** en la suite de Neon. RM3 y
  RM4 **ROJAS, ejecutadas**.
- [x] **H3 cerrado.** Conjunto exacto de claves sobre la respuesta de **las dos** rutas, con la
  fila sembrada con `providerJobId`/`providerRequestId`/tokens. RM6 y RM6b **ROJAS, ejecutadas**.
- [x] **H4 cerrado.** 10 casos sobre `cleanup.ts`; la mutación obligatoria del predicado de
  vencimiento **ROJA, ejecutada**.
- [x] **Ninguna mutación sobrevive.** `diff` vacío contra las cinco copias de `/tmp/rev0090/` y
  los cinco `shasum` vuelven a su valor limpio.
- [ ] **La suite de integración Neon no corrió**: no tengo `NEON_INTEGRATION_DATABASE_URL`. Los
  dos casos nuevos de `accept` están escritos y en `skipped`. **No afirmo que pasen.**
- [ ] **PASS del revisor.** No es mío. **No marqué la spec como implementada.**

### Bitácora de mutaciones (vuelta 2)

| id | archivo | shasum limpio | invariante | resultado **EJECUTADO** | alcance |
|---|---|---|---|---|---|
| RM3 | `catalog-import/core.ts:97` | `a5368fb89c1e417afdc965bd500c22804ef1dd23` | el 404 de lo ajeno es de verdad un filtro, no la ausencia de filas | **ROJO — 1 failed / 134 passed**; `promise resolved "{ import: { ...(8) } }" instead of rejecting` | `vitest run src/server/catalog-import` (19 archivos) |
| RM4 | `catalog-import/accept.ts:43` | `176654521b5afab20f7b2634f4ed19ee80c7e315` | la ruta que ESCRIBE no acepta un import ajeno | **ROJO — 1 failed / 134 passed**; `promise resolved "{ created: true, result: { ...(4) } }" instead of rejecting` (`productsCreated: 1`) | idem |
| RM6 | `api/catalog/imports/route.ts:43` | `a16c9f3a16504668045e4a4b2c52b363ccdc9f43` | la RUTA aplica la allow-list | **ROJO — 2 failed / 133 passed**; `expected [ 'acceptedAt', ...(30) ] to deeply equal [ ...(8) ]` más `not to contain 'resp_secreto'` | idem |
| RM6b | `api/catalog/imports/[id]/route.ts:22` | `2be124d22ae6015a8548a9f750579b4d733122fe` | la segunda ruta que serializa también la aplica | **ROJO — 2 failed / 133 passed**; mismas dos aserciones sobre el `GET` por id | idem |
| RM11 | `catalog-import/cleanup.ts:118` | `1241b2b10bf9dada42dcdfc56424b6cef8cb45b0` | la corrida diaria vence SOLO lo vencido | **ROJO — 2 failed / 133 passed**; `expected 2 to be 1` más `expected { expired: 1, ... } to deeply equal { expired: 0, ... }` | idem |

Protocolo, en orden: `git status --short` (los cinco son `??` → copia a `/tmp/rev0090/`), `shasum`
limpio, **fila abierta en `docs/TASKS.md` antes de medir**, etiqueta en el código, medición
transcrita, reversión con `diff` contra la copia limpia y `shasum` confirmado.

### Límites — intentados, no supuestos

- **«RM4 sólo muerde contra Neon» era falso.** Lo intenté con un doble honesto y muerde sin base.
  Lo que **sí** queda para Neon del `accept`: que la transacción sea todo-o-nada de verdad y que
  el `FOR UPDATE` serialice a dos llamadas concurrentes. El doble no ejecuta Postgres.
- **«El predicado de vencimiento necesita base» también era falso.** Muerde con el doble honesto.
  Lo que queda para Neon de `cleanup.ts`: que el `ON CONFLICT DO NOTHING` sobre el único de
  `object_key` haga idempotente el encolado bajo concurrencia real.
- **Lo que el doble honesto NO hace, y está escrito en su docblock**: no ordena, no agrupa, no une
  tablas y **no entiende `or`** (tira en vez de mentir). Todo predicado con `or` —`prepare.ts`,
  `reconcile.ts`— sigue sin oráculo sin base, que es exactamente M4, la fila que ya estaba
  declarada PENDIENTE.
- **M8 sigue requiriendo Neon** por la razón de la vuelta 1 (es un discriminante del `WHERE` con
  `isNotNull` sobre `draft`, y el vector necesita filas reales que la ventana cuente). **No lo
  reintenté: está fuera del presupuesto de esta vuelta.** Nota para quien lo retome: el doble
  honesto **sí** evalúa `is not null` y `>=`, así que el límite merece un reintento.
- **No corrí `build` ni `test:e2e`.** El primero, porque esta vuelta no agrega ni cambia una ruta
  (los dos archivos de ruta volvieron a su `shasum` limpio); el segundo, porque no toqué un solo
  `.tsx` ni CSS. **Declarado, no verificado.**

### Hallazgos a decidir — NO los resolví, los sube el orquestador

1. **Los dobles de `./db` de OTRAS specs siguen descartando el `where`.**
   `catalog-import-predicado.ts` está acotado a los dobles de la 0090 a propósito (el encargo era
   no ampliar alcance), pero la clase de defecto que H2 describe —un test cuyo título afirma una
   propiedad que su doble no puede medir— es de repo, no de esta spec. **Nadie acordó barrer los
   demás: va como hallazgo.**
2. **`cleanupExpiredCatalogImports()` no toma un `now` inyectable** (usa `new Date()` adentro),
   a diferencia de `drainCleanupQueue(now)`, que sí. Los tests lo esquivan con fechas de 2020 y
   2099, así que **no es un bloqueo**; es una asimetría que encarece cualquier caso futuro que
   necesite un instante exacto. **No lo cambié: sería tocar producción sin que nadie lo pidiera.**

### Bloqueos

Ninguno.
