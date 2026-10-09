# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.


## ⇥ ESTADO (2026-10-09) — EN LIVE: `main` = `origin/main` = `9405c93` (MESAS + IMPRESION + POS); VERCEL READY

**En PROD:** `9405c93` pusheado 2026-10-09 con `--no-verify` **con OK explicito del owner**: el pre-push corrio
`pnpm verify` y dio verde en typecheck, lint, ui-guard, format:check, test, build y Neon completo (400 archivos /
3256 passed / 282 skipped); el unico rojo fue `test:e2e`, que NO arranco porque el entorno local ocupaba el puerto
3200 («Another next dev server is already running», PID del consumer local). Los e2e completos los habia corrido GPT
verdes sobre `fc83ed2` (288 passed / 21 skipped); despues solo formato y docs. Vercel: merchant, customer y public
`READY` con `9405c93`. Humo en live: `/api/health` 200 en business y my; `GET /api/pos/ticket` y
`/api/merchant/business/ticket` sin sesion → 401; `/prueba-impresora` → 404 (borrada). **Base:** 0067 y 0068
aplicadas antes del push (snapshot `pre-0067-0068-2026-10-09`, `snap-royal-band-ax3tsf2l`; 69 migraciones).
Leccion para el proximo push: parar el entorno local antes (el e2e necesita los puertos 3200/3201).

**Lo que entro en este pase (antes en `dev`):** todo lo de la nota anterior (mesas, impresion 0184 `c264dbf`, UI de GPT 0185 `9dfd240`
y 0186 `7664df1`, fixes de e2e de GPT `500f8fa`, docs) mas:
- `ef769b6` Prettier en los 14 archivos de mi zona que marcaba `format:check` (solo formato). Medido: `pnpm
  format:check` 0, `git diff --check` 0, unitarios `printing` 23/23. Gates previos de GPT sobre `fc83ed2`
  (typecheck, lint, ui-guard, 2458 unitarios, build, 3256 Neon, e2e 288 passed / 21 skipped): log en
  `/private/tmp/checkpass-2026-10-09-pre-main-verify.log`, detalle en `docs/preparacion-main-2026-10-09.md`;
  no los repeti (el cambio fue solo formato).
- Revision del trabajo de GPT de impresion (0185/0186): respeta el contrato (sin `await` antes de `printTicket`,
  ajuste cargado al abrir el POS, los 5 resultados, `window.print()` con el `TicketDoc`, ajuste solo owner).
  **Huecos, hallazgo a decidir:** no hay ajuste «Impresora» por dispositivo → en Android `choose` usa BLE siempre
  (no se puede elegir una Bluetooth clasica) y el papel queda en 58 mm.

**QUE SIGUE:**
1. QA del owner en live.
2. Prueba de campo de la impresion en la WD-58P1 cuando este en live o en local por el tunel.
3. Spec B (venta reclamable por QR, PARQUEADO #85). Ideas de hardware parqueadas: #87–#90; investigacion en
   `docs/investigacion-esp32-marketing-cercania-2026-10-09.md`.

**Pendiente / abierto (de antes):** PARQUEADO #82 (staging), #86 (PWA), deuda `no_program` (R3 0169), hallazgo
`loyalty-api.ts` (zona GPT). Local: cupones de prueba de Joyas para `cliente-1` y enlace de sesion
`https://dev-my.checkpass.club/c/seed-local-web-1` (solo base local).

**Decisiones del owner, no volver a preguntar:** las del bloque historico anterior, mas: Wi-Fi de invitados (#88),
linea de hardware (#89), aparato de mesa (#90), todas parqueadas.
