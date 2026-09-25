# TASKS

**Estado actual del proyecto. Este es el punto de retorno.**

Si una sesion se cae, se cierra o se compacta, se vuelve aca — no al chat. Hay un hook `Stop` que
bloquea el fin del turno si se toco codigo y este archivo quedo viejo.

Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista
en pantalla. No "deberia andar". El auto-reporte no es evidencia.

## ⇥ ESTADO (2026-09-25): SPEC 0093 COMMITEADA EN `b90c2c0`, SIN GATES Y SIN PUSHEAR

**HEAD `b90c2c0`** (codigo de la 0093, incluido «Cancelar» oculto durante la subida). `origin/main`
= **`d746a76`**: 0091/0092 YA ESTAN PUSHEADAS; la 0093 (`86f95e5` spec + `b90c2c0` codigo) **no**.
Estado de la 0093: `cerrada`, NO implementada — sin gates y sin revisor.

**El push se intento a pedido del owner y lo bloqueo el clasificador de permisos** (push a prod sin
gates). No se reintento: lo corre el owner o se pushea despues de los gates.

**El bloqueo de gates:** la Mac no tenia toolchain. `~/.nvm` ya esta instalado; **falta** Node
24.20.0, pnpm 11.4.0, `pnpm install` y `playwright install chromium` (comando en el chat, lo corre
el owner). El Stop hook falla con `turbo/eslint/vitest: command not found` por eso, no por el
codigo. El test del modulo puro corrio con el Node de Cursor + shim: 26/26, M1-M3 en rojo.

**Lo que sigue, en orden:** los 6 gates → revisor independiente → push → deploy `READY` con ese
sha → QA del owner del modal.

**Tambien hecho hoy:** email de `b4@test.com` (merchant) marcado confirmado en prod por MCP de Neon,
a pedido del owner (`email_verified = true`, releido). El MCP de Neon esta conectado al proyecto
`red-violet-38772073`. **La migracion `0043_sin_notified_at.sql` sigue sin aplicar** y el deploy de
`d746a76` no esta verificado.

## ESTADO ANTERIOR (2026-09-23): 0091 Y 0092 IMPLEMENTADAS

**El arbol esta LIMPIO**, `git status --short` vacio. HEAD es **`7edd0a6`**. **Nada esta
pusheado**, y pushear dispara deploy de produccion.

| sha | que es |
|---|---|
| `5a1b2f7` | spec 0091 — el servidor: la importacion escribe el catalogo directo |
| `9e093fe` | spec 0091 — la pantalla consume el contrato nuevo (se dividio en 5 archivos) |
| `0fa0a62` | hueco A cerrado: el empate de `createdAt` lo desempata el `id` |
| `fbed94c` | ADR 0085 (fuera el email) + ADR 0086 (bloqueo del alta) + spec 0092 |
| `7edd0a6` | spec 0092 — implementada, con PASS del revisor |

Las dos specs tienen `estado: implementada` con `PASS` de un revisor independiente (ADR 0071).

### `pnpm test:e2e` — CORRIDO Y VERDE (2026-09-23)

El owner libero el puerto 3000 y el gate corrio: **exit 0, 3 passed / 1 skipped** en 14,1 s
(`health.spec.ts` × 3 contratos de `/api/health`; `loyalty-real.spec.ts` skipeado por falta de
`E2E_*`). **Era el ultimo gate pendiente de las specs 0091 y 0092.** Los tres `next-env.d.ts`
que ensucia se revirtieron.

**La condicion exacta del bloqueo, para no volver a perder el turno:** el lock de `next dev` es
**por app, no por puerto**. `playwright.config.ts` levanta consumer en 3000, merchant en 3001 y
platform en 3002 con `reuseExistingServer`. Si el 3000 lo ocupa el dev server de **consumer**,
Playwright lo reusa y todo corre; si lo ocupa el de **merchant** —que es la app que Playwright
necesita levantar en el 3001— `next dev` se niega con *«Another next dev server is already
running»* y el gate muere sin correr un solo test. Las dos versiones que esta nota tuvo antes
(«bloquea» / «no bloquea») eran observaciones correctas de situaciones distintas.

**Los seis gates de las dos specs estan verdes.** Queda pushear.

### AL PUSHEAR, EN ESTE ORDEN — NO ES OPCIONAL

1. **Pushear** (dispara deploy de produccion).
2. **Esperar que el deploy de Vercel que sirve `checkpass.club` este `READY` con ese sha.**
3. **RECIEN AHI aplicar la migracion `0043_sin_notified_at.sql`.** El codigo que corre HOY en
   produccion **escribe** `notified_at`: aplicarla antes del deploy le rompe la importacion al
   codigo viejo (gotcha de la spec 0081). **Verificado por SQL el 2026-09-23: la columna sigue
   en la base de la app, o sea que NO se aplico.** En `ci-integration` si esta, porque
   `tools/neon-test.sh` migra antes de correr.
4. **QA del owner sobre la pantalla**, que es la unica evidencia que ningun gate de este repo
   puede dar: subir un PDF real, ver el catalogo escrito y el resumen, y ver el alta manual
   bloqueada mientras corre.

### Huecos de verificacion: estado

| hueco | estado |
|---|---|
| **A** — el empate de `createdAt` | **CERRADO** (`0fa0a62`), mutacion MA1 en rojo |
| **B** — la mitad «una sola vez» de `notified_at` | **CERRADO BORRANDO LA FUNCION** (ADR 0085) |
| **C** — la carrera real del 23505 | **VUELTA IMPROBABLE** (ADR 0086), no pinneada; ver abajo |

**Lo que sigue SIN oraculo, a proposito y declarado:**

- **El *interleaving* real del 23505.** El ADR 0086 eligio volver la carrera improbable en vez
  de pinnearla. La receta de la sonda que SI la fuerza: abrir una transaccion, insertar la
  categoria y dejarla **sin commitear**, lanzar el writer (relee y no la ve → planifica CREAR),
  esperar ~800 ms y recien ahi commitear. ~40 lineas. **El limite que dice el docblock del caso
  es mas grande que el real**: no hacen falta dos imports abiertos.
- **El guard no cierra la ventana del todo**: mira el estado en el instante del alta, asi que
  dos requests exactamente simultaneas pueden cruzarse. Por eso la recuperacion del 23505 **no
  se borro**.
- **`products.ts:141-143` afirma que el guard va ANTES de reservar la imagen** —«un 409 no deja
  nada que limpiar en R2»— y el codigo cumple, pero **nada lo pinnea**: mover el guard despues
  de `resolveImageChange` sobrevive en verde. Si se reordena en un refactor, cada alta bloqueada
  con imagen deja un objeto huerfano en R2. Se cierra con un caso Neon que cree un producto CON
  imagen y afirme que no quedo prefijo.
- **La pantalla no tiene ningun oraculo automatico.** No hay tests de componente y el e2e no
  visita `/backoffice/catalog`. La equivalencia del refactor de `catalog-page.tsx` se verifico
  **estaticamente** (cuerpos comparados contra `fbed94c`), no renderizada.
- **La calidad de extraccion del LLM**, el precio mal leido con confianza alta, y que el copy
  del bloqueo se entienda: QA, no test.

### Flake conocido de la suite Neon (NO lo introdujo la 0092)

En 1 de 3 corridas del glob `src/server/catalog` salio rojo
`catalog-import-reconcile.neon.integration.test.ts:211` (`expect(polls).toHaveLength(0)` recibio
`1`). **Causa senalada en el codigo:** `catalog-import/reconcile.ts:60-62` y `:87-89` escanean
por `status` **sin `businessId`**, y la asercion del test es global — cualquier suite
concurrente con un import abierto sembrado en la rama compartida lo dispara. Ese archivo solo:
8/8 verde. **A decidir**, no perseguido.

### Limpieza pendiente de un renglon

**`legacyDraftVersion` (`draft_version`) es una columna huerfana**: nadie la lee ni la escribe
desde la 0091. La 0092 no la toco a proposito —su migracion declara que no toca nada mas— pero
es candidata natural a irse con la proxima.

## ⇥ LAS SUITES NEON YA CORREN LOCAL (2026-09-23) — `tools/neon-test.sh`

**El limite declarado desde la 0090 —«las 6 suites `.neon.integration` NUNCA CORRIERON, 583 tests
en `skipped`»— esta levantado.** No faltaba nada del owner: faltaba la receta.

| lo que se creia | lo que era, medido |
|---|---|
| «falta `NEON_CI_DATABASE_URL`» | el codigo lee **`NEON_INTEGRATION_DATABASE_URL`** + el interlock **`NEON_INTEGRATION_ISOLATED=true`** (`catalog-import-integration-support.ts:4-7`). `NEON_CI_*` es el nombre del **secret de GitHub**; la CI traduce (`ci.yml:40,54`) |
| «esta en `.env.local`, deberia andar» | **vitest no lee `.env.local`** (`vitest.config.ts` sin dotenv): tienen que estar en el shell |
| «la clave esta cargada» | la linea 5 era el **nombre pelado, sin `=` y sin valor**. Un listado de CLAVES no dice si hay VALOR |

**Hecho:** `apps/merchant/.env.local` (git-ignored, `.gitignore:9`) ahora tiene
`NEON_CI_DATABASE_URL` y `NEON_CI_DATABASE_URL_UNPOOLED` apuntando a la rama **`ci-integration`**
(`br-icy-hat-axsfqc8k`), y nace **`tools/neon-test.sh`**, que corre la receta de `ci.yml:47-57`:
valida las dos claves, **aborta si la URL de pruebas comparte host con `DATABASE_URL`** (comparando
el host sin `-pooler`), migra la rama de CI y corre los tests. **Nunca imprime un valor.**
Las migraciones pendientes **ya se aplicaron** a `ci-integration` (estaba atras de la 0042).

**Resultado EJECUTADO:** `catalog-import.neon.integration.test.ts` → **7 passed / 7**, 24 s.

**NUNCA contra `main`.** Verificado comparando hosts: el `DATABASE_URL` de `.env.local` **es la rama
`main`** (`ep-icy-block-axsac3mu`), la que sirve `checkpass.club`. El teardown de cada archivo borra
mundos enteros. Y el flake de rama compartida **empeora** en `main`, que acumula mas filas: el
arreglo real es el fix de una linea del `seedConsumer` que espera decision en `PARQUEADO.md`, o una
rama efimera por corrida (ofrecida al owner, **sin respuesta todavia**).

**Presupuesto, medido:** unit = 171 archivos, **8,7 s** de computo, 22 s de reloj.
`.neon.integration` = 105 archivos, **11,5 s promedio cada uno** (latencia a `us-east-2`, no CPU) →
**~20 min la tanda entera**. **Regla: local van solo los archivos que toca la spec; la tanda entera
es de la CI.** Y una corrida larga en background **no sobrevive al teardown de sesion**: se murio
dos veces dejando un `ELIFECYCLE` que **parece un test rojo y no lo es** (no hay resumen de vitest).

**Credencial:** la connection string de `ci-integration` quedo en el transcript de esta sesion. El
owner dijo (2026-09-23) que **rota todo al terminar el desarrollo**.

## ⇥ ADR 0084 + SPEC 0091 REESCRITOS Y SIMPLIFICADOS (2026-09-23) — LISTOS PARA IMPLEMENTAR

**Decision del owner (2026-09-23), textual:** *«Cargar una foto o fotos o un pdf, extraer, crear,
listo, que revise a mano luego del catalogo final, que tenga un filtro para saber cuales son los
que debe revisar. No es tan complicado.»*

La primera version de los dos documentos (escrita por ChatGPT el 2026-09-22) resolvia esto
**agregando** maquinaria encima de la del 0090: contexto del catalogo en el prompt, autoaceptacion
detras de un flag, `ready` como escape hatch, tabla de trazabilidad, lock por negocio, cinco fases.
Se descarto entera. **Diagnostico de por que se complicaba:** el ADR 0082 eligio como invariante
«la IA nunca escribe el catalogo», y el borrador, las resoluciones, `draft_version`, `PUT /draft`,
`POST /accept` y `ready` son **consecuencias** de ese invariante. El 0084 nuevo **cambia el
invariante**, y al cambiarlo la maquinaria se borra.

### Los documentos que quedaron

- `adr/0084-la-importacion-de-catalogo-escribe-directo-y-solo-agrega.md` — **reescrito**.
- `specs/0091-la-importacion-de-catalogo-escribe-directo.md` — **nuevo** (el archivo
  `0091-autoaceptacion-aditiva-…` se borro). Plantilla **chica**: un dominio, **cero migraciones**,
  cero decisiones abiertas.
- `INDEX.md` — las dos filas reescritas.

### El modelo, en una linea

`subir → extraer → el SERVIDOR concilia contra el catalogo actual → crea lo que falta → resumen`.
La primera importacion y la quinta son la misma operacion. Nunca se actualiza ni se borra nada.

### Las decisiones del owner que cerraron la spec

1. **Precio que no se puede leer → producto creado SIN precio** (filtro «sin precio» en la
   pantalla). Es seguro: `counter/grant.ts:154-163` le pide el precio al operador cuando el
   producto no lo tiene. Nunca `0`.
2. **Item que no se puede leer → se DESCARTA y se lista** en el resumen, para cargarlo a mano.
3. **Sin borrador, sin revision, sin `accept`, sin reintento de submit.** Un fallo es `failed` y se
   rehace desde subir el archivo.
4. **El resumen se muestra en pantalla; el API lo prepara.** La pantalla es del owner (ADR 0070):
   la spec no toca un solo `.tsx`.

### Las dos que decidi yo (reversibles, el owner las pidio como propuesta)

- **`ready` desaparece del todo.** Ninguna decision del servidor es destructiva, asi que ninguna
  necesita un humano: el empate entre dos categorias existentes se resuelve **reusando la mas
  vieja**.
- **Sin lock por negocio y sin unique nuevo en `product`.** La unica carrera real cuesta **un
  producto duplicado**; serializar todas las escrituras de catalogo del negocio es peor que el
  problema. La carrera de **categoria** (que si tiene unique) se resuelve **reusando** ante el
  23505, en vez del `catalog_import_conflict` de hoy (`accept.ts:218-231`).

### Lo que la spec BORRA (es su firma: quita mas de lo que agrega)

`draft.ts` (273 lineas), `draft-save.ts` (98), `accept.ts` (243, reemplazado por el writer interno),
las rutas `imports/[id]/draft` y `imports/[id]/accept`, el estado `ready`, `draft_version` y cuatro
codigos de error (`catalog_import_version`, `unresolved_catalog_import`, `invalid_catalog_draft`,
`catalog_import_conflict`). La columna `draft` **queda** pero cambia de rol: guarda la extraccion
cruda (diagnostico) y sigue siendo el discriminante del cupo (`quota.ts:60-70`).

### Lo que sigue, en orden

1. **Commitear primero el trabajo sin commitear** de la cancelacion inmediata (ver abajo), que
   colisiona con esta spec.
2. Implementar la 0091: **UN implementador, UN revisor** (ADR 0071). Presupuesto **6 mutaciones**.
3. Las **dos suites Neon** de la spec (dos writers concurrentes; categoria creada en paralelo) son
   DoD y tienen que **correr, no quedar `skipped`**.
4. El **corpus de 15-25 menus reales** sigue pendiente y es lo unico que puede medir la calidad de
   la extraccion. No bloquea la spec.

### EL ARBOL AHORA MISMO

**Commiteado en `53b5765` — cancelacion inmediata en `analyzing`.** `DELETE` sobre un import en
`analyzing` ya no deja el estado esperando al callback: pasa a `cancelled` en el momento, libera el
lease y conserva la marca de intencion; si el import llego a `accepted` entre el `SELECT` y el
`UPDATE` condicional se responde `409 catalog_import_already_accepted` en vez de confirmar una
cancelacion que no ocurrio (tiene su test). Toca `catalog-import/core.ts`,
`api/catalog/imports/[id]/route.ts`, dos suites y los dos docs de la 0090.
**Gates corridos con Node 24 antes del commit:** `typecheck`, `lint`, `test` (**1737 passed, 0
failed**, 583 `skipped` = las suites Neon), `build`. **Sin pushear todavia.**

**SIGUE SIN COMMITEAR — UI en curso del owner:** `backoffice/catalog/catalog-ai-import.tsx`
(drag&drop, auto-`analyze` al soltar un PDF, generacion de poll, `use-is-touch`) + `globals.css`.
No lo toque. **`format:check` esta ROJO por ese archivo** y por eso no entro al commit; cuando se
commitee hay que formatearlo (`pnpm exec prettier --write`, **nunca** `pnpm format`, que
reformatea trabajo ajeno) y correr `test:e2e`, que ahi SI aplica.

### Dato corregido de este archivo

`CATALOG_IMPORT_RECONCILE_ENDPOINT` **ya esta cargado** en Actions (`gh secret list`, 2026-09-23
00:40 UTC): la seccion de mas abajo que dice «Falta en GitHub Actions» quedo vieja. Lo que sigue sin
comprobarse es un `HTTP 200` real del workflow — un nombre mal escrito lo deja verde con `exit 0`.

## ⇥ ESTADO AL CIERRE DE LA SESION DEL 2026-09-23

### Lo que se hizo, con su sha

| sha | que es |
|---|---|
| `59063a8` | diagnostico seguro del fallo de OpenAI (`keyFingerprint`, `keyLength`, `keyHasOuterWhitespace`, `errorCode`, `x-request-id`) + su test |
| `11b0c12` | prettier sobre los 9 archivos de UI/CSS que dejaban rojo `format:check` desde `7c423a9` |
| `bce921f` | el diagnostico del 401 en `TASKS.md` |
| `16512a9` | **cupo de analisis a 100/dia** (valor de PRUEBAS) |
| `7ecd363` | fix de la suite del checklist: describia CINCO items y el catalogo tiene SEIS |

### 0. DESPLEGADO EN PRODUCCION (2026-09-23)

`dpl_CC4HNKCXBpkX2AhXEW4Jm1u1WEfp` — sha **`6ae0d33`**, `state: READY`, `aliasError: null`, con
`checkpass.club` y `www.checkpass.club` apuntando ahi. **Prod ya tiene el cupo en 100** (`16512a9`
es ancestro) y el diagnostico del 401 (`59063a8`). Vercel despliega solo en cada push a `main`: no
hace falta disparar nada a mano.

### 1. EL 401 DE PROD: es la clave de Vercel, no el codigo — **PENDIENTE DEL OWNER**

Ver la seccion «EL 401 DE OPENAI EN PROD» mas abajo, que tiene las sondas y sus resultados.
**Resumen: re-cargar `OPENAI_API_KEY` en Vercel (production) con el valor que anda, y
redesplegar.** El valor es tipo `sensitive` y no se puede leer ni por API ni por dashboard, asi
que la comparacion se hace por el log: con `59063a8` desplegado, repetir el import y mirar
`catalog_import_openai_request_failed` en los runtime logs.

- `keyFingerprint` ≠ **`aed315b6196e`** → la clave de Vercel es otra.
- `keyHasOuterWhitespace: true` → se pego con espacio o salto de linea.
- `keyLength` ≠ **164** → esta truncada.

### 2. EL CUPO ESTA EN VALOR DE PRUEBAS (100), Y HAY QUE BAJARLO

**Decision del owner (2026-09-23): «quita el limite de 1 analisis diario […] ahora puedes subirla
a 100 para las pruebas», y vuelve a 1 mas adelante.** Los dos topes viven en **un solo lugar**,
`entitlements/catalog.ts`, con su valor de produccion escrito en el docblock:

| clave | produccion | hoy |
|---|---|---|
| `catalog.imports.analyses` | **1** | 100 |
| `catalog.imports.attempts` | **3** | 100 |

**El segundo lo subi yo y NO es decision del owner:** es el otro techo del mismo camino y a 3
habria cortado la prueba en el cuarto submit aceptado, que es justo lo que pidio evitar. Si no
queria eso, se baja solo esa fila.

Subir un tope **no es apagarlo**: sigue el `429` con `Retry-After`, la ventana `day` y los
discriminantes (`draft IS NOT NULL` / `provider IS NOT NULL`). Hay un caso que lo pinnea («el cupo
NO quedó apagado: sigue siendo un número finito y positivo»), el que se pondria rojo si alguien
«sacara el limite» con `0`, `Infinity` o borrando la clave.

**Cuatro suites dejaron de escribir el tope a mano y lo toman del catalogo** — miden la DECISION
(el borde `used < limit`, que filas cuenta el `WHERE`, que el 429 llega antes de escribir), no el
valor. **El valor se transcribe y se pinnea en `entitlements-window.test.ts`**, que es el archivo
que hay que tocar cuando el tope vuelva a 1 y 3.

**VERIFICADO con mutaciones** (presupuesto: 3; clase de error: que esos tests se hubieran vuelto
tautologicos; declarado afuera: el predicado del `WHERE` de `usedInWindow`, que necesita Neon):

| id | archivo | shasum limpio | resultado EJECUTADO |
|---|---|---|---|
| Q1 | `catalog-import/quota.ts` (`used < limit` → `used <= limit`) | `e4d729cb59bbf87dd7d361f98b9d7a7772fd18f1` | **ROJO, 2 casos**, `expected true to be false` sobre el borde. Revertida |
| Q2 | `catalog-import/prepare.ts` (el cableado, borrado) | `85b6c239b2bf551e6ad4aba69598459978fa934d` | **ROJO**, `expected 'submitted' to be 'failed'` — el submit llego al proveedor. Revertida |
| Q3 | `catalog-import/core.ts` (`assertQuota(attempts)`, borrado) | `f1dd1ab75e59baa8f244d9a541d2a326b6a85a20` | **ROJO PERO POR EL MOTIVO EQUIVOCADO** — ver abajo. Revertida |

**Arbol sin mutaciones** (`grep -rn 'MUTATION|MUTACION' apps/*/src` → 0 hits) y los tres `shasum`
de vuelta en el valor de la tabla, con `diff` vacio contra `/tmp/q0090/`.

**LIMITE DECLARADO (Q3):** el doble de `./db` es una **cola posicional**, asi que borrar una
consulta lo deja sin filas y el rojo es un `TypeError`, no la propiedad. Intente repararlo
alargando la cola; **no alcanzo**, y revertí la reparacion en vez de dejar un docblock afirmando un
oraculo inexistente. **El cableado de `assertQuota` en `core.ts` no tiene oraculo a nivel unidad y
no lo puede tener con este doble**; su oraculo real es `catalog-import-quota.neon.integration.test.ts`.
Caso en `LECCIONES.md`, regla en la skill (2.0-septies).

### 3. `main` QUEDO ROJO CON EL PRIMER PUSH — arreglado en `7ecd363`, **CI SIN LEER**

`verify` de `bce921f` fallo con **5 tests** de `onboarding-checklist.neon.integration.test.ts`.
**No era de la importacion de catalogo**: es el hueco que este archivo ya declaraba —las 6 suites
`.neon.integration` nunca habian corrido— destapado por el primer push en dos dias.

Causa raiz unica: `5bfd152` sumo `locations` al checklist (ADR 0081) y la suite seguia aseverando
los cinco items de la 0085. **Cuatro de los cinco rojos acusaban `verify-email` y el defecto era
`locations`**, porque el `setVerified(seed, false)` estaba como ultima linea del cuerpo y al cortarse
el caso nunca corrio. Ahora va en `finally`. Caso en `LECCIONES.md`, regla en la skill (2.0-octies).

**Lo que ese fix NO tiene es verificacion ejecutada:** la suite queda `skipped` local y ningun gate
local la corre. **Por instruccion del owner (2026-09-23) NO se espera a la CI** — tarda y bloquea el
turno—, asi que el fix esta pusheado sin leer su resultado. Es un arreglo mecanico (seis items en
vez de cinco, el reset en `finally`) y el riesgo es bajo, pero **esta declarado, no verificado**. Si
alguna vez se quiere mirar, el resultado esta en la pestaña Actions del repo.

### 4. GOTCHA NUEVO, MEDIDO: el `.env` de integracion apunta a la rama EQUIVOCADA

`.env.integration.local` tiene `NEON_INTEGRATION_DATABASE_URL` → **`ep-spring-moon-axt4mngw`**, que
es la rama efimera **`spec-0065-marketing`** (`br-shy-king-axu5s3ze`, **expira el 2026-10-15**), NO
`ci-integration` (`ep-plain-firefly-axzyzpfz`). Verificado por MCP de Neon. Esa rama se corto de
`main` el **2026-09-11**, o sea **antes de la migracion 0042**: las tablas `catalog_import*` no
existen ahi. **Correr las suites de integracion local hoy no mide lo que parece.** Para arreglarlo
hay que apuntar esa variable al pooled host de `ci-integration`.

### 5. ⚠️ SE VOLVIO A FILTRAR LA PASSWORD DE `neondb_owner` — LA ROTACION YA NO ES OPCIONAL

Un script mio imprimio los primeros 40 caracteres de
`NEON_INTEGRATION_DATABASE_URL_UNPOOLED`, incluida la cabeza de la password. Es **la misma
credencial** que este archivo ya tenia marcada para rotar desde el 2026-09-22. Segunda fuga de la
misma clave. Caso y regla en `LECCIONES.md`; el fix estructural es la linea nueva de `CLAUDE.md` y
la deny-list de `.claude/settings.json`, que paso de `Read(**/.env.local)` a `Read(**/.env*)`.

### Gates de esta sesion

Los SEIS, con Node 24, sobre el arbol de `7ecd363`: `typecheck` 3/3 `Cached: 0`, `lint` limpio,
`test` **171 archivos / 1735 passed, 0 failed** (583 `skipped` = las `.neon.integration`),
`build` 3/3, `format:check` limpio, `test:e2e` 3 passed / 1 skipped.

## BITACORA DE MUTACIONES — SPEC 0093 (2026-09-24): **TODAS REVERTIDAS**

Archivo `apps/merchant/src/app/backoffice/catalog/catalog-ai-import-state.ts` (**untracked `??`**:
`git checkout` NO lo restaura). Copia limpia en
`/private/tmp/claude-501/-Volumes-NAS-claude-workspace-check-point/554f8fd7-9e24-4a16-8497-56eb7f0ba239/scratchpad/catalog-ai-import-state.clean.ts`.
**shasum limpio `339c1a515899b2b40900716de0abe85662c307d6`.** Restaurar: `cp <copia> <archivo>`.
Medicion: el test real corrido con Node 24.18.1 (el de Cursor) y un shim de `vitest` — la maquina
NO tiene `node_modules`, ni `nvm`, ni Node en el PATH: **vitest real y los gates de root NO se
corrieron**. `grep -rn MUTATION apps tools` → sin hits.

| id | invariante | resultado EJECUTADO |
|---|---|---|
| M1 | `isProcessing` sin el caso `pending_upload && busy` | ROJO 1/23: `isProcessing > pending_upload con busy=true` — `expected false to be true`. Revertida: `diff` vacio, shasum `339c1a51…` |
| M2 | `importToShow` filtra por id sin mirar `status` | ROJO 1/23: `importToShow > un import en curso con el mismo id NO se esconde` — `expected null to be {"id":"imp-1","status":"analyzing",…}`. Revertida: `diff` vacio, shasum `339c1a51…` |
| M3 | `processingMessage` con `tick % (length - 1)` | ROJO 1/23: `processingMessage > rota en orden y vuelve al principio` — `expected "Esperá, estamos procesando tu menú…" to be "Ya casi: estamos cargando los productos…"` (el caso `tick = length - 1`). Revertida: `diff` vacio, shasum `339c1a51…` |

### 0093 — RE-MEDICION tras la enmienda del owner (`importToShow(found)`): **TODAS REVERTIDAS**

Mismo archivo, **shasum limpio NUEVO `b1089a7c8277c9b681e262b97308b04aff656423`**, copia en
`.../scratchpad/catalog-ai-import-state.clean2.ts`. Restaurar: `cp <copia> <archivo>`.

| id | invariante | resultado EJECUTADO |
|---|---|---|
| M1' | `isProcessing` sin `pending_upload && busy` | ROJO 1/26: `isProcessing > pending_upload con busy=true` — `expected false to be true`. Revertida, `diff` vacio, shasum `b1089a7c…` |
| M2' | `importToShow` esconde tambien los terminales (se come el `failed`) | ROJO 4/26: `un failed se muestra tal cual` — `expected null to be {…"status":"failed"…}`; tambien `pending_upload`, `cancelled`, `expired`. Revertida, `diff` vacio, shasum `b1089a7c…` |
| M3' | `processingMessage` con `tick % (length - 1)` | ROJO 1/26: `rota en orden y vuelve al principio` — `expected "Esperá, estamos procesando tu menú…" to be "Ya casi: estamos cargando los productos…"`. Revertida, `diff` vacio, shasum `b1089a7c…` |

## BITACORA DE MUTACIONES — SPEC 0090 (2026-09-22): **TODAS REVERTIDAS**

Se abrio ANTES de medir cada fila, como exige la skill `protocolo-de-verificacion`, y se cierra
acá. **Barrido `grep -rn 'MUTATION|MUTACION' apps/*/src packages` → ARBOL LIMPIO**, `diff` vacio
contra las copias limpias de `/tmp/m0090/` y los `shasum` coinciden.

| id | archivo | shasum limpio VERIFICADO | estado |
|---|---|---|---|
| M1, M2 | `catalog-import/providers/openai-callback.ts` | `3b8008ad91364e76b94dcd27018fc675904d8dba` | medidas y revertidas |
| M3 | `catalog-import/callback.ts` | `e1780ec882c9e382e4ef0529e4fee3f75fe2fea8` | medida y revertida |
| M4 | `catalog-import/prepare.ts` / `catalog-import/reconcile.ts` | `fc91d6b904105229c8e7ccf6bb50844826085bbb` / `1aca5d1fc50b1d9163bd65e29c00a86097923c29` | **PENDIENTE — requiere Neon** (no aplicada) |
| M5, M6 | `catalog-import/accept.ts` | `176654521b5afab20f7b2634f4ed19ee80c7e315` | medidas y revertidas |
| M7, M9 | `catalog-import/core.ts` | `a5368fb89c1e417afdc965bd500c22804ef1dd23` | medidas y revertidas |
| M8 | `catalog-import/quota.ts` | `d34f8634150896a8b3365e9bdc3174ac85563326` | **PENDIENTE — requiere Neon** (no aplicada) |
| M10a (regla) | `catalog-import/quota.ts` | `d34f8634150896a8b3365e9bdc3174ac85563326` | medida y revertida |
| M10b (cableado) | `catalog-import/prepare.ts` | `fc91d6b904105229c8e7ccf6bb50844826085bbb` | medida y revertida |

Si alguna vez hiciera falta restaurar: `cp /tmp/m0090/<archivo>.ts <destino>` y comparar el
`shasum` con la tabla. **El resultado EJECUTADO de cada fila esta en
`docs/handoff-0090-implementacion-2026-09-22.md`.**

### Vuelta 2 — re-mediciones del FAIL del revisor (2026-09-22): **TODAS REVERTIDAS**

Los cinco archivos mutados son `??` (sin blob en git): **`git checkout` NO los restaura**. Las
copias limpias estan en `/tmp/rev0090/`. Se verifico `diff` vacio contra cada una y el `shasum`
de los cinco vuelve al valor de la tabla. **`rg -n 'MUTATION|MUTACION' apps/` → sin hits**, con
control positivo (un archivo con la etiqueta da hit).

| id | archivo:linea | shasum limpio VERIFICADO | invariante que ataca | resultado EJECUTADO |
|---|---|---|---|---|
| RM3 | `catalog-import/core.ts:97` (`eq(businessId)` de `requireImport`) | `a5368fb89c1e417afdc965bd500c22804ef1dd23` | un import ajeno da el mismo 404 que uno inexistente | **ROJO — 1 failed / 134 passed**, revertida |
| RM4 | `catalog-import/accept.ts:43` (`eq(businessId)` del `SELECT … FOR UPDATE`) | `176654521b5afab20f7b2634f4ed19ee80c7e315` | la ruta que ESCRIBE no materializa el menu ajeno como catalogo propio | **ROJO — 1 failed / 134 passed**, revertida. **NO requeria Neon** |
| RM6 | `api/catalog/imports/route.ts:43` (`toImportDTO(row)` del `GET` del activo) | `a16c9f3a16504668045e4a4b2c52b363ccdc9f43` | la RUTA aplica la allow-list, no solo la funcion | **ROJO — 2 failed / 133 passed**, revertida |
| RM6b | `api/catalog/imports/[id]/route.ts:22` (`toImportDTO(row)` del `GET` por id) | `2be124d22ae6015a8548a9f750579b4d733122fe` | la SEGUNDA ruta que serializa un import tambien aplica la allow-list | **ROJO — 2 failed / 133 passed**, revertida |
| RM11 | `catalog-import/cleanup.ts:118` (`lte(expiresAt, now)`) | `1241b2b10bf9dada42dcdfc56424b6cef8cb45b0` | la corrida diaria vence SOLO lo vencido, no todo import abierto de todo negocio | **ROJO — 2 failed / 133 passed**, revertida. **NO requeria Neon** |

Restauracion, si alguna vez hiciera falta:
`cp /tmp/rev0090/catalog-import__core.ts apps/merchant/src/server/catalog-import/core.ts`
`cp /tmp/rev0090/catalog-import__accept.ts apps/merchant/src/server/catalog-import/accept.ts`
`cp /tmp/rev0090/imports__route.ts apps/merchant/src/app/api/catalog/imports/route.ts`
`cp /tmp/rev0090/imports__id__route.ts "apps/merchant/src/app/api/catalog/imports/[id]/route.ts"`
`cp /tmp/rev0090/catalog-import__cleanup.ts apps/merchant/src/server/catalog-import/cleanup.ts`

**El resultado completo de cada fila —la asercion textual del rojo— esta en
`docs/handoff-0090-implementacion-2026-09-22.md`, seccion «Vuelta 2».**

## ⇥ SPEC 0090 — **IMPLEMENTADA** (2026-09-22), POR INSTRUCCION DEL OWNER

`estado: implementada` en el frontmatter, fila del `INDEX` actualizada, y el estado real escrito en
la propia spec (seccion «Estado de cierre») para que la marca no diga mas de lo que se midio.

**Verificado:** PASS de revisor independiente en **dos vueltas** (vuelta 1 FAIL con cinco mutaciones
sobrevivientes → cuatro arreglos → vuelta 2 con las cinco en ROJO a alcance completo), mas un tercer
hermano del aislamiento cerrado por el orquestador. Cinco gates verdes: `typecheck` 3/3 `Cached: 0`,
`lint`, `test` **171 archivos / 1731 tests**, `build` 3/3 `Cached: 0`, `format:check` rojo **solo**
en los 10 del WIP del owner. Arbol sin mutaciones. Migracion aplicada y verificada por MCP.

**LO QUE SIGUE SIN VERIFICAR, y por eso esta escrito y no escondido: las 6 suites
`.neon.integration` NUNCA CORRIERON** — 583 tests en `skipped`, y **un `skipped` se lee igual que un
`passed`**. Sin oraculo ejecutado: **M4** (dos reconciliadores concurrentes), **M8** (un `failed` no
consume el cupo), **media M9** (el borrador sobrevive al 409), **RM1** (el borde de `assertQuota`) y
la **atomicidad real del `accept`**. **Las corre la CI al pushear** (`ci.yml:36-58`, contra
`ci-integration`, y falla fuerte si falta el secret). **Al 2026-09-22 no se habia pusheado.**

**Lo que falta para que ande en prod** (nada de esto bloquea la marca, es config del owner):

1. **Push** — cierra el hueco de integracion y corre `test:e2e`, el unico gate que nadie corre local.
   Hay commits locales sin subir, y `format:check` va a fallar por los **10 archivos de UI del
   owner** hasta que se formateen.
2. **Deploy**, y **DESPUES** el secret `CATALOG_IMPORT_RECONCILE_ENDPOINT` en GitHub — hoy esa URL da
   **404** y cargarlo antes deja el workflow rojo cada 5 minutos. Al cargarlo, dispararlo a mano
   (`workflow_dispatch`) y ver un `HTTP 200`: el workflow hace `exit 0` si el secret falta, asi que
   un nombre mal escrito queda **verde y muerto**.
3. **Envs de Vercel**: `OPENAI_API_KEY`, `OPENAI_WEBHOOK_SECRET`, `CATALOG_EXTRACTION_PROVIDER`,
   `CATALOG_EXTRACTION_MODEL`. `CRON_SECRET` ya esta en los tres lugares (rotado por el owner el
   2026-09-22).
4. **Rotar la password del rol `neondb_owner`** — la connection string quedo en el transcript.
5. **El corpus manual de 15-25 menus** (ADR 0082 §2) antes de fijar el modelo productivo. Y con el se
   responde el limite declarado: **si el modelo acepta `background: true`**, que la doc de OpenAI no
   lista como capacidad de ningun modelo porque es parametro de la Responses API.

**La UI** la construye el owner por fuera: contrato en `specs/0090-contratos-de-api.md`, punto de
partida en `docs/handoff-ui-importacion-catalogo-2026-09-22.md`.

## ⇥ MIGRACION 0042 APLICADA EN NEON `main` (2026-09-22) — VERIFICADA

Decision del owner: **directo a `main`, sin rama efimera**. Aplicada con
`DATABASE_URL_UNPOOLED=... pnpm --filter @mi-pasaporte/merchant db:migrate` (host **sin** `-pooler`).

| | antes | despues |
|---|---|---|
| filas en `drizzle.__drizzle_migrations` | 42 | **43** |
| tablas `core.catalog_import*` | 0 | **3** |
| indices de la feature | 0 | **10** |
| tablas en `core` / `merchant_auth` | — | 33 / 5, **intactas** |

Verificado **por MCP, no por el output del comando**. Los dos indices que sostienen invariantes del
diseno quedaron con el predicado correcto: el **parcial** de un import abierto por negocio
(`WHERE status = ANY (...)`) y el unico de `provider_job_id` **cuando no es null**, que es la llave
con la que entra el callback.

La migracion es **puramente aditiva** (3 `CREATE TABLE` + FKs + indices, **cero `ALTER`, cero
`DROP`**), asi que no puede romper el codigo viejo que corre en prod.

**⚠️ PENDIENTE DEL OWNER: rotar la password del rol `neondb_owner`.** La connection string se pego
en el transcript de la sesion del 2026-09-22 (es la unica forma de correr `drizzle-kit` desde acá).

### Configuracion de prod: lo que YA esta y lo que falta

**Ya existen** — `CRON_SECRET` en **Vercel** (desde 2026-08-15) y en **GitHub Actions**. No hay que
crearlo.

**~~Faltan~~ YA ESTAN en Vercel** (cargadas por el owner el 2026-09-22 22:11-22:12 UTC,
verificado por MCP): `OPENAI_API_KEY`, `OPENAI_WEBHOOK_SECRET`, `CATALOG_EXTRACTION_PROVIDER`,
`CATALOG_EXTRACTION_MODEL`, `CATALOG_EXTRACTION_PROMPT_VERSION`. **Pero el valor de
`OPENAI_API_KEY` no sirve: prod da `openai_http_401`** — ver «EL 401 DE OPENAI EN PROD».

**Falta en GitHub Actions:** `CATALOG_IMPORT_RECONCILE_ENDPOINT`.

**EL ORDEN IMPORTA Y SE MIDIO.** Hoy el apex hace `308` a `www` y
`https://www.checkpass.club/api/internal/catalog-imports/reconcile` devuelve **404**, porque el
codigo no esta desplegado. El workflow corre `*/5` y hoy esta **verde y silencioso** porque sin
secrets hace `exit 0`. **Si se carga el secret ANTES del deploy, pasa a fallar cada 5 minutos.**
Primero el deploy, despues el secret.

**Y su riesgo espejo, de la misma familia que un test `skipped`:** ese `exit 0` significa que **un
nombre de secret mal escrito deja el workflow VERDE y el reconciliador sin correr para siempre**.
Despues de cargarlo hay que disparar el workflow a mano (`workflow_dispatch`) y ver un `HTTP 200`.

### El modelo del proveedor — investigado el 2026-09-22 contra la doc oficial

El codigo tiene `gpt-5-mini` de default (`providers/provider.ts:34`). Precios oficiales por 1M
tokens (input / cached / output) y costo estimado por menu, con la normalizacion de la spec
(JPEG, lado mayor 2048 px → **~3.000 tokens de imagen por pagina**, patches de 32 px × 1,2):

| modelo | in | out | 1 foto | PDF 10 pag |
|---|---|---|---|---|
| gpt-5-nano | $0,05 | $0,40 | ~$0,0014 | ~$0,005 |
| **gpt-6-luna** | **$0,10** | **$0,50** | **~$0,002** | **~$0,007** |
| gpt-5-mini *(default actual)* | $0,25 | $2,00 | ~$0,007 | ~$0,024 |
| gpt-6-sol | $2,00 | $10,00 | ~$0,04 | ~$0,14 |

**La conclusion que importa: a 1 analisis por negocio por dia, el costo NO es la restriccion.** La
diferencia entre el mas barato y el de gama media es **menos de cuatro centavos por menu**. Un
precio mal leido cuesta mucho mas que eso. **Se optimiza precision, no centavos.**

**Recomendado: `gpt-6-luna`** — es **mas barato que el default actual** ($0,10/$0,50 vs $0,25/$2),
mas nuevo, tiene **reasoning tokens** (util para el caso `$3,50` vs `$35,00` que la spec llama
`ambiguous`), ventana de 1.050.000 y lista `image_input` + `structured_outputs`. Si el corpus
muestra que falla en fotos inclinadas o con poca luz, se sube a `gpt-6-sol`, que sigue costando
centavos. **NO bajar a la gama nano:** ahorra ~$0,0005 por menu y la gama nano es la mas debil en
OCR denso.

**LIMITE DECLARADO, y hay que medirlo antes de fijar el modelo:** la doc **no lista `background`
como capacidad de ningun modelo** —tampoco del `gpt-5-mini` que el codigo ya usa—, porque es un
parametro de la **Responses API**, no un flag por modelo. El adaptador pega a `/v1/responses` con
`background: true`. **Que el modelo elegido lo acepte se verifica INTENTANDOLO con una clave real**,
no leyendo la doc. Es el gate que decide si la arquitectura de callback funciona.

Y sigue en pie el ADR 0082 §2: el modelo productivo se confirma con el **corpus manual de 15-25
menus reales** (foto clara, inclinada, poca luz, dos columnas, coma vs punto decimal, PDF digital y
escaneado), registrando precision, error de precio y tokens.

## ⇥ EL 401 DE OPENAI EN PROD (2026-09-23) — **ES LA CLAVE DE VERCEL, NO EL CODIGO**

Sintoma: `catalog_import_provider_start_failed { provider: 'openai', model: 'gpt-6-luna',
reason: 'openai_http_401' }` seguido de `catalog_import_failed { code: 'provider_unavailable' }`,
en **produccion** (`dpl_YK1NKScSzxVt7Z6FSKv8qXbQp9si` a las 00:21 UTC y
`dpl_8wQj6quajSMHua9bQk8ov2izZEEW` a las 00:42 UTC, los dos en `main`), leido por MCP de Vercel.

**Medido con la clave de `apps/merchant/.env.local`, contra `api.openai.com` de verdad:**

| sonda | resultado EJECUTADO |
|---|---|
| `GET /v1/models` | **200** |
| `GET /v1/models/gpt-6-luna` | **200** — el modelo existe y la cuenta lo tiene |
| `POST /v1/responses` con el **cuerpo exacto de `start()`** (prompt real, PDF real, `tools: []`, `text.format` `json_schema` `strict: true`) | **200**, `status: queued` |
| `GET /v1/responses/{id}` (el `poll()`) | **`completed`** — JSON valido: 2 categorias, 3 productos, los tres precios correctos, `warnings: []`, `usage` 468 in / 220 out (53 de reasoning) |

Metadatos de esa clave, **sin imprimirla**: `sk-proj`, 164 caracteres, sin comillas, sin espacios
al borde, sin CR, huella `sha256[0..12] = aed315b6196e`.

**Conclusion: el adaptador, el modelo y el esquema estan bien. La unica variable que cambia entre
el 200 local y el 401 de prod es el VALOR de `OPENAI_API_KEY` en Vercel** (creada el 2026-09-22
22:11 UTC, tipo `sensitive` → ilegible incluso con `decrypt`, ni por API ni por dashboard).
Causas tipicas, en orden: clave pegada **truncada** desde el dashboard de OpenAI (la vista
enmascarada `sk-proj-...XYZ` se copia entera y no sirve), **salto de linea o espacio al final**
al pegarla, o una clave **de otro proyecto / revocada**.

**Fix: re-cargar `OPENAI_API_KEY` en Vercel (production) con el valor que dio 200 acá, y
REDESPLEGAR** — las env de Vercel entran por build, no en caliente.

**Como se comprueba sin adivinar — YA COMMITEADO Y PUSHEADO:** `59063a8` hace que el log
del 401 emita `keyFingerprint`, `keyLength` y `keyHasOuterWhitespace`. Cuando ese sha este
desplegado, **una huella distinta de `aed315b6196e` prueba que la clave de Vercel es otra, y
`keyHasOuterWhitespace: true` prueba el pegado sucio.** Verificado que `safeProviderFailure` solo
alimenta el `console.warn`: el `failureDetail` que se persiste sale de `classify()`, que no
cambio, asi que no toca lo que ve el merchant.

**Como se lee el log:** `POST /api/catalog/imports/<id>/analyze` en prod, y despues
`catalog_import_openai_request_failed` (el `console.warn` nuevo del adaptador) o
`catalog_import_provider_start_failed` (el de `prepare.ts`, que ahora lleva el objeto entero
en `reason`). Los dos salen por los runtime logs de Vercel.

**Las sondas quedaron en `/tmp/probe-openai.mjs`, `/tmp/probe-responses.mjs` y
`/tmp/probe-adapter.mjs`** (leen la clave del `.env.local` y **nunca la imprimen**), con el PDF
de prueba en `/tmp/menu-prueba.pdf`, generado por `/tmp/make-pdf.mjs`.

### ESTADO tras el push del 2026-09-23

| sha | que es |
|---|---|
| `59063a8` | el diagnostico seguro del fallo de OpenAI + su test |
| `11b0c12` | prettier sobre los 9 archivos de UI/CSS que dejaban rojo `format:check` desde `7c423a9` |

**Los SEIS gates corridos antes del push, con Node 24:** `typecheck` 3/3 `Cached: 0`, `lint`
(eslint limpio), `test` **171 archivos / 1734 passed, 0 failed** (583 `skipped`, que son las
`.neon.integration`), `build` 3/3, `format:check` limpio, y **`test:e2e` 3 passed / 1 skipped**
(el `loyalty-real` se saltea sin base).

**Lo que NO se verifico acá y lo cierra la CI:** las 6 suites `.neon.integration` —583 tests que
local quedan en `skipped`— corren en el push contra `ci-integration`. **Un `skipped` se lee igual
que un `passed`**, asi que el resultado hay que mirarlo en los *check runs*, no en `/status`:
`GH_TOKEN= gh api repos/maxhost/check-point/commits/<sha>/check-runs --jq '.check_runs[] |
"\(.name): \(.status) -> \(.conclusion)"'`.

**`apps/merchant/next-env.d.ts` NO entro al push**: el `build` lo reescribe de
`./.next/dev/types/` a `./.next/types/` y `next dev` lo vuelve a dar vuelta. Es churn de
artefacto, no trabajo.

### Esto CIERRA el limite declarado del modelo

`docs/TASKS.md` declaraba sin medir: «**si el modelo acepta `background: true`**, que la doc de
OpenAI no lista como capacidad de ningun modelo». **Medido: `gpt-6-luna` lo acepta** — devolvio
`queued` al instante y el `poll` lo levanto `completed`. La arquitectura de callback diferido
funciona contra el modelo elegido. Sigue en pie lo otro del ADR 0082 §2: el **corpus de 15-25
menus reales** (foto inclinada, poca luz, dos columnas, coma vs punto) antes de fijarlo. Lo de acá
fue **un PDF digital sintetico de 8 lineas**, que no dice nada de precision en fotos.

## BITACORA — ORQUESTADOR, EL TERCER HERMANO DEL AISLAMIENTO (2026-09-22)

Abierta ANTES de medir. El revisor de la vuelta 2 encontro que `activeImport`
(`catalog-import/core.ts:76`) es el **tercer miembro** de la clase de H1/H2 y **no tiene oraculo**.

| id | archivo | shasum limpio | invariante | resultado |
|---|---|---|---|---|
| ORQ-RM12 | `catalog-import/core.ts` (`:76`, el `eq(businessId)` de `activeImport`) | `a5368fb89c1e417afdc965bd500c22804ef1dd23` | `GET /api/catalog/imports` **no devuelve el import abierto de otro negocio** | **antes: VERDE (1718 passed) — despues del oraculo: ROJO** |

**Medido en DOS tiempos, que es lo que prueba que el oraculo es el oraculo:**

1. **Sin el caso nuevo** (reproduciendo el hallazgo del revisor): borrar el filtro deja
   **1718 passed / 0 failed**, alcance `vitest run src` (todo `apps/merchant/src`). **Sobrevive.**
2. **Con el caso nuevo**, la MISMA mutacion: **1 failed / 1718 passed**.
   `catalog-import-routes.test.ts > «el import abierto de OTRO negocio no se devuelve (y el propio
   si)»` → `AssertionError: expected { import: { …(8) } } to deeply equal { import: null }`.
   La asercion habla de **la propiedad** (devolvio el import ajeno), no del setup.

**Por que importaba:** `GET /api/catalog/imports` es —contrato §1.bis— **la PRIMERA llamada que hace
la pantalla**, y devuelve el import **con su `draft`**. Sin el filtro, un merchant abriendo el modal
veia el menu de otro comercio. Es el **TERCER hermano** de la clase de H1/H2: los otros dos ganaron
su oraculo al cerrar el FAIL, este quedo afuera del barrido. **Leccion 2.0-sexies otra vez: un
defecto de clase cerrado en dos miembros de tres.**

El caso viejo (`estado.filas = [[]]`) **no** servia de oraculo: media «si la base no devuelve filas,
contestamos null», cierto con y sin filtro. El nuevo siembra una fila que **existe y esta abierta**
cuyo unico defecto es el negocio, y lleva su **control positivo** en el mismo vector.

**REVERTIDA Y VERIFICADA:** `diff` vacio contra `/tmp/orq0090/core.ts`, `shasum` de vuelta en
`a5368fb89c1e417afdc965bd500c22804ef1dd23`, `grep` de etiquetas sin hits, `no-mutations-left.sh`
EXIT=0.

## BITACORA DE MUTACIONES — ORQUESTADOR, VERIFICACION DEL FIX DEL FAIL (2026-09-22)

Abierta ANTES de medir, como exige la skill. Reproduzco **yo** la fila mas consecuente del arreglo
del revisor en vez de creerle al reporte del subagente.

| id | archivo | shasum limpio | invariante que ataca | resultado |
|---|---|---|---|---|
| ORQ-RM4 | `catalog-import/accept.ts` (`:43`, el `eq(businessId)` del `SELECT … FOR UPDATE`) | `176654521b5afab20f7b2634f4ed19ee80c7e315` | el `accept` —**la ruta que ESCRIBE**— no acepta un import ajeno | **ROJA, motivo correcto — 1 failed / 1446 passed** |

**Resultado EJECUTADO**, `catalog-import-accept-states.test.ts:141` («un import de OTRO negocio es
404 y NO crea una sola fila de catalogo»):

```
- "message": "rejected promise"
+ { "created": true, "categoriesCreated": 1, "productsCreated": 1 }
```

O sea: sin el filtro, **el menu de la victima se materializa como catalogo del atacante**. La
asercion habla de la propiedad, no del setup. **Antes del arreglo esta misma mutacion dejaba 1430
tests en VERDE** (fila RM4 del revisor) — el arreglo es un arreglo.

**REVERTIDA Y VERIFICADA:** `diff` vacio contra `/tmp/orq0090/accept.ts`, `shasum` vuelve a
`176654521b5afab20f7b2634f4ed19ee80c7e315`, `grep` de etiquetas sin hits y
`no-mutations-left.sh` EXIT=0. El archivo es `??`, asi que **`git checkout` no era salvavidas**: se
revirtio con la copia.

## ⇥ SPEC 0090 — EN IMPLEMENTACION AHORA (2026-09-22). SIN COMMITEAR, SIN PASS

**Estado en el momento de escribir esto: el codigo de la spec 0090 existe en el arbol y NO esta
commiteado. No hay PASS de revisor y la migracion NO esta aplicada en ninguna base.**

Punto de retorno si esta sesion se cae: `docs/handoff-0090-implementacion-2026-09-22.md`, que es
el handoff del implementador con la evidencia ejecutada fila por fila.

### Lo que hay en el arbol

Las tres tablas (`schema/catalog-import.ts`), el dominio en `server/catalog-import/**`, los cinco
adaptadores en `providers/`, las ocho rutas (`api/catalog/imports/**` y
`api/internal/catalog-imports/**`), `entitlements/window.ts` con las dos claves nuevas, el workflow
`catalog-import-reconcile.yml`, y la migracion **`drizzle/0042_clean_risque.sql` generada y NO
aplicada**. **Cero `.tsx` y cero CSS**, como manda el ADR 0070: la pantalla la construye el owner.

Editados: `r2.ts` (el presign gana `maxBytes`/`expiresInSeconds`, default `MAX_LOGO_BYTES`, o sea
cero cambio para las tres subidas viejas), `assets/image.ts` (se extrae `guardedResize`,
`normalizeImage` conserva firma y salida), `catalog/validation.ts` y `catalog/categories.ts` (dos
exports), `entitlements/{catalog,index}.ts`, y `api/internal/assets-cleanup/route.ts`.

### Los gates, MEDIDOS POR EL ORQUESTADOR sobre el ARBOL FINAL

Corridos por mi, **no leidos del reporte del subagente**, con Node 24.20.0 y scripts de root, sobre
el arbol con las tres correcciones ya aplicadas:

| gate | resultado |
|---|---|
| `TURBO_FORCE=1 pnpm run typecheck` | **3/3, `Cached: 0`** |
| `pnpm run lint` | limpio |
| `pnpm run test` | **169 archivos / 1713 tests passed**, 105 / 581 en `skipped` |
| `TURBO_FORCE=1 pnpm run build` | **3/3, `Cached: 0`** |
| `pnpm run format:check` | **rojo en 10 archivos, los diez del WIP de UI del owner** |

Los 10 de `format:check` (`backoffice/catalog/*.tsx`, `globals.css`) son **pre-existentes y ninguno
de la spec** — medidos como baseline antes de que el implementador empezara. **Van a tumbar la CI
cuando se commiteen**, porque `format:check` es gate (`ci.yml:68`).

Las tres correcciones, verificadas por mi contra el arbol: `withinAttemptBudget` tiene call-site
real (`prepare.ts:17` y `:92`), `callbackUrl`/`APP_BASE_URL`/`CATALOG_IMPORT_CALLBACK_BASE_URL` no
dejan **un solo rastro** en `apps/merchant/src`, y el arbol no tiene mutaciones (`grep` vacio +
hook `no-mutations-left.sh` exit 0).

**El oraculo de cableado se gano el sueldo:** bajo M10b (borrar la llamada en `prepare.ts`) los
**tres casos de la REGLA quedaron VERDES**. Sin esa segunda prueba, borrar la linea pasaba con la
regla «bien testeada» — el modo de falla que este repo ya pago dos veces en un dia.

### Las tres correcciones que pedi despues de leer la primera entrega

1. **`catalog.imports.attempts` estaba declarado y SIN CABLEAR.** Reproducido por mi con `rg`:
   aparecia solo en `entitlements/catalog.ts:115`, en dos ramas internas de `quota.ts` y en su
   test — **cero call-sites**, contra `analyses` que si tenia el suyo en `core.ts:128`. Era
   andamiaje. No se le subio como pregunta al owner porque **la spec §8 ya lo decidio** («cuenta
   todo submit al proveedor, para que un loop de fallos no queme plata»): se cablea en el camino de
   submit de `prepare.ts` y cierra en `failed`, sin `429` no documentado. Lleva **dos** oraculos
   (M10a la regla, M10b el cableado), que es la trampa que este repo ya pago dos veces.
2. **Borrar el andamiaje de `callbackUrl`** (`types.ts`, `prepare.ts`, `callbackUrlFromEnv`): leia
   dos envs que la spec no lista y ningun adaptador lo consumia.
3. **El email no le llegaba a nadie si el analisis lo pedia un integrante** (buzon sintetico
   `@staff.invalid`). Cae al **owner activo del negocio**. **Es decision del ORQUESTADOR del
   2026-09-22, reversible — el owner no dijo esto.**

### Hallazgos a decidir — SON DEL OWNER, nadie los acordo

- **La ventana del cupo es UTC**, no la zona del negocio: el catalogo de entitlements no tiene como
  expresar una zona, asi que dos negocios en husos distintos ven el corte del dia en momentos
  distintos. Con 1/dia es menor; si el cupo sube, se nota.
- **`attempts` cuenta FILAS en la ventana, no submits.** La spec §8 se contradice en dos frases; se
  tomo la que dice «se cuentan filas de `catalog_import` en la ventana, no nace tabla de
  contadores». Los reintentos dentro de un import los acota `MAX_ATTEMPTS = 3` aparte.
- **Se toco `server/assets/image.ts`**, compartido por marca, sello y producto, para no pagar un
  encode PNG `compressionLevel: 9` por pagina diez veces dentro de un `after()` de 60 s.

### LA REVISION INDEPENDIENTE DIO **FAIL** (2026-09-22) — informe en `docs/revision-0090-2026-09-22.md`

**FAIL acotado: CUATRO arreglos, ninguno cascada.** El revisor **no encontro un solo defecto vivo en
el camino de produccion**. El FAIL es porque **cinco mutaciones plausibles SOBREVIVIERON**: hay tres
lineas de la DoD marcadas `[x]` cuya evidencia no mide lo que dice, un item del plan de pruebas de la
propia spec que no se escribio, y un defecto de archivo. Cinco lineas que hoy se pueden borrar **con
los seis gates en verde**.

| hallazgo | que se puede borrar sin que nada se ponga rojo |
|---|---|
| **H1** | el filtro por negocio del `accept` (`accept.ts:43`), **la ruta que ESCRIBE**: sin el, el menu de la victima se materializa como catalogo del atacante (`accept.ts:72-74` sigue usando el `business.id` del atacante) |
| **H4** | `lte(expiresAt, now)` (`cleanup.ts:118`): venceria **todos** los imports abiertos de **todos** los negocios en cada corrida diaria, borrando sus originales. `cleanup.ts` son 183 lineas con **cero** tests |
| **H3** | el `toImportDTO` de `GET /imports` (`route.ts:43`): viajarian job id, request id, tokens, `failureDetail`, `leaseUntil` y `businessId` — y por contrato §1.bis esa es **la primera llamada de la pantalla** |
| **H2** | el filtro de `requireImport` (`core.ts:97`, cubre 5 rutas): su unico test es un **FALSO ORACULO** — `catalog-import-states.test.ts:173` dobla `where()` **ignorando el predicado**, asi que mide lo mismo con y sin filtro |
| **H5** | nada, pero **`validation.ts` y `catalog-import-extraction.test.ts` son BINARIOS para `git` y `rg`** por bytes de control literales. `rg` sin `-a` da **exit 0 y cero lineas** sobre un archivo con 3 hits: el barrido **pasa vacuo**. Y los dos archivos **no son revisables en un diff ni en un PR** |

**Reproducido por mi, no leido del reporte:** H5 (`git diff --stat` → `Bin`, `rg` vacuo vs `-a` con 3
hits), H4 (`rg -l` de las cuatro funciones sobre `*.test.ts` → vacio), H3 (la ruta **si** llama a
`toImportDTO`; lo que falta es el oraculo) y H1 (`accept.ts:37-47` tiene su filtro propio, separado
de `requireImport`).

**Lo que SI mordio**, por el motivo correcto: RM2 (borde del techo de submits), RM5 (cableado de
`assertResolved`), RM8 (cableado de `validateProviderExtraction`). Y el muestreo de dos filas del
implementador (S-M3, S-M5) **reprodujo exacto**.

### LOS CUATRO ARREGLOS ESTAN HECHOS (2026-09-22). FALTA LA SEGUNDA VUELTA DE REVISION

**H5 cerrado, verificado por mi:** `git diff --stat` paso de `Bin 0 -> 9724 bytes` a **452 lineas de
texto**, y `rg -n 'sanitizeText'` **sin `-a`** ya devuelve los 3 hits. **H4 cerrado:** nace
`catalog-import-cleanup.test.ts` (10 casos) donde habia cero. **H1/H2/H3 cerrados** con oraculos
nuevos, incluido un doble que **evalua** el `where` (`catalog-import-predicado.ts`) — la causa raiz
de H2 era el doble, que tiraba el predicado.

**Los cinco gates, corridos por MI sobre el arbol final:** `typecheck` 3/3 `Cached: 0`, `lint`
limpio, `test` **171 archivos / 1730 tests** (105 / 583 skipped), `build` 3/3 `Cached: 0`,
`format:check` rojo con **los mismos 10 del owner**. El `build` el implementador **no lo corrio** (lo
declaro); lo corri yo y pasa.

**Dos limites que YO habia declarado en el encargo resultaron FALSOS**, y el implementador lo probo
intentandolos: **RM4 y RM11 no requerian Neon** — un doble honesto alcanza. Queda como recordatorio
de que una afirmacion de imposibilidad se verifica igual que una de exito.

**El revisor de la primera vuelta MURIO** por un error de API al arrancar la segunda. **Arbol
auditado: sin mutaciones** (`grep` sin hits, `no-mutations-left.sh` EXIT=0), no dejo nada puesto. Su
bitacora de la vuelta 1 quedo en `/tmp/rev0090/bitacora.md`. **Si el proximo encargo de revision
muere otra vez, NO se despacha un tercero: se termina a mano** (regla de la skill).

### LA SEGUNDA VUELTA DIO **PASS** (2026-09-22), Y CERRO UN TERCER HERMANO

El revisor fresco re-midio las cinco con alcance **todo `apps/merchant/src`** (`vitest run src`,
baseline 271 archivos / 1718 passed) y **las cinco dieron ROJO**: RM3, RM4, RM6, RM6b y RM11. Su RM4
**coincide con la mia** (misma asercion; la diferencia de conteo es solo el alcance). Las tres
auditorias que pedi tambien pasaron: el arreglo de H5 **no corrio el rango** de caracteres saneados
(33 code points antes y despues, con control positivo en tres direcciones), el doble nuevo no
describe filas imposibles en la dimension que importa, y el falso oraculo quedo reparado **sin que
se borrara ni debilitara un solo test** (la aritmetica 1713→1730 cierra sin holgura).

**Pero encontro un TERCER hermano de la clase de H1/H2**, y lo dejo a decision mia: `activeImport`
(`core.ts:76`) tiene su **propio** `eq(businessId)` y **no tenia oraculo**. **Lo cerre yo**, con el
protocolo completo — la bitacora ORQ-RM12 esta arriba. No lo declare pese a la condicion de corte
porque **no es «el fix abrio la siguiente»**: es el **mismo defecto de clase cerrado en dos miembros
de tres**, que es literalmente la leccion 2.0-sexies. El arreglo es **un caso de test, cero lineas de
logica**.

**Los cinco gates con el oraculo nuevo, corridos por mi:** `typecheck` 3/3 `Cached: 0`, `lint`
limpio, `test` **171 archivos / 1731 tests** (105 / 583 skipped), `build` 3/3 `Cached: 0`,
`format:check` rojo con **los 10 del owner y cero mios**.

### MISTAKE→RULE APLICADO: nace el hook `no-control-bytes.sh`

La familia «bytes de control crudos» paso **TRES veces en este turno** (los dos fuentes de la spec,
mi informe de revision, y **el archivo del hook que escribi para cazarla**), asi que va como hook y
no como frase: se chequea con un comando, cuesta cero tokens y es determinista.
`.claude/hooks/no-control-bytes.sh`, cableado en `PostToolUse` sobre `Write|Edit`.

**Probado que MUERDE y que discrimina**, con cuatro fixtures: sano → `EXIT=0`, un `\u0000`
sintetico → `2`, **el `validation.ts` real del bug → `2`**, el mismo ya arreglado → `0`, extension
no cubierta → `0`. Y se cazo a si mismo y a este archivo (`EXIT=2` en los dos) — arreglados, 3 y 1
bytes → 0.

**La leccion dentro de la leccion, que quedo en `LECCIONES.md`:** la **version 1 del hook NO
mordia**. Usaba `grep '[[:cntrl:]]'`, que no matchea nada sobre un archivo que `grep` considera
binario, y mi primer fixture era **falso** (un `sed` que nunca inserto el NUL). El control positivo
dio `EXIT=0` y casi lo doy por bueno: habria quedado un guard que pasa siempre, el mismo «pasa
vacuo» que venia a cazar. Lo que si discrimina es un `tr -dc` que borra todo lo que NO es byte de control y cuenta lo que
queda (el rango exacto esta en el hook; **citarlo aca seria pisar la misma mina**). **Y el texto del mensaje
de error tambien se ejecuta:** las dos primeras versiones del consejo estaban rotas (una matcheaba
los offsets octales de `od`, la otra daba falsos positivos sobre UTF-8 multibyte).

### Y una correccion que me toca a mi

**`docs/revision-0090-2026-09-22.md` tenia el defecto H5 que el mismo documento denuncia.** Al
escribirlo, los `\u0000` del ejemplo se decodificaron a **bytes de control crudos** y git lo veia
como `Bin 0 -> 26088 bytes`: el informe sobre archivos invisibles para un diff **era invisible para
un diff**. Arreglado (19 bytes → 0; git ve 411 lineas de texto). **Misma familia de error dos veces
en el mismo turno**, y ya estaba en el `CLAUDE.md`.

### Lo que FALTA, y es lo que bloquea el cierre

1. **La evidencia de integracion no existe todavia.** Las 4 suites Neon (20 tests) estan escritas y
   en `skipped`, y **un `skipped` se lee igual que un `passed`**. Son las que cierran **M4, M8 y la
   mitad de M9**, las tres mutaciones sin medir.
   **Correccion medida contra el arbol (`ci.yml:12-58` + `list_branches`): la integracion NO corre
   contra la base de la app.** Corre contra la rama Neon persistente **`ci-integration`**
   (`br-icy-hat-axsfqc8k`), a la que la CI le aplica la migracion ANTES de `pnpm test`, y hay un
   paso que **falla fuerte** si el secret no llego. O sea que la frase de la spec «las pruebas de
   integracion corren contra la misma base que usa la app» **es falsa contra el arbol**. La
   decision del owner (migracion directo a `main`, sin rama efimera) sigue en pie: es sobre **donde
   aterriza la migracion**, no sobre donde corren los tests.
   Dos caminos, los dos necesitan al owner: **pushear** (la CI las corre sola, costo cero, pero no
   hay autorizacion) o **correrlas local** (sacar la connection string por MCP, que **queda en el
   transcript** y obliga a rotar la password).
2. **Revisor independiente en contexto fresco.** No empezo.
3. **Migracion a Neon `main` + deploy**, recien DESPUES del PASS.

## ⇥ SIGUIENTE ARCO — SPEC 0090: IMPORTACIÓN DE CATÁLOGO CON IA

**Estado: DOCUMENTOS CERRADOS Y CORREGIDOS (2026-09-21). CERO CÓDIGO DE LA FEATURE. SIN COMMITEAR.**

Lo siguiente es **implementar**, y el punto de retorno son cuatro archivos:

- `adr/0082-…-agnostica-y-borrador-revisable.md` — la decisión, **y su enmienda §8-§12**, que es
  donde viven las seis decisiones del owner del 2026-09-21.
- `specs/0090-importacion-de-catalogo-desde-imagen-o-pdf.md` — **segunda versión**, la que se
  implementa. La primera se revisó contra el árbol y tenía siete bloqueantes y tres afirmaciones de
  mecanismo falsas.
- `specs/0090-contratos-de-api.md` — **el contrato para la UI, que la construye el owner por
  fuera.** La spec **no toca un solo `.tsx`**.
- `handoff-catalog-import-ai-2026-09-21.md` — punto de retorno corto (su «secuencia recomendada»
  quedó vieja en un punto: el implementador **no** hace UI).

### Las seis decisiones del owner, cerradas — no se reabren durante el código

1. **El trabajo largo no corre en nuestra función.** El adaptador delega en el proveedor
   (`background: true`) y lo retomamos por **callback firmado**; el scheduler externo pasa de worker
   a **reconciliador**. Motivo medido: los 2 crons de `vercel.json` son el máximo de Hobby y un
   tercero hace que Vercel **rechace el deploy entero**; y el techo de 60 s no alcanzaba.
2. **DOS estados de precio y ninguno bloquea.** `missing` se elimina: «si no podemos tener el valor
   o no lo sabemos es ambiguo». Un `ambiguous` nace con `unit_price` **null** (nunca `0`) y el
   merchant lo completa después; `accept` devuelve `productsWithoutPrice`. Desaparece
   `priceConfirmed`.
3. **El cupo es un valor centralizado con ventana** en `server/entitlements/` — arranca en 1/día y
   **los fallos no lo consumen**; hay un techo aparte de intentos al proveedor.
4. **El PDF se cuenta con `node:zlib`, sin dependencias.** No hay que instalar nada.
5. **Email al merchant** cuando el borrador queda listo, reusando `server/email/`.
6. **El aviso de privacidad lo escribe el owner en la UI.** No es un pendiente del server.
7. **La API se adapta a la pantalla que YA existe** (`catalog-ai-import.tsx`: un archivo, sin
   edición del borrador, «Cancelar» sólo cierra el modal). `accept` **sin cuerpo**, idempotencia
   **del servidor** (no hay `idempotencyKey`), y `POST /imports` **se apropia** de un import
   abandonado en `pending_upload` para que cerrar el modal no trabe el siguiente intento — pero
   **no** descarta uno en `ready`, porque eso quemaría el análisis del día.

### Lo que la revisión dejó medido, y que el implementador NO tiene que re-descubrir

- `sharp.format.pdf.input === false` (vips 8.18.3) y **no hay librería de PDF ni `openai` en
  `.pnpm-store`**: el adaptador va con `fetch` y el contador con `zlib`.
- El escaneo naive de `/Type /Page` devuelve **0** en un PDF con `/ObjStm` (medido sobre 14 PDFs
  reales): por eso el contador **falla cerrado**.
- `createTemporaryUploadUrl` (`server/r2.ts:72-95`) firma `Key` + `ContentType`, **no**
  `ContentLength`, y **rechaza todo lo que pase de 5 MB** (`MAX_LOGO_BYTES`): hay que parametrizar
  el tope.
- `api-permission.ts` / `api-owner.ts` **no tienen rate limit**. El «rate limit común de escrituras»
  de la spec vieja no existía.
- `catalogError` (`api/catalog/_auth.ts`) devuelve **`{error}` pelado**: los `code` de esta feature
  son código nuevo.
- `after` se exporta de `next/server` en Next 16 (`node_modules/next/server.d.ts:21`).
- Standard Webhooks: HMAC-SHA256 sobre `id.timestamp.body`, base64, header `v1,<firma>`, secreto
  `whsec_` en base64 → `node:crypto`.

### Cómo sigue

Un implementador para toda la spec (no es disjunta) y **un** revisor independiente antes de marcar
`implementada`. Presupuesto: **9 mutaciones** con la tabla y la condición de corte escritas en la
spec. **La migración va DIRECTO a `main` de Neon, sin rama efímera** (decisión del owner,
2026-09-21: «estamos en desarrollo, no me preocupa»); consecuencia declarada en la spec: las
pruebas de integración corren contra la misma base que usa la app, así que cada test crea y borra
sus propias filas y ninguna trunca tablas ni borra por rango. Es aditiva, así que puede aplicarse
antes del deploy.

**Config de prod que es del owner y no bloquea implementar:** el endpoint de webhook en el
dashboard del proveedor apuntando a
`https://www.checkpass.club/api/internal/catalog-imports/provider-callback` (**con `www.`**), sus
secretos en Vercel y `CATALOG_IMPORT_RECONCILE_ENDPOINT` en GitHub. Con
`CATALOG_EXTRACTION_PROVIDER=fake` el arco entero se desarrolla y se testea sin nada de eso.

### HECHO EN ESTE TURNO — SIN COMMITEAR (el árbol trae la UI en curso del owner)

**1. Los tres documentos de arriba** (enmienda del ADR, spec reescrita, contrato nuevo) más las
tres filas del `INDEX`. `prettier --check` limpio en los cuatro.

**2. El barrido de `upload-image-formats.test.ts:204` estaba ROJO** por el mock de la importación
(`catalog-ai-import.tsx`, sin trackear, del owner): hardcodeaba
`accept="image/*,.pdf,application/pdf"` — 6ta aparición del bug que ya se pagó en sello, marca y las
dos demo. Arreglado con la lista en UN lugar: `lib/image-formats.ts` gana **`PDF_CONTENT_TYPE`** (con
el por qué de que **no** entra en `ACCEPTED_IMAGE_CONTENT_TYPE_SET`: ese set es el allow-list de los
tres presign de imagen, y sumarlo dejaría subir un PDF como logo) y el input compone desde ahí.
**Verificado:** `typecheck` 3/3, `lint` limpio, `test` **155 archivos / 1586 tests**. Rojo con el
literal viejo, verde con la composición. **No se tocó el test.**

**Pendiente chico y conocido:** `catalog-ai-import.tsx` **ya fallaba `prettier --check` antes** de
ese cambio (WIP del owner). No se reformateó el archivo entero a propósito; va a estar rojo en CI
cuando se commitee.

**3. Segunda ronda de correcciones, después de que el owner miró la UI real y contestó las tres
preguntas pendientes (missing/ambiguous, idempotencia, `code`).** Se propagaron a los cuatro
documentos (ADR §9 enmendada + §13 nueva, spec, contrato, INDEX, este archivo):

- **Dos estados de precio, no tres.** `missing` desaparece; un `ambiguous` nace con `unit_price`
  **null** (nunca `0`) y **ya no bloquea** `accept` — el bloqueo original protegía contra un `0`
  que parecía válido, y ese riesgo desapareció con `null`. `accept` devuelve
  `productsWithoutPrice`. Sin `priceConfirmed`.
- **Sin `idempotencyKey` en el cliente.** La resuelve el servidor bajo el lock del import; `accept`
  quedó sin cuerpo obligatorio.
- **`POST /imports` se apropia de un import abandonado en `pending_upload`** (la UI real cierra el
  modal sin cancelar) pero **no** de uno en `ready` — eso quemaría el análisis del día. Nace
  `GET /api/catalog/imports` (sin id) para que la pantalla retome al abrir el modal.
- Tabla de mutaciones: **8 → 9** (M5 ahora es la más importante — `0` vs `null` — y M9 cubre que
  `ready` no se descarte).

**Verificado:** `prettier --check` limpio en los cuatro documentos; `git grep` confirma cero rastros
de `missing`, `priceConfirmed` o `idempotencyKey` fuera de las frases que dicen «ya no existe».

## ⇥ SPEC 0088 — UI Y TOUR DE STAFF: COMMITEADA, CON DOS REVISIONES CERRADAS (2026-09-21)

### ESTADO — ESCRITO DESPUES DE LOS COMMITS, con sus shas

| sha | que |
|---|---|
| `8ee91d1` | **La pantalla de Staff y sus cuatro ayudas** (spec 0088). Es el arbol que la primera revision auditó |
| `7f51c51` | **Enmienda §11** — los SEIS hallazgos de la primera revision independiente |
| `0ac4391` | **§11-bis** — los TRES arreglos de la segunda vuelta, que activo la condicion de corte |

**El arbol esta limpio y son CUATRO los commits en `main` LOCAL sin pushear** — los tres de la tabla mas el de este doc. Se lee con
`git rev-list --left-right --count origin/main...main`. Ultimo sha en `origin/main`: **`fa9a029`**,
cuya CI esta **entera en verde** (`tick`, `drain` y `verify`, los tres `completed/success`,
verificado por `check-runs` y **no** por `/status`).

**No hay autorizacion para pushear**: se le pregunto al owner y no contesto todavia. **El
`test:e2e` de estos tres commits NO CORRIO EN NINGUN LADO** — ni local ni CI — y eso es lo que el
push desbloquea.

### LOS GATES, MEDIDOS SOBRE `0ac4391`

`typecheck`, `lint`, `format:check`, `test` (**149 archivos / 1.550 tests**, +12 casos nuevos) y
**`build`** → los cinco **VERDES** con `TURBO_FORCE=1` y Node 24.20.0.

**`build` dejo de estar bloqueado, y la sesion anterior se equivoco al declararlo:** el `EPERM` de
Turbopack era del **sandbox del agente**, no del codigo. Corriendo sin sandbox pasa en ~10 s. Es un
recordatorio de la regla: una afirmacion de IMPOSIBILIDAD se verifica intentandola.

**`test:e2e` sigue sin correr, y el motivo es el puerto, no el codigo:** `playwright.config.ts:16-31`
levanta el consumer en `127.0.0.1:3000` y el merchant en `3001`, y el 3000 lo tiene un `next dev`
**del merchant** que es un proceso del OWNER (PID 97387). Playwright aborta con *«Another next dev
server is already running»*. **La suite SI existe** (`tests/e2e/health.spec.ts`,
`tests/e2e/loyalty-real.spec.ts`): un revisor afirmo lo contrario mirando `e2e/` en la raiz, y se
verifico antes de creerlo.

**Trampa de medicion que costo un falso verde:** `pnpm run test:e2e | tail` devolvio **exit 0 con el
gate FALLADO**, porque en zsh el status de un pipeline es el de `tail`. Se vio **leyendo** la salida.

### LAS DOS REVISIONES, Y LO QUE ENSENIARON

**Nueve hallazgos, los nueve cerrados. Ninguno lo habia visto el QA del owner, y hay un motivo
estructural: el popover ofrece «Siguiente», asi que quien avanza con el boton nunca dispara el
paso que rompe.**

1. **La misma familia de defecto aparecio DOS VECES, y la segunda sobrevivio al arreglo de la
   primera.** Un paso de tour cuyo clic hace lo CONTRARIO de lo que su copy pide: en el alta,
   «Habilitá Mostrador» sobre un switch que **ya nace encendido** (apagaba el unico permiso y el
   alta se cortaba); en la baja, «Dalo de baja» sobre un boton que es un **TOGGLE** y sobre un
   integrante ya dado de baja **le restablece el acceso**. **La leccion es el metodo: al cerrar un
   defecto de esta clase hay que barrer los OTROS pasos del mismo tipo**, no solo el que se cazo.
2. **Un gate nuevo sin oraculo se lee como proteccion.** El chequeo de permiso de
   `/backoffice/staff` —el primero del backoffice que no es `requireOwner`— se podia BORRAR con
   1.526 tests en verde, porque ningun test importaba la pagina. Hoy tiene `page-guard.test.ts`,
   sin base, y muerde con dos rojos.
3. **Tocar CSS COMPARTIDO es tocar otras pantallas.** Un cambio de `.confirm-dialog` pensado para
   Staff alcanzo a **siete** pantallas; el `.toast` a **nueve**. Y el arreglo salio a mitad de
   camino: revertir el fondo sin poner el `color` restauro un defecto **preexistente** (texto casi
   blanco sobre blanco en modo oscuro), porque el color se hereda de `.backoffice-layout`.
4. **QUINTA vez en cuatro specs que el docblock es el defecto** — y una de las cinco es mia, en el
   test que acababa de escribir: afirmaba haber medido algo que el **doble** hacia imposible medir.
   Corregido para que diga que distingue de verdad y en que archivo esta el otro oraculo.
5. **La condicion de corte del ADR 0062 se ACTIVO, y la activo el revisor**, no yo: dos vueltas
   seguidas terminando en «el fix abrio la siguiente». No se abre una tercera ronda.

### LO QUE FALTA EN LA 0088 (corto, y es de pantalla)

**Spec en `cerrada` a proposito: no se marca `implementada` sin el QA del owner.** Tres cosas que
solo se ven en pantalla, mas la CI:

1. La ayuda **«Dar de baja»** sobre alguien **que ya esta de baja** — el copy nuevo tiene que
   describir un toggle.
2. **Gestionar sobre su propia fila** siendo administrador: «Regenerar PIN» aparece
   **deshabilitado** con su motivo, no ausente (antes el tour se colgaba 60 s ahi).
3. Cualquier **dialogo de confirmacion** con el **SO en modo oscuro**: el texto tiene que leerse.

Y en desktop: que el **toast** de arriba a la derecha no tape el boton de cerrar modulo — geometria
**declarada y NO verificada en navegador**.

### ✅ CERRADO EN `e9dd3e1` — la R1 de la 0086, completa

**Regla del owner, 2026-09-21:** *«solo merchant (owner) puede crear un miembro staff como
administrador»* y *«ese miembro administrador no puede crear otros administradores»*.

**Esa mitad YA estaba implementada** en las dos superficies que escriben permisos —el alta
(`staff-create.ts:141`) y `PATCH …/permissions`— y las dos tenian oraculo. **Lo que faltaba era
QUITARLO:** `assertGrantable` mira la lista NUEVA, asi que un administrador que mandaba la lista
**sin** `staff` degradaba a otro administrador, y la unica barrera era la UI — mientras la pantalla
ya le promete al merchant *«solo el owner puede otorgarlo o quitarlo»*.

Nace `assertDemotable`, que mira la fila **actual** del target y corre **despues** de resolverlo,
asi que un id inexistente sigue siendo `404` y el `403` no confirma existencia. Reusa
`permission_not_grantable`. Cero consultas nuevas: la columna viaja en el `select` que ya traia
`role`.

**3 mutaciones, las tres rojas** — y la del **cableado** midio **VERDE la primera vez**: borrar la
llamada del writer dejaba **1.293 tests en verde**. Es el mismo modo de falla que costo la revision
de la 0088, dos veces en el mismo dia: **una regla pura con test no dice nada sobre si alguien la
llama.**

**Lo que NO se toco, y se declara:** un administrador todavia puede **regenerar el PIN** de otro
administrador y **darlo de baja** (las dos rutas miran `role`, no `permissions`). No es escalada de
permisos —`staff` ya lo tiene— sino interferencia entre pares. **El owner no pidio eso**, asi que
no se implementa ni se presenta como decision suya.

## ⇥ ▶ LOCALES — API REVISADA, PANTALLA DELEGADA Y CONTRATO ESCRITO (2026-09-21)

### ESTADO — ESCRITO DESPUES DE LOS COMMITS, con sus shas

| sha | que |
|---|---|
| `e9dd3e1` | **R1 completa** — solo el owner QUITA `staff` (spec 0086) |
| `b8f3170` | **R5** — un administrador no toca a otro administrador: ni su PIN ni su baja |
| `5bfd152` | **Locales**: la pantalla se delega al permiso, el checklist pasa a SEIS items, y nace el contrato HTTP |

**El arbol esta limpio.** Ultimo sha en `origin/main`: **`fa9a029`** — hay **9 commits locales sin
pushear** y **el `test:e2e` de todos ellos no corrio en ningun lado**: ni local (el puerto 3000 lo
tiene un `next dev` del owner, PID 97387) ni en CI (no estan pusheados). El push es lo unico que lo
desbloquea.

### QUE QUEDO HECHO

**El API de Locales ya estaba completo** —crear, editar, archivar/reactivar, listar— y ya pasaba por
`requireApiPermission(request, "locations")`: **owner siempre, integrante con el permiso**. No se
construyo ni una ruta. Lo que faltaba y se hizo:

1. **La pantalla dejo de ser owner-only.** Entraba con `requireOwner()` (spec 0061 §4), asi que el
   permiso estaba **vivo en la API y muerto en el producto**. Ahora se gatea por `locations`, con el
   mismo oraculo que la de Staff.
2. **La navegacion se generalizo** con un criterio escrito: a un integrante se le pinta un link
   **solo si esa pantalla ya esta gateada por permiso** — hoy Staff y Locales. Las otras siguen con
   `requireOwner()` y ofrecerle una puerta que lo rebota es peor que no ofrecerla.
3. **El checklist pasa a SEIS items**: `locations` en la posicion 2 (**la posicion la delego el
   owner**: *«ponlo donde quieras… luego lo reordenare»*). Es un TOUR y no un hecho de dominio, y
   esta **medido**: el wizard del alta ya crea el primer local, asi que «tenes un local» naceria
   `done: true` para todos.
4. **El contrato HTTP** (`specs/0089-contratos-de-api.md`) — es lo que consume quien construye la
   pantalla por fuera (ADR 0070).

### LO QUE FALTA PARA CERRAR LOCALES

- **El tour `driver.js` de la pantalla de Locales.** Hasta que exista, el item del checklist
  **nunca se marca hecho** — no traba nada (ningun tour es obligatorio) y es el estado explicito del
  ADR 0078 §6. Va con la pantalla nueva, siguiendo la forma de la 0088.
- **QA del owner** sobre los tres puntos del handoff de la 0088 (ver arriba).

### PERMISOS DE STAFF: LAS DOS REGLAS QUE ENTRARON HOY

- **R1 completa** (`e9dd3e1`): solo el owner otorga **y quita** `staff`. Faltaba la mitad de quitar,
  y la unica barrera era la UI.
- **R5** (`b8f3170`): **un administrador no toca a otro administrador** — ni le regenera el PIN ni lo
  da de baja. `403 target_is_administrator`, un `code` propio (el owner es intocable SIEMPRE, un
  administrador solo para un no-owner). Decision textual del owner del 2026-09-21.

**Lo que enseño, y es la misma leccion dos veces en un dia:** **una regla pura con test no dice nada
sobre si alguien la llama.** Las dos veces la mutacion del CABLEADO midio verde con la suite entera
en verde. Desde hoy cada regla nueva lleva su test de cableado.

**`staff.ts` llego a 327/300 y se DIVIDIO en vez de extenderse** (`staff-error.ts` y
`staff-admin-target.ts`), con re-export para que sus ~20 consumidores no cambien una linea.

## ⇥ COMO RETOMAR (handoff del 2026-09-21)

**Lo siguiente lo arranca el owner por fuera: la UI de Locales con GPT.** El insumo es
**`docs/specs/0089-contratos-de-api.md`**, que es el contrato normativo de las cuatro rutas — no hace
falta leer codigo para diseñar la pantalla.

**Prompt para la sesion nueva:**

> Lei `docs/TASKS.md`. Hay 9 commits locales sin pushear y el `test:e2e` de todos ellos no corrio en
> ningun lado. La pantalla de Locales la esta diseñando el owner por fuera con el contrato
> `specs/0089-contratos-de-api.md`. Lo que sigue cuando llegue esa UI: el tour `driver.js` de
> Locales, con la forma de la spec 0088 —y leyendo la leccion del 2026-09-21 sobre pasos de tour
> cuyo clic hace lo contrario de lo que su copy pide.

**Lo que NO hay que rehacer** (ya esta medido y commiteado): el API de Locales, el gate por permiso de
las dos pantallas, el checklist de seis items, R1 completa y R5.

**Los tres puntos de QA de la 0088 siguen abiertos** y son de pantalla (ver el handoff de esa spec):
la ayuda de baja sobre alguien ya dado de baja, Gestionar sobre la propia fila de un administrador, y
cualquier dialogo de confirmacion con el SO en modo oscuro.

**Este archivo contiene SOLO el arco en ejecucion** (regla instaurada por la spec 0066, ya cerrada).
Lo diferido, parado o pospuesto vive en **`docs/PARQUEADO.md`** (el unico lugar donde buscar
pendientes); el relato historico completo esta en **`docs/archivo/`** — `TASKS-historico-2026-09-16.md`
(7.185 lineas: todo lo anterior a la 0066) y `spec-0066-implementacion.md` (los tres pasos, la
bitacora de mutaciones y el PASS del revisor de esa spec).

## ⇥ ▶ ARCO NUEVO — PERMISOS DEL STAFF Y AUDITORIA (ADR 0079, 2026-09-20)

**Es el arco en ejecucion.** El anterior (UI del onboarding) quedo cerrado en `c8c552b` y
sigue abajo como contexto, no porque este en curso.

### ESTADO — ESCRITO DESPUES DE LOS COMMITS, con sus shas

| sha | que |
|---|---|
| `c8c552b` | **UI del onboarding** — el widget del checklist y la integracion de `driver.js` (venia de la sesion anterior) |
| `fd84ec5` | **ADR 0079 + spec 0086 `cerrada` + su contrato HTTP**, mas las filas de `INDEX` y `PARQUEADO` 60 |

**✅ EL ARBOL ESTA LIMPIO Y TODO ESTA PUSHEADO** (owner, 2026-09-21: *«hacemos los commit... y
push»*). Se lee con `git rev-list --left-right --count origin/main...main` → **`0  0`**.
Ultimo sha en `origin/main`: **`f8d0c5d`**.

**⚠ LA CI TODAVIA NO TERMINO.** El check `verify` estaba **`in_progress`** al cerrar la sesion, y
**ahi corre el SEXTO gate (`test:e2e`), que es el unico que nadie corre local**. Se verifica con
—y **NUNCA** con `/status`, que en este repo devuelve `success` con la CI corriendo—:
`GH_TOKEN= gh api repos/maxhost/check-point/commits/f8d0c5d/check-runs --jq '.check_runs[] | "\(.name): \(.status) -> \(.conclusion)"'`
— **todos** `completed` y `success`. **Si `verify` sale rojo, el sospechoso numero uno es
`test:e2e`**, que arrastraba pendiente desde `c8c552b` porque el puerto 3000 local esta ocupado
por dos procesos del owner (PIDs 29871 y 97387) y `playwright.config.ts:18` espera ahi al
consumer.

### ✅ SPEC 0087 — **IMPLEMENTADA Y COMMITEADA** en `816a14e` (2026-09-21)

**Editar al integrante, pedido del owner el 2026-09-21.** Spec y ADR en **`4115032`**, codigo en
**`816a14e`**, y la **enmienda §5** (el dado de baja no se renombra) en **`f444ba0`**. **PASS** de un revisor independiente. **PUSHEADO** el 2026-09-21.

**Que entrega:** `PATCH /api/staff/{userId}` edita **solo el nombre** y **re-deriva el handle**,
asi que el identificador nunca queda desincronizado — a cambio de que **cada renombre cambia con
que string entra esa persona**, y por eso la respuesta devuelve **SIEMPRE** el `identifier` nuevo.
La ruta **rechaza** `permissions` con `400 permissions_not_here` mirando la **presencia de la
clave**, y `PATCH …/permissions` quedo con **CERO lineas de diff**.

**Verificacion corrida por el ORQUESTADOR:** los cinco gates con `TURBO_FORCE=1` (`0 cached`) y la
rama de integracion **ACTIVA** → **`EXIT=0`, 246 archivos / 2068 tests**. `test:e2e` no aplica,
demostrado en los dos canales. **11 mutaciones en total** (5 del implementador + 5 del revisor +
1 de cierre); bitacora en `docs/archivo/spec-0087-bitacora-de-mutaciones.md`.

### LO QUE ESTA SPEC ENSEÑO

1. **DOS decisiones de diseño tomadas por el motivo correcto, y las dos son la misma idea:** el
   404/409 se resuelve **DESPUES** del `UPDATE` —un `SELECT` previo scopeado habria dejado el
   `business_id` **sin oraculo que lo distinga**, la proteccion tapando a la proteccion, y se
   **MIDIO**: con el pre-chequeo la mutacion de aislamiento **sobrevivia en verde**— y `users.name`
   se escribe **despues** y solo si matcheo, porque `merchant_auth.user` **no tiene `business_id`**.
   **No se declaro «no se puede testear»: se descubrio que ASI ESCRITO no se podia.**
2. **El revisor NO repitio las mutaciones del implementador**, gasto su presupuesto en cinco
   propias apuntadas a lo que la tabla **no** cubria, y **ahi estaba el hueco**: `rejectionFor`
   scopeada **sin oraculo**, porque el caso de aislamiento usaba un target `role='staff'` que con
   el scope roto **sigue dando 404**. El unico vector que distingue es el **owner de otro
   negocio**. **Elegir mutaciones nuevas en vez de repetir es lo que compro ese hallazgo.**
3. **Un docblock que AFIRMA un invariante sin oraculo** — tercera vez en dos specs. Cerrado, y
   ahora la frase **lleva su oraculo escrito al lado**: nombra el caso que la muerde y dice cual
   **no** la distingue.
4. **Un rojo de PLOMERIA disfrazado de propiedad:** la mutacion del guard `!excludeUserId ||` daba
   rojo por un **doble** que devuelve filas sin `userId`, cuando en la base `user_id` es
   **`NOT NULL`** (`schema/membership.ts:32-34`, verificado). El guard se queda; el comentario
   dejo de afirmar una propiedad que **solo existe en un doble**.

### PENDIENTES Y AVISOS DE LA 0087

1. **✅ CERRADO (owner, 2026-09-21):** *«integrante dado de baja se puede renombrar: **no**»*.
   Enmienda **§5** de la spec, commit **`f444ba0`** — `409 target_disabled`, con el chequeo en
   `rejectionFor` (no en el `WHERE`, donde la fila no matchearia y caeria en un 404) y **despues**
   del scope por negocio, con la mutacion **M7** probando que un `disabled` de **otro** negocio
   sigue diciendo **404**. **La asimetria queda DECLARADA, no decidida:** `PATCH …/permissions`
   **sigue permitiendo** editarle los permisos a un `disabled`. El owner decidio sobre el
   **renombre**; lo que no dijo no se escribe como decision suya.
2. **✅ CERRADO:** el archivo de integracion estaba en 285/300 y **se DIVIDIO en vez de
   extenderse**. Nace `staff-rename-integration-support.ts` (**sin un solo `expect`**) y el
   original bajo a **235 conservando sus 13 casos**, verificado corriendolo antes y despues.

3. **⚠ UN ERROR MIO QUE CAZO EL IMPLEMENTADOR, y vale como regla:** el `code` de la enmienda se
   iba a llamar **`staff_disabled`**, y **ese `code` YA EXISTE y esta establecido** — tiene su
   propio **ADR 0055**, dos specs, y lo emite el **login con 403** significando *«TU acceso esta
   desactivado»*, dirigido **a la persona rechazada**. El de la enmienda significa otra cosa
   —*«el TARGET esta de baja»*, al **merchant**— y sale con **409**. **El mismo string con dos
   status y dos audiencias es una colision de contrato**, y en este repo el `code` **ES** el
   contrato. Renombrado a **`target_disabled`**, que espeja a `target_is_owner`. **La regla:
   antes de bautizar un `code` nuevo, `rg` por ese string en `apps` y `docs`** — el catalogo de
   `code` es compartido aunque las tablas de contrato esten por spec.

4. **⚠ Y la M7 volvio a traer el patron de la 0086:** su primera lectura dio **dos** rojos, y el
   segundo acusaba a un **DOBLE**, no al codigo — devolvia una fila **sin `status`** cuando en la
   base es `NOT NULL DEFAULT 'active'`. **Se arreglo el doble, no el test**, y se re-midio sobre
   el arbol final. Tercera vez en tres specs que un doble irreal ensucia una medicion.
5. **Declarado:** si alguna vez nace otro indice unico que incluya `handle`, `isUniqueViolation`
   dejaria de distinguirlo de `handle_taken` (hoy hay **exactamente dos** unicos y los 6 CHECK son
   `23514`, medido con `pg_indexes`).
6. **Declarado:** dos claves se ignoran en silencio (`__proto__` con `permissions` adentro, y
   `Permissions` con mayuscula): devuelven 200 y renombran, **sin escribir permisos**. Cerrarlo
   seria rechazar claves desconocidas — **decision de producto, no tomada**.

### ✅ SPEC 0086 — **IMPLEMENTADA Y COMMITEADA**. MIGRACION **APLICADA A PROD** (2026-09-21)

**Este es el punto de retorno de esta sesion.**

| sha | que |
|---|---|
| `67ebc79` | **spec 0086** — la migracion `0041`, `requireApiPermission`, las diez superficies, las dos escrituras de staff, el mostrador con `counter`, la sesion con `permissions`, la enmienda §10 y la bitacora de mutaciones |
| `3faa3db` | **tres `mistake→rule`** — el seed irreal, la fila de mutacion falsa (segunda seguida) y el `TURBO_FORCE`; `CLAUDE.md` vuelve a 199 lineas mudando el detalle a las skills |

**PUSHEADO** el 2026-09-21 junto con el resto del arco. Se lee con
`git rev-list --left-right --count origin/main...main` → `0  0`.

**La verificacion, corrida por el ORQUESTADOR y no tomada de un informe:** los cinco gates con
Node 24.20.0, `TURBO_FORCE=1` (`0 cached`) y la rama de integracion Neon **ACTIVA** →
**`EXIT=0`, 244 archivos / 2029 tests**. **17 mutaciones** ejecutadas (8 del implementador + 9
del revisor), bitacora en `docs/archivo/spec-0086-bitacora-de-mutaciones.md`. **PASS** del
revisor independiente. `test:e2e` **no aplica**: cero `.tsx`.

### ✅ LA MIGRACION `0041` ESTA APLICADA A PROD, VERIFICADA POR SQL

Proyecto `red-violet-38772073`, rama `main` (`br-curly-silence-ax8acywm`), base `neondb`.
Autorizada por el owner el 2026-09-21 (*«aplica la migracion»*). Lectura posterior por MCP:

| Que | Valor |
|---|---|
| `drizzle.__drizzle_migrations` | **42** filas |
| Columna `permissions` | **existe** |
| `CHECK` en `business_membership` | **6**, y los tres nuevos con definicion **identica** a la de integracion, `COALESCE` incluido |
| Membresias | **3 owners intactos, 0 staff** |
| Esquemas `core` y `merchant_auth` | **intactos** |

**El `delete` de la migracion fue un NO-OP en prod: no habia una sola membresia de staff.** Se
verifico **ANTES** de aplicar, siguiendo el gotcha del repo — *el orden lo decide el codigo que
YA corre en prod, no el que vas a desplegar*.

**⚠ CONSECUENCIA ABIERTA MIENTRAS NO SE PUSHEE: crear staff en prod esta ROTO.** El codigo viejo
que corre hoy no manda `permissions`, la columna toma su `default '{}'` y el **CHECK 3** rechaza
la fila. No rompe nada existente —habia cero staff— pero **el alta de integrantes no funciona
hasta el deploy**. Es consecuencia directa de aplicar la migracion sin pushear, y esta dicho.

**⚠ La connection string con la password quedo en el transcript de la sesion: conviene rotarla.**

### LO QUE ESTA SPEC ENSEÑO, Y ESTA EN `LECCIONES.md`

1. **Tres veces el mismo patron: el oraculo verde por un seed irreal.** `seedMember` creaba el
   `user` con `emailVerified: true`; un integrante **real** nace con `false`
   (`staff-create.ts:132`). Las suites median **un caller que no existe en produccion**. Lo
   encontraron **mutaciones que SOBREVIVIERON** — ninguna revision de codigo lo habria visto. La
   primera reparacion fue **local** y dejo la causa en la fuente; lo cazo el revisor re-corriendo
   M3. Arreglado en la fuente: `emailVerified: opts.emailVerified ?? false`, o sea **la forma de
   produccion es el default y `true` hay que pedirlo**.
2. **Segunda spec seguida con una FILA DE MUTACION FALSA, y las dos las escribi yo.** La M6
   mandaba a mutar «el evaluador del plan del catalogo», que **no existe**. **Ya es regla en
   `CLAUDE.md`**: cada fila de la tabla se verifica contra el arbol **antes** de cerrar la spec.
3. **El §7 afirmaba un mecanismo medido a medias, y TAPABA un bloqueo real.** Decia que un staff
   con `loyalty` «edita pero no crea»; es al reves. Al declararlo «correcto y declarado» cerraba
   la puerta a mirar, y detras estaba la superficie delegada **pero muerta**. Su gemelo en el
   codigo: un docblock que decia «fail-closed» sobre algo que no lo es.
4. **`TURBO_FORCE=1`, NO `-- --force`** — este ultimo se lo pasa a `tsc` y mata el gate con
   `TS5093`: un rojo por el motivo equivocado. **Ya esta en la skill `gotchas-del-repo`.**

### PENDIENTES DE LA 0086

1. **Pendiente MIO (Neon MCP):** correr la `0041` sobre una **rama virgen sin staff** para el
   no-op completo. **PREGUNTADO AL OWNER EL 2026-09-21, SIN RESPUESTA** — crear una rama efimera
   se le pregunta (precedente: la temporal de la `0040`). Lo medido: el `DELETE` sobre la rama ya
   migrada (`antes 183 / borradas 0 / despues 183`) y los tres `ADD CONSTRAINT` validando 183
   filas sin fallar.
2. **Va al QA del owner contra prod:** el **201 completo** de `POST /api/brand/logo-upload` para
   un staff no es medible en integracion — `createLogoUpload` presigna contra **R2** y la rama no
   tiene credenciales. Lo medido es que el 403 del resolvedor desaparecio.
3. **Declarado y AFUERA:** `catalog/core.ts:73 ownerBusiness` es codigo sin consumidor de
   produccion (verificado: cero usos en `app/`). Andamiaje anterior a esta spec; borrarlo es una
   tarea con su propia fila.
4. **Nombrado, no perseguido:** un usuario con **dos membresias activas** — `membershipContext`
   resuelve con `orderBy(asc(createdAt)).limit(1)`. **No es regresion de esta spec**; el
   `businessId` nuevo solo la hace visible.

### LO QUE SIGUE EN EL ARCO

**Spec B** (`core.activity_log` + `GET /api/activity`, que **lee solo el owner**) — sin escribir,
**serializa despues de A**, que ya esta. **Spec C** (archivado del catalogo) — sin escribir,
disjunta de A. Ninguna tiene decision de producto abierta: el ADR 0079 las cerro todas.

### ⚠ DOS COSAS ABIERTAS QUE NO DEPENDEN DE LA 0086

1. **`test:e2e` sigue EN ROJO para `c8c552b`**, que trae `.tsx`. Motivo medido: el puerto 3000 lo
   ocupan **dos procesos del owner** (PIDs 29871 y 97387) y `playwright.config.ts:18` espera ahi
   al consumer, asi que el `webServer` choca con el guard de instancia unica de Next y Playwright
   **no llega a ejecutar una sola asercion**. **No se matan servidores del owner sin preguntar**;
   se le pregunto el 2026-09-20 y **no contesto todavia**. Es el unico gate que puede tumbar
   `main` despues de un push «con todo verde».
2. **El push de los 3 commits no se pidio.** Va despues del e2e, no antes.

**Los cinco gates de root, con Node 24.20.0 y FORZADOS (`0 cached`), antes del `c8c552b`:**
`typecheck`, `lint`, `format:check` y `build` verdes, y la suite completa con la rama de
integracion Neon **ACTIVA** → **235 archivos / 1862 tests, 0 failed, 0 skipped**.

**⚠️ EL SEXTO GATE NO CORRIO, Y APLICA** (el `c8c552b` trae `.tsx`). **El motivo es concreto y
NO es el que decia el handoff heredado** (ahi figuraba un `EPERM` del sandbox): el puerto 3000
lo ocupa un `next dev` de **merchant** (PID 97387) y `playwright.config.ts:18` espera ahi al
**consumer**, asi que el `webServer` del consumer choca con el guard de instancia unica de
Next y Playwright **no llega a ejecutar una sola asercion**. Se intento, se leyo la salida y se
declara — no se asume verde. Para correrlo hay que liberar el 3000 (es un server del owner: no
se mata sin preguntar) y despues:
`pnpm exec playwright install chromium && pnpm run test:e2e`.

**Es el unico gate que puede tumbar `main` despues de un push «con todo verde», asi que hay
que correrlo ANTES de pushear el `c8c552b`.**

**La decision ya esta tomada y escrita:** `docs/adr/0079-los-permisos-del-staff-son-alcances-por-objeto.md`,
con su fila en `INDEX.md`. Las siete decisiones del owner se tomaron en conversacion el
2026-09-20 y estan citadas textualmente ahi — **no se le vuelven a preguntar**.

**Lo que el ADR decide, en una linea cada uno:** siete permisos por objeto y nunca una matriz
CRUD · lo irreversible no se delega y desactivar no cuenta como destructivo · el permiso
`staff` es el perfil **administrador** y solo el owner lo otorga · los permisos viven en
`business_membership.permissions text[]` · un solo guard con el orden del ADR 0073 intacto ·
`permissions` viaja en `GET /api/merchant/session` · `core.activity_log` en texto plano y en
la misma transaccion que la mutacion, con el mostrador afuera.

**Las tres specs:**

| Spec | Que | Estado |
|---|---|---|
| **A → `0086`** | los permisos y `requireApiPermission`: migracion `0041` con sus tres CHECK y el **borrado** de las membresias de staff existentes, diez superficies migradas, `POST /api/staff` con `permissions`, `PATCH /api/staff/{userId}/permissions`, el mostrador exigiendo `counter`, `permissions` en la sesion, y el contrato `specs/0086-contratos-de-api.md` | **CERRADA** — lista para el implementador |
| **B** | `core.activity_log`, la escritura transaccional en las superficies de A y `GET /api/activity` (lo lee **solo el owner**) con su contrato | sin escribir; **serializa despues de A** |
| **C** | **archivado del catalogo** — verificado: `schema/catalog.ts` no tiene `archived_at` ni `deleted_at`, el `DELETE` es **duro**, asi que «archivar si, borrar solo el owner» no es implementable hoy. Migracion + filtros de lectura en catalogo publico y backoffice | sin escribir; disjunta de A |

**Los dos puntos que faltaban antes de despachar, ya resueltos el 2026-09-20:**

1. **El cambio de contrato esta MEDIDO y su radio es CERO.** `not_owner` desaparece de las
   diez superficies delegables (lo reemplazan `not_member` y `missing_permission`), pero los
   unicos consumidores fuera de tests son `src/ui/api-error.tsx` y
   `business/onboarding/_components/wizard-shared.tsx`, **y quien los importa es solo el wizard
   de alta** (`_lib/contracts.ts`), que corre contra `/api/onboarding/*` — una de las cuatro
   superficies de la CUENTA, que **conserva `not_owner`**. Ninguna pantalla de hoy se entera.
   Lo que cambia son **doce archivos de test** y dos `code` nuevos en ese mapa compartido.
2. **El backfill se elimino** por decision del owner: la migracion **borra** las membresias de
   staff existentes y el owner las recrea. Ver el §1 de la spec para por que el `delete` vive
   en la migracion y por que se borra la membresia y **no** el `user`.

**Cero `.tsx` en las tres: la UI la construye el owner por fuera** (ADR 0070 §16-17). Lo que
estas specs entregan es API **y su contrato escrito**, que es lo que consume quien hace la UI.

**LOS DOS HALLAZGOS QUE EL ADR DEJO ABIERTOS YA ESTAN CERRADOS** (owner, 2026-09-20):
`POST /api/locations/:id/status` y `campaigns/:id/pause`/`activate` **van** con su permiso
(*«van»*), y **`GET /api/activity` lo lee solo el owner** (*«solo owner»*) — el perfil
administrador no lee el log que lo audita. Estan integrados en el ADR §2 y §7.6. **No queda
ninguna decision de producto abierta en este arco.**

**Un hueco conocido que entra al DoD de la spec A:** `auth-guards.ts` (guard de PAGINAS)
rebota solo con `closed`; `suspended` pasa a proposito para que el owner lea el motivo. Hoy no
filtra nada porque las paginas son owner-only, pero **cuando el staff tenga pantallas una
cuenta suspendida se las va a renderizar**. La API igual contesta 403: no hay dato en riesgo.

**Lo que este arco desbloquea:** el tour `staff` del onboarding, que hoy no tiene pantalla
(`backoffice-navigation.tsx:37`, `href: null`) y por eso el checklist lo muestra
«Proximamente» (ADR 0078 §6).

**El PIN fuera de banda (SMS) NO es parte de este arco:** fila **60** de `PARQUEADO.md`, con
la escalada residual que deja abierta escrita ahi y aceptada por el owner.


## ⇥ ▶ UI DEL ONBOARDING — PRIMER PASO IMPLEMENTADO, TOURS PREPARADOS

**Punto de continuacion:** `docs/handoff-onboarding-ui-2026-09-20.md` contiene el handoff
autocontenido del trabajo, estado del arbol, QA, mutaciones de Neon y receta para publicar el
proximo tour.

**Implementado el 2026-09-20, commiteado en `c8c552b`:**

- La home del backoffice consume `GET /api/onboarding/checklist` y muestra la tarjeta de
  `verify-email` solo mientras el item existe y tiene `done: false`.
- El CTA consume `POST /api/merchant/auth/verify-email`, cubre envio, reenvio, email ya
  verificado y error recuperable. Los cuatro tours todavia no se muestran porque sus recorridos
  de pantalla no estan implementados; no se le presenta al merchant un progreso imposible.
- Un fallo al cargar el checklist ya no se oculta como si no hubiera onboarding: muestra un
  estado de error con reintento. El primer QA local encontro un `503` porque la base configurada
  por el dev server no tenia disponible la migracion `0040`; no se aplico a ciegas porque
  `db:migrate` muta la base señalada por `.env.local`.
- Despues del primer QA visual, la tarjeta de un paso se reemplazo por el checklist progresivo
  mobile-first especificado en `docs/onboarding-ui.md`: zona de activacion separada del
  dashboard, resumen colapsable, progreso, lista vertical y estados `done` / `current` /
  `blocked` / `upcoming`. La UI consume los cinco items, pero solo `verify-email` esta publicado
  como accion; los tours sin pasos reales dicen `Proximamente` y no arrancan driver.js.
- Segundo QA visual: el owner preciso que no queria otra seccion dentro del dashboard sino un
  widget anclado abajo. Se saco del flujo: en movil queda sobre la navegacion inferior y abre una
  lista con scroll propio; en escritorio flota abajo a la derecha. Tambien se corrigio el grid
  del item: `[indicador][texto]` arriba y el CTA a ancho completo abajo, nunca como tercera
  columna.
- `onboarding-tour.ts` integra `driver.js` para que cada futura pantalla declare localmente sus
  `DriveStep[]`. Terminar persiste `completed`; cerrar o saltear persiste `skipped` mediante
  `POST /api/onboarding/tours/{tourId}`. El CSS oficial de driver se carga desde el root layout.
- Contrato cliente cubierto por 10 tests: parseo estricto del checklist, lectura con sesion,
  escritura exacta y rechazo de una escritura 403, mas `completed` al terminar y `skipped` al
  cerrar driver.js, y los cuatro estados visuales del checklist.

**Verificacion ejecutada con Node 24.20.0:** `typecheck`, `lint`, `format:check`, suite completa
(`141 archivos / 1352 tests passed`; 94 archivos Neon omitidos por no estar activa la rama de
integracion) y build de produccion merchant con webpack, verdes. El build Turbopack y
`pnpm test:e2e` no pueden abrir sus puertos auxiliares en este sandbox (`EPERM`); Playwright se
intento y fallo antes de iniciar los servidores, no en una asercion.

**Siguiente gatillo:** cuando una pantalla tenga su tour definido, llamar
`startOnboardingTour({ tourId, steps })` desde esa pantalla y añadir su selector estable local.
No agregar pasos ni selectores al API.

**Migracion para QA aplicada a Neon `main` el 2026-09-20:** proyecto
`red-violet-38772073`, rama `br-curly-silence-ax8acywm`, base `neondb`. Se preparo y valido en
una rama temporal administrada por Neon, el owner confirmo la aplicacion y la rama temporal fue
eliminada. Verificacion posterior en `main`: `core.business_onboarding_tour` existe,
`drizzle.__drizzle_migrations` tiene **41** filas y el ultimo hash es
`5585a9febeab4816ac1700aabdfd9098ab9673eb12eee8a98077f1f0b37710f8` (el de `0040`). La tabla
empieza con 0 filas, como corresponde: el progreso se crea con el primer POST de un tour.

**Cuenta de QA habilitada para continuar:** por pedido explicito del owner se actualizo mediante
MCP, solo en Neon `main`, `merchant_auth.user.email_verified = true` para
`gjlccghplujnhlkqpk@kjkpc.net` (id `29918f4b-09ad-4dfa-b8e8-df528e967740`). La lectura previa
dio `false` y `UPDATE … RETURNING` confirmo `true`.

## EL ARCO DEL ONBOARDING ESTA COMPLETO DEL LADO DE LA API

### ESTADO — ESCRITO DESPUES DE LOS COMMITS DEL TRABAJO, con sus shas

**Las dos specs estan `implementada`, cada una con PASS de un revisor independiente.**

| sha | que |
|---|---|
| `400aa07` | **spec 0084** — migracion `0040`, `core.business_onboarding_tour`, `ONBOARDING_TOURS`, `POST /api/onboarding/tours/{tourId}`, tres tests, contrato `0084-contratos-de-api.md` |
| `9dfd293` | docs de la 0084 — estado, dos `mistake→rule`, la precision a la 0085 |
| `fbb596b` | **spec 0085** — checklist de 1 a 5 items, `blocking` borrado, enmienda del contrato `0083-contratos-de-api.md` |

**NADA DE ESTO ESTA PUSHEADO.** El owner autorizo *«si hace los dos commit»* para la 0084 y el
trabajo de la 0085; **el push no se pidio**. Se lee con
`git rev-list --left-right --count origin/main...main`.

**Antes de pedirle QA al owner** hay que verificar que prod tenga **EL COMMIT**, y **no con
`/status`** — en este repo devuelve `success` con la CI corriendo. El comando es
`GH_TOKEN= gh api repos/maxhost/check-point/commits/<sha>/check-runs --jq '.check_runs[] |
"\(.name): \(.status) -> \(.conclusion)"'`, **todos** `completed` y `success`.

**La verificacion de la 0085, y quien la hizo:**

| Que | Resultado |
|---|---|
| Revisor independiente | **PASS**, 5 del presupuesto **+ 3 extra** (`MR5b`, `MR6`, `MR7`), con la asercion de cada rojo leida |
| Rojos de la PROPIEDAD vs. de PLOMERIA | **separados uno por uno**, que es el punto de la revision: de los 3 rojos de M3, **solo UNO** es de aislamiento; los otros dos dicen *«expected 503 to be 200»* porque sin `.where()` el doble de `./db` devuelve otra cosa |
| «No hay dos listas de ids» | **falsificado**: agregar un quinto id a `ONBOARDING_TOURS` deja de compilar (`TS2741` sobre `TOUR_COPY`) |
| Gates de root, Node 24 | los cinco verdes, corridos **tambien por el orquestador** despues de sus propias ediciones: `typecheck` y `build` **forzados** (`0 cached`), y `test` con la **integracion Neon ACTIVA** → `231 passed / 1848 passed`, **0 skipped** |
| `test:e2e` | **NO aplica y esta DECLARADO**: cero `.tsx` |
| Mutaciones en el arbol | `rg -n MUTATION apps tools` → vacio |

### ⚠️ LA FILA M5 DE LA SPEC 0085 ERA FALSA, y la escribi yo

**La tabla de mutaciones afirmaba que sacar el `sort` por `position` tambien ponia rojo «el orden
de los 5 ids en integracion». Se ejecuto: ese caso quedo VERDE.**

**El mecanismo, medido:** `CHECKLIST_ITEMS` declara `verify-email` primero (`position: 1`) y
despues hace spread de `ONBOARDING_TOURS` con `position: indice + 2`, asi que `Object.entries`
**ya sale ordenado** y el `sort` es un **no-op contra el catalogo real**. Su unico oraculo son las
entradas **sinteticas**. **El §1 de la misma spec ya decia eso**, contradiciendo su propia tabla:
nadie cruzo las dos secciones.

**El arreglo barato existe y esta MEDIDO pero NO se aplico:** declarar `verify-email` **despues**
del spread (MR5b del revisor) — con el `sort` puesto la salida HTTP es identica (**129/129
verde**), y con el `sort` sacado el caso de integracion **y** el de la bateria se ponen rojos.
**No se aplico porque llego DESPUES del PASS y es codigo de produccion.** **Gatillo: la proxima
vez que se toque `checklist.ts`.** La correccion esta escrita en la spec, debajo de su tabla, y el
caso en `LECCIONES.md`.

### ❌ CORRECCION DE UN HALLAZGO QUE ESCRIBI MAL EN `9dfd293`

Ese commit dice que **la bitacora de mutaciones del implementador de la 0084 nunca se persistio**.
**Es FALSO: esta en este archivo, completa, con las cinco mutaciones y sus aserciones**, bajo el
titulo «SPEC 0084 — EN IMPLEMENTACION (2026-09-20). BITACORA DE MUTACIONES».

**Como me equivoque, que es lo unico que importa:** busque con `grep -n 'BITACORA.*0084'`, y ese
titulo pone el numero **antes** de la palabra. El barrido devolvio una sola fila y **lei el vacio
como una ausencia**. Es la tercera vez en la misma sesion que un barrido sintactico mal armado se
lee como un hecho del arbol. Caso en `LECCIONES.md`.

### LO QUE QUEDA ABIERTO, con su gatillo

Ninguno bloquea y ninguno es de produccion.

| # | Que | Gatillo / por que no se arreglo |
|---|---|---|
| 1 | **La rama `.limit()` del doble de `./db` no tiene oraculo.** El revisor la mutó (`limit: async () => []`) y **sobrevivio en verde** | Es una afirmacion de cobertura que no existe, **no** un riesgo de produccion. **Ya corregido el docblock** para que diga la verdad. Gatillo: si alguien agrega un caso que asevere la lectura del slug |
| 2 | **El caso de aislamiento de la 0084 parte su oraculo en dos `expect(` separados** (`onboarding-tours.neon.integration.test.ts:188` y `:191`) | Llego despues del PASS de la 0084. **Gatillo: la proxima vez que se toque ese archivo.** La forma correcta ya esta en el mismo archivo, en el caso del 404 |
| 3 | **`CHECKLIST_ITEMS` perdio el `as const satisfies`** y quedo `: Record<string, ChecklistItemDef>`: se pierde el tipado literal de las claves | Impacto medido: **cero**. El guard de «no hay dos listas» **sigue mordiendo** por `TOUR_COPY`, que es `Record<OnboardingTourId, …>` (probado con `TS2741`) |
| 4 | ~~El `503 onboarding_unavailable` no tiene oraculo~~ | **✅ CERRADO el 2026-09-20**, ver abajo. Y **eran DOS rutas, no tres**: la 0085 no agrega ruta — el «tres» contaba specs |

### ❌ EL OWNER YA HABIA DECIDIDO EL `503` Y NO QUEDO EN NINGUN ARCHIVO

**El 2026-09-20 el owner dijo, textual:** *«sobre el 503 pense que ya lo habias resuelto porque
hace mucho que te dije que resuelvas esto»*.

**Se busco antes de contestarle** —`503` en `TASKS.md`, `PARQUEADO.md`, `INDEX.md` y
`docs/archivo/`— y **su instruccion no esta en ningun lado**. Lo que si esta, TRES veces, es la
version del agente: *«pendiente de decision del owner, a quien se le ofrecio»* (specs 0083, 0084
y 0085, mas dos docblocks de tests). O sea que **el owner decidio en el chat y el agente registro
que la decision no estaba tomada**.

**Por que es grave y no un olvido chico:** cada spec del arco copio esa linea de la anterior **sin
volver a preguntar**, asi que una decision ya tomada se propago como pendiente por **tres specs
seguidas**, y en cada cierre se le volvio a ofrecer al owner algo que ya habia contestado. Es
exactamente lo que `CLAUDE.md` prohibe —*lo que el owner YA dijo no se le vuelve a preguntar*— y
el mecanismo por el que fallo es el que el mismo archivo advierte en §Estado: **lo que vive solo en
la conversacion no sobrevive**.

**Regla que sale de esto, y es una linea:** cuando el owner decide algo que cambia un **limite
declarado**, el limite se cierra o se reescribe **en el mismo turno**; y un «declarado afuera» que
se **copia** de una spec a la siguiente **se re-verifica contra las palabras del owner antes de
copiarlo**, porque copiar es re-afirmar. Caso en `LECCIONES.md`.

### LO QUE SIGUE, Y NO ES TRABAJO DE ESTE ARCO

**La UI del onboarding la construye el owner por fuera** (ADR 0070 §16-17). Lo que la API ya le
entrega, escrito y verificado:

- `GET /api/onboarding/checklist` → **cinco items** con `id`, `anchor`, `position`, `required`,
  `done`, `title`, `body`, `locale`. **`blocking` ya no existe.**
- `POST /api/onboarding/tours/{tourId}` con `status: "completed" | "skipped"`.
- Los contratos normativos: `specs/0083-contratos-de-api.md` (enmendado) y
  `specs/0084-contratos-de-api.md`.
- **✅ `driver.js` YA ESTA INSTALADA** — decision del owner del 2026-09-20: *«dejar todo instalado
  para que ChatGPT sepa que tenemos esta libreria de tours y que podemos implementarla para los
  tours sin que tenga que inventar o instalar nada nuevo»*. **Ver la seccion de abajo con lo que
  hace falta para usarla**, que es lo unico que hay que leer para no instalar nada.
- **Tres de los cuatro tours apuntan a pantallas que existen**; el de staff no
  (`backoffice-navigation.tsx:37`, `href: null`). **No bloquea** (ADR 0078 §6): su `done` queda en
  `false` y ningun tour es `required`.


### 🛠 PARA QUIEN CONSTRUYA LA UI DE LOS TOURS: LA LIBRERIA YA ESTA, NO INSTALES NADA

**Instalada el 2026-09-20 por decision explicita del owner.** No hay que elegir libreria, ni
instalar, ni evaluar alternativas: ya se midieron tres sobre nuestro Next en un iPhone 13 y gano
esta (ADR 0078 §5; la comparativa esta en la skill `gotchas-del-repo`).

| | Verificado el 2026-09-20 |
|---|---|
| Paquete | **`driver.js@1.8.0`**, en `apps/merchant/package.json` (`^1.8.0`) |
| Licencia | **MIT** — sin pago, sin ambiguedad (se leyo del paquete instalado) |
| `peerDependencies` | **NINGUNO.** Es la razon estructural por la que se eligio: no puede volver a pasar que la libreria se acople a una version de Next que no es la nuestra |
| Dependencias propias | **0** |
| Los dos imports | `import { driver } from "driver.js";` y **`import "driver.js/dist/driver.css";`** — el `.css` existe en el paquete, verificado |

**Es VANILLA: no trae bindings de React.** O sea que va en un componente `"use client"` y el tour
se arranca desde un efecto o un handler, no declarativamente. **Eso no es una carencia para
nosotros:** los cuatro tours son de UNA pantalla cada uno y **el estado ya lo guarda nuestra API**
(spec 0084), no la libreria.

**Lo que la UI tiene que respetar de nuestro contrato, y no es negociable:**

1. **El `anchor` que devuelve `GET /api/onboarding/checklist` es una CLAVE ESTABLE, nunca un
   selector** (ADR 0078 §3). El selector lo pone la UI. Si el JSON trajera selectores, cada
   rediseño romperia el tour en produccion **sin poner rojo a nadie en CI**.
2. **Al terminar O al saltear un tour hay que llamar a
   `POST /api/onboarding/tours/{tourId}`** con `{"status":"completed"}` o `{"status":"skipped"}`.
   **Los dos cuentan como `done: true`** en el checklist, pero **se persisten distintos** (decision
   del owner: quiere saber cuantos saltearon). Si no se llama, el item nunca se marca.
3. **Esa ruta lleva el gate de email:** con el email sin verificar contesta **403
   `email_not_verified`**. Es a proposito — es el bloqueo de `verify-email` hecho cumplir.
4. Los `tourId` validos son exactamente **`staff`, `catalog`, `program`, `brand`**. Cualquier otro
   es **404 `unknown_tour`**.
5. **NO existe ni va a existir un endpoint que sirva los PASOS del tour** (ADR 0078 §4). Los pasos
   son componentes/selectores de la UI. Por HTTP viaja **solo el estado**.

**Contratos normativos completos:** `docs/specs/0083-contratos-de-api.md` y
`docs/specs/0084-contratos-de-api.md`.

**Y el gate que se despierta:** **en cuanto se toque un `.tsx`, `pnpm test:e2e` pasa a aplicar.**
Es el sexto gate, el unico que nadie corre local y el unico que puede tumbar `main` despues de un
push «con todo verde». Los browsers se bajan aparte: `pnpm exec playwright install chromium`.


### BITACORA DE MUTACIONES — CIERRE DEL `503` (orquestador, 2026-09-20). ABIERTA ANTES DE MEDIR

**Que se esta midiendo.** El archivo nuevo `apps/merchant/src/server/onboarding-503.test.ts`
cierra el limite que las specs 0083/0084/0085 declararon afuera tres veces. **No toca codigo de
produccion: solo agrega un test.** Las mutaciones son para probar que sus oraculos MUERDEN.

**Punto de retorno.** Copias limpias en `/tmp/503-limpio/`. `shasum` ANTES de mutar:

| archivo | `shasum` limpio |
|---|---|
| `app/api/onboarding/checklist/route.ts` | `1898b53caf200e713eb27b92aa2bb43633a0b783` |
| `app/api/onboarding/tours/[tourId]/route.ts` | `4112fcd86502c77ffe188d63df9d6e67bd2bcec4` |

**Presupuesto: 3. Clase: que el `catch` filtre el mensaje de la excepcion, o que invente un
desenlace positivo.** Alcance de cada corrida: `src/server/onboarding-503.test.ts` (4 tests).

| # | archivo | mutacion | oraculo que TIENE que ponerse rojo | resultado EJECUTADO |
|---|---|---|---|---|
| **N1** | `checklist/route.ts` | el `catch` loguea `error.message` en vez de `error.name` | la asercion del NO-FILTRADO en el canal del log | **ROJO 1/4**, y es el oraculo exacto: *«AssertionError: expected `'"onboarding_checklist_failed" {"name"…'` not to contain `'slug=la-farmacia business_id=11111111…'`»*. **El caso de TOURS quedo VERDE** — el rojo es de la ruta mutada y no del montaje compartido |
| **N2** | `tours/[tourId]/route.ts` | idem | idem | **ROJO 1/4**: *«expected `'"onboarding_tour_failed" {"name":"slu…'` not to contain `'slug=la-farmacia business_id=11111111…'`»*. **El caso del CHECKLIST quedo VERDE**, el espejo del anterior |
| **N3** | `tours/[tourId]/route.ts` | el `catch` devuelve el recibo del camino feliz (`tourId`/`status`) junto al 503 | `body.tourId` y `body.status` **undefined** | **ROJO 1/4**: *«AssertionError: expected `'staff'` to be `undefined`»*. El `status` y el `code` **NO** distinguen este caso — los dos siguen siendo 503 y `onboarding_unavailable`. Lo unico que lo caza es la ausencia del recibo |

**CIERRE.** Las tres se midieron de a una, con la fila abierta ANTES de medir, etiqueta
`MUTATION` y reversion verificada por **`diff` contra `/tmp/503-limpio/`** (**IDENTICO** en los
dos archivos) y por `shasum` igual al de la tabla de arriba. `rg -n MUTATION apps tools` →
**vacio**. **Ninguna mutacion sobrevivio, y no se toco una sola linea de codigo de produccion:
lo unico que entra al arbol es el test.**

### BITACORA DE MUTACIONES — SPEC 0085 (REVISOR INDEPENDIENTE). Abierta ANTES de medir

**Punto de retorno.** Los dos archivos estan ` M` (trabajo sin commitear): `git checkout` NO es el
salvavidas. Copias limpias en `/tmp/rev0085/`. Restauracion:
`cp /tmp/rev0085/checklist.ts.clean apps/merchant/src/server/onboarding/checklist.ts` y
`cp /tmp/rev0085/checklist-facts.ts.clean apps/merchant/src/server/onboarding/checklist-facts.ts`.

| Archivo | `shasum` LIMPIO | git status |
|---|---|---|
| `apps/merchant/src/server/onboarding/checklist.ts` | `8d42e86220445c1be84e342663aab44adf4bda81` | ` M` |
| `apps/merchant/src/server/onboarding/checklist-facts.ts` | `c2e3c223155d86fc3bb24bcf48084d1252f4a4da` | ` M` |

Alcance de cada medicion: `src/server/onboarding/checklist.test.ts` +
`src/server/onboarding-checklist.neon.integration.test.ts` + `src/server/api-owner-surfaces.test.ts`.
Baseline verde re-medido por el revisor: **129 passed / 0 failed**.

| # | Archivo | Invariante que ataca | Resultado EJECUTADO |
|---|---|---|---|
| **MR1** | `checklist-facts.ts` (`and(eq(status,'completed'))`) | `skipped` cuenta como `done` | **ROJO 2/129, los dos por la PROPIEDAD.** `completed y skipped proyectan los dos done: true` → el vector difiere **solo** en `["program", true] → false` (la fila `skipped`), con `catalog` (`completed`) intacto en `true`. Y `un negocio NO ve el progreso de otro` → solo `["brand", true] → false`. Unit y bateria VERDES (no tienen fila real). **Revertida**: `diff` vacio, `shasum` `c2e3c2…` |
| **MR2** | `checklist.ts` (`done: () => true`) | el `done` de un tour LEE la tabla, no es constante | **ROJO 6/129 en los TRES archivos.** Bateria: *«expected [ false, true, true, true, true ] to deeply equal [ false, false, false, false, false ]»* — el item 1 queda en `false`, asi que el rojo es del tour. Unit: `el done de cada tour sale de toursHechos`. Integracion: los tres casos de `done`. **Revertida**: `diff` vacio, `shasum` `8d42e8…` |
| **MR3** | `checklist-facts.ts` (sin `.where()`) | la consulta filtra por `business_id` (aislamiento) | **ROJO 3/129, y SOLO 1 es de la propiedad.** `un negocio NO ve el progreso de otro (y si ve el suyo)` → `staff`/`catalog`/`program` pasan `false → true` (las filas del OTRO negocio) **con `brand` intacto en `true`** (la fila propia: control positivo). Los otros 2 son PLOMERIA, y su asercion lo dice: *«expected 503 to be 200»* en los dos casos del checklist de la bateria (el doble de `./db` devuelve `{where}` y la ruta cae al `catch`). **La lectura del implementador se confirma.** **Revertida**: `diff` vacio, `shasum` `c2e3c2…` |
| **MR4** | `checklist.ts` (`required: tourId === "catalog"`) | `verify-email` es el UNICO `required: true` | **ROJO 2/129, los dos por la propiedad.** Unit: *«expected [ true, false, true, false, false ] to deeply equal [ true, false, false, false, false ]»*. Integracion: el vector `[3, "catalog", "catalog", false, false]` llego con `required: true`. El item 1 queda `true` en los dos. Bateria VERDE (no asevera `required`) — declarado. **Revertida**: `diff` vacio, `shasum` `8d42e8…` |
| **MR5** | `checklist.ts` (sin `.sort()`) | el `sort` por `position` de `toChecklistView` | **ROJO 1/129, SOLO en el unit sintetico**: *«expected [ 'tercero', 'primero', 'segundo' ] to deeply equal [ 'primero', 'segundo', 'tercero' ]»*. **`los CINCO items salen en orden` quedo VERDE** → la fila M5 de la spec prometia un rojo en integracion que NO existe. **Revertida**: `diff` vacio, `shasum` `8d42e8…` |
| **MR5b** (fuera de presupuesto, medida) | `checklist.ts`: `verify-email` declarado DESPUES del spread, `position` intacto en 1 | ¿hay un oraculo barato que falsifique el `sort` con el catalogo REAL? | **SI.** Con MR5b **sola** (el `sort` puesto): **129/129 VERDE** — la salida HTTP es identica. Con MR5b **+ MR5** (`sort` sacado): **13 rojos**, entre ellos el de integracion *«expected [ [ 2, 'staff', 'staff', …(2) ], …(4) ] to deeply equal [ [ 1, 'verify-email', …(3) ], …(4) ]»* y el de la bateria *«expected 'staff' to be 'verify-email'»*. O sea: **reordenar la DECLARACION (no las `position`, no `ONBOARDING_TOURS`) le da al `sort` un oraculo de catalogo real a costo cero de comportamiento.** **Revertida**: `diff` vacio, `shasum` `8d42e8…` |
| **MR6** (fuera de presupuesto, medida) | `api-owner-surfaces-support.ts`: `limit: async () => []` | el docblock nuevo afirma *«la lectura del slug sigue viendo la suya»* | **VERDE — la mutacion SOBREVIVE.** `api-owner-surfaces.test.ts` (el unico importador) pasa entero con la rama `.limit()` devolviendo `[]`: esa mitad del doble **no tiene oraculo**. No es riesgo de produccion (es andamiaje), pero el docblock afirma cobertura que no hay. **Revertida**: `diff` vacio, `shasum` `135a16…` |
| **MR7** (fuera de presupuesto, medida) | `onboarding/tours.ts`: un quinto id (`"billing"`) en `ONBOARDING_TOURS` | el docblock nuevo afirma *«si `ONBOARDING_TOURS` gana o pierde un id este objeto NO COMPILA»* | **ROJO, y por el motivo correcto**: `tsc --noEmit` → *«src/server/onboarding/checklist.ts(93,7): error TS2741: Property 'billing' is missing in type … but required in type 'Record<"staff" | "catalog" | "program" | "brand" | "billing", …>'»*. El guard de «no hay dos listas» MUERDE. **Revertida**: `diff` vacio, `shasum` `a41454…` |

**Cierre del revisor.** `rg -n MUTATION apps tools` → vacio. `shasum` de los tres archivos
identicos a los limpios. Suite completa con la rama de integracion: **231 archivos / 1848 tests,
0 failed**. Ninguna mutacion sobrevivio al turno.


### BITACORA DE MUTACIONES — SPEC 0085 (implementador). **CERRADA: 5/5 medidas y revertidas**

**Punto de retorno.** Los dos archivos estaban ` M` (trabajo sin commitear) cuando se abrio esta
bitacora, asi que **`git checkout` NO es el salvavidas**: se lleva tambien la implementacion. Las
copias limpias estan en `/tmp/0085-limpio/`. Restauracion:
`cp /tmp/0085-limpio/checklist.ts apps/merchant/src/server/onboarding/checklist.ts` y
`cp /tmp/0085-limpio/checklist-facts.ts apps/merchant/src/server/onboarding/checklist-facts.ts`.

| Archivo | `shasum` LIMPIO |
|---|---|
| `apps/merchant/src/server/onboarding/checklist.ts` | `8d42e86220445c1be84e342663aab44adf4bda81` |
| `apps/merchant/src/server/onboarding/checklist-facts.ts` | `c2e3c223155d86fc3bb24bcf48084d1252f4a4da` |

**Alcance de CADA medicion** (los tres archivos que pueden ver estas mutaciones, corridos juntos
con `set -a; . ./.env.integration.local; set +a`): `src/server/onboarding/checklist.test.ts` +
`src/server/onboarding-checklist.neon.integration.test.ts` + `src/server/api-owner-surfaces.test.ts`.
**Baseline verde: 129 passed / 0 failed** (medido antes de la primera mutacion).

| # | Archivo | Invariante que ataca | Resultado EJECUTADO |
|---|---|---|---|
| **M1** | `checklist-facts.ts` | `skipped` cuenta como `done` (decision textual del owner) | **ROJO 2 de 129**, los dos en `.neon.integration` y **los dos por la propiedad**: `completed y skipped proyectan los dos done: true` → el vector difiere **solo en `["program", true] → false`** (la fila `skipped`; `catalog`, que es `completed`, quedo en `true`), y `un negocio NO ve el progreso de otro` → **solo en `["brand", true] → false`** (la otra fila `skipped`). El unit y la bateria quedaron VERDES: ninguno de los dos tiene fila real. **Revertida**: `diff` vacio, `shasum` `c2e3c2…` |
| **M2** | `checklist.ts` | el `done` de un tour LEE la tabla, no es constante | **ROJO 6 de 129, en los TRES archivos.** Bateria (los dos casos sin gate): *«expected [ false, true, true, true, true ] to deeply equal [ false, false, false, false, false ]»* — el item 1 se mantuvo en `false`, que es lo que separa el rojo de la propiedad del rojo del montaje. Unit: `el done de cada tour sale de toursHechos, item por item`. Integracion: `los CINCO items salen en orden…` (los cuatro `false` → `true`), `completed y skipped…` y `un negocio NO ve el progreso de otro`. **Revertida**: `diff` vacio, `shasum` `8d42e8…` |
| **M3** | `checklist-facts.ts` | la consulta filtra por `business_id` (aislamiento) | **ROJO 3 de 129, pero SOLO UNO es de la propiedad** y es el que importa: `un negocio NO ve el progreso de otro (y si ve el suyo)` → `staff`, `catalog` y `program` pasan de `false` a **`true`** (son las filas del OTRO negocio) **mientras `brand` sigue en `true`** (la fila propia, el control positivo). Los otros dos rojos son de PLOMERIA y estan leidos: los dos casos del checklist en la bateria dan *«expected 503 to be 200»* porque sin `.where()` el doble de `./db` devuelve el objeto `{where}` en vez de un array y la ruta cae al `catch` — **no prueban el aislamiento**. **Revertida**: `diff` vacio, `shasum` `c2e3c2…` |
| **M4** | `checklist.ts` | `verify-email` es el UNICO `required: true` | **ROJO 2 de 129**, los dos por la propiedad. Unit (`verify-email es el UNICO required: true`): *«expected [ true, false, true, false, false ] to deeply equal [ true, false, false, false, false ]»* — la tercera posicion. Integracion (`los CINCO items salen en orden…`): el vector del item 3 `[3, "catalog", "catalog", false, false]` llego con `required: true`. **El primer item quedo `true` en los dos**: el rojo es del tour, no del email. La bateria quedo VERDE (no asevera `required`) — declarado. **Revertida**: `diff` vacio, `shasum` `8d42e8…` |
| **M5** | `checklist.ts` | el `sort` por `position` de `toChecklistView` | **ROJO 1 de 129, y SOLO en el unit**: `ordena por position ascendente aunque lleguen desordenadas` → *«expected [ 'tercero', 'primero', 'segundo' ] to deeply equal [ 'primero', 'segundo', 'tercero' ]»*. **HALLAZGO: la fila M5 de la spec afirma que tambien se pone rojo «el orden de los 5 ids en integracion», y es FALSO** — medido: ese caso quedo VERDE, porque el catalogo real se declara YA ordenado (`verify-email` y despues `ONBOARDING_TOURS`, que es el orden de `position`). Con el catalogo real el `sort` **no se puede falsificar**: su unico oraculo son las entradas sinteticas, que es lo que dice el §1 de la spec (y contradice su propia tabla). **Revertida**: `diff` vacio, `shasum` `8d42e8…` |

**Cierre.** Las cinco se midieron de a una, con la fila abierta ANTES de medir, etiqueta
`MUTATION` y reversion con `diff` contra `/tmp/0085-limpio/`. Al terminar:
`rg -n MUTATION apps tools` → **vacio**, y los dos `shasum` **identicos a los de la tabla de
arriba**. Ninguna mutacion sobrevivio al turno.

### SPEC 0085 — TRABAJO DEL IMPLEMENTADOR, SIN COMMITEAR (lo commitea/PASS el orquestador)

**No esta marcada `implementada`**: falta el PASS de un revisor independiente (ADR 0071). El
arbol tiene 11 archivos ` M` y 1 `??` (`apps/merchant/src/server/onboarding-checklist-support.ts`).

**Los cinco gates de root con Node 24 (v24.20.0), corridos UNA vez al final y por separado:**
`typecheck` → 3 successful; `lint` → sin salida; `format:check` → *All matched files use Prettier
code style!*; `test` con `set -a; . ./.env.integration.local; set +a` → **231 archivos / 1848
tests, 0 failed**; `build` → 3 successful (merchant **cache miss**, o sea que midio).
**`test:e2e` NO aplica y esta DECLARADO:** `git status --porcelain | grep -c '\.tsx$'` → **0**.

**Tres cosas que la spec afirma y NO se cumplen contra el arbol (para el revisor):**

1. **La fila M5 promete un rojo en integracion que NO ocurre.** Ver su fila: el catalogo real se
   declara ya ordenado, asi que sacar el `sort` deja el orden de los 5 ids intacto. El oraculo
   real del `sort` son las entradas SINTETICAS del unit, que es lo que dice el §1 de la spec.
   **No se reordeno el catalogo para fabricarle un rojo**: seria una decision de diseño que
   nadie pidio. Limite declarado, no supuesto — se intento y se midio.
2. **El barrido `blocking` de la DoD alcanza DOS archivos que la tabla «Archivos» no lista**:
   `server/onboarding/tours.ts` y `app/api/onboarding/tours/[tourId]/route.ts`, los dos de la
   0084 y los dos con el campo citado en PROSA. Se editaron (solo docblock) porque si no el
   criterio no daba vacio, y porque su prosa quedaba falsa igual.
3. **`api-owner-surfaces-support.ts` tambien nombraba el campo borrado** (fuera del barrido, pero
   describiendo el gate de la 0084). Se corrigio ahi mismo. **Queda sin tocar** la unica mencion
   restante del arbol: el comentario del `.sql` de la migracion `0040`, que es historico y las
   migraciones no se reescriben.

### HALLAZGOS DE LA 0084 QUE NO SE ARREGLARON, con su gatillo

Ninguno bloquea y ninguno es de produccion.

| # | Que | Por que no se arreglo / gatillo |
|---|---|---|
| 1 | **El caso de aislamiento parte su oraculo en dos `expect(` separados** (`onboarding-tours.neon.integration.test.ts:188` y `:191`): bajo la mutacion M3 vitest aborta en el primero y la mitad «B sigue sin fila» **nunca se evalua** | No es hueco de cobertura hoy (la M3 muerde igual). **Llego DESPUES del PASS y tocar el test habria invalidado la revision** — mismo criterio que la fila 59 de `PARQUEADO.md`. **Gatillo: la proxima vez que se toque ese archivo.** La forma correcta ya esta en el mismo archivo, en el caso del 404: juntar el oraculo en UN objeto |
| 2 | **La migracion `0040` lleva `CREATE TABLE IF NOT EXISTS` escrito a mano**, que `drizzle-kit` no emite y que ninguna de las otras 40 tiene | El docblock del `.sql` **dice la verdad** (la idempotencia que sugiere no existe: el `ADD CONSTRAINT` de la FK vuelve con `42710`, ejecutado). Ya paso la revision y cambiarlo no compra nada. **Bajo a `LECCIONES.md` y a la skill como regla para escribir specs** |
| 3 | **`drizzle/meta/_journal.json` perdio el newline final** | Lo reescribio `drizzle-kit`. `drizzle/meta/` esta en `.prettierignore`, asi que **ningun gate lo mira**. Cosmetico |
| 4 | **La bitacora de mutaciones del IMPLEMENTADOR no quedo en este archivo** — solo esta la del revisor | Se detecto al revisar el `git diff` (cero lineas borradas, o sea que nunca se persistio). **La del revisor es la que vale**: re-midio las 5 sobre el arbol final. **Regla para el proximo encargo: exigir la fila de bitacora en `TASKS.md` como entregable verificable, no como paso del protocolo** |

### LOS DOS `mistake→rule` DE ESTA SESION

Los dos salieron de cerrar la 0084, los dos estan en `LECCIONES.md` con su caso y los dos bajaron
a la skill `gotchas-del-repo`:

1. **`typecheck` y `build` NO van en la misma invocacion de turbo.** `turbo run typecheck build
   --force` los corre concurrentes, `next build` regenera `.next/types/` —que
   `apps/merchant/tsconfig.json:6` **incluye**— y `tsc` lee `validator.ts` sin que exista el
   `routes.js` que importa: **`TS2307`**. Por separado los dos pasan. **El rojo es del arnes, no
   del arbol**, y aparece al final de una spec sobre codigo ya revisado. Corolario: un gate que
   dice `>>> FULL TURBO` **no midio nada en esa corrida**.
2. **Una spec no dicta el texto de un `.sql`, y `CREATE TABLE IF NOT EXISTS` no va.** Ver hallazgo
   2 de arriba. Incluye una hipotesis comoda que se **desmintio midiendo**: editar un `.sql` ya
   aplicado **no** lo impide el `hash` de `drizzle.__drizzle_migrations` — `pg-core/dialect.js:62`
   decide por `created_at < folderMillis`, y el hash se guarda pero **nunca se compara**.

## ⇥ ✅ BITACORA DE MUTACIONES — spec 0084 (REVISOR independiente, 2026-09-20) — CERRADA, 5/5 ROJAS Y REVERTIDAS

Presupuesto: **5 mutaciones**. Clase de error: **que la ruta deje escribir a quien no debe, que
escriba en el negocio equivocado, o que el `completed` se degrade**. Abierta ANTES de medir.

**Re-medicion independiente**: el implementador midio sus cinco contra `route.ts` = `d501d6f6…`
(antes del arreglo del docblock). Estas cinco se midieron contra el **estado FINAL del arbol**,
`route.ts` = `fd6cd562c1299b39bc753ca00b0a7fb3dd8c364c` y
`onboarding/tours.ts` = `bab333492b7589df576806887a874c19fda0396f`.

**Las cinco REVERTIDAS**: `diff` vacio contra `/tmp/limpios-0084-revisor/` en los dos archivos,
`shasum` de vuelta en los de arriba y `rg -n MUTATION apps tools` → **vacio**.

Alcance de cada medicion (con la env de integracion cargada):
`src/server/onboarding-tours.neon.integration.test.ts` + `src/server/onboarding/tours.test.ts` +
`src/server/api-owner-surfaces.test.ts` — **153 tests, verdes en limpio**.

| id | archivo | shasum limpio | invariante que ataca | resultado EJECUTADO |
|---|---|---|---|---|
| R-M1 | `route.ts` | `fd6cd562…` | el gate de email SE APLICA en esta ruta | **ROJO 3/153.** Integracion, *«owner con el email SIN verificar → 403 `email_not_verified` y NO escribe»*: `AssertionError: expected 200 to be 403`. Bateria compartida, *«onboarding/tours/{tourId}: owner con `emailVerified: false` → 403»* y su gemelo fail-closed: `expected 503 to be 403` (**no 200**; el doble de `./db` del archivo solo expone `select`, asi que el `insert` tira `TypeError` —leido en el stderr `onboarding_tour_failed { name: 'TypeError' }`— y cae al `catch`). **El caso del INTEGRANTE quedo VERDE** (`onboarding/tours/{tourId}: un INTEGRANTE … → 403 not_owner` ✓), o sea que el rojo es de la propiedad y no del setup |
| R-M2 | `onboarding/tours.ts` | `bab33349…` | `completed` NUNCA se degrada a `skipped` | **ROJO 1/153.** *«NO DEGRADA: `completed` y despues `skipped` deja la fila en `completed`»*: diff `- "status": "completed"` / `+ "status": "skipped"`. Los otros 152 verdes: por HTTP el efecto es **nulo** |
| R-M3 | `route.ts` | `fd6cd562…` | el `businessId` sale del GUARD, no del cuerpo | **ROJO 1/153.** *«el `businessId` sale del GUARD…»*: `expected [] to deeply equal [ { tour_id: 'staff', …(1) } ]` — el negocio del caller quedo SIN fila porque la escritura se fue al del cuerpo. El `200` sale igual |
| R-M4 | `route.ts` | `fd6cd562…` | el `tourId` se valida contra `ONBOARDING_TOURS` | **ROJO 1/153, con LAS DOS MITADES en el mismo diff.** *«`404 unknown_tour` … por un owner autenticado»*: `expected { status: 200, code: undefined, filas: 1 } to deeply equal { status: 404, code: "unknown_tour", filas: 0 }` |
| R-M5 | `route.ts` | `fd6cd562…` | `unknown_tour` se evalua DESPUES del guard | **ROJO 1/153.** *«sin sesion y con un `tourId` inventado → 401 `unauthorized`, NUNCA 404»*: `expected 404 to be 401` |

## ⇥ (contexto del arco) EL ONBOARDING SE REDEFINIO — LAS DOS SPECS YA ESTAN ESCRITAS

**El bloque anterior de esta seccion («PROXIMO = STAFF») quedo OBSOLETO y se reemplaza aca.**
Nunca se commiteo, asi que no dejo rastro en el arbol.

### La forma que dicto el owner el 2026-09-20 (segunda conversacion del dia), textual

> *1 El merchant llega a su panel luego del wizard. 2 Ve el Onboarding — 2.1 Verifica tu email:
> Done cuando el email es verificado. 2.2 Tour por Staff: Done completa el tour o skipe. 2.3 Tour
> por Catalogo. 2.4 Tour por Programa. 2.5 Tour por marca.*

Y sobre el skip, textual: *«si, un merchant puede completar el onboarding con skip de todo»*
— se le planteo que asi el checklist mide «¿le mostramos la app?» y no «¿esta listo para
operar?», y lo acepto explicitamente.

**Un solo item deriva de un hecho de dominio (el email, ya implementado en la 0083). Los otros
CUATRO tienen el MISMO `done`: «este usuario completo o salteo este tour».**

### Lo que esto MATA, y es la consecuencia grande

**`GET /api/onboarding/guide/{itemId}` NO SE CONSTRUYE NUNCA.** El ADR 0077 §1/§5 diseno un
segundo recurso para servir *el contenido* del tutorial. Con una libreria de tours en el cliente
el contenido son componentes React en la UI, no JSON nuestro. **Hay que corregir el contrato
`0083-contratos-de-api.md` §5, que hoy anuncia ese endpoint a quien construya la UI.**

Lo que queda del lado de la API: el **estado**. O sea una **tabla nueva** (progreso por usuario
× negocio × tour) y **la primera escritura del onboarding** — hasta hoy el checklist es lectura
pura. El `anchor` del ADR 0077 §3 («clave estable, nunca un selector») sigue siendo correcto y
ahora vale mas: los selectores los necesita la libreria, y viven en la UI.

**Decision del owner ya tomada, textual:** guardar `completed` y `skipped` como valores
DISTINTOS aunque los dos cuenten como `done` — se le propuso y acepto («si, un merchant puede
completar el onboarding con skip de todo»). Con un booleano el dato se perderia.

### LA MEDICION DE `@tour-kit/react` (usertourkit.com) — EJECUTADA, 2026-09-20

El owner eligio la libreria y pidio medir compatibilidad **de verdad**. Se hizo en un worktree
descartable (`tools/worktree-new.sh probe-tourkit`), ya **borrado**; el repo principal quedo con
el `node_modules/.modules.yaml` en el MISMO shasum (`a29add45…`).

**VEREDICTO: compatible con Next 16, pero SOLO por un camino de los dos.**

| Lo medido | Resultado EJECUTADO |
|---|---|
| Version | `@tour-kit/react@3.0.0` + `@tour-kit/core@3.0.0` (publicadas 2026-09-14) |
| `pnpm peers check` | **UN solo peer sin cumplir: `next`.** Instalado 16.3.0, pedido `^13 \|\| ^14 \|\| ^15`. React 19.2.8 y Tailwind 4 ✅. El peer es `optional`, y el repo no tiene `.npmrc` ni `strict-peer-dependencies`, asi que el install NO falla |
| **Variante A: `useNextAppRouter()`** | **ROMPE EL BUILD.** `pnpm run build` → **EXIT 1**: *«Error: dynamic usage of require is not supported»* + *«Error occurred prerendering page "/probe-tourkit"»*. Ese hook resuelve `next/navigation` con un **require dinamico** que **Turbopack** (bundler por defecto de Next 16) no soporta. Su propio `.d.ts` lo dice: *«Automatically imports from 'next/navigation'»* |
| **Variante B: `createNextAppRouterAdapter(usePathname, useRouter)`** | **VERDE.** Los hooks los importa el consumidor, asi que no hay require dinamico. `typecheck` ✅, `build` ✅ (`/probe-tourkit` prerenderizado como estatico) |
| **Navegador real** (Playwright + chromium, sobre el build de produccion) | **Los tres oraculos pasan.** (1) el adaptador leyo el pathname de Next 16: `getCurrentRoute() = /probe-tourkit`; (2) el paso del tour se monto y pinto su titulo y su contenido; (3) **cero errores de runtime y cero errores de consola**. Screenshot: overlay + spotlight sobre el boton + tarjeta con `Finish` |

**LA REGLA QUE SALE DE ESTO, y tiene que entrar a la spec y a la skill `gotchas-del-repo`:**
**usar SIEMPRE `createNextAppRouterAdapter` inyectando `usePathname`/`useRouter`; NUNCA
`useNextAppRouter()`.** El typecheck NO lo caza — las dos tipan igual. Lo caza el **build**, que
es un gate que nadie corre en el Stop hook (ahi van typecheck+lint+test): esto llega a CI o a
Vercel, no al escritorio.

**LIMITE DECLARADO, no perseguido:** el badge «Unlicensed» **no se reprodujo** — pero la corrida
tenia un `NODE_ENV` no estandar (Next lo advirtio en el log), asi que **«no lo vi» NO es «no
hay»**. No se midio si aparece con la build de produccion real.

### Licencia — DECIDIDO POR EL OWNER, textual

> *«Licencia, no me importa me cobran 10 para ir a produccion, pago y listo y si la licencia en
> ese archivo dice MIT es mit»*

Se le habia levantado la contradiccion, medida: el `package.json` de la 3.0.0 declara
**`BUSL-1.1`**, y el archivo `LICENSE` **que viaja dentro de ese mismo tarball** dice **MIT**
(verificado sobre el paquete instalado, no sobre el repo de GitHub). Precios del vendor: **$9.99**
(1 proyecto) / **$49** (5) / **$299** (ilimitado), pago unico. **El owner decidio: es MIT y se
paga la licencia de produccion.**

### El orden de los tours — DECIDIDO POR EL OWNER, textual

> *«datos para el orden, no me preocupa ahora. porque creare cada tour cuando este completa la
> pantalla, las api en esa pantalla, etc. No es problema ahora»*

O sea que el dato medido —de los cuatro tours, **tres apuntan a pantallas que existen**
(`/backoffice/catalog`, `/backoffice/loyalty`, `/backoffice/brand`) y **el de staff a una que no**
(`backoffice-navigation.tsx:37`: `href: null, soon: true`)— **no bloquea**: cada tour se crea
cuando su pantalla este lista.

### ESTADO — ESCRITO DESPUES DE LOS COMMITS, con sus shas

**La 0083 esta PUSHEADA y su CI esta VERDE.** El owner autorizo el push el 2026-09-20
(*«hace los 4 commit»*). `4753dc4..3f9566f main -> main`, y despues
`git rev-list --left-right --count origin/main...main` → **`0 0`**.

**CI verificada por CHECK-RUNS del sha exacto**, no por `/status` (que en este repo devuelve
`success` con la CI corriendo): `gh api repos/maxhost/check-point/commits/3f9566f/check-runs`
→ **`verify: completed -> success`**.

**Lo que se commiteo en esta sesion, en orden:**

| sha | que |
|---|---|
| `b923084` | el `mistake→rule` de la 0083 que la sesion anterior dejo sin commitear |
| `1dee3a0` | **ADR 0078 + spec 0084 + las dos filas del INDEX** |
| `b598698` | dos `mistake→rule` NUEVOS (abajo) |

**Ninguno de esos tres esta pusheado todavia.** El owner autorizo el push de los CUATRO de la
0083, no de estos.

### ✅ EL ARCO ESTA ESPECIFICADO ENTERO. DOS SPECS `cerradas`, SIN IMPLEMENTAR

**La ultima decision abierta la cerro el owner el 2026-09-20, textual:** *«colapsa a un campo»*.
Con eso **`blocking` se borra** y la **0085** pasa a `cerrada` como spec CHICA.

| spec | que | estado |
|---|---|---|
| **0084** | tabla `core.business_onboarding_tour` + `POST /api/onboarding/tours/{tourId}` | `cerrada`, **va PRIMERO** |
| **0085** | el checklist de 1 a 5 items, borra `blocking`, corrige el contrato 0083 | `cerrada`, **depende de la 0084** |

**SE SERIALIZAN Y NO ES OPCIONAL:** la 0085 consume `ONBOARDING_TOURS` y la tabla que crea la
0084, y las dos tocan `api-owner-surfaces.test.ts`. **La 0084 tiene que estar `implementada` antes
de que arranque la 0085.**

### ⇥ SPEC 0084 — EN IMPLEMENTACION (2026-09-20). BITACORA DE MUTACIONES

**Trabajo EN EL ARBOL, SIN COMMITEAR.** Los dos archivos que se mutan son **`??` (untracked)**:
`git checkout` NO los recupera. El unico punto de retorno son las copias limpias de `/tmp` y
estos `shasum`:

| archivo | copia limpia (durante las mutaciones) | `shasum` durante las mutaciones | `shasum` FINAL |
|---|---|---|---|
| `apps/merchant/src/app/api/onboarding/tours/[tourId]/route.ts` | `/tmp/clean-route.ts` | `d501d6f68349656440a028c976c0112b7366fbc4` | **`fd6cd562c1299b39bc753ca00b0a7fb3dd8c364c`** |
| `apps/merchant/src/server/onboarding/tours.ts` | `/tmp/clean-tours.ts` | `bab333492b7589df576806887a874c19fda0396f` | `bab333492b7589df576806887a874c19fda0396f` (sin cambios) |

**⚠️ El `route.ts` cambio DESPUES de las cinco mutaciones**, por eso los dos `shasum` no
coinciden: su docblock citaba el nombre de la funcion exenta al gate de email y eso hacia que
el barrido del DoD contara **4** archivos donde hay **3** exenciones (ver «hallazgos»). Las
cinco mediciones se hicieron sobre `d501d6f6…`; el cambio posterior es **solo prosa del
docblock** y los gates se volvieron a correr enteros sobre `fd6cd562…`.

**Restauracion exacta (el estado BUENO es el final, no la copia limpia de las mutaciones):**

```
cp /tmp/final-route.ts "apps/merchant/src/app/api/onboarding/tours/[tourId]/route.ts"
cp /tmp/final-tours.ts apps/merchant/src/server/onboarding/tours.ts
shasum "apps/merchant/src/app/api/onboarding/tours/[tourId]/route.ts" apps/merchant/src/server/onboarding/tours.ts
# → fd6cd562c1299b39bc753ca00b0a7fb3dd8c364c  y  bab333492b7589df576806887a874c19fda0396f
rg -n MUTATION apps tools   # → vacio
```

**Alcance de cada medicion** (se corre contra TODOS los archivos que pueden ver la mutacion):
`src/server/onboarding-tours.neon.integration.test.ts`, `src/server/onboarding/tours.test.ts` y
`src/server/api-owner-surfaces.test.ts`, con la env de integracion cargada.

| id | archivo | invariante que ataca | resultado EJECUTADO |
|---|---|---|---|
| **M1** | `route.ts` | el gate de email SE APLICA en esta ruta (es lo contrario del checklist) | **ROJO 3, y el INTEGRANTE quedo VERDE.** `api-owner-surfaces.test.ts` → *«onboarding/tours/{tourId}: owner con `emailVerified: false` → 403 `email_not_verified`»* con `AssertionError: expected 503 to be 403`, y su gemelo fail-closed igual. Integracion → *«owner con el email SIN verificar → 403 `email_not_verified` y NO escribe»* con `AssertionError: expected 200 to be 403`. **`onboarding/tours/{tourId}: un INTEGRANTE … → 403 not_owner` PASO**, o sea que el rojo es de la propiedad y no del setup |
| **M2** | `onboarding/tours.ts` | `completed` NUNCA se degrada a `skipped` (ADR 0078 §2) | **ROJO 1.** Integracion → *«NO DEGRADA: `completed` y despues `skipped` deja la fila en `completed`»*: `AssertionError: expected [ { tour_id: 'program', …(1) } ] to deeply equal […]`, diff `- "status": "completed"` / `+ "status": "skipped"`. Los otros 152 en verde: **por HTTP el efecto es NULO** (el `200` sale igual), asi que este invariante solo lo ve la lectura por SQL |
| **M3** | `route.ts` | el `businessId` sale del GUARD, nunca del cuerpo (ADR 0070 §15.3) | **ROJO 1.** Integracion → *«el `businessId` sale del GUARD: uno en el cuerpo no mueve la fila de negocio»*: `AssertionError: expected [] to deeply equal [ { tour_id: 'staff', …(1) } ]` — el negocio del caller quedo **sin fila** porque la escritura se fue al negocio del cuerpo. El `200` sale igual: el status HTTP no distingue nada aca |
| **M4** | `route.ts` | el `tourId` se valida contra `ONBOARDING_TOURS` (fail-closed) | **ROJO 1, con LAS DOS MITADES.** Integracion → *«`404 unknown_tour` con un `tourId` inventado, por un owner autenticado»*: `AssertionError: expected { status: 200, code: undefined, …(1) } to deeply equal { status: 404, …(2) }`, diff `- code: "unknown_tour" / - filas: 0 / - status: 404` vs `+ code: undefined / + filas: 1 / + status: 200`. **La fila basura queda escrita.** ⚠️ La PRIMERA corrida de M4 solo mostro `expected 200 to be 404`: con tres `expect` separados vitest aborta en el primero y la mitad «no quedo fila basura» **nunca se evaluaba**. Se revirtio la mutacion, se junto el oraculo en UNA asercion, se verifico verde en limpio (19/19) y **se volvio a medir** — esta fila es la segunda corrida |
| **M5** | `route.ts` | `unknown_tour` se evalua DESPUES del guard (no se sondea sin sesion) | **ROJO 1.** Integracion → *«sin sesion y con un `tourId` inventado → 401 `unauthorized`, NUNCA 404»*: `AssertionError: expected 404 to be 401`. El caller **sin sesion** recibia el `404`, o sea el sondeo del catalogo de tours sin autenticarse. **El caso «sin sesion» de `api-owner-surfaces.test.ts` NO lo caza** —usa un `tourId` VALIDO y sigue dando 401—: el oraculo de esta propiedad es el par (sin sesion × id inventado), y por eso existe |

**Estado de las cinco: las 5 REVERTIDAS.** `diff` contra `/tmp` vacio en los dos archivos,
`shasum` de vuelta en `d501d6f6…` y `bab33349…`, y `rg -n MUTATION apps tools` → **vacio**.

#### Archivos del arbol (SIN COMMITEAR) y gates corridos

Creados: `drizzle/0040_progreso_de_tours_del_onboarding.sql`, `drizzle/meta/0040_snapshot.json`,
`src/server/schema/onboarding-tour.ts`, `src/server/onboarding/tours.ts`,
`src/app/api/onboarding/tours/[tourId]/route.ts`, `src/server/onboarding/tours.test.ts`,
`src/server/onboarding-tours.neon.integration.test.ts`,
`src/server/onboarding-tours-support.ts`, `docs/specs/0084-contratos-de-api.md`.
Editados: `drizzle/meta/_journal.json`, `src/server/schema.ts`,
`src/server/api-owner-surfaces-support.ts`, `src/server/api-owner-surfaces.test.ts`.

**`onboarding-tours-support.ts` no estaba en la tabla «Archivos» de la spec.** Salio del hook
`file-size`: el archivo de integracion con el montaje adentro medio **333** lineas y el limite
es 300. Se dividio —no se borro ninguna asercion—, misma forma y mismo motivo que
`onboarding-grant-support.ts`.

Gates de root con Node 24 (**una sola vez al final, y repetidos despues del arreglo del
docblock**): `typecheck` 3/3 ✅ · `lint` ✅ · `test` **1338 passed | 507 skipped, 0 failed** ·
`format:check` ✅ · `build` 3/3 ✅ (con `ƒ /api/onboarding/tours/[tourId]` en la salida).
**`test:e2e` NO aplica y se DECLARA:** `git status --porcelain | grep -c '\.tsx$'` → **`0`**.
Integracion con la env de la rama: **153 passed (3 archivos)**, y la migracion `0040`
**aplicada** a la rama (41 filas en `drizzle.__drizzle_migrations`, `when` `1789950938736`).

**La spec NO se marca implementada aca:** eso lo hace el orquestador con el PASS de un revisor
independiente (ADR 0071).

### LO QUE LA PROXIMA SESION TIENE QUE SABER PARA IMPLEMENTAR

1. **Empezar por la 0084**, con el protocolo del ADR 0071: **UN implementador para toda la spec,
   UN revisor independiente al final**. Los gates completos van **una vez por spec**, no una por
   agente. El encargo del revisor ya esta escrito en la seccion «Handoff» de cada spec, con su
   presupuesto de mutaciones y su clase de error.
2. **`api-owner-surfaces.test.ts` esta en 299 lineas y el hook corta en 300.** Las dos specs lo
   tocan. **Dividir, no extender** — y no borrar asercion para hacer lugar. El destino natural es
   `api-owner-surfaces-support.ts` (120 lineas), que existe para exactamente esto.
3. **LA TRAMPA DE LA 0085, medida y escrita en su seccion «Archivos»:** el doble de `./db` de esa
   bateria es una cadena FIJA que termina en `.limit()`. La consulta de tours no usa `.limit()`,
   asi que contra ese doble `await` devuelve un objeto en vez de un array, la ruta cae al `catch`
   y contesta **503** — y se lleva puestos TODOS los casos del checklist de la bateria. No es un
   bug del codigo nuevo: hay que extender el doble.
4. **Ninguna de las dos toca un `.tsx`.** `test:e2e` no aplica y se **declara** con
   `git status --porcelain | grep -c '\.tsx$'` → `0`.
5. **La libreria de tours (`driver.js`) NO se instala en ninguna de las dos.** Es dependencia de
   la UI, que construye el owner por fuera. Las specs guardan **estado**, no pasos.

### LO QUE LA 0085 YA TIENE DECIDIDO, para que no se vuelva a preguntar

- Los cuatro items de tour salen de `ONBOARDING_TOURS` (`server/onboarding/tours.ts`), que **crea
  la 0084**. Una sola fuente de verdad, no dos listas.
- El `done` de un tour es `completed || skipped`. **El JSON no dice cual de los dos fue:** el
  contrato de la UI sigue siendo `done: boolean` (ADR 0078 §2).
- El catalogo de items **SIGUE EN CODIGO**, no pasa a tabla (ADR 0078, consecuencias). Cierra la
  decision que el 0077 §4 habia diferido «hasta que exista el segundo item».
- **Hay que corregir `specs/0083-contratos-de-api.md` §5**, que hoy le anuncia
  `GET /api/onboarding/guide/{item}` a quien construya la UI. Ese endpoint **no existe y no va a
  existir** (ADR 0078 §4). Es trabajo de la 0085 y esta en su alcance.

### ✅ LIBRERIA DE TOURS — DECIDIDA: `driver.js` (owner, 2026-09-20)

**Textual:** *«perfecto hacemos el cambio a driver.js definitivamente mejor»*. Quedo en el **ADR
0078 §5** (enmendado), en el INDEX y en la skill `gotchas-del-repo`. **La spec 0084 NO cambia por
esto y es agnostica de la libreria**: guarda estado, no pasos.

La medicion que llevo a esa decision:


El owner pidio alternativas *«muy buenas en mobile y que funcionen con nuestro stack»*. Se midio
en worktree descartable (`probe-mobile`, ya borrado; repo principal con el `.modules.yaml` en el
mismo shasum `a29add45…`), **con build de produccion de Next 16 y Playwright emulando iPhone 13
(390×844, touch)**. La pantalla es la MISMA para las tres —header arriba y el CTA `position:
fixed` ABAJO—, que es el caso que rompe a los tours en movil.

**Las tres compilan en Next 16, las tres mantienen el tooltip DENTRO de la pantalla en el paso
del boton de abajo, y las tres con CERO errores de runtime y de consola.**

| | `@tour-kit/react@3.0.0` | `driver.js@1.8.0` | `react-joyride@3.2.0` |
|---|---|---|---|
| Licencia | MIT en el tarball / `BUSL-1.1` en el `package.json`; **pago para produccion** | **MIT**, sin pago | **MIT**, sin pago |
| `peerDependencies` | `next: ^13 \|\| ^14 \|\| ^15` → **miente contra nuestro 16** | **NINGUNO** | solo `react`/`react-dom` (`16.8 - 19`) |
| Dependencias | 6 | **0** | 10 |
| Acopla a `next`? | **Si** (de ahi el bug del `require` dinamico) | **No** | **No** |
| Spotlight sobre el CTA fijo | **DEFECTUOSO con config default**: el boton queda OSCURECIDO, el recorte cae corrido | **El mejor**: recorte limpio, boton entero iluminado | correcto |
| Estetica por default | buena (progreso `2 / 2`, Back/Finish) | buena y sobria (`2 of 2`, Previous/Done) | **la peor** (texto centrado, boton negro con halo naranja) |
| Trampas propias | el `useNextAppRouter()` del gotcha | vanilla: sin bindings de React, sin multi-ruta | **v3 cambio la API**: export **nombrado** (`import { Joyride }`), y es `skipBeacon`, NO `disableBeacon`; sin eso **solo pinta un punto y ningun tooltip**. Casi todos los tutoriales de la web estan vencidos |

**CAVEAT DECLARADO, no perseguido:** el spotlight corrido de `tour-kit` se vio **con la config por
default** (`TourKitProvider` sin opciones). Su README menciona un `spotlight` config que se adjunta
en runtime, asi que **puede ser una perilla que no puse y no un defecto**. No se investigo.

**Y lo que hay que decir con todas las letras: el bug del build NO es motivo para cambiar de
libreria.** Se arregla con una linea (`createNextAppRouterAdapter`) y ya esta probado end-to-end.
Lo que si cambia el calculo es que **`driver.js` no tiene NI UN peer**, asi que la clase entera de
problema —«la libreria se acopla a una version de Next que no es la nuestra»— **no puede volver a
pasar**. Es la unica diferencia estructural entre las tres.

**Recomendacion del ORQUESTADOR, NO decision del owner:** `driver.js`. Gratis, sin ambiguedad de
licencia, cero acople, el mejor spotlight en el caso que importa. Lo que se resigna: bindings de
React y multi-ruta — **ninguno de los dos hace falta**, porque nuestros cuatro tours son de UNA
pantalla cada uno y el estado ya lo guarda nuestra API (spec 0084), no la libreria.

### `required` Y `blocking` — EL OWNER PREGUNTO POR QUE HAY DOS, Y LA RESPUESTA ES QUE NO HAY

**Textual del owner (2026-09-20):** *«Required es importante porque sin eso no se puede hacer nada
mas, ejemplo verficar email. de echo ser ala unica. Blocking no se porque tenemos blockint»*.

**La definicion que el owner da de `required` —«sin eso no se puede hacer nada mas»— ES la
definicion de `blocking` del ADR 0077 §2.** O sea que en su cabeza es UN eje, no dos.

**Y con los cinco items reales a la vista, nunca divergen:** `verify-email` es `true`/`true`, los
cuatro tours son `false`/`false`. La separacion del 0077 §2 fue **especulativa** («un item puede
ser obligatorio sin frenar al resto») y **no tiene ni una instancia real**.

**Lo que existe HOY solo para sostener esa distincion, medido:** `blocking` aparece en 7 lugares de
`onboarding/checklist.ts`, y `checklist.test.ts` tiene un bloque de oraculo entero —con entradas
**sinteticas** y sus dos espejos— cuyo unico proposito es probar que `blocking` no es alias de
`required`. El segundo parametro de `toChecklistView` existe en parte para poder alimentar esas
entradas. **Es andamiaje sin su tarea**, que es justo lo que `CLAUDE.md` prohibe.

**Recomendacion del ORQUESTADOR, NO decision del owner: colapsar a UN campo.** Se queda `required`
con la semantica que el owner le dio («mientras no este `done`, los de `position` mayor estan
bloqueados») y **se borra `blocking`** del tipo, del catalogo, del JSON y del contrato.

**Por que AHORA y no despues:** `GET /api/onboarding/checklist` ya esta implementado y pusheado,
pero **ninguna UI lo consume todavia** — no existe pantalla de onboarding en el backoffice. El
costo de sacar el campo es **cero hoy** y sube el dia que exista la primera UI que lo lea.

**Si el owner acepta, entra al alcance de la 0085** (que ya iba a tocar esos mismos archivos) y
**la 0085 puede seguir siendo `TEMPLATE-CHICA`**: sigue siendo un dominio y sin migracion.

### LOS DOS `mistake→rule` NUEVOS DE ESTA SESION (`b598698`)

1. **`useNextAppRouter()` de `@tour-kit/react` ROMPE EL BUILD** bajo Turbopack/Next 16 y hay que
   usar `createNextAppRouterAdapter`. **El `typecheck` no distingue las dos** y el Stop hook no
   corre `build`: el error solo aparece en CI o en Vercel. → skill `gotchas-del-repo`.
2. **Un barrido `rg` de una DoD escrito con sintaxis de `grep` (`'a\|b'`) PASA VACUO.** Cazado
   escribiendo la DoD de la 0084 y probado contra un archivo que tiene las dos formas. El modo de
   falla no es que el comando falle: es que **pasa**. → skill `protocolo-de-verificacion` +
   `LECCIONES.md`.

## ⇥ ✅ SPEC 0083 — IMPLEMENTADA CON PASS, COMMITEADA EN `618af56`

**Estado EXACTO al escribir esto:** el trabajo esta commiteado en `618af56` —codigo, spec en
`implementada` y fila del INDEX, todo junto—. **NO esta pusheado:** se le pregunto al owner y
no contesto.

### El PASS

**Revisor independiente en contexto fresco, 6 mutaciones, las 6 ROJAS y por la propiedad
atacada.** Las dos que sostienen la spec:

- **M1** (poner el paso 3 en la ruta) → `un owner SIN el email verificado recibe 200…` da
  *«expected 403 to be 200»*, y **el caso del integrante queda VERDE**. O sea que el rojo es de
  la propiedad, no del setup.
- **M6** (sacar `"onboarding/checklist"` de `NOMBRES_SIN_GATE_DE_EMAIL` dejando la fila en
  `SURFACES`) → la ruta cae a `SURFACES_CON_GATE_DE_EMAIL`, que le exige 403 y recibe 200.
  **El «3» del inventario no es un numero escrito a mano: gobierna.**

**El revisor hizo ademas algo que NO estaba en el encargo y hay que conservar como practica:
probo que el hook `no-mutations-left.sh` MUERDE**, con un archivo sonda etiquetado que le
saco **EXIT 2**, y despues lo borro. Un `EXIT 0` sobre arbol limpio puede significar «paso» o
«nunca miro nada», y desde afuera son indistinguibles.

### DOS HALLAZGOS DEL REVISOR, reproducidos por el orquestador y YA CORREGIDOS

1. **Un docblock FALSO** —la clase de defecto que este repo trata como activa, no cosmetica—:
   `onboarding/checklist.ts` decia *«el §D4 de la spec dice "cero consultas extra": ya no es
   cierto»*, pero **§D4 ya estaba corregido y dice exactamente eso**; ademas citaba **§D5** (el
   inventario) para un costo que vive en **§D4**. Mandaba al lector a una seccion que afirma lo
   contrario de lo que el docblock afirmaba. Corregido en `checklist.ts` y en
   `checklist-facts.ts`.
2. **Prosa vencida en este mismo archivo:** el bloque viejo pedia arreglar el §D1 por la
   renumeracion M6 → M5, **que ya estaba arreglado**. Se fue al reescribir este bloque.

### Gates sobre el arbol FINAL (con los docblocks ya corregidos)

**LOS SEIS, corridos por el ORQUESTADOR sobre el arbol commiteado, en Node 24:** `typecheck`,
`lint`, `format:check`, `build` → **EXIT=0**; `test` con `.env.integration.local` → **1793 de
1793, 0 failed y CERO SKIPPEADOS**; **`test:e2e` no aplica y se declara** con
`git status --porcelain | grep -c '\.tsx$'` → **0**.

**Se re-corrieron a proposito:** los del revisor son de ANTES de que el orquestador corrigiera
los dos docblocks falsos, asi que no describian este arbol. Y la corrida de aca es **mas fuerte
que la suya**: la del revisor tuvo **488 tests skippeados** (los `.neon`, sin entorno de
integracion cargado); esta corrio los 1793.

### Lo que el orquestador reprodujo por su cuenta (no es auto-reporte de nadie)

- `rg -l 'SinGateDeEmail' apps/merchant/src/app` → **3 rutas**, las del inventario.
- El diff de `api-owner.ts` es **solo docblock**: ni una linea dentro de `requireApiOwner` ni de
  su hermana. Es el invariante de la 0075 y esta spec no lo afloja.
- Hook `no-mutations-left.sh` → **EXIT=0**; `git status --porcelain | grep -c '\.tsx$'` → **0**,
  con lo que `test:e2e` queda declarado como no-aplica.

### DECLARADO Y NO PERSEGUIDO (lo acoto el revisor antes de declararlo)

- **El camino `503 onboarding_unavailable` no tiene oraculo en ningun archivo.** No estaba en la
  tabla de las 6 ni en el DoD. Riesgo bajo y acotado: es un `catch` de ultima linea, su `code`
  esta en el contrato y **no filtra nada** (el `console.error` emite solo `error.name`).
  Cerrarlo cuesta **un test que doble `ownerContext` para que tire**. **Pendiente de decision
  del owner**, a quien se le ofrecio.
- **El `sort` por `position` quedo sin mutacion ejecutada, no sin oraculo:** el test declara las
  entradas **3-1-2** y asevera `["primero","segundo","tercero"]`, o sea que distingue de verdad.

### HALLAZGO ABIERTO, medido, que NO decidio el owner

**`api-owner-surfaces.test.ts` quedo en 299 lineas y el hook `file-size` corta en 300.** Entro
por UNA linea, y para entrar hubo que compactar dos docblocks. **La proxima superficie que se
sume al inventario no entra**, y ahi aplica la regla de `CLAUDE.md`: *dividir, no extender*. No
se divide en esta spec porque seria refactor de un archivo ajeno sin su tarea.

### LO QUE SIGUE

1. **PUSH — falta la autorizacion del owner.** Se le pregunto dos veces y no contesto. Nada de
   esto esta en `origin/main`.
2. **Decision del owner sobre el 503 sin oraculo** (arriba): se cierra con un test o se deja
   declarado. Se le ofrecio.
3. **El arco sigue por el ITEM 2 del onboarding.** El owner dijo que el orden depende de que
   feature exista antes: catalogo necesita la feature de IA (que **no tiene nada en el repo**:
   cero dependencias de IA, catalogo de a un producto por request), y **staff no necesita API
   —ya existe entera— sino PANTALLA**. Por eso staff es el candidato barato.
4. **Cuando llegue el PRIMER tutorial de verdad**, se diseña el segundo recurso
   (`GET /api/onboarding/guide/{item}`), que el ADR 0077 §5 dejo deliberadamente sin diseñar.


## ⇥ ✅ BITACORA DE MUTACIONES — spec 0083 **ENMIENDA** (implementador, 2026-09-20) — CERRADA, 6/6

**Reemplaza a la bitacora de la primera entrega**: la tabla de mutaciones de la spec se rehizo
con la enmienda (las viejas M2 y M5 atacaban pasos que ya no viven en la ruta). Presupuesto: 6.
Clase de error a cazar: **que el guard deje pasar a quien no debe o bloquee a quien la ruta
existe para servir, y que `done` no sea vacuo**.

**Copias limpias en `/tmp/limpios-0083b/`.** Tres de los archivos estan `??` (sin blob: `git
checkout` NO los restaura) y tres estan ` M` (un `git checkout` ahi se llevaria tambien el
trabajo sin commitear). Restauracion:

```
cp /tmp/limpios-0083b/route.ts                     apps/merchant/src/app/api/onboarding/checklist/route.ts
cp /tmp/limpios-0083b/checklist.ts                 apps/merchant/src/server/onboarding/checklist.ts
cp /tmp/limpios-0083b/checklist-facts.ts           apps/merchant/src/server/onboarding/checklist-facts.ts
cp /tmp/limpios-0083b/api-owner-surfaces-support.ts apps/merchant/src/server/api-owner-surfaces-support.ts
```

| Archivo | `git status` | `shasum` LIMPIO |
|---|---|---|
| `app/api/onboarding/checklist/route.ts` | `??` | `4a9348340d9fca57be4e54268578ead30aa32317` |
| `server/onboarding/checklist.ts` | `??` | `b016e114c327e55e1611f71886ffb81ff31d6259` |
| `server/onboarding/checklist-facts.ts` | `??` | `0ca0a9188a530740bf62b64400ded23afa35c378` |
| `server/api-owner-surfaces-support.ts` | ` M` | `7a512296af55d8c1b6aa707cb7b645f7c616d3ea` |
| `server/api-owner-surfaces.test.ts` | ` M` | `af7efef8af6906430798b1459e1203f8e8868153` |
| `server/api-owner.ts` | ` M` | `eae3167b2c5d49ac06bfb9cf49cb048b5e81dbaf` |

| id | archivo | invariante que ataca | alcance corrido | RESULTADO EJECUTADO |
|---|---|---|---|---|
| **M1** | `route.ts` (`requireApiOwnerSinGateDeEmail` → `requireApiOwner`) | la ruta NO lleva el paso 3 — **el invariante central** | `.neon.integration` + `api-owner-surfaces.test.ts` | **ROJO 7 de 109.** El caso del OWNER: `un owner SIN el email verificado recibe 200 con su item pendiente` → *«expected 403 to be 200»*; y en la bateria `onboarding/checklist: owner con emailVerified: false … → pasa, NUNCA email_not_verified` → *«expected 403 to be 200»* (+ el fail-closed sin la clave). Los de `suspended`/`closed` muestran el `code`: *«expected 'email_not_verified' to be 'business_suspended'»* y *«… to be 'business_closed'»*. **El caso del INTEGRANTE quedo VERDE** (`un integrante (role='staff') → 403 not_owner` ✓), que es la desambiguacion que pide la spec: el rojo es del owner. Tambien verde `un owner CON el email verificado…` |
| **M2** | `route.ts` (sacar el guard entero, sesion a mano) | los pasos 2 y 4 no se pierden «total, es una lectura» | `.neon.integration` + `api-owner-surfaces.test.ts` | **ROJO 7 de 109, los siete con *«expected 200 to be 403»***, y el primero es el del INTEGRANTE en los dos archivos: `un integrante (role='staff') → 403 not_owner, y NO el codigo del email` y `onboarding/checklist: un INTEGRANTE … → 403 not_owner`. Ademas `suspended`, `closed` y `un status desconocido no opera`. El caso del owner sin verificar quedo VERDE (200 es su desenlace correcto) |
| **M3** | `checklist.ts` (`done: () => true`) | `done` LEE el hecho, no es constante | unit + `.neon.integration` + bateria | **ROJO 5 de 119.** Unit: `done sigue al hecho de la sesion en las dos polaridades` → *«expected true to be false»*. Integracion: `un owner SIN el email verificado…` → *«expected { id: 'verify-email', …(7) } to match object …»* y el control de `active` → *«expected true to be false»*. **Y los dos casos nuevos de la bateria** (`DESENLACE_SIN_GATE` exige `done: false`) |
| **M4** | `checklist.ts` (`done: () => false`) | idem, polaridad opuesta | unit + `.neon.integration` + bateria | **ROJO 2 de 119.** Integracion: `un owner CON el email verificado recibe 200 y el mismo item en done: true` → *«expected { …(7) } to match object { …(4) }»*. Unit: la misma polaridad → *«expected false to be true»*. **Con la M3 prueban que `done` no devuelve una constante** |
| **M5** | `checklist.ts` (`blocking: def.required`) | `blocking` NO es alias de `required` | unit + `.neon.integration` + bateria | **ROJO 3 de 119, los tres en el unit y con entradas SINTETICAS**: `{required:true,blocking:false}` → *«expected true to be false»*; el espejo → *«expected false to be true»*; los dos items cruzados → *«expected [['a',true,true],…] to deeply equal [['a',true,false],…]»*. **El `.neon.integration` y la bateria quedaron VERDES**: es el limite declarado en la spec — con un item real los dos ejes valen `true` |
| **M6** | `api-owner-surfaces-support.ts` (sacar `"onboarding/checklist"` de `NOMBRES_SIN_GATE_DE_EMAIL` **dejando la fila en `SURFACES`**) | **el inventario GOBIERNA**: no es un numero escrito a mano | `api-owner-surfaces.test.ts` | **ROJO 4 de 101, y MUERDE por donde la spec dijo:** la ruta cae a `SURFACES_CON_GATE_DE_EMAIL` y esa tabla le exige el 403 → `onboarding/checklist: owner con emailVerified: false → 403 email_not_verified` → *«expected 200 to be 403»*, mas el fail-closed `owner SIN la clave emailVerified → 403 igual` con el mismo mensaje. Y los dos pisos: la lista exacta → *«expected ['loyalty-program (PUT)', …(1)] to deeply equal ['loyalty-program (PUT)', …(2)]»* y el conteo → *«expected 12 to be 11»* |

**Reversion verificada de a una:** `diff` contra `/tmp/limpios-0083b/` **vacio (exit 0)** en los
tres archivos mutados, `shasum` de los seis archivos igual al limpio de la tabla de arriba, y
`rg -n MUTATION apps tools` → **vacio (exit 1)**.

**Rojo COLATERAL que NO se arreglo, a proposito:** bajo la M2 el import de
`requireApiOwnerSinGateDeEmail` queda sin uso y `lint` habria dado rojo que no mide nada.
No se corrio ni se toco: arreglarlo habria tapado la medicion. Los gates van **una sola vez al
final**, con el arbol ya limpio.


## ⇥ ✅ SHELL DEL BACKOFFICE — COMMITEADO EN `b50fb4d`, SEIS GATES VERDES, FALTA EL QA VISUAL

**Que hay en el arbol:** `/backoffice/*` ahora tiene layout propio
(`app/backoffice/layout.tsx`) y navegacion adaptativa
(`app/backoffice/backoffice-navigation.tsx`, Client Component porque necesita el segmento
activo): sidebar en escritorio, barra inferior con bottom sheets en movil, y acceso
persistente al mostrador. El Inicio (`app/backoffice/page.tsx`) deja de ser la grilla de 8
tarjetas iguales. Los estilos van en `globals.css` a partir de `Backoffice shell — mobile
first`, sobre los tokens del wizard. Plan y criterios en `docs/backoffice-ui-plan.md`; el
detalle y las decisiones a no revertir, en `docs/backoffice-ui-handoff.md`.

**ESTO NO TIENE SPEC.** Entro como trabajo de UI directo, no por el circuito
`spec cerrada → implementador → revisor` del ADR 0071, y no hay PASS de revisor
independiente ni bitacora de mutaciones. Se commitea tal cual para no perderlo; lo que
sigue abajo es lo que el orquestador SI verifico por su cuenta antes de pushear.

**LOS SEIS GATES, corridos sobre el arbol final en Node 24 (v24.20.0):** `typecheck`,
`lint`, `format:check`, `build` → **EXIT=0**; `test` con `.env.integration.local` → **227
archivos / 1768 tests, 0 failed**; **`test:e2e` → EXIT=0, 3 pasados / 1 skipped**.

**PERO EL `test:e2e` NO EJERCITA NADA DE ESTA UI, y se declara:** `tests/e2e/` tiene dos
archivos — `health.spec.ts` (los 3 contratos `/api/health`) y `loyalty-real.spec.ts`, que se
**saltea** sin `E2E_MERCHANT_BASE_URL`/`E2E_MERCHANT_EMAIL`/`E2E_MERCHANT_PASSWORD`/
`E2E_LOYALTY_MUTATION_TEST=true`. Su verde prueba que las 3 apps levantan y compilan, **no
que la navegacion se vea ni funcione**.

**Lo que el orquestador si reprodujo:**

- **Ningun enlace muerto.** Los 8 `href` de la navegacion y del Inicio cruzados contra los
  `page.tsx` reales bajo `app/backoffice/`: los 8 resuelven. Staff va **sin `href`** y
  marcado «Proximamente» — su pantalla no existe en el repo y no se invento una ruta.
- **El layout no le rompe el mostrador al staff.** `requireBackofficeSession`
  (`auth-guards.ts:93`) **admite rol staff** (solo corta `memberships.status !== 'active'` y
  `businessStatus === 'closed'`), asi que envolver `/backoffice/counter` con el layout no lo
  deja afuera. El staff ve navegacion reducida a mostrador + cierre de sesion.
- **Cero mutaciones abandonadas:** `grep -rn MUTATION` sobre `apps/` y `packages/` → 0.

**Dos correcciones sobre lo que decia el handoff heredado, medidas:** afirmaba que
`next build` **no puede completarse en el sandbox** (PostCSS y un puerto) y que el entorno
corria Node 22.22.2. Con `nvm use` (Node 24) **el build da EXIT=0, 3 tareas exitosas**. La
imposibilidad era del entorno mal preparado, no del repo.

**Trampa que aparecio y quedo resuelta:** el `next dev` que levanta `test:e2e` **reescribe
los tres `next-env.d.ts`** de `./.next/types/` a `./.next/dev/types/`. Es artefacto de dev y
**no se commitea** — se revirtio con `git checkout --`. Si aparece modificado despues de un
e2e, es esto.

**LO QUE FALTA, y es la unica razon por la que esto no esta cerrado: el QA visual, que nadie
hizo.** Correr la app con Node 24 y una sesion owner real, y mirar en 320, 390, 768, 1024 y
1440 px. **El punto mas riesgoso es el mostrador en un movil real**: la barra inferior
persistente convive ahi con la camara/escaner, y nadie lo vio en pantalla.

## ⇥ ✅ SPEC 0082 — IMPLEMENTADA CON PASS, COMMITEADA EN `5ac30f9`

**El owner con el email sin verificar ENTRA al backoffice.** Era un incumplimiento de ADR 0070
§11, no una decision abierta: ahi estan sus palabras textuales —*«Entra a su cuenta directamente
al terminar el wizard y ve el onboarding»*— y el primer paso del onboarding **es** verificar el
email, que no se puede ver desde afuera. Lo reprodujo el owner en prod el 2026-09-19: «Ir a mi
panel» aterrizaba en `https://www.checkpass.club/?e=email_not_verified`.

**Por que entro inadvertido:** la spec 0067, que lo implemento, declara en su propio alcance que
el backoffice era inalcanzable a proposito y **«el QA de pantalla de esta spec no se puede
hacer»**. Hizo falta la UI del owner para que el defecto fuera visible. **Leccion aplicable:** un
guard entregado sin QA de pantalla posible se paga cuando la pantalla llega.

**Lo que entrego:** el rebote sale de `requireBackofficeSession` (con su constante, ya sin uso) y
`BackofficeSession` expone `emailVerified`. A cambio, el **mostrador** —que no tenia gate de email
en ninguna linea— pasa a exigirlo **solo al `role='owner'`**; el staff no tiene email por diseño
(`@staff.invalid`) y un gate que lo alcanzara lo dejaria muerto para siempre.
`operatorBusiness` devuelve el `role` **al lado** del negocio, no adentro, para no meterle la
membresia a los cuatro escritores del dominio (ADR 0055: no mezclar ejes).

**La premisa, medida y reproducida por el orquestador:** sacar el rebote **no abre una sola
escritura**. Las 11 superficies owner-only ya devuelven 403 `email_not_verified`
(`api-owner-surfaces.test.ts`, **verde y sin editar**), y `rg -l '"use server"' apps/merchant/src`
→ **cero server actions en todo el paquete**.

**PASS de revisor independiente** (ADR 0071), **5 mutaciones, las 5 rojas por la propiedad
atacada**. La que mas importa es la M1: borrar la condicion `role === 'owner'` puso rojo tambien a
`business-status.neon.integration.test.ts`, que el DoD exige verde **sin editar** — o sea que su
verde no era vacuo.

**Los SEIS gates, corridos por el orquestador sobre el arbol final** (Node 24): `typecheck`,
`lint`, `format:check`, `build` → **EXIT=0**; `test` con `.env.integration.local` → **227
archivos / 1768 tests, 0 failed**. **`test:e2e` no aplica y se declara**:
`git status --porcelain | grep -c '\.tsx$'` → **0**.

**Un defecto corregido en la SPEC, no en el codigo:** decia «`counter/resolve` (GET)» y **las
cuatro rutas son `POST`** (verificado con `grep -o 'export async function [A-Z]*'`). El contrato
publicado no afirma metodo, asi que no hubo contradiccion hacia afuera — pero la spec afirmaba mal
y se arreglo antes de commitear.

**Limitacion conocida, de severidad BAJA, que el revisor midio y NO se arreglo:** el barrido que
prueba que las 4 rutas del mostrador pasan por `requireOperator` **hardcodea los 4 nombres**
(`counter-email-gate.test.ts`), asi que una QUINTA ruta futura en `app/api/counter/` que resuelva
la sesion por su cuenta quedaria fuera del gate **sin poner rojo a nadie**. Fila en
`docs/PARQUEADO.md` con su arreglo.

### Bitacora de mutaciones — implementador (4) + revisor (5), todas revertidas

**Arbol limpio:** `rg -n MUTATION apps tools` → vacio, `no-mutations-left.sh` → EXIT=0, y los
archivos mutados con `diff` vacio y `shasum` identico al limpio. Las 4 del implementador:

| # | Archivo | shasum limpio | Invariante que ataca | Alcance de la corrida | Resultado EJECUTADO |
|---|---|---|---|---|---|
| M1 | `apps/merchant/src/app/api/counter/_auth.ts` | `dc0aadab57e260e063f6c550a3a0327d536a36a9` | el gate del mostrador **no puede alcanzar al staff** (`@staff.invalid`): sin esto el mostrador queda muerto para siempre | suite merchant completa con env de integracion | **ROJO — 4 tests en 2 archivos** (1752 passed). `counter-email-gate`: «staff con `emailVerified: false` PASA» y «staff SIN la clave» → `expected { blocked: true, status: 403 } to deeply equal { blocked: false }`. Y ADEMAS `business-status.neon.integration` (el que el DoD exige verde sin editar): `expected 'email_not_verified' to be 'business_suspended'` y `… to be 'business_closed'`. **Revertida**: `diff` vacio, shasum identico |
| M2 | `apps/merchant/src/app/api/counter/_auth.ts` | `dc0aadab57e260e063f6c550a3a0327d536a36a9` | fail-closed en el dato: `!== true` y no `=== false`, para que un owner SIN la clave `emailVerified` no abra el mostrador | idem | **ROJO — 1 test, 1 archivo** (1755 passed). `counter-email-gate` > «owner SIN la clave `emailVerified` → 403 igual (fail-closed)»: `expected { blocked: false } to deeply equal { blocked: true, status: 403, …(1) }`. El caso con `false` explicito queda VERDE, que es exactamente lo que distingue esta mutacion de la M3. **Revertida**: `diff` vacio, shasum identico |
| M3 | `apps/merchant/src/app/api/counter/_auth.ts` | `dc0aadab57e260e063f6c550a3a0327d536a36a9` | que el gate de email del mostrador EXISTA: owner con `emailVerified:false` → 403 `email_not_verified` | idem | **ROJO — 3 tests, 1 archivo** (1753 passed). `counter-email-gate`: «owner con `emailVerified: false` → 403» y «owner SIN la clave» → `expected { blocked: false } to deeply equal { blocked: true, status: 403, …}`; y el caso del ORDEN cae con el diff leido entero: `- "code": "email_not_verified"` / `+ "code": "business_suspended"`. El `role` quedo sin uso bajo la mutacion (colateral declarado, NO se arreglo). **Revertida**: `diff` vacio, shasum identico |
| M4 | `apps/merchant/src/server/auth-guards.ts` | `cfff3bd648d9164652a9be428b4c70d18938b1ad` | el oraculo invertido MUERDE: re-poner el rebote de la puerta tiene que poner rojo «owner sin verificar ENTRA» | idem | **ROJO — 2 tests, 1 archivo** (1754 passed). `auth-guards.test.ts`: «owner con email SIN verificar ENTRA…» y «owner sin el campo `emailVerified` tambien entra…», las dos con `Error: redirect:/?e=email_not_verified` lanzado desde `Module.requireBackofficeSession src/server/auth-guards.ts:146` — la LINEA MUTADA, o sea rojo por la propiedad y no por el setup. **Revertida**: `diff` vacio, shasum identico |

## ⇥ UI DEL ARCO 0076 — IMPLEMENTADA, GATES VERDES, PENDIENTE DE QA VISUAL

**Alcance decidido por el owner e implementado:** el paso 3 permite elegir Sellos o Puntos;
Puntos fija `Punto`/`Puntos` y pide puntos otorgados, monto de compra y costo del premio; Sellos
conserva el cuerpo corto y «un sello por compra». No se construyo panel de TOS ni monto por sello.
El `403 email_not_verified` usa la pantalla especifica ya existente. Se borro
`/backoffice/demo/*`, sus referencias y el tile de Analiticas, que no tenia pantalla real.

**Verificacion ejecutada, los SEIS gates, con Node 24 y fuera del sandbox anterior (2026-09-19):**
`typecheck` (3/3) · `lint` (`eslint .` exit 0) · `format:check` («All matched files use Prettier
code style!») · `build` (3/3, **completo esta vez**: el bloqueo de Turbopack de la corrida
anterior no se repitio) · `test` con el env de integracion → **226 archivos / 1759 tests, 0
failed** · `pnpm test:e2e` → **3 passed, 1 skipped** (el skip es `loyalty-real.spec.ts`, gateado
por env vars que no aplican aca).

**Dos hallazgos cerrados en esta pasada, no en la anterior:**

1. **`test:e2e` en rojo por el borrado de `/backoffice/demo/*`:** `tests/e2e/analytics.spec.ts` y
   `tests/e2e/loyalty.spec.ts` navegaban a esa ruta, que ya no existe ni tiene fallback (el
   `apps/merchant/src/app/backoffice/page.tsx` de esta misma entrega saco el `?? /backoffice/demo/${slug}`).
   Es la limpieza de referencias que el borrado de una pantalla exige (regla de este archivo,
   seccion Codigo) — no un test editado para pasar el gate: la pantalla que probaban ya no existe.
   Se borraron los dos specs y `tests/e2e/support/demo.ts` (su unico consumidor). De paso resuelve
   el rojo AJENO de `loyalty.spec.ts:16` que quedaba anotado como baseline mas abajo.
2. **`onboarding-wizard.tsx` en 713 lineas** (mas del doble del limite de 300 del hook
   `file-size`), pese a que ya se habian extraido `program-impact.tsx` y `program-step.tsx`. Se
   dividio en `account-step.tsx` (107), `business-step.tsx` (151), `complete-step.tsx` (220) y
   `wizard-shared.tsx` (64, lo compartido: `StepHeader`, `InlineApiError`, `gateCode`), dejando el
   orquestador en 201. Refactor mecanico, sin cambio de logica; typecheck/lint/tests confirman que
   no rompio nada.

**Navegacion final:** el boton «Ir a mi panel» del cierre del wizard apunta a `/backoffice`.
La ruta conserva su proteccion server-side con `requireOwner`: no alcanza con conocer la URL;
exige sesion merchant, membresia activa y rol owner.

**Proximo paso:** ejecutar el QA visual ya escrito en `docs/QA-arco-0076.md`, incluyendo ambos
caminos del paso 3 y la llegada al panel. **No hay revisor independiente todavia** (ADR 0071): esto
se pushea para habilitar el QA visual en el deploy, no porque el protocolo de revision se haya
corrido. `.claude/skills/gotchas-del-repo/SKILL.md` ya estaba modificado por el usuario y no forma
parte de esta entrega.

**Ultima actualizacion: 2026-09-20 — HANDOFF DE CIERRE.** El arco **0077–0081** esta
**completo, desplegado y migrado**. **Decision del owner: los arreglos de UI van ANTES del QA.**
Lo que sigue esta en **`docs/ui-delta-arco-0076.md`**; el checklist de QA ya escrito espera en
**`docs/QA-arco-0076.md`**.

**ESTADO REAL, en una pantalla — todo lo de abajo lo REPRODUJO el orquestador:**

| Que | Donde esta |
|---|---|
| HEAD | **`df2f739`** + el commit de este handoff. **2 commits sin pushear** al escribir esto (los docs de QA y del delta de UI) |
| Codigo en produccion | **`a7a35f9`**, deploy `READY`. **Prod sirve el codigo nuevo**: `/api/merchant/session` → **200** (antes 404) |
| Specs `implementadas` | 0067, 0068, 0069, 0072, 0074, 0075, **0077**, **0078**, **0079**, **0080**, **0081** — las 9 ultimas con PASS de revisor independiente |
| Ultima suite completa | **226 archivos / 1757 tests con Neon, 0 failed, 0 skipped** sobre `02aa985`. **Desde ahi solo cambiaron 9 archivos `.md`** (verificado con `git diff --name-only`): cero codigo, la medicion sigue valida |
| Gates | `typecheck --force`, `lint`, `build`, `format:check` — **los cuatro EXIT=0** |
| **DB de prod** | proyecto Neon **`red-violet-38772073`**, rama `main` (`br-curly-silence-ax8acywm`). **40 migraciones** aplicadas |
| Datos reales en prod | **1 negocio** (`LaCraft Beer Garden`, EC, USD) y **1 programa activo** de Sellos. **El dato viejo de «0 negocios» era FALSO** |
| ⚠️ CI de `main` | **ROJO y AJENO**: `loyalty.spec.ts:16`, `1 failed / 1 skipped / 4 passed`, contadores identicos al baseline en worktree limpio |
| ⚠️ **PENDIENTE DEL OWNER** | **rotar la password de `neondb_owner`** (quedo en el transcript del despliegue) y actualizar `DATABASE_URL`/`DATABASE_URL_UNPOOLED` en Vercel |

## ⇥ (historico) ENTREGA DEL IMPLEMENTADOR — spec 0081 (2026-09-19)

> **SUPERADO: esto es el registro de la entrega, no el estado.** La 0081 despues obtuvo su PASS,
> quedo marcada `implementada` y se commiteo en `02aa985`; el arco esta desplegado en `a7a35f9`.
> El bloque de arriba es el estado real. Se conserva por su evidencia.

**Estado al momento de la entrega: implementado, a la espera del PASS del revisor independiente**
(ADR 0071). **Arbol LIMPIO de mutaciones**: `rg -n MUTATION apps tools` → vacio,
`.claude/hooks/no-mutations-left.sh` **EXIT=0**, y los 4 archivos mutados con `diff` vacio y
`shasum` identico al limpio.

**CERO `.tsx` tocados.** El entregable para la UI es `docs/specs/0081-contratos-de-api.md`.

**La migracion `0039_tos_variables_del_negocio.sql` YA ESTA APLICADA a la rama de integracion**
(no a prod), por `db:migrate`. Verificado por SQL: 8 filas `published` en `default`+`EC` y las 3
de `global-draft` en `archived` con `published_at` nulo.

### ⚠️ EL NUMERO DEL DoD: PROGRAMAS QUE REFERENCIAN `global-draft` = **0**, y es ESTRUCTURAL

**No es «hoy da 0»: no existe la referencia.** Medido por `information_schema` contra la base de
integracion: **no hay ninguna tabla ni columna en toda la base que guarde el `template_id` de un
programa**. `core.loyalty_program` tiene `terms_markdown`, `terms_hash` y `terms_updated_at`, y la
unica columna con «template» en el nombre fuera de `terms_template.template_markdown` es de
`pg_catalog`. Las clausulas **viajan en el cuerpo de cada escritura**, no se persisten como ids.

**Consecuencia: el riesgo que la spec §3 declara —«un `PUT` sobre un programa viejo que
referencie un `templateId` de `global-draft` pasaria a dar 422»— es FALSO.** Un re-guardado con
cuerpo corto vuelve a resolver las semillas del pais; el unico que puede mandar el id viejo es un
cliente que lo tenga cacheado, y la pantalla lo pide a `GET /api/loyalty-terms/templates`, que ya
no lo ofrece. **No hay bloqueo.** (Base de integracion al momento de medir: 167 programas, 186
negocios, 224 locales — 206 `active`.)

### ⚠️ LOS CUATRO HALLAZGOS DE LA SPEC, medidos (el revisor tiene que mirarlos)

1. **LA MUTACION M1 DE LA SPEC NO LA VE EL ORACULO QUE LA SPEC LE ASIGNA — MEDIDO.** La spec
   predice que emitir las variables de local con la lista vacia pone rojo «un negocio SIN locales
   puede guardar» (por el 422 de `renderTermsText`). **Quedo VERDE**, y el mecanismo es exacto:
   la condicion es `!allowedVariables.includes(key) || !variables[key]`, y **`undefined` y `""`
   son las dos falsy**, asi que **no emitir una variable y emitirla vacia producen el MISMO
   422** — son indistinguibles desde el markdown. Y como **ninguna plantilla del wizard nombra
   esas variables**, ahi no hay 422 de ningun lado. O sea que la decision «no se emiten» **no
   protege nada por si sola**. Lo que protege el caso trampa son DOS cosas distintas, y las dos
   tienen oraculo propio ahora: (a) que ninguna semilla las nombre
   (`loyalty-terms-semillas.neon`), y (b) el end-to-end del 201 (`loyalty-terms-negocio.neon`).
   **El unico oraculo del repo que VE la M1 es el unitario del diccionario**, que asevera
   `not.toHaveProperty` — y por eso `termsVariables` es pura y exportada.
2. **`transition` de `global-draft` YA ESTABA `archived` desde la migracion `0011`.** La spec §3
   dice «hoy `transition` existe solo en `global-draft`… y al archivarlo el proyecto se quedaria
   sin clausula de vigencia por pais»: la primera mitad es cierta, la segunda **no puede serlo**,
   porque ya no estaba publicada. Leido por SQL antes de migrar. **Y el detalle que importa:
   la 0011 la archivo justamente porque su texto usa `{{earning_ends_at}}` /
   `{{redemption_ends_at}}`, que el renderer NO provee** — copiar ese texto a `default`/`EC`
   habria reintroducido el 422 que la 0011 vino a sacar. Las dos filas nuevas usan **solo
   variables que el renderer emite siempre**, y hay un caso que lo asevera.
3. **El `UPDATE` del `variables_allowlist` que pide la spec §3.3 es INNECESARIO, y no se
   escribio.** Los textos de las 4 semillas de la `0038` **no cambian** en esta spec, asi que no
   usan ni una variable nueva y su allowlist ya las cubre. Las variables nuevas viajan en el
   allowlist de las 4 filas que la `0039` **inserta**. Escribir un `UPDATE` que setea el mismo
   valor que ya esta habria sido un no-op con forma de trabajo. **La M5 se midio sobre el
   allowlist del `INSERT`**, que es donde vive de verdad la propiedad.
4. **La spec dice «once» variables y su tabla lista DOCE.** Manda la tabla (es la normativa):
   estan las 12, y el unitario asevera el conjunto exacto de claves.

### LOS DESVIOS DE LA TABLA «Archivos», todos declarados

1. **`loyalty-terms-semillas.neon.integration.test.ts` (NUEVO).** Los casos de nivel semilla
   (conteos, idempotencia, `transition`, `global-draft` archivado, «ninguna semilla nombra las
   variables de local») **no entraban** en `onboarding-program-terms.neon`: con ellos ese archivo
   daba **327** lineas y el hook `file-size` corta en 300 — «dividir, no extender». Preguntado AL
   HOOK, con control sobre un archivo sano.
2. **CINCO archivos de test nuevos**, todos del plan de pruebas (la tabla de la spec dice
   «tests | crear/editar los del plan de pruebas», asi que entran ahi):
   `loyalty-program/terms-variables.test.ts` (el diccionario, PURO),
   `loyalty-terms-negocio.neon` (locales contra la base + el dinero end-to-end),
   `loyalty-terms-templates.neon` (la ruta de plantillas),
   `loyalty-terms-semillas.neon` (las filas de la migracion) y
   `loyalty-terms-doce-variables.neon` (las doce renderizadas en un markdown exacto, que es el
   DoD al pie). **Son cinco y no dos por el hook `file-size`**, no por gusto: cada corte se
   verifico preguntandole AL HOOK, con control sobre un archivo sano — `loyalty-terms-negocio`
   quedo en **281** lineas y la plantilla de las doce no entraba.
3. **`server/staff.ts` + `server/api-owner.ts` (una columna y un campo de tipo), fuera de la
   tabla.** El filtro por scope de la ruta de plantillas necesita el pais, y `ownerContext` —el
   resolvedor del guard— no lo seleccionaba. Se agrego **una columna a un `innerJoin` que ya
   existia** (cero consultas nuevas) en vez de resolver el negocio otra vez con `ownerBusiness`,
   que ordena `desc(createdAt)` contra el `asc` del guard: gatear sobre una fila y filtrar sobre
   otra es exactamente la divergencia que la 0072 §D3 declara abierta. **`ownerBusiness` NO se
   toco.**
4. **UN caso preexistente CAMBIO DE POLARIDAD a proposito, y es el unico.**
   `loyalty-terms-render.neon` exigia «`global-draft` sigue publicado y renderiza igual que antes
   de la 0078». La spec 0081 la **archiva**, asi que eso ya no corresponde. **No se borro: se dio
   vuelta con su motivo escrito**, y su nueva asercion es mas fuerte — que `renderedTerms`
   **rechaza** ese `templateId` con «La plantilla seleccionada no está disponible.», que es lo
   que cierra el camino al texto deprecado.
5. **Dos firmas se volvieron de argumento OBLIGATORIO** (`wizardClauseTemplateIds` y
   `resolveWizardClauseIds` reciben el `accrualMode`), asi que el typecheck obligo a declarar a
   los 9 llamadores en 4 archivos de test. Mecanico, y preserva la semantica anterior
   (`"per_purchase"` → la clausula de siempre).
6. **`onboarding-program-terms.neon`: los conteos de semillas pasaron de 4 a 8** y la idempotencia
   ahora corre las DOS migraciones. Es data que la `0039` cambia, no un test debilitado: las
   aserciones nuevas son **mas** (dos conteos por clave y un piso de statements).

### LIMITES Y COSTOS, intentados y no supuestos

1. **UNA consulta nueva por escritura de programa**: los locales `active`. Se paga **siempre**,
   incluso cuando ninguna plantilla del TOS nombra las variables de local — que es el caso de
   **todas** las semillas de hoy. Se podria evitar leyendo los textos antes de decidir, pero eso
   acopla el diccionario a las plantillas y la spec declara el costo explicitamente (§1). Va en la
   linea del hallazgo de round-trips que dejo abierto la 0079.
2. **`business_locations` y `business_address` se emiten y se testean, pero HOY no cambian ningun
   TOS**: ninguna semilla las nombra (a proposito: un negocio sin locales no podria guardar). Son
   consumibles cuando exista una forma de crear plantillas desde el panel, y el texto libre **no**
   admite variables (limite de la 0078). **Es lo mas cerca de andamiaje que tiene esta spec** y se
   declara como tal: el owner las pidio explicitamente (variables #2 y #3 de sus ocho).
3. **`pnpm test:e2e` NO se corrio y NO aplica**: cero `.tsx` tocados.

## ⇥ ✅ BITACORA DE MUTACIONES — spec 0081 (implementador, 2026-09-19) — CERRADA

**CERRADA: las 6 medidas y revertidas.** `diff` VACIO contra la copia limpia en los 4 archivos,
`shasum` identico, `rg -n MUTATION apps tools` **vacio** y `.claude/hooks/no-mutations-left.sh`
**EXIT=0**. Restauracion de emergencia (los 4 estan MODIFICADOS o SIN TRACKEAR: **`git checkout`
NO sirve** — se lleva el trabajo de la spec, y el `.sql` ni existe como blob):

```
cp /tmp/limpios-0081/terms.ts             apps/merchant/src/server/loyalty-program/terms.ts
cp /tmp/limpios-0081/terms-scope.ts       apps/merchant/src/server/loyalty-program/terms-scope.ts
cp /tmp/limpios-0081/program-defaults.ts  apps/merchant/src/server/onboarding/program-defaults.ts
cp /tmp/limpios-0081/0039_tos_variables_del_negocio.sql apps/merchant/drizzle/0039_tos_variables_del_negocio.sql
```

**⚠️ NOTA DE ALCANCE, honesta: `loyalty-terms-doce-variables.neon.integration.test.ts` se escribio DESPUES de medir M1, M2, M3, M5 y M6**, asi que NO esta en los alcances de esas cinco filas. **Solo M4 se re-midio con el** (ver su fila). De las otras cuatro no se afirma nada sobre ese archivo: es trabajo que el revisor puede hacer si lo quiere cerrado.

| id | archivo | shasum LIMPIO | invariante que ataca | resultado EJECUTADO |
|---|---|---|---|---|
| M1 | `loyalty-program/terms.ts` — emitir las variables de local SIEMPRE, tambien vacias | `b09775cee60acef3c662de522454ef65589b5d47` | las variables de local NO se emiten con la lista vacia | **ROJO — 1 test de 28**, y es el UNICO del repo que la ve: `terms-variables.test` «SIN locales activos las dos variables NO se emiten (ausentes, no vacías)» (`AssertionError: expected { …(11) } to not have property "business_locations"`, Expected `undefined` / Received `""`). **⚠️ EL ORACULO QUE LA SPEC LE ASIGNA QUEDO VERDE:** «un negocio SIN locales `active` crea su programa: 201» paso, porque ausente y vacio dan el MISMO 422 y ninguna semilla nombra esas variables — ver el hallazgo 1. Alcance corrido: `terms-variables.test` + `loyalty-terms-negocio.neon` + `loyalty-terms-render.neon` + `onboarding-program-terms.neon` + `loyalty-terms-semillas.neon` → **1 failed / 27 passed** |
| M2 | `loyalty-program/terms.ts` — borrar el `eq(locations.status,'active')` del `WHERE` | `b09775cee60acef3c662de522454ef65589b5d47` | los locales se listan filtrados por `status='active'` | **ROJO — 1 test de 28**: `loyalty-terms-negocio.neon` «lista los locales `active` separados por `, ` y excluye el `archived`». Asercion literal: Received `"Locales: Sucursal Centro, Sucursal Norte, Sucursal Cerrada. Direcciones: Av. 9 de Octubre 123, Av. Orellana 45, Calle Vieja 1."` vs Expected sin las dos ultimas. **El rojo habla de la propiedad: el local ARCHIVADO se colo en el texto legal.** Mismo alcance de 5 archivos: **1 failed / 27 passed** |
| M3 | `loyalty-program/terms-scope.ts` — `earningClauseKey` devuelve siempre `earning` | `9f2a68402fe4f8b5b416d8ed4f0c03fe4ce29847` | la clausula de acumulacion la elige el `accrual.mode` | **ROJO — 3 tests de 85**, los tres niveles: (a) el de la spec, `loyalty-terms-negocio.neon` «`per_amount` guarda la mecánica y el TOS nombra el monto y la moneda» (`expected 'Los sellos se acumulan únicamente con…' to contain 'Se otorgan 1 sellos por cada 5.00 USD'` — la FILA quedo bien y el TEXTO LEGAL mintio, que es exactamente la clase de error del presupuesto); (b) `terms-variables.test` «`per_amount` elige la plantilla del monto» (`expected 'earning' to be 'earning_per_amount'`); (c) `program-defaults-clauses.test` «un `accrual` `per_amount` explícito recibe la cláusula DEL MONTO». Alcance: `loyalty-program/` + `onboarding/` + `loyalty-terms-negocio.neon` + `onboarding-program-terms.neon` + `loyalty-program-ruta-unica.neon` → **3 failed / 82 passed** |
| M4 | `loyalty-program/terms.ts` — `program_unit_plural` cae al singular | `b09775cee60acef3c662de522454ef65589b5d47` | `program_unit_plural` es el PLURAL, no el singular | **ROJO — 6 tests de 88**, con el «Los sello se acumulan…» que cazo la 0078 reproducido literal: `onboarding-program-terms.neon` «el programa del cuerpo corto queda con «Los sellos»» y «el `countryCode` del CUERPO no mueve el scope» (`expected 'Los sello se acumulan únicamente conf…' to contain 'Los sellos se acumulan'`), `loyalty-terms-negocio.neon` los dos casos de TOS, y `terms-variables.test` Sellos y Puntos (`expected 'sello' to be 'sellos'`, `expected 'punto' to be 'puntos'`). Alcance: los 6 archivos de arriba + `loyalty-terms-render.neon` → **6 failed / 82 passed**. **RE-MEDIDA despues de agregar `loyalty-terms-doce-variables.neon`** (que se escribio DESPUES de la primera vuelta, para cumplir al pie el DoD de «las doce renderizadas»): con ese archivo en el alcance son **8 failed / 49 passed**, y los dos rojos nuevos son sus casos de Sellos y de Puntos, con el markdown exacto. Revertida otra vez, `diff` vacio y shasum identico |
| M5 | `drizzle/0039_…sql` — el allowlist de las 2 filas de `earning_per_amount` SIN `currency_code`, `program_accrual_grant` ni `program_accrual_block_amount` | `4d335126ebcab7fe69195c5d0b1c389c25aaeda1` | el `variables_allowlist` de `earning_per_amount` cubre las variables de dinero | **ROJO — 2 tests de 15.** Medida re-sembrando: `delete from core.terms_template where key='earning_per_amount'` + re-aplicar el SQL mutado (verificado por SQL que el allowlist quedo recortado). `loyalty-terms-negocio.neon` «`per_amount` guarda la mecánica…» (`expected 422 to be 200`) y `loyalty-program-ruta-unica.neon` «un cuerpo de Puntos crea el programa» (`expected 422 to be 201`). **EL MOTIVO DEL ROJO, leido con una sonda ejecutada y borrada** (el rojo del status no lo muestra): `La variable {{program_accrual_grant}} no está permitida.` — es el 422 del allowlist, no otro. **Y un dato para el revisor: «las 8 semillas… con `country_code` en el allowlist» quedo VERDE** — esa asercion NO guarda las variables de dinero; la que las guarda es el end-to-end. Revertida y **re-sembrado el allowlist limpio, verificado por SQL** |
| M6 | `onboarding/program-defaults.ts` — sembrar SIEMPRE, ignorando el `clauses` del cuerpo | `66a3c8802cdb627c05556d8c5afa98ce3599756f` | un `clauses` NO VACIO del cuerpo sobrevive al compositor (hallazgo **F1** del revisor de la 0080) | **ROJO — 4 tests de 52, y el que cierra el hueco es el PRIMERO:** `loyalty-program-ruta-unica.neon` «un cuerpo COMPLETO de hoy conserva cada campo que mandó, cláusulas incluidas» (`expected 'Se otorgan 3 visitas por cada 20.00 U…' to contain 'Cláusula propia del comercio, escrita…'`). **El rojo cae en la asercion NUEVA**, o sea en el oraculo que esta spec agrego: antes ese caso mandaba `clauses` iguales a las semillas de EC y su bloque **ni mencionaba** `termsMarkdown`, asi que sembrar encima era un no-op observable (la bitacora de la 0080 lo dejo medido: su M2 lo vio VERDE). Los otros 3 son los oraculos de la 0080 (`program-defaults-clauses.test`), esperables porque esta mutacion es un superconjunto de su M2. Alcance: `loyalty-program-ruta-unica.neon` + `onboarding/` + `onboarding-program.neon` + `onboarding-program-terms.neon` + `loyalty-terms-negocio.neon` → **4 failed / 48 passed** |

## ⇥ (historico, SUPERADO) HANDOFF QUE ABRIO EL TRABAJO DE UI

### La UI que seguia ya fue implementada con las decisiones finales del owner

> **SUPERADO:** este bloque conserva el pedido recibido, no el estado actual. El alcance final y
> la evidencia estan al principio de este archivo. El owner decidio no construir el monto por
> sello ni el panel de TOS; Puntos usa `Punto`/`Puntos` fijos y pide los tres valores monetarios y
> de acumulacion necesarios.

**Decision textual del owner (2026-09-20):** *«no vamos a hacer QA todavia, vamos a hacer los
arreglos de UI antes del qa»*. El checklist de QA **ya esta escrito** y espera intacto en
`docs/QA-arco-0076.md`; **no hay que re-escribirlo.**

**EL DOCUMENTO PARA QUIEN CONSTRUYE LA UI ES `docs/ui-delta-arco-0076.md`.** Quien la construye
(ChatGPT) leyo los contratos **hasta el 0074, el 18/09** — antes del arco —, asi que **su mapa de
la API esta viejo**. El delta abre por lo que se ROMPIO y trae el inventario medido.

**EL GAP, en el orden que propone el delta (el owner decide el alcance):**

1. **Paso 3 del wizard: elegir modalidad** (Sellos/Puntos). Hoy manda `kind:"stamps"` hardcodeado
   y **Puntos no tiene ninguna forma de crearse desde la UI**.
2. **Paso 3: el monto por sello** — pedido explicito del owner; **la API ya lo acepta y lo guarda**.
3. **Mensaje propio para `403 email_not_verified`**: el permiso de alta **VENCE** (60 min desde la
   cuenta, 5 desde completar el alta), y hoy eso cae en un error generico.
4. **Panel de TOS** (plantilla por pais o texto libre). **No va en el wizard** — decision del owner.
5. **Borrar `/backoffice/demo/*`** y limpiar sus referencias (ADR 0070 §17).

### ⚠️ UNA PREGUNTA ABIERTA PARA EL OWNER, y no se resuelve sola

El paso 3 **ya tiene campos de dinero** — «Costo unitario del premio» y «Valor promedio por
compra» — en su **calculadora de impacto**, y **esos campos NO se envian** (son solo para el
calculo en pantalla). El **monto por sello** es un concepto **distinto**: uno es estadistico, el
otro es **la regla del programa** que se guarda y que cambia el texto legal.

**¿Son dos campos separados o se unifican?** Es decision de producto: **no la tome el que
implemente.**

### Lo que NO hay que volver a hacer

- **No re-escribir el checklist de QA** (`docs/QA-arco-0076.md`).
- **No volver a preguntar las 8 variables del TOS**: el owner ya las dio y estan implementadas.
- **No tocar `POST /api/onboarding/program`**: fue BORRADO. La ruta unica es `PUT /api/loyalty-program`.

## ⇥ ✅ MIGRACION A PROD APLICADA — y prod estaba ROTO sin saberlo (2026-09-20)

**El bloqueo se levanto porque el owner dio el dato que faltaba: la DB es el proyecto Neon
`red-violet-38772073`.** El MCP estaba scopeado a `silent-wave-15401445`, cuya base **no tiene los
esquemas de la app** — por eso «prod» parecia vacio. **Leccion: cuando la base no tiene los
esquemas que esperas, la hipotesis correcta no es «esta vacia» sino «no es esa base».**

### LO QUE APARECIO AL MIRAR LA BASE DE VERDAD, y no era lo que decian los docs

| Dato heredado | Medido el 2026-09-20 |
|---|---|
| «prod: 0 negocios» (2026-09-18) | **1 negocio real**: `LaCraft Beer Garden`, pais **EC**, moneda USD |
| — | **1 programa ACTIVO** de Sellos `per_purchase`, con su TOS renderizado |
| «faltan 0038 y 0039» | **faltaban TRES**: tambien la **`0037_onboarding_grant`**, que es de **ESQUEMA** |

**PROD ESTABA ROTO EN DOS FLUJOS, y el deploy lo destapo:**

1. **Crear o editar un programa daba 503.** Medido con **la consulta exacta del codigo** contra
   prod: `status='published' AND locale='es' AND jurisdiction_scope IN ('EC','default') AND key IN
   (...)` devolvia **`[]`** — las unicas 2 plantillas publicadas eran de `global-draft`, y el
   codigo nuevo ya no las mira. `scopedTemplateIds` → `null` → **503**.
2. **Faltaba la columna `onboarding_grant_until`** que la spec 0077 —ya desplegada— escribe. Sin
   ella, un `42703` que **parece un bug de codigo y es una migracion pendiente**.

### El orden de despliegue, corregido con evidencia

**La 0081 §F2 decia «aplicar la `0039` ANTES del deploy». Era al reves:** el codigo que corria en
prod (`78d1f3a`) usa **`global-draft` hardcodeado** (`program-defaults.ts:65`), y la `0039` archiva
justo esas plantillas. **Orden ejecutado: push → deploy → verificar el sha → migrar.**

### Verificacion POST, toda por SQL contra la rama de prod

- `drizzle.__drizzle_migrations`: **37 → 40**.
- `global-draft`: **3 archivadas, 0 publicadas**.
- Semillas por pais: **8 publicadas**; la consulta del codigo para EC ahora devuelve **6 filas**
  (`earning`, `earning_per_amount`, `redemption` en `EC` **y** en `default`).
- Columna `onboarding_grant_until`: **presente**.
- **El TOS ya emitido del negocio real NO cambio**: mismos **235 caracteres** y su hash, antes y
  despues de archivar `global-draft`. Era el riesgo declarado y no se materializo.

### ⚠️ PENDIENTE DEL OWNER: rotar la credencial

Para migrar hubo que pedir la connection string de `neondb_owner` por MCP y **quedo en el
transcript**. Rotarla en el panel de Neon y actualizar `DATABASE_URL`/`DATABASE_URL_UNPOOLED` en
Vercel.

## ⇥ ✅ 0081 IMPLEMENTADA CON PASS — EL ARCO ESTA COMPLETO (2026-09-19)

**Gates reproducidos por el orquestador con EXIT CODE EXPLICITO** (no inferidos de un pipe):
`typecheck --force` `EXIT=0` (3 successful, sin cache), `lint` `EXIT=0`, `build` `EXIT=0`,
`format:check` `EXIT=0`, y **226 archivos / 1757 tests con Neon, 0 failed, 0 skipped**.
Cero `MUTATION`, cero `.tsx`.

**EL ORQUESTADOR MIDIO LA M6, que el revisor habia declarado afuera por presupuesto** — era el
unico item del DoD sin verificacion independiente. Protocolo completo (shasum limpio
`66a3c880…`, bitacora antes, etiqueta `MUTATION O-M6`, revertida con `diff` vacio y shasum
identico). **MUERDE y por el motivo correcto**: sembrando siempre e ignorando el `clauses` del
cuerpo, el caso «cuerpo COMPLETO … clausulas incluidas» de `loyalty-program-ruta-unica.neon` cae
con `expected 'Se otorgan 3 visitas por cada 20.00 U…' to contain 'Clausula propia del
comercio…'`. **El hueco F1 que venia de la 0080 quedo CERRADO con oraculo propio.**

### Lo que el revisor confirmo, y lo que agrego

**Los 4 claims falsos de la spec: los cuatro CIERTOS**, verificados por el revisor con SQL propio
y lectura del renderer — incluido que `transition` de `global-draft` ya estaba `archived` desde la
**0011** y que su texto usa `{{earning_ends_at}}`, **que el renderer no provee**: copiarlo habria
reintroducido el 422 que la 0011 vino a sacar.

**Sus dos juicios sobre el alcance:**

- **`staff.ts` / `api-owner.ts` fuera de la tabla: CAMBIO SEGURO.** El diff agrega **una columna a
  un `select` de un `innerJoin` que ya existia**; `where`, `orderBy` y `limit` **no se tocaron**,
  asi que **no puede mover que fila resuelve el guard**. La alternativa habria metido un segundo
  resolvedor con orden inverso.
- **`business_locations`/`business_address`: ENTREGA PEDIDA, no andamiaje.** Busco las **palabras
  textuales del owner** en `TASKS.md` (sus variables #2 y #3). Por la regla de CLAUDE.md, **no
  vuelve a subir como decision abierta**.

**Y midio lo que NADIE habia medido (su R4): el AISLAMIENTO POR NEGOCIO de la consulta nueva de
locales.** 3 tests rojos en 2 archivos bajo la mutacion: la fuga cross-tenant **al documento
legal** queda pinneada. Es el mejor hallazgo de la revision y no estaba en ninguna spec.

### ⚠️ F2 — ACCION DE DESPLIEGUE, LO UNICO QUE PUEDE ROMPER EL QA

**La migracion `0039` tiene que estar aplicada ANTES de que este codigo atienda un `per_amount`.**
`wizardClauseTemplateIds` pide `earning_per_amount` y `scopedTemplateIds` cae **por scope
completo**: sin las filas de la `0039`, ningun candidato tiene el juego y la ruta tira
**503 `program_unavailable`**. El cuerpo corto de hoy (`per_purchase`) **no** se ve afectado.

**La `0039` esta aplicada a INTEGRACION, no a prod.** Hay que aplicarla **con** el deploy, no
despues.

### F1 y F3 — abiertos, ninguno bloquea

- **F1 (preexistente, 0072 §D3):** `GET /api/loyalty-terms/templates` scopea con `ownerContext`
  (`asc`, con `memberships.status='active'`) y `saveProgram` escribe con `ownerBusiness` (`desc`,
  **sin** ese filtro). Con 2+ negocios de paises distintos, el panel ofrece las plantillas del mas
  viejo y el TOS se guarda en el mas nuevo. **La mutacion R1 del revisor SOBREVIVIO con los 1757
  tests en verde: la divergencia sigue SIN ORACULO.** Hoy inocuo (prod con 0 negocios). Cerrarlo es
  una spec chica: que los dos compartan un resolvedor unico.
- **F3 (informativo):** las 2 filas de `transition` sembradas en `default`/`EC` **no las consume
  ningun codigo hoy** (`WIZARD_CLAUSE_KEYS` las excluye); solo salen en `GET /templates` para el
  panel. La spec las pidio, pero **su justificativo declarado era falso**. Se anota para que no se
  lea como necesidad medida.

## ⇥ ✅ 0080 IMPLEMENTADA CON PASS — y lo que encontro vale mas que su alcance (2026-09-19)

**Gates reproducidos por el orquestador:** `typecheck --force` (sin cache), `lint`, `build` verdes
y **221 archivos / 1730 tests con Neon, 0 failed, 0 skipped** (antes: 220/1726 con 1 rojo). Cero
`MUTATION`. `program-defaults.ts` **byte-identico a HEAD** — el revisor lo verifico contra el
**blob de git**, no contra el handoff. Cero produccion tocada, cero `.tsx`.

**EL HALLAZGO CENTRAL: la premisa de la propia spec era FALSA.** `[]` es **truthy**, asi que la
mutacion que la spec proponia media **21/21 en VERDE**. El invariante real es un `clauses` **falsy
pero presente** (`null`): con truthy recibe las semillas y **CREA el programa** en vez de irse al
422. Con ese caso, la mutacion muerde con **1 test en 1250**. La frase «verificado con una sonda
ejecutada» venia de un **PASS de la 0079** y se copio **sin ejecutarla**. Corregido en la spec, en
`LECCIONES.md` (sexto caso) y en **dos reglas nuevas de `CLAUDE.md`**.

**EL SEGUNDO, reproducido por el revisor con metodo propio: un `vi.mock` de
`wizardClauseTemplateIds` seria un ORACULO MUERTO.** `programInput` la llama por **binding local
del mismo modulo** (`program-defaults.ts:114`): el doble **no intercepta**, corre la real y el
espia queda en cero llamadas **siempre**, asi que `not.toHaveBeenCalled()` **no puede fallar
nunca**. El stack del rojo muestra el `Proxy` delegando en la funcion real. Se espia **`getDb`**,
que ademas es mas fuerte. **La spec lo prescribia mal y ya se corrigio.**

**Y un regalo del metodo:** la mutacion R3 del revisor delato el orden real de las filas del flake
— `[ 'unknown', 'accepted' ]`, con el `accepted` del test vecino **ultimo**—, o sea que en esa
misma corrida el viejo `.at(-1)` habria fallado. **El mecanismo quedo medido por segunda vez, con
un metodo distinto.**

### Los 5 hallazgos del revisor y donde fue cada uno

| # | Hallazgo | Resolucion |
|---|---|---|
| **F1** | **Hueco REAL del contrato 0079**: no hay oraculo para «un `clauses` NO VACIO del cuerpo sobrevive». El caso «cuerpo COMPLETO» manda **las semillas mismas** (`…ruta-unica.neon:194`, ids de la linea 106), asi que sembrar encima es un **no-op observable** y su bloque de aserciones **ni menciona** `clauses`. Confirmado con `grep` exhaustivo | **ABSORBIDO POR LA 0081**: entra en su alcance, su DoD y su mutacion **M6**. Son ~3 lineas |
| **F2** | La spec 0080 **prescribia el oraculo muerto** | **CORREGIDO**, con el mecanismo escrito |
| **F3** | La tabla «Archivos» no listaba el archivo nuevo (obligado por `file-size`: 285+136 > 300) | **CORREGIDO**, con el motivo |
| **F4** | Linea rancia: §Problema decia `:134`, desmentida abajo por `:177` | **CORREGIDO** |
| **F5** | `TASKS.md` se contradecia sobre el estado de la 0080 | **CORREGIDO** |

**Juicios del revisor que CIERRAN preguntas abiertas:** `""`/`0`/`false` **no hacen falta** (misma
clase de equivalencia que `null` — el patron «las primeras 4 mutaciones dieron todo el valor» del
ADR 0062); el caso de `clauses: []` **si vale**, porque su compañero (cero consultas) es el
**unico** oraculo del repo que pinnea el ahorro de round-trips del contrato 0079; y el docblock
nuevo de `onboarding-grant.neon` es **verdadero**, verificado referencia por referencia.

**Declarado y NO perseguido:** el radio de explosion de la mutacion 2 sobre los ~93 archivos Neon
(presupuesto 3/3 agotado; ataco su consecuencia —F1— por `grep`), y `build` (arbol byte-identico al
del orquestador, que lo dio verde). **Dijo explicito que su `typecheck` salio cacheado**, para que
no se lea como una medicion propia.

## ⇥ ENTREGA DEL IMPLEMENTADOR — spec 0080 (2026-09-19)

**Estado: implementado, SIN commitear y SIN marcar la spec.** Falta el PASS del revisor
independiente (ADR 0071). **Arbol LIMPIO de mutaciones**: `grep -rn MUTATION apps/merchant/src
tools` → 0 lineas, `.claude/hooks/no-mutations-left.sh` **EXIT=0**, y `program-defaults.ts`
identico a HEAD (`shasum 46812170…`, `git status --short` vacio sobre ese archivo).

**Los cinco gates de root con Node 24 y `set -a; . ./.env.integration.local; set +a`:**

| Gate | Resultado |
|---|---|
| `typecheck` (con `--force`, sin cache) · `lint` · `format:check` · `build` | **los cuatro verdes** |
| `test` con Neon | **221 archivos / 1730 tests, 0 failed, 0 skipped** (antes: 220/1726 con 1 failed) |
| `consumer-recovery.neon` ×3 seguidas | **8/8 VERDE las tres** (corridas 1, 2 y 3) |
| `test:e2e` | **NO corrido y NO aplica**: cero `.tsx` tocados (lo dice el DoD de la spec) |

**Archivos tocados (4):** `onboarding/program-defaults-clauses.test.ts` (**nuevo**),
`onboarding-grant.neon.integration.test.ts` (titulo + docblock, **cero lineas de `expect`**),
`consumer-recovery.neon.integration.test.ts` (solo la lectura de 363-367) y
`docs/specs/0079-…md` (la firma del compositor). **Ni un archivo de `src/` que no sea `.test.ts`.**

### ⚠️⚠️ EL HALLAZGO QUE DA VUELTA LA PREMISA DE LA SPEC — `[]` ES TRUTHY

**La mutacion 1 de la spec NO rompe nada, y eso esta MEDIDO.** La spec (y el revisor de la 0079,
que decia haberlo verificado «con una sonda ejecutada») afirmaban que cambiar
`if (partial.clauses !== undefined)` por `if (partial.clauses)` hace que un **`clauses: []`**
reciba las semillas y cree el programa. **Es FALSO: `Boolean([]) === true` en JS**
(`node -e 'console.log(Boolean([]))'` → `true`), asi que para `[]` las dos formas deciden **lo
mismo** y la mutacion es un **no-op**. Medido: con la M1 viva y los tres casos de la spec ya
escritos, `src/server/onboarding/` daba **21/21 VERDE**.

**Lo que el caracter `!== undefined` sostiene de verdad es un `clauses` FALSY pero PRESENTE** —
`null`, `""`, `0`, `false`—: con truthy, un `clauses: null` se va a buscar las semillas y **crea
el programa que el cliente no pidio**; con `!== undefined` viaja intacto al 422 del validador.
Por eso el archivo nuevo tiene **CUATRO** casos y no tres: el cuarto (`clauses: null`) es **el
unico oraculo del repo que ve esa mutacion** (ver la bitacora).

**Consecuencia para quien herede esto:** el «un solo caracter» del hallazgo 1 del revisor de la
0079 era real, pero **su ejemplo no**. El agujero existia y ahora tiene oraculo; la prosa de la
0080 §Problema y su tabla de mutaciones quedan desmentidas en ese punto.

### LOS DESVIOS Y LIMITES, todos medidos (el revisor tiene que mirarlos)

1. **Los casos nuevos NO van en `program-defaults.test.ts`: van en
   `onboarding/program-defaults-clauses.test.ts` (nuevo).** Motivo medido: ese archivo esta en
   **285** lineas y el hook `file-size` corta en **300** — «dividir, no extender». Beneficio de
   rebote: el `vi.mock` de `../db` no contamina los 18 casos puros que ya viven ahi, y el archivo
   que la **0081** va a tocar queda **sin diff**.
2. **LIMITE MEDIDO (intentado, no supuesto): `vi.mock` de `wizardClauseTemplateIds` NO
   intercepta.** La spec pedia doblar esa funcion, pero `programInput` la llama por su binding
   **local** (viven en el mismo modulo). **Sonda ejecutada y borrada:** con el doble puesto, el
   contador del doble quedo en **0 llamadas** mientras la funcion real corria (las `clauses`
   salieron de las filas dobladas y `getDb` se llamo **1** vez). O sea que un
   `expect(spy).not.toHaveBeenCalled()` sobre ese doble **pasaria siempre**: seria un oraculo
   vacio. El espia que SI mide el corto-circuito es **`getDb`** (unico efecto de esa funcion) mas
   **`ownerBusiness`**, con **control positivo** que exige `getDb` llamado **1 vez**.
3. **La mutacion 2 no puede poner rojo «los tres casos, positivo y negativos» como predice la
   spec.** Borrar el `if` no cambia el camino SIN la clave `clauses`, asi que el control positivo
   queda verde **por construccion**. Medido: **3 de 4 rojos**.
4. **Dos numeros de linea de la spec estan corridos:** `programEditDenied` abre con
   `if (!input.isEdit) return null` en **`onboarding-grant.ts:76`** (la spec dice 73). El docblock
   nuevo dice 76.
5. **`consumer-recovery.neon.integration.test.ts` queda en 453 lineas, sobre el limite de 300 —
   PREEXISTENTE:** HEAD ya lo tenia en **447**. Esta spec suma 6 lineas de comentario y su
   alcance dice «SOLO la lectura de 363-367», asi que partirlo seria irse de alcance. Se declara.
6. **El arreglo del flake es el (b) de la spec (aseverar sobre el conjunto), y el (a) tambien
   servia:** medido con un log temporal contra Neon, la lectura devuelve **exactamente 2 filas**
   para `phones[4]` —`accepted` a las 23:33:47.648 y `failed` a las 23:34:02.839, **15 s de
   diferencia, sin empate de `createdAt`**—. Se eligio (b) igual porque **no depende de ningun
   orden ni del reloj**, y porque la propiedad que el caso quiere es «el fallo quedo registrado».
   Esa medicion **confirma el mecanismo del flake y descarta otra vez** la colision de
   `phone_e164` UNIQUE: el `.at(-1)` elegia entre esas dos filas, y `'accepted'` es exactamente
   el valor del rojo reportado.

### ⚠️ CORRECCION AL REGISTRO: el rojo de las 18:37/18:39 NO fue «un test a medio escribir»

La seccion «EN VUELO» decia que el `verify.sh` de las 18:37 cazo
`program-defaults-clauses.test.ts` a medio escribir. **No fue eso: eran las MEDICIONES M1 y M2**,
con la mutacion **viva y etiquetada** en `program-defaults.ts:177` (M1 → 1 failed a las 18:37,
M2 → 3 failed a las 18:39). El archivo de test estaba completo y verde en limpio desde las 18:36.
La conclusion operativa no cambia —**un gate corrido encima de un implementador que muta mide
otra cosa**—, pero la causa si: era un **rojo de mutacion**, que es indistinguible de un bug
desde afuera y por eso la bitacora se abre ANTES de medir.

### Hallazgos a decidir (ninguno tocado)

- **No queda oraculo para «un `clauses` NO VACIO del cuerpo sobrevive» por la ruta.** El caso
  «un cuerpo COMPLETO de hoy conserva cada campo» de `loyalty-program-ruta-unica.neon` manda
  `clauses` **iguales a las semillas de EC** (`templateIds = await wizardClauseTemplateIds("EC")`,
  linea 106), asi que sembrar encima es un **no-op observable** y ese caso quedo verde bajo la M2.
  Hoy lo cubre el compositor por unidad; un caso con clausulas propias por la ruta seria una
  linea mas, pero es alcance que esta spec no tiene.
- **`docs/INDEX.md` aparece modificado y NO lo toco esta entrega** (lo edito el orquestador en
  paralelo, junto con `specs/0081-…md`).

**LO QUE ESTA SIN COMMITEAR (punto de retorno `07a06c0`):** los 3 tests + la correccion de la
spec 0079. `git checkout .` se llevaria el test NUEVO, que no esta commiteado; para volver
`program-defaults.ts` a limpio alcanza `git checkout` **de ese archivo solo** (ya esta limpio).

## ⇥ ARRANCA ACA LA SESION QUE SIGUE (2026-09-19)

### ✅ EL OWNER YA DECIDIO LO DEL TOS — NO SE LE VUELVE A PREGUNTAR

**Textual (2026-09-19), sobre la variable #7:** *«el API en la pantalla 3 puede pasar el valor
para que lo uses en el TOS y ademas queda guardado. TU NO TOCAS UI, dejas documentada el api para
que sepa ChatGPT que puede enviar y como enviarlo para que luego GPT decida si vamos a armar una
pantalla o no»*, y *«completa las que quedan en tasks.md»*.

**LAS DOS REGLAS QUE SALEN DE AHI:**

1. **El monto por unidad se acepta por API y se guarda.** No es «(a) omitir la variable» ni «(b)
   cambiar la pantalla»: es **la API lo acepta, el TOS lo usa, y la pantalla la decide GPT
   despues**.
2. **El entregable de la 0081 incluye el CONTRATO HTTP ESCRITO**, cuyo publico es quien construya
   la UI por fuera. **Cero `.tsx`.** Si una spec de este arco lista un archivo de pantalla, esta
   mal alcanzada (CLAUDE.md, ADR 0070).

### ✅ Y LO QUE ESA DECISION NO CUESTA — MEDIDO CON UNA SONDA EJECUTADA, NO LEIDO

**El dominio YA acepta «un sello cada $X».** Verificado el 2026-09-19 con una sonda que se corrio
y se borro en el mismo turno:

- `validateAccrual` lo dice literal: «Puntos only accepts `per_amount`; **Sellos accepts both
  modes**» (`loyalty-program/accrual.ts:11`).
- El CHECK `loyalty_program_accrual_points_mode_check` **solo** restringe `points`; las columnas
  `accrual_mode` / `accrual_grant` / `accrual_block_amount` ya existen.
- El compositor de la 0079 **no pisa** un `accrual` explicito (`if (partial.accrual === undefined)`,
  `program-defaults.ts:149`).
- La sonda midio las dos mitades: `composeProgramInput` **conserva**
  `{mode:"per_amount", grant:1, blockAmount:"5.00"}` en Sellos, y `validateProgramInput` lo
  **ACEPTA**.

**Conclusion: la 0081 no cambia el dominio.** Cuesta documentacion y texto legal. Y de paso:
`ownerBusiness` **ya trae `currencyCode` e `id`** — lo unico que los esconde es el tipo local
`OwnerBusiness` de `terms.ts:9-12`. **`ownerBusiness` no se toca.**

### ⚠️ EL HALLAZGO QUE DEFINE EL DISEÑO DE LA 0081 (medido)

**`renderTermsText` (`loyalty-program/validation.ts:259-270`) tira 422 cuando el valor es VACIO**,
no solo cuando la variable no esta en el allowlist: la condicion es
`!allowedVariables.includes(key) || !variables[key]`. **Consecuencia: una variable que «a veces no
aplica» IMPIDE GUARDAR EL PROGRAMA**, no deja un hueco en el texto. De ahi salen las dos
decisiones de diseño de la 0081:

- el monto por unidad es una **SEGUNDA plantilla de `earning`** (`earning_per_amount`), elegida por
  el `accrual.mode` — no una variable opcional de la plantilla de siempre;
- **un negocio SIN locales `active` no puede recibir las variables de local**, o no podria guardar
  su programa. Es el caso trampa de la spec y tiene DoD propio.

### LAS DOS SPECS ESCRITAS Y CERRADAS EN ESTA SESION

| Spec | Que | Estado |
|---|---|---|
| **0080** | Los 3 pendientes del cierre del ADR 0076: el oraculo que le falta a `clauses` (el real es `null`, **no** `[]`), el docblock que sobre-afirma, y el flake de `consumer-recovery` | **`implementada` con PASS de revisor independiente** |
| **0081** | Las 8 variables del TOS + `earning_per_amount` + archivar `global-draft` + el contrato HTTP para la pantalla 3 | `cerrada` — **esperando el commit de la 0080** |

**Orden obligatorio: 0080 → 0081.** Comparten `program-defaults.test.ts`.

### ⚠️ UN ERROR MIO DE ESTA SESION, YA CORREGIDO, QUE VALE COMO ADVERTENCIA

La 0080 se escribio primero afirmando que el `if` del invariante de `clauses` estaba en
`program-defaults.ts:134` **y estaba en la 177**, en `programInput` (la funcion `async`) y no en
`composeProgramInput` (que es pura). Con la linea mal, el test que la spec pedia **no habria
podido pinnear nada**: cuando se llama al compositor, la decision de sembrar ya fue tomada. Lo
cazo abrir la funcion antes de cerrar la spec. **Es el mismo patron que las 0077, 0078 y 0079: el
defecto estaba en la SPEC.** Cuarta vez seguida.

### ⚠️ EL FLAKE AJENO DE `consumer-recovery`, con el mecanismo MEDIDO (2026-09-19)

`consumer-recovery.neon.integration.test.ts:367` fallo en la corrida del orquestador
(`expected 'accepted' to be 'failed'`) y **volvio a fallar corrido solo**, aunque el
implementador y el revisor lo vieron VERDE sobre **el mismo arbol**. Mismo codigo, dos
resultados distintos: no es el codigo.

**El mecanismo, leido en el archivo y confirmado — no es la colision de `phone_e164` UNIQUE que
decian los handoffs viejos, eso es FALSO:** `phones[4]` se usa en **DOS** tests (lineas ~269 y
~350). El primero deja una entrega `accepted` y el segundo una `failed`. La linea 363-367 hace
`select ... where(phoneE164)` **SIN `ORDER BY`** y lee `.at(-1)`: el orden de filas en Postgres
es indefinido, asi que levanta cualquiera de las dos.

**Es AJENO a la 0079**: el archivo no lo toca la spec (`git status` limpio sobre el) y es del
dominio consumer/OTP. **Arreglo de una linea** (un `ORDER BY` por `createdAt`, o filtrar por
`status`), pero es tocar un test de otro dominio: **va como spec chica aparte, no se cuela aca.**

## ⇥ ✅ BITACORA DE MUTACIONES — spec 0080 (implementador, 2026-09-19) — CERRADA

**CERRADA: las 2 medidas y revertidas.** `diff` VACIO contra la copia limpia, shasum identico,
`grep -rn MUTATION apps/merchant/src tools` → **0 lineas**, `.claude/hooks/no-mutations-left.sh`
**EXIT=0**, y `git status --short` del archivo **vacio** (igual a HEAD `07a06c0`). Las dos van
sobre `apps/merchant/src/server/onboarding/program-defaults.ts`, **shasum LIMPIO
`46812170425f18c52b865809a0375fd7c371d0db`**; copia limpia en
`/tmp/limpios-0080/program-defaults.ts`. Restauracion de emergencia (el archivo es tracked y
esta SIN MODIFICAR, asi que sirven las dos vias):

```
cp /tmp/limpios-0080/program-defaults.ts apps/merchant/src/server/onboarding/program-defaults.ts
# o: git checkout apps/merchant/src/server/onboarding/program-defaults.ts
```

| id | archivo:linea | shasum LIMPIO | invariante que ataca | resultado EJECUTADO |
|---|---|---|---|---|
| M1 | `program-defaults.ts:177` — `!== undefined` → `if (partial.clauses)` | `46812170…` | un `clauses` presente NO se reemplaza por las semillas | **ROJO — 1 test**, y **es el unico del repo que la ve**: `program-defaults-clauses.test` «un `clauses: null` tampoco se reemplaza por semillas: viaja intacto al 422» (`AssertionError: expected [ …(2) ] to be null`, con los dos `templateId` de semilla adentro). Alcance corrido: `onboarding/` + `loyalty-program-ruta-unica.neon` + `onboarding-program.neon` + `onboarding-program-terms.neon` + `onboarding-program-503` → **1 failed / 48 passed**. **⚠️ PRIMERA MEDICION, antes de agregar ese caso: TODO VERDE (21/21) — ver el hallazgo H1** |
| M2 | `program-defaults.ts:177` — borrar el `if` entero (sembrar SIEMPRE) | `46812170…` | el corto-circuito existe: con `clauses` en el cuerpo no hay consultas | **ROJO — 3 tests**, los tres de `program-defaults-clauses.test`: «`clauses: []` explícito NO recibe semillas» (`expected [ …(2) ] to deeply equal []`), «`clauses: null` … viaja intacto al 422» (`expected [ …(2) ] to be null`) y «con `clauses: []` no hay NI UNA consulta» (`expected "vi.fn()" to not be called at all, but actually been called 1 times`). Mismo alcance: **3 failed / 46 passed**. El **control positivo queda VERDE a proposito** (sin la clave `clauses` el comportamiento no cambia): la spec predecia «los tres casos, positivo y negativos» y eso es imposible por construccion |

## ⇥ HALLAZGOS ABIERTOS DE LA 0079 (lo que la 0080 resolvio y lo que NO)

> **La seccion «ARRANCA ACA» que estaba aca se RETIRO el 2026-09-19: decia «esperando respuesta del
> owner» sobre la variable #7 y el owner YA la contesto.** Un doc que se contradice es peor que
> ninguno. Su contenido vivo (las 8 variables medidas, el hallazgo de `global-draft`) esta en el
> «ARRANCA ACA» de arriba, que es el unico. Lo que sigue se conserva porque es lo unico que no
> estaba duplicado.

**ESTADO DE LOS TRES, al 2026-09-19:** los hallazgos **1 y 2** los esta cerrando la **spec 0080**
(implementada, esperando PASS). El **3 sigue ABIERTO** y es decision del owner.

### LOS 3 HALLAZGOS MENORES QUE DEJO EL REVISOR DE LA 0079

1. **✅ LO CIERRA LA 0080 — (bajo) Un invariante del contrato SIN ORACULO permanente.**
   **⚠️ Y EL EJEMPLO DE ESTE HALLAZGO ERA FALSO:** `[]` es truthy, asi que el caso que el revisor
   proponia no distinguia nada. El invariante real es un `clauses` **falsy pero presente**
   (`null`). Ver «LO QUE ESTA SPEC TERMINO ENCONTRANDO» arriba. El contrato declara que
   `clauses: []` **no** es lo mismo que omitir `clauses` (el primero da 422, el segundo trae las
   semillas del pais). Hoy lo sostiene **un solo caracter**: `if (partial.clauses !== undefined)`
   en `programInput`. Cambiarlo a truthy (`if (partial.clauses)`) rompe la afirmacion y **ningun
   test del repo se pondria rojo**. El revisor lo verifico por sonda ejecutada. **Arreglo: un
   test de 6 lineas en `program-defaults.test.ts`.**
2. **✅ LO CIERRA LA 0080 — (bajo) Un docblock que sobre-afirma.** El caso dado vuelta en `onboarding-grant.neon` se
   titula «es lo UNICO que el permiso habilita» pero mide una **creacion**, y
   `programEditDenied` hace `if (!input.isEdit) return null;`: ese 201 sale **igual sin permiso**.
   No hay riesgo de produccion — el control positivo real (editar con permiso → 200) existe y
   esta verde en `onboarding-program-bypass.neon`. **Arreglo: renombrar el caso.**
3. **⚠️ SIGUE ABIERTO, ES DECISION DEL OWNER — (bajo, costo) No son 2 lecturas por `PUT`: son 5 round-trips antes de escribir.** El
   implementador declaro 2 (`getSession` ×2); el revisor midio ademas `ownerContext` ×1,
   `ownerBusiness` ×1 (en el compositor, **solo con cuerpo corto** — justo el del alta) y
   `programForOwner`→`ownerBusiness` ×1. Antes de la 0079 cada puerta hacia 3. **No hay
   `cookieCache` configurado** en ningun lado (verificado con `rg`). Es costo, no correccion:
   **decision del owner**, y la alternativa toca `api-owner.ts`, que la 0075 pidio dejar intacto.

**Y UN HALLAZGO PREEXISTENTE que el revisor midio de paso, NO introducido por la 0079:** el guard
y el writer pueden resolver negocios **DISTINTOS**. `ownerContext` (`server/staff.ts`) filtra
`role='owner' AND memberships.status='active'` y ordena **`asc(createdAt)`**; `ownerBusiness`
(`loyalty-program/owner.ts`) filtra **solo** `role='owner'` y ordena **`desc(createdAt)`**. Con
2+ negocios por owner, el guard evalua el mas viejo y `saveProgram` escribe en el mas nuevo. La
0072 §D3 ya lo declara abierto y el `PUT` lo arrastraba antes de esta spec. **Declarado y no
perseguido** (cuesta un seed nuevo, fuera de presupuesto); la receta para reproducirlo esta en
el handoff del revisor.

## ⇥ ENTREGA DEL IMPLEMENTADOR — spec 0079 (2026-09-19)

**Estado: implementado, SIN commitear y SIN marcar la spec.** Falta el PASS del revisor
independiente (ADR 0071). Arbol limpio de mutaciones (`no-mutations-left.sh` EXIT=0).

**Los SEIS gates, con `set -a; . ./.env.integration.local; set +a`:**
`typecheck` · `lint` · `format:check` · `build` · `test` · **`test:e2e`**.

| Gate | Resultado |
|---|---|
| `typecheck` · `lint` · `format:check` · `build` | **verdes**. Al borrar la ruta hizo falta `rm -f apps/merchant/.next/types/validator.ts` (tipo GENERADO viejo, el gotcha de la spec §5) |
| `test` con Neon | **220 archivos / 1726 tests, 1 failed, 0 skipped**. El unico failed es el **flake AJENO** `consumer-recovery.neon.integration.test.ts:367` (`expected 'accepted' to be 'failed'`) — el mismo `.at(-1)` sin `ORDER BY` ya documentado. **Corrido solo: 8/8 VERDE** |
| **`test:e2e`** | **1 failed, 1 skipped, 4 passed**, y el failed es el rojo **PREEXISTENTE**. Ver abajo |

**LA EVIDENCIA QUE SEPARA EL ROJO DE e2e, medida DOS veces:** antes de tocar nada, sobre el
arbol LIMPIO en `20531b2`, `pnpm test:e2e` ya daba **1 failed / 1 skipped / 4 passed** con
`tests/e2e/loyalty.spec.ts:27` en `locator.check` timeout de 30 s
(`<span class="loyalty-choice-content"> intercepts pointer events`). Con los cambios de la
0079 la corrida da **exactamente lo mismo**: mismo archivo, misma linea, mismo mecanismo,
mismos contadores. **No es «falla lo de siempre»: son dos corridas, una antes y una despues.**

**⚠️ DETALLE DEL ENTORNO, no del codigo:** habia un `next dev` **huerfano del 2026-09-18**
(PID 85329, `apps/merchant`) ocupando el puerto 3000, y con el vivo **`pnpm test:e2e` ni
arranca** (`Another next dev server is already running`, exit 1). Se lo detuvo para poder
correr el gate. Si el gate falla asi, no es la suite: es el puerto.

**DESVIOS DE LA TABLA «Archivos» — todos declarados, ninguno de producto. El revisor tiene
que mirarlos:**

1. **SEIS archivos de test mas que la tabla no lista.** Todos importaban
   `POST /api/onboarding/program`, que se borro, asi que el typecheck los obliga:
   `onboarding-program-bypass.neon`, `onboarding-grant-cortes.neon`, `onboarding-grant.neon`,
   `onboarding-program-terms.neon`, `onboarding-program-503`, y el soporte
   `onboarding-grant-support.ts`. **La tabla de la spec estaba incompleta** (mismo caso que la
   0078); el cambio es mecanico: misma puerta nueva, mismo cuerpo corto, mismos desenlaces.
2. **UN caso preexistente cambio de polaridad A PROPOSITO, y es el unico.**
   `onboarding-grant.neon` exigia «`PUT /api/loyalty-program` sigue dando **403** a un no
   verificado CON permiso». La 0079 §1 **le saca el paso 3 a esa puerta**, asi que ese 403 ya
   no corresponde. **No se borro: se dio vuelta con su motivo escrito** y pasa a ser el control
   POSITIVO del barrido de las 11 (crea con 201). Es el desvio que mas merece juicio.
3. **`api-owner-surfaces-support.ts` (nuevo).** La tabla de superficies se MOVIO ahi tal cual:
   con la fila 13 (el `PUT`), `api-owner-surfaces.test.ts` pasaba de 300 lineas y el hook
   `file-size` corta — «dividir, no extender». Hoy queda en **291**. Cero `expect` en el
   modulo movido: los oraculos y los dobles siguen en el test.
4. **`loyalty-program-ruta-unica.neon.integration.test.ts` (nuevo).** Los casos que la 0079
   AGREGA (Puntos, el 422 del dinero, `cashback`, el cuerpo completo de hoy, el cambio de
   modalidad, `business_suspended`). No entraban en `onboarding-program.neon`, que quedo en
   **293** lineas.
5. **`loyalty-program/validation.ts` NO se toco.** La tabla dice «editar — lo que el compositor
   necesite», y **el compositor no necesito nada**: delega en `validateProgramInput` tal como
   esta. Se deja sin tocar en vez de inventar un cambio; su `shasum` es el de HEAD.
6. **Cuatro comentarios corregidos en archivos fuera de la tabla, SOLO texto** — afirmaban que
   `POST /api/onboarding/program` existe, y despues de esta spec eso es FALSO en el arbol:
   `server/loyalty-program.ts`, `server/api-owner.ts`, `server/loyalty-program/core.ts` y
   `app/api/onboarding/state/route.ts`. Cero bytes de comportamiento.

**HALLAZGOS A DECIDIR (ninguno tocado):**

- **El `code` de «modalidad no disponible» es `invalid_program`**, igual que cualquier otro 422:
  quien quiera distinguir esa causa tiene que leer el `error`. Declarado en el contrato como
  limite de hoy; darle un `code` propio no estaba en el alcance.
- **`PUT` hace DOS lecturas de sesion por request.** `requireApiOwnerSinGateDeEmail` no
  devuelve la sesion y el writer necesita `emailVerified` + el permiso de alta, que viven en
  esa fila. La alternativa —que el guard la devuelva— toca `api-owner.ts`, que NO esta en la
  tabla y que la 0075 pidio dejar intacto. Medido: **no hay `cookieCache` configurado**, asi
  que es **una consulta mas por escritura de programa**. Se eligio el costo y no el cambio de
  alcance; si el owner prefiere lo otro, es una spec chica.

## ⇥ ✅ BITACORA DE MUTACIONES — spec 0079 (implementador, 2026-09-19) — CERRADA

**CERRADA: las 5 medidas y revertidas.** `diff` VACIO contra la copia limpia en los 3 archivos,
`shasum` identico, `grep -rn MUTATION apps/*/src tools` devuelve **cero lineas** y
`.claude/hooks/no-mutations-left.sh` sale **EXIT=0**. Restauracion de emergencia, por si acaso
(los 3 archivos estan SIN COMMITEAR: `git checkout` NO alcanza, se lleva el trabajo de la spec):

```
cp /tmp/limpios-0079/route.ts.6e1155            apps/merchant/src/app/api/loyalty-program/route.ts
cp /tmp/limpios-0079/program-defaults.ts.02b918 apps/merchant/src/server/onboarding/program-defaults.ts
cp /tmp/limpios-0079/validation.ts.2f34dd       apps/merchant/src/server/loyalty-program/validation.ts
```

| id | archivo | shasum LIMPIO | invariante que ataca | resultado EJECUTADO |
|---|---|---|---|---|
| M1 | `app/api/loyalty-program/route.ts` | `b3206dd6cb9157329c1a538e64329428583e9b00` | el guard sin paso 3: crear sin verificar tiene que dar 201 | **ROJO — 13 tests**. El de la spec: `onboarding-program-bypass.neon` «sin email verificado y SIN permiso, CREAR el primer programa sigue dando 201» (`expected 403 to be 201`). Tambien `api-owner-surfaces` las 2 filas del `PUT` sin gate, los 6 de `onboarding-grant-cortes.neon` y el de `onboarding-grant.neon`. Alcance corrido: esos 4 archivos, **13 failed / 108 passed** |
| M2 | `server/onboarding/program-defaults.ts` | `46812170425f18c52b865809a0375fd7c371d0db` | el servidor NO inventa el dinero de Puntos (`accrual`) | **ROJO — 2 tests**: `loyalty-program-ruta-unica.neon` «Puntos SIN `accrual` → 422 `invalid_program` y CERO filas» (`expected 201 to be 422`) y `program-defaults.test` «SIN `accrual` el compositor no lo inventa» (`expected { mode: 'per_amount', grant: 1, … } to be undefined`). Alcance: + `onboarding-program.neon`, verde |
| M3 | `server/onboarding/program-defaults.ts` | `46812170425f18c52b865809a0375fd7c371d0db` | un campo explicito nunca se pisa con su default | **ROJO — 2 tests**: `loyalty-program-ruta-unica.neon` «un cuerpo COMPLETO de hoy conserva cada campo que mando» (`expected 'per_purchase' to be 'per_amount'`) y `program-defaults.test` «respeta el `accrual` que vino en el cuerpo». Alcance: los mismos 3 archivos |
| M4 | `server/loyalty-program/validation.ts` | `b1933c0db4111d921aa5e3ceb88b8e4caa6273ea` | `cashback`/`tiers` NO estan habilitadas | **ROJO — 2 tests**: `loyalty-program-ruta-unica.neon` «`cashback` → 422 con el mensaje de modalidad no disponible» (`expected 201 to be 422`) y `program-defaults.test` «cashback → 422 «modalidad no disponible»» (`expected 'Define la mecánica de acumulación.' to be 'Esta modalidad todavía no está disponible.'`). **El segundo confirma por que el oraculo tiene que ser el MENSAJE**: el status habria seguido en 422. Alcance: + `loyalty-program.test`, verde |
| M5 | `app/api/loyalty-program/route.ts` | `b3206dd6cb9157329c1a538e64329428583e9b00` | el `error.code ??` gana sobre el mapeo por status | **ROJO — 2 tests**, los dos por `email_not_verified`: `onboarding-program-bypass.neon` «PUT #1 → 201; PUT #2 → 403 …» y `onboarding-grant-cortes.neon` «CORTE por vencimiento», los dos `expected 'not_owner' to be 'email_not_verified'`. **Y UN HALLAZGO: el oraculo que la spec le asigna —`business_suspended`— quedo VERDE, y es correcto que lo este.** Alcance corrido: + `loyalty-program-ruta-unica.neon`, `onboarding-program.neon`, `onboarding-program-503`, verdes |

**EL HALLAZGO DE M5, que es un error de la SPEC y no del codigo:** despues de la 0079 el eje
`status` lo corta el **paso 4 del guard** (`requireApiOwnerSinGateDeEmail` →
`apiOwnerFailureResponse`), que emite su `code` **sin pasar por `codeForStatus`**; el chequeo
gemelo de `saveProgram` ya no se alcanza por HTTP. El unico 403 que viaja como `LoyaltyError`
con `code` propio es `email_not_verified`, y **ese si tiene oraculo y muerde**. El motivo esta
escrito en el test de `loyalty-program-ruta-unica.neon` para que nadie lo vuelva a suponer.

## ⇥ ARRANCA ACA LA SESION QUE SIGUE (handoff del 2026-09-19)

**EL ORDEN ES: (1) la spec del TOS, (2) la 0079.** Lo pidio el owner textual: «cuando volvemos
arreglas el TOS y luego entramos en 0079».

### 1) LA SPEC DEL TOS — el owner YA dio las variables, NO se las vuelvas a preguntar

**Textual del owner (2026-09-19):** *«Tenemos que tener una semilla que es un texto y con
variables que se podran usar en el texto»*, y listo **ocho**:

| # | Variable que pidio | ¿Existe hoy? |
|---|---|---|
| 1 | Nombre de la empresa | ✅ `business_legal_name` |
| 2 | **Listado de nombre de locales** | ❌ hay tabla `locations`, **no se pasa** a `renderedTerms` |
| 3 | **Direccion de la empresa** | ❌ idem |
| 4 | Pais | ✅ `country_code` (allowlisted desde la 0078) |
| 5 | Tipo de programa (Sellos/Puntos) | ✅ `program_kind` |
| 6 | Nombre de los puntos | ✅ `program_unit_plural` + singular |
| 7 | **Cada cuanto dinero se otorga un sello** | ⚠️ **PROBLEMA DE DISEÑO, ver abajo** |
| 8 | **Cada cuanto dinero se entregan X puntos** | ❌ esta en `accrual` (`grant`/`blockAmount`), no se pasa |

**⚠️ LA #7 NO ES PLOMERIA, ES UNA DECISION QUE EL OWNER TODAVIA NO TOMO.** El wizard crea los
Sellos como **«un sello por compra»** —`accrual: { mode: "per_purchase", grant: 1, blockAmount:
null }` (`onboarding/program-defaults.ts`)—, asi que **no hay monto de dinero que poner**: la
variable quedaria vacia en todo programa nacido del wizard. Las dos salidas son: (a) el texto
legal omite esa variable para Sellos, o (b) el wizard pasa a preguntar un monto, **que es cambiar
la pantalla 3 del ADR 0070 §1**. **PREGUNTARSELO ANTES de escribir la spec** (ADR 0071: las
decisiones del owner se piden ANTES de la prosa).

**Y LO QUE LA SPEC DEL TOS RESUELVE DE PASO — el hallazgo abierto de la 0078:** hoy hay TRES
copias de cada clausula (`global-draft` vieja + `default` + `EC`), `GET /api/loyalty-terms/
templates` devuelve las **6 sin `jurisdictionScope`** y `renderedTerms` acepta **cualquier**
`templateId` `published` sin validar scope. **La respuesta del owner lo simplifica:** si hay una
semilla buena por pais, **`global-draft` se ARCHIVA** y deja de ofrecerse. Eso elimina el problema
en vez de parchearlo, y es mas barato que la validacion de scope en el writer que se habia
propuesto. **Ojo al archivar:** `renderedTerms` necesita la plantilla al RE-guardar un programa
que la referencie; `terms_markdown` ya esta renderizado y no se toca, pero un `PUT` sobre un
programa viejo que apunte a `global-draft` daria 422. Medir cuantos hay antes (en integracion; en
prod habia 0 negocios al 2026-09-18, **re-medir**).

### 2) DESPUES, LA SPEC 0079 — ya esta escrita y `cerrada`

`docs/specs/0079-una-sola-ruta-de-escritura-del-programa.md`. **No hay que escribirla, hay que
despacharla.** Funde las dos puertas de escritura en una (`PUT /api/loyalty-program`, borra
`POST /api/onboarding/program`) y hace que acepte `kind`. **Es la UNICA de las tres que lleva
`pnpm test:e2e`** porque toca `onboarding-api.ts`.

**⚠️ AL CORRER e2e: `main` arrastra un rojo PREEXISTENTE y AJENO** en
`tests/e2e/loyalty.spec.ts:27` (UI vieja de `/backoffice/demo`, anterior a estos 3 commits).
**Hay que separarlo con evidencia de una regresion propia**, no declarar «falla lo de siempre».

### ESTADO REAL, verificado al cierre

| Que | Donde esta |
|---|---|
| HEAD local | **`6879af6`**, arbol **LIMPIO** |
| `origin/main` | **`bb511df`** — **3 commits SIN PUSHEAR**: `53bcf88`, `8a01c62`, `6879af6`. El owner no pidio push |
| Specs del arco | **0067, 0068, 0069, 0072, 0074, 0075, 0077 y 0078 `implementadas`**. Las 6 ultimas con PASS de revisor independiente |
| Suite con Neon | **219 archivos / 1715 tests, 0 failed, 0 skipped** — corrido por el orquestador sobre `6879af6` |
| `typecheck` · `lint` · `format:check` · `build` | los cuatro verdes sobre `6879af6` |
| `pnpm test:e2e` | **NO corrido** (0077 y 0078 no tocan `.tsx`). **La 0079 SI lo lleva** |
| CI de `main` remoto | **ROJO heredado** por e2e, anterior a estos commits |
| Vercel / prod | **medido el 2026-09-18, NO re-verificado**: deploy `78d1f3a`, 0 negocios. **Re-medir antes de decidir con eso** |
| **QA del owner** | **todavia NO corresponde**: falta la 0079 (y ahora la spec del TOS). El owner pidio **un solo QA al final** |

### FLAKE AJENO, con el mecanismo CORREGIDO

`consumer-recovery.neon.integration.test.ts` falla de manera intermitente. **NO es la colision de
`phone_e164` UNIQUE** que decian los handoffs viejos —eso es FALSO y se propago sin medir—. El
mecanismo real, leido en el archivo: **lineas 363-367 hacen `select … where(phoneE164)` SIN
`ORDER BY` y leen `.at(-1)`**, y el orden de filas en Postgres es indefinido; ademas `phones[4]`
se usa en **dos** tests (lineas 269 y 350). Demostrado con tres corridas del mismo archivo sobre
el mismo codigo: pasa, pasa, falla. **Es ajeno a este arco y no se arregla en estas specs.**

## ⇥ ENTREGA DEL IMPLEMENTADOR — spec 0077 (2026-09-18)

**Estado: implementado, SIN commitear y SIN marcar la spec.** Falta el PASS del revisor
independiente (ADR 0071). Arbol limpio de mutaciones (hook `no-mutations-left.sh` sale 0).

**Gates, los cinco, con `set -a; . ./.env.integration.local; set +a` y la migracion aplicada:**
`typecheck` · `lint` · `format:check` · `build` · `test` → **215 archivos / 1681 tests, 0 failed,
0 skipped** (193 archivos Neon en la corrida). `pnpm test:e2e` **NO aplica y no se corrio**: la
spec no toca ni un `.tsx` (`git status --short | grep -c '.tsx$'` → **0**).

**La migracion `0037_onboarding_grant.sql` YA ESTA APLICADA a la rama de integracion** (no a
prod). Verificado por SQL: `onboarding_grant_until` existe, `timestamp with time zone`,
`is_nullable = YES`.

**TRES desvios de la tabla «Archivos» de la spec, todos forzados y ninguno de comportamiento**
— el revisor tiene que mirarlos:

1. **`loyalty-program/owner.ts` (nuevo).** `ownerBusiness` y `programForOwner` se MOVIERON ahi
   (movimiento literal, re-exportado desde el barrel). Motivo: con el invariante adentro,
   `loyalty-program.ts` daba **317 lineas** y el hook `file-size` corta en 300 — «dividir, no
   extender». Hoy queda en **265**.
2. **El bypass vive en `onboarding-program-bypass.neon.integration.test.ts` (nuevo), no dentro de
   `onboarding-program.neon.integration.test.ts`** como decia la tabla: ese archivo esta en 279
   lineas y no admite un `describe` mas. Se lo dejo **intacto** (`git checkout`, sin diff).
   Igual motivo para partir la integracion del permiso en dos (`onboarding-grant.neon` +
   `onboarding-grant-cortes.neon`) con su soporte `onboarding-grant-support.ts`.
3. **7 archivos de test de integracion mas**, que la tabla no lista: el 3er argumento de
   `saveProgram` es **obligatorio por diseño de la spec**, asi que el typecheck obliga a los 18
   llamadores existentes a declararse. El cambio es mecanico y **preserva la semantica anterior**
   (`{ emailVerified: true, onboardingGrantActive: false }`).

## ⇥ BITACORA DE MUTACIONES — spec 0077 (implementador, 2026-09-18)

**CERRADA: las 6 medidas y revertidas (5 de la spec + la M6 del hallazgo 1 del revisor), `diff` vacio contra la copia limpia y `shasum` identico
en los 4 archivos. `grep -rn MUTATION apps/*/src tools` devuelve 0 lineas y
`.claude/hooks/no-mutations-left.sh` sale 0.** Restauracion de emergencia, por si acaso:

```
cp /tmp/mut-onboarding-grant.ts apps/merchant/src/server/onboarding-grant.ts
cp /tmp/mut-auth.ts             apps/merchant/src/server/auth.ts
cp /tmp/mut-route.ts            apps/merchant/src/app/api/merchant/auth/staff/route.ts
cp /tmp/mut-loyalty-program.ts  apps/merchant/src/server/loyalty-program.ts
```

| id | archivo | shasum LIMPIO | invariante que ataca | resultado |
|---|---|---|---|---|
| M1 | `apps/merchant/src/server/onboarding-grant.ts` | `0d9049f629ce0f6dee25610642f4d9da8c67ec5c` | el permiso VENCIDO no corre (corte de 60 min) | **ROJO** — `onboarding-grant.test.ts` «CORTE 2/3 — el instante ya venció» y «el borde exacto NO corre» (`expected true to be false`) + `onboarding-grant-cortes.neon` «CORTE por vencimiento» (`expected 200 to be 403`). Alcance corrido: los dos archivos. |
| M2 | `apps/merchant/src/server/auth.ts` | `a2481d49f26901b0dd6151c8c3ee89b6ca68cdc2` | `input: false` — el campo no es seteable desde la API | **ROJO** — `onboarding-grant.test.ts` «un cuerpo que TRAE `onboardingGrantUntil` es rechazado por el parser» (`expected [Function] to throw an error`). Los otros 17 del archivo siguen verdes: el oraculo discrimina. |
| M3 | `apps/merchant/src/app/api/merchant/auth/staff/route.ts` | `f9a626c37ad995b0dce9f7d3f0104845ffee4fb2` | la puerta del staff NUNCA recibe el permiso | **ROJO** — `onboarding-grant.neon` «`auth/staff` (login por PIN) NUNCA lo recibe: la columna queda NULL» (`expected 2026-09-19T00:33:41.972Z to be null`). Alcance: se corrio tambien `staff-pin.neon` entero, **8/8 verde** — ninguna otra cosa del staff lo ve. |
| M4 | `apps/merchant/src/server/loyalty-program.ts` | `e628dcbc2d8182e9fd2693bb6fede6bd8aa8f2f7` | crear ≠ editar (el bypass) | **ROJO** — `onboarding-program-bypass.neon` «POST #1 → 201; POST #2 → 403 … y la fila NO se reescribe» y `onboarding-grant-cortes.neon` «CORTE por vencimiento» (los dos `expected 200 to be 403`). `onboarding-grant.test.ts` queda VERDE **a proposito**: la mutacion esta en el CABLEADO, no en la decision pura — y eso prueba que el cableado tiene oraculo propio. |
| M5 | `apps/merchant/src/server/onboarding-grant.ts` | `0d9049f629ce0f6dee25610642f4d9da8c67ec5c` | monotonia: el acortado usa `least(...)`, no asignacion | **ROJO** — `onboarding-grant-cortes.neon` «MONOTONÍA: con 2 minutos restantes, completar el alta NO los estira a 5» (`expected 2026-09-18T23:39:52.916Z to deeply equal 2026-09-18T23:36:51.405Z`: la ventana se estiro ~3 min). Los otros 6 del archivo + el bypass + la unitaria, verdes. |
| M6 | `apps/merchant/src/server/onboarding-grant.ts` | `0d9049f629ce0f6dee25610642f4d9da8c67ec5c` | el `isNotNull` del `WHERE` del acortado (hallazgo 1 del revisor: `least` IGNORA nulos) | **ROJO** — `onboarding-grant-cortes.neon` «el acortado NO le regala permiso a una sesión del MISMO usuario que lo tenía NULL» (`AssertionError: expected [] to have a length of 1 but got +0`: la fila NULL dejo de ser NULL). Alcance: los 4 archivos de la spec, **44/45**, o sea que ese caso es el UNICO que lo pinnea. Revertida, `diff` vacio, shasum OK. |


## ⇥ ✅ EL OWNER YA RESPONDIO LO DEL TOS (2026-09-19) — ver «ARRANCA ACA»

**No es una decision pendiente: el owner la contesto y la respuesta esta arriba, en «ARRANCA
ACA» §1**, con sus ocho variables textuales y el analisis de cuales existen. Su respuesta
**simplifica** el arreglo: en vez de validar el scope en el writer, **se archiva `global-draft`**
para que deje de ofrecerse. **Lo unico que queda abierto es la variable #7** (el monto de dinero
por sello, que el wizard no pregunta).

El bloque de abajo se conserva porque tiene las **tres evidencias reproducidas** del problema.

## ⇥ (evidencia) EL TOS DEPRECADO ES ALCANZABLE — reproducido (2026-09-19)

**NO es una decision tomada. Es un hallazgo del revisor de la 0078, subido al owner sin resolver.**
**Reproducido por el orquestador con tres evidencias independientes:**

1. **`renderedTerms` acepta CUALQUIER `templateId` que este `published`** — `terms.ts:26-31` filtra
   por `eq(status,'published')` e `inArray(id, ids)`, **sin scope y sin pertenencia**.
2. **`GET /api/loyalty-terms/templates` no devuelve `jurisdictionScope`** — el DTO
   (`templates/route.ts:19-27`) es `id, title, category, templateMarkdown, version`. Devuelve **6**
   plantillas con titulos repetidos («Cómo se acumula» ×3) y **quien haga el panel no tiene forma
   de distinguirlas** salvo comparando strings de markdown.
3. **Una de esas tres es la que escribe «Los sello se acumulan…»** — el test nuevo del
   implementador lo asevera (`loyalty-terms-render.neon…:98`).

**Consecuencia:** un panel construido sobre ese contrato puede escribir el texto legal **viejo y
mal redactado** en el TOS de un comercio EC. No es cosmetico: es un camino directo al texto
deprecado, y el TOS es lo que ve el consumidor.

**LAS DOS MITADES DEL ARREGLO, y solo la segunda cierra el agujero:**

| | Que | Efecto |
|---|---|---|
| a | Filtrar la ruta por `termsScopeCandidates(business.countryCode)` y exponer el scope en el DTO | **cosmetica**: deja de ofrecer las tres copias |
| b | **Validar en `renderedTerms` que el `templateId` pertenezca a un scope candidato del negocio** | **cierra el agujero de verdad** |

**POR QUE NO SE APLICO:** la ruta no esta en la tabla «Archivos» de la 0078, su alcance excluye
pantallas, y **(b) cambia el comportamiento de `PUT /api/loyalty-program`** — podria romper el
flujo de TOS personalizado que el owner pidio para el panel. **Es decision suya.**

**PREGUNTA CONCRETA AL OWNER:** ¿se valida el scope del `templateId` en el writer (arreglo b), o se
deja que el panel pueda elegir cualquier plantilla publicada? Si se valida, es una spec chica
aparte, **no entra en la 0078**.

## ⇥ ✅ 0078 IMPLEMENTADA — EL TOS ES POR PAIS (2026-09-19)

**`estado: implementada`**, con PASS de revisor independiente y sus 2 hallazgos cerrados.
**Reproducido por el orquestador:** los cinco gates verdes, **219 archivos / 1715 tests con Neon,
0 failed, 0 skipped**, `no-mutations-left.sh` EXIT=0, cero `.tsx`. Y el oraculo nuevo **MUERDE**:
con el cuerpo ganando sobre la sesion, el caso «el `countryCode` del CUERPO no mueve el scope»
se pone rojo con el deep-equal de `templateId`; revertido con `diff` vacio y shasum
`d82498be…` identico.

**Lo que el revisor resolvio de los 7 puntos que se le exigieron:**
- **El `0038_snapshot.json` hecho A MANO es CORRECTO:** comparo los dos JSON campo por campo — las
  unicas claves que difieren son `id` y `prevId`, y `prevId(0038) === id(0037)`. La prueba fuerte
  no es la comparacion sino que **`drizzle-kit generate` leyo ese snapshot como estado previo,
  diffeo contra el esquema y dijo «No schema changes» sin escribir nada**.
- **Los 4 desvios de la tabla «Archivos»: ninguno es alcance ampliado.** La linea de produccion en
  `program/route.ts` es **necesaria y minima** — sin el `userId` no compila. **La tabla «Archivos»
  de la spec estaba incompleta; el implementador no se fue de alcance.** (Otro error de spec mio.)
- **Tests preexistentes NO debilitados:** las 5 lineas con `expect` que el diff borra son las mismas
  aserciones reescritas **con una clave MAS** (`unitPlural`). Como `toEqual` es exacto, quedaron
  **mas estrictas**, y la mutacion MR3 lo demuestra.

**LOS 2 HALLAZGOS EN CIERRE** (el implementador fue reanudado por `SendMessage`):

| # | Que | Estado |
|---|---|---|
| 2 | **«El pais no puede venir del cuerpo» no tiene ORACULO.** MR4 lo rompio y **65/65 quedaron verdes**; con una sonda el revisor probo que un negocio MX mandando `countryCode:"EC"` en el cuerpo recibe los ids de EC. El codigo es correcto; el contrato §4 promete algo que ningun test sostiene | en cierre |
| 3 | **El 503 quedo sin la mitad barata de su oraculo.** El limite declarado era correcto en su nucleo —y el revisor le dio un motivo MAS FUERTE: `termsScopeCandidates` **siempre** appendea `default`, asi que el 503 es inalcanzable **por construccion**, no por el paralelismo— pero la mitad de CONTRATO se cerraba con `vi.mock` en 4 ms y 45 lineas | en cierre |

## ⇥ 0078 — IMPLEMENTADA POR EL AGENTE, EN REVISION (2026-09-18)

**Revisor independiente DESPACHADO.** La spec NO esta marcada `implementada`.

**REPRODUCIDO POR EL ORQUESTADOR** (no es el auto-reporte del implementador):

| Que | Resultado |
|---|---|
| Los cinco gates con env Neon | **verdes** — **218 archivos / 1712 tests, 0 failed, 0 skipped** |
| `no-mutations-left.sh` · `.tsx` tocados | **EXIT=0** · **cero** |
| `drizzle-kit check` | «Everything's fine» — importa porque el **`0038_snapshot.json` se hizo A MANO** |
| Semillas en la base | **7 filas**: `EC`×2 + `default`×2 + `global-draft`×3 (1 `archived`) |

**DOS HALLAZGOS DEL IMPLEMENTADOR, los dos CONFIRMADOS por el orquestador y NINGUNO tocado:**

1. **`GET /api/loyalty-terms/templates` NO filtra por scope** (`route.ts:26-27`: solo
   `eq(status,'published')`). Desde la `0038` devuelve **6** plantillas con titulos repetidos
   («Cómo se acumula» ×3). Si la pantalla avanzada del panel consume esa lista, le ofrece al
   comerciante tres copias de cada una. **Es un hallazgo a decidir del owner**, no una decision
   tomada: la spec 0078 no lo incluia en su alcance.
2. **Una clausula con `templateId` Y `text` usa el allowlist de la PLANTILLA**, asi que un TOS
   personalizado que conserve el `templateId` **si** puede usar variables — al reves de lo que el
   contrato declara para el texto libre puro. Documentado como mecanismo.

**⚠️ UN ERROR MIO, CORREGIDO POR EL IMPLEMENTADOR — Y ES LA REGLA DE `CLAUDE.md` QUE VIOLE:**
en el encargo le afirme que el flake de `consumer-recovery.neon` era una **colision de
`phone_e164` UNIQUE** sembrado con `Math.random()`. **ERA FALSO.** Lo copie de un handoff viejo
**sin re-medirlo**. El mecanismo real, que el implementador midio y el orquestador confirmo
leyendo el archivo: `consumer-recovery.neon.integration.test.ts:363-367` hace
`select … where(phoneE164)` **SIN `ORDER BY`** y lee `.at(-1)`, y el orden de filas en Postgres es
**indefinido**; ademas `phones[4]` se usa en **dos** tests (lineas 269 y 350). Demostrado con tres
corridas del mismo archivo: pasa, pasa, falla.

**La regla que viole esta escrita en `CLAUDE.md`:** *«lo que le pasas a un subagente como insumo
es una afirmacion tuya — re-medí el doc antes de despacharlo»*. Un insumo falso en un encargo es
peor que no darlo: manda al agente a buscar el bug donde no esta. **Al revisor de la 0078 ya se le
paso la correccion.** Y el flake sigue AJENO y sin arreglar (no es de este arco).

## ⇥ ✅ 0077 IMPLEMENTADA — EL BYPASS ESTA CERRADO (2026-09-18)

**`estado: implementada`**, con PASS de revisor independiente y los 3 hallazgos cerrados.
**Todo reproducido por el orquestador, nada aceptado por auto-reporte:**

| Chequeo | Resultado |
|---|---|
| `typecheck` · `lint` · `format:check` · `build` · `test` | **los cinco VERDES** |
| Suite con Neon | **215 archivos / 1682 tests, 0 failed, 0 skipped** |
| **El oraculo nuevo MUERDE** | misma mutacion que antes dejaba **44/44 verdes** → ahora **1 failed**, `expected [] to have a length of 1 but got +0` (la fila NULL dejo de ser NULL). Revertida con `diff` vacio y shasum `0d9049f6…` identico |
| `no-mutations-left.sh` | **EXIT=0** |
| `api-owner.ts` | **byte por byte igual** a HEAD (`fe5d3c02…`) |

**Lo que este trabajo cierra, en una linea:** una sesion con `emailVerified:false` ya **no** puede
reescribir el programa por la puerta del wizard. Crear sigue permitido; **editar** exige email
verificado **o** el permiso de alta vigente, y la regla vive en el **writer**, no en la puerta.

**La 0078 ya puede arrancar** (el journal de migraciones quedo libre: la 0037 es la de esta spec).

## ⇥ 📌 LECCION CANDIDATA — LA SPEC MAL ESPECIFICADA HACE MENTIR AL IMPLEMENTADOR (2026-09-18)

**Tres de los errores encontrados en la 0077 estaban en la SPEC, no en el codigo:**

1. Un oraculo que pedia **403** donde la propia regla de la spec implica **200**.
2. Una causa **FALSA** sobre `overrideAll` —«`defaultAdditionalFields` lo pisa»— que el
   implementador **copio literalmente al docblock del codigo**. Quedaba en el arbol como
   conocimiento verificado, y era invento del orquestador.
3. Un tercer docblock inducido por lo mismo: el test decia pinnear el `isNotNull` y pinneaba otra
   linea.

**La regla que falta y que esto sugiere:** `CLAUDE.md` ya dice que una afirmacion de imposibilidad
o de costo se verifica intentandola. **Falta su hermana: una afirmacion de MECANISMO que la spec
presenta como «medido» tiene que estar medida hasta el final.** Leer `internal-adapter.mjs:204` y
ver `...defaultAdditionalFields` **NO es medir**: habia que abrir `getSessionDefaultFields` y ver
que solo emite campos con `defaultValue`. Media medicion presentada como medicion completa es
peor que no medir, porque **el implementador obedece y la propaga al codigo**.

Sumar a `docs/LECCIONES.md` con los tres casos (0074, 0075, 0077).

## ⇥ 0077 — PASS DEL REVISOR, CON 3 HALLAZGOS EN CIERRE (2026-09-18)

**Veredicto del revisor independiente: `PASS`**, 5 mutaciones propias, los cinco gates corridos
por el **215 archivos / 1681 tests, 0 failed, 0 skipped**. Los 11 items del DoD verificados uno
por uno con evidencia propia. **La spec NO esta marcada `implementada` todavia**: hay 3 hallazgos
en cierre (abajo).

**LOS 7 PUNTOS QUE SE LE EXIGIERON, resueltos:**
- **`loyalty-program/owner.ts` es movimiento LITERAL** — el revisor extrajo el bloque de
  `git show HEAD:` y lo diffeo contra el archivo nuevo: **identico**. Y la particion era
  obligatoria: HEAD estaba en **295** lineas, el bloque son **52**, sin partir daria **315 > 300**.
- **Los 4 archivos de test fuera de la tabla:** particion por tamaño, medida. Cero comportamiento
  de produccion agregado.
- **El punto 4 (el que podia ser FAIL) queda ACEPTADO, y con evidencia fuerte:** el revisor cableo
  el permiso DENTRO de `requireApiOwner` (su mutacion R5) y **las 11 superficies se pusieron rojas**
  con sesiones reales. El barrido del implementador usa sesiones reales contra los `route.ts` de
  verdad, mientras `api-owner-surfaces.test.ts` corre sobre dobles: **cubrio mas, no menos**.

**LOS 3 HALLAZGOS, y los DOS de los tres son errores MIOS en la spec, no del implementador:**

| # | Que | De quien | Reproducido por el orquestador |
|---|---|---|---|
| **1** | **El `isNotNull` de `shortenOnboardingGrant` NO tiene oraculo** | hueco de test | **SI**: borrado el `isNotNull`, los 4 archivos dan **44/44 VERDES**. Y la preimagen es real: `select least(null::timestamptz, now() + interval '5 minutes')` contra Neon devuelve **la fecha, NO NULL** — `least` ignora nulos, asi que completar un alta le **regala 5 min de permiso a una sesion que nunca lo tuvo** |
| **2** | El docblock de `openMerchantSession` afirma una causa **FALSA** sobre `overrideAll` | **ERROR DEL ORQUESTADOR** — lo decia la spec §3 y el implementador lo copio | **SI**: `getSessionDefaultFields` (`better-auth/dist/db/schema.mjs:141-146`) solo emite campos **con `defaultValue`**; el nuestro no tiene. `overrideAll: true` es **redundante**, no necesario. **Spec ya corregida** |
| **3** | Dos comentarios desactualizados en el test de cortes | cosmetico | — |

**El codigo de produccion es CORRECTO en los tres.** El `isNotNull` **esta puesto**; lo que falta
es el test que lo pinnee.

**⚠️ PATRON QUE YA NO ES CASUALIDAD: 2 de los 3 hallazgos son errores de la SPEC, no del codigo**
—y antes, el oraculo del corte por email tambien lo era—. **Tres errores de spec en una sola spec**,
mas los de la 0074 y la 0075. La subespecificacion no es el unico riesgo: **la spec MAL
especificada —que afirma como medido algo que no se midio— hace que el implementador escriba
docblocks falsos con total obediencia.** Candidato a leccion en `LECCIONES.md`.

**EN CURSO:** el **implementador fue reanudado por `SendMessage`** (no relanzado) con los 3
hallazgos para cerrar. El oraculo nuevo del punto 1 **tiene que morder** la mutacion del
`isNotNull`, y eso lo verifica el orquestador, no el implementador.

**SIGUE SIN COMMITEAR.** Punto limpio de retorno: **`53bcf88`**.

## ⇥ 0077 — IMPLEMENTADA POR EL AGENTE, EN REVISION (2026-09-18)

**El implementador entrego su handoff. La spec NO esta marcada `implementada`: falta el PASS.**
**Revisor independiente DESPACHADO** (turno aparte, como exige el ADR 0071).

**⚠️ EL REVISOR SE CORTO A MITAD Y SE RETOMO** (2026-09-18). Su proceso murio sin entregar
handoff; el transcript quedo guardado y se reanudo por `SendMessage` en vez de relanzarlo desde
cero. **Antes de reanudarlo se midio el arbol** (regla de `CLAUDE.md` para mutaciones heredadas):

- `grep -rn MUTATION apps/merchant/src tools` → **cero lineas**.
- Los 4 archivos con copia limpia en `/tmp/mut-*` (del IMPLEMENTADOR, 18:32) son **identicos** a
  los del arbol: `server/auth.ts`, `server/loyalty-program.ts`, `server/onboarding-grant.ts`,
  `app/api/merchant/auth/staff/route.ts`. O sea: **el arbol esta en el estado que entrego el
  implementador**, no a mitad de una mutacion del revisor.

**Si el revisor vuelve a morir:** medir igual antes de tocar, y reanudar por `SendMessage`
—no relanzar— mientras el transcript exista.

**⚠️⚠️ Y EL CASO QUE SIGUE, QUE ES LA TRAMPA DE VERDAD (2026-09-18):** despues de reanudarlo, el
hook `no-mutations-left.sh` corto el turno denunciando
`app/api/onboarding/program/route.ts:60: // MUTATION R1`, y `verify.sh` marco lint en rojo por el
import que esa mutacion deja sin usar.

**NO SE REVIRTIO, Y ESO FUE LO CORRECTO.** `ListAgents` mostro al **revisor `running`**: esa
mutacion es **suya y esta EN CURSO DE MEDICION**. Revertirsela mientras mide le hace ver **verde
donde espera rojo** → concluye que el oraculo no muerde → su veredicto queda **invertido y sin
valor**, y encima parece una revision hecha.

**LA REGLA, que ya estaba en `CLAUDE.md` y ahora tiene su caso:** ante una mutacion heredada,
`ListAgents` **PRIMERO**. Si hay un agente vivo, la mutacion **no es basura abandonada: es
instrumental**. Se espera. Solo se revierte si **nadie** esta midiendo, y aun asi midiendo antes.

**El hook no se equivoco** — no puede distinguir «mutacion olvidada» de «mutacion en vuelo», y su
default (denunciar) es el correcto. El que distingue es el orquestador, con `ListAgents`.

**DESENLACE, verificado por el orquestador:** el revisor revirtio R1 solo a los **60s** y siguio
con su serie (se lo vio pasar por R4 en `server/merchant-session.ts`). Estado medido al cierre de
este turno, con la serie ya terminada:

| Chequeo | Resultado |
|---|---|
| `grep -rn MUTATION apps/merchant/src tools` | **vacio en DOS chequeos separados 45s** (el doble chequeo evita cortar justo entre dos mutaciones) |
| `.claude/hooks/no-mutations-left.sh` | **EXIT=0** |
| `typecheck` · `lint` · `format:check` | **los tres verdes** |
| `app/api/merchant/auth/staff/route.ts` vs `/tmp/mut-route.ts` | **identico** |

**El revisor SIGUE `running` y todavia NO entrego handoff. No hay veredicto.** Nada de la 0077
esta marcado `implementada` y nada esta commiteado. Punto limpio de retorno: **`53bcf88`**.

**Metodo reutilizable para esperar a un agente que muta** (evita pelear con el hook una vez por
mutacion): esperar a que `grep MUTATION` de **vacio dos veces seguidas** con ~45s de separacion,
en vez de una sola. Una sola lectura vacia puede caer en la ventana entre revertir R_n y aplicar
R_n+1, y hace creer que termino cuando recien va por la mitad.

**LO QUE EL ORQUESTADOR REPRODUJO POR SU CUENTA** (no es el auto-reporte del implementador):

| Que | Resultado |
|---|---|
| **El bypass cerrado** | `onboarding-program-bypass.neon` + `onboarding-grant.test.ts` → **22/22**. POST#1 201, POST#2 **403** y **la fila NO se reescribe** |
| `requireApiOwner` intacto | `shasum` = `fe5d3c02cee6a59ea3576db41804a525a393ecd0`, **identico** a `git show HEAD:` |
| `SinGateDeEmail` | **una sola** ruta (la del QR) |
| `MUTATION` sueltas | **cero** |
| `.tsx` tocados | **cero** |
| Particion por tamaño | `loyalty-program.ts` **265** lineas (venia de 317, limite 300), `owner.ts` 66, `onboarding-grant.ts` 111 |
| `onboarding-program.neon.integration.test.ts` | **sin diff** — no se toco ningun test preexistente de esa ruta |

**⚠️ UN ERROR DE LA SPEC, NO DEL CODIGO — y lo cazo el implementador:** el plan de pruebas de la
0077 pedia «se verifica el email → la edicion pasa a **403**», **incoherente con su propio §5**
(`emailVerified || onboardingGrantActive`: verificar el email **abre** la edicion). Reproducido
contra Neon: da **200**. **La spec ya esta corregida**, con la nota de por que. Es la tercera vez
en el arco que el error esta en la spec y no en el codigo (0074, 0075, ahora 0077).

**LOS 7 PUNTOS QUE EL REVISOR TIENE QUE JUZGAR** (todos declarados por el implementador, ninguno
aceptado todavia): (1) el bypass con asercion por SQL; (2) `loyalty-program/owner.ts` fuera de la
tabla de Archivos — ¿particion literal o logica nueva?; (3) cuatro archivos de test fuera de la
tabla; (4) **NO toco `api-owner-surfaces.test.ts`** aunque el plan lo pedia, y argumenta que lo
cubrio mejor con sesiones reales — **hay que juzgarlo, no aceptarlo**; (5) `overrideAll: true`
seria redundante; (6) el hook `file-size` en los 21 archivos; (7) un flake ajeno en
`consumer-recovery.neon:367`.

**SIGUE SIN COMMITEAR.** Punto limpio de retorno: **`53bcf88`**.

## ⇥ ⚠️ SI ENCONTRAS EL ARBOL EN ROJO: HAY UN IMPLEMENTADOR EN VUELO (2026-09-18)

> **RESUELTO (2026-09-18, mismo dia): el implementador de la 0077 entrego y el arbol quedo
> VERDE** — los llamadores de `saveProgram` ya declaran su tercer argumento. Los cinco gates
> corridos con el env de integracion: **215 archivos / 1681 tests, 0 failed, 0 skipped**. Lo de
> abajo queda como registro del corte, no como estado.

**NO lo "arregles" a mano sin leer esto.** El Stop hook `verify.sh` corto el turno con typecheck y
lint en ROJO, y **el rojo NO es una regresion: es trabajo a medio camino de un subagente vivo.**

`ListAgents` al momento del corte: **`implementador` de la spec 0077, `running`**, 6 minutos.

**Que es el rojo, exactamente:** el implementador aplico el §5 de la 0077 —`saveProgram` pasa a
recibir un **tercer argumento obligatorio** (`caller: {emailVerified, onboardingGrantActive}`)— y
todavia no actualizo los llamadores. De ahi los ~20 `TS2554: Expected 3 arguments, but got 2` en
las dos rutas y en 8 archivos de test de integracion, mas dos `no-unused-vars` en
`loyalty-program.ts` de un import a medio mover.

**El tercer argumento OBLIGATORIO es deliberado, no un descuido**: la spec lo pide asi para que el
typecheck **obligue a cada puerta presente y futura** a declarar con que autorizacion escribe. Que
el compilador liste los llamadores es la señal de que el diseño funciona.

**ESTADO AL CIERRE DE ESTE TURNO (verificado por el orquestador, no auto-reportado):** el
implementador **sigue `running`** (15 min), pero el arbol ya volvio a ser consistente:
**typecheck, lint y format:check VERDES**, y **cero `MUTATION` sueltas**. El rojo del hook fue
transitorio, como se esperaba. Falta su handoff, la suite con Neon y sus 5 mutaciones.

**Lo que ya se ve en el arbol (23 archivos):** migracion `0037_onboarding_grant.sql`, modulos
nuevos `server/onboarding-grant.ts` y `server/loyalty-program/owner.ts` (**este ultimo NO estaba
en la tabla de Archivos de la spec** — probable particion por el hook de tamaño; **el revisor
tiene que confirmar que es eso y no alcance ampliado**), y los 8 archivos de test de integracion
actualizados al 3er argumento.

**QUE HACER:**
1. `ListAgents` **primero**. Si el implementador sigue `running`, **esperarlo**. Editar
   `loyalty-program.ts`, `merchant-session.ts` o los tests ahora **pisa su trabajo**.
2. Cuando entregue el handoff: correr los gates **completos** uno mismo (no creerle al
   auto-reporte) y recien ahi despachar el **revisor independiente**.
3. Si el agente murio y dejo el arbol roto: `git status` + `git diff`, y **medir antes de
   revertir** (regla de `CLAUDE.md` para mutaciones heredadas). El punto limpio de retorno es
   **`53bcf88`**.

**Lo que NO hay que hacer:** bajar el tercer argumento a opcional para que el typecheck pase. Eso
vacia el invariante entero de la spec.

## ⇥ ▶ EN EJECUCION: LAS TRES SPECS DEL ADR 0076 (2026-09-18)

**Commit `53bcf88`** — retiro del fallback de dev + ADR 0076. Arbol limpio en ese punto; lo de
abajo son las tres specs, ya `cerradas`, con sus filas en el INDEX.

**PEDIDO DEL OWNER, textual:** «hace el commit y arranca por B. e implementa a y c tambien de
forma ordenada para que al hacer el qa pruebo todo de una sola vez». O sea: **el QA es UNO SOLO al
final de las tres**, no uno por spec.

| Spec | Que | Estado |
|---|---|---|
| **0077** (B) | Permiso de alta en la sesion + invariante crear/editar en `saveProgram`. **Cierra el bypass** | `cerrada` — **implementador DESPACHADO**, corriendo |
| **0078** (A) | TOS por pais (EC + `default`), `country_code` al allowlist, y el «Los sello» | `cerrada` — **esperando el PASS de la 0077** |
| **0079** (C) | Una sola ruta de escritura + `kind`. Borra `POST /api/onboarding/program` | `cerrada` — **bloqueada hasta el PASS de 0077 Y 0078** |

**⚠️ EL ORDEN ES OBLIGATORIO: 0077 → 0078 → 0079.** Dos motivos distintos, los dos reales:

1. **0079 DEPENDE de 0077.** Fundir las dos puertas antes de que el invariante viva en el writer
   seria **mover** el bypass, no arreglarlo.
2. **0077 y 0078 parecen disjuntas en codigo y NO lo son.** Las dos llevan migracion, y
   `drizzle-kit generate` numera secuencialmente contra `drizzle/meta/_journal.json` (hoy `idx: 36`):
   dos implementadores a la vez producen el mismo prefijo y un journal corrupto. Ademas las dos
   correrian `db:migrate` + la suite entera contra **la misma rama Neon**. La 0078 nacio marcada
   `disjunta: si` mirando solo el codigo fuente; **corregido a `no` el mismo dia**.

**LO QUE EL ORQUESTADOR DEBE HACER AL VOLVER, en orden:**
1. Recibir el handoff del implementador de la 0077 → despachar **revisor independiente** (nunca el
   mismo turno que escribio el codigo, ADR 0071).
2. Con el PASS: marcar la 0077 `implementada`, actualizar INDEX y TASKS, y **recien ahi** despachar
   el implementador de la 0078.
3. Idem con la 0078 → despues la 0079.
4. **Recien con las tres en `implementada`, avisarle al owner para el QA unico.**

**LO QUE NO SE PUEDE OLVIDAR EN EL QA FINAL:** la 0079 **si lleva `pnpm test:e2e`** (toca
`onboarding-api.ts`, un archivo de cliente). Y `main` arrastra un rojo **preexistente y ajeno** de
e2e en `tests/e2e/loyalty.spec.ts:27`, sobre la UI vieja de `/backoffice/demo`: **hay que
distinguirlo de una regresion nuestra**, no silenciarlo.

## ⇥ ✅ ADR 0076 ESCRITO — TODAS LAS DECISIONES DEL OWNER TOMADAS (2026-09-18)

**`docs/adr/0076-el-permiso-de-alta-vive-en-la-sesion-y-el-gate-baja-al-writer.md`**, `aceptada`,
con su fila en `INDEX.md`. Cierra la ronda de diseño de esta sesion. **Las seis decisiones:**

| # | Decision | De quien |
|---|---|---|
| 1 | El invariante del email **baja al writer** (`saveProgram`): crear ≠ editar | agente, sobre evidencia |
| 2 | **Permiso de alta en la fila de la SESION**, escrito por `auth/start`. **NO viaja**: el cliente nunca lo manda | agente; el owner pedia un «usuario de sistema», descartado en el ADR con el motivo |
| 3 | Acota **solo escrituras del alta**. Staff/locales/marca/campañas/catalogo/billing conservan el gate. **El QR queda AFUERA** y conserva el guard de la 0075 | agente |
| 4 | Cierra con **lo que pase primero**: email verificado · **5 min tras el alta completa** · **60 min desde la creacion de la cuenta** | (a) y (b) del OWNER textual; (c) lo agrego el agente y el owner lo confirmo |
| 5 | **UNA sola ruta** de escritura del programa | OWNER textual: «Una sola ruta de api si hacen lo mismo» |
| 6 | **La API acepta `kind`**; la pantalla la hace el owner | OWNER textual |
| 7 | **TOS por pais** (EC primero, por `countryCode`) + personalizado **libre en el panel**, no en el wizard | OWNER textual |

**MEDICIONES QUE SOSTIENEN EL ADR (reproducidas por el orquestador, sondas ya borradas):**
- El bypass: misma sesion `emailVerified:false` → `POST /api/onboarding/program` **200** y la base
  reescrita a `target:50`; `PUT /api/loyalty-program` **403 `email_not_verified`**.
- La cookie: `httpOnly:true`, `sameSite:lax`, `maxAge` 604800 (**7 dias** — de ahi el tope (c)),
  valor firmado HMAC-SHA256.
- `better-auth@1.6.26` soporta **`session.additionalFields` nativo** (sin plugin, o sea **sin**
  superficie HTTP nueva por el catch-all — leccion de la 0046).
- TOS: `terms_template` ya tiene `jurisdiction_scope`; `renderedTerms` ya interpola
  `business_legal_name`/`country_code`; el texto libre por clausula **ya se acepta**. Sin migracion
  de esquema.

**PROXIMO PASO — TRES SPECS DISJUNTAS, NINGUNA ESCRITA TODAVIA** (orden obligatorio, C depende de
A y B). Plantilla: **A y B llevan `TEMPLATE.md`** (llevan migracion); **C puede ir CHICA** si al
escribirla sigue siendo un dominio.

| Spec | Alcance | Migracion |
|---|---|---|
| **A** | TOS por pais: semillas EC + default, seleccion por `business.countryCode`, `country_code` al `variables_allowlist`, y el bug **«Los sello se acumulan…»** (texto legal que ve el consumidor) | semillas |
| **B** | Permiso de alta en la sesion + el invariante crear/editar en `saveProgram`. **Es la que cierra el bypass** | columna en `merchant_auth.session` |
| **C** | Unificar las dos rutas de escritura en una y aceptar `kind` con los campos de cada modalidad (puntos: `unitSingular`/`unitPlural`, `per_amount` con `blockAmount`, `pointsCost` por premio) | no |

## ⇥ 🔴 HALLAZGO REPRODUCIDO: EL GATE DE EMAIL ES EVADIBLE HOY (2026-09-18)

**Reproducido contra Neon con una sonda temporal** (`SONDA-gate-bypass.neon.integration.test.ts`,
ya BORRADA). Un solo usuario con `emailVerified: false`, **una sola sesion**, dos puertas:

| Llamada | Resultado medido |
|---|---|
| `POST /api/onboarding/program` (2da vez, programa ya existente) | **200** `{"created":false}` — y la base quedo `{"target":50,"unitName":"sello"}`, **reescrito** desde `target: 8` |
| `PUT /api/loyalty-program` con **la misma cookie** | **403** `{"code":"email_not_verified"}` |

**O sea: la puerta del wizard no solo CREA, tambien EDITA, y no tiene gate.** Quien tenga una
cuenta sin verificar reescribe su programa llamando a la ruta del wizard en vez de a la gateada.

**Ya hay precedente EXACTO de este bug y de su fix:** el comentario de
`server/loyalty-program.ts:109-116` cuenta que la spec 0072 encontro lo mismo con el eje `status`
(«la otra reescribia el programa de un negocio `suspended` — medido: 200 con `created:false` contra
el 403 de la gateada») y lo arreglo **bajando el invariante al WRITER**. El del email quedo afuera.

**Y EL ADR LE DA LA RAZON AL OWNER SOBRE EL DISEÑO.** ADR 0070 §11 registra su motivo textual —
*«hoy Staff es gratis, pero va a pasar a ser parte del plan de pago quizas»* — y dice explicito:
**«El motivo que dio el owner no es de seguridad sino de negocio»**. Se implemento como control de
seguridad transversal de API (12 entradas). Ese desajuste es lo que viene produciendo la friccion.

**PROPUESTA (sin implementar, esperando decisiones del owner):** la regla baja al writer, no a la
ruta. `saveProgram` distingue **crear** el primer programa (no exige email) de **editar** uno
existente (si lo exige). Cierra el bypass por construccion, sin importar cuantas puertas HTTP haya,
y **vuelve innecesaria la «API especifica del wizard» como mecanismo de seguridad** — con lo cual
UNA sola ruta que acepte cuerpo corto o completo pasa a ser viable, que es lo que el owner pidio.

## ⇥ TOS POR PAIS: EL MODELO DE DATOS YA EXISTE (medido 2026-09-18)

El owner pidio «un tipo de TOS segun pais» + terminos personalizados como opcion avanzada.
**Ninguna de las dos cosas necesita migracion:**

- `core.terms_template` **ya tiene** `jurisdiction_scope`, `locale`, `category`, `template_markdown`,
  `variables_allowlist`, `version`, `status` (`server/schema/loyalty.ts:186-208`).
- `renderedTerms` (`loyalty-program/terms.ts:33-41`) **ya interpola** `business_legal_name`,
  `program_name`, `program_kind` y `country_code`.
- **Los terminos personalizados YA se aceptan**: cada clausula es `templateId` **o** `text` libre
  (`loyalty-program/validation.ts:129-143`).

**Lo que falta es SEMBRAR y SELECCIONAR, no esquema:** hoy existe **un solo** scope,
`global-draft`/`es`, con 2 plantillas publicadas (`earning`, `redemption`; la tercera, `transition`,
la archivo la migracion `0011`), y el wizard las pide **hardcodeando** ese scope
(`onboarding/program-defaults.ts:60-68`).

**Dos defectos visibles que salieron en la misma sonda:**
1. **El texto legal renderizado dice «Los sello se acumulan…»** — `program_name` se llena con
   `configuration.unitName`, que es **singular**. Es texto legal que ve el consumidor.
2. **`country_code` se pasa como variable pero NO esta en el `variables_allowlist` de las semillas**
   (solo `business_legal_name` y `program_name`), asi que hoy **no se puede usar en el texto**.

## ⇥ PUNTOS: EL OWNER CORRIGIO EL ENCUADRE (2026-09-18)

Textual: *«entiendo que para elegir el programa de puntos necesitamos mas datos, pero eso no es
decision tuya, deberiamos permitirlo a nivel de API y ya como yo hago la UI para eso es otro tema.
Pero no deberia ser el API la que no me lo permita»*. **Queda decidido: la API acepta `kind`.**
La tabla de campos por modalidad de la seccion de abajo sigue siendo el insumo, pero **ya no es una
decision abierta de producto** — es el contrato a escribir.

## ⇥ EL HUECO 2 DE `api-faltante.md` — ¿EL API DEJA ELEGIR PUNTOS O SELLOS? (2026-09-18)

**Pregunta textual del owner:** «El api entonces ahora permite elegir entre puntos y sellos?».
**Respuesta medida, depende de la ruta:**

| Ruta | ¿Elige `kind`? | Evidencia |
|---|---|---|
| `POST /api/onboarding/program` (el wizard) | **NO.** Ni siquiera lee el campo | `wizardProgramInput` valida solo `target` (2–50) y `reward:{type:"custom",label}`; `composeWizardProgramInput` (`server/onboarding/program-defaults.ts:119-131`) fija a mano `kind:"stamps"`, `unitName`, clausulas, `per_purchase` y `stampAction`. Un `kind:"points"` enviado ahi **se ignora** |
| `PUT /api/loyalty-program` (administracion) | **SI: `points` o `stamps`** | `server/loyalty-program/validation.ts:11-12` (`enabledKinds`); `tiers`/`cashback` → 422 «Esta modalidad todavia no esta disponible» |

**Puntos NO es un esqueleto:** esta ejercitado de punta a punta —acumulacion, canje en mostrador,
wallet, enrolamiento del consumidor— por ~30 archivos de test que crean programas `kind:"points"`.

**Los dos asteriscos antes de que eso sea una opcion en pantalla:**
1. `PUT /api/loyalty-program` **lleva el gate de email completo** (`requireApiOwner`), al reves que
   el QR: una cuenta recien salida del wizard no la alcanza hasta verificar el correo.
2. Sus errores **no traen `code`** — solo `{error:"<mensaje>"}` con 403/409/422/503. Declarado como
   ESTADO ACTUAL en el contrato **0069** (tabla de errores, §lineas 357-367), no es una regresion.

**CONCLUSION, y sigue siendo decision del owner (no la tomamos aca):** para ofrecer **puntos** en el
paso 3 **no falta dominio, falta contrato** — extender `POST /api/onboarding/program` para aceptar
el tipo y decidir cual es la entrada minima de puntos en esa pantalla (el ADR 0070 §1 la definio
para sellos: «cada cuantos sellos · que premio»). Para **cashback** SI falta dominio: esta en el
CHECK del esquema pero no en `enabledKinds`.

### Repregunta del owner (textual) y lo que se midio para contestarla

> «y porque no podemos usar en el POST del wizard? se supone que es la misma API que usaremos luego
> en el backoffice. Porque luego en el administrador del programa usaremos exactamente los mismos
> endpoints y API porque no tendria sentido tener dos diferentes.»

**LA PREMISA ES CORRECTA Y YA SE CUMPLE donde importa: NO hay dos APIs.**
`POST /api/onboarding/program` **no duplica ni una regla de dominio** — llama al mismo
`saveProgram` que `PUT /api/loyalty-program` (`app/api/onboarding/program/route.ts:3` y `:53`).
Son **dos puertas HTTP sobre UN solo writer**; la del wizard es un compositor de ~15 lineas.

**Por que el wizard NO puede llamar a `PUT` tal como esta hoy — tres razones medidas:**

1. **`saveProgram` exige al menos una clausula de terminos legales**
   (`server/loyalty-program/validation.ts:144-146`). El wizard no le pide terminos al comerciante:
   el servidor los siembra de `core.terms_template`. Con `PUT`, **la UI tendria que inventar los
   terminos legales del comercio** o hardcodear semillas de una tabla. Es el motivo escrito del
   compositor (contrato 0069 §D4).
2. **`PUT` lleva el gate de email completo** (`requireApiOwner`) y el wizard corre ANTES de
   verificar → 403 `email_not_verified` en el paso 3, el mismo bug que la 0075 le saco al QR.
   Sacarselo a `PUT` **abre el gate para TODA la administracion del programa**, no solo para el alta.
3. **`PUT` no emite `code`** (solo `{error}` con 403/409/422/503, declarado en el contrato 0069);
   la ruta del wizard si, y la UI discrimina con eso —incluido `business_suspended` con su
   `suspensionReason`—.

**Y POR QUE PUNTOS NO ES PASAR UN FLAG — lo que cada modalidad le exige a QUIEN LLAMA:**

| | Sellos (wizard hoy) | Puntos |
|---|---|---|
| `configuration` | `unitName` + `target` 2–50 | `unitSingular` **+** `unitPlural` |
| `accrual` | `per_purchase` o `per_amount` | **forzado a `per_amount`** (`accrual.ts:22-27`) → exige `grant` entero >0 **y** `blockAmount` >0 |
| `rewards` | exactamente 1, sin costo | 1..N, **cada uno con `pointsCost`** entero >0 (`rewards.ts:14-15,109-111`) |

Hoy el paso 3 pide **2 datos** y el servidor compone los otros seis. Puntos pediria **cinco**:
singular y plural de la unidad, cuantos puntos por cada $X de compra, y el costo en puntos del
premio. **El servidor no puede inventar el bloque de dinero.** O sea: el paso 3 de puntos **es otra
pantalla**, no la misma con un selector arriba.

**LAS DOS OPCIONES QUE SE LE SUBIERON AL OWNER (2026-09-18) — sin decidir, esperando respuesta:**

| | Que es | Costo |
|---|---|---|
| **A (recomendada)** | Extender `POST /api/onboarding/program` para aceptar `kind`, con defaults por modalidad en el compositor | Un solo writer y una sola puerta para el **alta**; el backoffice sigue con `GET`/`PUT`/`DELETE`/`PATCH` para la **edicion**, que ya aceptan puntos |
| **B** | UN solo endpoint para alta y edicion: subir el compositor al `PUT` para que acepte cuerpo corto | Arrastra las razones 2 y 3: decidir el gate de email para **toda** la administracion del programa y darle `code` a **4 rutas ya contratadas** |

**LO QUE NO SE PUEDE RESOLVER SIN EL OWNER:** el diseño del paso 3 para puntos (esos cinco campos).

## ⇥ ⚠️ LO QUE ESTA ROTO Y ES DECISION DEL OWNER (2026-09-18)

**`main` esta en ROJO y la causa es NUESTRA, no de Vercel.** `pnpm test:e2e` falla en
`tests/e2e/loyalty.spec.ts:27`, sobre la UI vieja (`/backoffice/demo`):

```
await page.getByRole("radio", { name: /Sellos/i }).check();
  - element is visible, enabled and stable
  - <span class="loyalty-choice-content">…</span> intercepts pointer events
  → Test timeout of 30000ms exceeded   (reintento 57 veces)
```

**Atribucion medida:** en `78d1f3a` ese mismo `test:e2e` daba **`success`** y el test no cambio.
Lo unico del push que toca CSS global es el `@import "tailwindcss"` de `globals.css`, que importa
el **root layout**.

**POR QUE VUELVE AL OWNER Y NO SE ARREGLA SOLO:** el owner acepto explicitamente que las pantallas
viejas se rompieran («voy a rediseñar todas, que se rompan ahora no me preocupa»), y con eso se
descarto aislar el CSS. **Pero esa decision se tomo sobre degradacion VISUAL** —que es la
evidencia que se le puso enfrente: bullets, margenes, tamaños de heading—. **Esto es FUNCIONAL: un
control que ya no se puede clickear.** Es una decision nueva, no la vieja arrastrada.

**Las tres opciones, con su costo:**
1. **Aislar el CSS del sistema nuevo** (sacar el `@import` del root layout y ponerlo en una hoja
   que importe solo `app/[locale]/layout.tsx`). Revierte esto de raiz. **Es la recomendacion.**
2. **Ajustar el e2e** para clickear el label. Hace pasar el gate **con la interaccion real todavia
   rota** para un usuario. El repo prohibe editar un test para que pase un gate.
3. **Borrar ese e2e**, asumiendo que `/backoffice` se va. Valido **solo** si el borrado es
   inminente (ADR 0070 §17 lo pide, pero depende de que la UI nueva aterrice).

**NO SE TOCO NADA DE ESTO**: el arreglo espera la decision.

## ⇥ VERCEL NO DESPLIEGA — DEL LADO DE ELLOS (2026-09-18)

**Decision del owner: «el problema es en vercel, no es nuestro».** Se deja de perseguir. Lo medido,
para no re-medirlo:

- **Los deploys se CREAN pero no arrancan.** Un deployment de una rama de Dependabot
  (`source: "git"`, o sea disparado por el webhook) quedo en **`QUEUED`** sin pasar a `BUILDING`.
  Igual que el manual que se disparo por API. **La conexion con GitHub FUNCIONA.**
- **Descartado midiendo:** no hay backlog (1 solo deployment no terminal en toda la cuenta), no es
  limite de uso (remote caching `enabled`), no es cola de namespace (0 proyectos con
  `WAIT_FOR_NAMESPACE_QUEUE`), **no es pausa** (verificado por el owner en el dashboard), y **no es
  la conexion Git** (verificado por el owner).
- **Otro proyecto de la MISMA cuenta (`my-55mas`) desplego dos veces hoy** (15:48 y 16:06 UTC) y
  las dos quedaron `READY`.

**⚠️ TRES ERRORES DE DIAGNOSTICO DEL ORQUESTADOR EN ESTE EPISODIO, para no repetirlos:**
1. **«El proyecto esta pausado»** — falso. Se leyo **`"live": false`** del objeto de proyecto de la
   API de Vercel como señal de pausa. **NO significa eso.**
2. **«La conexion Git se rompio»** — falso. Se concluyo **1 minuto despues del push**, antes de que
   el webhook llegara.
3. **«54 segundos despues del deploy = se pauso ahi»** — inferencia debil sobre un `updatedAt` que
   se explica igual de bien por el propio deployment pasando a READY.

**El patron es uno solo y esta en `LECCIONES.md`:** una señal que encaja + una explicacion que
cierra, **sin experimento que la separe de su alternativa**, no es una medicion: es una historia.

## ⇥ DECISIONES DEL OWNER SOBRE LA UI (2026-09-18)

**La UI la construye el owner por fuera con ChatGPT** (ADR 0070 §16), consumiendo los contratos
`0067`/`0069`/`0072`. Lo que decidio el 2026-09-18, textual: **«el wizard como es para dar de alta
a un merchant deberia vivir en la app del merchant»**.

**Medido, y la decision coincide con el estado de hecho:** las rutas vivas del consumidor
(`/enroll/[programId]`, `/wallet`, `/recover`) **ya viven en `apps/merchant`** bajo el grupo
`(consumer)`, y `apps/merchant` es la **unica app desplegada** (un solo proyecto en Vercel). Asi
que el wizard y el `/login` de tres perfiles no cruzan ningun limite de app.

**Mapa de superficies que el owner dicto** (ninguna existe todavia como pantalla):

| URL | Que es | Estado medido el 2026-09-18 |
|---|---|---|
| `checkpass.club` | landing publica | la raiz responde 200; el apex hace **308 a `www`** |
| `checkpass.club/login` | login UNICO de merchant, staff y consumidor, que redirige segun el caso. **Decision del owner del 2026-09-18, que CORRIGIO al orquestador: NO vive en la app del merchant sino en la PUBLICA** — «puede acabar en merchant o consumer luego» | **no existe** — la 0067 borro `/login` |
| `checkpass.club/es/business/dashboard` | pantalla principal del comercio | **no existe**; hoy es `/backoffice/*`, que es la UI vieja a borrar (ADR 0070 §17) |
| `bo.checkpass.club` | panel del dueño de CheckPass, con **login propio y sin web publica** | **no resuelve DNS**. Su esqueleto es `apps/platform`, que hoy tiene una sola ruta (`/api/health`) |

**⚠️ RESTRICCION MEDIDA que condiciona donde puede vivir `/login`:** la cookie de sesion la
setean rutas de **`apps/merchant`** (`openMerchantSession` en `api/merchant/auth/staff/route.ts:135`,
y el catch-all `/api/auth/*`), sobre el origen `checkpass.club`. **La superficie publica tiene que
servirse en el MISMO origen** o el `Set-Cookie` no pega. Y hoy la raiz `checkpass.club` **la sirve
`apps/merchant`** (`src/app/page.tsx` existe). O sea que «la app publica» es hoy un **grupo de rutas
dentro de `apps/merchant`** que se extrae despues, o un deployable nuevo que pasa a ser dueño de la
raiz. **El owner no eligio entre esas dos y no se elige por el.** Mitigacion ya puesta en el encargo
a ChatGPT: `/login` se construye **sin una sola dependencia del merchant**, para que mudarlo no sea
reescribirlo.

**HALLAZGO A DECIDIR, no decision del owner:** `apps/consumer` es **andamiaje sin tarea** — solo
`/qa`, `/check-in/demo-bar`, `/wallet/demo` y `/api/health`, y no esta desplegada. Por la regla del
repo le toca una fila en `TASKS.md` con quien la va a consumir, o el borrado.

**PIEZA 0 PROPUESTA para la proxima tanda, a confirmar: `GET /api/merchant/session`.** Medido: el
unico lector de sesion publicado hoy es `GET /api/auth/get-session` de better-auth (verificado
contra `www.checkpass.club`: **200 con cuerpo `null`** sin sesion, y los controles —un path de
`disabledPaths` y uno inventado— dan **404**, o sea que la sonda discrimina). **No hay fuga**: la
tabla `user` tiene `id`, `name`, `email`, `emailVerified`, `image` y las fechas, nada sensible.
**El problema es que es insuficiente**: no dice rol, negocio, `slug`, `status` ni plan, asi que la
UI tendria que inferirlos de los 403. Un DTO propio seria ademas **el consumidor que espera el
andamiaje de `requireBackofficeSession`** (`status`/`suspensionReason`, §ANDAMIAJE de mas arriba).

**⚠️ DEUDA DE MEDICION, declarada y NO perseguida:** los `duration_ms`/`tool_uses`/`subagent_tokens`
de los subagentes de la **0072** —que el owner pidio anotar para la re-medicion del ADR 0071— **se
perdieron**. Vivian en las notificaciones de subagente de la sesion anterior y el `/clear` se las
llevo; **no estan en disco** (verificado: el ADR 0071 tiene la re-medicion contra la 0069 y cero
menciones de la 0072). No se reconstruyen sin inventarlas. **La 4ª spec es la proxima oportunidad
de medirlo**, y hay que anotarlo A MEDIDA que llega cada notificacion, no al final.

**EL ARCO 2 ESTA CERRADO Y EN PRODUCCION.** La **3ª spec** del arco esta **`cerrada`**:
**`docs/specs/0072-entitlements-y-estado-del-negocio.md`**, con su ADR **0073** y sus dos filas
de `INDEX`. **Las decisiones del owner estan las cuatro tomadas** y el implementador salio.

**→ PARA RETOMAR, LEER EN ESTE ORDEN:** esta cabecera · la seccion «LA 3ª SPEC» de aca abajo ·
la spec **0072** y el ADR **0073** · `docs/PARQUEADO.md` filas **56** y **57** (las dos las
absorbe la 0072) · el ADR **0070** (el arco) y el **0071** (el proceso).

## ⇥ LA 0074 — EL HUECO DE LECTURAS, `cerrada` y SIN IMPLEMENTAR (2026-09-18)

**Spec: `docs/specs/0074-el-hueco-de-lecturas-del-api.md` + anexo `docs/specs/0074-contratos-de-api.md`.
Fila puesta en `INDEX.md` en el mismo commit. NO tiene ADR: no decide nada transversal nuevo,
consume el ADR 0070 §16 y el 0073.**

**QUE LA ORIGINO, y corrige una premisa del owner:** el prompt que el owner le paso a ChatGPT **no
lista APIs que faltan** — `docs/api-faltante.md` esta en sus **Entregables**, no en sus insumos: es
el alambre de trampa de la regla «no inventes endpoints», y el propio prompt contempla que quede
vacio. **Ese archivo no existe** (verificado: `find` en todo el repo y en `/Users/maxi`, `git status`
limpio). Lo unico que el prompt SI afirma como hueco es el contexto de sesion.

**LOS CUATRO HUECOS, medidos contra el arbol el 2026-09-18** —no citados de ChatGPT, reproducidos—:

| # | Hueco | Evidencia ejecutada | Estado |
|---|---|---|---|
| A | contexto de sesion (rol, negocio, `slug`, `status`) | unico lector: `get-session` de better-auth, que devuelve `user` pelado | **entra a la 0074** |
| B | plan y suscripcion | `api/billing/*` es **POST-only**, cero `GET` | **entra a la 0074** |
| C | estado del wizard | `onboarding/{business,program}` POST-only; `prefill` no lee una fila del negocio | **entra a la 0074** |
| D | metricas del dashboard | cero rutas; `/backoffice/demo/analytics` es un mock de `sessionStorage` | **AFUERA, es decision del owner** |

**LA CAUSA, y explica los cuatro de una vez:** el arco contrato las **escrituras**, porque ahi viven
los guards. Las lecturas nunca necesitaron HTTP: **7 paginas de `/backoffice` son server components
que consultan drizzle en proceso** (`grep -rln 'server/db|drizzle' … --include=*.tsx`), incluida la
principal, que lee `core.subscription` con un `select` directo. En cuanto la UI habla por HTTP, cada
lectura in-process se vuelve un endpoint faltante. **No es un olvido: es mecanico.**

**LAS CUATRO DECISIONES DE DISEÑO QUE TOMO EL ORQUESTADOR** (no el owner — si alguna no le cierra,
se cambia ANTES de despachar al implementador):
1. `/api/merchant/session` **contesta 200 siempre** y **no** emite los cinco `code` de la 0072. Un
   endpoint gateado por el estado que reporta no deja renderizar la pantalla de cuenta suspendida.
2. **No devuelve el plan**: `billingStateResponse` toma un lock de fila, y eso pondria un lock en
   cada carga de cada pantalla. Por eso B es un endpoint aparte.
3. Membresia no `active` → `business: null` **sin revocar la sesion**: es un `GET` y un `GET` con
   efecto lateral se dispara con un prefetch del navegador.
4. `/api/onboarding/state` devuelve **hechos, nunca un numero de paso** (el ADR 0070 prohibe
   `onboarding_step`, y un `"step": 2` en el JSON es esa columna disfrazada).

**LO QUE HAY QUE PREGUNTARLE AL OWNER, concreto y sin bloquear la 0074:** ¿que tres numeros quiere
ver al abrir el dashboard, y con que ventana de tiempo? Sin eso el hueco D no se especifica sin
inventarlo.

**PROXIMO PASO:** despachar UN implementador con la 0074 y UN revisor independiente al final
(ADR 0071). Presupuesto **5 mutaciones**, sin migraciones, **cero `.tsx`**. La spec trae las cinco
mutaciones con su invariante y su rojo esperado.

## ⇥ ⚠️ VERCEL NO DESPLIEGA — MECANISMO SIN IDENTIFICAR (2026-09-18)

**El sintoma:** se pushearon 5 commits a `origin/main` y **Vercel no desplego nada**. El ultimo
deploy seguia siendo el de `78d1f3a`, de ~18 h antes.

**⚠️ EL ORQUESTADOR CONCLUYO «el proyecto esta pausado» Y ESTABA EQUIVOCADO.** El owner lo
verifico en el dashboard el 2026-09-18: **no hay ningun proyecto pausado**. La conclusion se
retira; lo que sigue son **solo los hechos medidos**, que siguen en pie.

**DATO QUE SE GANO CON EL ERROR, y evita que se repita: `"live": false` en el objeto de proyecto
de la API de Vercel NO significa «pausado».** Se leyo asi y se construyo un diagnostico entero
encima. **No usarlo como señal de pausa.**

**HECHOS MEDIDOS, que siguen valiendo:**
- **GitHub:** `78d1f3a` y `0507cf5` tienen `Vercel:success` con su deployment registrado. Los
  commits nuevos (`e38b0a5`, `e2e8f18`) quedan en **`pending` con CERO statuses** — Vercel ni
  siquiera publico un build fallido. **No es que el build reviente: es que no arranca.**
- **La integracion con GitHub FUNCIONA:** `create_deployment` con `gitSource` github/main/sha
  **creo el deployment**, o sea que Vercel resolvio el repo y el sha sin problema.
- **Pero el build NUNCA ARRANCA:** ese deployment quedo en **`QUEUED` +7 minutos** sin pasar a
  `BUILDING`.
- **`unpause_project` es un no-op** en este proyecto: devuelve `null` y el segundo intento ni
  siquiera cambia el `updatedAt`. **Consistente con que no hubiera nada que despausar.**

**HIPOTESIS DESCARTADAS, midiendo:**
- **No hay backlog**: `list_deployments` con `QUEUED,BUILDING,INITIALIZING` sobre **toda la
  cuenta** devuelve **1 solo** deployment.
- **No es limite de uso**: el `status` de remote caching devuelve `enabled`.
- **No es la cola de namespace**: **0 proyectos** con `WAIT_FOR_NAMESPACE_QUEUE`.
- **No es pausa del proyecto** (verificado por el owner en el dashboard).

**ESTADO: el mecanismo NO esta identificado.** Lo que queda sin descartar es una degradacion del
lado de Vercel —builds que se encolan y no se toman—, pero **eso no esta medido y no se escribe
como causa**. Decision del owner: **cancelar el deploy encolado y reintentar mas tarde.**

**PRODUCCION ESTA INTACTA, verificado por HTTP:** `www.checkpass.club` **200**, `/api/health`
**200**, apex **308 → www**. El deploy encolado **no tumbo nada**; prod sigue sirviendo `78d1f3a`.
`/api/merchant/session` da **404**: **prod todavia NO tiene el commit nuevo**, y el QA del owner
no puede hacerse hasta que despliegue.

**FALSA ALARMA REGISTRADA:** tras crear el deployment, el campo `domains` de `get_project` dejo de
listar `www.checkpass.club`. **No se perdieron los dominios**: ese campo refleja los **alias del
ULTIMO deployment**, y el ultimo paso a ser el encolado. Se verifico por HTTP antes de alarmar.

## ⇥ PUSHEADO A PRODUCCION (2026-09-18) — `78d1f3a..e2e8f18`, CINCO COMMITS

**Pedido del owner: «hacemos el push de todo para probar en live».**

| commit | que |
|---|---|
| `b61f832` | `refactor(billing)`: el cuerpo compartido de cancel/settle-free sale del Route Handler |
| `21855a3` | `feat(merchant)`: **spec 0074** — las tres lecturas que la UI necesita |
| `9d6ce92` | `feat(merchant)`: **spec 0075** — el QR del wizard no lleva el gate de email |
| `e38b0a5` | `feat(merchant)`: la UI mobile-first (sistema de diseño + wizard) |
| `e2e8f18` | `docs`: INDEX, TASKS, api-faltante, PARQUEADO y las cuatro lecciones |

**Verificado ANTES del push:** `.env.integration.local` ignorado por `.gitignore`, cero secretos
en el status, y los cinco gates verdes sobre el arbol exacto (suite **1637 passed / 0 failed** con
Neon, sin ninguna otra corrida viva).

**⚠️ Y una lectura roja que NO reprodujo, declarada para que nadie la descubra de nuevo:** una de
las ultimas cinco corridas locales dio **10 tests rojos en 8 archivos** (`wallet-push`,
`web-push`), y la corrida inmediatamente anterior al commit dio 1637/0 sobre el mismo arbol. **El
mecanismo sigue SIN identificar.** Se desarmo ademas una hipotesis propia: **CI NO usa una rama
Neon fresca** — el workflow dice que «la rama de CI nace de `main` y se queda atras» y se migra
idempotentemente, o sea que esta expuesta a la misma acumulacion que la local.

**CI PARA `e2e8f18`, leida de `/check-runs` + los pasos del job** (nunca `/status`):
**los pasos 1-11 en `success`**, incluidos **`pnpm lint`**, **`pnpm typecheck`**, **«Migrar la rama
Neon de CI»** y —el que importaba— **«Unit + integracion Neon: completed success»**. **El flake NO
aparecio en CI.** Al momento de escribir esto quedaban `test:e2e` corriendo, y `build` +
`format:check` pendientes.

**⚠️ TRAMPA DEL COMANDO DE VERIFICACION, medida en este mismo push y que se suma a la del
`/status`:** este commit tiene tambien check runs de **Dependabot**, y uno ya dice
`completed -> success`. Un poll que busque «completed» en **cualquier** check run **corta con un
verde que no es el tuyo**. El comando correcto filtra por nombre:

```
GH_TOKEN= gh api repos/maxhost/check-point/commits/<sha>/check-runs \
  --jq '.check_runs[] | select(.name=="verify") | "\(.name): \(.status) -> \(.conclusion)"'
```

**LO QUE FALTA ANTES DEL QA DEL OWNER:** que `verify` cierre en `success`, y **que Vercel tenga EL
COMMIT `e2e8f18`** —no que «prod este verde»—. El flujo que esta sesion destrabo y que hay que
probar: `/es/business/onboarding` con un email nuevo → negocio → programa → **ver el QR SIN haber
verificado el email**.

## ⇥ LA REVISION DE LA UI QUE VOLVIO DE CHATGPT (2026-09-18) — EL PUNTO DE RETORNO

**Estado: la UI esta en el arbol SIN COMMITEAR** (26 archivos nuevos + 6 modificados). La
revision esta HECHA y todo lo de abajo esta **reproducido contra el arbol**, no citado del
handoff de ChatGPT (`docs/ui-handoff.md`, `docs/api-faltante.md`).

**Los gates, medidos el 2026-09-18 con la UI adentro:** `typecheck` **verde**, `lint` verde,
`format:check` verde, suite **128 archivos / 1198 tests pass**, y los 4 archivos de test nuevos
de la UI **12/12**. **Limite declarado:** los **404 tests de integracion Neon quedaron
`skipped`** (sin `DATABASE_URL` local); ese lado lo cubre la CI.

**El «typecheck global en rojo» que reporta el handoff de ChatGPT NO era de la UI** — era
`.next/types` rancio (del 17-sep 23:17) + un export invalido preexistente. **ARREGLADO esta
sesion**, ver mas abajo.

### Las tres afirmaciones de `docs/api-faltante.md`, reproducidas una por una

| # | Afirmacion de ChatGPT | Veredicto medido | Que hay que hacer |
|---|---|---|---|
| 1 | `GET /api/onboarding/state` no existe | **CIERTA.** Es exactamente la spec **0074**, `cerrada` y sin implementar. **Y verifique que el `OnboardingState` de `contracts.ts` coincide campo por campo con el contrato 0074 §3** (`authenticated`/`business`/`program`/`stampImage`): implementar la 0074 **no rompe la UI**, solo retira el fallback de `sessionStorage` | **Implementar la 0074** |
| 2 | Falta contrato para elegir puntos/sellos/cashback en el paso 3 | **CIERTA como hecho, FALSA como hueco de API.** El **ADR 0070 §1** ya decidio la pantalla 3: «Sellos, premio en texto libre», y lista explicitamente lo que queda fuera del wizard. Ademas `loyalty-program/validation.ts:12` habilita **solo `points` y `stamps`**: **cashback existe en el CHECK del esquema pero NO en el dominio**. La UI hizo lo correcto dejando solo sellos | **Nada, salvo que el owner decida ampliar.** Puntos = trabajo de contrato; cashback = trabajo de dominio nuevo |
| 3 | El QR final choca contra el gate de email | **CIERTA, y es un INCUMPLIMIENTO, no una decision abierta.** Textual del owner (**ADR 0070 §11**): «para el alta no pedimos verificacion», y el ADR precisa que se bloquea **todo lo que venga DESPUES del wizard**. La pantalla del QR **ES** la cuarta del wizard (ADR 0070 §1: `→ \| Tu QR \| nada: es la recompensa`). La 0072 aplico `requireApiOwner` a las 10 superficies y se llevo puesta una del wizard. El propio contrato **0074 §3** usa ese mismo razonamiento para dejar `onboarding/state` sin gate | **Spec chica: sacar el gate de email de `GET /api/loyalty-program/qr`**, con nota de ADR porque corrige una de las 10 de la 0073 |

**Y lo que la UI NO hizo mal, tambien medido:** no invento endpoints (llama **9 rutas, 8
existen**, la unica ausente es la de la 0074), no manda `businessId`/`programId`, no usa
`get-session`, y el locale va por **allow-list** (`isSupportedLocale` → `notFound`).

### ⚠️ EL BLOQUEANTE PARA COMMITEAR, que `api-faltante.md` NO reporta

**`globals.css` ahora abre con `@import "tailwindcss"`, y ese archivo lo importa el ROOT
layout** → el **preflight de Tailwind se aplica a TODAS las superficies de `apps/merchant`**,
que es la unica app desplegada.

**Evidencia EJECUTADA, no razonada:** compile `globals.css` con el pipeline real del proyecto
(`@tailwindcss/postcss`) y el preflight queda en el bundle, dentro de `@layer base`:
`*, ::after, ::before { margin: 0; padding: 0; border: 0 solid }` · `h1..h6 { font-size:
inherit; font-weight: inherit }` · `ol, ul, menu { list-style: none }` · `img, svg, video…
{ display: block }`.

El CSS legado es **sin capa** (arranca en la linea 823 del bundle), asi que gana **solo donde
declara la misma propiedad** — y declara `h1`, `h2` y `p` (line-height y color, **no** margin).
**Censo de lo que queda desprotegido:** `<li>` en **21** archivos, `<ul>` en **16**, `<img>` en
**15**, `<h3>` en **7**, `<fieldset>` en **6** — incluidas las **tres rutas VIVAS del
consumidor** (`/enroll/[programId]`, `/wallet`, `/recover`: 4 archivos con `<h3>`, 4 con `<li>`,
6 con `<p>`).

**`docs/design-system.md:13` afirma lo contrario de lo que pasa:** dice que «los estilos
heredados de /backoffice permanecen aislados en globals.css». El aislamiento es de una sola
via, y la que se fuga es la del reset NUEVO sobre la UI VIEJA que hoy esta en produccion.

**El arreglo seria chico:** sacar el `@import "tailwindcss"` de `globals.css` y ponerlo en una hoja
que importe **solo `app/[locale]/layout.tsx`** (Next carga el CSS por segmento de ruta), o importar
`theme.css` + `utilities.css` sin preflight.

**PERO NO SE HACE — DECISION DEL OWNER, 2026-09-18, textual:** «Ninguna pantalla de las que esta en
produccion es decir de las viejas va a quedar, voy a rediseñar todas, entonces que se rompan ahora
no me preocupa». **Su razonamiento cierra con lo medido:** produccion tiene **0 negocios y 0
usuarios merchant**, asi que el radio de impacto hoy es cero; y si toda la UI se rehace sobre el
sistema nuevo, el preflight global **es el estado final deseado** — aislarlo ahora seria trabajo
para deshacer despues. **El hallazgo queda registrado como decision aceptada, no como deuda**, para
que nadie lo «arregle» mas adelante creyendo que es un bug.

**Lo unico que el owner NO nombro explicitamente, y por eso NO se escribe como decision suya:** las
**tres rutas VIVAS del consumidor** (`/enroll/[programId]`, `/wallet`, `/recover`) tambien comen el
preflight, y no son «pantallas viejas del merchant» — son del arco del consumidor. Con 0 negocios en
produccion nadie las esta usando hoy, asi que **no bloquea nada**; queda como un «miralas una vez»
cuando haya datos, no como un pendiente de codigo.

### HECHO ESTA SESION (unico codigo tocado): el export invalido de billing

`apps/merchant/src/app/api/billing/cancel/route.ts` exportaba **`downgradeToFree`**, que no es
un handler. **Un Route Handler de Next solo puede exportar handlers**, asi que `.next/types`
generaba un chequeo que fallaba (`TS2344`) y dejaba el typecheck local en rojo apenas alguien
corria un `next build`. **La CI no lo veia porque corre `typecheck` ANTES que `build`**, sobre
un checkout donde `.next/types` todavia no existe (`.github/workflows/ci.yml:32` vs `:65`).

**Arreglado moviendo el cuerpo compartido a `apps/merchant/src/app/api/billing/_downgrade.ts`**
(mismo criterio que `_auth.ts`, que ya vivia en ese directorio). `cancel/route.ts` queda con su
`POST`, `settle-free/route.ts` reapunta su alias, y del test solo se cambio **la ruta del
import** — la asercion `expect(SETTLE_FREE).toBe(downgradeToFree)` **quedo intacta**.

**Verificado:** typecheck verde **con el `.next/types` rancio todavia en su lugar** (o sea, el
artefacto que fallaba ahora pasa), lint, `format:check` y la suite entera sin cambio de numeros
(128/1198). **Mutacion M2** (`throw` al entrar a `downgradeToFree`) → **6 tests rojos** en
`billing-routes.test.ts`, lo que prueba que **las dos rutas ejecutan el modulo nuevo**;
revertida con `diff` contra la copia limpia, shasum `3ba2fa50…` identico, **cero `MUTATION` en
el arbol**.

### LO PROXIMO, y el estado de cada cosa (el owner decidio los 4 puntos el 2026-09-18)

| # | Que | Estado |
|---|---|---|
| 1 | Aislar el CSS | **DESCARTADO por decision del owner.** Ver arriba |
| 2 | Implementar la **0074** | ✅ **`implementada`**, con PASS de revisor independiente y los 2 hallazgos cerrados. **211 archivos / 1634 tests, 0 failed, 0 skipped**, 5 gates verdes, reproducido por el orquestador. **SIN COMMITEAR** |
| 3 | Spec chica del **QR** | ✅ **`implementada`**, con PASS de revisor independiente. **211 archivos / 1637 tests, 0 failed, 0 skipped**, 5 gates verdes, reproducido por el orquestador. **SIN COMMITEAR** |
| 4 | `downgradeToFree` fuera del Route Handler | **HECHO y verificado** (ver la seccion de arriba) |

**⚠️ SUBESPECIFICACION DE LA 0074, encontrada durante la implementacion (2026-09-18) y ya
corregida en la spec.** La spec declaraba `disjunta: si` y «diff **aditivo puro**», con una tabla de
Archivos de **solo archivos nuevos**. **Era falso para B:** apenas nacio `GET /api/billing/state`,
`server/billing-routes.test.ts` se puso rojo —tiene un **barrido de inventario** que lee el
filesystem bajo `api/billing/**` y exige **igualdad exacta** contra su lista `HANDLERS`—.

**El barrido funciono como debe**; lo que fallo fue la spec. Se autorizo una ampliacion **acotada a
ese archivo y a AGREGAR la fila**: el `toEqual` y el piso del barrido **no se tocan**, y si el piso
queda corto **sube**, nunca baja. Queda anotado en la tabla de Archivos de la 0074.

**ESTADO EXACTO (2026-09-18, implementador todavia corriendo):** la fila de
`GET /api/billing/state` **ya esta puesta** en `billing-routes.test.ts`, los tres archivos de ruta
mas `session-view.ts` existen en disco, y la suite **midio verde: 1201 passed | 423 skipped**.
**Ningun gate de esta spec esta declarado como pasado todavia** — el que los declara es el
**revisor independiente**, que no salio.

**⚠️ SEGUNDO ERROR DEL ORQUESTADOR EN ESTA SPEC, detectado y corregido en curso (2026-09-18).** El
encargo al implementador le decia: «si no podes correr los tests Neon, **declaralo como limite**».
**Ese limite no existe:** hay un `.env.integration.local` **en la raiz** y con el la suite corre
contra la rama Neon de verdad — verificado corriendo
`set -a; . ./.env.integration.local; set +a` + `loyalty-qr.neon.integration.test.ts`: **7 passed**.

**Por que importa y no es una correccion cosmetica:** **4 de las 5 mutaciones de la 0074 apuntan a
tests de integracion Neon** (`session.neon`, `onboarding-state.neon`, `billing-state.neon`). Los
**423 `skipped`** de la medicion de arriba **son exactamente esos**. Una mutacion cuyo oraculo esta
skippeado **no da rojo: da verde**, o sea que se puede ejecutar el protocolo entero —`shasum`,
bitacora, etiqueta— y producir evidencia que **no prueba nada**, con el formato de la que si
prueba. Ya se le mando al implementador el comando verificado y la orden de **rehacer toda mutacion
medida con el oraculo skippeado**.

**Criterio para el revisor, que queda fijado aca:** el handoff tiene que mostrar los tres archivos
`.neon.integration.test.ts` **corriendo con sus `✓`**, no con `↓ skipped`. **Un oraculo skippeado
es un FAIL, no un limite.** La leccion completa esta en `LECCIONES.md`.

**Y la regla que salio de ahi, ya en `LECCIONES.md`:** un barrido de inventario **no aparece en
ninguna lista de imports** —descubre los archivos leyendo el disco—, asi que la tecnica habitual
para probar disjuncion (buscar quien importa lo que voy a tocar) es **estructuralmente ciega** a
el. Antes de cerrar una spec que **crea una ruta** hay que correr
`rg -n 'readdirSync|readdir\(|globSync|import\.meta\.glob' apps -g '*.test.ts'` (**`-g`, no
`--include`**, que `rg` rechaza). **Corrido el 2026-09-18 devuelve 8 archivos**, entre ellos los
barridos por dominio de `billing`, `locations` y `marketing`.

**📊 MEDICION DEL ADR 0071 — IMPLEMENTADOR DE LA 0074 (anotada al llegar la notificacion, que es
lo que fallo en la 0072).** Estos tres numeros son los que el owner pidio para la re-medicion del
ADR 0071 y los que **se perdieron** la vez pasada por anotarlos al final:

| Metrica | Valor |
|---|---|
| `subagent_tokens` | **213.719** |
| `tool_uses` | **95** |
| `duration_ms` | **1.603.692** (≈ **26 min 44 s**) |

**Y los del REVISOR independiente de la misma spec** (anotados igual, al llegar su notificacion):

| Metrica | Implementador | Revisor |
|---|---|---|
| `subagent_tokens` | 213.719 | **152.283** |
| `tool_uses` | 95 | **53** |
| `duration_ms` | 1.603.692 (26m44s) | **1.817.940** (≈ **30 min 18 s**) |

**Vuelta 2 del implementador** (cerrar los dos hallazgos del revisor): `subagent_tokens`
**236.322**, `tool_uses` **21**, `duration_ms` **427.619** (≈ **7 min 8 s**). **Dato para el ADR
0071:** cerrar dos hallazgos acotados costo **7 minutos y 21 tool uses** contra los 27 minutos y 95
de la implementacion inicial — o sea que **el ciclo de correccion es barato cuando el hallazgo
viene con su evidencia y su arreglo escritos**. Los tokens NO bajaron (236k contra 213k) porque
re-lee el contexto entero: **lo caro es el contexto, no el trabajo.**

**El dato que el ADR 0071 va a querer:** el revisor gasto **29% menos tokens y 44% menos tool uses
que el implementador, y tardo MAS tiempo de reloj** (30m contra 27m). O sea que el costo de la
revision independiente **no es marginal**: es del mismo orden que implementar. Y en esta spec
**valio**, porque cazo un invariante escrito sin oraculo (ver hallazgos).

Contexto para que el numero signifique algo cuando se compare: spec de **3 rutas nuevas + 1 hoja de
DTO**, 4 archivos de test nuevos (26 tests), **5 mutaciones** del presupuesto **todas ejecutadas y
revertidas**, gates completos de root **con Neon** (`set -a; . ./.env.integration.local`), y **dos
correcciones del orquestador en vuelo** (la ampliacion a `billing-routes.test.ts` y el `.env` que
yo habia declarado mal como limite) que le costaron re-trabajo. **El revisor va aparte y sus
numeros se anotan igual, apenas llegue su notificacion.**

**AL CERRAR LA 0074, ademas:** actualizar `docs/api-faltante.md` marcando el hueco 1 como
**RESUELTO** — es el documento que el owner le pasa de vuelta a ChatGPT para que retire el fallback
de `sessionStorage`. Lo mismo con el hueco 3 al cerrar la 0075.

**LA PREGUNTA QUE SIGUE ABIERTA** (no bloquea nada de lo de arriba): el hueco **D** — ¿que tres
numeros querés ver al abrir el dashboard, y con que ventana de tiempo?

## ⇥ LA 0074 — LO QUE ENTREGO EL IMPLEMENTADOR (2026-09-18), REPRODUCIDO POR EL ORQUESTADOR

**Estado: implementada por el implementador, EN REVISION. NO marcada `implementada` — falta el
PASS del revisor independiente, que es el unico que declara los gates.**

**LO QUE REPRODUJE YO, no lo que reporto el subagente** (regla del repo: ningun hallazgo de un
subagente entra a un doc sin reproducir la evidencia):

| Que | Medido por el orquestador el 2026-09-18 |
|---|---|
| Suite completa **con Neon** (`set -a; . ./.env.integration.local`) | **211 archivos / 1631 tests passed · 0 skipped · 0 failed** |
| `typecheck --force` | verde, `0 cached, 3 total` |
| `rg -n MUTATION apps tools` | **vacio** |
| `next-env.d.ts` | volvio a coincidir con HEAD (lo regenera `next build`) |
| `billing-routes.test.ts` | **329 lineas**, sobre el limite de 300 del hook `file-size` |

**Archivos que entrego:** `server/session-view.ts` (hoja, 0 imports), las tres rutas
`api/merchant/session`, `api/billing/state` y `api/onboarding/state`, sus tres
`.neon.integration.test.ts` (7 + 8 + 4 tests), `server/read-surfaces-leak.test.ts` (7 tests), y la
edicion autorizada de `server/billing-routes.test.ts`.

**LAS 5 MUTACIONES DEL PRESUPUESTO: ejecutadas y revertidas, las cinco.** La que mas importa es
**M4** (sustituir `toSubscriptionView(row)` por `row` en billing): el implementador reporta que
`billing-routes.test.ts` y `billing-view.test.ts` **quedan VERDES** y solo muerde el oraculo nuevo
— o sea que `read-surfaces-leak.test.ts` es **lo unico** que separa Stripe del navegador. **Esa
afirmacion la tiene que reproducir el revisor**, no la doy por buena.

### CONTRADICCION RESUELTA POR EL ORQUESTADOR — el anexo se contradecia a si mismo

El implementador **paro y no eligio**, que es lo correcto. La spec §D1 decia «`suspensionReason`
solo para `role === 'owner'`, **identico a `auth-guards.ts`**» y el anexo §1 decia «string **SOLO si
`status='suspended'` Y `role='owner'`**».

**Medido: el que se contradecia era el ANEXO, consigo mismo.** Su comentario del JSON pedia las dos
condiciones; su **nota 2** decia «es la misma regla de `requireBackofficeSession`», y ese guard
condiciona **solo por rol** (`auth-guards.ts:163`). **Gana el rol**: dos de las tres afirmaciones
del contrato ya lo decian y la ruta tiene que resolver igual que el guard. El anexo quedo corregido.

**Y de ahi salio un invariante nuevo para quien haga la UI, porque el estado ES alcanzable:**
`suspension_reason` **no tiene ningun CHECK que la ate al `status`** (migracion `0036`), asi que un
negocio reactivado puede quedar `active` **con el motivo viejo escrito**. **La UI decide por
`status`, NUNCA por la presencia de `suspensionReason`.** Escrito en el anexo.

### HALLAZGOS DEL IMPLEMENTADOR PENDIENTES DE AUDITORIA DEL REVISOR

1. `/api/onboarding/state` trata una **membresia no `active`** igual que «sin negocio». Es una
   **decision del implementador declarada**, no del owner; el anexo §3 no se pronuncia.
2. `billing-routes.test.ts` estaba en **313 lineas antes** de esta spec (limite del hook: 300) y
   quedo en **329**. **Deuda pre-existente que empeoro**, no creada por la spec. `CLAUDE.md` dice
   «dividir, no extender» — dividir un archivo con PASS de revisor esta fuera de la autorizacion
   que se le dio. **Queda como hallazgo a decidir.**
3. Efecto colateral sobre trabajo ajeno: `next-env.d.ts` estaba modificado por quien hizo la UI y
   `pnpm run build` —gate obligatorio— lo **regenero**. Se recupera solo en el proximo
   `next dev`/`build` de esa persona. Reportado sin arreglar, que es lo correcto.

### EL PASS DEL REVISOR, Y LOS DOS HALLAZGOS QUE VOLVIERON AL IMPLEMENTADOR (2026-09-18)

**Veredicto: PASS.** El revisor corrio los gates por su cuenta y su medicion **coincide con la
mia**: `211 archivos / 1631 tests passed · 0 skipped · 0 failed`, `build --force` con las tres
rutas saliendo `ƒ (Dynamic)`, `rg MUTATION` vacio. Gasto **4 mutaciones del presupuesto + 1
declarada fuera**, y las cuatro dieron rojo por la asercion correcta.

**AUDITO LOS CUATRO HALLAZGOS DEL IMPLEMENTADOR y los cuatro resultaron ciertos**, incluido el
mas importante: con `toSubscriptionView` sustituido por `row`, **`billing-routes.test.ts` y
`billing-view.test.ts` quedan VERDES** y solo muerde el oraculo nuevo. O sea que
`read-surfaces-leak.test.ts` **es lo unico que hay entre Stripe y el navegador**, y ademas la
asercion de **conjunto exacto de claves** hace trabajo que el barrido de valores-centinela no
hace: el revisor lo probo agregando una clave **sin valor secreto** (`subscription.businessId`) y
el test de valores quedo verde mientras el de claves se puso rojo.

**HALLAZGO 1 — un invariante escrito SIN ORACULO. Reproducido por el orquestador, y mas fuerte
que la medicion del revisor.** El filtro de membresia de `/api/onboarding/state`
(`route.ts:54`) implementa lo que la spec §D1 declara contrato, pero borrarlo no rompe nada:

```
MUTATION MO1:  const business = row ?? null;
pnpm run test (con Neon)  →  211 passed (211) · 1631 passed (1631)
```

**Cero rojos sobre 1631 tests.** Revertida con `diff` vacio y shasum `228340715985111e…`
coincidente. **Consecuencia: un integrante dado de baja leeria `id`, `name` y `slug` del negocio
por esta puerta y no por la otra** — textualmente lo que el docblock dice que evita. El codigo de
hoy esta bien; falta lo que impide que mañana se caiga en silencio. **Volvio al implementador.**

**HALLAZGO 2 — el anexo declara menos estados de los que la ruta emite. Reproducido contra el
codigo.** `0074-contratos-de-api.md:231` dice `Status posibles: 200, 401, 403` para
`GET /api/billing/state`. Es falso: la ruta envuelve en `billingErrorResponse`, que emite **503
`unavailable`** (`billing/_auth.ts:103-104`) y **503 `subscription_unavailable`** (`:165-166`).
El preambulo del propio anexo dice que un `code` que la ruta emite y el contrato no declara es
**FAIL de revision**. **Volvio al implementador.**

**LOS DOS HALLAZGOS: CERRADOS Y VERIFICADOS POR EL ORQUESTADOR (2026-09-18).**

- **Hallazgo 1, cerrado con DOS oraculos.** El implementador no solo agrego el caso Neon
  (`seedMember({ status: "disabled" })` → `business: null` Y `program: null`, **verificando por SQL
  que el programa existe** para que el `program: null` no sea vacuo): agrego un **segundo oraculo
  que NO depende de Neon** —un 4º estado en el barrido unitario— y subio el piso de 3 a 4. La
  mutacion `row ?? null` ahora da **rojo 2 de 14**, y la asercion muestra la fuga exacta: el
  integrante dado de baja leia `id`, `name`, `slug` **y el programa entero**.
- **Hallazgo 2, cerrado.** El anexo declara las dos filas de `503` con sus `code` reales
  (`subscription_unavailable` y `unavailable`) y §5 pasó a «200, 401, 403, **503**». Se acepto
  ademas una linea de contrato que el implementador marco como dudosa: **«un 503 NO es 'no tenes
  plan', es 'no lo pudimos leer'; la UI nunca degrada a mostrar `free`»**. **No es una decision de
  producto**: es la semantica del codigo escrita para que quien haga la UI no le invente al comercio
  el estado de su plata.

**DESINCRONIZACION DEL SUBAGENTE, aclarada:** el implementador volvio a reportar la contradiccion de
`suspensionReason` como abierta. **Ya no lo esta** — se resolvio mientras el corria. Verificado:
`session-view.ts:107` es `row.role === "owner" ? … : null`, la misma expresion que
`auth-guards.ts:163`, y el anexo ya dice «solo para `role='owner'`». Su reporte venia de su contexto
anterior, no del arbol.

**ESTADO SUPERADO (queda como registro de lo que se midio en vuelo):**

- **Hallazgo 1: el caso YA ESTA ESCRITO.** `onboarding-state.neon.integration.test.ts:164` —
  `it("membresia NO active: business: null Y program: null, con el programa EXISTIENDO")`,
  sembrando `seedMember({ businessId, status: "disabled" })`. **Falta que el implementador pruebe
  que MUERDE** contra la mutacion `row ?? null`, con su asercion literal.
- **Hallazgo 2: HECHO.** El anexo ya declara el `503` (`grep -c 503` → **5**). Falta que el
  orquestador verifique que las filas dicen los `code` reales (`unavailable`,
  `subscription_unavailable`) y que §5 pasara de «200, 401, 403» a incluir el 503.

**NINGUNO DE LOS DOS ESTA CERRADO. La 0074 NO se marca `implementada` hasta que los dos cierren y
la suite quede verde** (baseline a superar: 211 archivos / 1631 tests; con el caso nuevo tiene que
dar **1632**).


**LIMITES QUE EL REVISOR DECLARO Y NO PERSIGUIO** (intentados antes de declararse):
- **La corrida AISLADA de un test neon es flaky**: en una, el `beforeAll` se paso de timeout y
  dejo 8 tests `skipped` (658s contra ~9s). **La medicion que manda es la de suite completa.**
  Dato operativo util para el proximo que mida mutaciones contra Neon.
- Una fuga que **reemplace** el valor de una clave ya declarada por un interno cuyo valor no esta
  en la lista de centinelas **no la caza** el oraculo (mismo conjunto de claves). Clase de
  preimagen por transformacion: el ADR 0062 dice que no se cierra por iteracion.
- El oraculo de fuga es un unit con `getDb` doblado: pinnea la **forma**, no que las rutas lean de
  la base lo que dicen. Eso lo cubren los tres neon.

## ⇥ ⚠️ LA SUITE LOCAL NO ES UN ORACULO CONFIABLE SI LA CORRES MAL (2026-09-18)

**Esto le cuesta una hora a quien lo herede sin saberlo, y casi entra a un reporte al owner como
«bug del producto».**

**Lo medido, con su cronologia exacta:** para no pisar a un subagente puse un **poll en background
que corria `pnpm run test`** cada tanto, y despues corri la suite yo en primer plano. **Las dos
contra la MISMA rama Neon.** Resultado:

```
poll [1] 11:00:49 roja
poll [2] 11:04:56 roja   <- mi corrida 11:05:33 → 2 failed
poll [3] 11:08:50 roja   <- mi corrida de grep en esa ventana → FAIL marketing-placement
poll [4] 11:12:44 roja   <- mi corrida 11:13:02 → 1634 passed, 0 failed
```

**En cada par una de las dos pierde**, y el par final lo prueba: dos corridas sobre el **mismo
arbol**, una roja y una verde. El sintoma en el log es `marketing_tick {"skipped":"tick_in_flight"}`
— otra corrida tenia el lock.

**Y LO QUE NO ESTA PROBADO, declarado como tal.** Una corrida limpia dio rojo igual, en OTRO test
(`consumer-recovery`, el del limite «3/hora»), despues de ~8 suites en 45 minutos. Arme una
explicacion —paralelismo entre archivos contra rama compartida, citando el comentario de
`vitest.config.ts` que dice que las `.neon.integration` «borran mundos enteros contra una rama Neon
compartida»— y **al ponerla a prueba NO reprodujo**: los tres archivos sospechosos juntos en
paralelo dieron **3 passed / 17 tests**. **El mecanismo de ese rojo quedo SIN identificar.** Lo
unico consistente con el es estado acumulado en una ventana horaria que despues rodo, y eso
**tampoco esta probado**.

**LA MEDICION LIMPIA, que es la que vale:** sin nada mas corriendo y con la ventana rodada,
**dos corridas completas consecutivas → 1634 passed, 0 failed las dos**, mas `typecheck --force`,
`lint`, `format:check` y `build --force` verdes, y `rg MUTATION apps tools` vacio.

**LAS DOS REGLAS OPERATIVAS** (la leccion completa esta en `LECCIONES.md`):
1. **Nunca corras la suite mientras otra corrida de la suite esta viva.** Si hay un poll en
   background, matalo antes de medir.
2. **Un rojo intermitente se REPRODUCE, no se explica.** Si el experimento que separa tu hipotesis
   de su alternativa no reproduce, lo que corresponde es declarar que no identificaste el mecanismo.

**Y la consecuencia para el QA:** la verificacion que manda no es la suite local sino **CI sobre el
commit pusheado**, leida de `/check-runs` para el sha exacto — nunca `/status`, que en este repo
devuelve `success` con la CI todavia corriendo.

## ⇥ LA 0075 — EL QR SIN GATE DE EMAIL: implementada y EN REVISION (2026-09-18)

**Decision del owner, textual:** «directamente quita el QR del gate de email verificado… simplemente
lo quitas y el QR siempre puede ser solicitado por el owner de su negocio, simple». **Sin regla
condicional.**

**LO QUE REPRODUJE YO** (no lo que reporto el subagente), con `pgrep -fl vitest` verificado en
**ninguna corrida viva** antes de medir:

| Que | Medido por el orquestador |
|---|---|
| Suite con Neon | **211 archivos / 1637 tests passed · 0 failed · 0 skipped** (baseline previa: 1634) |
| `typecheck --force` · `lint` · `format:check` · `build --force` | los cuatro verdes |
| `rg -n MUTATION apps tools` | **vacio** |
| **`requireApiOwner` intacto** | `git diff --numstat api-owner.ts` → **85 inserciones, 0 borrados**; `git diff -U0 \| grep -c '^-[^-]'` → **0** |
| **La hermana la consume UNA sola ruta** | 3 hits en 2 archivos: su definicion (`api-owner.ts:164`) + el import y la llamada del QR. Ninguna otra |
| `emailNotVerified` en el dir del QR | **vacio** |
| Pisos del barrido | `SURFACES.length === 12`, `CON_GATE === 11`, `SIN_GATE === 1`, `11+1 === 12`, y `SIN_GATE[0][0] === "loyalty-program/qr"`. **Las dos tablas salen de `SURFACES` por FILTRO**, no son listas paralelas |

**Las 3 mutaciones del presupuesto, ejecutadas y revertidas**, atacan el riesgo real —que al sacar
el paso del email se caiga otro—: M1 (volver a poner el gate) → **4 rojos**; M2 (saltear el paso 2,
owner activo) → **1 rojo, en la fila del QR**; M3 (saltear el paso 4, eje `status`) → **3 rojos, los
tres en la fila del QR**.

**⚠️ TERCER ERROR DEL ORQUESTADOR EN UNA SPEC, reportado por el implementador: la 0075 §D1 se
contradice con su propio Alcance y su DoD.** §D1 pedia «cuerpo comun» entre las dos funciones; el
Alcance y el DoD exigen `requireApiOwner` **byte por byte igual**, y un cuerpo comun obliga a
reescribir su cuerpo para que delegue. El implementador **resolvio por el criterio binario** (que es
el correcto: es el verificable) y dejo duplicados **solo los `return` del fallo**, compartiendo las
piezas que DECIDEN (`ownerContext` del paso 2 y `businessStatusFailure` del paso 4). **Pendiente de
auditoria del revisor.** Van tres specs seguidas donde el error estuvo en la spec, no en el codigo.

**Hallazgos del implementador pendientes de auditoria:**
1. Corrigio `0069-contratos-de-api.md` §5 agregando `business_suspended`/`business_closed`, que la
   ruta emite desde la 0072 y el contrato **no declaraba**. Correccion extra dentro del archivo
   autorizado.
2. `api-owner-surfaces.test.ts` quedo en **293 lineas** (limite del hook: 300). **La proxima
   superficie que se agregue a esa tabla lo pasa** — ahi aplica «dividir, no extender».
3. Edito `api-owner.ts` DESPUES de revertir M3, **solo un comentario** (3 lineas, cero codigo).
   Declarado por el, a verificar por el revisor.
4. El barrido unitario dobla `programForOwner` y `getDb` porque **el QR es la unica fila de la tabla
   que pasa el gate** y por lo tanto la unica que llega a su dominio. Sin los dobles el test daria
   verde **por motivos distintos segun el entorno**. Decision suya, declarada.

**CONFIRMACION INDEPENDIENTE DEL FLAKE:** el implementador se topo con el mismo rojo ajeno
(`consumer-recovery.neon > enforces 3/hour persistently`) y **lo reprodujo en vez de explicarlo**:
aislado **8/8 verde**, y las dos corridas completas siguientes **1637/1637**. Refuerza que el
mecanismo sigue **sin identificar** y que no tiene relacion con el codigo.

**PASS DEL REVISOR INDEPENDIENTE (2026-09-18).** Sus 3 mutaciones propias —distintas de las del
implementador— atacaron lo que faltaba: **R1** (romper el `suspensionReason` en la COPIA del paso 4
de la hermana) → rojo **solo en la fila del QR**, con las otras 11 verdes; **R2** (dejar vacia la
tabla de la excepcion) → rojo en el piso, y el conteo lo prueba: **84 tests bajo la mutacion contra
86 limpios**, o sea que los dos `it.each` desaparecieron **sin ruido** y lo unico que lo delata es
el piso; **R3** (romper el paso 1, la sesion, con un fallback SILENCIOSO en vez de un crash, para
exigirle al oraculo distinguir 401 de 403) → rojo en los dos oraculos.

**Verifico ademas lo que yo no habia verificado:** que `requireApiOwner` esta intacto **por shasum
de su cuerpo** (`b90b285f…` identico contra `git show HEAD:`), no solo por el numstat; que la
edicion post-mutacion del implementador era **comment-only** (`diff` de un solo hunk, integro dentro
del `/** */`, cero codigo); y que el hook de tamaño **discrimina** (control de 301 lineas → `EXIT=2`
con su mensaje; de 299 → `EXIT=0`).

**Corregido por el orquestador tras su hallazgo cosmetico:** `0069-contratos-de-api.md:350` decia
«los otros **cuatro** desenlaces» y son **cinco**.

**Metricas ADR 0071 de la 0075** (anotadas al llegar cada notificacion):

| Metrica | Implementador | Revisor |
|---|---|---|
| `subagent_tokens` | 153.249 | **96.310** |
| `tool_uses` | 44 | **41** |
| `duration_ms` | 1.505.866 (25m06s) | **716.218** (≈ **11 min 56 s**) |

**Contraste con la 0074, que es el dato del ADR 0071:** en una spec CHICA el revisor costo **63%
de los tokens y la mitad del tiempo** del implementador; en la 0074 (spec grande) habia costado 71%
de los tokens y **mas** tiempo que implementar. **La revision independiente escala mejor que la
implementacion**: cuanto mas acotada la spec, mas barata es en proporcion.

## ⇥ EL ARCO DEL PROGRAMA DE FIDELIZACION — lo que el owner abrio el 2026-09-18, MEDIDO

**El owner pidio revisar «como funciona la creacion y administracion del programa de afiliados» y
generar las API para que esas acciones sean posibles desde una UI nueva, una app mobile o un POS.**
Su premisa textual: *«hoy creo que cubrimos una parte (no se cual), pero falta poder editar el
programa, poder ordenar el cierre del programa, poder asignar un premio del catalogo, poder cambiar
el nombre de los puntos»*.

**MEDIDO CONTRA EL ARBOL EL 2026-09-18, y corrige la premisa: cuatro de esas cinco YA EXISTEN.**

| Lo que el owner pidio | Estado real, medido | Donde |
|---|---|---|
| **Editar el programa** | **YA EXISTE** | `PUT /api/loyalty-program` → `saveProgram`, con el `ProgramInput` entero |
| **Ordenar el cierre** | **YA EXISTE**, y ademas se puede **cancelar** | `DELETE /api/loyalty-program` → `closeProgram(earningEndsAt, redemptionEndsAt)`; `PATCH {action:'cancel-close'}` → `cancelClose` |
| **Premio del catalogo** | **YA EXISTE** | `rewards.ts:43` acepta `catalog_product`, `custom` y `discount` |
| **Cambiar el nombre de los puntos** | **YA EXISTE** | `configuration.unitName` (`validation.ts:100,161`) |
| **Elegir tipo de programa** | **A MEDIAS, y es el unico hueco real de los cinco** | `PUT` acepta el `kind`, pero `validation.ts:12` habilita **solo `points` y `stamps`**. `cashback` y `tiers` estan en el `CHECK` del esquema y **no** en el dominio. Y el wizard (`POST /api/onboarding/program`) **fija `stamps`**, por decision del ADR 0070 §1 |

**ENTONCES EL PROBLEMA NO ES QUE FALTEN OPERACIONES: ES QUE NO SE PUEDEN CONSUMIR DESDE AFUERA.**
Los dos huecos que si son reales, y los dos ya estaban medidos y declarados:

1. **Las 5 rutas del programa responden sus errores SIN `code`**, contra la convencion del contrato
   0067 («todo error responde `{error, code}`»). Esta declarado con su tabla en
   `specs/0069-contratos-de-api.md` §«Estado actual declarado». **Consecuencia exacta para una UI,
   una app mobile o un POS:** hay que discriminar por **status**, y dentro de un mismo status por el
   **texto** de `error`, que es copia y puede cambiar. **Es el bloqueante real del pedido del
   owner**, mucho mas que las operaciones.
2. **No hay anexo de contrato para la administracion del programa.** El 0069 contrato los 5
   endpoints del wizard (`prefill`, `business`, `program`, el sello publico y el QR); los cuatro
   verbos de `/api/loyalty-program` **no tienen su contrato escrito**. Es el mismo hueco estructural
   que la 0074: el contrato existe solo donde paso una spec.

**⚠️ Y UN HALLAZGO DE PROCESO:** el hueco 1 dice textualmente «**Candidato a la fila 56 de
`PARQUEADO.md`**» — y **esa fila nunca se escribio** (verificado: `grep` de «sin `code`» en
`PARQUEADO.md` no devuelve nada; las filas 56 y 57 son otras cosas, absorbidas por la 0072). O sea
que un hallazgo medido quedo flotando **solo dentro de un anexo de contrato**, que es justo el lugar
donde nadie lo busca.

**LO QUE ESTO CAMBIA PARA EL ARCO:** el pedido del owner probablemente **no** es un rediseño del
dominio, sino **(a)** ponerle `code` estable a las 5 rutas, **(b)** escribir su anexo de contrato,
y **(c)** una decision de producto sobre el tipo de programa en el wizard. Eso es mucho mas barato
que «rediseñar la creacion y administracion». **Pero es una lectura del orquestador, no una decision
del owner**: la decision de si se rediseña o se contrata lo que ya hay **es suya y no esta tomada**.

### DECISIONES DEL OWNER DEL 2026-09-18 SOBRE EL ARCO, Y LO MEDIDO QUE LAS CONDICIONA

**1. El wizard tiene que dejar elegir el tipo de programa** entre los que haya disponibles.
Textual: «El wizard deberia poder elegir el tipo sobre todos los que tenemos disponibles: sellos,
puntos, cashback, tiers». **Esto REEMPLAZA el prellenado «Sellos» del ADR 0070 §1** y necesita su
propio ADR antes de cualquier spec.

**LO MEDIDO, que ordena el costo de cada tipo y no es parejo:**

| Tipo | Estado real en el arbol | Que cuesta habilitarlo |
|---|---|---|
| **stamps** | vivo y en produccion | nada |
| **points** | **el dominio YA lo valida entero** (`validation.ts:12` lo habilita; `accrual.ts:23` le exige `per_amount`; `rewards.ts` le calcula `pointsCost`) | **contrato + composer del wizard.** Es el barato |
| **cashback** | **NO EXISTE.** Los unicos hits son el literal en `LoyaltyKind`, un `if` de la allow-list y el `CHECK` del esquema. **Cero comportamiento** | **dominio nuevo**: acumulacion, canje y —lo caro— **semantica de PLATA**. No es un endpoint |
| **tiers** | idem: literal, `if`, `CHECK`. Cero comportamiento | **no deberia ser un `kind`** — ver abajo |

**2. Y el propio owner puso en duda que `tiers` sea un programa.** Textual: «un sistema de tier
puede no ser en si un programa de fidelizacion como sellos o puntos, mas bien puede ser algo
diferente, que es una "categorizacion" de los consumidores, una segmentacion para saber que
consumidores son los de mas valor para un merchant».

**SU INTUICION LA CONFIRMA EL ESQUEMA, y este es el dato que cierra la discusion:**
`schema/loyalty.ts:137` tiene **`core_loyalty_program_one_operational`**, un indice unico PARCIAL
sobre `business_id` donde `status in ('active','closing')`. O sea **un solo programa operativo por
negocio, enforced en la base**. Si `tiers` siguiera siendo un `kind`, **elegir tiers significaria
RENUNCIAR a sellos o puntos** — que es exactamente lo contrario de para que sirve una
segmentacion, que tiene que convivir con el programa. **`tiers` sale del enum de `kind`.**

**3. Y NO ES GREENFIELD: la mitad ya existe, en marketing.** `marketing/audience.ts` carga por
membresia los hechos de las seis reglas de exclusion, e incluye **`max(order.created_at)`** — la
RECENCIA— porque la campaña «dormidos» ya segmenta por eso. **«Dormidos» ES un segmento y ya
funciona.** Lo que falta son los otros dos ejes del modelo clasico **RFM** (frecuencia y monto) y
un concepto de segmento con nombre y persistencia. **Generalizacion de algo medio construido, no
una feature nueva.**

**PROPUESTA DE NOMBRE DEL ORQUESTADOR (el owner pidio sugerencia, NO es decision suya):** llamar
**«Segmentos»** a la feature —generaliza «dormidos», que ya existe— y reservar **«Niveles»** para
un mecanismo de tier visible al consumidor, si algun dia se construye. Son **dos cosas distintas**
y conviene que tengan dos nombres: el segmento lo ve el COMERCIO y se deriva del comportamiento;
el nivel lo ve el CONSUMIDOR y es una promesa.

**USOS SUGERIDOS que se apoyan en superficie que YA existe** (sugerencia, no decision):
- **Targeting de campañas**: un segmento es una regla mas en `audience.ts`. Es el mas barato.
- **Recuperacion de fugados**: «era frecuente y dejo de venir» sale casi gratis — `lastOrderAt` ya
  se carga por membresia.
- **Señal en el MOSTRADOR**: que el staff vea «cliente top» al escanear. `/api/counter/resolve` ya
  existe y ya resuelve al consumidor.
- **Premios diferenciados**: `rewards[]` ya admite varios premios con `pointsCost`; gatear uno por
  segmento es extension natural.
- **Control de costo**: la cuota de campañas del plan free es finita; gastarla primero en el
  segmento de mas valor.

**NADA DE ESTO TIENE ADR NI SPEC TODAVIA. No se escribe codigo hasta que el owner cierre: (a) si
`tiers` sale del enum, (b) que tipos entran al wizard en la primera tanda, y (c) si «Segmentos» es
un arco aparte o entra con el del programa.**

**LO QUE HAY QUE PREGUNTARLE, concreto:**
- ¿El wizard tiene que ofrecer **elegir el tipo** de programa? Puntos = trabajo de contrato (el
  dominio ya lo valida); **cashback = dominio nuevo**, no un endpoint.
- ¿Alcanza con contratar y estabilizar lo que ya existe, o hay algo del comportamiento actual que
  querés cambiar? Si es lo segundo, eso si es un **ADR** antes de cualquier spec.

## ⇥ ARRANCA ACA LA SESION QUE SIGUE (handoff del 2026-09-18)

**EL OWNER SE FUE A CONSTRUIR LA UI CON CHATGPT.** El arco 2 esta cerrado, verificado y en
produccion (ver la tabla de ESTADO REAL de arriba). **No hay codigo pendiente.** Lo que sigue
depende de que el owner vuelva con la UI del wizard construida.

**LO QUE PIDIO PARA CUANDO VUELVA, en su orden y textual** (2026-09-18) — **son cinco APIs, y las
decisiones de contenido NO estan tomadas todavia**:

1. **API de verificacion de email** (para el onboarding). **⚠️ MEDIDO: YA EXISTE ENTERA.**
   `POST /api/merchant/auth/verify-email` emite (contrato 0067 §7, toma el email de la SESION, no
   del body) y `GET /api/merchant/auth/magic-link` consume **y es lo que pone `emailVerified: true`**.
   El gate ya corre en las 10 superficies desde la 0072. **Lo que queda no es construirlo sino una
   decision del owner:** si le sirve que la verificacion ocurra como efecto de consumir un link de
   login, o quiere un link SOLO de verificacion, separado del de entrada. **Preguntarselo antes de
   escribir una linea.**
2. **API de marca** — editar todo lo de la marca de un merchant: imagenes, colores, nombre.
3. **API de locales** — alta, baja, modificacion, **y limites segun el plan**.
4. **API de staff** — alta, baja, modificacion, **y limites segun el plan**. **Medido: las 4 rutas
   de CRUD YA EXISTEN** (contrato 0067); lo que falta son los limites por plan, porque la 0072
   midio que **staff no tiene tope por plan hoy**.
5. **API de catalogo de productos (mini-POS)** — alta, baja, modificacion de productos y categorias,
   **con una capa de IA AGNOSTICA del modelo**: se le manda una foto y devuelve JSON para generar el
   catalogo. **Medido: hay 6 rutas de catalogo vivas** pero **ninguna pasa por el catalogo de
   entitlements**, y productos tampoco tiene tope por plan.

**PIEZA 0 PROPUESTA, a confirmar con el owner antes de empezar: `GET /api/merchant/session`** (ver
la seccion de decisiones de UI). Las cinco pantallas de arriba la van a necesitar.

**LO PRIMERO AL RETOMAR, antes de cualquier spec:** el owner vuelve con `docs/api-faltante.md`
escrito por ChatGPT — el encargo se lo pide explicitamente. **Esa lista es el insumo real del
alcance**, y hay que leerla ANTES de elegir por donde empezar: puede reordenar las cinco.

**Y la regla que aplica a esa lista:** un endpoint que ChatGPT diga que falta es **una afirmacion
suya, no una verificacion**. Se reproduce contra el arbol antes de que entre a una spec — igual que
se hizo con los cinco puntos de arriba, donde medir corrigio dos (el 1 ya existe, el 4 esta a
medias).

## ⇥ LA 4ª SPEC (onboarding derivado) — DIFERIDA, con lo medido el 2026-09-18

**No existe el archivo de spec.** Lo unico escrito son ~8 lineas del ADR 0070 **§9** (el checklist
derivado de los hechos) y **§11** (verificar el email es su primer paso). Eso es el QUE, no un plan.

**Medido en el arbol el 2026-09-18, para no re-medirlo:**
- **No existe columna `onboarding_step`** (bien: el ADR la prohibe). Los dos hits de «onboarding»
  en el esquema son `onboarding_token_hash`, del arco de recuperacion del **consumidor**: vivo y
  otro dominio.
- **Cero codigo de checklist** en `apps/merchant/src`. Greenfield.
- La superficie `onboarding` de hoy es **solo el wizard**: `prefill`, `business`, `program`.

**Los 8 items del §9 contra los hechos que existen — y DOS NO CIERRAN:**

| Item | Hecho | ¿Deriva? |
|---|---|---|
| Logo | `business.logo_object_key` (nullable) | si |
| **Colores** | `brand_primary/complementary/accent_color` | **NO — `notNull` con DEFAULT** |
| Sello propio | `loyalty_program.stamp_image_object_key` (nullable) | si |
| Catalogo | filas en `product` | si |
| Costos | `product.unit_cost` (nullable) | si, pero sin criterio definido |
| Staff | `business_membership` con rol staff | si |
| Mas locales | `location` > 1 | si |
| **Wallet** | `wallet_pass` | es un hecho **del consumidor**, no del comercio |

**EL AGUJERO CENTRAL: los colores NO son derivables.** Nacen con valor (`#176548`, `#2D8B68`,
`#E78132`), asi que **no hay forma de distinguir «el owner eligio su marca» de «nunca la toco»**.
El unico proxy es `brand_revision` (default `1`) o `logo_version` (default `0`) — inferir por un
contador de revision, que es justo la clase de cosa que el ADR quiso evitar. **Rompe la premisa del
§9 y no se arregla escribiendo codigo**: o se acepta el proxy, o sale el item, o entra una columna
(y ahi la spec deja de ser sin-migraciones).

**LAS SEIS DECISIONES DEL OWNER QUE LA DESTRABAN** (ADR 0071 §2: se piden ANTES de la prosa):
1. **Colores**: ¿proxy por `brand_revision`, se saca del checklist, o una columna?
2. **Wallet**: ¿cual es el hecho? ¿Sigue siendo un item si depende de un tercero?
3. **Costos**: ¿alcanza UN producto con `unit_cost`, o todos?
4. **Que significa «completo»** en los otros cinco (¿un local mas o dos? ¿un integrante, o uno que
   ya entro?).
5. **¿Bloquea o solo ordena?** El §11 dice «sin eso no avanza el resto», pero **el gate de email ya
   esta implementado** (la 0072, en `requireApiOwner`, 10 superficies). O sea que la 4ª spec seria
   solo el **LECTOR**, no el gate. Confirmarlo.
6. **Es API, no pantalla** (ADR 0070 §16), aunque el §9 diga «checklist en el backoffice»: entrega
   un `GET` del estado derivado + su contrato.

**Plantilla: `TEMPLATE.md`, NO la chica.** Falla dos de las tres condiciones del ADR 0071 —varios
dominios (marca, catalogo, staff, locales, loyalty, wallet) y decisiones de producto abiertas—; si
los colores terminan pidiendo columna, falla las tres.

## ⇥ BITACORA DE MUTACIONES — spec 0072 (implementador, 2026-09-17)

**Presupuesto: 7 mutaciones** (M1-M7 de la §Plan de pruebas de la spec). Las filas se abren
ANTES de medir. **Restauracion de emergencia:** los archivos nuevos (`??`) tienen copia limpia
en `/tmp/spec0072-clean/`; los modificados (` M`) se restauran con `git checkout --` SOLO si no
hay otro trabajo sin commitear en ellos (hoy SI lo hay: el paso 1 de la spec).

| id | archivo | shasum limpio | invariante que ataca | alcance medido | resultado EJECUTADO |
|---|---|---|---|---|---|
| M1 | `server/api-owner.ts` | `ba2daa879915e807077311ac7b3b189f9b3c446d` | el eje `status` se lee en `requireApiOwner`: una API del owner frena en un negocio `suspended`/`closed` | suite entera (203 archivos, con Neon) | **ROJO 38 tests / 1 archivo** (`api-owner-surfaces.test.ts`): los 3 casos de estado × las 12 entradas HTTP. Aserciones: `AssertionError: expected 400 to be 403`, `expected 503 to be 403`, `expected 422 to be 403` — sin el paso 4 el request sigue de largo hasta el dominio. Revertida desde `/tmp/spec0072-clean/api-owner.ts`, `diff` limpio, shasum `ba2daa87…` |
| M4 | `app/api/merchant/auth/magic-link/route.ts` | `6b10503a827f29f413f4b175b8e1be3783291ad2` | el corte de `closed` en el CONSUMO del link magico: el owner de un negocio cerrado no obtiene sesion | suite entera (203 archivos, con Neon) | **ROJO 2 tests / 1 archivo** (`magic-link-business-closed.neon.integration.test.ts`). Asercion: `AssertionError: expected '/backoffice' to be '/?e=business_closed' // Object.is equality`; el 2.º caso cae con `expected 2 to be 1` porque la sesion creada tampoco se revoco. Revertida, `diff` limpio, shasum OK |
| M5 | `app/api/counter/_auth.ts` | `229cc5532a75d0db579dd2cc72fa0914f288af39` | el guard va en CADA superficie y no solo en la puerta: una sesion de staff YA VIVA no acredita en un negocio suspendido (el hueco de los 7 dias) | suite entera (203 archivos, con Neon), medida DOS veces | **ROJO 2 tests / 1 archivo** (`business-status.neon.integration.test.ts`). Asercion (2.ª medicion, con la etiqueta puesta): `AssertionError: el mostrador dejó pasar una sesión de staff YA VIVA en un negocio SUSPENDIDO: expected false to be true // Object.is equality` y su gemela `… en un negocio CERRADO`. Revertida, `diff` limpio, shasum OK |
| M2 | `server/api-owner.ts` | `ba2daa879915e807077311ac7b3b189f9b3c446d` | el gate de email verificado corre en las 10 superficies, incluida billing (que hoy no lo tiene) | suite entera (201 archivos) | **ROJO 28 tests / 4 archivos**: `api-owner-surfaces.test.ts` (las 12 entradas, incluida `billing/checkout`), `staff-gate.test.ts`, `staff-list.neon`, `business-slug.neon`. Asercion sobre billing: `AssertionError: expected 400 to be 403 // Object.is equality`. Revertida, `diff` limpio, shasum OK |
| M3 | `server/api-owner.ts` | `ba2daa879915e807077311ac7b3b189f9b3c446d` | el ORDEN de §D1: el email se evalua DESPUES de resolver owner, o un integrante recibe `email_not_verified` en vez de `not_owner` | suite entera (201 archivos) | **ROJO 18 tests / 5 archivos**: `api-owner-surfaces.test.ts` (las 12), `staff-gate.test.ts`, `staff-list.neon`, `staff-pin-change.neon`, `business-slug.neon`, `billing-routes-auth.neon`. Asercion: `AssertionError: expected 'email_not_verified' to be 'not_owner' // Object.is equality`. Revertida, `diff` limpio, shasum OK |
| M6 | `server/entitlements/catalog.ts` | `e592b5aa51d7553a720585bfdb3a61dbf552f785` | `campaigns.enabled` exige suscripcion VIVA: un `plus` forma A1 (sin `stripe_subscription_id`) no activa campañas | suite entera (200 archivos) | **ROJO 4 tests / 2 archivos.** `marketing/plan-gate.test.ts` (A1, `canceled`, `incomplete_expired`) + `entitlements-catalog.test.ts`. Asercion: `AssertionError: expected true to be false // Object.is equality`. Revertida, `diff` limpio, shasum OK |
| M7 | `server/entitlements/catalog.ts` | `e592b5aa51d7553a720585bfdb3a61dbf552f785` | el catalogo es la FUENTE del tope de locales, no una copia muerta | suite entera (200 archivos) | **ROJO 22 tests / 9 archivos**, unit + Neon: `locations.test.ts` `AssertionError: expected 2 to be 1`, `locations-plan-cap.test.ts` `expected { limit: 2, pendingDowngrade: true } to deeply equal { limit: 1, pendingDowngrade: true }`, `locations-limits.neon` `promise resolved "{ …(4) }" instead of rejecting`, `billing-plan-change.test.ts` `expected [ { input: { …(8) }, …(2) }, …(1943) ] to deeply equal []`. Revertida, `diff` limpio, shasum OK |

## ⇥ LA 3ª SPEC DEL ARCO: la 0072 esta `cerrada` y en implementacion (2026-09-17)

### ⇥ LA 0072 ESTA `implementada` — PASS de revisor independiente (2026-09-17)

**PASS.** Un solo ciclo: el revisor no abrio FAIL. Gasto sus **4 mutaciones** y la condicion de
corte no se aplico. **SIN COMMITEAR** — 58 archivos en el diff, `HEAD` en `5f89d18`.

**Gates al momento del PASS** —corridos por el orquestador DESPUES de sus propios cambios, porque
el PASS del revisor no cubria lo que el orquestador toco despues—: `typecheck --force` **3/3 sin
cache** · `lint` exit 0 · `format:check` OK · **`test` con Neon: 203 archivos / 1584 passed / 0
failed** · `build --force` **3/3 sin cache** · `rg MUTATION apps` **vacio**. El **`build` era la
unica señal del DoD que nadie habia observado**: el revisor lo declaro afuera.

**⚠️ ESE `1584` ES HISTORICO, NO LA CIFRA FINAL.** Despues del PASS vinieron dos cierres pedidos
por el owner —F1 y el landing del enroll—, cada uno con sus tests, y **los gates se re-corrieron
enteros despues de cada uno**. La cifra vigente es **1590** (§«F1 CERRADO» y §«CERRADO — el landing
publico»). Los `1584` de este archivo son el estado de una corrida anterior y se dejan con su
fecha: un numero viejo etiquetado es historia; reescrito, es una mentira sobre cuando se midio.

#### ✅ F1 CERRADO — decision del owner del 2026-09-17 («cerralo ahora»)

**El agujero:** `POST /api/onboarding/program` llamaba a **`saveProgram`** (`route.ts:53`), **el
MISMO writer** que la ruta gateada `PUT /api/loyalty-program` (`route.ts:60`), con solo
`getSession`. Con el negocio en `suspended` respondia **200 con `created: false`** —o sea UPDATE—
mientras la gateada contestaba **403**. Lo cazo el revisor y lo reprodujo el orquestador.

**Y NO era una decision de producto abierta, que es como el orquestador lo habia planteado mal:**
la regla textual del owner para `suspended` ya decia «no pueden … **cambios en programa**». Era
un **incumplimiento**, no una pregunta.

**Medicion que ACOTO el hallazgo de tres rutas a UNA** (el revisor decia «lo mismo aplica a
`business` y `prefill`; verificado y es falso):
- **`onboarding/prefill`: no lee una sola fila del negocio.** Devuelve paises, categorias y el
  sesgo geografico de los headers. No hay estado que gatear.
- **`onboarding/business`: solo CREA.** Si ya existe **cualquier** membresia contesta **409**
  antes de escribir (`route.ts:110`). Un owner con negocio `suspended` ya tiene membresia, asi
  que **nunca llega a un write**. Inalcanzable, no arreglable.
- **`onboarding/program` era el unico agujero real.**

**EL GATE VIVE EN EL WRITER, NO EN LA RUTA.** `saveProgram` (`server/loyalty-program.ts`) es un
writer con **dos puertas**; una defensa en el borde deja la otra abierta, que es exactamente como
nacio el agujero. Ventaja extra: el guard lee el `status` de **la misma fila** que el write va a
tocar, asi que no le afecta la divergencia `asc`/`desc` de §D3. **La ruta NO lleva el gate de
email, a proposito**: el wizard corre antes de la verificacion (ADR 0070 §11) y son dos ejes
distintos (ADR 0073).

**`businessStatusFailure` se MUDO a una HOJA sin un solo import (`server/business-status.ts`),
y es la leccion del paso 1 aplicada de nuevo.** Vivia en `api-owner.ts`, que importa
`next/server` y better-auth; importarla desde `loyalty-program.ts` habria arrastrado el runtime
HTTP y de auth a un modulo de dominio — la misma forma del ciclo que costo 8 suites. `api-owner.ts`
la re-exporta, asi que **sus 12 consumidores no cambian una linea**. Verificado: la hoja tiene
**0 imports** y ni ella ni `api-owner` importan loyalty.

**`LoyaltyError` gano un `code` opcional.** Sin el, el mapeo por STATUS de la ruta
(`codeForStatus`) traducia **todo 403 a `not_owner`**, o sea que un rechazo por negocio suspendido
habria salido con el `code` de «no sos owner»: mentirle al cliente sobre por que lo frenaron.

**El oraculo, y una MUTACION que prueba que muerde** (shasum limpio
`a83c94ae1e7ba5ef2ad7b431afba340fc7b5e71f`): removido el guard, **2 rojos** con
`AssertionError: expected 200 to be 403`, y **el control positivo quedo VERDE** — o sea que el
oraculo discrimina en vez de tirar todo al piso. Revertida con `diff` **vacio** y shasum
coincidente. Los tests nuevos viven en `onboarding-program.neon.integration.test.ts` y **no
aseveran solo el status**: pinnean el `updatedAt` del programa antes y despues, porque un fix que
devolviera 403 **despues** de escribir pasaria en verde con solo mirar el codigo HTTP.

**LIMITE MEDIDO, declarado en el propio test:** el caso de un `status` DESCONOCIDO **no es
alcanzable contra base**. Se intento: el `CHECK` de la migracion `0036` lo rechaza **incluso por
SQL crudo** (`23514 business_status_check`). La polaridad fail-closed se mide donde si se puede,
sobre la funcion pura, en `api-owner-surfaces.test.ts` (12 × 7 estados, `frozen` incluido).

**GATES FINALES, despues del cierre de F1:** `typecheck --force` **3/3 sin cache** · `lint` exit 0
· `format:check` OK · **`test` con Neon: 203 archivos / 1590 passed / 0 failed** (baseline de la spec 1479; +3 del
cierre de F1 y +3 del landing) · `build --force` **3/3 sin cache** · `rg MUTATION apps` **vacio**.

#### Lo que el revisor cazo y el ORQUESTADOR ARREGLO

- **Un `limit(1)` SIN `orderBy` en el corte del link magico** (`magic-link/route.ts`,
  `businessIsClosed`). Su docblock afirmaba «la membresia mas vieja, mismo criterio que
  `requireBackofficeSession`» y **la consulta no ordenaba**: un `limit(1)` sin orden es **no
  determinista**, asi que con dos membresias este guard abriria o cerraria la sesion al azar.
  Se corrigio **el codigo** (se agrego `orderBy(asc(businesses.createdAt))`), no solo el
  comentario — misma regla que la 0069 con el `density` del QR. La divergencia que QUEDA
  —aca se filtra `memberships.status='active'` y `requireBackofficeSession` no— esta declarada
  en el docblock.
- **Una afirmacion de mas de la propia spec.** §D3 decia que se cerraba la divergencia
  `asc`/`desc`. **Falso, reproducido:** quedan cuatro `asc` (`staff.ts:88`,
  `catalog/core.ts:81`, `brand.ts:51`, `auth-guards.ts:106`) contra **un `desc`**
  (`loyalty-program.ts:66`), y `api/loyalty-program` + `/qr` llegan a ese resolvedor `desc`
  **despues** de que el gate resolvio con `asc`. Inalcanzable hoy (`onboarding/business:110`
  contesta 409 si ya hay membresia: un negocio por usuario) y **declarado, no perseguido** —
  cerrarlo toca un archivo que no esta en la tabla de la spec.
- **El contrato afirmaba ser el unico resolvedor de owner.** Corregido, con la fila de exclusion
  de `api/onboarding/*` y su riesgo medido.

#### Hallazgos del revisor que NO son defectos (verificados)

- **La ruta del PIN sin gate esta bien.** `pin/route.ts:73`: `userId !== session.user.id` → `404
  staff_not_found`. Gatearla dejaria a **todo** el staff sin poder cambiar su PIN.
- **`suspensionReason` camelCase** es la convencion del API y esta declarado en el contrato.
- **`api-owner-surfaces.test.ts` tiene PISO DE BARRIDO** (`expect(SURFACES.length).toBe(12)`),
  que es lo que evita que un `it.each` vacio pase en verde. Lo verifico el revisor.
- **El fail-closed asimetrico esta acotado:** `rg "use server"` → **0 matches**, no hay server
  actions, asi que el backoffice no escribe nada por fuera del API. Con un `status` desconocido
  se entra a LEER, pero toda escritura esta fail-closed (medido).
- **Cero fuga de claves de R2:** `brandResponse` sigue destructurando `logoObjectKey` afuera.

#### ANDAMIAJE CON SU TAREA: `status`/`suspensionReason` del guard del backoffice

**NO es un hallazgo a decidir, y el orquestador lo habia clasificado mal.** Es cierto que hoy
ninguna pantalla lo consume (verificado: el unico hit en `.tsx` es `backoffice/page.tsx:90` y es
el `status` de la SUSCRIPCION, otro eje). **Pero su consumidor ya esta decidido por el owner**, en
su dictado textual de `suspended` del 2026-09-17: «el owner puede loguearse y **ver un mensaje de
cuenta suspendida con su razon y boton de contacto**».

**Esta es la fila que lo autoriza** (regla de «nada de andamiaje sin su tarea»):

| Que | Quien lo va a consumir | Estado |
|---|---|---|
| `ctx.business.status` y `ctx.business.suspensionReason` de `requireBackofficeSession` (`auth-guards.ts:160-163`), con el motivo **solo** para `role='owner'` | **La pantalla de cuenta suspendida que construye el OWNER por fuera** (ADR 0070 §16: el arco entrega API, no interfaz). Su contrato es `0072-contratos-de-api.md` §6 | esperando la UI |

**Si esa pantalla no se construye, el campo se borra con ella** — igual que la columna
`core.business.status` respecto de su propia fila.
- **✅ CERRADO — el landing publico del enroll.** Lo observo el revisor como UX y el owner lo
  resolvio el 2026-09-17: «si la persona llegara a escanear el QR para sumarse al programa, la
  landing diria **"Este Programa ya no esta disponible"**». Y acoto el criterio para el futuro:
  **eso se toca al editar la pantalla, SALVO que sea una propiedad de API.** Medido: **lo es**.
  `getEnrollLanding` vive en `server/consumer/enrollment.ts:254` —el servidor, y el archivo ya
  estaba en la tabla de la spec— y la pagina solo renderiza lo que devuelve.
  **Y el mensaje que pidio YA EXISTE:** la rama `!landing` de
  `app/(consumer)/enroll/[programId]/page.tsx:32` dice exactamente «Este programa no esta
  disponible». Asi que devolver `null` lo alcanza: se agrego `eq(businesses.status, "active")` al
  `where` que ya hacia `innerJoin(businesses)`, **cero `.tsx`** (ADR 0070 §16). Fail-CLOSED
  (`= 'active'`, no `in ('suspended','closed')`), misma polaridad que `businessStatusFailure`.
  **Oraculo con mutacion (L1)**, shasum limpio `05af3cf10d69ba62de111576b8b5cb661b558344`:
  removido el guard, **2 rojos** con `AssertionError: expected { …(9) } to be null` y el
  **control positivo VERDE** —que no es decorativo: un `null` puede venir de cualquiera de las 4
  condiciones del `where`, asi que sin el, un gate que anulara TODO pasaria en verde—. Revertida
  con `diff` vacio y shasum coincidente.

#### Correccion del revisor a una premisa del ENCARGO del orquestador

El encargo decia que el consumo del link magico estaba **sin mutar**. **Falso:** la bitacora
muestra que el implementador ya lo habia cubierto con su M4. **2 de las 4 mutaciones del revisor
(RM2 link magico, RM4 catalogo) re-probaron trabajo ya medido** — valen como medicion
independiente con shasum identico, pero se pagaron del presupuesto. La unica superficie del eje
`status` que estaba de verdad sin mutar era el **enroll publico** (RM1), y **RM3 fue original y
es la mejor de las cuatro**: cambio `ownerContext` para leer el `status` de la MEMBRESIA en vez
del NEGOCIO, y descubrio que `api-owner-surfaces.test.ts` **queda verde (88 passed)** porque el
unit dobla `ownerContext` — esa clase de error **solo la caza la integracion**.

### ✅ VERIFICADO POR EL ORQUESTADOR — y un barrido del implementador que era DEBIL

Todo lo de abajo lo escribio el implementador. Esto es lo que el **orquestador reprodujo por su
cuenta** (regla de la señal decisiva: se reproduce lo decisivo, no todas sus mediciones):

- **Suite completa CON NEON reproducida: 203 archivos / 1584 passed / 0 failed.** Mas
  `typecheck` 3/3, `lint` exit 0, `format:check` OK, `rg MUTATION apps` **vacio**.
- **El barrido del implementador para «ningun test ablandado» NO alcanzaba.** El suyo miraba las
  lineas borradas que contuvieran `expect(`; **eso no caza que a un `toEqual` le saquen una
  clave**, que es justo la forma barata de ablandar una asercion sin borrarla. El orquestador lo
  rehizo sobre **TODAS** las lineas borradas de los `.test.ts` y los `*support*.ts`: las 12
  distintas son andamiaje (dobles de `ownerContext`, dobles de sesion, un seed, un import y un
  comentario). **Cero `expect(...)` eliminados**, y los dos cambios de asercion son **aditivos**
  (`toEqual({error})` → `toEqual({error, code:"not_owner"})`). La conclusion del implementador
  era correcta; su prueba no.
- **DoD reproducido:** `rg PLAN_LOCATION_LIMITS|PLAN_WITH_CAMPAIGNS` vacio · `rg ownerBusiness`
  en `app/api` vacio · **0 `.tsx`** · **0 archivos de wallet/tarjeta** en el diff — o sea que lo
  YA EMITIDO no se toco, que es la decision del owner.
- **La M1 la midio el ORQUESTADOR**, no el implementador: un hook `no-mutations-left.sh` bloqueo
  un turno con la mutacion puesta, asi que se midio ahi (**36 rojos**, asercion
  `expect(response.status).toBe(403)` + `code === "business_suspended"`) y se revirtio (**85/85
  verde**). El implementador la re-midio independiente y le dio **38**. Su copia limpia y la
  reconstruccion del orquestador diferian **solo en el nombre de una variable local**.
- **La ruta del PIN sin gate se verifico leyendola:** contesta **404 `staff_not_found`** si
  `userId !== session.user.id`, o sea que esta auto-acotada. No gatearla es correcto.

**🔵 REVISOR INDEPENDIENTE EN VUELO**, contexto fresco, **presupuesto 4 mutaciones** y condicion
de corte escritos en el encargo. Se le pidio concentrarlo donde el riesgo NO es el rojo sino el
**verde sin oraculo**: las superficies del eje `status` que el implementador NO muto (enroll
publico y consumo del link magico), el contrato contra la realidad (en la 0067 hubo un FAIL por
un `code` declarado que dos rutas no emitian), y los 4 hallazgos de abajo. **La spec NO esta
marcada `implementada`: eso lo decide su PASS.**

### ⚠️ 4 HALLAZGOS: son decisiones del IMPLEMENTADOR, NO del owner

1. **`POST /api/staff/[userId]/pin` sin `requireApiOwner`** — correcto y verificado (ver arriba).
   Consecuencia declarada: un integrante con sesion viva rota su PIN en un negocio `suspended`.
   No acredita, no entra al mostrador y no obtiene sesion nueva.
2. **El motivo viaja como `suspensionReason` (camelCase)**, no `suspension_reason` como lo nombra
   la spec — que es el nombre de la COLUMNA, no el del campo. Declarado en el contrato.
3. **`requireBackofficeSession` devuelve `status`/`suspensionReason` que HOY NO CONSUME NINGUNA
   PANTALLA.** Es andamiaje: o le entra su fila en `TASKS.md`, o se borra. **A DECIDIR.**
4. **Fail-closed ASIMETRICO:** API, mostrador, login y enroll tratan un `status` desconocido como
   `suspended`; el backoffice solo rebota con `closed` exacto, porque es la unica superficie
   donde el owner puede LEER el motivo. **A DECIDIR.**


### ESTADO EN VIVO — LOS 3 PASOS ESCRITOS, GATES VERDES, CERO MUTACIONES VIVAS (2026-09-17)

- `HEAD` = **`5f89d18`**, **nada commiteado**, **ninguna migracion aplicada** (la 0072 no tiene).
- **`rg MUTATION apps` → VACIO.** Las **7 mutaciones del presupuesto estan corridas y
  revertidas**, con shasum limpio, etiqueta, texto de la asercion roja y `diff` de reversion:
  ver la bitacora de mas arriba.
- **Gates completos, Node 24.20.0, con `.env.integration.local` de la RAIZ:**
  `typecheck` **3/3** · `lint` exit 0 · `format:check` OK ·
  `test` **203 archivos / 1584 passed / 0 failed** (baseline al empezar: 199 / 1479) ·
  `build` **3/3**.
- **La matriz `{active, suspended, closed}` SI se ejercito contra base**, en
  `business-status.neon.integration.test.ts` (el `status` se escribe con un `UPDATE`, que es el
  unico mecanismo que hay hoy) y en `magic-link-business-closed.neon.integration.test.ts`.
- **Los 3 pasos internos estan escritos:** la capa de entitlements con sus 3 call-sites
  migrados; `server/api-owner.ts` con sus 4 pasos y sus 12 consumidores; y el eje `status` en
  las 7 superficies de §D4.
- **El ciclo de imports del paso 1 quedo arreglado en su raiz:**
  `server/entitlements/live-subscription.ts` saca `hasLiveSubscription` de `billing/plan-change`,
  asi que la pieza de mas abajo del stack ya no importa un modulo de dominio. `plan-change.ts` lo
  re-exporta, asi que `applicability`, `reconcile`, `view` y `billing/index` no cambian.
- **Entregable de contrato escrito:** `docs/specs/0072-contratos-de-api.md`.
- **22 archivos de test preexistentes modificados, auditados uno por uno.** El barrido decisivo:
  `git diff -U0 -- <los 22> | grep "^-"` **no borra ni una sola linea `expect(...)`** — todo lo
  eliminado son dobles de sesion, dobles de `ownerContext`, declaraciones de tipo y un
  comentario. Las **unicas dos aserciones que cambiaron** son los `toEqual` del cuerpo del 403
  de billing, que pasaron de `{ error }` a `{ error, code: "not_owner" }`: **mas estrictas**, y
  cambian porque el contrato cambio por decision del owner («si a los `code`»).
- **DOS HALLAZGOS A DECIDIR, no decisiones del owner** (detalle en el handoff y en el contrato):
  (1) `POST /api/staff/[userId]/pin` esta en las 33 rutas del DoD pero **no es una superficie
  del owner** —es el integrante cambiando su propio PIN— y gatearla romperia la spec 0067 §4;
  (2) la clave del motivo en el cuerpo viaja como `suspensionReason` (camelCase) y la spec la
  nombra por su columna, `suspension_reason`.
- **Falta el PASS de un revisor independiente.** La spec NO esta marcada `implementada`.

**Las decisiones del owner se pidieron ANTES de la prosa** (ADR 0071 §2) y las contesto el
2026-09-17. **Textual, para que no se reinterprete:**

1. **El lado del CONSUMIDOR de un negocio `closed`: no se apaga nada.** «No necesitas cerrar
   pase ni nada que siga habilitado, nadie podra escanearlo. Y si alguien lo escanea no podra
   dar puntos ni nada porque no sera un scan del local que pueda luego asignar nada al
   programa.» → **pases de Wallet, sellos y tarjeta quedan INTACTOS**; no se contesta `410` en
   el web service de passkit. Eso hace la spec **chica del lado del consumidor**.
2. **No entran limites nuevos al catalogo** («no de momento»), **pero agregar uno tiene que ser
   simple y claro** — requisito suyo, y por eso el catalogo declarativo de §D2.3 con el test
   que pone la suite en rojo si un plan no declara sus limites.
3. **`status` y `plan` NO son el mismo eje** — corrigio la premisa del orquestador: «si yo
   suspendo un comercio no es cambiar de plan es deja de acceder a las funciones, si lo cierro
   no hay ni siquiera login». Y **el caso "bajamos un limite y alguien ya lo excedia" queda
   DIFERIDO** por el: «todavia no esta resuelto esto, cuando lleguemos alli trabajaremos en
   ello». Es el ADR **0073**.

4. **El ALTA NUEVA se corta en los dos estados.** El orquestador le llevo que
   `POST /api/public/enroll/[programId]` no tiene sesion de comercio —es publico, rate limit por
   telefono— asi que el QR pegado en la pared seguia dando de alta gente en un negocio cerrado.
   **Textual: «el alta nueva tambien queda suspendida si el negocio esta suspendido, si esta
   cerrado queda cerrado para altas nuevas».** Con eso **la spec quedo `cerrada`**.

**LA LINEA QUE SEPARA LO QUE ENTRA DE LO QUE NO ES «YA EMITIDO» VS «ALTA NUEVA»**, y NO
«comercio» vs «consumidor». El orquestador la habia trazado mal —de ahi la pregunta de mas— y
queda escrita aca para que la proxima sesion no la vuelva a trazar: pase de Wallet, sellos y
tarjeta son **ya emitido** y no se tocan; el enrolamiento es un **alta nueva** y se corta.

### Lo que se MIDIO al escribirla, y corrige documentos ya escritos

Regla: lo que se le pasa a un subagente como insumo es una afirmacion propia.

- **`billing/plan-change.ts` NO es un call-site divergido.** `TASKS` decia «los 3 call-sites
  viven en `billing/`, `marketing/` y `locations/`»: **importa** `locationLimitForPlan` de
  locations, no lo recopia. El tercer lugar real es `billing/derive-rules.ts:42` (`PAID_PLANS`).
- **Staff y catalogo de productos NO tienen tope por plan** (`rg` sobre `server/staff.ts` y
  `server/catalog/*.ts`: 0 matches). No hay nada que unificar ahi.
- **Las superficies de API sin gate de email son 10, no 9.** La fila 56 de `PARQUEADO` se
  escribio antes de la 0069 y le falta **`api/loyalty-program/qr`**.
- **El refactor es MAS BARATO de lo que decia la fila 56:** `ownerContext` (`server/staff.ts:56`)
  ya es el mismo `innerJoin(businesses)` que comparten 4 de los 6 resolvedores, asi que leer
  `status` es **una columna mas en un join que ya existe**.
- **Cerrar el login NO expulsa a quien ya entro.** `auth.ts` no pisa `session.expiresIn`, asi
  que rige el default de better-auth 1.6.26: **7 dias** (`3600*24*7`, leido en
  `dist/context/create-context.mjs:147` y `dist/db/internal-adapter.mjs:24`). Un staff con la
  sesion viva **acredita hasta una semana** despues del cierre, porque `requireOperator`
  (`api/counter/_auth.ts:14`) no lee `business.status`. Por eso el guard va en CADA superficie.

**Los barridos del DoD se corrieron contra el arbol ANTES de proponer el cierre** (leccion de la
0067). **Uno nacio imposible y se corrigio:** `rg PLAN_LOCATION_LIMITS` no podia dar vacio —
faltaba el barrel `locations/index.ts:12` en la tabla de archivos, y hay un **comentario** en
`billing-plan-change.test.ts:53` que nombra la constante (ese test transcribe el tope a mano a
proposito, `FREE_LIMIT = 1`). Las **33 rutas** del segundo barrido estan contadas, no estimadas.

**→ LO PROXIMO, EN ORDEN:** (1) **implementador despachado** (ADR 0071: UNO para toda la spec,
en los 3 pasos internos de §Handoff). Al volver: **reproducir la señal decisiva** de su informe,
no todas sus mediciones · (2) **UN** revisor independiente en contexto fresco, con el
presupuesto de **7 mutaciones** y la condicion de corte escritos EN EL ENCARGO · (3) solo un
`PASS` verificable permite marcarla `implementada` · (4) anotar `duration_ms`, `tool_uses` y
`subagent_tokens` de cada notificacion para la re-medicion del ADR 0071.

## ⇥ HECHO ESTA SESION — spec 0069, el wizard de alta es API (2026-09-17)

**`docs/specs/0069-el-wizard-de-alta-es-api.md`, estado `cerrada`**, con su fila en `INDEX.md`.
Es la **2a tajada del ADR 0070**. Entrega API y contrato, **cero pantallas** (§16).

**Plantilla elegida MIDIENDO, no por costumbre (ADR 0071):** `TEMPLATE.md`, la larga. Las tres
condiciones de la chica fallan dos: toca **varios dominios** (onboarding, loyalty, imagenes,
brand-kit, location-providers) y **si lleva migracion** (`0035`, la columna de categoria).

**Las tres decisiones de producto las contesto el owner el 2026-09-17, ANTES de escribir la
prosa** (que es justo lo que el ADR 0071 vino a ordenar):

1. **Las 15 categorias `gcid:`** propuestas, tal cual.
2. **Sello placeholder generado por codigo (opcion A):** SVG con la inicial del negocio en
   **negro no puro (`#1A1A1A`)** — textual del owner: «el cuadrado donde se sella siempre es
   blanco, entonces asi sera visible».
3. **QR pelado, no el poster** —en el wizard todavia no hay color ni logo, eso es la parte
   «avanzada» del onboarding— **pero con descarga como imagen**, para que el comerciante lo
   guarde en el telefono hasta imprimirlo o armar el poster despues.

**Tres cosas se MIDIERON y corrigen documentos que ya estaban escritos** (regla: lo que se le
pasa a un subagente como insumo es una afirmacion propia):

- **El ADR 0070 se equivoca con el placeholder.** Dice que alcanza con implementarlo dentro de la
  ruta publica «y lo reciben todos los consumidores sin tocar ninguno». **Falso:**
  `client-view.ts:81-83` devuelve `stampImagePath: null` sin sello, o sea **la URL nunca se
  construye y la ruta nunca se llama**. Escrito solo ahi seria codigo muerto.
- **El ADR 0070 §14 dice que Mexico toca dos listas. Toca UNA:** la segunda
  (`app/onboarding/page.tsx:18`) la **borro la 0067**.
- **`counter/core.ts` NO se toca, y la primera version de la spec lo afirmaba mal.** Su docblock
  dice que `programDTO` expone «only the public stamp path» y **ese campo no existe** en lo que
  devuelve. Queda como hallazgo, no como trabajo.

**Verificado ejecutandolo, no asumido:** `sharp` 0.35.3 (ya es dependencia) rasteriza el SVG del
QR — Node 24.20.0, vips 8.18.3, un SVG de 2.421 bytes → **PNG 1024×1024 de 50.316 bytes**. La
descarga no cuesta una dependencia nueva.

**Los barridos del DoD se corrieron contra el arbol ANTES de cerrar** (leccion de la 0067, que
cerro con cuatro criterios imposibles). **Dos criterios nacieron mal y se corrigieron:** el
conteo de categorias por `rg 'gcid:'` (que tambien cuenta comentarios y el default `gcid:store`,
asi que no puede dar el numero exacto → pasa a ser una asercion del unit), y la afirmacion de que
la 0069 era «la unica spec abierta del INDEX», que es **falsa**: hay tres borradores viejos
(0003, 0007, 0009). Sigue siendo disjunta, pero por el motivo medido — los `archivos` de la 0003
son `packages/**` y **`packages/` no existe** (el workspace es `apps/*`), y la 0007 y la 0009
declaran «rutas concretas por definir». La 0009 ademas es **otro QR**: el fijo por local.

**→ LO PROXIMO, EN ORDEN:**

1. **Esperar al implementador** (despachado en background). Al volver: **reproducir la señal
   decisiva** de su informe, no todas sus mediciones.
2. **UN revisor independiente en contexto fresco**, con presupuesto y condicion de corte escritos.
   Solo un `PASS` verificable permite marcar la spec `implementada`.
3. **Cerrar la re-medicion del ADR 0071** con los numeros reales.

**RE-MEDICION DEL ADR 0071 — en curso.** Baseline a batir, de la spec 0068: implementador paso 1
**18 min / 71 tools / 179k** · revisor **9 / 40 / 106k** · implementador cerrando el FAIL **8 / 18
/ 208k** · paso 2 reanudado **6,8 / 17 / 238k** · revision final **4,4 / 17 / 137k** = **~46 min y
868k tokens** de subagentes. Se anota el `duration_ms`, el `tool_uses` y el `subagent_tokens` de
**cada** notificacion, y **el numero real vuelve al ADR 0071 aunque contradiga la promesa** de
~60 → ~25 min. No cuenta como mejora bajar el tiempo salteando mutaciones o la revision.

### Numeros de la re-medicion, a medida que llegan (2026-09-17)

| Etapa | Tiempo | Tools | Tokens |
|---|---|---|---|
| **Implementador 0069** (toda la spec, un solo agente) | **29,1 min** | **141** | **316k** |
| **Revisor 0069** (PASS de primera, sin ciclo de FAIL) | **11,2 min** | **59** | **183k** |
| **TOTAL 0069** | **40,3 min** | **200** | **498k** |

**Contra el baseline de la 0068** (que fueron CINCO despachos: implementador, revisor,
implementador cerrando el FAIL, implementador reanudado, revision final): **~46 min y 868k**.
El implementador solo de la 0069 hizo **toda** la spec —15 archivos, migracion, 5 mutaciones
ejecutadas y el contrato— en **29,1 min y 316k**, o sea **~64% de los tokens del arco 0068
completo en UN despacho**. El numero final se escribe cuando cierre el revisor, y **va al ADR
0071 aunque contradiga la promesa**.

**Gates REPRODUCIDOS por el orquestador** (no citados del agente, regla de la señal decisiva):
`typecheck --force` 3/3 sin cache · `lint` exit 0 · `format:check` OK · `test` **1088 passed / 0
failed** · `test` con `.env.integration.local` (esta en la RAIZ del repo) **199 files, 1478
passed / 0 failed** en 174 s · `build --force` 3/3 sin cache · `rg MUTATION` **vacio** · **cero
`.tsx` tocados**.

**Los dos tests preexistentes que el implementador modifico fueron auditados por el orquestador
y son legitimos:** pinneaban exactamente lo que la §D5 cambia a proposito, y las aserciones
nuevas son **mas fuertes** —`loyalty-program.test.ts` pasa de `null` a la ruta exacta y conserva
el `not.toHaveProperty('stampImageObjectKey')`; el `.neon` **agrega** la asercion de que una
version que no matchea sigue dando `null`—. No es un test ablandado para que pase un gate.

## ⇥ ANDAMIAJE CON SU TAREA: `core.business.status` migrado SOLO (2026-09-17)

**La columna esta en produccion. La feature NO existe.** Esta fila es la que la va a consumir, y
es lo que autoriza que el esquema se haya aplicado sin su spec (regla de «nada de andamiaje sin su
tarea»): **si esta fila se borra sin implementarse, la columna se borra con ella.**

**Los tres estados los dicto el owner el 2026-09-17, textual:**

- `active` — opera normal.
- **`suspended`** — «el staff no puede loguearse, el owner puede loguearse y ver un mensaje de
  cuenta suspendida con su razon y boton de contacto. Es decir que toda la plataforma quedara
  inusable, no pueden escanear, no pueden asignar puntos, sellos, cambios en programa, marca, etc.
  Nada».
- **`closed`** — «ni staff ni owner puede hacer nada, el negocio queda cerrado, **ni siquiera
  admite login**».

**Migracion `0036` aplicada a produccion y VERIFICADA POR SQL** (36 → 37): `status` `NOT NULL
DEFAULT 'active'`, `suspension_reason` y `status_changed_at` nullables, y
`CHECK (status IN ('active','suspended','closed'))`. Semillas de terminos intactas.
**La rama de integracion tambien quedo migrada** — sin eso la suite tira **123 fallos** que son un
`42703 column "status" of relation "business" does not exist`, o sea algo que **parece un bug de
codigo y es una migracion pendiente**. Con la rama migrada: **1479 passed / 0 failed**.

**⚠️ LO QUE FALTA, Y ES TODO EL TRABAJO — NINGUN GUARD LEE ESA COLUMNA.** Hoy un negocio
`suspended` esta suspendido en la base y **plenamente operativo en la app**. Para volverlo real
hay que gatear:

1. **El login**, que es lo que el owner puso primero: el estado se lee en `auth/start`, en el
   consumo del link magico y en el PIN del staff. **Eso toca superficie de la spec 0067, ya
   implementada** — no es terreno virgen.
2. **Las 11 superficies de API del owner** (las mismas de `PARQUEADO` fila 56: conviene hacerlas
   juntas, es el mismo `requireApiOwner`).
3. **El mostrador** (`api/counter/{grant,redeem,coupon-redeem,resolve}`).

**Quien ESCRIBE el estado: diferido por el owner** a «las API de admin de CheckPass.club», que no
existen (`apps/platform` tiene una sola ruta, `/api/health`). Por ahora, `UPDATE` a mano.

**Lo que el owner NO dijo y por lo tanto NO es decision suya:** que pasa del lado del **CONSUMIDOR**
de un negocio `closed` —los pases de Wallet ya emitidos, los sellos acumulados, el QR de
enrolamiento que sigue circulando—. Se le pregunto y su respuesta describio la superficie del
**comercio**. Es la decision que abre la 3ª spec.

## ⇥ EN PRODUCCION (2026-09-17) — commits `fde3757` + `34cb98b`

**Autorizado por el owner.** Estado verificado, no asumido:

- **Commit `fde3757`** (la 0069, 36 archivos) y **`34cb98b`** (el fix del fixture de marketing),
  los dos **pusheados**: `git rev-parse HEAD` == `origin/main`.
- **MIGRACION 0035 APLICADA A PRODUCCION.** Proyecto `mi-pasaporte`, rama **`main` =
  `br-curly-silence-ax8acywm`** (la `default`, **confirmada por API antes de tocar nada**).
  **Verificado por SQL, no por el mensaje de `drizzle-kit`:** migraciones **35 → 36**,
  `core.business.category_gcid` existe como `text NOT NULL DEFAULT 'gcid:store'`, y las **3
  semillas** de `core.terms_template` intactas (son las que el wizard usa como terminos).
  La `0035` es **un solo `ALTER TABLE ADD COLUMN`**: no crea ni borra tablas.
- **Se migro ANTES de pushear, a proposito.** Vercel despliega con el push y el codigo nuevo lee
  esa columna; al reves habria una ventana con produccion tirando `42703`.
- **Vercel: `success`** para `fde3757`.
- **Las rutas nuevas responden en produccion**, probadas por HTTP contra `www.` (el apex hace
  308): `/api/onboarding/prefill` → **401 `{"code":"unauthorized"}`**, `/api/loyalty-program/qr`
  → **401 `{"code":"unauthorized"}`**, `/api/onboarding/program` → **405** en GET (es POST-only).
  Los tres codigos son **los que declara el contrato**.

**El contrato para la UI esta pusheado: `docs/specs/0069-contratos-de-api.md`.**

**CI VERDE, LEIDA DE `/check-runs` PARA EL SHA EXACTO `34cb98b`** (nunca `/status`, que aca
miente): `verify: completed -> success`, `total: 1`, **`no-success: 0`**. Los **18 pasos** en
`success`, leidos uno por uno — incluidos **«Migrar la rama Neon de CI»** (la `0035` aplica
limpia) y **«Unit + integracion Neon»**.

**Eso cierra el unico riesgo que quedaba declarado de la 0069:** el test del glifo del sello
placeholder mide pixeles opacos y se escribio en macOS; se declaro «pendiente de la primera
corrida de CI» por si en Linux faltaban fuentes. **Corrio en Linux y paso.**

### La CI se puso ROJA y NO era la 0069 — era una bomba de tiempo

7 archivos `.neon` de **marketing** rojos en un commit que no toca marketing. **No era una
regresion.** `createCampaign` (`marketing-integration-support.ts:78`) defaulteaba `startsAt` a
`Date.now() - 24 h` —**reloj real**— mientras esos tests corren el tick con un `NOW` **fijado** en
`2026-09-16T12:00:00Z`. Pasadas 24 h del `NOW` fijado, la campaña «todavia no empezo» y el tick
devuelve `{campaigns: 0, enqueued: 0}`. **Detono a las 12:00 UTC del 2026-09-17 y habria puesto
roja la CI de cualquier commit.**

**La prueba decisiva:** `marketing-tick.neon` **paso** en local a las 08:17 UTC y **fallo** en
local a las 14:18 UTC del mismo dia, **sobre el mismo arbol, sin un cambio de codigo**. La
variable era el reloj. El re-run del job fallo **identico** (determinista, no flake), y `rg` no
encuentra **un solo import** de lo que toco la 0069 dentro de `marketing/`.

**Arreglado en `34cb98b`**: el default pasa a un instante fijo anterior a cualquier `NOW` de la
suite. Verificado **26 h despues del `NOW` fijado** —la condicion exacta que los rompia—: los 7
archivos **7/7 y 31 tests**, la suite completa **1479 passed / 0 failed**, typecheck/lint/format/
build verdes sin cache. **El caso completo esta en `docs/LECCIONES.md`.**

## ⇥ LA SPEC 0069 ESTA `implementada` — PASS de revisor independiente (2026-09-17)

**PASS**, con 3 hallazgos declarados y **ninguno bloqueante**. Un solo ciclo: el revisor no
abrio FAIL. La condicion de corte no se aplico (ninguna vuelta termino en «el fix abrio la
siguiente»).

**Gates finales, corridos por el orquestador DESPUES de sus propios cambios** (el PASS del
revisor no cubria lo que el orquestador toco despues): `typecheck --force` 3/3 sin cache ·
`lint` exit 0 · `format:check` OK · **`test` con Neon: 199 files, 1479 passed / 0 failed** ·
`build --force` 3/3 sin cache · `rg MUTATION` **vacio** · **cero `.tsx`**.

### Lo que el revisor cazo y el orquestador ARREGLO (con su mutacion propia)

**El filtro por `(businessId, programId)` de la ruta publica del sello NO tenia oraculo.** El
revisor quito ese `eq()` y **23 tests pasaron igual**: un negocio podia leer el sello de otro y
la suite no lo veia. El orquestador agrego el test de aislamiento en
`loyalty-stamp-placeholder.neon.integration.test.ts` y **probo que muerde** con la mutacion
**O1** (`stamp.ts`, shasum limpio `37379485f888a7943003b390b0a964e5d9de5fd0`): rojo
**`AssertionError: expected { kind: 'stamp', …(1) } to be null`**, y **un solo test rojo**, lo
que confirma que nada mas lo cubria. Revertida con `diff` vacio y shasum coincidente.

**El docblock de `brand-kit/qr.ts` afirmaba lo contrario de lo medido, y se corrigio el CODIGO,
no solo el comentario.** Decia que el `density: 600` «evita el borde dentado». **Medido por el
orquestador** sobre el SVG de un enroll real (`viewBox 0 0 47 47`): `sharp` rasteriza el vector
**directo al tamaño del `resize`**, asi que fijarle `density` lo obliga a rasterizar a 392×392 y
despues **agrandar**, que es lo que introduce el dentado. **Sin `density`: 0 pixeles intermedios
en 24.407 bytes. Con `density: 600`: 38.273 pixeles intermedios en 42.557 bytes.** Se quito la
opcion: el QR que el comerciante imprime sale mas nitido y **~40% mas liviano**.

### DECIDIDOS POR EL OWNER el 2026-09-17 — ya no son hallazgos

1. **El `accrual` del wizard queda en `{ per_purchase, grant: 1 }`** («un sello por visita»).
   **Decision del owner, textual: «accrual lo dejamos como esta».** Lo habia elegido el
   implementador y se le llevo como hallazgo; ahora es decision suya. Sigue siendo **editable**
   desde el editor de programa de siempre (`saveProgram` reescribe la mecanica en cada guardado),
   asi que el wizard fija un punto de partida, no algo permanente.
2. **El sello placeholder queda como se implemento**, y eso incluye que se vea en **TRES**
   pantallas, una de ellas **del consumidor**: con `stampImagePath` siempre no nulo,
   `card-preview.tsx:46` renderiza la inicial donde antes el slot quedaba vacio, y eso alcanza
   `steps/step-review.tsx`, `steps/step-card-design.tsx` y **`app/(consumer)/wallet/
   program-card.tsx:39`, la tarjeta del cliente final**. Se le mostro al owner la tercera —que la
   lista del implementador omitia y cazo el revisor— y respondio: **«sello placeholder dejalo
   como lo implementaste»**. Decision suya, con el efecto en la tarjeta del consumidor a la
   vista.
3. **`POST /api/onboarding/business` responde sin `code`**, contra la convencion del contrato
   0067 («todo error responde `{error, code}`»). Se dejo como estaba; el contrato lo **declara
   como estado actual**. Candidato a `PARQUEADO` fila 56.
4. **Esa misma ruta con cuerpo no-JSON revienta en 500 sin `code`** (el `request.json()` esta
   fuera del `try`). Hay un test que lo pinnea **como limite** para que el dia que se arregle se
   ponga rojo. **Matiz del revisor:** ese test usa `rejects.toThrow()` sin matcher, asi que
   tambien pasaria si rechazara por otro motivo.
5. **`counter/core.ts:167-169` sigue mintiendo:** su docblock dice que `programDTO` expone «only
   the public stamp path» y ese campo **no existe** en lo que devuelve. Declarado fuera de
   alcance en la spec.
6. **El split de `schema/billing.ts`** (el hook `file-size` corta en 300 y `business.ts` llegaba
   a 308) **no estaba en la tabla de archivos de la spec**. El revisor verifico por `diff` que
   es un **movimiento puro**, sin cambio semantico, y que el barrel re-exporta.

### Declarado y NO perseguido (intentado antes de declararse)

- **`?v=00` es alias de `?v=0`** (el guard es `/^[0-9]+$/` + `Number()`): mismo contenido bajo
  claves de cache distintas. No es fuga ni 404 indebido — desperdicio de cache.
- **`403 not_owner` / `503 qr_unavailable` y los 403/409/503 del programa no tienen test.**
  Verificados leyendo los sitios de `throw` alcanzables y el mapeo de `codeForStatus`;
  ejercitarlos pedia un owner sin negocio y una inyeccion de falla de base — fuera del
  presupuesto de 4 mutaciones.
- **La precedencia del 400 de categoria** que afirma el contrato §2 es cierta en el codigo pero
  no tiene oraculo.
- **El rasterizado del glifo del placeholder** se midio en macOS; el test asevera un piso de 1%
  y un techo de 50% de pixeles opacos, asi que **si en CI (Linux) faltaran fuentes ese test es
  ROJO y no un falso verde**. Pendiente de la primera corrida de CI, no declarado imposible.

### Lo que FALTA y es paso del orquestador, no del agente

- **La migracion `0035` esta aplicada SOLO en la rama de integracion** (`br-shy-king-axu5s3ze`).
  **Produccion NO se toco.** Aplicarla es paso posterior al commit, y se confirma con el owner.
- **Verificar la CI con `/check-runs`** —nunca con `/status`, que en este repo miente— para el
  sha exacto, despues del push.

~~**SIN COMMITEAR**~~ → **TODO COMMITEADO Y PUSHEADO** (2026-09-17, autorizado por el owner).
Los 36 archivos de la 0069 entraron en **`fde3757`**; despues vinieron `34cb98b` (el fix de la
bomba de tiempo), `785605f` (docs), `cd952d1` (decisiones del owner) y `08227ed` (la migracion
`0036`). **`git status --short | wc -l` → 0** y `HEAD` == `origin/main` en **`08227ed`**.

---

**Lo anterior al arco 2 esta detallado abajo, en «ARRANCA ACA LA SESION QUE SIGUE».**

**→ LA SPEC 0067 ESTA `implementada`** (2026-09-17): **cuatro pasos, cuatro `PASS`** de revisor
independiente, cada uno en contexto fresco. **Nada esta commiteado ni pusheado: eso lo autoriza el
owner.**

**COMMITEADA Y PUSHEADA el 2026-09-17** — commit `9086c9a`, autorizado por el owner. **Verificado
con `git rev-parse HEAD` y `git rev-parse origin/main` dando el MISMO sha**, no por asumirlo (esta
cabecera ya mintio dos veces en sesiones anteriores). 91 archivos, +24.149 / -2.747.

**→ EL PROCESO CAMBIO: ADR 0071, aceptado por el owner el 2026-09-17.** Spec chica
(`docs/specs/TEMPLATE-CHICA.md`, nuevo) para cambios de **un dominio, sin migraciones y sin
decision de producto abierta**; decisiones del owner **antes** de la prosa; **UN implementador y
UN revisor por spec**, no por paso; filas de `INDEX` de **3 lineas**; **gates completos una vez
por spec**. `CLAUDE.md` puntos 2, 4 y 7 actualizados. **No se toco el protocolo de mutaciones ni
la revision independiente**: en esta misma spec el revisor cazo un oraculo inexistente y la fuga
sobrevivia a 1027 tests. El ADR lleva los numeros medidos y **se re-mide contra la proxima spec
chica**.

**El paso 2 NO lleva spec nueva**: ya es el §4 de la 0068, `cerrada`. Escribir otra seria la
duplicacion que el 0071 vino a cortar. La plantilla chica estrena en el proximo trabajo nuevo.

**→ LA SPEC 0068 ESTA `implementada` (2026-09-17), con `PASS` de revisor independiente sobre la
spec ENTERA.** Entregado: `GET /api/staff`, `email` fuera del `StaffDTO`, `requireStaffOwner`
adentro del `try` en 4 rutas, el borrado de `emailOTP`, y en el contrato `§2-bis`, `§4-bis` y los
oraculos por superficie. **Nada commiteado: eso lo autoriza el owner.**

**Gates corridos por el ORQUESTADOR sobre el estado final** (cadena con `&&`, o sea exit 0 en cada
paso): `typecheck --force` · `lint` · `format:check` · `test` **1018 passed / 355 skipped / 0
failed** · `build --force` · `rg -n MUTATION apps tools` **vacio**. Los dos barridos del DoD, exit
1. Integracion del revisor: **8 archivos / 53 tests / 0 failed**, incluidos `magic-link.neon` y
`auth-start.neon` (sacar `emailOTP` no toco el link magico).

**14 mutaciones en total, ninguna sobrevivio sin explicacion**: 6 del implementador, 5 del revisor,
3 del orquestador. Las dos que valieron el ciclo:

- **El `FAIL`**: el DoD pedia un oraculo contra la fuga del email sintetico y **no existia** para
  `…/pin/regenerate` ni `…/status`. La fuga escrita **por fuera** de `toStaffDTO`
  (`{...toStaffDTO(…), email}`) pasaba `typecheck`, **1027 tests** y los 4 `.neon` — TypeScript
  rechaza el exceso de propiedades pero **no** el spread. Cerrado con
  `staff-status.neon.integration.test.ts` (nuevo) y +5 lineas en `staff-pin-change.neon`.
- **El oraculo que iba a quedar VACUO**: sin el plugin, los 9 paths de `emailOTP` dan 404 **por
  inexistentes**, asi que el test viejo seguia verde sin probar nada. Se mudo a
  `Object.keys(auth.api)`; reponer el plugin lo pone rojo **por la clave**
  (`to not include 'signInEmailOTP'`), y el revisor probo ademas que los 2 `disabledPaths` que
  quedan son guard vivo (sin la entrada, el path da **500**, no 404).

**PRIMERA MEDICION DEL ADR 0071:** paso 1 **18 min** (implementador fresco) → paso 2 **6,8 min**
(mismo implementador **reanudado**, sin re-leer el repo) → revision final **4,4 min**. La palanca
grande es el contexto, no los comandos.

**COMMITEADA Y PUSHEADA el 2026-09-17** — commit **`a0f66ea`**, autorizado por el owner. 26
archivos, +1.528 / −190. **Verificado con `git rev-parse HEAD` y `git rev-parse origin/main` dando
el MISMO sha**, no por asumirlo.

**CI VERDE, VERIFICADA CON `/check-runs` (2026-09-17).** Sha `a0f66ea`: **`verify: completed ->
success`**, `total checks: 1`, **`no-success: 0`**. Pasos leidos uno por uno del job
`105111713508`: `lint`, `typecheck`, **«La integracion Neon tiene que correr, no skipearse»**,
**«Migrar la rama Neon de CI»**, `Unit + integracion Neon`, `playwright install`, `test:e2e`,
`build`, `format:check` — **los 18 en `success`**. Nunca se uso `/status`, que aca miente.

**→ PRODUCCION LIMPIADA Y MIGRADA (2026-09-17), ejecutado por el agente via MCP de Neon.**

**Objetivo confirmado con el owner en el momento, no solo el permiso:** proyecto `mi-pasaporte`
(`red-violet-38772073`), rama **`main` = `br-curly-silence-ax8acywm`**, la `default`/`primary`.
**NO** se toco ninguna rama de integracion.

**Dos hallazgos que se midieron ANTES de truncar, y que el owner decidio:**

1. **Habia 4 suscripciones de Stripe VIVAS** en la base (`plan: plus`, `status: active`, con
   `customer` y `subscription` id): A1, A3 Test ×2 y Negocio B. **El owner dijo «elimina, no te
   preocupes por Stripe»** — asi que los ids se perdieron con el truncate. Si alguna seguia viva
   del lado de Stripe, sus webhooks llegan sin fila que matchee. **CERRADO por el owner el
   2026-09-17: «olvidate de las suscripciones, es sandbox».** No es deuda y no vuelve a listarse
   — no hay facturacion real que perseguir.
2. **`core.terms_template` no es dato de prueba: es SEMILLA**, insertada por la migracion
   `0004_polite_turbo.sql:97`. Truncarla la borraba **para siempre** (esa migracion ya figura
   aplicada, `db:migrate` no la re-ejecuta) y `GET /api/loyalty-terms/templates` habria quedado
   devolviendo `[]`. **El owner eligio EXCLUIRLA del truncate.** Verificado antes de ejecutar que
   la exclusion es efectiva: **`terms_template` no tiene NINGUNA FK** —ni entrante ni saliente—,
   asi que el `CASCADE` no podia alcanzarla.

**Ejecutado:** `TRUNCATE` de `core.*` + `merchant_auth.*` menos `core.terms_template`, con
`RESTART IDENTITY CASCADE`. **Verificado por SQL:** las 2 tablas de `merchant_auth` y las 28 de
`core` en **0 filas**; `core.terms_template` con sus **3** semillas.

**Migraciones aplicadas a PRODUCCION con `drizzle-kit migrate`** (no con SQL crudo, para que el
journal no quede mintiendo): **32 → 35**. Verificado por SQL, no por el mensaje de la herramienta:
`merchant_auth.password_reset_attempt` **ya no existe** (0033), `merchant_auth.auth_start_attempt`
**existe** (0034), `core.business.slug` **existe** y `core.business_membership.pin_hash`
**existe** (0032).

**`consumer.*` TAMBIEN TRUNCADO, por decision del owner (2026-09-17).** El script acordado
alcanzaba solo `core.*` + `merchant_auth.*`, y 7 tablas de `consumer` habian quedado con filas
porque **no tienen FK a lo truncado** (el `CASCADE` no las alcanzaba): eran identidades de
consumidor y pases de Wallet apuntando a programas ya inexistentes. Se verifico antes de ejecutar,
con la misma diligencia que cazo `terms_template`, que **ninguna migracion siembra datos en
`consumer.*`** (`rg 'INSERT INTO "consumer"' drizzle/*.sql` → vacio), asi que no habia semillas que
perder.

**ESTADO FINAL DE PRODUCCION, verificado por SQL:** de las 43 tablas de `core`, `merchant_auth` y
`consumer`, **la unica con filas es `core.terms_template` (3 semillas)**. Todo lo demas en **0**.

**LAS RAMAS DE NEON: NINGUNA ESTA SIN USO, asi que no se borro ninguna.** Medido: `ci-integration`
(`br-icy-hat-axsfqc8k`) es la que uso la CI verde de `a0f66ea` hace minutos, y
`spec-0065-marketing` (`br-shy-king-axu5s3ze`) es a la que apunta `.env.integration.local`, o sea
**toda la suite `.neon` local**. Borrar cualquiera rompe CI o los tests de integracion. La segunda
tiene TTL hasta **2026-10-15**.

## ⇥ ARRANCA ACA LA SESION QUE SIGUE (handoff del 2026-09-17, post-`/clear`)

**Todo lo anterior esta CERRADO y verificado.** Commit `a0f66ea` pusheado (HEAD == origin/main),
**CI verde leida de `/check-runs`** (`verify: completed -> success`, 18 pasos en `success`),
**produccion limpia y migrada a 35**. Lo unico sin commitear es este `docs/TASKS.md`.

### Lo que hay que hacer: el ARCO 2 (2ª spec del ADR 0070)

**ES API, NO PANTALLA. Confirmado con el owner el 2026-09-17** y es textual del ADR 0070 §16: «la
UI la construye el owner por fuera, con ChatGPT, asi que lo que se construye aca es la capa de
logica y los endpoints». El nombre del ADR —«el wizard de 3 pantallas»— engaña: lo que se entrega
son **los endpoints que esas 3 pantallas consumen** mas **el contrato HTTP escrito** (forma de
`0067-contratos-de-api.md`). Una spec de este arco que liste un archivo de pantalla como «crear»
esta mal alcanzada.

**Contenido segun el corte de 4 specs ya confirmado:** logica de pantallas 2 y 3, categoria
`gcid:`, paises + Mexico, sello placeholder, programa activo, y **el QR**. Consume `server/slug.ts`
y la migracion del `slug`, **ya aplicadas en produccion**.

**Plantilla:** evaluar contra las tres condiciones del ADR 0071 (un dominio, sin migraciones, sin
decision de producto abierta). **Probablemente NO califique** —toca varios dominios y puede pedir
esquema—, o sea `TEMPLATE.md`. **Decidirlo midiendo, no por costumbre.**

### Y LA RE-MEDICION DEL ADR 0071 — el owner la pidio explicitamente contra ESTE arco

El ADR 0071 promete **de ~60 min a ~25** y se cerro con la condicion escrita de re-medirse. **Como
se mide, para que la comparacion sea honesta:**

**Baseline de la spec 0068** (lo que hay que batir): implementador paso 1 **18 min / 71 tools /
179k tokens** · revisor **9 min / 40 / 106k** · implementador cerrando el FAIL **8 min / 18 /
208k** · paso 2 con el implementador **reanudado** **6,8 min / 17 / 238k** · revision final **4,4
min / 17 / 137k**. **Total subagentes ~46 min y 868k tokens**, mas la orquestacion.

**Que anotar en el arco 2:** el `duration_ms`, el `tool_uses` y el `subagent_tokens` que devuelve
**cada** notificacion de subagente, y cuantos ciclos hubo. **Comparar contra el baseline de arriba
y escribir el numero REAL en el ADR 0071**, aunque contradiga la promesa. Si no bajo, el ADR se
corrige con lo medido — un ADR que promete y no se re-mide es exactamente la clase de afirmacion
sin verificar que este repo persigue.

**Lo que NO cuenta como mejora:** bajar el tiempo salteando mutaciones o la revision independiente.
En la 0068 el revisor cazo un oraculo que no existia y la fuga sobrevivia a 1027 tests; ese ciclo
**se paga**.

### Deuda viva, por si aparece en el camino

- **`PARQUEADO.md` fila 56** — el gate de email verificado cubre **2 superficies de API de 11**.
  Mientras viva, un owner sin verificar crea sucursales, sube marca, arma campañas y **abre un
  checkout de Stripe**. Las decisiones de contenido ya estan tomadas; falta el cuando.
- **`PARQUEADO.md` fila 57** — `core.business.status` no existe; pedido del owner para la 3ª spec.
- ~~**Stripe**~~ — **CERRADO el 2026-09-17, no es deuda.** El owner: «olvidate de las
  suscripciones, es sandbox». Las 4 suscripciones truncadas eran de prueba: no hay facturacion
  real. **No re-listar.**
- **Las ramas de Neon no se borraron porque ninguna esta sin uso** (ver arriba). Lo que tiene
  sentido es **renombrar** `spec-0065-marketing`, no borrarla.

## ⇥ HANDOFF 2026-09-17 — LO QUE HACE LA SESION QUE VIENE, EN ORDEN

**La 0067 esta CERRADA del todo**: `implementada`, commit `9086c9a` pusheado, **CI verde verificado
con `/check-runs`** (el paso «Migrar la rama Neon de CI» incluido: las tres migraciones aplicaron
limpias). No hay nada a medias de ese arco.

**El owner dio estas tres instrucciones el 2026-09-17. Estan en orden y no hay que repreguntarlas:**

### 1. HECHO — la spec 0068 esta `cerrada` (2026-09-17)

`docs/specs/0068-cierre-de-la-api-de-identidad.md`, con su fila en `docs/INDEX.md`. **Nada de
codigo escrito todavia**: lo que hay es la spec.

**Las cuatro decisiones que la bloqueaban las contesto el owner el 2026-09-17:**

1. **Alcance recortado a staff.** Palabras del owner: «como estamos en proceso de reconversion
   todo a API diferentes, mas seguras, yo tocaria solo lo que faltaba de staff para completar lo
   que faltaba del arco 1». → **el gate de email en las otras 9 superficies SALE de la spec** y
   vive en `docs/PARQUEADO.md` **fila 56**, con sus dos decisiones de contenido **ya tomadas**
   (si al `status='active'`, si a los `code` en 401/403): lo unico que falta es cuando.
2. **`email` sale del `StaffDTO`.** Confirmado.
3. **Negocio con `status` + suscripcion `free` de base.** Medido, y son dos cosas distintas: la
   **suscripcion free YA existe** en toda alta (`api/onboarding/business/route.ts:155` inserta
   `plan:'free'`, `status:'active'`), y **`core.business.status` NO existe** — los `status` del
   esquema son los de `business_membership`, `location` y `subscription`. Es esquema nuevo, la
   0068 no toca esquema → `PARQUEADO.md` **fila 57**, para la **3ª spec** (entitlements).
4. **`code` en los 401/403.** Confirmado; aplica a las superficies parqueadas en la fila 56.

**Lo que la re-medicion corrigio de lo que decia este archivo** (regla: lo que se le pasa a un
subagente como insumo es una afirmacion propia, y se re-mide antes de despachar):

- **Las superficies de API del owner son 11, no 6.** Las 6 del encargo eran `api/staff/*`, el
  `PATCH` del slug, `api/billing`, `api/locations`, `api/marketing` y `api/catalog`. **Las 5 que
  faltaban**: `api/brand`, `api/brand/logo-upload` (que **ni siquiera resuelve owner**: solo
  sesion), `api/loyalty-program`, `api/loyalty-program/stamp-upload` y `api/loyalty-terms/templates`.
- **Hallazgo nuevo, no estaba en ningun doc:** los tres `ownerBusiness` (`brand.ts:32`,
  `catalog/core.ts:73`, `loyalty-program.ts:51`) **no filtran `memberships.status='active'`**, que
  `ownerContext` si filtra, y loyalty ordena `desc` donde los otros ordenan `asc`. Es la deriva
  que el docblock de `locations/_auth.ts:8` decia estar evitando.
- **El contrato ya MIENTE hoy**: sus «Convenciones» declaran que las cuatro rutas de staff
  envuelven «todo lo que toca la base, incluida la resolucion de la sesion», y en **4** de ellas
  el guard esta fuera del `try`. Arreglarlo es lo que vuelve cierto al documento.

**Sondas ejecutadas** (archivo temporal de vitest, **borrado**, `git status` limpio):
`Object.keys(auth.api)` da **44** endpoints con `emailOTP` puesto, incluidos `signInEmailOTP` y
`sendVerificationOTP` — por eso el oraculo del punto (4) se asevera sobre la instancia en vez de
sobre un 404 que quedaria vacuo. Y los **endpoints core de password** de better-auth siguen
montados: `request-password-reset` → **400 `RESET_PASSWORD_DISABLED`**, `reset-password` y
`change-password` → 400 de validacion, `set-password` → 404. Ninguno autentica: **declarado
afuera de alcance**.

**Los barridos del DoD se corrieron contra el arbol ANTES de cerrar** (leccion de la 0067, que
cerro con cuatro criterios imposibles): dos nacieron mal y se corrigieron — el conteo de archivos
de un barrido, y un `rg` sobre el contrato que **no puede dar cero** porque la palabra `email`
tambien esta en el cuerpo de `auth/start`.

### 1-bis. El encargo original del owner, para referencia — tres puntos, un solo dominio

No es el wizard todavia. Es cerrar la deuda que dejo la 0067, y el owner la aprobo agrupada asi:

- **(a) `GET /api/staff`** reusando `listStaff` (`server/staff.ts:100`, hoy **sin ningun consumidor de
  produccion**), **mas su fila en `docs/specs/0067-contratos-de-api.md`**, mas la fila que falta de
  `POST /api/staff/[userId]/status`. **Por que primero: sin esto la UI que el owner construye por
  fuera NO puede listar el equipo**, y `regenerate` y `status` son inalcanzables para cualquier
  integrante creado antes de la sesion actual (su `userId` solo sale del 201 del alta).
  **TRAMPA ESCRITA DE ANTEMANO:** `StaffDTO` lleva `email`, que es el sintetico `@staff.invalid`. Un
  `GET` que lo serialice le devuelve al navegador **el mismo contacto falso que motivo borrar la
  consola**. O se omite del DTO, o el contrato lo marca como no-contacto.
- **(b) Unificar el gate de email verificado en un `requireApiOwner`** que usen las **seis**
  superficies de API. Hoy lo tienen dos (`api/staff/*` y el `PATCH` del slug). **Medido:** no existe
  un cuello de botella unico para API — `requireOwner` de `server/auth-guards.ts` es guard de
  **paginas** y contesta con `redirect()`, que sobre un POST es un **307**; por eso `api/billing`,
  `api/locations`, `api/marketing` y `api/catalog` escribieron cada uno el suyo con `ownerContext`.
  **En el mundo del ADR 0070 el guard de paginas ya no es la puerta**, asi que hoy un owner sin
  verificar puede crear sucursales, subir marca, armar campañas y abrir un checkout de Stripe.
  **Falso consuelo a evitar:** `billing-routes-auth.neon` NO cubre esto — su seed pone
  `emailVerified: true`. **Incluir tambien**: mover `requireStaffOwner` ADENTRO del `try` en
  `api/staff/route.ts`, `.../pin/regenerate` y `.../business/slug`, que hoy queda afuera y hace que un
  fallo de base salga como **500 sin `code`** en vez del `503` que el contrato declara.
- **(c) Borrar `emailOTP` de `server/auth.ts`** — el owner pregunto y se le confirmo con medicion:
  **hay una sola instancia de better-auth en el repo** (el consumidor no tiene la suya) y `emailOTP`
  existe **solo** para el reset de contraseña (`sendVerificationOTP` → `passwordResetEmail`), que ya
  no existe. Se va tambien `passwordResetEmail` de `server/email/channel.ts`.
  **OJO:** al sacar el plugin, sus **9** rutas pasan a dar 404 por inexistentes en vez de estar
  bloqueadas por `disabledPaths`, asi que **`merchant-auth-disabled-paths.test.ts` tiene que reflejar
  eso** — ese test hoy pinnea la lista de 9.

**Antes de cerrar esa spec: correr CADA criterio de DoD que sea un comando contra el arbol.** La 0067
se cerro con **cuatro** criterios imposibles de cumplir y el caso ya esta en `LECCIONES.md`.

### 2. EJECUTAR el borrado de la base — el owner autorizo que lo haga el agente, via MCP

**Autorizacion explicita del owner (2026-09-17), con dos recortes que cambian el procedimiento:**

- **SOLO DATOS, NO SCHEMAS.** Truncar filas; **no** tocar tablas, tipos ni columnas.
- **STRIPE FUERA DE ALCANCE: «ya esta resuelto».** El **PASO 0** (exportar ids) y el **PASO 1**
  (checklist de Stripe) de `tools/wipe-database.sql` **NO se ejecutan**. Esto **anula** la regla de
  «Stripe va primero» para esta corrida — y la anula el owner, no el agente.
- Se ejecuta con **MCP de Neon** (`mcp__neon__run_sql`), no con `psql`.

**Lo que SI hay que hacer, y con cuidado:** el script vive en `tools/wipe-database.sql`; su **PASO 2**
arma la lista de tablas de `core.*` + `merchant_auth.*` y hace
`TRUNCATE … RESTART IDENTITY CASCADE` (linea 103), y el **PASO 3** verifica por SQL. **Confirmar
contra que proyecto y que rama se corre ANTES de ejecutar** (el proyecto es `mi-pasaporte`,
`red-violet-38772073`; **la rama de integracion `br-shy-king-axu5s3ze` NO es produccion**), contar
filas antes, ejecutar, y **transcribir los `select count(*)` en cero**. Es destructivo e irreversible:
la regla del harness pide preguntar antes de invocar un tool destructivo aunque haya autorizacion
previa — **confirmar el objetivo con el owner en el momento, no el permiso.**

### 3. Recien despues: la 2ª spec del arco (el wizard de 3 pantallas + el QR)

Consume `server/slug.ts` y la migracion del `slug` que la 0067 dejo lista.

### ~~Sin commitear al cerrar esta sesion~~ → YA COMMITEADO (`b2fef3d`, 2026-09-17)

Los 3 archivos de documentacion (`CLAUDE.md` con la correccion de `/status` → `/check-runs`,
`docs/LECCIONES.md` y `docs/TASKS.md`) entraron en el commit **`b2fef3d`**, que **esta pusheado**:
`git rev-parse HEAD` y `git rev-parse origin/main` dan el mismo sha (verificado el 2026-09-17, no
asumido).

**Lo que hay sin commitear AHORA (2026-09-17, sesion de la 0068) son 4 archivos, todo
documentacion:** `docs/specs/0068-cierre-de-la-api-de-identidad.md` (nuevo), `docs/INDEX.md` (su
fila), `docs/PARQUEADO.md` (filas 56 y 57) y este `docs/TASKS.md`. **El owner no autorizo ese
commit todavia.**

## ⇥ EN EJECUCION: EL ALTA DEL COMERCIO ES UN WIZARD (ADR 0070)

**Leer primero:** `docs/adr/0070-el-alta-del-comercio-es-un-wizard-de-tres-pantallas.md` (321
lineas). Las secciones **11-17 son decisiones del owner del 2026-09-16**. **No repreguntar nada de
ahi.**

> **Las dos reglas que gobiernan TODO este arco:**
>
> **(§16) Se entrega API y endpoints, NO interfaz.** La UI la construye el owner por fuera, con
> ChatGPT. El entregable son **dos** piezas: los endpoints **y el contrato HTTP escrito**. El
> orquestador ya se salteo esto una vez (caso en `docs/LECCIONES.md`; regla en `CLAUDE.md`).
>
> **(§17) La UI vieja de lo que se refactoriza se BORRA** — «no dejar rastros viejos». Y la limpieza
> de enlaces muertos es **parte** del borrado: tres de las referencias que arrastra la 0067 son los
> `redirect` del guard de acceso, que apuntados a una ruta borrada dan **404 en vez de rebote**.
>
> **Costo aceptado por el owner mientras dure el arco: el producto no tiene entrada por navegador,
> asi que NO hay QA de pantalla.** La verificacion es por HTTP, con las respuestas transcriptas.
> Es la excepcion explicita a «gana la pantalla», y se declara en cada spec.

### Los 4 puntos, cerrados

1. **Verificacion de email** — no bloquea el alta; bloquea **todo lo posterior al wizard** y es el
   **primer paso del onboarding**. Motivo del owner, que es de negocio y no de seguridad: «hoy
   Staff es gratis, pero va a pasar a ser parte del plan de pago quizas».
2. **Slug** — no sigue al nombre. Se cambia por **accion explicita** con chequeo de disponibilidad.
3. **PIN** — hasheado; **5 fallos → 15 min, 3 mas → 1 h, el siguiente → 24 h**; el owner lo ve
   **una sola vez** al generarlo y despues **solo puede regenerarlo**.
4. **Pais** — prellenado pero el selector ofrece **siempre la lista completa** (VPN). No hay caso
   de pais no soportado: **por ahora solo LATAM**.

### El arco se corta en CUATRO specs (propuesta del orquestador, NO acordada con el owner)

El ADR 0070 no entra en una spec sola. Orden propuesto, por dependencia:

| Spec | Que | Estado |
|---|---|---|
| **0067** | **Identidad sin contraseña** — owner por email + link magico, staff por `handle@slug` + PIN, gate de email verificado, slug del negocio, borrado del arco de recuperacion y de la UI vieja, wipe de la base | **`implementada` — 4 pasos, 4 `PASS`, commit `9086c9a` pusheado y CI verde (2026-09-17)** |
| **0069** | **El wizard de 3 pantallas + el QR** — logica de pantallas 2 y 3, categoria `gcid:`, paises + Mexico, sello placeholder, programa activo | **`implementada`, PASS de revisor, EN PRODUCCION** (2026-09-17) |
| **0072** | **Capa de entitlements** — `can()` / `limitOf()`, migrar los 3 call-sites que ya divergieron | **`implementada`, PASS de revisor, EN PRODUCCION** (`0507cf5`, CI verde 2026-09-18) |
| 4ª | **Onboarding derivado** — checklist calculado de los hechos de la base, sin columna `onboarding_step` | **no existe. DIFERIDA sin fecha** el 2026-09-18 — ver §«LA 4ª SPEC» |

**Corte de 4 specs confirmado por el owner el 2026-09-16.** Se serializan en ese orden: la 2ª consume
`server/slug.ts` y la migracion del `slug` que deja lista la 0067.

**Por que 0067 va primera:** owner y staff comparten **hoy** la misma pantalla de login
(`login-form.tsx:49`) y el staff se crea con `signUpEmail` + contraseña (`staff.ts:119`). La
identidad es una sola rebanada vertical; partirla deja la app en un estado intermedio roto.

### HALLAZGO 8 — `start` tiene la MISMA preimagen y NO se toco

`POST /api/merchant/auth/start` con un email conocido `@staff.invalid` cae en la rama del link
magico, **emite token y gasta cupo igual**. El fix es **una linea** con el predicado que ya esta en
el arbol. No se aplico porque cambia una rama del contrato que el revisor ya valido y que es **el
oraculo de la mutacion #4**: es alcance que decide el owner. Se le pregunto al revisor si coincide o
si es el mismo bloqueante en otra puerta — **esa respuesta decide si el paso 3 es `PASS`.**

### DECISIONES DEL OWNER, no del orquestador (ninguna tomada)

1. **EL MAS IMPORTANTE — el gate de email verificado cubre 2 superficies de API de 6.** Medido:
   `rg 'emailVerified|email_not_verified' apps/merchant/src/app/api/` solo aparece en
   `api/staff/_auth.ts:50`. **No lo tienen** `api/billing/_auth.ts`, `api/locations/_auth.ts`,
   `api/marketing/_auth.ts`, `api/catalog/_auth.ts` ni `api/brand`: los cuatro resuelven owner con
   `ownerContext` y nada mas. **En el mundo del ADR 0070 —la UI la construye el owner por fuera y
   consume API— `requireBackofficeSession` deja de ser la puerta**, asi que un owner sin verificar
   puede crear sucursales, subir marca, armar campañas y abrir un checkout de Stripe: literalmente
   «todo lo posterior al wizard» que el ADR §11 manda bloquear. No es bloqueante porque el DoD pide
   «una ruta owner-only» (singular) y eso se cumple. **Ojo con el falso consuelo:**
   `billing-routes-auth.neon` NO falsifica esto — su seed pone `emailVerified: true`, asi que nunca
   ejercita el caso.
2. **El `503 staff_unavailable` no cubre la resolucion de sesion en 3 rutas** (`api/staff/route.ts`,
   `.../pin/regenerate`, `.../business/slug`): `requireStaffOwner` esta **fuera** del `try`.
   **El revisor aplico la CONDICION DE CORTE** —es la segunda vuelta de la misma clase de hallazgo,
   el paso 2 ya cazo lo mismo en las otras dos rutas— y por regla va al owner en vez de abrir otra
   ronda. Arreglo si se toma: mover `requireStaffOwner` adentro del `try` en las tres.
3. **`app/page.tsx` ya no rebota la sesion viva a `/backoffice`** (forzado por el bucle real).
4. **`emailOTP` quedo vivo y sin uso**: su superficie HTTP esta cerrada (los 9 paths en
   `disabledPaths`, medido contra la fuente), pero es configuracion muerta.
5. **Cambiar el slug cambia el identificador de login de todo el staff sin aviso.** El revisor midio
   que **no** hay cascada de bloqueos (el 401 sale antes de `registerPinAttempt`): es problema de
   comunicacion, no de disponibilidad.
6. **`staff-console.tsx`** sigue perdiendo la credencial del integrante en cada alta.
7. Los cupos del rate limit (20/IP/h, 5/email/h, 10/email/dia) **los eligio el implementador**.



Reproducido por el orquestador, no citado del agente: `typecheck` 3/3 **sin cache**, `lint` exit 0,
`format:check` OK, `test` **1013 passed / 343 skipped / 0 failed**, y **`build` 3/3 successful sin
cache** —lo que mas podia romperse al borrar pantallas—. `rg MUTATION` vacio. **Los dos barridos de
la §7-bis dan VACIO.**

**Las cuatro mutaciones (#3, #4, #5, #6) salieron ROJAS por la asercion correcta**, corridas al final
y de a una. **La #6 no quedo verde**, que era el riesgo declarado: el guard **si** tiene oraculo de
destino (`expected '/login' to be '/'`).

**El TERCER barrido mal escrito del DoD, y la spec ya quedo corregida.** Pedia que
`rg 'PASSWORD_RECOVERY_ENABLED|forgot-password|merchant-recovery'` diera cero, y es **imposible**:
devuelve exactamente `server/slug.ts:35` y `server/slug.test.ts:114`, que son la palabra **reservada**
que la §1 de la misma spec manda tener en `RESERVED_SLUGS` con piso aseverado. Quitarla violaria la §1
y liberaria un slug que tiene que seguir reservado. Van **tres** defectos de la misma familia
(§7-bis corrigio los dos primeros): **el patron es escribir un barrido `rg` como DoD sin correrlo
contra el arbol**. Candidato a `LECCIONES.md` cuando cierre el arco.

**Lo que el implementador resolvio y hay que mirar con cuidado** (esta en el encargo del revisor):

- **El gate no podia mandar a `/onboarding?v=1`** como decia la spec §3, porque esa ruta **se borra
  en este mismo paso**. Eligio `/?e=email_not_verified`, por el mismo canal `?e=` que ya usa
  `staff_disabled` y que ya esta en la tabla de codigos de rebote del contrato.
- **Habia un bucle de redireccion REAL y no lo abrio el gate**: `app/page.tsx` rebotaba la sesion
  viva a `/backoffice`, y con los tres `redirect` del guard yendo a `/`, el caso «sesion sin
  membresia» cerraba `/` → `/backoffice` → `/`. Lo resolvio **borrando** ese rebote. **Es un cambio
  de comportamiento que el owner no pidio** y va como hallazgo, no como aceptado.
- **Como sale el owner del rebote**: consumir el link magico **verifica el email** (medido en
  better-auth 1.6.26). **Si eso fuera falso, el producto queda cerrado con llave.** Es lo mas
  importante de la revision del paso 3.
- **`emailAndPassword: false` NO da 404**: better-auth sigue montando `/sign-in/email` y contesta
  **400**. Su primer test asertaba 404, salio rojo, y **corrigio el test contra la medicion, no al
  reves**.

### HALLAZGOS DEL PASO 2 — A DECIDIR POR EL OWNER, no estan tomados

1. **`app/backoffice/staff/staff-console.tsx` quedo obsoleta y el paso 2 NO la toco** (tenia
   prohibido tocar `app/` fuera de `api/`). Sigue pidiendo email + contraseña, el servidor
   los ignora, y **no muestra el PIN**, que se ve una sola vez: usada tal cual, da de alta al
   integrante y pierde su credencial. Es UI vieja de lo que se refactoriza, o sea candidata
   al borrado del ADR 0070 §17 en el paso 3.
2. **El cambio de PIN rechaza `newPin === currentPin` con 400 `pin_unchanged`.** Es lectura
   del «cambio obligatorio», no una regla que el owner haya escrito. Si prefiere permitirlo,
   es una linea.
3. **¿El PIN se evalua tambien cuando hay un bloqueo vivo?** Hoy si: el guard esta adentro
   del `UPDATE` atomico y consultarlo antes seria el read-then-write que la spec prohibe.
   Cuesta un hash por intento bloqueado y regala tiempo de respuesta constante. La spec §4
   escribe «sin evaluar el PIN»; el codigo cumple lo observable, no el orden.
4. **El `DEFAULT` volatil del slug sigue vivo** (hallazgo 1 del paso 1). El paso 2 no toca la
   ruta del alta del negocio, asi que la decision sigue abierta para el paso 3.

## HALLAZGOS DEL PASO 3 — A DECIDIR POR EL OWNER, no estan tomados

1. **El DoD de la spec pide un barrido que es IMPOSIBLE de dejar en cero, y esta vez es la §1 la que
   lo hace imposible.** `rg -n "PASSWORD_RECOVERY_ENABLED|forgot-password|merchant-recovery"
   apps/merchant/src` devuelve **exactamente dos lineas**: `server/slug.ts:35` y
   `server/slug.test.ts:114`, que son la palabra **reservada** `"forgot-password"` que la propia
   spec §1 manda tener en `RESERVED_SLUGS` (y que el test asevera con piso, por PASS del paso 1).
   No se toco: quitarla violaria la §1 y liberaria un slug. Los otros dos barridos —los que la
   §7-bis declara como los que corre el revisor— **dan VACIO**.
2. **`emailOTP` quedo vivo y ya no sirve para nada.** Su unico `type` configurado es
   `forget-password`, sus 9 paths siguen en `disabledPaths` y su unico consumidor server-side
   (`server/recovery/*`) se borro en este paso. Lo mismo `passwordResetEmail` en
   `server/email/channel.ts`. **No se toco porque la spec enumera exactamente que cambia en
   `auth.ts`** («sacar `emailAndPassword`, sumar `magicLink`, ampliar `disabledPaths`») y sacar un
   plugin es superficie de producto. Si el owner lo quiere fuera, son ~25 lineas y el guard de
   `disabledPaths` hay que reescribirlo (sin plugin, esos 9 paths dan 404 igual y el test dejaria
   de discriminar).
3. **Cambiar el slug cambia el identificador de login de TODO el staff** (`handle@slug`). Es
   inherente a que el ADR 0070 §5 los haga el mismo identificador. El `PATCH` no avisa, no pide
   confirmacion y no da periodo de gracia. Esta declarado en el contrato §8.
4. **`POST /api/merchant/auth/start` con el email SINTETICO de un integrante** (`@staff.invalid`)
   entra en la rama del email conocido e intenta mandarle un mail a un dominio que por RFC 2606
   nunca resuelve. No abre sesion (el invariante se sostiene) y el buzon no existe, pero segun el
   proveedor la respuesta puede ser un 503 en vez de un 200 — o sea un canal fino para distinguir
   un `user` de staff de uno de owner. No se filtro a proposito: filtrar seria agregar una regla
   que el owner no pidio.
5. **El `DEFAULT` volatil del `slug` sigue vivo** (hallazgo 1 del paso 1, ahora exigible). Ya hay
   una ruta que escribe el slug, asi que el `DEFAULT` cumplio su funcion; mientras viva, **una ruta
   que se olvide del slug no falla, se lleva un `b-…` de URL publica**. Quitarlo sigue costando los
   15 errores de tipo que midio el orquestador en el paso 1.
6. **Los cupos del rate limit de `start` (20/IP/h, 5/email/h, 10/email/dia) los eligio el
   implementador, no el owner.** La spec solo pide «rate limit por IP». Estan en el contrato §5 y
   pinneados por `auth-start.test.ts`; moverlos es una linea.
7. **`app/backoffice/staff/staff-console.tsx` sigue obsoleta** (hallazgo 1 del paso 2, sin cerrar):
   pide email + contraseña, el servidor los ignora y no muestra el PIN. El paso 3 **no** la borro:
   la spec enumera que pantallas se borran y esa no esta. Es candidata al §17 en la spec del wizard.

### Lo que el paso 3 declara AFUERA (sin oraculo, a proposito)

- **La entregabilidad del mail** del link magico: se verifica que se **encola** por el canal
  (`EMAIL_PROVIDER=console` en los tests), no que llegue a una bandeja. Ya lo declaraba la spec.
- **El QA de pantalla**: no existe, y a partir de este paso **tampoco existe la pantalla**. La
  verificacion por `curl` contra un preview **no se corrio**: exige un deploy y este trabajo no se
  commitea ni se pushea.
- **La carrera de dos `start` simultaneos con el mismo email desconocido**: el codigo la resuelve
  con el unico de `merchant_auth.user` (el perdedor cae en la rama del email conocido) pero
  **racearla de verdad no se hizo** — mismo criterio que la carrera del PIN.
- **El limite heredado de `merchant-session.ts`**: su `serializeCookie` no replica los fallbacks de
  `__Secure-`/`__Host-`. Hoy es inocuo y el paso 3 lo reusa tal cual, sin tocarlo.

## ESTADO DEL ARBOL (reescrito entero el 2026-09-17, al cerrar la 0067)

- **La 0067 esta COMMITEADA Y PUSHEADA**: commit `9086c9a`, 91 archivos, +24.149 / -2.747.
  **Verificado con `git rev-parse HEAD` y `git rev-parse origin/main` dando el mismo sha** — no por
  asumirlo: esta cabecera ya mintio dos veces en sesiones anteriores por dar el push por hecho.
- **CI VERDE, leido del endpoint correcto.** `/check-runs` del sha: `verify: completed -> success`,
  cero checks que no sean `success`. Pasos leidos uno por uno: `lint`, `typecheck`,
  **«Migrar la rama Neon de CI» → success** (las tres migraciones `0032`/`0033`/`0034` aplicadas
  limpias en CI, incluida la que **dropea** `merchant_auth.password_reset_attempt`),
  `Unit + integracion Neon`, e2e, `build`, `format:check`.
  **`/status` NO sirve para esto y ya esta corregido en `CLAUDE.md`**: devolvio `success` con la CI
  todavia corriendo porque ahi solo publica Vercel (caso en `LECCIONES.md`).
- **Aquellos 3 archivos de documentacion YA se commitearon** en `b2fef3d`, pusheado (HEAD ==
  origin/main, verificado). **Lo que queda sin commitear hoy** son 4, todos documentacion: la spec
  0068, su fila en `docs/INDEX.md`, las filas 56 y 57 de `docs/PARQUEADO.md` y este
  `docs/TASKS.md` — **el owner no autorizo ese commit todavia**.
- **El arbol de codigo esta LIMPIO**: la sesion de la 0068 **no toco una sola linea de
  `apps/`**. La unica sonda que se corrio (`Object.keys(auth.api)` y los 4 endpoints core de
  password) vivio en un archivo temporal que **se borro**, verificado con `git status` vacio.
- **`rg -n MUTATION apps packages tools`: VACIO.** Las 6 mutaciones del presupuesto mas las 4 extra
  declaradas se corrieron de a una y se revirtieron con `diff` vacio contra copia limpia.
- **Las migraciones NO estan aplicadas en PRODUCCION**, solo en CI y en la rama de integracion
  (`br-shy-king-axu5s3ze`). Produccion se toca con el borrado de datos que el owner autorizo
  (seccion 2 del handoff), y ahi se **confirma el objetivo en el momento** antes de ejecutar.
- Gates de root con Node 24 (v24.20.0) sobre el arbol commiteado: `typecheck` 3/3 sin cache, `lint`
  exit 0, `test` **1017 passed / 344 skipped / 0 failed**, `format:check` OK, `build` 3/3 sin cache.
  Con el env de integracion: **182 archivos / 1349 passed / 0 failed**.
- **`drizzle-kit check` → `Everything's fine`; `generate` → `No schema changes`**: sin drift entre el
  esquema y los snapshots.
- La spec 0065 (campaña de proximidad) sigue **cerrada** — QA del owner en verde. La 0066
  (reparacion del harness), **implementada con PASS**. Deuda declarada en `docs/PARQUEADO.md`.

## ⇥ BITACORA DE MUTACIONES — SPEC 0069 (abierta 2026-09-17, ANTES de medir)

**Punto de retorno.** Copia limpia de cada archivo en `/tmp/clean-*.ts`. Si una mutacion queda
viva: `cp /tmp/clean-<x>.ts <archivo>` y verificar el `shasum` de abajo. **`qr/route.ts` es `??`
(sin commitear): `git checkout` NO lo salva, solo la copia de `/tmp`.**

| # | Archivo | `shasum` limpio | Invariante que ataca | Alcance de la medicion | Resultado EJECUTADO |
|---|---|---|---|---|---|
| 1 | `apps/merchant/src/app/api/onboarding/business/route.ts` | `95637e027dc54283f3feaa6a40980370bb01fb80` | la categoria del alta se valida contra la lista curada (`isBusinessCategory`) | `onboarding-business.neon.integration.test.ts` | **ROJO** — «una categoria fuera de la lista ("gcid:inventado") responde 400 y no escribe nada»: `AssertionError: expected 201 to be 400`. Verificado ademas por SQL: la corrida mutada dejo una fila `core.business` con `category_gcid = 'gcid:inventado'` (huerfana, borrada despues). 10 failed / 1 passed — las otras 9 son COLATERAL del «un negocio por owner» (409) y no se arreglaron |
| 2 | `apps/merchant/src/server/loyalty-program/client-view.ts` | `d23d6846c78b421e104f87b7dcc4bb8b4afe0161` | `stampImagePath` se emite SIEMPRE, con sello o sin el (si no, el placeholder es codigo muerto) | `loyalty-client-view.test.ts`, `loyalty-program.test.ts`, `loyalty-stamp-placeholder.neon` | **ROJO 5 tests / 18 passed**: «un programa SIN sello expone un path NO nulo» y «un sello REMOVIDO … usa su version» (`expected null to be '/api/public/loyalty/…'`), «el consumidor hereda el path del sello» (idem — o sea que la propagacion a `consumer/programs.ts` esta cubierta), `loyalty-program.test.ts > never serializes the internal stamp key` y el `.neon` «el programa SIN sello expone un stampImagePath no nulo» |
| 3 | `apps/merchant/src/server/loyalty-program/stamp.ts` | `37379485f888a7943003b390b0a964e5d9de5fd0` | una version que NO matchea es 404, nunca placeholder (un sello real no puede verse tapado por la letra) | `loyalty-stamp-placeholder.neon`, `loyalty-stamp.neon` | **ROJO 3 tests / 5 passed**: «con un sello puesto > una version VIEJA sigue siendo 404, NO el placeholder» (`expected { kind: 'placeholder', …(1) } to be null`), «sin sello, una version que no es la vigente ya es 404» (`expected 200 to be 404` — el status de la RUTA) y el `loyalty-stamp.neon` heredado |
| 4 | `apps/merchant/src/app/api/public/loyalty/[businessId]/[programId]/stamp/route.ts` | `c47740a9513fe2e628c86426efb204274aef1ea9` | la ruta publica NUNCA serializa `stampImageObjectKey` (ni en cuerpo ni en header) | `loyalty-stamp-route.test.ts` | **ROJO 1 test / 6 passed** — «NUNCA serializa la clave interna de R2: ni en el cuerpo ni en un header»: `expected 'cache-control: …' not to contain 'loyalty/biz-1/prog-1/8f3c2a'`, con el `+ x-stamp-object-key: loyalty/biz-1/prog-1/8f3c2a` en el diff. La fuga se escribio por un HEADER, que es el canal que un oraculo que solo mira el cuerpo no ve |
| 5 | `apps/merchant/src/app/api/loyalty-program/qr/route.ts` | `a645e440ef491dedcbb656805454ec7a6baabbea` | el `programId` sale de la SESION, nunca del query (aislamiento entre negocios) | `loyalty-qr.neon.integration.test.ts` | **ROJO 1 test / 6 passed** — «el programId del QUERY se ignora: A no alcanza el programa de B»: `Expected "…/enroll/f7a630fa-…" / Received "…/enroll/8ef1d3eb-…"`, o sea el QR del negocio B. El oraculo DECODIFICA el QR (sharp + jsqr), no mira «vino un SVG» |


**Las 5 se corrieron de a una, se revirtieron con `cp` desde la copia limpia de `/tmp` y el `diff`
contra esa copia dio VACIO; el `shasum` posterior coincide con el de la tabla en los 5 casos.**
`rg -n MUTATION apps tools` → **vacio** (exit 1).

**Condicion de corte (ADR 0062): NO se aplico** — ninguna vuelta termino en «el fix abrio la
siguiente». Las 5 salieron rojas a la primera y por la asercion correcta.
### Nota sobre los `shasum` de la tabla de arriba

Los `shasum` de la bitacora son el **punto de retorno DURANTE la ronda de mutaciones** y siguen
siendo validos como tales (las 5 se revirtieron y el `shasum` posterior coincidio en los 5 casos).
**Despues** de la ronda, tres archivos cambiaron por el gate de `lint`/`typecheck` —ninguno por
una mutacion— y su `shasum` actual es otro:

- `apps/merchant/src/server/loyalty-program/client-view.ts` → `68817d52870852f41f912a5813a25b0a1ad46faf`
  (`void stampImageObjectKey;` para el `no-unused-vars`, idiom de `wallet/push-transports.ts:46`)
- `apps/merchant/src/server/onboarding/program-defaults.test.ts` → `fb8d67e23c27c9a89a1912c85c334800d46d5e6c`
- `apps/merchant/src/server/loyalty-qr.neon.integration.test.ts` → `03d6aff8e46d6608aeb2804f1efb288fd58b0b89`

## ⇥ ESTADO DE LA SPEC 0069 (implementador, 2026-09-17) — FALTA LA REVISION INDEPENDIENTE

**La spec 0069 esta IMPLEMENTADA por el implementador y NO marcada como `implementada`: eso lo
decide un revisor independiente con un `PASS` verificable (ADR 0071 §3).** El `estado` de su fila
en `docs/INDEX.md` sigue en `cerrada` a proposito.

**Entregado** (18 archivos de `apps/` + 1 doc nuevo; **cero `.tsx`**, barrido con
`git status --short | grep -c '\.tsx'` → **0**):

- Migracion **`0035_categoria_del_negocio.sql`** (generada con `drizzle-kit generate`, con su
  snapshot y su fila de journal) + `category_gcid` en `schema/business.ts`.
  **Aplicada a la rama de INTEGRACION** (`br-shy-king-axu5s3ze`) con `db:migrate` y verificada por
  SQL (`information_schema.columns` → `text`, `NOT NULL`, default `'gcid:store'::text`).
  **NO aplicada a produccion**: eso es paso del orquestador DESPUES del PASS.
- `lib/business-categories.ts` (las 15 `gcid:` + `isBusinessCategory`), Mexico en
  `SUPPORTED_COUNTRIES` (9 paises, **una** lista), `GET /api/onboarding/prefill`,
  `POST /api/onboarding/program` + `server/onboarding/program-defaults.ts`,
  `server/loyalty-program/stamp-placeholder.ts`, el path del sello **siempre** en `client-view.ts`,
  `stampForPublicProgram` distinguiendo los dos `null`, la ruta publica sirviendo el placeholder, y
  `GET /api/loyalty-program/qr` (SVG/PNG 1024²/descarga) con `renderEnrollQrPng`.
- **`docs/specs/0069-contratos-de-api.md`** — el contrato HTTP normativo, 5 endpoints con todos sus
  `code`, mas la declaracion de estado actual de las 4 rutas de `/api/loyalty-program` sin `code`.

**Split obligado por el hook `file-size`:** `schema/business.ts` llegaba a **308** lineas al sumarle
la columna, asi que `subscription` y `stripe_webhook_event` se mudaron a
**`schema/billing.ts`** (nuevo) y el barrel `server/schema.ts` lo reexporta. Mismo motivo por el que
`staff-pin.ts` ya vivia aparte. Verificado sin drift: `drizzle-kit check` → «Everything's fine» y
`drizzle-kit generate` → «No schema changes».

**Gates corridos una sola vez al final** (Node **v24.20.0**, scripts de root):
`typecheck --force` **3/3 sin cache** · `lint` **exit 0** · `format:check` **OK** ·
`test` **122 files / 1088 passed / 390 skipped / 0 failed** · `test` **con el env de integracion**
**199 files / 1478 passed / 0 failed** · `build --force` **3/3 sin cache** (las 3 rutas nuevas
aparecen en el manifiesto) · `rg -n MUTATION apps tools` **vacio**.

**Dos tests preexistentes se CORRIGIERON contra el contrato nuevo (no se borraron), y hay que
mirarlo en la revision:** `loyalty-program.test.ts` («never serializes the internal stamp key»)
aseveraba `stampImagePath: null` sin sello, y `loyalty-stamp.neon.integration.test.ts` aseveraba
`stampForPublicProgram(...) === null` sin sello. Las dos pinneaban **justo lo que la §D5 cambia**.


## ⇥ ENTREGA DEL IMPLEMENTADOR — spec 0078 (2026-09-18)

**Estado: implementado, SIN commitear y SIN marcar la spec.** Falta el PASS del revisor
independiente (ADR 0071). Arbol limpio de mutaciones (`no-mutations-left.sh` sale **0**).

**Gates, los cinco, con `set -a; . ./.env.integration.local; set +a`:** `typecheck` (3/3) ·
`lint` (exit 0) · `format:check` («All matched files use Prettier code style!») · `build`
(3/3) · `test` → **219 archivos / 1715 tests, 0 failed, 0 skipped** (exit 0, corrida final
tras cerrar los dos hallazgos de TEST del revisor; la corrida previa a esos dos archivos fue
218 / 1712).
`pnpm test:e2e` **NO aplica y no se corrio**: `git status --porcelain | grep -c '\.tsx$'` → **0**.

**La migracion `0038_terms_por_pais.sql` YA ESTA APLICADA a la rama de integracion** (no a
prod), con su `meta/0038_snapshot.json` (copia del `0037` con `prevId` encadenado, igual que
la `0011`, que tambien es de solo datos) y su fila de journal en `idx: 38`. Verificado:
`drizzle-kit check` → «Everything's fine», `drizzle-kit generate` → «No schema changes», y por
SQL: 4 filas nuevas (`default`×2, `EC`×2), todas `published`/`es`, las cuatro con
`["business_legal_name","program_name","program_unit_plural","country_code"]`; `global-draft`
intacto (2 `published` + 1 `archived`).

**CUATRO desvios de la tabla «Archivos» de la spec. El revisor tiene que mirarlos:**

1. **`app/api/onboarding/program/route.ts` (1 linea).** Es el CABLEADO que la spec no listo:
   `wizardClauseTemplateIds` necesita el pais, y la cadena es ruta → `wizardProgramInput` →
   `wizardClauseTemplateIds`. `wizardProgramInput(body, session.user.id)` resuelve el pais con
   el mismo `ownerBusiness` que usa `saveProgram`, o sea **de la sesion**; sin tocar la ruta el
   pais no llega. Cero `.tsx`.
2. **Los casos de integracion van en DOS archivos nuevos, no dentro de
   `onboarding-program.neon.integration.test.ts`** (la spec ya lo contemplaba como opcion):
   ese archivo esta en 285 lineas y el hook corta en 300. Quedaron
   `onboarding-program-terms.neon.integration.test.ts` (219) y
   `loyalty-terms-render.neon.integration.test.ts` (119).
2b. **Dos archivos mas, de la ronda del revisor (PASS con 3 hallazgos):**
   `onboarding-program-503.test.ts` (nuevo, unitario con dobles) cierra la mitad de contrato
   del 503; y el caso **MX con `countryCode` en el CUERPO** entro en
   `onboarding-program-terms.neon…` (que quedo en **289** lineas: el proximo caso obliga a
   partirlo). El tercer hallazgo del revisor —`renderedTerms` acepta cualquier `templateId`
   `published` sin validar scope, y `GET /api/loyalty-terms/templates` no devuelve
   `jurisdictionScope`— **NO se toco: es decision de producto y va al owner**.
3. **`onboarding/program-defaults.test.ts` (no listado): aserciones actualizadas**, no
   borradas — `composeWizardProgramInput` ahora compone `unitPlural`, que es §4 de la spec — y
   3 casos nuevos sobre `resolveWizardClauseIds` (incluido el **503**).
4. **`onboarding-program-bypass.neon.integration.test.ts` (no listado): 4 aserciones
   actualizadas** por lo mismo. Comparan la `configuration` ENTERA contra
   `{ unitName, target }` y el wizard ahora escribe tambien `unitPlural`. **Rojo detectado por
   la suite completa, no predicho**; la intencion del test (que la fila NO se reescriba) queda
   igual. Ningun test se borro ni se debilito.

**El LIMITE del 503, CORREGIDO (hallazgo 2 del revisor) y ya reducido a su nucleo real.** La
primera version de este limite culpaba al paralelismo de vitest; el motivo de fondo es **mas
fuerte y estructural**: `termsScopeCandidates` **siempre** appendea `"default"` al final
(`loyalty-program/terms-scope.ts:26-28`), asi que mientras `default` este sembrado **ningun
pais puede producir el 503** — es inalcanzable **por construccion**, no por concurrencia. (Lo
del estado compartido sigue siendo cierto y es el motivo extra por el que archivar `default`
en un test tampoco es una opcion: vitest corre con forks, sin `fileParallelism: false`.)

**La mitad de CONTRATO si se cerro**, y es barata: `onboarding-program-503.test.ts` (nuevo, 2
casos, **5 ms**) mockea `./auth` y `./onboarding/program-defaults` con `vi.mock` —patron que ya
existia en `marketing-routes.test.ts`, con `LoyaltyError` REAL para que el `instanceof` de la
ruta siga valiendo— y pinnea **503 + `program_unavailable` + `saveProgram` NO llamado**, con un
control positivo que prueba que el espia no esta verde de gratis. Mordido por M6.

**Lo unico que queda declarado afuera: «una base real sin semillas».** Eso si exige una base
dedicada.

**Hallazgo a decidir (NO lo decidio el owner, NO se toco):** `GET /api/loyalty-terms/templates`
devuelve **todas** las plantillas `published` sin filtrar por scope (`route.ts:26-27`), asi que
desde la `0038` lista **6** filas con titulos repetidos («Cómo se acumula» ×3). Si la pantalla
«avanzada» del panel usa esa lista, va a ofrecer tres copias de cada plantilla. Esta escrito en
`docs/specs/0078-contratos-de-api.md` §4 como hallazgo abierto.

**Flake AJENO reproducido y NO arreglado** (pedido del encargo):
`consumer-recovery.neon.integration.test.ts` → «enforces 3/hour persistently…»,
`expected 'accepted' to be 'failed'`. **Mecanismo identificado, y NO es el `phone_e164`
UNIQUE:** `phones[4]` se usa en DOS tests del archivo (linea 269, entrega aceptada; linea 350,
entrega fallida), y la asercion lee `select … .where(phone)` **SIN `ORDER BY`** y toma
`.at(-1)` (lineas 363-367). Cual de las dos filas viene ultima es indefinido en Postgres.
Demostrado: **misma corrida a corrida, mismo arbol** → pasa, pasa, **falla**. La corrida final
de la suite lo tuvo verde.

## ⇥ BITACORA DE MUTACIONES — spec 0078 (implementador, 2026-09-18)

**Abierta ANTES de medir; las 4 medidas y revertidas** (`diff` contra `/tmp/limpios-0078/` vacio y `shasum` confirmado en las 4). Presupuesto: 4 mutaciones; clase de error a cazar: **que el TOS
salga de un scope que no corresponde, o que salga incompleto/mezclado**.

Restauracion de emergencia (los 3 archivos tienen copia limpia en `/tmp/limpios-0078/`; los
`??` **no** se recuperan con `git checkout`):

```
cp /tmp/limpios-0078/terms-scope.ts apps/merchant/src/server/loyalty-program/terms-scope.ts
cp /tmp/limpios-0078/terms.ts       apps/merchant/src/server/loyalty-program/terms.ts
cp /tmp/limpios-0078/0038_terms_por_pais.sql apps/merchant/drizzle/0038_terms_por_pais.sql
```

| id | archivo | shasum limpio | git status | invariante que ataca | resultado EJECUTADO |
|---|---|---|---|---|---|
| M1 | `loyalty-program/terms-scope.ts` | `ae3610c1ceaf4c88654986067ddc0654e6b96b70` | `??` | el scope sale del PAIS del negocio | **7 rojos / 61 tests**. El que importa: `onboarding-program-terms.neon` «un negocio EC resuelve los templates de EC» → `expected ["0078ec00-…001","0078ec00-…002"] received ["0078a1b2-…001","0078a1b2-…002"]` (por **id**, no por texto). Tambien los 4 casos ISO-2 de `terms-scope.test.ts` y el caso de ruta |
| M2 | `loyalty-program/terms-scope.ts` | `ae3610c1ceaf4c88654986067ddc0654e6b96b70` | `??` | la caida es por SCOPE COMPLETO, no por clave (no se mezcla) | **3 rojos / 61 tests**, los tres de no-mezcla y con la mezcla LITERAL en el recibido: `terms-scope.test.ts` y `program-defaults.test.ts` → `['ec-1','def-2']`; `onboarding-program-terms.neon` → `["0078cc00-…001","0078a1b2-…002"]` |
| M3 | `loyalty-program/terms.ts` | `a6e5ab76c3e690bb3c1fd289a6a91a0d9ed40bba` | ` M` | `program_unit_plural` usa el plural cuando lo hay («Los sellos») | **1 rojo / 72 tests** (7 archivos, incluidos `loyalty-program.test.ts` y `loyalty-program.neon`): `onboarding-program-terms.neon` → `expected 'Los sello se acumulan…' to contain 'Los sellos se acumulan'` — el defecto del ADR 0076 §7 reproducido. El caso de `global-draft` queda VERDE, que es lo correcto: ese scope usa `{{program_name}}` |
| M4 | `drizzle/0038_terms_por_pais.sql` + la fila en Neon | `47e87ee8ccb45dd487e3dcce08f5c5e14734260e` | `??` | `country_code` esta en el allowlist de las 4 semillas | **5 rojos / 21 tests** en 2 archivos: el allowlist (`ArrayContaining` sin `country_code`) y, sobre todo, **`expected 422 to be 201`** en la ruta del wizard en `onboarding-program-terms.neon` **y** en `onboarding-program.neon` — o sea que sin el allowlist el TOS por pais no se puede ni escribir |

| M5 | `onboarding/program-defaults.ts` | `d82498be6e581050ab8795645208c0d52708eebc` | ` M` | el pais NO puede venir del cuerpo (reproduce la MR4 del revisor) | **1 rojo / 61 tests** (5 archivos): `onboarding-program-terms.neon` «el `countryCode` del CUERPO no mueve el scope» → `expected templateId "0078a1b2-…001/002" received "0078ec00-…001/002"`. Antes de este caso, la MISMA mutacion dejaba los 65 tests en verde |
| M6 | `app/api/onboarding/program/route.ts` | `38cdc81a94aea0fee82dab01011fd08f7a41c51d` | ` M` | el 503 corta ANTES de `saveProgram` | **1 rojo / 25 tests** (4 archivos): `onboarding-program-503.test.ts` → `expected "vi.fn()" to not be called at all, but actually been called 1 times`, con el input basura `{kind:"stamps"}` llegando al writer. **Hallazgo de la medicion:** bajo esta mutacion el `catch` generico devuelve **el mismo 503 con el mismo `code`**, asi que `status` y `code` NO distinguen el caso — el oraculo que hace el trabajo es el espia. Se reordeno la asercion para que sea la primera (con el motivo escrito en el test) y se re-midio |

Copias limpias de las dos en `/tmp/limpios-0078/` (`program-defaults.ts`, `route.ts`).

**M4 toca ademas ESTADO DE LA BASE** (la migracion ya esta aplicada, y su `ON CONFLICT DO
NOTHING` no reescribiria la fila). Restauracion de ese estado, verificada por `SELECT`:

```sql
UPDATE core.terms_template
SET variables_allowlist = '["business_legal_name", "program_name", "program_unit_plural", "country_code"]'::jsonb
WHERE jurisdiction_scope IN ('default', 'EC');
```
