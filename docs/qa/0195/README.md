# QA UI 0195 — vencimiento en el wizard

2026-10-11. Alcance final confirmado por el owner: configurar vencimiento solo
al crear o editar el programa, en «Unidades» / «Sello y objetivo». Sin UI en la
inscripción, wallet, app del cliente ni vista del programa.

Capturas de Chromium a 390 px, revisadas visualmente:

- [Puntos claro](puntos-claro.png) y [puntos oscuro](puntos-oscuro.png).
- [Sellos claro](sellos-claro.png) y [sellos oscuro](sellos-oscuro.png).

El layout merchant conserva claro por defecto. Oscuro se inspeccionó forzando
`data-theme="dark"`; las superficies secundarias del kit/legacy conservan su
aspecto actual. Sin cambios de CSS, tokens ni kit.

Verificación Node 24.20.0, salida 0: typecheck de merchant y consumer, ESLint de
ambos paquetes y archivos e2e, Prettier de ambos paquetes, guardia UI y diffcheck.
E2E Chromium: 30/30 (10 del vencimiento y 20 regresiones existentes de estados,
validación y CSS). Fixture con componentes y CSS reales; rutas HTTP simuladas
mediante `page.route`; sin base de producción. Reporte local:
`/private/tmp/0195-report/index.html`.

Cobertura nueva: activar confirma y manda 6; alargar y apagar guardan directo;
acortar confirma; cancelar no guarda; `state_changed` relee y conserva el borrador;
403 deshabilita la escritura; creación aplica vencimiento por su ruta después de
activar; fallo parcial permite reintentar solo la regla sin duplicar el programa.
El PUT del formulario del programa no incluye vencimiento. Cuatro capturas de
configuración, sin overflow horizontal.
