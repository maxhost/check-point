# 0242 CP2a.4 — UI de unidades y reconciliación

Candidato de código: `8b43bc38fc9d32972acaf44f8ad82342c3d4f14b`, sobre base API aceptada `8b73fe4edf6f35e0db47b75a6fbaf021c6e78fe4`. Rama/WT propios `sales-units-ui-0242`, `/private/tmp/checkpass-pos-0242/sales-units-ui-0242`. Commit previo de implementación `57efe398`; el segundo añade bloqueo tras consulta incoherente desde descarte explícito. Este handoff agrega solo documentación.

## Resultado y paths

Tres GET de configuración en paralelo con los dos GET de medios de pago. Tercera sección con CheckboxField kg/lb/g y validación de al menos una unidad. Guardar cualquiera conserva los otros borradores y avanza sus revisiones. Recuperación explícita consulta tres revisiones coherentes, conserva edición por campo frente a baseline y adopta campos intactos; muestra valores locales/remotos en solapados, permite revisar/editar/guardar y ofrece descarte inequívoco. Validación fiscal sigue vigente. Red/5xx bloquean reenvío hasta consulta; 401/403 retiran acceso; 422 y unit_in_use conservan selección y muestran metadatos seguros tipados.

Archivos: business-console.tsx, business-settings.tsx, business-api.ts y nuevos sales-units-fields.tsx, settings-drafts.ts/settings-drafts.test.ts en `apps/merchant/src/app/backoffice/business/`; business-negocio-settings.spec.ts, business-negocio.spec.ts y support/business-negocio-fixture.ts en tests/e2e. Sin otros paths de producto. Fixture usa cinco GET y una revisión compartida; PUT obsoleto devuelve409. Se actualiza expectativa antigua de descarte forzado porque el contrato0242 exige preservar intención al reconciliar.

## Evidencia

Runtime macOS arm64, Node24.20.0/npm11.19.0/pnpm11.4.0, Chromium headless shell1243/Playwright1.63.0. Dependencias propias del WT, sin instalaciones/cambios de lockfile. SHA256 pnpm-lock.yaml `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821`.

- `pnpm --filter @mi-pasaporte/merchant typecheck`: PASS; repetido tras fix8b43bc38.
- ESLint y Prettier sobre los nueve archivos cambiados: PASS; archivos del fix nuevamente lint/formateados. `git diff --check`: PASS.
- `node tools/ui-guard.ts --base 8b73fe4edf6f35e0db47b75a6fbaf021c6e78fe4`: PASS5 archivos sin aumentos, también tras fix. Warning Node sobre package type preexistente, sin cambiar tooling.
- `pnpm exec vitest run apps/merchant/src/app/backoffice/business/settings-drafts.test.ts`: PASS3/3 sobre código57efe398 (helper idéntico en8b43bc38). Cubre campos intactos/editados/solapados/igualdad por contenido de arrays y rechazo de máximo entre revisiones mixtas.
- `pnpm exec playwright test -c /private/tmp/cp0242-playwright.config.mjs business-negocio-settings.spec.ts business-negocio.spec.ts`: PASS20/20,0 retries/skips,8.5s sobre código57efe398. Incluye regresión medios/dinero/moneda/fiscal, las tres secciones y revisiones, selección vacía/422/unit_in_use, conflictos/revisiones cruzadas y adopción de campos intactos, resultado incierto0/500 sin reenvío,401/403 y doble submit bloqueado.
- Tras fix8b43bc38: mismo runner `business-negocio-settings.spec.ts -g 'conflicto conserva editados'`: PASS1/1,1.6s. Añade caso de descarte explícito con lecturas cruzadas y recuperación posterior. Evidencia restante reutilizada porque no cambia otra rama de comportamiento.
- Confirmación sobre SHA8b43bc38: `business-negocio.spec.ts -g 'Negocio (390|1280)' --output /private/tmp/cp0242-ui-visual-8b43bc38`: PASS2/2,1.5s. Capturas fullPage abiertas juntas con view_image; móvil390×900/escritorio1280×900, sin overflow horizontal ni defectos observados en unidades. Una ronda agrupada y una confirmación máxima; sin cambios visuales entre ambas.

Config efímera `/private/tmp/cp0242-playwright.config.mjs`: testDir absoluto al WT/tests/e2e, workers1,retries0,reporter list; sin webServer global. Harness existente compila UI real/CSS/kit y usa servidor127.0.0.1 con puerto efímero propio, rutas API controladas por fixture. Config no requiere DB/env/auth reales.

Capturas persistentes (código8b43bc38):

- `/private/tmp/cp0242-ui-visual-8b43bc38/business-negocio-Negocio-3-8feff-mas-payload-parcial-y-vista/business-390.png`
- `/private/tmp/cp0242-ui-visual-8b43bc38/business-negocio-Negocio-1-c0111-mas-payload-parcial-y-vista/business-1280.png`

## Fallos previos, límites y entrega

Primer intento browser sandbox:20 casos no iniciados por Chromium MachPortRendezvousServer Permission denied1100; setup, sin señal funcional. Se repitió con escalación acotada del proceso propio. Primer intento funcional detuvo corrida tras timeout de locator.check contra input oculto del CheckboxField: se cambió la interacción a click del label visible conservando aserciones del checkbox, sin force ni relax. Corrida20 completa posterior PASS. Git add inicialmente bloqueado por index.lock Operation not permitted; commits propios logrados con escalación acotada, sin bypass de hooks ni refs principales. Ningún rechazo de auto-review.

El harness certifica interacción y contrato; NO prueba Next→guard→DB, tenant real ni fixtures nativos. No se ejecutó smoke nativo: no se asignó entorno/auth/fixture de aplicación compatible; DB CI reservada exclusivamente al autor catálogo, no utilizada por este worker. API/guard/DB son evidencia del bloque API aceptado, no recertificación aquí. Sin tests DB/migraciones, build global, fullverify, push ni PROD. No activa catálogo por peso ni POS mass.

Sin fallos funcionales pendientes conocidos. Servidores/harness/navegador propios cerrados al terminar; lsof de cwd ejecutado desde /private/tmp sin procesos en el WT. Worktree de código limpio antes de este handoff; se conserva para fixes hasta aceptación. Factory deliver/QA/aceptación corresponde al coordinador; QA independiente y de combinación aún pendientes.
