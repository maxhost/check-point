# 0239 — Dashboard compacto y resumen

Task/ref `dashboard-0239`; base `a8b2195fc359a9da6a003a36c4b7b262f3360da7`. Producto `5d7d601fe2271e8b8a6080525c6c9bc227b02caa`; corrección final de IDs/contratos browser `db390dddef684ee023bad576afd761e3c8772428`. El commit posterior que contiene este handoff sólo añade evidencia documental. Worktree `/private/tmp/checkpass-dashboard-0239/dashboard-0239`. Node24.20.0, pnpm del repositorio, Chromium Playwright local; harness con HTTP simulado, no Next real ni DB.

Inbox ahora usa filas con separadores, dos líneas móviles/una desktop, todas cerradas, una expandida, teclado y decisiones originales dentro del panel. `useId` distingue paneles y encabezados por instancia. Cinco avisos sintéticos ocupan aproximadamente345px móviles/225px desktop. Kit, CSS, owner de solicitudes, InboxHTTP/lifecycle/POST y fórmulas existentes intactos.

Resumen hermano de Inbox sólo en Dashboard. `GET /api/analytics/summary` privado/no-store: permisoanalytics mediante la misma escalera SinGateDeEmail de Analíticas; scope después de gates y antes del dominio. Una sola `readInput` produce mensual con `calculateGoal`, promedio calendario con ceil exacto y ventas netas del día local. Parser/contrato browser separados del builder financiero para no arrastrar policy/node:crypto al cliente. Valores desconocidos siguen null, cero de ventas sigue cero. Sin historial/día auxiliares, seedSSR, caché o infraestructura nueva.

Quinto recurso en el mismo owner/contexto: montaje/remontaje observado, foco/online agrupados y refresco explícito. Relectura preserva dato anterior indicando actualización/error; 401/scope409 retiran todos los privados,402/403 limpian sólo el recurso. Constructor/suscriptor ausente no leen. `readAt` describe lectura de proyecciones, no recepción de todos los eventos. No existe señal browser de proyección de venta aplicada; no se promete push remoto ni sincronía con cobro.

## Evidencia y reproducción focal

Desde el worktree y con `source ~/.nvm/nvm.sh && nvm use` antes de cada grupo:

```sh
pnpm exec vitest run apps/merchant/src/server/analytics/summary.test.ts apps/merchant/src/app/api/analytics/summary/route.test.ts apps/merchant/src/app/backoffice/analytics/summary-context-resource.test.ts apps/merchant/src/app/backoffice/backoffice-context-controller.test.ts apps/merchant/src/app/backoffice/backoffice-context-state.test.ts apps/merchant/src/app/backoffice/backoffice-request-owner.test.ts apps/merchant/src/app/backoffice/analytics/inbox-context-resource.test.ts apps/merchant/src/app/backoffice/onboarding/checklist-context-resource.test.ts apps/merchant/src/app/backoffice/onboarding/onboarding-tour-persistence.test.ts apps/merchant/src/app/backoffice/settings/module-toggle-intent.test.ts
pnpm exec vitest run --config /private/tmp/checkpass239-domain.vitest.mjs
pnpm exec playwright test --config tests/e2e/support/analytics-lifecycle-fixture.ts --workers=1
pnpm exec playwright test --config /private/tmp/checkpass239-browser.config.ts --grep 'summary numbers|dos lectores comparten|POST Inbox scoped|scope409 de decisión|fallo ambiguo|Inbox restringido' --workers=1
pnpm --filter @mi-pasaporte/merchant exec tsc --noEmit
pnpm --filter @mi-pasaporte/domain exec tsc --noEmit
node tools/ui-guard.ts --base a8b2195fc359a9da6a003a36c4b7b262f3360da7
git diff --check
```

- Unitmerchant:157/157 en10archivos, sin skips/retries. Dominio:11/11, con config temporal explícita porque el Vitest raíz no incluye packages/domain. Config: `export default {test:{include:['packages/domain/src/analytics/dashboard-summary.test.ts']}};`.
- Browserlifecycle final sobre producto5d7d:16/16,9.4s, sin retries. Incluye resumen lento/fallido/stale/refresh/focus y lista/teclado/decisiones/recordatorios/conflictos. Las únicas diferencias posteriores son IDs por instancia y adaptación de los tests de contexto al disclosure.
- Browsercontext directo: resumen1/1 sobre5d7d, constata1GETsummary+1Inbox y0GETsession/modules al montar, más retiro de números. Sobre correccióndb390:4/4StrictMode/doslectores+IDsúnicos+POST/cola+reintentoambiguo+restricción; y1/1scope409dedecisión. Los conteos/idempotencia originales se conservan.
- Tipos merchant/domain PASS. ESLint de los24archivosTS/TSX cambiados PASS, y focal posterior Inbox/contextbrowser PASS. UIguardbasea8:7archivos sin aumentos. DetectorImpeccable de Inbox/resumen/page: `[]`. Diff-check PASS.
- Coordinador reprodujo independientemente HTTP+resource+server14/14 sobre5d7d; reutilizable porque corrección posterior toca sólo Inbox/browser.
- Capturas390/1280 guardadas, abiertas e inspeccionadas. Ninguna campañaM1/120recargas, DB, buildglobal o certificación de rendimiento nueva.

Config browser temporal usa `testDir` absoluto al worktree, `testMatch:['backoffice-context.spec.ts']`, workers1,retries0,Chromiumheadless; no levanta apps. Ambas configs se preservan junto a evidencia privada en `/private/tmp/checkpass-0239-evidence/`; al reproducir en otro checkout ajustar sólo testDir. Capturas `dashboard-390.png` y `dashboard-1280.png` fuera del worktree antes de cleanup. Las capturas muestran fixtures sintéticos, nunca sesiones o importes privados del owner.

## Incidencias y límites

Primer browser no ejecutó casos: sandbox impidió Chromium MachPortRendezvous (`Permission denied1100`,SIGTRAP). Reejecución técnica autorizada fuera del sandbox permitió trabajar. Git local también necesitó escalación para index.lock del worktree; no hubo bypass de hooks.

En desarrollo fallaron oráculos nuevos de formato monetario ($456.00 frente al formato existente $456,00), selector de disclosure que incluía navegación, referencias locales del test y conteo inicial sobre harness que hace bootstrapHTTP explícito. Se corrigieron acotando al componente/fixture adecuado; la aserción cero auxiliares vive en el harness de contexto directo. Se detectó además overflow móvil real por ancho mínimo de grid implícito; corregido con grid-cols-1/min-w-0, manteniendo comprobación de cajas y densidad. No se ocultaron fallos con skips/retries ni se relajaron conteos/idempotencia.

Sin procesos propios pendientes: cada harness cerró su servidor. Ningún acceso a app3201/túnel/DB/PROD, push, kit/guard, dependencias, índices o estados. Devdemo real e integración quedan al coordinador. Frescura eventual, QAmanual pendiente, CI/guardias históricas y FAILfrío1817.621042ms siguen sin nueva certificación. Rollback conjunto sin DDL.
