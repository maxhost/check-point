# CLAUDE.md

> Instalado por GlaDOS (plantilla del arnes v1). Es tuyo: editalo con el uso —
> cada error observado del agente deberia volverse una linea aca o un hook (mistake→rule).

Directrices del proyecto. Se cargan siempre y cuestan tokens en cada request — aca va
solo lo que cambia una decision. Lo derivable del codigo no va: leelo del arbol.

- **`docs/INDEX.md`** — mapa de ADRs y specs. **Empeza aca**, no leas todo.
- **`docs/TASKS.md`** — estado actual. El punto de retorno si esta sesion se cae.
- `.claude/settings.json` — lo que esta enforced (hooks + permisos).

## Flujo de trabajo

1. **Leer `docs/TASKS.md` antes de empezar.** Es el estado real, no lo que diga el chat.
2. **Ninguna tarea toca codigo sin su spec cerrada** (`docs/specs/`, plantilla en
   `TEMPLATE.md`). La subespecificacion es el gatillo medido del exito fingido: en tareas
   resolubles y bien definidas el reward hacking cae a 0%; en tareas vagas, ~50%.
3. **Toda decision de diseño genera un ADR** (`docs/adr/`) con fecha y `resumen` de una
   linea en el frontmatter. El resumen es lo que se lee sin abrir el archivo.
4. **Agregar la fila a `docs/INDEX.md` en el mismo commit.** Un indice viejo es peor que
   ninguno.
5. **Actualizar `docs/TASKS.md` al terminar.** Hay un hook `Stop` que lo exige si quedo
   viejo respecto del codigo tocado.
6. **Marcar `hecho` solo con verificacion real** — test que pasa, comando corrido, cosa
   vista en pantalla. Nunca "deberia andar".
7. **Implementar con el protocolo de `docs/AGENT-WORKFLOW.md`.** Una spec cerrada se
   entrega a implementador y después a revisor independiente; solo un PASS verificable
   permite marcarla como implementada.

## Estado

**Lo que tiene que sobrevivir va a un archivo, no a la conversacion.** La compactacion
borra lo que vive solo en el chat; el disco se re-lee. Un plan que es un mensaje no es
un plan.

**Handoff SIEMPRE seguido de `/clear`.** El handoff baja el estado a disco pero NO libera
la ventana de contexto. Orden sagrado: handoff PRIMERO (a disco), clear DESPUES. Nunca
compact: comprime con perdida.

## Verificacion

**Ninguna afirmacion de exito vale sin una señal que el modelo no genero** — tests,
typecheck, exit code. La auto-revision sin oraculo es negativa neta.

**Mistake→rule:** cada error observado del agente se convierte en un fix estructural
permanente — un hook si se chequea con un comando, una linea aca si es advisory. Nunca
la misma correccion dos veces a mano.

**Antes de pedirle QA al owner, verificar que prod tenga EL COMMIT que se va a probar** —
no que "prod este verde". `GH_TOKEN= gh api repos/maxhost/check-point/commits/<sha>/status
--jq '.state'` tiene que decir `success` para el sha exacto. Paso de verdad (spec 0040): se
commiteo sin pushear y el owner probo el build anterior; dos items del QA fueron invalidos y
el diagnostico arranco persiguiendo un bug que no existia.

**Lo que el owner no dijo explicitamente NO se escribe como decision suya.** Si al
implementar aparece un efecto lateral que nadie acordo (orden de statements, un caso borde),
va como *hallazgo a decidir*, nunca como "aceptado, declarado en el handoff". Paso en la spec
0053: se dedujo del orden del codigo que el 409 actualizaba el nombre y despues rechazaba, se
escribio en la spec y el ADR como acordado, y el owner lo rechazo **dos veces** — la segunda
obligo a revertir la spec entera (ADR 0050 supersedido por el 0051). Una spec que inventa un
acuerdo es peor que una spec incompleta: la incompleta se pregunta, la inventada se implementa.

**Un residual heredado puede estar YA SALDADO por una spec posterior — verificalo antes de trabajarlo, y aplica
la misma sospecha a TODOS los items de esa nota.** Los hallazgos de un revisor quedan escritos con la foto del
dia; las specs siguen. Paso en la tarea 38: el item (2) ya lo habia resuelto la spec 0051 (se detecto y se
verifico por mutacion), pero **la premisa del item (1) estaba viciada por la misma spec y eso no se chequeo** —
se implemento el fix correcto con un "por que" falso, escrito en la tarea y en un comentario del codigo. Lo cazo
el revisor independiente. Si un item de una nota vieja resulto obsoleto, sus hermanos son sospechosos.

**Un comentario que afirma "atomico e idempotente por EvalPlanQual" no es una prueba —
demostralo con `EXPLAIN` + una carrera real que asevere el saldo por SQL.** `orders.ts`
(spec 0030) documentaba que un `NOT EXISTS` sin correlacionar, dentro de un CTE junto al
`UPDATE`, se re-evaluaba bajo concurrencia (EvalPlanQual) y por eso el otorgamiento nunca
duplicaba. **Es falso, y estaba en produccion:** Postgres lo planea como `InitPlan` +
`One-Time Filter` — se evalua UNA vez, ANTES del lock. Verificado al disenar la spec 0055
(canje): dos requests concurrentes con el MISMO `client_request_id` acreditaron el saldo
DOS veces, con una sola fila de auditoria que reportaba el saldo intermedio — la API
mentia con total confianza (ADR 0054, spec 0056). El guard que si se re-evalua es el que
vive en el `WHERE`/`Filter` del scan que se actualiza (ej. `saldo >= costo`), nunca un
`NOT EXISTS` de otra tabla en un CTE previo. Cualquier claim de "esto es idempotente/atomico
bajo concurrencia" en SQL nuevo se cierra con un `EXPLAIN` del plan real **y** un test que
lance el statement dos veces en simultaneo y lea el estado final por SQL — nunca con una
lectura del codigo, por mas que "EvalPlanQual deberia cubrirlo".

**Las reglas verificables van en hooks, no aca.** Los hooks corren fuera del contexto,
cuestan cero tokens y son deterministas; este archivo es advisory. Si una regla se puede
chequear con un comando, es un hook — no la escribas aca tambien.

## Codigo

- Si un archivo supera el limite de tamaño (hook `file-size`): dividir, no extender.
- No editar ni borrar tests para que el gate pase: un test rojo se arregla o se discute.
- Nada de andamiaje sin su tarea: codigo que no se usa hoy va con su fila en
  `docs/TASKS.md` que lo va a consumir, o se borra.
- **Una ruta que devuelve una entidad al navegador NUNCA serializa claves internas de R2**
  (`*ObjectKey`): devolver un DTO que las omite y expone sólo el `*Path` publico (ver
  `toClientProgram` en loyalty, `brandResponse` en marca). Blindar con un test por entidad.
  Un revisor independiente ya cazo esta fuga en marca (spec 0025); no repetirla.

## Gotchas

- **Gates: Node 24 + scripts de ROOT.** El shell arranca en Node 22 pero el repo pide 24
  (`typecheck`/`build` fallan si no): `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm
  use 24.19.0` antes de cualquier gate. `lint`, `test`, `format:check`, `build` son scripts de
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
