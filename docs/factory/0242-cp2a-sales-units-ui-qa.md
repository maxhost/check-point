# 0242 CP2a.4 — QA independiente de UI unidades

**Veredicto: PASS del alcance UI/interacción asignado.** Candidato congelado `12a6f5c87fbbd1e0a41f88393e7d7551099fe57c`, base aceptada `c822e40c`, entrega autor `5a29b739b1dae042eb695bc6ed0e65574e7d0e95`, código final `8b43bc38fc9d32972acaf44f8ad82342c3d4f14b`. QA independiente en rama/WT `pos-qa-0242`, `/private/tmp/checkpass-pos-0242/pos-qa-0242`, limpio y SHA confirmado antes de comprobar. Este commit añade únicamente este informe; no cambia producto, tests, kit ni guardias.

## Identidad y configuración

- Fecha: 2026-10-18. Darwin arm64, Node `24.20.0`, npm `11.19.0`, pnpm `11.4.0`; Playwright `1.63.0`, Chromium headless del entorno existente. Node24 seleccionado mediante `source ~/.nvm/nvm.sh && nvm use`.
- Lockfile SHA256 `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821`.
- Config propia `/private/tmp/cp0242-qa-independent/playwright.config.mjs`: testDir absoluto a **este WT** `/tests/e2e`, workers1, retries0, reporter list, outputDir propio, sin webServer global. No se reutilizó/modificó config del autor.
- Harness existente `catalog-harness-server.ts`: compila componentes/CSS/kit reales, navegación Next simulada y API interceptada por fixture; servidor propio `127.0.0.1` con puerto efímero, cerrado por teardown. Sin DB/env/auth reales.
- Chromium ejecutado con escalación acotada del runner propio por limitación macOS MachPort conocida. No se repitió el fallo de setup sandbox ya diagnosticado; ninguna aprobación automática rechazada.
- Stdout original y exit codes conservados en `/private/tmp/cp0242-qa-independent/{browser,focused,checks}.log`; configs, spec adicional y artefactos efímeros en ese mismo directorio. No contienen secretos.

## Comprobaciones reproducidas sobre el candidato final

| Comando | Resultado |
| --- | --- |
| `pnpm exec playwright test -c /private/tmp/cp0242-qa-independent/playwright.config.mjs business-negocio-settings.spec.ts business-negocio.spec.ts` | **20/20 PASS**, 9.5s, exit0, 0 retries/skips |
| `pnpm exec playwright test -c /private/tmp/cp0242-qa-independent/focused.config.mjs` | **1/1 PASS**, 1.1s, exit0, 0 retries/skips |
| `pnpm --filter @mi-pasaporte/merchant typecheck` | PASS, exit0 |
| `pnpm exec vitest run apps/merchant/src/app/backoffice/business/settings-drafts.test.ts` | **3/3 PASS**, exit0, sin skips |
| `pnpm exec eslint` sobre los nueve archivos TS/TSX cambiados desde base | PASS, exit0; lista exacta en checks.log |
| `pnpm exec prettier --check` sobre esos mismos nueve archivos | PASS, exit0 |
| `node tools/ui-guard.ts --base c822e40c` | PASS, 5 archivos sin aumentos, exit0 |
| `git diff --check` | PASS, exit0 |

El caso adicional es propio de QA y queda fuera del repo: enfoca el checkbox accesible `Gramo (g)`, pulsa Space, comprueba selección y lanza dos `form.requestSubmit()` sin espera entre ambos. Observa un solo PUT `{salesMassUnits:['kg','g'],revision:1}`, botón/checkbox deshabilitados durante la espera y confirmación posterior; no relaja tests existentes. La cobertura completa20 es reproducción nueva sobre **12a6f5c8**, no atribución de una corrida completa final al autor.

Warnings no funcionales: `NO_COLOR`/`FORCE_COLOR` de Playwright y `MODULE_TYPELESS_PACKAGE_JSON` de ui-guard. Ningún fallo de producto, retry, skip o timeout en las corridas QA. Una búsqueda exploratoria de archivo UI y consultas Git desde `/private/tmp` usaron rutas no aplicables; se corrigieron al WT, sin afectar resultados de comprobaciones.

