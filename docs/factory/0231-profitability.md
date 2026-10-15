# 0231 — Entrega del módulo Rentabilidad

Task `profitability-module-0231`. Base de entrega `b995a944bc89a339851cfd2124f751e39cc2b4c4` (fundación y core de A incorporados por el coordinador con refresh de reserva, incluidas0086/0087 corregidas). Worktree `/private/tmp/checkpass-0231/factory-0231-profitability`; rama `factory-0231-profitability`. El SHA del commit de entrega acompaña este documento en el mensaje al coordinador; QA independiente pendiente.

## Resultado

Backend del módulo `profitability`, sin dependencias de otros módulos ni pantallas. Un permiso Rentabilidad protege costos/sueldos, sin requerir `staff` o `locations`. Registrar fijos o sueldo total, corregir intervalos pasados, dar baja desde un mes, leer costos por local y total del comercio por moneda capturada. Asignaciones salariales persistidas por local, reparto entero exacto y residuo al primer UUID ordenado; COP/CLP/JPY/PYG sin fracciones.

El callback transaccional genérico toma la historia de locales de Equipo y redivide salarios existentes, incluso con módulo apagado. Conserva total, moneda, bajas y subidas futuras. No crea sueldo ni devuelve importes a Equipo. Lecturas puras sin materialización diferida. Orden de mutaciones: business KEY SHARE antes de persona/costos/locales para evitar inversión con el archivo de locales; sueldo siempre persona antes de costo. Foundation/esquema y lógica de identidad/acceso de A quedan fuera de esta entrega.

## Archivos y contratos

- `apps/merchant/src/modules/profitability/`: manifiesto, aritmética/intervalos, servidor, DTO y pruebas focales. API bajo `/api/modules/profitability`, ocho rutas de SPEC0231.
- Tres registros de módulos; UI `{screens:{}}` y tipo opcional `staffPanel` por `person.id`. Sin menú, acción visual o pantalla inexistente.
- Expectativas exactas del nuevo módulo/permiso en `registry.test.ts`, `permissions.test.ts`, `modules-dispatch.neon.integration.test.ts` y `modules-registry.neon.integration.test.ts`.
- Esta entrega. No se modifican esquema, journal, contratos core, guardias, tests de frontera, INDEX, TASKS ni estados.

Helpers core acordados: `lockStaffPerson` y `listStaffLocationTimeline`, meses internos `YYYY-MM-01`; rutas HTTP `YYYY-MM`. `StaffLocationsChange` se ejecuta bajo locks/transacción del writer core, incluyendo módulos apagados. Las pruebas del callback cubren el contrato registrado y, en `core-flow.neon.integration.test.ts`, el recorrido HTTP real de Equipo de A con cambios por gestor sin permiso monetario, módulo apagado y rollback sanitizado. QA independiente verificará la combinación congelada.

## Evidencia y límites

Node `24.20.0`, pnpm `11.4.0`, Vitest `4.0.18`. Lockfile SHA256 `a63b2a852e32abcd70ae19f57c8784524f56037d91447a42ca71ba08b7f0cce0`. Config CI seleccionada modo0600, SHA256 `95376e14e84df68576d6f93ef07bdf449454b419b201f5956c15f1877e45a938`. No se imprime ni copia el valor de credenciales. Esquema0086/0087 de la base de A, ya migrado por su wrapper; wrapper B volvió a comprobar pendientes antes de cada corrida.

- Tipos Merchant, lint focal y Prettier: PASS, incluyendo la suite de combinación nueva tras incorporar core A. `git diff --check` sin errores. Nuevos archivos bajo300líneas.
- Unitarios/registro/fronteras: siete archivos,48/48 PASS, sin skips. `arithmetic.test.ts`, `intervals.test.ts`, `registry.test.ts`, `permissions.test.ts` y tres suites de fronteras existentes, sin modificar guardias.
- DB primera corrida: `NEON_TEST_ENV_FILE=/private/tmp/checkpass-specs/ci-selected.env tools/neon-test.sh src/modules/profitability/{costs,access,salary,races}.neon.integration.test.ts src/modules/modules-registry.neon.integration.test.ts src/modules/modules-dispatch.neon.integration.test.ts --no-file-parallelism`: seis archivos,27/27 PASS, EXIT0, sin skips/reintentos;135.01s. Log restringido `/private/tmp/checkpass-0231-profitability-db.log` (0600). CRUD/corrección/stop, permiso HTTP real, tenant/FKlocal, archivo/carrera real, revisión concurrente, snapshot/buckets/moneda desconocida, callback OFF/idempotencia/rollback y conservación de subidas futuras.
- DB combinación por rutas reales: wrapper focal `src/modules/profitability/core-flow.neon.integration.test.ts --no-file-parallelism`:2/2 PASS, EXIT0, sin skips/reintentos;21.77s. Log `/private/tmp/checkpass-0231-profitability-core-flow.log` (0600). Gestor solo `staff` crea persona sin acceso y cambia sus locales con módulo apagado sin recibir dinero; operador solo Rentabilidad gestiona sueldo/total; callback conserva historia/aumentos y fallo interno revierte tanto selección core como asignaciones monetarias con error sanitizado.

Turno DB cedido explícitamente al coordinador tras EXIT0 de ambas corridas y teardown; ningún proceso DB, caffeinate o servidor propio pendiente. No se ejecutó DB local, push, PROD, build/verify global o promoción de ramas de integración desde B. El coordinador conserva la alineación del esquema local y el QA independiente por candidato. UI, Smart Menu, equilibrio/Dashboard, generales multilocal, comisiones y reparto manual siguen fuera de alcance.
