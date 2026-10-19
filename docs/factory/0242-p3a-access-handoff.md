# 0242 P3a B — entrada y accesos

Base `7feef6cc04312ec039a05b19d7fcb0c424742c95`, ref `pos-ui-grid-0242`,
WT `/private/tmp/checkpass-pos-0242/pos-ui-grid-0242`.
Código probado: `3db6d7171c121aa53825d03e0c201a67aefbbacf`.
Contrato: `0242-p3a-cutover.md`, B; ampliaciones autorizadas por coordinador para
`auth-guards.test.ts` y `locations-backoffice-pages.neon.integration.test.ts`.

## Comportamiento y archivos

- `PosEntry`/`PosScreen`: MeasuredConsole siempre, sin preview ni NODE_ENV.
  Query `location` se valida contra los locales activos entregados por servidor;
  copia con el elegido primero, sin mutar lista. MeasuredConsole inicializa
  `listLocationId` y MeasuredOrderList inicializa su filtro desde `locations[0]`;
  nueva orden usa ese filtro y el selector de local existente.
- `start-page.ts`: fallback por startPage y luego navegación autorizada del registro.
  Regla de ingreso staff single/multipermiso permanece: migrado counter+pos sigue
  entrando al panel; si carece analytics, panel resuelve fallback autorizado.
- `backoffice-destination.ts`, panel, analytics y requireOwner: salida autorizada,
  sin literales de módulos en core; sin permiso efectivo, notFound sin redirects.
- Counter GET: guard original primero, luego redirect autorizado; preserva local
  solo activo del mismo negocio. No requiere counter para seguir una URL antigua
  con permiso de módulo. No renderiza CounterConsole ni consulta acreditaciones.
  Clientes sigue usando counter y su pantalla/guard no cambian.
- `0107_pos_staff_cutover.sql` y journal/snapshot: solo append de pos donde role
  staff, status active, counter presente, pos ausente y módulo pos enabled en el
  mismo negocio. Conserva permisos/orden; owners, disabled, sin counter, POS off
  y sin fila de activación intactos. No DDL ni cambio de los nueve barriers mass.

## Evidencia del autor

Entorno Node24.20.0, pnpm11.4.0; blob lockfile
`abcbe3dcc0f110f6c2e5395da4360c32ca7ccf44`. Checks sobre el contenido exacto del
commit de código; este handoff añade documentación únicamente.

- `pnpm --filter @mi-pasaporte/merchant exec vitest run src/server/backoffice-destination.test.ts src/server/auth-guards.test.ts src/modules/start-page.test.ts src/app/backoffice/layout-guard.test.ts src/modules/modules-boundary.test.ts`:
  **46/46 PASS**, cinco archivos, cero skips.
- `pnpm --filter @mi-pasaporte/merchant typecheck`: EXIT0.
- ESLint de todos los TS/TSX cambiados y nuevos: EXIT0.
- Prettier de TS/TSX/json cambiados y nuevos: EXIT0; `git diff --check`: EXIT0.
- `node tools/ui-guard.ts --base 7feef6cc`: seis archivos, sin aumentos.
- Solo wrapper `tools/neon-test.sh`, con
  `NEON_TEST_ENV_FILE=/Users/maxi/Documents/claude-workspace/check-point/apps/merchant/.env.local`.
  Antes de conectar se comprobó presencia de CI pooled/direct y huella distinta
  de PROD; wrapper repitió interlock, sin imprimir credenciales. No copié env.
  CI migrada hasta0107; DB exclusiva, suites seriales y teardown terminado.
- Wrapper `src/modules/pos/server/staff-cutover.neon.integration.test.ts --no-file-parallelism`:
  **1/1 PASS**, cero skips. Tres negocios, siete usuarios, ocho membresías,
  rollback transaccional completo. Prueba SQL real dos veces, preservación de
  permisos extra/owner/disabled/POSoff/sin módulo y aislamiento entre dos negocios
  con mismo usuario. Primera ejecución falló setup DATABASE_URL ausente; se
  corrigió enlazando solo NEON_INTEGRATION_DATABASE_URL bajo ISOLATED=true.
