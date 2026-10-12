# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.



## ⇥ ESTADO (2026-10-11) — LOGIN POR CODIGO (0202) LISTO EN `dev`; `main` local = `dev`; PUSH UNICO CUANDO GPT CIERRE

**En PROD:** `origin/main` = `4c40a6a` (0189, 0190, 0195 API, 0196, landing/SEO 0191–0194; cerrado por el owner).

**En `dev` y en `main` local (sin pushear; owner 2026-10-11: «un solo push» cuando GPT complete todo):**
- `adb723c` panel instalable como PWA que abre en `/backoffice/pos` (PARQUEADO #86; QA en telefono pendiente).
- ADR 0137 + spec 0202 (login del owner con codigo de 6 digitos, 10 min, 5 intentos, tope 10 equivocados/24 h;
  owner acepto el bloqueo de 24 h). API `2e2e0dc` (Neon 7/7, 106 suites / 1000 tests, mutaciones M1/M3/M4 rojas, M2
  sobrevivio y se borro el codigo redundante). UI de GPT `c59ef50` + `4b7eab4`: revisada por Claude contra §D4;
  medido por Claude: `tsc` 0, eslint 0, unit 29/29, e2e `merchant-login-code` + `onboarding-google-places` 10/10.
- `50911ae` tooling: `worktree-new.sh` enlaza las variables de cada app; gotcha de `list_deployments` vacio.
- GPT: landing publica 0197–0201, marketing 0203, fidelizacion 0204 (QA del owner de 0203/0204 pendiente).
- `1106798` spec 0206 (imprimir si/no por negocio, APAGADO por defecto para todos, owner): migracion 0072 aditiva
  (`core.ticket_settings.printing_enabled`), `printingEnabled` en `GET/PUT /api/merchant/business/ticket` y `GET
  /api/pos/ticket`; el `PUT` lo exige → **la pantalla de Ajustes actual da 422 hasta la UI de GPT** (no pushear sin
  ella). Neon 9/9, M1/M2 rojas. Tambien `a480692` (`pnpm dev:link` muestra el codigo) y PARQUEADO #92 (papel 58/80).
- **`pnpm verify` NO corrido** (owner: no correr la suite hasta el push unico).

**Hallazgo a decidir (owner):** el alta con un email que YA tiene cuenta (etapa «Ya tienes cuenta» de
`onboarding-wizard.tsx`) sigue mandando un LINK (`api/onboarding/signup` → `signInMagicLink`): desde la PWA de iPhone
abre Safari y no deja sesion en la app. Opciones: dejarlo (alta = link, ADR 0137) o mandar codigo tambien ahi.

**QUE SIGUE:** GPT: UI de la 0206 (Ajustes + ocultar «Imprimir» en el POS); U4 hecha, U5/U6 descartadas por el owner; despues `main` ff a `dev`, `pnpm
verify` desde un worktree limpio, push con OK del owner, deploy READY y QA del owner en iPhone (login + PWA).
Analitica parqueada (PARQUEADO #91). Ramas `spec-0190`, `motor`, `sin-gate-email`: decision del owner pendiente.

**Decisiones del owner, no volver a preguntar:** ADR 0134–0137; precio de la landing «dejalo asi» (2026-10-10).
