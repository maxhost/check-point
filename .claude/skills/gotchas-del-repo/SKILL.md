---
name: gotchas-del-repo
description: >
  Gotchas medidos de este repo, por dominio: drizzle/SQL crudo (subconsultas correlacionadas,
  valores del driver, `count(*)` bigint, `on conflict` contra unicos parciales), webhooks y SDK
  de Stripe, Neon (migraciones a prod, ramas efimeras), Vercel (limites de cron del plan Hobby,
  diagnostico de deploy), pnpm bajo sandbox y store offline, worktrees, Node 24 y los gates,
  zsh sin comillas, better-auth, wallet/push, formatos de imagen, middleware de Next, Geoapify.
  Leer ANTES de escribir SQL crudo, tocar billing/Stripe, migrar a prod, agregar un cron, un
  plugin de auth, una superficie de subida de imagenes, o al diagnosticar un gate/instal roto.
---

# Gotchas del repo

Todo lo de aca esta **medido**, no supuesto: cada bloque dice como se verifico. Salio de
`CLAUDE.md` (spec 0066, ADR 0069) para que no cueste tokens en las sesiones que no tocan ese
dominio. El registro historico de `mistake→rule` vive en `docs/LECCIONES.md`.

## Gotchas

- **El shell del agente es ZSH, y zsh NO separa en palabras una variable sin comillas.** `FILES="a b c";
  prettier --write $FILES` le pasa UN argumento con espacios: prettier contesta «No files matching the pattern» y
  un `for f in $FILES` itera UNA vez sobre la cadena entera. Paso en el delta de la D2: prettier «corrio» sin tocar
  nada y el bucle de tamaños al hook midio una entrada inexistente como `EXIT=0` — o sea un gate que dice «paso»
  sin haber mirado. Usar arrays (`FILES=(a b c); cmd "${FILES[@]}"`) o `${=FILES}`; y leer la salida de prettier,
  que lista cada archivo que formateo.
- **`jsdom` NO es la unica forma de tener `querySelectorAll`: `node-html-parser` viene BUNDLEADO en `next`**
  (con motor CSS). Render real con `renderToStaticMarkup` + `parse()` + invocar el handler real del elemento pinnea
  una trampa de foco en **45 lineas, 12 ms, cero paquetes** — verificado en el delta de la spec 0063, donde el
  ORQUESTADOR habia declarado el limite «exige DOM real» y era falso (mutar el selector da rojo). Antes de escribir
  «no hay DOM», mira que bundlea Next.
- **UN `import` DE VALOR AL BARREL `./billing` DENTRO DE UN SUPPORT DE TEST CUELGA LA SUITE PARA SIEMPRE.**
  `billing-integration-support.ts` lo importa la factory de `vi.mock("./stripe-config")`; el barrel arrastra el
  dominio entero **de vuelta a `stripe-config`**, cuya factory todavia no termino → ciclo. Los dos
  `billing-pages*.neon.integration.test.ts` **colgaban sin emitir una linea** (ni `vitest list` terminaba, **0% de
  CPU** — asi se ve un deadlock, no una corrida lenta). Se importa del **modulo concreto** (`./billing/store`): de
  infinito a **1.06 s**. **Un `import type` al barrel es gratis —se borra en compilacion—; uno de VALOR no.** Es el
  mismo deadlock que ya documentaba `billing-pages.neon.integration.test.ts`, reintroducido por otra puerta.
  **Y el metodo para diagnosticarlo, que es lo reutilizable:** ante «todo cuelga», (a) corré un test suelto y
  AJENO —si anda en ms, vitest esta sano y el problema es de ESOS archivos—; (b) si cuelgan **dos** hermanos,
  mira la cadena COMUN y no el archivo nuevo, que es el sospechoso obvio y era inocente; (c) matar procesos
  zombis **no** lo arreglo, y ese negativo fue el dato que descarto «contencion de maquina».

