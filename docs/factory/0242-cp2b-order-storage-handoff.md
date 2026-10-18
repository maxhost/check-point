# 0242 CP2b.1 — entrega de expansión de intención/tipo

Base: `b617c86b4c5cabf3b65a7538714b80ecc3cf118c`. Implementación congelada y verificada: `3b3cef73f52b31633deb3aea9029e67485f6aeb8`. La revisión de entrega agrega exclusivamente este handoff; producto, migración y tests mantienen identidad. Rama/WT: `order-intent-storage-0242`, `/private/tmp/checkpass-pos-0242/order-intent-storage-0242`.

## Cambio y contrato

Se modifican exclusivamente los seis paths reservados: `packages/db/src/schema/modules/pos.ts`, `packages/db/drizzle/0106_pos_order_intent.sql`, `packages/db/drizzle/meta/_journal.json`, `packages/db/drizzle/meta/0106_snapshot.json`, `apps/merchant/src/modules/pos/server/order-intent-storage.neon.integration.test.ts` y este handoff.

`pos.pos_order` incorpora `sale_type` nullable (table/pickup/delivery/counter/legacy), intención nullable UUID+huella SHA256 hexadecimal minúscula64 con par obligatorio e índice único negocio+clave, y proyección privada nullable `total_snapshot numeric(30,2)`. Tipo pickup/delivery/counter rechaza mesa real. Inserción antigua sin columnas nuevas sigue admitida. NULL de total significa ausencia, no cero. `table_label` existente queda intacto como futura fuente de orderLabel.

Generación offline canónica Node24/Drizzle: `pnpm --filter @mi-pasaporte/db exec drizzle-kit generate --name pos_order_intent`, desde journal105/snapshot0105. SQL generado agrega cuatro columnas/tres checks/un índice. Único SQL de datos añadido: backfill `sale_type` table si dining_table_id no nulo, legacy si nulo; nunca usa table_label ni cambia updated_at. Snapshot cambia solo `pos.pos_order` y enlaces id/prevId. No se alteran barreras anteriores, triggers, FKs, índices, líneas, settlement, pagos, eventos, versiones o fechas. Sin backfill monetario ni generación de claves históricas.

## Evidencia

Runtime Node24.20.0; pnpm11.4.0; lockfile/configuración sin cambios. Logs completos privados con SHA/comando/exit en `/private/tmp/checkpass-pos-0242/evidence/order-intent-storage/`:

- `ci-3b3cef73.log`: `NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env bash tools/neon-test.sh src/modules/pos/server/order-intent-storage.neon.integration.test.ts --no-file-parallelism` — EXIT0, **4PASS, 0skip, sin retries**. Wrapper aplica migración canónica en CI y el test comprueba hash del journal. Recurso DB exclusivo hasta teardown completado.
- `static-3b3cef73.log`: tipos db/domain/merchant EXIT0; ESLint y Prettier de código afectado EXIT0; lines+modules-boundary **28PASS**; app-boundary+ui-guard tests **17PASS**.
- `ui-guard-3b3cef73.log`: `node tools/ui-guard.ts --base b617c86b4c5cabf3b65a7538714b80ecc3cf118c` — EXIT0, 0 archivos UI, sin aumentos.
- `module-guards-3b3cef73.log`: modules-boundary/between/literals — **24PASS, 2FAIL**, EXIT1. Coincide con backlog comunicado: import expenses immediate test→stock/count y cinco archivos core adicionales de literales. Ningún offender nuevo del scope; no se alteraron guardias/tests para ocultarlo.
- `sql-schema-3b3cef73.diff` y `snapshot-3b3cef73.json`: SQL/schema/journal y before/after snapshot acotado; validación sin drift ajeno.

Los cuatro casos comprueban tipos/null/defaults y checks/FKs/índices previos; before/after sobre tabla privada de definición anterior con todas columnas/checks/índices, FKs y ambos triggers reales; filas open/closed/voided y settlement previo, nombres engañosos con/sin FK real, JSON/IDs/versiones/fechas exactos intactos; legacy INSERT y lectura/listado unit compatibles; todos tipos y NULL transitorio, rechazo no mesa+FK, par/UUID/formato de huella, duplicado por negocio y aislamiento entre negocios, FK local ajeno, múltiples nulls, total0/null/máximo representable. SQL canónico se ejecuta solo sustituyendo identificador de tabla por tabla privada; nunca downmigration global ni relajación de constraints reales. Teardown verifica ausencia de ambos negocios, owners, sesiones y esquema propio.

## Límites y siguiente paso

Esta capacidad de almacenamiento no certifica idempotencia del futuro POST, cálculo/invalidation del total ni reader/listado V2. Son entregas posteriores. No se opera DB local/PROD, no hay push, build, browser, M0/M1 ni fullverify.

Checks y wrapper finalizaron. `ps` sandbox dio EPERM y se informó inmediatamente; comprobación read-only escalada autorizada mostró solo los propios procesos transitorios de inspección, sin servidores/tests persistentes. Checkout limpio tras commit documental. Mantener WT para fixes hasta QA independiente. Coordinador aplica expansión en DB LOCAL protegida después de QA y antes de integrar descriptor consumidor; aceptación/combinación y eventual publicación son actos separados.
