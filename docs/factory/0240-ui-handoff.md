# 0240 UI — entrega stock-cost-ui-0240

Base: `ac5fedf860df80af74f33a482a714cf5293631b2`. Rama/worktree: `stock-cost-ui-0240`, `/private/tmp/checkpass-stock-cost-0240/stock-cost-ui-0240`. Revisión: el commit que contiene este handoff (SHA exacto en factory deliver).

Tarjeta Stock conserva valoración conocida/total/pendiente y el resumen agregado, ahora identificado como «Resumen del conjunto de insumos». Añade selector de pares insumo/local del snapshot `StockCostHistory`, preserva selección por ID al recargar filtros y usa el default del contrato cuando desaparece. Cambiar insumo sólo modifica estado React. No SQL/HTTP/dependencias/CSS nuevos. Contrato compartido sólo leído; GET real se conecta con la entrega A, no se importó su implementación.

Nuevo `LineChart` autorizado en kit: segmentos rectos, posición temporal real, plano/cero válidos, ningún gráfico para un registro, SVG title/desc, extremos de costo/unidad y fechas visibles. `Ver registros (n)` abre lista completa para teclado/touch con fecha original y baseline señalado. `amountMinor` decimal string se formatea por desplazamiento textual + BigInt, sin redondear subcentavos; sólo geometría usa Number finito validado y rechaza underflow. Unidad `unit` se presenta como «unidad».

Paths: analytics-console.tsx, stock-cost-card.tsx, stock-cost-format.ts y test; ui/line-chart.tsx y test, ui/index.ts; tests/e2e/stock-cost.spec.ts y support/stock-cost-fixture.ts; este handoff. Todos dentro de reserva.

Evidencia externa: `/private/tmp/checkpass-0240-evidence/ui/`. Runtime Node24.20.0, pnpm11.4.0, lockfile de base sin cambios. Sin DB ni PROD. Harness de componentes con ReactAria/kit/CSS real, red simulada; no sustituye smoke GET real combinado.

Checks:

- `pnpm exec vitest run apps/merchant/src/app/backoffice/analytics/stock-cost-format.test.ts apps/merchant/src/ui/line-chart.test.ts`: 2 archivos/4 tests PASS (`unit.log`). Exactitud subcentavo, importes mayores que Number, cero/ausentes/underflow; tiempo desigual/rectas/plano/registro único.
- `pnpm --filter @mi-pasaporte/merchant typecheck:ui` y `typecheck`: PASS (`types-ui.log`, `types-merchant.log`).
- ESLint focal: PASS (`lint-final.log`).
- `node tools/ui-guard.ts --base ac5fedf860df80af74f33a482a714cf5293631b2`: PASS, 3 archivos sin aumentos (`guard-final.log`).
- `pnpm exec playwright test --config tests/e2e/support/stock-cost-fixture.ts --output /private/tmp/checkpass-0240-evidence/ui/browser-final`: 3/3 PASS, retries0/skips0 (`browser-final.log`). Viewports390/1440, selección con teclado sin GET, lectura completa con Enter, baseline, precisión, plano cero, preservación/remoción con filtros, un registro, vacío, valoración incompleta y ausencia de overflow. Capturas `stock-390.png`, `stock-1440.png`.
- Impeccable context una vez; contexto estrecho incumbent de merchant. Detector focal devuelve `[]`. Diff sin whitespace errors.

Fallos preservados: sandbox Chromium no arrancó por MachPortRendezvous permission denied (artefactos `browser-sandbox-failure`); escalación técnica permitió harness local. Primera corrida escalada detectó selector de test demasiado estricto para Local (`browser-escalated.log`); corregido sin relajar aserciones de producto. Confirmación detectó overflow real por min-content de etiqueta larga (`browser-confirmation.log`, `browser-layout.log`); corregido con min-w-0 + grid-cols-1 en SelectField, sin tocar kit compartido fuera de reserva. Browser-final es la comprobación final PASS, no un retry automático. También se eliminó importsinuso detectado por lint. No se afirma verifyglobal/M1/DB/QAcombinación.

Sin procesos propios pendientes tras cierre de harness. Siguiente: QA independiente y smoke sobre combinación A+B por coordinador. Sin push/PROD ni cambios de índices/estado.