- **`ON CONFLICT` CONTRA UN INDICE UNICO *PARCIAL* EXIGE REPETIR EL `WHERE` DEL INDICE.**
  `on conflict (a, b) do nothing` **pelado** no matchea un `create unique index … on t (a, b) where
  status in ('queued','active')`: falla con `there is no unique or exclusion constraint matching the
  ON CONFLICT specification`. No es un no-op silencioso — es un error **en tiempo de ejecucion**, o
  sea que un encolado idempotente escrito asi revienta en su **primera** corrida. Se arregla
  repitiendo el predicado en el conflict target:
  `on conflict (a, b) where status in ('queued','active') do nothing`. Verificado contra PG 18 real
  al revisar la spec 0065 (los dos casos, el que falla y el que anda). El patron «unico parcial sobre
  filas vivas + `on conflict do nothing`» es el idiom de este repo para colas y turnos, asi que el
  error es facil de reintroducir.
  **Y el hermano del mismo dia: NO PONGAS UN UNICO PARCIAL SOBRE UN `status` QUE EL WORKER VUELVE A
  ESCRIBIR.** `wallet_push_queue` devuelve una fila fallida a `'pending'` en el **mismo** `UPDATE`
  que incrementa `attempts` (`wallet/push.ts:199-203`). Con un unico parcial sobre
  `status = 'pending'`, si mientras esa fila estaba en `sending` entro otra para el mismo consumidor,
  la vuelta viola el unico → **el `UPDATE` entero falla** → `attempts` **no sube** (reproducido:
  queda en 0, `last_error` null) → la fila se queda clavada en `'sending'` y `claimRow`
  (`push.ts:118-126`) la re-reclama para siempre, comiendose el cupo de cada corrida. El error ademas
  cae en un `swallow`. Coalescer con `insert … select … where not exists (… status in
  ('pending','sending'))`, no con un indice.

- **DRIZZLE RENDERIZA LA COLUMNA *SIN CALIFICAR* EN UN SELECT DE UNA SOLA TABLA, asi que una subconsulta
  correlacionada escrita con `${tabla.columna}` se ata EN SILENCIO a la columna homonima de la tabla
  INTERNA y deja de correlacionar.** En A5 de la spec 0065,
  `exists (select 1 from consumer.wallet_pass wp where wp.consumer_id = ${programMemberships.consumerId})`
  compilo a `wp.consumer_id = "consumer_id"` —verificado con `.toSQL()`, no deducido— que Postgres resuelve
  contra `wallet_pass`: el `exists` paso a significar «¿hay algun pase en toda la base?» y **todos los
  consumidores daban `hasPass = true`**, con typecheck verde y filas de aspecto plausible. Lo cazo un seed
  con un consumidor **sin** pase. Con `join`s drizzle SI califica, asi que el bug aparece y desaparece segun
  la forma del query: **toda subconsulta correlacionada va en SQL crudo con alias explicito** (`m.consumer_id`).
  Y si dudas de que emite una consulta, `.toSQL()` te lo dice sin tocar la base.
- **`db.execute(sql…)` DEVUELVE LOS VALORES CRUDOS DEL DRIVER; el query builder los MAPEA.** Un
  `timestamptz` llega como **string** desde `execute` y como `Date` desde un `select` del builder — y el
  generico de `execute<T>` es una **asercion**, no un chequeo, asi que `enrolledAt: Date` pasa typecheck y
  revienta despues con `enrolledAt.getTime is not a function` (o peor: compara como string). Booleanos e
  `integer` no necesitan conversion (medido con una sonda: el driver ya devuelve `true`/`false` y numeros).
  En marketing eso vive en `marketing/driver-values.ts`; si lees fechas con SQL crudo en otro modulo,
  conviertelas ahi mismo.
  **Y el que rompe la lectura facil de la linea de arriba: `count(*)` NO es uno de esos `integer`
  seguros — es `bigint`, y el driver lo devuelve como la STRING `"7"`.** Medido con una sonda contra
  la rama efimera al implementar la B2 (`select count(*) as bare, count(*)::int as casted`: `bare` es
  `"7"` typeof string, `casted` es `7` typeof number). Como el generico de `db.execute<T>` es una
  **asercion y no un chequeo**, esa string entra a un campo `number` con typecheck en VERDE, y de ahi
  `"7" + 1` es `"71"` y una comparacion contra un umbral se decide por orden lexicografico. En SQL
  crudo va **siempre** `count(...)::int`; con el query builder, `.mapWith(Number)`. Y si un conteo no
  llega a una asercion exacta en los tests, aseverá el `typeof`: `toEqual` lo caza, `toBeGreaterThan`
  y la aritmetica no.
