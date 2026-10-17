# 0235 — Correcciones de contratos detectadas por pre-push

Base3fbcd8a6ad969dbde01087cacd734193abfb3d11. El pre-push real de publicación corre en negocio-release-0235, sin transmitir mientras el hook original no apruebe y el owner no confirme una pausa posterior. NeonCI detectó expectativas previas a0235. No cambiar producto/guardias/kit/migraciones ni relajar negativos para tapar un fallo. Confirmar causa y corregir únicamente contratos obsoletos por decisiones aprobadas.

## Worker A — contrato de módulos

Task negocio-release-contract-tests, árbol/rama propios desde3fbcd8a6. Paths: apps/merchant/src/modules/modules-fk.neon.integration.test.ts; apps/merchant/src/modules/modules-registry.neon.integration.test.ts; docs/factory/0235-release-contract-tests.md. Mantener exactitud del catálogo y conteos reales de tablas tras mover medios/comisiones a core; conservar control de FK inválida y la prohibición core→módulo. Registro de módulos conserva identidadprofitability, sin renombreGastos. Pedir scope nominal si otro archivo resulta necesario.

Ampliación nominal por el mismo run: apps/merchant/src/modules/module-events.neon.integration.test.ts. El evento legacyv1 ya no debe crear una obligación de comisión retirada; preservar consumo recetas, inmutabilidad y lectura sin dato. Justificar la expectativa exacta de subscribers/ACKs en vez de solo bajar un conteo; no marcar obligaciones históricas como aplicadas/skipped ni borrar pendientes.

Ampliación nominal por inspección de la fase serial aún no alcanzada: apps/merchant/src/modules/profitability-migration.neon.integration.test.ts. El test busca OIDs y elimina tablas/función de comisión en profitability aunque0093 las movió a core. Adaptar su montaje histórico a la ubicación actual, preservando hashes0086/0087, replay SQL real, sesión/permisos, backfill e identidad/OIDs posteriores al rollback. No cambiar SQL/journal aplicado ni borrar el test; no invertir tablas en PROD. Ejecutar el archivo aislado vía wrapper y serial para comprobar el ajuste.

Ampliación nominal al cerrar la tanda: apps/merchant/src/modules/recipes/server/consumption-cost.neon.integration.test.ts. Espera delivery no-Recipes skipped de la comisión retirada; ahora debe demostrar ausencia de esa obligación y ACK real de Recipes, conservando compra posterior al cierre, claim/pre-drain y costoCOP completo cero.

## Worker B — fiscal en Negocio

Task negocio-release-fiscal-test, árbol/rama propios desde3fbcd8a6. Paths: apps/merchant/src/modules/brand-fiscal-inert.neon.integration.test.ts; docs/factory/0235-release-fiscal-test.md. Fiscal se configura ahora en Negocio, no Marca. Mantener comparación de catálogo, cobro POS, costo/stock y DTO consumidor sin contaminar por flags; conservar todos los asserts y teardown. Usar servicio o ruta core real con permisos existentes. Si la falla revela bug de producto, informar antes de ampliar scope.

Ampliación nominal por el mismo run: apps/merchant/src/server/brand.neon.integration.test.ts y apps/merchant/src/server/brand-integration-support.ts. Alinear fixtures/expectativas de Marca con branding solo; preservar pruebas de revisión, conflictos, aislamiento, errores y atomicidad. No mover checks financieros a dobles ni relajar positivos/negativos.

Ampliación nominal adicional reservada en factory: apps/merchant/src/server/business-slug.neon.integration.test.ts. Su fixture de renombrado aún envía timezone a Marca; retirar esa clave únicamente del DTO, manteniendo timezone al crear el comercio y todos los asserts SQL del slug. Archivo completo11casos es selección focal aceptada por su costo observado de9s, sin filtros.

Ampliaciones finales reservadas: apps/merchant/src/server/permisos-brand-loyalty.neon.integration.test.ts y tests/e2e/brand-progress.spec.ts. Conservar Brand/Loyalty/tenant/atomicidad; Fiscal ahora usa ruta real Negocio y business, mientras brand solo queda sin Fiscal/Regional y no recibe business. El tour de Marca ya no tiene el paso regional; el browser conserva identidad, no escritura y progreso completado. Puede correr solo ese browser en puertos propios mientras A tiene CI, con DB/orígenes locales y proveedoresfake; detener servidores antes de devolver recursos. Sin tocar UI del producto.

La tanda real terminó EXIT1: navegador1FAIL/446PASS/21excluidos; Neon paralelo15FAIL/3950PASS/282excluidos en8archivos,681,62s. Serial aún no corrió porque el wrapper detuvo tras la fase roja. El coordinador omitió inicialmente el fallo browser al comunicar los446PASS y lo corrigió al leer la tabla final; no declarar esa fase verde. Remoto permanece5b834ca0 y no hubo migración. Recurso transferido secuencialmente a A después de finalizar el proceso y sus teardowns; B recibe únicamente puertos hasta siguiente transferencia de CI.

## Recursos y QA

Sin DB para workers mientras release tiene db:modules-ci, incluso durante teardown de la tanda roja. Lecturas/código/unit/tipos propios pueden avanzar. Coordinador transfiere reserva únicamente al terminar todos los procesos DB del release; luego cada selección focal con tools/neon-test.sh, CI seleccionado y --no-file-parallelism, sin concurrencia entre workers. Guardar logs/exit/skips y no declarar PASS de tanda incompleta. Sin envPROD copiado ni valores impresos; Node24. Dos implementadores existentes, QA independiente exacto al congelar,0mutaciones por defecto. Sin subdelegación ni suites globales de worker. Push/migración esperan cierre del hook y nueva pausa del cron; si rojo de red/DNS, detener y consultar al owner. No INDEX/TASKS ni estados de Claude.
