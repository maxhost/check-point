# 0235 — Correcciones de contratos detectadas por pre-push

Base3fbcd8a6ad969dbde01087cacd734193abfb3d11. El pre-push real de publicación corre en negocio-release-0235, sin transmitir mientras el hook original no apruebe y el owner no confirme una pausa posterior. NeonCI detectó expectativas previas a0235. No cambiar producto/guardias/kit/migraciones ni relajar negativos para tapar un fallo. Confirmar causa y corregir únicamente contratos obsoletos por decisiones aprobadas.

## Worker A — contrato de módulos

Task negocio-release-contract-tests, árbol/rama propios desde3fbcd8a6. Paths: apps/merchant/src/modules/modules-fk.neon.integration.test.ts; apps/merchant/src/modules/modules-registry.neon.integration.test.ts; docs/factory/0235-release-contract-tests.md. Mantener exactitud del catálogo y conteos reales de tablas tras mover medios/comisiones a core; conservar control de FK inválida y la prohibición core→módulo. Registro de módulos conserva identidadprofitability, sin renombreGastos. Pedir scope nominal si otro archivo resulta necesario.

Ampliación nominal por el mismo run: apps/merchant/src/modules/module-events.neon.integration.test.ts. El evento legacyv1 ya no debe crear una obligación de comisión retirada; preservar consumo recetas, inmutabilidad y lectura sin dato. Justificar la expectativa exacta de subscribers/ACKs en vez de solo bajar un conteo; no marcar obligaciones históricas como aplicadas/skipped ni borrar pendientes.

## Worker B — fiscal en Negocio

Task negocio-release-fiscal-test, árbol/rama propios desde3fbcd8a6. Paths: apps/merchant/src/modules/brand-fiscal-inert.neon.integration.test.ts; docs/factory/0235-release-fiscal-test.md. Fiscal se configura ahora en Negocio, no Marca. Mantener comparación de catálogo, cobro POS, costo/stock y DTO consumidor sin contaminar por flags; conservar todos los asserts y teardown. Usar servicio o ruta core real con permisos existentes. Si la falla revela bug de producto, informar antes de ampliar scope.

Ampliación nominal por el mismo run: apps/merchant/src/server/brand.neon.integration.test.ts y apps/merchant/src/server/brand-integration-support.ts. Alinear fixtures/expectativas de Marca con branding solo; preservar pruebas de revisión, conflictos, aislamiento, errores y atomicidad. No mover checks financieros a dobles ni relajar positivos/negativos.

## Recursos y QA

Sin DB para workers mientras release tiene db:modules-ci, incluso durante teardown de la tanda roja. Lecturas/código/unit/tipos propios pueden avanzar. Coordinador transfiere reserva únicamente al terminar todos los procesos DB del release; luego cada selección focal con tools/neon-test.sh, CI seleccionado y --no-file-parallelism, sin concurrencia entre workers. Guardar logs/exit/skips y no declarar PASS de tanda incompleta. Sin envPROD copiado ni valores impresos; Node24. Dos implementadores existentes, QA independiente exacto al congelar,0mutaciones por defecto. Sin subdelegación ni suites globales de worker. Push/migración esperan cierre del hook y nueva pausa del cron; si rojo de red/DNS, detener y consultar al owner. No INDEX/TASKS ni estados de Claude.
