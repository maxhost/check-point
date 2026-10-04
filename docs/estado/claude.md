# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; el historico, en `../TASKS.md`.
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.

## ⇥ ESTADO (2026-10-03, cierre 2) — SPEC 0148 CERRADA Y EN `main` (`afa6e77`). SIGUE: LANZAR EL IMPLEMENTADOR

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