- **El apex `checkpass.club` hace 308 a `www.checkpass.club`, y los workflows de cron asertan
  `test "$code" = "200"` con un `curl` SIN `-L`.** O sea que un `*_ENDPOINT` cargado con el apex deja el
  workflow **rojo para siempre** y el worker sin correr, con pinta de secreto mal puesto. Medido:
  `https://checkpass.club/api/internal/wallet-push` → **308** + `location: https://www.…`;
  `https://www.checkpass.club/...` → **401** (la ruta contesta). **Todo endpoint interno que se configure
  como secret va con `www.`**

- **Gates: Node 24 + scripts de ROOT.** El shell del AGENTE arranca en Node 22 —es el Node del
  harness de Claude Code, que se antepone en el `PATH`, **no la terminal del owner**— y el repo
  pide 24: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use` antes de cualquier gate.
  **Desde 2026-09-09 `nvm use` va SIN argumento**: hay un `.nvmrc` en la raiz (nvm **no** lee
  `.node-version`). Los dos pines los mantiene sincronizados `tools/node-version-pins.test.ts`.
  **Al diagnosticar "que Node corre", ojo con confundir tres shells distintos:** la del agente
  (22, del harness), `zsh -l -c` (26.7.0 de Homebrew — `-c` **no** sourcea `.zshrc`, asi que nvm
  nunca carga) y la terminal interactiva real del owner (la que importa). Para ver la de verdad:
  `env -i HOME="$HOME" TERM=xterm /bin/zsh -i -c 'node -v'`. **La version sale de `.node-version`
  — desde la spec 0049 es 24.20.0, no 24.19.0**; con la vieja los gates pasan igual pero pnpm
  tira `WARN Unsupported engine: wanted {"node":">=24.20.0 <25"}` en cada corrida (paso al
  implementar la 0056: esta linea habia quedado vieja). **Ese drift estuvo vivo en esta maquina
  hasta el 2026-09-09** (`nvm alias default` = 24.19.0) **y el guard de pines NO lo cazaba: solo
  comparaba el MAJOR**, asi que 24.19.0 pasaba 5/5 mientras violaba `engines.node` — verificado
  corriendo el guard viejo bajo 24.19.0. Ahora compara la version completa contra el piso.
  `lint`, `test`, `format:check`, `build` son scripts de
  **root** (`pnpm run <script>`), NO del paquete — `pnpm --filter @mi-pasaporte/merchant lint`
  tira `None of the selected packages has a "lint" script`. El paquete merchant solo define
  `typecheck` (y `db:migrate`); para unit de un archivo suelto: `pnpm --filter
  @mi-pasaporte/merchant exec vitest run <path>`. El Stop hook (`.claude/hooks/verify.sh`) corre
  typecheck+lint+test de root (no prettier ni build).

- **`pnpm install`/`pnpm add` bajo codex + Auto fallan por DNS, aunque `git commit` ande
  (analogo al fix de GlaDOS ADR-0046/spec 0035, pero para paquetes en vez de `.git`).**
  Dos bloqueos independientes, apilados, NINGUNO es bug — son el sandbox
  `workspace-write` de codex haciendo lo que promete: (1) **red bloqueada por default**
  (el `approvalPolicy`/autoApprove NO da red — es otra dimension; GlaDOS ademas nunca
  concede la enmienda de red, ni en manual: MCP-only por diseño); (2) **el store global
  de pnpm** (`~/Library/pnpm/store`) **queda fuera del workdir writable** — mismo
  mecanismo que `.git/` fuera de `writable_roots`. Bajo Auto, codex no puede distinguir
  "sandbox lo bloqueo" de "internet caido": reporta el sintoma (DNS) y pide correrlo a
  mano en una terminal real.
  - **Fix: store de pnpm DENTRO del repo, pre-cargado.** `.pnpm-store` gitignored +
    `storeDir: .pnpm-store` en `pnpm-workspace.yaml`. **OJO: pnpm 11 lee `storeDir` de
    `pnpm-workspace.yaml`, NO de `.npmrc`** (`store-dir` en `.npmrc` se ignora en
    silencio — `pnpm config get store-dir` sigue devolviendo el global aunque el
    `.npmrc` este ahi; solo `pnpm-workspace.yaml` lo aplica, verificado con `pnpm store
    path`). Con el store adentro del workdir, `pnpm install --offline` no necesita red
    NI escritura fuera del sandbox — verificado end-to-end: `node_modules` borrado y
    reconstruido 100% offline (268 paquetes, `downloaded 0`) + `pnpm run typecheck`
    real, 3/3 paquetes verdes.
  - **Operatoria hacia adelante: el re-warm hace falta MENOS de lo que decia esta linea.**
    Si la dependencia se agrega **en una sesion CON red** (`pnpm add`), el propio install ya
    escribe en el store local y no hace falta nada mas — verificado en la spec 0040:
    `.pnpm-store/v11/index.db` ya contenia `react-easy-crop@6.2.3` + `normalize-wheel@1.0.1`
    recien agregados. Chequeo barato antes de tocar nada:
    `strings .pnpm-store/v11/index.db | grep '<paquete>@<version>'`.
    **`pnpm fetch` es solo para cuando el lockfile cambio en OTRO entorno** (pull con deps
    nuevas que nunca se instalaron aca): ahi si el store queda desactualizado y el offline
    install falla con "paquete no encontrado" (no DNS). **Correrlo de mas no es gratis: PURGA
    `node_modules`** (ver la linea de abajo) y te deja arreglando el `Already up to date` con
    la raiz vacia a cambio de nada.
  - **`pnpm fetch` purga `node_modules` sin preguntar salvo `CI=true`** (falla con
    `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` sin TTY, p.ej. corrido por un agente).
  - **Despues de `pnpm fetch`, `pnpm install --offline` MIENTE: dice `Already up to date`
    y deja el `node_modules` de la RAIZ vacio** (sin symlinks ni `.bin`), asi que
    `pnpm run typecheck`/`build` fallan con **`sh: turbo: command not found`** — parece
    que se rompio turbo y en realidad falta el link. `--force` tampoco alcanza: el
    chequeo de estado de pnpm lo da por hecho. **Fix verificado:** borrar los dos
    archivos de estado y reinstalar —
    `rm -f node_modules/.modules.yaml node_modules/.pnpm-workspace-state-v1.json && pnpm install --offline`
    (`node_modules/.pnpm` conserva los paquetes, asi que sigue siendo 100% offline; no
    hace falta red). Ojo: `rm -rf` esta en el deny de `.claude/settings.json`, usar `rm -f`
    sobre los archivos.

- **Worktrees en este monorepo: SI para leer y para vitest directo, NO para `pnpm run <script>`.**
  **NI `pnpm run` NI `pnpm exec` son seguros adentro de un worktree con `node_modules`
  symlinkeado al repo real**: los dos disparan `runDepsStatusCheck` → `pnpm install` → **intenta
  purgar ese `node_modules`**, que por el symlink son las dependencias posta. Pasó dos veces en la
  spec 0053: un implementador lo abortó a tiempo y un revisor se comió el
  `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` (que sin TTY es lo que te salva). Nadie perdió
  `node_modules`, pero el camino estaba armado las dos veces.
  **Para probar mutaciones, la opcion segura es hacerlo IN-PLACE en el repo real con backup y
  verificacion de hash** (`shasum` antes/despues), o invocar el binario directo sin pnpm
  (`node node_modules/vitest/vitest.mjs run <path>`). Los worktrees siguen siendo utiles para
  **leer** codigo viejo (`git show HEAD:<archivo>` alcanza casi siempre y es mas barato).

- **`git push` a `main` falla con "Invalid username or token" aunque `gh` este logueado.**
  Hay un `GH_TOKEN` **invalido** en el entorno que tapa las credenciales validas del keyring
  (`gh auth status` muestra `X Failed to log in ... using token (GH_TOKEN)` y ademas dos
  cuentas keyring OK: `maxhost` —dueña del repo— y `no-code-company-max`). El remoto es HTTPS
  y ya no acepta password. **Fix verificado (sin exponer el token):**
  `export GH_TOKEN=; gh auth switch --hostname github.com --user maxhost` y despues
  `GH_TOKEN= git -c credential.helper='!gh auth git-credential' push origin main`. Cada Bash
  es un shell nuevo, asi que el `GH_TOKEN=` inline va en el MISMO comando del push. No es bug
  del repo — es el entorno; no reintentar el push pelado.
- **Migracion a prod (Neon):** `DATABASE_URL_UNPOOLED='<conn de la rama default, host SIN
  -pooler>' pnpm --filter @mi-pasaporte/merchant db:migrate`. `drizzle-kit migrate` aplica
  solo las pendientes (lleva su propia tabla `drizzle.__drizzle_migrations`). Verificar
  siempre por MCP (`run_sql`) que el esquema quedo y que `core`/`merchant_auth` estan
  intactos ANTES de marcar la spec. Aplicar a prod = paso del orquestador DESPUES del PASS
  del revisor, nunca antes. `delete_branch` (MCP Neon) esta gateado como destructivo:
  pedir confirmacion del owner antes de borrar ramas efimeras. Alternativa sin gate: crear la
  rama efimera con `expiresAt` (ISO) para que Neon la borre sola.
