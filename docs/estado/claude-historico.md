# Estado de Claude — historico

> Bloques ESTADO viejos, movidos tal cual desde `claude.md` (spec 0151). **No se lee al arrancar**: el estado
> vigente es el bloque `⇥ ESTADO` de arriba de `claude.md`. Se consulta con `rg` si hace falta un dato viejo.

## ⇥ ESTADO HISTORICO (2026-10-05, noche) — SPEC 0159 IMPLEMENTADA (`d797c21`), PUSH A `origin/main` SIN VERIFY; SIGUE LA N1 DE #76

**Hecho (verificado):**
- **0159** en `motor` `d797c21`, pusheada a `origin/main` con `--no-verify` (owner: «hacemos el push sin verificar
  para que no falle», por los flakes #74/#75); deploy de Vercel sin verificar: `Heading`, `Text`, `Card`, `PageHeader`, `Form`/`FormSection`/
  `FormActions` en `apps/merchant/src/ui`; `BrandTheme`/`resolveBrandTheme` borrados. Harness
  `tests/e2e/support/ui-kit-entry.tsx` + `ui-kit-checks.ts`; `ui-kit.spec.ts` (Chromium) y `ui-kit.webkit.spec.ts`:
  16/16 local; `CI=1` → 4 passed / 12 skipped. Referencias 4 + 4 `*-darwin.png` (la spec decia 8 + 8: error de cuenta).
  Capturas para el owner: https://claude.ai/artifact/L9rd4vPQoGuNNMTkkYSeZ3
- M1–M3 rojas por la asercion esperada. **M4 sobrevivio** con la tolerancia por defecto → capturas con `threshold: 0`
  (estable 2/2 sin mutar; M4 8/8 roja). Oraculo de `Form` reescrito (el de la spec era imposible con `aria`): detalle
  en la seccion «Implementacion» de la spec.
- `pnpm verify`: todo ok salvo `typecheck` ROJO por cache viejo de `.next/types/validator.ts` (rutas borradas en la
  0155); el `build` lo regenero y `pnpm typecheck` despues → 6/6. Tabla en la spec.

**Siguiente, en orden:**
1. **Spec chica N1 para #76** (owner: «añade la spec chica N1 antes de 160»): `validationErrors` del `Form` llega a
   `TextField`, `SelectField`, `NumberField`, `TextAreaField`, `ChoiceGroup` (hoy `isInvalid={props.isInvalid ??
   Boolean(errorMessage)}` pisa el error del servidor; fix candidato `errorMessage ? true : undefined`). Rojo primero
   en el harness del kit (`ui-kit-checks.ts`), un caso por campo; correr los e2e de wizard/programa/Staff (usan esos
   campos). Si cambia el aspecto, regenerar capturas mirandolas.
2. 0160 (Dialog, Combobox + `places-search.tsx`, Tabs, SegmentedControl, Switch, ProgressBar, Link) y 0161: se
   escriben al empezar cada una, sumando piezas al final de `ui-kit-entry.tsx`.
3. Fase 0c (guardias); Fase 1 (GPT) con lo que cada rebanada deje en `origin/main`.

**Pendientes del owner:** `.env.example` (Geoapify → `GOOGLE_MAPS_API_KEY=`); borrar las dos claves de
Geoapify en Vercel; QA del alta/locales/programa sin verificar; deploy de `b1ab123` sin verificar.

**Hallazgos abiertos:** PARQUEADO #74, #75 (flakes del pre-push), #76 (siguiente), #77 (diferido por el owner: «quizas lo
cambiamos»); H4 de la 0155.

**Gotchas de esta sesion:** Tailwind del harness solo genera clases usadas en `apps/merchant` (layout del harness
inline); un `next dev` de otro proyecto en el 3001 cuelga el `webServer` de Playwright (se mato con OK del owner);
el hook `foreign-staged.sh` exige los paths borrados con `git rm` escritos literales en el `git commit --`.

**Descartado:**

