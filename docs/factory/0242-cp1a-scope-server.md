# 0242 — Ficha preparada CP1a scope de servidor

Estado: CP0/M0 aceptado con QA9ee475dc; código habilitado solo tras reserva explícita del coordinador. Nuevo implementador con contexto vacío. Entrega pequeña paralela a financial puro, sin cambios de esquema ni UI. La adopción del cliente/seed/cache será otro entregable con otro agente nuevo.

## Objetivo y contrato

Añadir política genérica `ModuleRoute.backofficeScope?: 'optional'|'required'` y adoptarla optional en todas las rutas POS actuales, preservando DTO/operación unit y clientes anteriores durante expand. Require guard completo vigente → comparación de intención → dominio. Ausente conserva contrato de rutas no adoptadas; optional valida toda cabecera presente, incluso vacía/malformed; required rechaza ausencia como mismatch. Cutover required/contratoPOSv2 pertenece a CP3, no a esta entrega.

Cabecera no es autoridad. Reutilizar contexto por Request y scopeHMAC ADR0154; no cookieCache/global cache, cambios de cookies/auth/pool, permisos ni if de módulo en core. Comparación intenciónA/cookieB devuelve409 backoffice_context_changed antes de ejecutar dominio, sin responder datos deB ni escritura. Guards de owner/staff/PIN/email/billing/módulo/local conservan precedencia/errores. Todas las respuestas de rutas adoptadas son private/no-store, también errores de acceso/scope/dominio. Reporter/auth exentos conservan su contrato.

Leer AGENTS/protocolos; spec0242 §4/anexo §3; ADR0154 y archivos scope/requestcontext pertinentes, sin históricos. Base/WT/recursos se fijarán después del gate; no heredar el contexto del agente M0. No subdelegar ni escribir estado/índices.

## Paths propuestos antes de reserva

- `apps/merchant/src/modules/route-table.ts`
- `apps/merchant/src/modules/dispatch.ts` (preservar diagnóstico genérico M0 ya aceptado)
- `apps/merchant/src/server/backoffice-scope-http.ts`
- `apps/merchant/src/modules/pos/server/http.ts` para declarar adopción en posRoute si cubre todas sus rutas
- `apps/merchant/src/modules/pos/server/routes.ts` y `payment-routes.ts` solo metadato donde el wrapper no lo cubra
- `apps/merchant/src/modules/dispatch.test.ts`
- `apps/merchant/src/modules/route-table.test.ts`
- `apps/merchant/src/server/backoffice-scope-http.test.ts`
- `apps/merchant/src/modules/pos/server/pos-scope.neon.integration.test.ts` nuevo
- `apps/merchant/src/modules/pos/server/pos-scope-integration-support.ts` nuevo si necesario
- `docs/factory/0242-cp1a-scope-server-handoff.md` propio

No tocar transporte/console/cache/printing UI, catálogo/business/Recetas/financial/events/kit/guardias/tooling/schema/migraciones/deps. Si hace falta un path adicional se solicita al coordinador antes de editar; registro y ficha son contrato de escritor, no permiso para tareas adyacentes.

## Aceptación y checks

Tests focales de metadato y dispatch: optional sin cabecera mantiene operación unit; optional con header vacío/malformed/ajeno rechaza antes del handler; required ausente/ajeno igual; válido permite; error401/403/404/conflicto/dominio mantiene código y private/no-store. Enumerar rutas POS reales (incluidos ticket/settings/pagos/mesas/resolve/coupon) y sus consumidores futuros; ninguna rama queda fuera por spread de paymentRoutes. Rutas no adoptadas conservan contrato.

Negativo real decisivo contra CI protegida: dos sesiones nativas legítimasA/B, intenciónA con cookieB en lectura y write controlados devuelve409 sin datosB ni efectos en ninguno; positivo mismasesión/negocio opera y rechazo de permiso previo no se convierte en scopeerror. Reutilizar fixtures protegidas existentes si compatibles, con IDs propios y teardown verificado. Toda DB exclusivamente tools/neon-test.sh, recursoCI reservado incluido teardown después de transferirlo de M0; no credencialesPROD. Financial paralelo no usa DB.

Node24; Vitest focal scope/dispatch/route-table y suiteCI propia, tipos merchant/domain pertinentes, lint/format/diff y boundaries de módulos por cambio de contrato/core. No verify global por ceremonia ni alterar guards para esconder rojo. Evidencia SHA/base/config/runtime/lock/schema/fixture, intentos fallidos/skips y límites; QA independiente nuevo sobre candidato congelado, reutilizando evidencia compatible. Entrega limpia y factory por coordinador; sin push/PROD ni cutover anticipado.