- **Al BORRAR una ruta API (`app/api/.../route.ts`), `pnpm typecheck` puede fallar con
  `.next/types/validator.ts(...): Cannot find module '.../route.js'`** — es un tipo GENERADO
  que quedo viejo apuntando a la ruta borrada, no un error del codigo. Fix: `rm -f
  apps/merchant/.next/types/validator.ts` (o borrar `.next`); el proximo `next build`/`dev` lo
  regenera sin la ruta. No editar el archivo generado a mano.
- **Vercel plan Hobby: MAXIMO 2 cron jobs y SOLO frecuencia diaria.** Un 3er cron en
  `apps/merchant/vercel.json`, o un `schedule` sub-diario (`*/5 * * * *`), hace que Vercel
  **rechace el deploy entero** (Production queda clavado en el commit anterior, el commit status
  de GitHub muestra `Vercel: failure`). Los 2 crons existentes son diarios a propósito. Si una
  feature necesita un worker frecuente sin pagar Pro: dejar el endpoint autenticado por
  `CRON_SECRET` y dispararlo desde un **scheduler externo gratis** (GitHub Actions programado en
  `.github/workflows/`, o cron-job.org) — patrón ya usado por `wallet-push` (spec 0033). Al pasar a
  Pro se re-agrega el cron nativo. Diagnóstico del deploy sin acceso a Vercel: `gh api
  repos/maxhost/check-point/commits/<sha>/status`.
