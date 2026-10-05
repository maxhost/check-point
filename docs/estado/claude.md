# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.

## ⇥ ESTADO (2026-10-04, noche) — ALTA CON GOOGLE PLACES (0155) + PERMISO DE ALTA BORRADO Y PROGRAMA SIN EMAIL (0156): PASS, ESPERA LA UI DE GPT

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
