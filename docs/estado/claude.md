# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.


## ⇥ ESTADO (2026-10-07, noche) — SPEC 0167 IMPLEMENTADA CON PASS (`d244f1c`); FALTAN LOS `.env` DEL OWNER Y SU QA

**Hecho (verificado):**
- **Spec 0167 implementada:** `7f08691` + `fef6489` (implementador) y `180c5ac` (arreglo del orquestador).
  - Revisor **PASS** con 5 mutaciones. Los candados abortan con el host REAL de PROD en sus 6 variantes, sin red.
  - Re-medido por el orquestador: `compare.sh` exit 0 (19 categorias); `pnpm --filter @mi-pasaporte/db test` 10 passed;
    `huellas.sql`/`huellas-prod.txt` intactos; `customer_reader` sin `app.business_id` falla cerrado (psql, spec corregida en `e0209c8`).
- **Hallazgos del revisor, arreglados en `180c5ac`:**
  - `neon-test.sh` dejaba pasar PROD con valores entre comillas. Reproducido: el endpoint salia `"postgresql`.
    Ahora `leer()` saca las comillas y un endpoint que no es `ep-…` se rechaza.
  - La regla en bash no tenia test: `tools/neon-test-guard.test.ts` (19 casos, huella ficticia via
    `NEON_TEST_EXTRA_BLOCKED_SHA12`, que solo suma). Muerde: sin `-rvr` 6 rojos, sin comillas 2 rojos.
- `pnpm verify` ok sobre `180c5ac`: 3131 passed, `neon (full)` en verde.
- Contenedores `checkpass-local` (pg 55432, proxy 4444) arriba, con 66 migraciones y seed ficticio.

**Siguiente (del owner, en este orden; runbook `docs/runbooks/migrar-prod.md` §2):**
1. `packages/db/.env.prod.local` con `DATABASE_URL_UNPOOLED` = URL directa de PROD.
2. En el mismo paso, `DATABASE_URL` local + las 6 claves de `tools/local-db/.env.r2-dev` en los dos `.env.local`;
   `EMAIL_PROVIDER=console` (merchant); `WALLET_PROVIDER=fake`, sin secretos de wallet, VAPID nuevo y sin
   `CLICKSEND_*`/`TWILIO_*`/`OTP_PROVIDER` (consumer).
3. `node tools/local-db/check-env.ts` exit 0 (hoy: exit 1, esperado). Lo re-corre Claude.
4. QA manual: `pnpm dev` de las dos apps contra la base local, login de merchant por consola, alta, sello y un logo
   que llegue al bucket dev.
5. `.env.example`: parche listo en el scratchpad (se pierde); el texto esta tambien en el runbook §2. Lo aplica el
   owner o se ajusta el permiso, que decide el owner.

**Decisiones del owner, no volver a preguntar:** base local en Docker que replica Neon, sin ramas Neon de desarrollo ni
preview de Vercel; proxy, mismo driver; esquema + datos de prueba, nunca copia de PROD; R2 de desarrollo en local;
Vercel Hobby en el periodo de pruebas; rotacion de claves la decide el owner (no recordarla).

**Pendientes del owner:** sacar `QA_LOGIN_ENABLED` de Vercel; borrar pases/PWA de prueba de los telefonos. Skills
`qa-cupones-prueba`, `qa-cupon-valido` y `delete-user` apuntan a comercios que ya no existen (ofrecido borrarlas).

**Como se trabaja:** commits LOCALES en `main`, sin push (Hobby; contar con `git rev-list --count origin/main..main`).
PROD con datos reales: cero escrituras sin OK explicito (esta sesion: solo SELECT y lecturas de la API de Neon).

**Gotchas:**
- El hook `env-read-guard.sh` bloquea cualquier comando que nombre un `.env` junto a `grep`/`head`/`cut`/`sed`: los
  scripts que leen `.env` se escriben con Write y se corren en un comando aparte.
- Los agentes no pueden escribir `.env*`, ni siquiera `.env.example`.
- La API de Neon da 429 con rafagas: reintentar una vez.
- En el bash de los scripts, `rg` no esta en el PATH: usar `sed`/`grep`.

**Prompt para retomar:** «Lee docs/estado/claude.md: verificar los `.env` del owner con check-env y acompañar su QA de la spec 0167».