- **Agregar un plugin de better-auth AGREGA SUPERFICIE HTTP: el catch-all `app/api/auth/[...all]/route.ts`
  publica TODOS sus endpoints.** Envolver el plugin en una ruta propia con gate/rate-limit/permisos NO
  protege nada — queda una puerta con candado al lado de una pared abierta. Cazado por un revisor
  independiente en la spec 0046 y demostrado end-to-end: con `PASSWORD_RECOVERY_ENABLED` **apagado**,
  `/api/auth/email-otp/request-password-reset` devolvía 200 y entregaba el OTP; un **staff deshabilitado**
  cambiaba su contraseña; una ráfaga de 8 mandaba 8 emails contra un cap de 3/h, con 0 filas de auditoría.
  **Fix: `disabledPaths: [...]` en `betterAuth({...})`** con los paths HTTP del plugin — se aplica en el
  `onRequest` del router (→404, `dist/api/index.mjs`) y **NO** afecta las llamadas server-side `auth.api.*`,
  así que las rutas propias siguen funcionando. **Guard:** `server/merchant-auth-disabled-paths.test.ts`
  pinnea los 9 paths de `emailOTP` en 404 + `/sign-in/email` vivo; si sumás un plugin, sumá sus paths ahí.
  Al escribir el test, ojo con el falso verde: un path mal escrito también da 404 — verificá que sin el
  guard esos paths respondan algo distinto de 404.
- **Un server component de Next NO puede fijar el status HTTP.** Si una spec pide que una *página* responda
  503/404 (no solo su API), va por `src/middleware.ts` con `matcher` acotado. Ojo: el middleware corre en
  **edge runtime** — no importes cadenas que arrastren `node:crypto` (leé la env directo). Verificá que la
  env no quede inlineada en build-time inspeccionando el chunk edge compilado.