- Wrapper `src/server/locations-backoffice-pages.neon.integration.test.ts --no-file-parallelism`:
  **3/3 PASS**, cero skips; local activo, archivado, ajeno, sin query, staff solo
  módulo y staff solo counter; cleanup del negocio propio completado. El test
  histórico de tile requirió aislar billing de presentación y widgets cliente
  (headers fuera request / BackofficeProvider ausente); la selección de locales
  y módulos sigue usando DB real. No certifica widgets ni billing con esos dobles.

## Límite heredado y siguiente QA

`modules-boundary-literals.test.ts`: **8/9 PASS, 1 FAIL** por cinco archivos ajenos,
sin diff frente base: backoffice-context-controller.test.ts (3 literales),
backoffice-context-refresh.test.ts (1), checklist-context-resource.test.ts (1),
analytics/evaluation/policy-simulation.test.ts (2), analytics/lifecycle/index.ts (1).
Ningún hallazgo está en archivos de B. No modifiqué guardias para ocultarlo.
No hay PASS global ni QA de combinación; coordinador debe gestionar ese rojo.

No browser/capturas, push, PROD, cambios visuales, servidor3201/túnel ni tooling.
DB liberada al coordinador tras el último teardown EXIT0; sin procesos propios.
QA combinado debe validar HTTPnuevo de A junto con esta entrega, acceso revocado,
tenant, Clientes y ausencia de loop. Este autor no ejecutó suites A sobre fuente
sin su cambio ni inventario de producción.

## Inventario/preflight reproducible antes de despliegue autorizado

Consultas de lectura; no ejecutadas en PROD. La migración de CI se aplicó antes
de sembrar los fixtures. Los resultados CI no demuestran inventario PROD. Antes
de migrar PROD, owner debe autorizar ese caso y resolver explícitamente negocios
con POS apagado o membresías ambiguas; no activar módulos automáticamente.
El esquema vigente solo admite active/disabled para membresías (no sembrar pending).

```sql
-- Inventario por negocio, incluyendo excepciones sin activación.
SELECT b.id, b.status AS business_status,
       COALESCE(m.enabled, false) AS pos_enabled,
       count(*) FILTER (WHERE p.role = 'staff' AND p.status = 'active'
         AND 'counter' = ANY(p.permissions)) AS active_counter_staff,
       count(*) FILTER (WHERE p.role = 'staff' AND p.status = 'active'
         AND 'counter' = ANY(p.permissions)
         AND NOT ('pos' = ANY(p.permissions))) AS missing_pos,
       count(*) FILTER (WHERE p.role = 'staff' AND p.status <> 'active'
         AND 'counter' = ANY(p.permissions)) AS inactive_counter_staff
FROM core.business b
JOIN core.business_membership p ON p.business_id = b.id
LEFT JOIN core.business_module m ON m.business_id = b.id AND m.module_id = 'pos'
GROUP BY b.id, b.status, m.enabled
HAVING count(*) FILTER (WHERE p.role = 'staff'
  AND 'counter' = ANY(p.permissions)) > 0
ORDER BY b.id;

-- Detalle relevante para resolver excepciones y comparar antes/después.
SELECT p.business_id, p.user_id, p.role, p.status, p.pin_must_change,
       p.permissions, COALESCE(m.enabled, false) AS pos_enabled,
       (SELECT count(*) FROM core.business_membership other
        WHERE other.user_id = p.user_id) AS memberships_for_user
FROM core.business_membership p
LEFT JOIN core.business_module m ON m.business_id = p.business_id AND m.module_id = 'pos'
WHERE p.role = 'staff' AND 'counter' = ANY(p.permissions)
ORDER BY p.business_id, p.user_id;
```

Guardar inventario/entorno y comparación por business_id/user_id antes y después:
solo las filas elegibles adquieren un pos; cardinalidad del resto intacta. Conservar
owners/inactivos y activaciones en snapshot de despliegue. Las consultas no
sustituyen la autorización individual de operación PROD.
