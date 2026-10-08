# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.


## ⇥ ESTADO (2026-10-08, noche) — POS EN PRODUCCION (`main` = `3e26701`), MIGRACION 0066 APLICADA EN PROD

**Hecho (con OK explicito del owner, que pidio saltar los tests):**
- Snapshot de PROD antes de migrar: `snap-snowy-silence-ax0a6mn9` (`pre-0066-pos-2026-10-08`).
- `pnpm db:migrate:prod`: PROD paso de 66 a 67 migraciones; verificado por SQL: `core.pos_order`, `core.pos_order_item`,
  `business.pos_enabled` y `pos` en el CHECK de permisos. Migracion ANTES del push (el codigo nuevo lee `pos_enabled`).
- `git push --no-verify origin main` (`7d92027..3e26701`, 47+ commits: onboarding, POS API 0169 + `bestSellingProductIds`
  `4b1c696`, UI de GPT 0170–0178). Vercel merchant, customer y public: READY con `3e26701`;
  `business.checkpass.club/api/pos/catalog` → 401 (codigo nuevo), health 200 en business y my.
- **Sin verificar (owner lo decidio):** `pnpm verify` completo no corrio; los 14 e2e que fallaban (10 tours de
  Fidelizacion, 4 onboarding/entrada) siguen sin causa. Sin alta de prueba en PROD: el owner prueba con un usuario real.

**Pendiente:**
- Alta fallida de «Café Plátano» (intento 2026-10-07 14:58 UTC sin cuenta ni negocio): causa desconocida. Si el usuario
  real del owner falla al registrarse, leer logs de Vercel dentro de la hora (Hobby retiene 1 h).
- Staging en proyectos separados: plan en `docs/plan-staging-2026-10-08.md` (PARQUEADO #82).
- Cloudflare: regla «dev sin cache» puesta por el owner; medido `no-cache` + `DYNAMIC` en `dev-business.`.

**Decisiones del owner, no volver a preguntar:** base local en Docker (ADR 0126); tunel fijo (ADR 0127); POS: todo lo
de la spec 0169 §Decisiones; canje de premios solo en el mostrador; canje como cupon = PARQUEADO #81; staging en
proyectos Vercel + Neon SEPARADOS, nunca Preview del proyecto de PROD.