- **EL TOS: `renderTermsText` tira 422 CUANDO EL VALOR DE LA VARIABLE ES VACIO, no solo cuando la
  variable no esta en el allowlist.** La condicion es
  `!allowedVariables.includes(key) || !variables[key]`
  (`apps/merchant/src/server/loyalty-program/validation.ts:259-270`). **Consecuencia que sorprende:
  una plantilla con una variable que «a veces no aplica» IMPIDE GUARDAR EL PROGRAMA** — no deja un
  hueco en el texto, corta el `PUT` con 422. Asi que **una variable de TOS que no siempre tiene
  valor no se resuelve con un default vacio**: o la plantilla que la usa es una plantilla APARTE
  (elegida por el dato que decide, como `earning_per_amount` por el `accrual.mode`), o la variable
  no se emite y ninguna plantilla del wizard la nombra. **Y el allowlist esta EN LA FILA de la
  plantilla** (`variables_allowlist`, jsonb): agregar una variable al diccionario de `terms.ts` sin
  agregarla al allowlist de las semillas es un 422 garantizado, y eso exige una **migracion de
  datos**. Medido en la spec 0081; el caso de la 0078 es el mismo con `country_code`.
  **Y EL COROLARIO QUE SE COME UNA MUTACION ENTERA, medido en la 0081: una variable AUSENTE y una
  variable VACIA son INDISTINGUIBLES para `renderTermsText`** — `!variables[key]` es falsy para
  `undefined` y para `""`, asi que «no emitir la variable» **no protege nada** frente a
  «emitirla vacia»: las dos tiran el mismo 422. Lo unico que protege a un negocio sin ese dato
  es que **ninguna plantilla la nombre**, y eso se asevera sobre las FILAS de las semillas, no
  sobre el diccionario. Corolario de metodo: el unico oraculo que ve «se emite o no se emite»
  es uno que inspeccione el diccionario (`expect(vars).not.toHaveProperty(...)`), asi que la
  funcion que lo arma tiene que ser **pura y exportada** — desde el markdown resultante esa
  decision es invisible. La mutacion que la spec 0081 asignaba al 422 salio **VERDE**.
