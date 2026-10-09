# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.


## ⇥ ESTADO (2026-10-09, madrugada) — HANDOFF: POS EN PROD (`3e26701`); `dev` VA ADELANTE SIN PUSHEAR

**En PROD (`main` = `origin/main` = `3e26701`, push del 2026-10-08 con `--no-verify` por OK explicito del owner):**
- Migracion 0066 aplicada en PROD (67 migraciones; tablas POS, `pos_enabled`, permiso `pos`, verificado por SQL).
  Snapshot previo `snap-snowy-silence-ax0a6mn9`. Vercel merchant/customer/public READY con `3e26701`.
- Alta en PROD probada de punta a punta (monitor de la base): «Cancha de Fútbol 5 "La Cantera"» (AR) y «Platano Garden
  Cafeteria» (EC, probablemente el «Café Plátano» que fallo el 2026-10-07) con email verificado; despues
  «F5 Futbol Evolution» (AR). **Escritura en PROD con OK del owner:** el email del owner de F5 se cambio a
  `maxhost27@gmail.com` (el original era temporal); sigue `email_verified=false` hasta que entre con el link.
- **Sin verificar (decision del owner):** `pnpm verify` completo nunca corrio en verde; los 14 e2e que fallaban
  (10 tours de Fidelizacion, 4 onboarding/entrada) siguen sin causa.

**En `dev`, sin pushear (van con el proximo push, con OK):**
- `838a33d` `GET /api/pos/catalog` excluye productos con `unitPrice: null` (precio 0 se conserva; `bestSellingProductIds`
  sigue subconjunto). Test `pos-best-sellers` 2/2, mutacion del filtro roja, typecheck/lint ok. Spec 0169 actualizada.
  La API todavia ACEPTA crear/editar orden con producto sin precio + `unitPrice` escrito (ordenes viejas): ofrecido al
  owner cerrarlo, sin respuesta.
- `8660441` `tools/dev-local/{up,link}.sh` en 100755 (repo con `core.fileMode=false`; un checkout les sacaba el +x).
- GPT: specs 0179–0181 (navbar, revision de orden, wizard de 3 pasos sin captura de precios) commiteadas en `dev`.
- `4b1c696` (`bestSellingProductIds`, 30 dias, cerradas con y sin pase) ya esta en PROD.

**Pendiente / abierto:**
- Staging en proyectos Vercel + Neon SEPARADOS (decision del owner): plan en `docs/plan-staging-2026-10-08.md`,
  PARQUEADO #82. Hallazgo: `DATABASE_URL` de Vercel merchant vale para production Y preview.
- Cloudflare: regla «dev sin cache» para `dev-business.`/`dev-my.` puesta por el owner (medido `no-cache` + `DYNAMIC`).
- R2 de desarrollo: CORS agregado por el owner para `dev-business.`/`dev-my.`/localhost (medido 204).
- Deuda declarada: test del `no_program` en `accrualContext` (R3 de la 0169).
- Arbol: `.claude/skills/gotchas-del-repo/SKILL.md` y `docs/LECCIONES.md` modificados por otra sesion, sin commitear
  (no son de este trabajo; no tocar sin preguntar).
- Ambiente local: el owner lo apaga y relanza con `pnpm dev:local` desde su terminal; si dice puerto ocupado,
  matar el `up.sh`, los `next dev --port 320x` y `cloudflared` viejos.

**Decisiones del owner, no volver a preguntar:** base local en Docker (ADR 0126); tunel fijo (ADR 0127); POS: spec 0169
§Decisiones; canje de premios solo en el mostrador; canje como cupon = PARQUEADO #81; staging en proyectos separados,
nunca Preview del proyecto de PROD; POS no recibe productos sin precio.