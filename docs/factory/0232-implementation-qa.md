# R1 — QA independiente de implementación y combinación

Fecha: 2026-10-15. **PASS** sobre el candidato congelado `10b7f6dbcd35532bfb3883354f1d0e4d71525a65`. Entrega A final `4ee5017e5e4e8d47b99eb652661bc390cab2e101`; B `cd97f2ce`. Contrato: [0232-implementation-contract.md](0232-implementation-contract.md); aceptación: [SPEC0232](../specs/0232-recetas-independientes-y-combos.md) y [ADR0148](../adr/0148-recetas-independientes-y-composiciones-versionadas.md).

QA no implementó ni corrigió el producto certificado. Checkout reservado `/private/tmp/checkpass-qa-0232-0233/qa-0232-0233`, limpio al comenzar; única escritura entregada por QA: este informe. Presupuesto focal de20min, sin mutaciones ni pruebas de producto nuevas en el repositorio. No verify global, push, deploy ni operación PROD. La autorización del owner permite completar R1 y promoverlo a main local tras aceptación; la promoción corresponde al coordinador.

## Identidad y entorno

- Node `24.20.0`, activado con `source ~/.nvm/nvm.sh && nvm use`; pnpm del repositorio. Lockfile SHA256 `a63b2a852e32abcd70ae19f57c8784524f56037d91447a42ca71ba08b7f0cce0`.
- DB CI seleccionada en `/private/tmp/checkpass-specs/ci-selected.env`, exclusivamente mediante `tools/neon-test.sh`. Wrapper verificó destino no PROD y aplicó migraciones correctamente. Se mantuvo reserva exclusiva `db:recipes-r1-ci` durante pruebas, DDL y teardown; A/B ya habían liberado el recurso. No se imprimieron valores de credenciales ni se copió configuración PROD.
- `git diff 4ee5017e..10b7f6db -- apps packages tools` vacío: producto A final idéntico al combinado. Las fuentes B de rutas, borradores, tareas IA, manifiesto, registro y harness no cambiaron entre `cd97f2ce` y el candidato. El rango general de dev incluye documentación ajena; QA no la editó ni la convierte en alcance de implementación P1.
- SQL0088/0089/0090 y lockfile conservaron identidad frente a las entregas de autores. Los hashes SQL comprobados por QA son los de la tabla siguiente.

| SQL                               | SHA256                                                             |
| --------------------------------- | ------------------------------------------------------------------ |
| `0088_recetas_independientes.sql` | `acce4e2cf65818236000a1384c228650bef27aac837167938e3c91ecfb84eb58` |
| `0089_recipes_r1_invariants.sql`  | `ac899ca90c923cc73786524d21c457e88a11905d847d74c9949710dbe04794e2` |
| `0090_recipes_r1_cascade.sql`     | `72d3a0329426a74f3a99e3c88b771b5c342f931d905d584cf05f4a9edae52fbf` |

## Señales independientes ejecutadas

Comando DB exacto desde el checkout QA, después de activar Node24:

```sh
NEON_TEST_ENV_FILE=/private/tmp/checkpass-specs/ci-selected.env tools/neon-test.sh src/modules/recipes/server/model/consumption.neon.integration.test.ts src/modules/recipes-r1-migration.neon.integration.test.ts src/modules/stock-local.neon.integration.test.ts src/modules/recipes/server/consumption-cost.neon.integration.test.ts src/modules/recipes/server/routes.neon.integration.test.ts --no-file-parallelism
```

**18/18 DB PASS**, cinco archivos, EXIT0,272,92s y todos los teardowns completos. Sin skips, reintentos de suites ni ampliación de presupuestos:

