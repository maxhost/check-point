# 0236 — DateField del kit

Task `gastos-review-calendar`, base `994ff28cfd138d2a16dc3d151f3a13312d3b695f`, worktree `/private/tmp/checkpass-gastos-review/gastos-review-calendar`. Fuente `063007ee779f85f04c28424b2237d41909805cd2`; handoff posterior sin cambios de producto. Asignación de kit explícita en `0236-review-contract.md`.

`DateField` se exporta desde `ui/index.ts`. Props: `label`, `value`, `onChange`, `min?`, `description?`, `errorMessage?`, `isDisabled?`, `isRequired?`, `name?`, `defaultOpen?`, `tourAnchor?`, `className?`. Valor/mínimo `YYYY-MM-DD`, vacío `""`; sin hora/zona/conversión UTC ni mínimo implícito. Conserva segmentos escritos y labels existentes «Abrir calendario», «Mes anterior», «Mes siguiente».

Reutiliza todo el DateTimeField/calendario/estilos React Aria mediante `granularity="day"` y `parseDate`. DateTimeField agrega granularity opcional y conserva por defecto minute, parseDateTime, hora24h y salida `YYYY-MM-DDTHH:mm`. Sin duplicar calendario, CSS, tokens ni dependencias.

Verificación sobre fuente063007ee, Node24.20.0:

- Merchant typecheck EXIT0; lint de los3 archivos asignados EXIT0; Prettier y diff check EXIT0.
- Chromium real:2/2 casos,0 skips,0 retries, EXIT0, anchos390/1280. DateField tiene3 segmentos sin hora/minuto, permite seleccionar14septiembre pasado y emite `2026-09-14`; edición del segmento día emite15; min día deshabilita3octubre y permite10. DateTimeField conserva hora: minuto09:30→09:31, calendario20octubre→`2026-10-20T09:31`, mínimo previo conserva días deshabilitados.
- Primer intento Chromium no llegó a página: bloqueo sandbox macOS MachPortRendezvous1100/SIGTRAP. Mismos casos ejecutados con escalación autorizada; sin defecto de producto ni PASS atribuido al intento bloqueado. Sin rechazo automático de aprobación.

Fixture efímera externa: `/private/tmp/checkpass-gastos-review/calendar-browser/{entry.tsx,calendar.config.ts,calendar.spec.ts}`. Reutiliza `startCatalogHarness`, UI/CSS reales y puertoOS efímero, sin stub de calendario; el helper dobla navegación Next, sin app Next, credenciales ni DB. Comando: `pnpm exec playwright test --config /private/tmp/checkpass-gastos-review/calendar-browser/calendar.config.ts`, desde este worktree y con Node24. Fixtures cerradas en afterAll, proceso finalizado EXIT0. Sin servidor propio pendiente. No capturas ni pulido adicional: tanda visual combinada pertenece a B/QA.

Sin backend/DB/env/guard/CSS/deps, push ni PROD. Entrega lista para combinación con B; no se afirma gate global ni verificación de la interfaz integrada.