- **Formatos de imagen aceptados en subidas: viven en UN solo lugar,
  `apps/merchant/src/lib/image-formats.ts`** (jpeg/png/webp/**heic/heif/avif** — las fotos de
  cámara/galería de Android e iPhone son HEIC/HEIF, `sharp` las decodifica). Lo consumen los guards
  del cliente y los allow-lists del prep de marca/sello/catálogo. **No dupliques la lista** (un
  allow-list angosto por-feature ya causó que el sello rechazara fotos de Android — spec 0033 QA, y
  **de nuevo en marca/backoffice — spec 0039 QA**: la lista angosta estaba hardcodeada en 3 lugares
  (guard cliente, allow-list server, `accept` del input)). Mantener en sync con la lista de formatos
  de `sharp` en `server/assets/image.ts`. **Guard:** `server/upload-image-formats.test.ts` pinnea
  sello + catálogo + marca aceptando HEIC/HEIF/AVIF **y barre TODO `.tsx` bajo `app/` buscando
  listas MIME hardcodeadas** — si agregás una superficie de subida nueva, sumala a ese test.
  **OJO AL ESCRIBIR ESE TIPO DE BARRIDO (spec 0040): la primera version del regex solo matcheaba
  `accept={...}` y era CIEGA a `accept="..."`, asi que tapaba dos listas angostas mas en
  `demo/brand` y `demo/loyalty` — 4a y 5a aparicion del mismo bug, con el test en verde diciendo
  "no hay ninguna otra".** Un guard que solo ve una de las dos ortografias de JSX es peor que
  ninguno: da seguridad que no tiene. Al escribir un barrido estatico, (a) probá las dos formas,
  (b) aseverá un **piso de archivos escaneados** (`scanned > 50`) para que un barrido vacio no
  quede verde, (c) verificá que se pone rojo con el codigo viejo (`git show HEAD:<archivo>` a
  `/tmp`), no solo que pasa con el nuevo, y (d) **si la propiedad es de COMPORTAMIENTO, ningun
  barrido estatico la pinnea: extrae la decision a una funcion pura y testeala.** Un barrido sirve
  para propiedades que SON sintacticas ("ningun `.tsx` bajo `app/` hardcodea una lista MIME",
  "esta pagina no enlaza un manifest"). Para "en iOS Safari sin VAPID el instructivo se
  renderiza" **no alcanza ninguno**: la sintaxis es un proxy y todo proxy tiene preimagen. La
  tarea 38 lo pago con **tres guards rotos por tres revisores**, cada uno con los 5 gates verdes:
  `indexOf(A) < indexOf(B)` (evadido con una 2da ortografia del guard); `matchAll` +
  `toHaveLength(1)` (evadido de 5 formas: llaves, `Boolean(x) === false`, hoist a un `const`,
  comentario señuelo, y un refactor idiomatico); y un mini-parser "el primer `return` del cuerpo
  devuelve X" (evadido metiendo la clave **dentro de la condicion** —que ningun chequeo de orden
  ve— y gateando el componente **en el llamador**; ademas disparaba en 4 refactors legitimos).
  Lo que funciono fue `choosePushPromptView`: la decision como funcion pura, con una tabla de
  casos como oraculo. **Pero ojo con lo que compra extraer, porque no es lo que parece: convierte
  una propiedad de COMPORTAMIENTO ("el usuario ve X") en una de DECISION ("la decision dice X"),
  y deja el CABLEADO sin oraculo.** En la tarea 38 ese hueco resulto de una linea: un revisor
  reintrodujo el bug exacto con `setIsIos(ios && vapidPublicKey !== null)` en el efecto, con los
  5 gates verdes. Corolarios: **extraer no cierra la propiedad — nombra explicitamente que queda
  afuera**; **lo que quede sin cubrir se declara en el test**, no se tapa con un regex; y **si
  igual escribis un proxy, etiquetalo como proxy, decí cual de sus partes hace el trabajo y cual
  es decorativa**, y escribi vos 3 evasiones antes de darlo por bueno — las de la tarea 38 las
  encontraron los revisores, nunca el autor.
- **La forma del payload de un webhook de Stripe la fija la `api_version` del ENDPOINT, no el
  SDK.** `getStripeClient` no pinnea `apiVersion` (`server/stripe-config.ts`), asi que las
  llamadas **salientes** (`retrieve`, `update`, `list`) vienen en la version del SDK
  (`2026-07-29.dahlia` con `stripe@22.5.0`) y estan bien tipadas — pero el JSON **entrante** de
  `constructEvent` viene como lo serializo Stripe con la version del endpoint, y
  `constructEvent` **no lo transforma**. En este proyecto los eventos que llegaron tienen
  `payload_version = '2020-08-27'` (`select payload_version from core.stripe_webhook_event`),
  seis años atras: ahi `subscription.current_period_end` **existe** y
  `items.data[0].current_period_end` es **`undefined`**, con `typecheck` en VERDE porque los
  `.d.ts` describen dahlia. **Corolario operativo: del payload se leen solo `type`, `id` y
  `created`; todo lo demas se pide con un `retrieve`.** Y el corolario de metodo, que es el ADR
  0054 otra vez: **verificar el TIPO no es verificar el PAYLOAD** — un `.d.ts` es evidencia sobre
  la forma que el SDK espera, no sobre la que llega por la red.
- **Al endpoint del webhook llegan eventos que NO son `customer.subscription.*`** — en la base
  hay `invoice.paid` y `checkout.session.completed`. Cualquier codigo que asuma que
  `event.data.object.id` es un `sub_…` y lo pase a `subscriptions.retrieve` falla con
  `resource_missing`; y si el registro del evento ocurre **despues** de esa llamada, Stripe
  reintenta para siempre hasta desactivar el endpoint. Allow-list de tipos, y la fila del evento
  se reclama **antes** de cualquier llamada de red.

- **Geoapify autocomplete pega DIRECTO del navegador (`address-autofill-geoapify.tsx`) con la clave
  pública `NEXT_PUBLIC_GEOAPIFY_API_KEY`.** Con **Allowed Origins** seteadas en la clave, Geoapify
  devuelve un `Access-Control-Allow-Origin` **FIJO** (un solo origen, SIN `Vary: Origin`, sin *echo*
  del `Origin` del request): por CORS **sólo funciona UN dominio**; desde cualquier otro (`www.` vs
  apex vs `.vercel.app`) el browser bloquea con "ACAO ... not equal to the supplied origin". No es la
  config del owner ni caché — verificado por terminal: mismo ACAO para todo `Origin`,
  `cf-cache-status: DYNAMIC`. Diagnóstico: `curl -s -D - -H 'Origin: https://X' 'https://api.geoapify.com/v1/geocode/autocomplete?text=cuenca&apiKey=<KEY>' | grep -i access-control-allow-origin`.
  **Fix operativo (owner, sin código, ya aplicado): quitar TODAS las Allowed Origins de la clave
  pública → Geoapify responde `*` y anda desde cualquier dominio** (contra: clave usable desde
  cualquier sitio, mitigado por la cuota diaria). **Fix durable pendiente (spec, Opción B): proxear el
  autocomplete por el server del merchant con la clave server `GEOAPIFY_API_KEY` — el browser pega
  same-origin (cero CORS) y la clave nunca viaja al cliente.** Reordenar orígenes NO sirve: un ACAO
  fijo no cubre apex + www + vercel a la vez.