| Archivo                                                     | Casos y señal decisiva                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `recipes/server/model/consumption.neon.integration.test.ts` | **5/5**. Combo con insumo compartido produce un movimiento y dos procedencias congeladas; edición después del cierre no cambia el consumo; reentrega tras cambiar costo conserva el snapshot. Fallo de procedencia revierte ledger y acknowledgment, dejando delivery recuperable. Positivo redondeado0 conserva exacto y estado incompleto. Dos locales conservan costos/inventario distintos. Combo parcialmente vacío mantiene costo conocido de la otra receta y estado incompleto. |
| `stock-local.neon.integration.test.ts`                      | **4/4**. POS real: cierre, mesa libre ante fallo técnico, cantidades normalizadas×unidades, retry concurrente idempotente, edición posterior y producto borrado conservan la revisión capturada; módulos apagados no reconstruyen; venta con pase acredita y consume una vez.                                                                                                                                                                                                           |
| `recipes/server/consumption-cost.neon.integration.test.ts`  | **5/5**. Regresión0230: costo/factor/moneda se congelan al aplicar; compras/conteos/cambios posteriores no revaloran. Cero y desconocido siguen distintos. Compra entre cierre y aplicación conserva la política anterior. Aislamiento de comercio/local, locales archivados y ausencia de evento sin costo0 inventado.                                                                                                                                                                 |
| `recipes-r1-migration.neon.integration.test.ts`             | **1/1**. Nombres duplicados con categoría/sufijo y colisión contra original reservado; equivalencia×1 de cantidades/unidades, mapping retomable y corrección posterior del comercio preservada. Preflight mide pendientes y snapshots legado/NULL/cero/conocido; compara conteos y huellas antes/después. Retiro del puente y backfill de fixture se revierten juntos al terminar el probe.                                                                                             |
| `recipes/server/routes.neon.integration.test.ts`            | **3/3**. Dispatcher/sesión reales: biblioteca sin local, Docena×12→1200g, historial y fanout; archivo usado bloqueado con productos y permitido al desvincular. IDs de otro comercio dan404 sin nombres. Rutas antiguas raíz/producto/dictado/foto/DELETE dan404 y mantienen validación.                                                                                                                                                                                                |

Comando unitario exacto:

```sh
pnpm --filter @mi-pasaporte/merchant exec vitest run src/modules/recipes/server/model/expand.test.ts src/modules/recipes/server/model/preflight.test.ts src/modules/stock/server/consumption-cost.test.ts src/modules/recipes/server/routes.test.ts src/modules/recipes/server/consumption-snapshot.test.ts src/modules/modules-boundary.test.ts src/modules/modules-boundary-between.test.ts src/modules/modules-boundary-literals.test.ts
```

**67/67 PASS**, ocho archivos, EXIT0: expansión5, preflight/comparación2, costo7, rutas22, snapshot legado5 y fronteras26. Incluye mayor residuo/desempate, Q6→Q3, overflow, cobertura incompleta y decoder legado. Ninguna guardia se relajó para aceptar R1.

Checks adicionales sobre el mismo candidato:

- `pnpm --filter @mi-pasaporte/db typecheck` y `pnpm --filter @mi-pasaporte/merchant typecheck`: EXIT0.
- `pnpm --filter @mi-pasaporte/merchant build`: EXIT0; Next16.3.0 compiló, verificó tipos y generó36 páginas. Un único build focal por retirada de imports/pantalla/navegación, sin render de UI nueva. Next regeneró dos referencias de `next-env.d.ts` de `.next/dev/types` a `.next/types`; QA repuso exactamente el blob HEAD de ese archivo generado y verificó checkout limpio. Ese artefacto no se entrega como cambio del producto.
- `pnpm exec prettier --check --ignore-path /dev/null` sobre `model/captured.ts`, `model/preflight.ts`, `model/migration.ts`, `model/migration-compare.ts`, `stock/server/consumption-cost.ts` y `tools/recipes-r1/index.ts`: EXIT0. El override evita atribuir PASS a archivos ignorados.
- `git diff --check 42c7661b HEAD`: EXIT0. Búsqueda de imports/consumidores de `recipes.ts`, `read.ts`, `cost.ts` y UI retirada: sin coincidencias ejecutables.

## Evidencia reutilizada y revisión estática

Se revisaron los [handoffs A](0232-model.md) y [B](0232-http.md), sus fallos originales y los diffs pertinentes. La identidad de código/SQL/lockfile permite reutilizar el dominio A7 casos y publicación/permisos A2 casos, y dictado B5/foto B4, sin repetirlos por ceremonia: **18 casos DB adicionales compatibles**. Junto con los18 ejecutados por QA son36 casos DB distintos; las corridas repetidas de autores o QA no se suman como casos nuevos. Tipos/lint y parser/IA/registro/pantallas de autores se reutilizan donde su identidad sigue vigente; no se suman unitarios solapados.

