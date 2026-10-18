# 0242 CP2b.1 — QA independiente de storage de intención/tipo

Veredicto: **PASS focal de entrega y combinación acotada** sobre candidato `7f6e0fcecdc53e9b5d23d05b4c4e2b770c533767`, sin hallazgos de producto. Entrega del autor `281637c94369817f658a6b7ac1d2e09a70288bce`; fuente verificada `3b3cef73f52b31633deb3aea9029e67485f6aeb8`. Base de combinación `3de82609` (UI de recetas y catálogo previamente aceptados). QA independiente, sin implementar producto ni subdelegar.

## Identidad y revisión independiente

WT `/private/tmp/checkpass-pos-0242/pos-qa-0242`, rama `pos-qa-0242`; Node24.20.0. Leídos ficha completa, protocolos y contrato0242 §3/5. Revisión temprana en `298e110ba06b2c29555fc3ffef0e60ae844c7c17`; actualización final agrega únicamente handoff. Comparación de blobs Git confirma los cinco archivos de producto/tests idénticos entre fuente3b, candidato temprano y candidato final. Configuración, dependencias y lockfile no cambian.

Ejecutadas assertions independientes con Node sobre ambos snapshots completos, SQL y journal: solo cambia `pos.pos_order`, exactamente cuatro columnas nullable sin defaults, tres checks y un índice único; enlaces snapshot válidos y journal previo intacto con apéndice106. SQL tiene nueve statements: cuatro ADD COLUMN, tres ADD CONSTRAINT, un CREATE UNIQUE INDEX y un UPDATE exclusivo de sale_type según dining_table_id real. Log privado: `/private/tmp/checkpass-pos-0242/evidence/order-intent-storage/qa-semantic-298e110b.log`, EXIT0, incluye identidad del candidato final.

Revisión manual de schema/SQL/tests/triggers previos: no drift de otras tablas, nuevas FKs core→POS, claves históricas inventadas, money backfill ni modificación de etiquetas, settlement, IDs, versiones o fechas. La expansión conserva writers antiguos con NULL; total_snapshot numeric(30,2) es privado y nullable, sin sustituir dinero cerrado. No se activan mass/precisión/V4 ni se retiran barreras existentes.

## Evidencia compatible inspeccionada

Logs completos del autor en `/private/tmp/checkpass-pos-0242/evidence/order-intent-storage/`, ligados a fuente3b e inspeccionados por QA. Los blobs idénticos permiten reutilizarlos en el candidato final; QA no abrió DB ni repitió CI sin una duda concreta.

- `ci-3b3cef73.log`: `NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env bash tools/neon-test.sh src/modules/pos/server/order-intent-storage.neon.integration.test.ts --no-file-parallelism`, EXIT0, **4/4 PASS, 0 skips, sin retries**. Wrapper CI exclusivo aplica0106 canónica y test verifica hash contra journal. La ausencia de rol consumidor en configuración no omite casos de esta suite de storage.
- Before/after ejecuta SQL canónico con sustitución del identificador de tabla sobre clon completo anterior: checks/índices, siete FKs recreadas y ambos triggers reales. Compara JSON íntegro de filas open/closed/voided, incluido settlement previo, nombres engañosos con/sin mesa real y precisión de fechas; solo sale_type y las nuevas columnas NULL difieren. No downmigration global ni fixture que debilite constraints. Teardown verifica ausencia de negocios, owners, sesiones y esquema privado.
- Casos restantes: hash/tipos/null/defaults y barreras previas; legacy INSERT y detalle/listado unit; tipos conocidos/NULL y negativos desconocido o pickup/delivery/counter con mesa; par clave/huella, UUID inválido y huellas inválidas (longitud, caracteres, mayúsculas y salto final); duplicado dentro del negocio, misma clave entre negocios y FK de local ajeno; nulls repetidos y total0/null/máximo representable.
- `static-3b3cef73.log`: tipos db/domain/merchant, ESLint y Prettier afectados EXIT0; lines+module-boundary **28 PASS**; herramientas app-boundary+ui-guard **17 PASS**.
- `ui-guard-3b3cef73.log`: EXIT0, cero archivos UI y sin aumentos. `module-guards-3b3cef73.log`: **24 PASS/2 FAIL, EXIT1**, backlog conocido exacto expenses→stock y cinco archivos core con literales adicionales. Ningún ofensor nuevo ni guardia editada; no se declara PASS global de guardias.

## Límites y cierre

Certifica expansión de almacenamiento y compatibilidad observada; no certifica writer/listado V2, idempotencia HTTP futura, cálculo/invalidation de total ni activación de ventas medidas. No browser/build/fullverify/M0/M1 ni operación LOCAL/PROD/push. Root aplica migración LOCAL protegida tras este PASS y antes de integrar descriptor consumidor; publicación sigue requiriendo autorización propia.

QA no dejó servidores/tests ni procesos persistentes. `ps` inicial recibió EPERM de sandbox, comunicado a root inmediatamente; repetición read-only escalada autorizada mostró solo shell/rg transitorios de la auditoría. Autor informó igualmente cero procesos y entrega factory completada. Único cambio QA: este informe; checkout limpio tras su commit. Aceptación e integración corresponden al coordinador.
