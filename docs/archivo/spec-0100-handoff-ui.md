## Handoff — Spec 0100

Estado: implementado; pendiente QA live del owner. No se marca la spec implementada desde este handoff.

Compilación final del orquestador (código posterior a los ajustes): `pnpm run
typecheck` — exit 0, tres apps (dos en caché); `pnpm run build` — Consumer/Platform
válidos en caché y Merchant bloqueado por EPERM de Turbopack al abrir proceso/puerto,
también tras retry autorizado fuera del sandbox. Alternativa `pnpm --filter
@mi-pasaporte/merchant exec next build --webpack` — exit 0, TypeScript y 33 páginas
generadas. Logs: `/tmp/spec0100/typecheck.log`, `build.log`, `build-escalated.log`,
`build-webpack-final.log`. [Revisión independiente estática](spec-0100-revision-ui.md):
PASS acotado; sin evidencia funcional de navegador ni producción.

Publicación: commit `78ec592` en `main`, push a `origin/main` confirmado el 2026-09-26.
Deploy no inspeccionado; siguiente paso QA live del owner.

Archivos tocados:

- Loyalty: `loyalty-tour-context.tsx`, `loyalty-tour-controller.tsx`, `loyalty-tour-definitions.ts`, `loyalty-tour-focus.ts`, `loyalty-tour-state.ts`, `loyalty-tour-step.ts`.
- `loyalty-page.tsx`, `program-editor.tsx`, `program-view.tsx`, `program-closing.tsx`, `loyalty-confirm-dialog.tsx`, `use-loyalty-program.ts`, `steps/step-terms.tsx`, `steps/step-rewards.tsx`.
- `onboarding/onboarding-view.ts`, `onboarding/onboarding-view.test.ts`, `globals.css`.
- Casos nuevos: `tests/e2e/loyalty-tours.spec.ts`, `loyalty-tour-help.spec.ts`, `loyalty-tour-errors.spec.ts`.

Comandos ejecutados y resultado:

- `source ~/.nvm/nvm.sh && nvm use && pnpm exec tsc --noEmit -p apps/merchant/tsconfig.json` — exit 0 antes de los últimos ajustes de intención/foco/anchors. La compilación final monorepo queda a cargo del orquestador.
- Prettier sobre los archivos modificados de código y los tres tests nuevos — salida final exit 0. Una pasada intermedia detectó un cierre JSX faltante durante la ampliación de rules; se corrigió y se formateó correctamente después.
- `pnpm exec playwright test --config=/tmp/spec0100-implementation-playwright.config.ts --grep 'onboarding guardado completed|crear acompaña|políticas conserva|cierre espera|guardar rejected|GET fallido'` — la selección incluyó accidentalmente un caso de Marca además de seis Loyalty; los siete fallaron antes de ejecutar sus cuerpos, al lanzar Chromium: `bootstrap_check_in … Permission denied (1100)` / SIGTRAP. Esto no es evidencia funcional de PASS ni FAIL del producto.
- Retry escalado con rutas explícitas de los tres tests Loyalty — solicitud abortada por usuario, sin resultado de ejecución.

Cambio de verificación solicitado por owner durante implementación:

> «no es necesario que corras las pruebas más allá de asegurarte de que compila bien todo, lo comiteas haces el push y lo veo en live cuando esté listo».

Por esa instrucción se detuvieron pruebas automatizadas y no se ejecutaron mutaciones M1–M4. Los casos nuevos quedan escritos para una futura ejecución. No se ejecutaron suites unitarias nuevas, revisión visual, dispositivos reales ni producción. El orquestador realiza compilación, commit y push.

DoD por implementación y límites de evidencia:

- [x] Destino program compartido `/backoffice/loyalty?tour=onboarding`; parser consume únicamente `tour` tras contexto válido y montaje, conserva otros parámetros.
- [x] Orientación general de cinco pasos por estado, incluida variante editor sin navegación; owner onboarding persiste completed/skipped, Ayuda utiliza `persist: false`, staff no dispara entrada onboarding.
- [x] Ayuda presenta orientación y cuatro tareas, disponibilidad y razones. Cierre sólo owner. Inicio bloqueado durante escritura, carga/error GET, recorte/preparación, recuperación de acceso y cierre/confirmación.
- [x] Un editor conserva borrador. Políticas solicita Términos y consume su intención sin populate/reset; sigue canje sin saldo y Revisión. Navegación y escritura siguen controles reales y validación existente.
- [x] Writer conserva guards y flujo único; emite resultado estructurado con attemptId. La guía sólo anuncia confirmado con DTO válido y GET válido; refresh fallido dirige a GET. Rechazo/resultado incierto conservan fase y Alert. Instancia y frontera de intento excluyen resultados anteriores.
- [x] Anchors locales, scoped CSS para formularios/portales, Escape de guía sin descartar editor, retorno de foco diferido. Popover operativo entra en el diálogo activo para compartir alcance de foco/accesibilidad.
- [ ] Comportamiento de navegador, teclado/foco/recorte/diálogos y composición responsive 320/390/768/1280 light/dark/reduced motion: pendiente QA live; no se declara verificado por compilación.
- [ ] Oráculos completos de ambas modalidades y mutaciones: pendientes por cambio explícito del owner. Tests nuevos cubren orientación, creación Puntos, políticas Sellos con términos/premio/diseño, cierre, rechazo/JSON inválido y refresh; no se han ejecutado funcionalmente.

Hallazgos/límites:

- Motor compartido de tours sin cambios; no backend/schema ni nuevos endpoints.
- `use-loyalty-program.ts` supera el límite recomendado de tamaño del hook local; se conservó el único flujo operativo en este archivo. Controller nuevo dividido con helper de fase para mantenerlo debajo de 300 líneas.
- `next-env.d.ts` preservado. TASKS contiene cambios ajenos a este implementador; no se tocaron.
- Revisión independiente estática y compilación final corresponden al orquestador/revisor; este handoff no reemplaza sus evidencias.
