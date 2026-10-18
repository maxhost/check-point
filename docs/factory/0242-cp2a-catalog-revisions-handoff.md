# 0242 CP2a.3 — catálogo atómico y revisiones comerciales

Base: `9b462a7aec57ff13028fa172c96676f864bf89b2`. Rama/WT: `catalog-revisions-0242`, `/private/tmp/checkpass-pos-0242/catalog-revisions-0242`. Runtime Node24.20.0/pnpm11.4.0, dependencias propias/lockfile sin cambios, sin env heredado.

Writers legacy conservan firmas/DTO/validación monetaria. Header y enlaces en una transacción; validación tenant/categoría/locales y relectura bloqueada dentro de ella. Mutex `business-config/<businessId>` antes producto/import; delete mismo orden. Nuevos productos unit/revisión1; actualización incrementa una vez por cambio comercial real, comparando decimales sin floating point y conjuntos normalizados. Imagen/categoría/no-op no invalidan. Import estrictamente aditivo conserva relectura/accepted/replay/recuperación de categorías y limpieza aftercommit. Metadatos no se editan en update.

Preparación de imagen/proveedor/R2 fuera de tx; al releer se compara key/version observados, conflicto409 limpia solo prefijo preparado propio. Después de commit se limpia el prefijo anterior; esa limpieza no revierte el nuevo asset.

Test nuevo: create1; cambios comerciales/no-op/decimales padded/orden+duplicados/case locales; concurrencia de updates y enlaces; tenant/categoría/local ajenos; guard import abierto; rollback real de update/create posterior a header por trigger temporal; conflicto de imágenes con efectos R2 sustituidos; import concurrente accepted/replay, nuevos unit1 y reutilizados/omitidos intactos. Mass continúa bloqueado por0105. El trigger y función usan nombres UUID, esquema propio y filtro locationId+businessId de fixture exclusiva; autorización explícita root recibida antes de escribir DDL. `finally` y `afterAll` retiran DDL; teardown elimina negocios/owners.

## Verificación offline previa a CI

- Tipos domain/db/merchant: PASS (merchant repetido tras última edición de test).
- ESLint cuatro archivos TypeScript propios y Prettier: PASS; diff whitespace PASS.
- Puros catálogo/import-plan/import-price: 47PASS. Carga offline de suites revisions/import-guard:12SKIP esperados, sin evidencia DB.
- app-boundary/ui-guard-rules:23PASS; ui-guard74archivos sin aumentos.
- modules-boundary/literals:18PASS/1FAIL por los cinco archivos core de backlog declarados, sin nuevos offenders; pendiente entre-módulos para completar comparación de guardias.

CI aún no ejecutada en este commit. Root transfirió reserva exclusiva; selección propia únicamente por `tools/neon-test.sh --no-file-parallelism` y `/private/tmp/checkpass-pos-0242/private/ci.env`. Se compartirá SHA congelado antes de ejecutar. No afirmar PASS DB por skips. Sin publicación/push/PROD ni certificación de HTTPv2, mass, hooks/composición/publicación o carrera de inicio de import no asignada.