## Aceptación e interacción

- Revisado contrato0242 §2, ficha, COPY, handoff y diff pertinente. Carga inicial con `Promise.all` de tres configuraciones y dos recursos de pagos; tres unidades kg/lb/g con nombres comprensibles, selección múltiple y mínimo una.
- Guardar unidades/regional/fiscal usa revisión compartida y conserva los otros borradores. Los casos comprueban payloads y secuencia de revisiones1→2→3→4 sin enviar branding ni reemplazar intención no guardada.
- Reconciliación por campo frente a baseline: adopta intactos remotos, retiene editados, muestra solapados local/remoto, conserva validación fiscal y exige acción explícita para guardar. El helper comprueba arrays por contenido y actualización de baseline. No se toma el máximo de revisiones mixtas.
- Conflicto409, lecturas incoherentes iniciales y durante consulta mantienen borradores/bloqueo hasta tres GET coherentes. El caso completo incluye el fix final: descarte explícito con revisión cruzada vuelve a bloquear guardados y permite recuperarse mediante consulta coherente.
- Lista vacía impide escritura; 422 muestra `fields.salesMassUnits` conservando selección editable; `unit_in_use` conserva intención y presenta nombres como texto seguro. La pertenencia de productos al negocio es responsabilidad del API aceptado; el fixture no prueba aislamiento de tenant.
- Resultado incierto de conexión0/500 no reintenta ni afirma guardado y exige consulta antes de reenvío.401/403 retiran las configuraciones. Doble submit probado en unidades por caso adicional y bloqueo de pagos en suite existente.
- Regresión regional/fiscal/moneda y medios de pago: tasa/validación IVA, fijo previo identificado, cambio concurrente de moneda con configuración explícita, payload parcial de comisión, alta/archivo, conflictos y respuestas tardías;20 casos PASS.

## Revisión visual, copy y accesibilidad acotada

Impeccable aplicado en modo Operate/incumbente/kit, sin repetir context/init ni modificar sus artefactos. Se abrieron juntas las capturas finales del autor ligadas al código8b43bc38, idéntico al código del candidato; no se inició otra ronda de pulido:

- `/private/tmp/cp0242-ui-visual-8b43bc38/business-negocio-Negocio-3-8feff-mas-payload-parcial-y-vista/business-390.png`
- `/private/tmp/cp0242-ui-visual-8b43bc38/business-negocio-Negocio-1-c0111-mas-payload-parcial-y-vista/business-1280.png`

Móvil390×900/escritorio1280×900: sección unidades coherente con tarjetas/jerarquía del kit, etiquetas y acciones legibles, sin recortes ni desbordamiento observados. Los dos casos visuales reproducidos en QA también comprueban ausencia de overflow horizontal y generan capturas en el outputDir propio.

Labels y roles de los tres CheckboxField comprobados por locators accesibles; foco/Space probado en Gramo; kit existente aporta min-h11 y estilo focus-visible. Alertas existentes usan alert/status. Copy visible en tuteo, mínimo una unidad explícito, acciones de consulta y descarte inequívocas, sin prometer activación de venta por peso. Sin defectos bloqueantes observados en este alcance. No equivale a una auditoría WCAG integral, prueba con lector de pantalla, contraste instrumental, dispositivo táctil físico ni matriz multibrowser.

## Límites y cierre

Esta evidencia certifica UI/interacción/contrato del harness. No certifica Next→guard→DB, auth/rol o tenant real ni repite los6 tests API/guard/DB ya aceptados. No se asignó entorno/fixture de smoke nativo, DB, wrapper ni controlM0; no se ejecutaron. Sin build global/fullverify/M0/M1, servidor3201, túnel, push ni operación PROD.

Sin hallazgos funcionales pendientes ni cambios solicitados al autor. Harness/navegadores propios cerrados; escaneo `lsof -a -d cwd -F pcn` desde `/private/tmp` registró **0 procesos** con cwd del WT/directorio temporal QA (`processes.log`). Sin procesos o artefactos ajenos manipulados. Entrega con commit único de informe y worktree limpio; factory accept/integración corresponden al coordinador.
