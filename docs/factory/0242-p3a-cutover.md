# 0242 P3a — entrada compatible y bloqueo de escritores antiguos

Base: `4405da73c1f106a0c3e60fd3187b7e2f8e1d4375`, punto2 aceptado.
Spec0242 y contratos vigentes. Revisión nueva read-only `p3_cutover_review`
confirma que nueve constraints temporales siguen bloqueando masa y que todas
deben permanecer durante este corte. No habilitar mass ni retirar constraints.

## A — barrera HTTP

Autor nuevo; reserva continuada `pos-ui-card-0242` en WT homónimo limpio.
Scope nuevo: `apps/merchant/src/modules/pos/server/http.ts`, `routes.ts`,
`http.test.ts`, `legacy-retirement.test.ts` bajo el mismo directorio;
`apps/merchant/src/app/api/counter/resolve/route.ts`, `grant/route.ts`,
`redeem/route.ts`, `coupon-state/route.ts`, `coupon-remove/route.ts` y
`docs/factory/0242-p3a-http-handoff.md`.

POS: scope requerido en todas sus rutas y contrato2 obligatorio después del guard
y scope, antes de parsear cuerpo/dominio. Ausente/1/desconocido:
409 `pos_client_upgrade_required`, cero efectos. Eliminar dispatch HTTP a writers
V1; conservar dominio compartido legítimo y lectores históricos.
Counter: guard actual primero, luego410 `feature_retired`, sin parseo ni efectos,
sin redirigir POST. Preservar401/403 y no filtrar datos. Headers private/no-store.
Tests decisivos con spies de dominio/guard, incluyendo settings/payment/tablas.
Sin DB asignada a A en esta primera entrega; tipos/lint y pruebas puras focales.
Ampliación explícita antes de editar: `pos/server/pos-scope.neon.integration.test.ts`
para sustituir expectativas de scope opcional/cliente legacy por contrato requerido.
A prepara assertions, B/QA ejecuta después con reserva DB; sin relajar seguridad.

## B — entrada y accesos

Autor nuevo; reserva continuada `pos-ui-grid-0242` en WT homónimo limpio.
Scope nuevo: `apps/merchant/src/modules/pos/ui/pos-entry.tsx`, `pos-screen.tsx`;
`apps/merchant/src/server/staff-landing.ts`, `auth-guards.ts`,
`backoffice-destination.ts`, `backoffice-destination.test.ts`;
`apps/merchant/src/app/backoffice/page.tsx`, `counter/page.tsx`,
`analytics/page.tsx`; `apps/merchant/src/modules/start-page.ts`,
`start-page.test.ts`; `packages/db/drizzle/0107_pos_staff_cutover.sql`,
`packages/db/drizzle/meta/_journal.json`, `0107_snapshot.json` en ese meta;
`apps/merchant/src/modules/pos/server/staff-cutover.neon.integration.test.ts`;
`docs/factory/0242-p3a-access-handoff.md`.

MeasuredConsole es entrada normal, sin depender de query ni NODE_ENV. Resolver
fallback genérico autorizado por registro, sin nombres/rutas POS en core ni loops.
Counter GET redirige a entrada autorizada, conserva local solo activo del negocio;
Clientes sigue accesible con permiso counter, sin volver a ofrecer consola/canje.
No debilitar guard, cookies, PIN, email, billing ni activar módulos automáticamente.

Asignación explícita a B de migración aditiva de datos0107 y su journal/snapshot:
staff activo counter recibe pos solo si POS activo en ese mismo negocio; conserva
counter y los demás permisos. No cambiar owners, pendientes/inactivos ni excepciones
de POS apagado. Incluir inventario/preflight reproducible, sin ejecutar PROD.
Único writer de migración/journal en este corte. DB CI protegida reservada a B,
incluido teardown, exclusivamente mediante tools/neon-test.sh; sin otras suites DB
concurrentes. No copiar env productivo. Fixtures solo propias, limpiar por ownership.
Ampliación explícita antes de editar: `server/auth-guards.test.ts`, para verificar
fallback autorizado de requireOwner, Clientes para counter-only y ausencia de loop.

## Integración y continuación

Cada autor entrega commit propio limpio, evidencia y límites; QA independiente nuevo
sobre combinado congelado prueba clientes viejos sin efectos, acceso staff/Clientes,
POS apagado/revocado/tenant y ausencia de loop. No publicar ni avanzar mass antes
del gate. Reusar QA de cantidades/consumidores ya entregados. Si hacen falta paths
adicionales, ampliar reserva antes de editar. Kit/guardias/tooling fuera de scope.
Conservar servidor/túnel3201, cambios ajenos, WTs y commits históricos. Sin capturas,
push ni PROD. No borrar todavía componentes legacy con consumidores sin inventario.
