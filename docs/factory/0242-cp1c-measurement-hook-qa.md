# 0242 CP1c.8 — QA independiente del hook de medida

**PASS de entrega**, 2026-10-18. Candidato congelado `030dd65796edd9d2577828f14b8e9b10829ccf37`; autor entregado `03cab45d8ee279cbb3098d04f66f942063fc0dc1`; producto inicial `70361885d85a7b76831b70611b3856b228834ab8`, corrección `61dca7448959a99b7cbf77b05644926fa7271171`. WT QA `/private/tmp/checkpass-pos-0242/pos-qa-0242`, rama `pos-qa-0242`. Contexto independiente, sin subdelegación ni cambios de producto.

Leídos protocolos, ficha, contrato0242 §2, seis archivos del diff y código pertinente de esquema/expansión/publicación. El ensamblador usa exclusivamente `change.tx` para consultar módulos activos del negocio, filtra resourceType, conserva identidad del contexto y devuelve el primer error por id de módulo/declaración. Excepciones se propagan. Metadata y registro aportan el contrato previsto; core solo importa el registro permitido, sin imports/literales específicos nuevos, getDb global ni writes.

El proveedor lee slot y composición publicada, valida negocio/producto/resolución/revisión/base y revisiones de componentes capturadas. Unit↔mass incompatible, cualquier unidad tarifaria mass compatible con base mass, legacy implica1unit. Ausencia verdadera admite; inconsistencia falla explícitamente. Old==new conserva inspección. No consulta receta/precio vigentes ni modifica producto, base o historia.

## Hallazgo y corrección

QA detectó en70361885 que la comparación mediante `.some` aceptaba revisión JSON `[A,A]` frente a resolución `[A,B]` con revisiones reales válidas. No requiere debilitar constraints ni inventar FKs imposibles. Autor confirmó y corrigió en61dca744: unicidad de ambos lados, cardinalidad e identidad/cantidad biyectivas. Revisé fix y negativo persistido; este usa dos recetas/revisiones reales del mismo negocio, sin alterar constraints/triggers. Hallazgo cerrado, sin pendientes de producto dentro del encargo.

## Evidencia

Runtime QA Node24.20.0, pnpm11.4.0, lockfile intacto. En candidato temprano `a1f707c77fa40a3ed0aa856d15a327b20519f970`, producto70361885:

- `pnpm exec vitest run apps/merchant/src/server/resource-measurement.test.ts`: **4PASS**, 0FAIL/0skip; cubre filtro tenant SQL/activo/tipo, ausencia, contexto/tx, old==new, orden y excepciones.
- Typecheck domain/db/merchant: **PASS**. ESLint y Prettier sobre seis archivos y diff --check: **PASS**.
- Tres guardias de módulos: **24PASS/2FAIL**, 0skip. Backlog previsto: expenses immediate test→stock/count y cinco archivos core adicionales (`backoffice-context-controller`, `backoffice-context-refresh`, `checklist-context-resource`, `analytics/evaluation/policy-simulation`, `analytics/lifecycle/index`). Ningún offender nuevo del diff; guardias intactas. No se declara gate global verde.

Tras fix, en `c6b6da889ffc2627010e82f78cff8ce47dafce3b`, repetí ESLint/Prettier de ambos archivos afectados y diff --check: **PASS**. Autor aporta tipos merchant PASS tras fix. El ensamblador y sus cuatro puros no cambiaron. Verifiqué que c6b6da889..030dd657 solo añade handoff; diff de apps/packages/tests/tools vacío. Evidencia compatible con candidato final.

CI real reutilizada del autor, recurso exclusivo autorizado por coordinador, wrapper `tools/neon-test.sh src/modules/recipes/server/measurement-validator.neon.integration.test.ts --no-file-parallelism`, configuración privada CI indicada en handoff. QA no abrió env ni ejecutó DB/wrapper. Inspeccioné `/private/tmp/checkpass-pos-0242/measurement-hook-neon-r2.log`: migraciones completas y **6PASS/0FAIL/0skip**,92.64s, sobre61dca744, wrapper exit0 según entrega. Incluye matriz3×3 mass, unit/mass, old==new incompatible, ausencia/tenant, legacy, referencias/base/componentes incoherentes y negativo de duplicados. Snapshots asertan producto/publicación/base sin cambios; teardown de la suite comprueba ausencia de ambos negocios/owners y completó sin error. Autor entrega0procesos. No queda duda concreta que justifique repetir DB.

Primera corrida70361885 preservada: **1PASS/4FAIL** por timeout5000ms; no cuenta como aceptación. Fix fija120000ms por caso remoto sin retirar aserciones; r2 ejecuta efectivamente los seis casos. Aviso consumer URL ausente no causa skips en esta selección merchant; no se certifica oráculo de rol consumer.

## Límites

Aceptación focal de entrega del hook; no QA de combinación futura. No certifica cambio real de catálogo/importación, locks/carreras ni rollback de un writer todavía no conectado. Caller e inyección quedan en CP2a. Sin schema/catalogo/framework/eventos/UI/build/browser/M0/M1, push ni PROD. Factory/aceptación/integración corresponden al coordinador. QA solo escribe este reporte y no mantiene procesos propios.