| Camino | Por que |
|---|---|
| Tolerancia de captura por defecto | M4 (sombra) pasaba verde |
| Oraculo «requerido vacio → `aria-invalid`» en `Form` | con `aria` React Aria no lo marca ni frena el envio |
| Arreglar `isInvalid` de los campos en la 0159 | cambia campos en uso: fuera de alcance (#76) |
| Capturas de Linux / en CI | owner: sus usuarios usan Windows y Mac |

**Prompt para retomar:** «Lee docs/estado/claude.md: spec chica N1 de #76».

## ⇥ ESTADO HISTORICO (2026-10-05, tarde) — SPEC 0159 (FASE 0b, REBANADA 1: TIPOGRAFIA, SUPERFICIES, FORMULARIOS) CERRADA, SIN IMPLEMENTAR

**Hecho (verificado):**
- **0158** en `origin/main` `b1ab123` (push con `--no-verify`, OK del owner por los flakes #74/#75). Deploy de Vercel
  sin verificar.
- Rama `motor` (worktree `check-point-wt/motor`) adelantada por fast-forward a `ui-sistema` `78d1829`; ahora es el
  punto de trabajo. `764718b`: spec 0159 `cerrada` + enmienda del ADR 0123 (particion de la 0b en 0159/0160/0161;
  capturas solo de Mac, owner: «no me interesa linux, me interesa que se vean en windows y mac») + fila en INDEX.
  Sin push.

**Siguiente, en orden:**
1. **Implementar la 0159** (N1, sesion principal, sin subagentes): `docs/specs/0159-kit-tipografia-superficies-y-formularios.md`.
   Primero el rojo (harness sin piezas), despues piezas, capturas `--update-snapshots` mirandolas + Artifact para el
   owner, M1–M4, `pnpm verify` una vez al final. Ojo: el pre-push puede caer por los flakes #74/#75.
2. 0160 (Dialog, Combobox + `places-search.tsx`, Tabs, SegmentedControl, Switch, ProgressBar, Link) y 0161 (campos
   file/color/time/datetime-local/range/search): se escriben al empezar cada una.
3. Fase 0c (guardias); Fase 1 (GPT) con lo que cada rebanada deje en `origin/main`.

**Pendientes del owner:** `.env.example` (Geoapify → `GOOGLE_MAPS_API_KEY=`); borrar las dos claves de
Geoapify en Vercel; QA del alta/locales/programa sin verificar.

**Hallazgos abiertos:** PARQUEADO #74 y #75 (flakes que bloquean el pre-push; spec chica pendiente); H4 de la 0155.
Rama `ui-sistema` (worktree `motor-wt/onboarding-google`) queda detras de `motor`.

**Descartado:**

| Camino | Por que |
|---|---|
| Trinquete con `tools/ui-baseline.json` | se puentea subiendo el JSON: se compara contra el merge-base con git |
| Guardias antes de completar el kit | obliga a hacer a mano lo que el kit no tiene (paso con `places-search.tsx`) |
| Pagina de muestra en `/backoffice/_ui` | en Next una carpeta `_x` no se rutea: va como harness de e2e |
| `driver.css` sin capa (como decia la spec) | sus reglas sin capa le ganan a `legacy`: rompio los tours |
| No reindentar `globals.css` | `format:check` lo exige dentro de `@layer` |
| Capturas de Linux / en CI | owner: sus usuarios usan Windows y Mac; sin Docker no se generan aca |
| La 0b en una sola spec | ~13 piezas: se parte en tres rebanadas N1 |

**Prompt para retomar:** «Lee docs/estado/claude.md: implementar la 0159».

## ⇥ ESTADO HISTORICO (2026-10-04, noche) — ALTA CON GOOGLE PLACES (0155) + PERMISO DE ALTA BORRADO Y PROGRAMA SIN EMAIL (0156): PASS, ESPERA LA UI DE GPT

**Que paso:** el owner rediseño el alta del comercio (ADR 0121): (1) negocio buscado en Google Places, (2) email que
crea la cuenta, (3) confirmacion; programa y QR salen del wizard; Google reemplaza a Geoapify en todo el merchant
(Essentials, sin horarios ni Time Zone API). Despues decidio borrar el permiso de alta, forzar emails en minusculas en
la base y que el programa (ver, crear, editar, sello, plantillas, QR) no exija email verificado (ADR 0122).

**Donde esta:** worktree `motor-wt/onboarding-google`, rama `onboarding-google` desde `origin/main` `1927742` (que ya
trae la 0153 + UI 0154 de GPT). Spec 0155 `07e345e` (PASS `0c9e151`; smoke contra Google real ok). Spec 0156
`3411fab` + `931fa2b` (PASS `26f60b6`), docs `5b90b5d`. Migracion `0065_borrar_permiso_de_alta.sql` aplicada SOLO a
`ci-integration`. **Sin push, a proposito:** la UI vieja llama a `/api/merchant/auth/start` y `/api/onboarding/business`
(404 desde la 0155).

**Siguiente:** GPT escribe su spec de UI sobre `docs/specs/0155-contratos-de-api.md`, hace `git rebase onboarding-google`
y UN push con todo. Despues: deploy READY en Vercel; en PROD `select count(*) from merchant_auth."user" where email <>
lower(email)` → 0; migracion 0065 a PROD (owner aprueba la llamada); **desde ahi no hay rollback de codigo anterior a
`3411fab` sin reponer la columna**. Probar la regla de Vercel «Places por IP» (61 requests a `/api/places/` → 429) y
cerrar PARQUEADO #70 con su ADR corto. QA del owner: alta con comercio real, con «santa maria y puerto de palos», con
email ya registrado, local nuevo en el backoffice, programa con cuenta sin verificar.

**Pendientes del owner:** `.env.example` (las dos de Geoapify → `GOOGLE_MAPS_API_KEY=`; el agente no tiene permiso
sobre `.env*`); borrar `GEOAPIFY_API_KEY` y `NEXT_PUBLIC_GEOAPIFY_API_KEY` en Vercel despues del deploy.

**Hallazgos abiertos:** PARQUEADO #74 (flake de catalogo en la Neon completa); H4 de la 0155 (un 400 de Google por clave
invalida en Details se ve como `place_not_found`). Lo anterior a este arco (0153/0154 en PROD con la UI de GPT, QA del
owner de 0143–0149, lote `pass_refresh`, PARQUEADO #69) sigue como estaba.

**Prompt para retomar:** «Lee docs/estado/claude.md: 0155 y 0156 con PASS en `onboarding-google`, esperan la UI de GPT».

## ⇥ ESTADO HISTORICO (2026-10-04, tarde) — 0153 (EL SISTEMA VALIDA EL CUPON) IMPLEMENTADA EN `motor`, PASS. ESPERA LA UI DE GPT

**Que paso:** QA del owner sobre la 0148/0149: «el merchant no tiene que validar el cupon manualmente lo tiene que hacer
el sistema». Decision en el ADR 0120 (sin «Validar»; veredicto verde/rojo al escanear; la venta consume; «Quitar»
siempre; extras con la venta; producto gratis/2x1 se agrega solo al carrito). Servidor: spec 0153 (renumerada: el 0152
es de GPT en `origin/main`), contrato `docs/specs/0153-contratos-de-api.md`.

**Donde esta:** rama `motor` rebasada sobre `origin/main` (`1ea1e5e`): `526db75` ADR+spec, `432f680` renumeracion,
`2adc79b` codigo (PASS del revisor; `pnpm verify` verde; R3 sin oraculo de carrera, en `TASKS.md`), `40291da` y
`f834ac1` docs, `d9f6a88` limpieza pedida por el owner (`buildCouponBody` y la visita redundante del canje; `pnpm
verify` verde). **Sin push, a proposito:** sin la UI de GPT un cupon no-descuento elegido bloquea la venta.

**Siguiente:** el owner le pasa a GPT el sha de `motor` (el ultimo commit de este estado); GPT escribe su spec 0154,
hace `git rebase motor` en su `main`, implementa la UI y hace UN push con todo. Despues: deploy READY en Vercel y QA
del owner (Panaderia, «Cafe americano gratis»: verde sin validar → salir sin consumir → venta con el cafe agregado solo;
vencido → rojo → «Quitar»). Si `motor` cambia antes, GPT tiene que re-rebasear.

**Hallazgos a decidir (owner), de la 0153:** un cupon en rojo no se aplica y la venta sale sin el (consecuencia de
diseño, no la dijo el owner);
el push de la orden no menciona las unidades extra del cupon.

**En PROD (`24ce0df`):** 0148 + 0149 + 0150 (falta `QA_LOGIN_ENABLED=true` en Vercel merchant). Skills temporales de
QA: `qa-cupones-prueba`, `qa-cupon-valido`, `delete-user`.

**Pendientes:** los de la 0151 (en `claude-historico.md`); QA del owner (0143/0146/0147/0148/0149); lote
`pass_refresh` (0146); PARQUEADO #69; Postgres local para tests; test de carrera del limite diario (R3, `TASKS.md`).

**Prompt para retomar:** «Lee docs/estado/claude.md: la 0153 espera la UI de GPT».

## ⇥ ESTADO HISTORICO (2026-10-04, cierre) — 0151 (ARNES NUEVO) COMMITEADA. PUSH PENDIENTE DEL OWNER

**Al retomar:** `git fetch && git merge --ff-only origin/main` (rama `motor`, sin upstream). Si `origin/main` no tiene
todavia `f4c2919`, el push no se hizo: lo corre el owner (`GH_TOKEN= git push origin HEAD:main` desde este worktree; el
clasificador de auto mode le bloquea el push a Claude). El `main` local de GPT se adelanto por fast-forward hasta el
commit de este estado: su proximo push tambien lo arrastra.

**Desde ahora rige el arnes de la 0151:** niveles N0/N1/N2 de `CLAUDE.md` (N0 directo, sin spec ni subagentes; subagentes
solo en N2), Stop hook con huella (46 s → 0 s sin cambios, reproducido), `tasks-fresh` solo avisa, un solo bloque de
estado (el viejo va a `claude-historico.md`; la skill `handoff` ya lo dice).

**En PROD (`24ce0df`):** 0148 (cupon elegido, Claude) + 0149 (UI, GPT) + 0150 (login de QA: API + botones, decision del
owner; falta `QA_LOGIN_ENABLED=true` en Vercel merchant). Skills temporales de QA: `qa-cupones-prueba`,
`qa-cupon-valido`, `delete-user`; productos «Prueba» en Panaderia/Barberia/Gym. Se borran al cerrar las pruebas.

**Hallazgos a decidir (owner), de la 0151:** revisor independiente (no corrido); bajar `claude-md-size.sh` a 100
lineas/6 KB; la huella no incluye HEAD (un pull no re-corre gates; lo cubren pre-push y CI).

**Pendientes:** QA del owner (0143/0146/0147/0148/0149); lote `pass_refresh` (0146); PARQUEADO #69 (Vercel Hobby);
Postgres local para tests (medir antes/despues, informe «Flujo agil con Claude Code»); revisor de la 0149.

**Prompt para retomar:** «Lee docs/estado/claude.md y seguimos con el QA».

## ⇥ ESTADO HISTORICO (2026-10-04) — 0148 + 0149 (UI de GPT) EN PROD (`3006a2f`). TOCA QA DEL OWNER

**Al retomar:** `git fetch` + `git merge --ff-only origin/main` (rama `motor` sin upstream). `origin/main` = `3006a2f`:
el push unico de GPT con la 0148 (Claude) y la 0149 (UI de GPT). **Deploy verificado** (status del commit por la API de
GitHub, 2026-10-04 14:43 UTC): merchant, customer y public `success` en `3006a2f`. 0064 en PROD desde el 2026-10-03.

**0150 commiteada (`b83134e`), SIN PUSHEAR:** API `qa-login` (implementador, cortado por Claude con la API completa;
unidad 27/27, typecheck/lint/prettier ok; sin revisor por decision del owner) + botones en el login (Claude, zona GPT por
decision del owner → avisar a GPT). El push lo bloqueo el clasificador de auto mode: lo corre el owner. Despues: deploy
`READY` y `QA_LOGIN_ENABLED=true` en el proyecto merchant de Vercel (owner).

**Pendiente:**
- **QA del owner de 0148/0149** (pasos en la spec 0148 §«QA del owner») y los de antes: 0143, 0146, 0147.
- **La 0149 no tiene revisor independiente** (su spec lo deja «posterior»; presupuesto de mutaciones 0). Ofrecido al owner.
- `docs/estado/gpt.md` en `3006a2f` todavia dice «No se ha pusheado» (zona de GPT: avisar).
- Lote `pass_refresh` de la 0146 (OK del owner); PARQUEADO #69 (Vercel Hobby); build Turbopack rojo en el entorno de GPT.
- **QA con datos de prueba en PROD** (pedido del owner, 2026-10-04): 17 productos en la categoria «Prueba» de Panaderia,
  Barberia y Gym, y la skill TEMPORAL `.claude/skills/qa-cupones-prueba/` (habilitar hoy / resetear canjes por MCP).
  Las dos cosas se borran cuando el owner cierre las pruebas.

## ⇥ ESTADO HISTORICO (2026-10-03, noche, 3) — 0148 IMPLEMENTADA (`b937eb5`) Y 0064 EN PROD. SIN PUSH: LO HACE GPT

**Al retomar:** `motor` = `origin/main` (`afa6e77`) + `9197529` + **`b937eb5`** (codigo 0148) + commits de estado. **El
`main` LOCAL (checkout de GPT) se adelanto por fast-forward hasta este commit**: GPT trabaja encima y su push arrastra
todo (decision del owner, 2026-10-03: «cuando GPT haga el push arrastre todo su trabajo y el tuyo para tener un solo
push»). **Claude no pushea la 0148.**

**0064 en PROD** (owner: «vamos a aplicar la migracion pero no el push», 2026-10-03), por `run_sql_transaction` en la
rama default `br-curly-silence-ax8acywm`. Verificado por SQL: 5 columnas, 5 constraints (check de una via), 2 indices,
fila 65 de `drizzle.__drizzle_migrations` con hash `f99cc2b96ca7…` = `shasum -a 256` del `.sql`; `core`/`consumer`/
`merchant_auth` intactos. Es aditiva: el codigo viejo de PROD sigue andando.

**Hecho y verificado (0148):** PASS del revisor independiente; Neon completo verde (implementador); `coupon-scope.neon` 3/3
y R1–R3 rojas medidas por el orquestador. Contrato y spec ajustados; spec `implementada`.

**Siguiente:** cuando GPT pushee: `pnpm ci:status` no se espera; verificar deploy `READY` de merchant y customer con su
sha. Avisos ya en el prompt de GPT (contrato 0148, «Puntos +0 coupon», `stages.tsx` 337 lineas, `.counter-coupon`
huerfano, `types.test.ts:96`). Para el owner: deadlock posible declarado en la spec; quitar un validado no revierte
`last_visit_at`.

**Siguen abiertos de antes** (bloques de abajo): QA del owner de 0143/0146/0147, lote `pass_refresh`, PARQUEADO #69.

## ⇥ ESTADO HISTORICO (2026-10-03, cierre 2) — SPEC 0148 CERRADA Y EN `main` (`afa6e77`). SIGUE: LANZAR EL IMPLEMENTADOR

**Al retomar:** `git pull --ff-only` + `pnpm ci:status`. `motor` = `origin/main` en `afa6e77` (+ el commit de este
estado). Sin codigo tocado en esta sesion.

**Hecho (sesion del canje de cupones):**
- El owner probo el canje de cupon en el mostrador y lo declaro inservible. Investigacion (6 notas + informe):
  `reports/Canje de cupones en mostrador móvil.md` y `research_notes/Canje de cupones en mostrador móvil/`.
- **ADR 0119** (`c91d989`): las 16 decisiones del owner — el cliente elige el cupon en la PWA, el mostrador lo valida
  o lo aplica en la venta, se ata a la venta con puntos sobre el neto, quitable, 1 por cliente + comercio + dia.
- **Spec 0148 `cerrada`** + contrato `specs/0148-contratos-de-api.md` (`afa6e77`), pusheados (`verify: ok`, solo docs).

**Siguiente (Claude):** lanzar UN `implementador` sobre la spec 0148 (migracion 0064 primero, en rama Neon efimera con
`tools/neon-test.sh`, nunca contra `DATABASE_URL`) y despues UN `revisor` con el presupuesto de la spec (10 mutaciones;
el lock de `business_customer` declarado sin mutacion). Al PASS: pedir OK del owner para la 0064 en PROD, avisar a GPT
(contrato 0148: pantallas del mostrador y de la PWA) y al owner que el mostrador queda sin cupones hasta esa UI.

**Prompt para retomar:** «Lee docs/estado/claude.md y lanza el implementador de la spec 0148».

**Siguen abiertos de antes** (bloque de abajo): QA del owner de 0143/0146/0147, lote `pass_refresh`, avisos a GPT,
PARQUEADO #69 (Vercel Hobby: cada push = 3 deploys).

## ⇥ ESTADO HISTORICO (2026-10-03, cierre) — 0143, 0144, 0146 Y 0147 EN `main` (`e667005`). TOCA QA DEL OWNER

**Al retomar:** `git pull --ff-only` + `pnpm ci:status`. `motor` = `origin/main` en `e667005` (mas el commit de este
handoff). Arbol limpio (salvo `.pnpm-store`, ignorable).

**Hecho hoy (todo con PASS de revisor independiente y `pre-push` `verify: ok`):**
- **0143** venta cruzada por la compra (`ab5e62e`) + migracion **0063 en PROD** (verificada por SQL).
- **0144** atraso de la loteria por comercio (`fdb4e42`); decisiones del owner en ADR 0117 «Cerrado despues».
- **0146** icono de la PWA en el pase Apple (`5c855c7`); `PASS_BRAND_UPDATED_AT` = `2026-10-03T22:00:00Z`.
- **0147** `sourceFileName` en el DTO de la importacion con IA (`a8a66ba`), en las 9 respuestas.
- Rama Neon `bench-clientes-comercio` (4,4 GB) borrada con OK del owner.
- Deploy: merchant y customer `success` en `e667005`; public con rate limit de Vercel Hobby (no le toca nada de esto).

**QA del owner (lo que hay para probar):**
1. **0143:** dos comercios de rubros distintos a < 2 km, cruzada activa en B con fecha de fin, cliente con notificaciones
   de la PWA; acreditar en A entre 7:00 y 17:40 → cupon de B en «Mis beneficios» y push «🎁 Tenés un regalo» 3–13 min
   despues («Run now» en cron-job.org para no esperar).
2. **0146:** pase de QA firmado con el certificado real en iPhone → la notificacion del pase muestra la «c» de la PWA;
   logo, strip, nombre y QR iguales; anotar version de iOS.
3. **0147:** importar un PDF con IA en el merchant, recargar mientras analiza → la tarjeta conserva el nombre real.

**Siguiente (Claude, despues del QA):**
- **Lote `pass_refresh` de la 0146 a PROD** (con OK del owner): comprobar las variables APNs del worker de merchant, excluir
  pases solo-hash, muestra y despues lote una vez (`docs/wallet/apple-wallet-design-and-release.md` §«Pasar a vivo»).
- **Avisar a GPT**: C1/C2 → 404 y `endsAt` obligatorio (la 0145 de GPT ya lo consume); `sourceFileName` viene siempre.
- **PARQUEADO #69** (owner): Vercel Pro y/o «Ignored Build Step». Mientras siga en Hobby: juntar los commits de docs en el
  push del trabajo (cada push = 3 deploys; tope 100/dia, ventana movil).

**Pendientes de antes:** CI de `main` sin mirar con `pnpm ci:status`; los de la 0138; `AGENT-WORKFLOW.md`/agentes con
bitacora a `TASKS.md`; `.prettierignore` con `docs/`; #68; borrar `motor-wt/fix-notices-mock`; `CRON_SECRET` rotable.

## ⇥ ESTADO HISTORICO (2026-10-03, noche, 2) — SPEC 0147 IMPLEMENTADA (`a8a66ba`), `sourceFileName` EN EL DTO DE IMPORTACION

**Al retomar:** `git pull --ff-only` + `pnpm ci:status`. `motor` = `a8a66ba` + este commit de estado.

**Hecho:** spec **0147** (`sourceFileName` en las 9 respuestas de `toImportDTO`: PDF → `original_name`, imagenes → `null`;
lector `catalog-import/source-file.ts` por `import_id` + `business_id`; DTO en `dto.ts`). PASS del revisor (M1, M3 rojas; R1
sobrevive → declarado en la spec). El orquestador re-corrio contract/routes 17/17 y la suite Neon nueva 5/5. Timeout 60 s en
`catalog-import.neon…:143` (el intermitente conocido, sin tocar aserciones).

**Siguiente:** avisar a GPT que `sourceFileName` viene siempre (su UI ya lo acepta; no cambia nada). Pendientes del owner de
antes: QA en iPhone de la 0146 y el lote `pass_refresh`; QA de la 0143.

## ⇥ ESTADO HISTORICO (2026-10-03, noche) — 0143, 0144 Y 0146 EN `main` (`5c855c7`). PENDIENTES DEL OWNER: QA IPHONE Y LOTE `pass_refresh`

**Al retomar:** `git pull --ff-only` + `pnpm ci:status`. `motor` = `origin/main` en `5c855c7` (mas este commit de estado).

**Hecho:** 0143 (venta cruzada por la compra) y 0144 (atraso por comercio) desplegadas (`61c067e`); 0063 en PROD. **0146**
(icono de la PWA en el pase Apple) en `main` (`5c855c7`): solo `icon*` cambia (logo/strip byte a byte iguales),
`PASS_BRAND_UPDATED_AT` = `2026-10-03T22:00:00Z`, Google sin tocar. PASS del revisor (R1–R3 rojas); el orquestador sumo el
caso «pase instalado bajo la revision anterior → 200» y lo midio rojo con la fecha vieja (`expected 304 to be 200`).
`pre-push`: `verify: ok`. La 0145 es de GPT (UI de la venta cruzada).

**Deploy (2026-10-03, 22:4x UTC):** merchant `success` con `981662e` (incluye la 0146 y el `e61e3d5` de GPT). customer y
public `failure` por «rate limited — retry in 24 hours» en `981662e`, pero siguen en `5c855c7`, y desde ahi solo cambiaron
archivos de merchant y docs: el codigo que sirven es el actual. Rama Neon `bench-clientes-comercio` (4,4 GB) BORRADA con OK
del owner. Este commit de estado no se pusheo (para no gastar builds de Hobby).

**Pendiente del owner para la 0146:** QA en iPhone (notificacion con el icono nuevo) y OK para el lote `pass_refresh` de
produccion (muestra primero; excluir pases solo-hash; variables APNs del worker), segun la spec §«Declarado AFUERA».

**Siguiente (venta cruzada):** avisar a GPT (C1/C2 → 404, `endsAt` obligatorio; la 0145 de GPT ya consume la 0143); QA del
owner de la 0143.

**Hallazgos a decidir (owner), del revisor:** `R` cuenta solo `issued` (en `coupon_conflict` la campaña tambien salio
elegida); F/R se cuentan por campaña (si un comercio recrea su campaña a mitad de mes, su atraso vuelve a cero). Bajo
riesgo, no bloquean.

**Pendientes:** CI de `main` sin mirar en `76ce724`; intermitente de `catalog-import` (timeout 5 s, visto otra vez); los de la
0138; `AGENT-WORKFLOW.md`/agentes con bitacora a `TASKS.md`; `.prettierignore` con `docs/`; #68; borrar
`motor-wt/fix-notices-mock`; `CRON_SECRET` rotable por el owner.

## ⇥ ESTADO HISTORICO (2026-10-03, tarde, 2) — SPEC 0143 CERRADA, CRON-JOB.ORG ANDANDO (`459cfd4`). SIGUIENTE: IMPLEMENTAR LA 0143

**Al retomar:** `git pull --ff-only` + `pnpm ci:status`. `motor` = `origin/main` en `459cfd4` (mas este commit).

**Hecho:** spec **0143** (Venta cruzada por la compra; migracion **0063** a PROD ANTES del deploy) y **ADR 0118**. El
owner creo el job de cron-job.org (cada 10 min, horas 7–17, `America/Guayaquil`); verificado: «Run now» → HTTP 200 y
**7 `reminder` `sent` en PROD a las 18:24:31 UTC** (SQL). `wallet-push-cron.yml` borrado y el job documentado en
`docs/notificaciones/README.md` §5bis (`459cfd4`). URL del worker: `https://business.checkpass.club/api/internal/wallet-push`.

**Siguiente:** despachar implementador + revisor de la 0143 (7 mutaciones; el item de cron de la DoD ya esta hecho, el
revisor lo tilda). Avisar a GPT del contrato (C1/C2 404, `endsAt` obligatorio en M1). El owner puede rotar
`CRON_SECRET` (no lo tiene anotado): si lo hace, Vercel + redeploy, GitHub (lo usan `marketing-tick` y
`catalog-import-reconcile`) y el header de cron-job.org.

**Pendientes:** CI de `main` sin mirar desde `0b5073a`; intermitente de `catalog-import-guard`; los de la 0138;
`AGENT-WORKFLOW.md`/agentes con bitacora a `TASKS.md`; `.prettierignore` con `docs/`; #68; borrar `motor-wt/fix-notices-mock`.

## ⇥ ESTADO HISTORICO (2026-10-03, tarde) — SPEC 0143 CERRADA (`4c50397`)

Reemplazado por el bloque de arriba el mismo dia.

## ⇥ ESTADO HISTORICO (2026-10-03) — ADR 0117 ACEPTADA (VENTA CRUZADA). SIGUIENTE: ESCRIBIR LA SPEC 4 DEL ADR 0115

**Al retomar:** `git pull --ff-only` + `pnpm ci:status`. `motor` = `origin/main` en `fd971fe` (mas este commit).

**Hecho:** ADR 0117 aceptada con 15 decisiones del owner: la cruzada se dispara al escanear en A, UN cupon ya emitido de
un comercio cercano de otro rubro, push «regalo misterio» ~3 min despues del de mostrador, loteria H4 (igual por
oportunidad + bono al comercio sin clientes nuevos en el mes) con 20 % de azar editable en `limits.ts`, registro de
cada decision desde el dia uno, exito = canje, sin grupo de control por ahora, una vez por campaña por cliente, la
lista «a pedido» se apaga. Investigaciones en `docs/notificaciones/venta-cruzada-{criterio,algoritmo,equidad}.md` +
`sim_equidad.py`. `.githooks/pre-push` ejecutable en git (`2589922`); **el checkout de GPT lo tiene sin el bit**
(avisado al owner con el `chmod +x` para GPT).

**Siguiente:** escribir la spec 4 (TEMPLATE grande: migracion de las tablas de decision y candidatos). Medir antes:
el disparo desde el escaneo (`persistGrant`/`counter/orders.ts`), la emision del cupon cruzado (`claimCrossOffer`),
el apagado de la lista a pedido (`listCrossOffers` en «Mis beneficios»), y el hallazgo del §«Para la spec» del 0117
(`ends_at` nulo en `cross`). Contrato HTTP para GPT si cambia «Mis beneficios».

**Pendientes:** CI de `main` con el intermitente de `catalog-import-guard` (sin confirmar); los de la 0138; `AGENT-WORKFLOW.md`/agentes con
bitacora a `TASKS.md`; `.prettierignore` con `docs/`; #68; borrar `motor-wt/fix-notices-mock`.

## ⇥ ESTADO HISTORICO (2026-10-02, noche) — SPEC 0141 IMPLEMENTADA Y EN `main` (`d6178b1`). SIGUIENTE: SPEC 4 DEL ADR 0115

**Al retomar:** `git pull --ff-only` + `pnpm ci:status`. `motor` = `origin/main` en `d6178b1` (mas este commit).

**Hecho hoy:** spec 0139 (canales por la PWA + avisos en Actividad, migracion 0062 en PROD) y spec 0141 (limites de
notificaciones en `packages/domain/src/server/notifications/limits.ts`, sin cambiar valores; mapa en
`docs/notificaciones/README.md`; PASS del revisor, 7 mutaciones rojas; push con el hook completo, `verify: ok`).
Mock de `listConsumerNotices` para la 0140 de GPT en `main` (`0a66bc8`).

**Pendiente:**
- **`.githooks/pre-push` esta en git como `100644`:** en un worktree nuevo el hook NO corre (el push de `0a66bc8` se
  lo salteo). Arreglo: `git update-index --chmod=+x .githooks/pre-push`. Espera el OK del owner.
- **CI de `main` roja en `001b6f0`** segun el agente del mock: `catalog-import-guard.neon…:103` (`expected 201 to be 409`),
  intermitente conocido de `catalog-import`. Sin confirmar por `ci:status`.
- **LECCIONES:** dos specs seguidas con filas del plan de pruebas falsas contra el arbol (0139 M3 sin `sent_at`; 0141
  M1, ruta del test en `packages/`, centinelas 1/1). La regla ya existe; falta el caso en `LECCIONES.md`.
- Spec 4 del ADR 0115 (aviso de la Venta cruzada): el como lo cierra el owner ANTES de escribirla.
- De antes: los de la 0138 (`audience-preview`, `rewards/results`, `balance-push`), `AGENT-WORKFLOW.md`/agentes con
  bitacora a `TASKS.md`, `.prettierignore` con `docs/`, #68. Worktree `motor-wt/fix-notices-mock` del agente del mock
  (borrable).

## ⇥ ESTADO HISTORICO (2026-10-02, noche) — SPEC 0139 IMPLEMENTADA Y EN `main` (`d6368c8`). SIGUIENTE: SPEC 3 DEL ADR 0115

**Al retomar:** `git pull --ff-only` + `pnpm ci:status`. `motor` = `origin/main` en `d6368c8` (mas este commit).

**Hecho:** ADR 0116 + spec 0139 (spec 2 del 0115). `campaign`/`transactional` solo por Web Push, nunca Wallet; sin
suscripcion cierran `suppressed`/`no_channel` sin gastar presupuesto; `latest_message` solo del `reminder`;
`GET /api/public/consumer/notices` + `listConsumerNotices` para Actividad; migracion `0062` (GRANT SELECT de 6
columnas al rol del cliente). PASS del revisor; M1-M9 rojas (M9 la agrego el orquestador, `8297ae6`). **Push con
`--no-verify` AUTORIZADO por el owner** (2026-10-02, «Push con --no-verify»): el e2e no podia correr, puerto 3000
ocupado por el dev server de `central-hill`; `check-numbers` corrido a mano, ok.

**La 0062 esta en PROD** (owner, 2026-10-02; verificada por SQL). **Pendiente:** `test:e2e` sin correr en este
arbol (correrlo cuando el 3000 este libre). **GPT tiene que conectar Actividad** a `listConsumerNotices` (contrato en la
spec 0139 §3; avisar al owner). Siguiente spec: **3 del ADR 0115 (limites centralizados)**. Pendientes de antes: los de
la 0138 (`audience-preview`, `rewards/results`, `balance-push`), `AGENT-WORKFLOW.md`/agentes con bitacora a
`TASKS.md`, `.prettierignore` con `docs/`, #68.

## ⇥ ESTADO HISTORICO (2026-10-03) — 0138 IMPLEMENTADA Y EN `main` (`aefc21c`, push `07c7a37`). SIGUIENTE: SPEC 2 DEL ADR 0115

**Al retomar:** `git pull --ff-only` + `pnpm ci:status`. `motor` = `origin/main` en `07c7a37` (mas este commit de
estado). Arbol limpio.

**Hecho:** spec 0138 (solo Bienvenida y Venta cruzada; compositor, valle, reactivacion, saldo y paso 4 apagados
desde `packages/domain/src/server/marketing/enabled-campaigns.ts`). Codigo `aefc21c` + `f693e08` (revierte
`next-env.d.ts`). PASS del revisor independiente (5 mutaciones rojas, reescrituras y salteados revisados). Neon
completo con el arbol de la spec: 2891 passed / 248 skipped / 0 failed en ~5 min (antes ~10). `pre-push` del push:
`verify: ok` (Neon relacionado; e2e salteado, sin UI). **La #67 queda resuelta** (el paso 4 no corre); falta
cerrarla en `PARQUEADO.md`. `ci-integration`: borrados los 99 turnos historicos y los 3 residuos de billing (OK
del owner).

**Siguiente:** cerrar #67 en PARQUEADO; spec 2 del ADR 0115 (canales: campañas y mostrador por PWA o solo en la app,
recordatorio por Wallet con respaldo PWA). Pendientes de la 0138 (sin riesgo hoy): `audience-preview` abierto,
`rewards/results` sin medir, condicion `||` de `balance-push`. Avisado al owner: vitest vuelca la cadena de conexion
de `ci-integration` en errores (redactada en el scratchpad; queda en transcripciones de agentes en `~/.claude/`).

**Medido en la corrida Neon completa (2026-10-02 22:00 UTC, ~10 min):** 6 failed / 3119 passed — `marketing-valley`
(timeout, #67), **3 NUEVOS en `marketing-refresh`** (`expected [] to have a length of 1`, causa sin medir) y 2
intermitentes de `catalog-import`. No dejo turnos vivos nuevos (total sigue 99).

**Pendientes chicos:** `docs/AGENT-WORKFLOW.md` y `.claude/agents/*` aun mandan la bitacora a `docs/TASKS.md`;
`.prettierignore` excluye `docs/`; #68; borrar el worktree `motor` cuando el owner lo pida.

## ⇥ ESTADO HISTORICO (2026-10-02, noche) — PLAN 2 IMPLEMENTADO (ADR 0114 / spec 0135); SPEC 0112 DE LA OFERTA CRUZADA → 0136

**0135** (`099b409`): `docs/TRABAJO-EN-PARALELO.md`, `AGENTS.md` (GPT), `.githooks/pre-push` (check-numbers + `pnpm
verify`, modo solo-docs) **instalado** (`core.hooksPath=.githooks`, comun a los dos arboles), estado por agente
(`docs/estado/`). Verificado por el orquestador: el hook **bloquea** un push a main con una spec duplicada (exit 1,
nombra el numero) y `check-numbers` da exit 0 en el repo. **`ef05b1a`**: la spec 0112 de la oferta cruzada y su
contrato se renumeraron a **0136** (0112 queda para la PWA de GPT); lista de excepciones de `check-numbers` vacia.
**El push de estos commits va con `--no-verify` AUTORIZADO por el owner** (2026-10-02, «opcion 1»): `package.json`
dispara Neon completo y en local fallan `marketing-valley` (#67, timeout 180 s; en GitHub pasa) y un intermitente de
`catalog-import-guard` (en solitario verde). Fast gates + e2e 106/106 verdes. **Al pushear:** `pnpm ci:status`.
Pendiente: mensaje del owner a GPT (leer `AGENTS.md`); `docs/AGENT-WORKFLOW.md` y los agentes aun mandan la bitacora a
`TASKS.md`; prettier ignora `docs/` (el modo solo-docs no revisa nada); **#67 bloquea localmente todo push con Neon
completo** → prioridad.

## ⇥ ESTADO HISTORICO (2026-10-02, noche) — `pnpm verify` EN MAIN (ADR 0113 / spec 0133)

**Desde ahora el gate es `pnpm verify`** (gates segun lo que cambio) y cada sesion empieza con `pnpm ci:status`.
Medido por el orquestador: `pnpm verify --files apps/merchant/src/server/marketing/template-store.ts` = **2 min 20 s**
(Neon selectivo 11 suites en 92 s) contra ~20 min de Neon completo. Las 4 suites Neon que tenian roja la CI de `main`
(#69) se arreglaron en la spec **0134** (`623eb4d`, solo tests; 21/21 re-corridas). **Verificado: `pnpm ci:status` → CI de
`main` VERDE en `46eb63d`** (run 37039670082, Neon completo + e2e incluidos). #67 y #68 siguen anotados en PARQUEADO. Pendiente
del handoff: `docs/AGENT-WORKFLOW.md` y skills que todavia citen «los 6 gates». **Siguiente con el owner: Plan 2.**

## ⇥ ESTADO (2026-10-02, noche) — PLAN 1 CERRADO: `main` ALINEADO, TAG `baseline-2026-10-02` (= `49c7c9e`)

Unica rama remota: `main`. 0131 (Claude, tests de servidor) y 0132 (GPT, e2e `437e7a2`) en main. **Los 6 gates verdes
en `49c7c9e` con Node 24** (medido por Claude): typecheck, lint, test (2272), format:check, build, **test:e2e 106
passed / 0 failed / 5 skipped**. **NO corridas** las suites `.neon.integration` completas (~20 min; el owner decidio
no correrlas ahora): rojos conocidos ahi #67 (`marketing-valley`) y #68 (intermitente en `push-enable`). El tag lo
declara en su mensaje. **Siguiente: Plan 2 (trabajo en paralelo Claude/GPT) con el owner.** Al cerrar esta sesion se
borra el worktree `motor` (identico a main).
