# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.


## ⇥ ESTADO (2026-10-09) — `dev` LISTO PARA MERGE A `main` (`ef769b6`); 0067 Y 0068 YA APLICADAS EN PROD

**En PROD:** codigo `main` = `origin/main` = `3e26701` (sin cambios). **Base: migraciones 0067 (mesas) y 0068
(ajuste del ticket) APLICADAS el 2026-10-09** por `run_sql_transaction` (sin connection string en el transcript),
con snapshot previo `pre-0067-0068-2026-10-09` (`snap-royal-band-ax3tsf2l`). Verificado por SQL: 69 filas en
`drizzle.__drizzle_migrations` (ultima `1791565939169` = 0068), `core.dining_table`, `core.ticket_settings`,
`pos_order.dining_table_id` y 3 indices; 3 negocios y 3 ordenes intactos. Aditivas: el codigo viejo no las lee.

**En `dev` (sin pushear):** todo lo de la nota anterior (mesas, impresion 0184 `c264dbf`, UI de GPT 0185 `9dfd240`
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
1. Merge local `dev` → `main` (`--ff-only`), lo completa GPT segun el owner; probar `main` en local.
2. Push a live con OK del owner (pre-push corre `pnpm verify`), y el deploy de Vercel `READY` con ese sha antes
   del QA del owner.
3. Prueba de campo de la impresion en la WD-58P1 cuando este en live o en local por el tunel.
4. Spec B (venta reclamable por QR, PARQUEADO #85). Ideas de hardware parqueadas: #87–#90; investigacion en
   `docs/investigacion-esp32-marketing-cercania-2026-10-09.md`.

**Pendiente / abierto (de antes):** PARQUEADO #82 (staging), #86 (PWA), deuda `no_program` (R3 0169), hallazgo
`loyalty-api.ts` (zona GPT). Local: cupones de prueba de Joyas para `cliente-1` y enlace de sesion
`https://dev-my.checkpass.club/c/seed-local-web-1` (solo base local).

**Decisiones del owner, no volver a preguntar:** las del bloque historico anterior, mas: Wi-Fi de invitados (#88),
linea de hardware (#89), aparato de mesa (#90), todas parqueadas.