Lectura independiente confirma receta propia por comercio, nombre activo único, archivo serializado con asociaciones, composición decimal sin combos anidados, resolución/fanout atómicos y captura MVCC sin buscar revisiones retrospectivas por fecha. Un puntero identifica ambas revisiones; pendientes legados siguen usando su revisión antigua. Procedencia Q6 y atribución Q3 suman al ledger consolidado y se confirman con delivery; el costo atribuible futuro usa el snapshot monetario del mismo movimiento, no precios actuales. No se alteró la política0230 de costo al aplicar ni el promedio0228.

Rutas propias, dictado/foto independiente, preview compartida con expansor y retirada de handlers/UI/backend anteriores cumplen el contrato. Se conserva biblioteca sin producto, módulo sin pantalla/navegación y `/locations` independiente; R1 no implementa UI sustituta, 1.3, pagos/comisiones P1 ni Smart Menu.

## Hallazgos y correcciones certificadas

La revisión estática de `a1f0764d` detectó dos huecos reales, enviados al coordinador antes de emitir PASS:

1. Preflight incompleto: solo duplicados/productos/líneas; faltaban pendientes, revisiones/punteros y conservación del ledger/snapshots. `4ee5017e` agrega inventario ampliado, huellas exactas en PostgreSQL, comparación abortable y equivalencia de expansión de productos recién migrados. El unitario detecta cambio monetario aun con igual número de movimientos; el caso DB confirma conservación antes/después.
2. Combo con receta vacía más receta conocida podía aparecer completo. La cobertura tipada ahora conserva `incompleteRecipe`, lista el producto faltante y mantiene suma parcial. QA reprodujo el caso real corregido: un movimiento−2,000, costo unitario3,000000, `knownCost=6.00`, estado incompleto y razón `sin_receta`, sin costo0 inventado para el componente vacío.

También se verificó la retirada del backend legado prevista en la continuación. Los fallos iniciales de migración/FK, teardown, fixture multi-local, ownership y comandos de autor permanecen descritos en los handoffs; no se los oculta como una primera corrida verde. La ejecución independiente final anterior terminó íntegra sin fallos ni skips.

## App local: evidencia separada del coordinador

Se revisó [0232-local-integration.md](0232-local-integration.md) en `f7fb8fa496af63ecad71fd2868c27347e56df513`. Su diff respecto al candidato cambia únicamente ese informe, y el código del corte `4ee5017e` coincide con el producto certificado. Esta es evidencia del coordinador, no una operación DB ejecutada por QA:

- App local alineada hasta0090:91 entradas de journal, ocho tablas y los tres hashes SQL/journal coincidentes.
- Writers detenidos y puerto3201 sin listener antes del corte; backup `pg_dump -Fc` privado0600 y listado verificado.
- Corte local:2 productos migrados y2 equivalentes,13 líneas legadas,27 movimientos y9 grupos de saldo preservados por huellas; `comparison.unchanged=true`, sin cambios detectados. Después:2 recetas/13 líneas independientes/2 composiciones/2 resoluciones/2 punteros nuevos; puente viejo ausente y0 renombrados.
- Había0 eventos, consumos y revisiones legadas locales: la conservación monetaria histórica no se atribuye a esos datos inexistentes; la señal real está en CI.
- Entorno reiniciado conservando flags, con health Merchant y Consumer por túnel HTTP200. No equivale a smoke autenticado del POS ni prueba visual de UI nueva.

## Cierre y límites

No quedan bloqueantes R1 encontrados sobre el candidato identificado. CI terminó sin procesos/conexiones de pruebas propios y se liberó explícitamente `db:recipes-r1-ci` al coordinador antes de escribir este informe. El entorno local reiniciado pertenece al coordinador y permanece activo.

Este PASS permite aceptación/integración local de R1 conforme a la autorización del owner; no autoriza push ni PROD. P1 conserva su contrato/documentación aparte y requiere implementación/QA posteriores, sin heredar este PASS. No se modificaron INDEX, TASKS ni estados comunes desde QA. La promoción a main local y el registro factory corresponden al coordinador.
