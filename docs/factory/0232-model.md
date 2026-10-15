# R1 — entrega A: esquema, dominio y consumo

Fecha: 2026-10-15. Reserva `docs-r1-0232`, worktree `/private/tmp/checkpass-r1-0232/r1-0232-spec`. Base de implementación `42c7661bda32f0c31d4ca22ec777a95c4c87a6f8`. Producto de esta entrega: `493c0d00ed2545012196b94522ed4b459d802314`; incluye fundamento `c23a1f30b9c6f0a8711047bbf442750e7378ad72` y corrección de entrada canónica del esquema `071b90e87ded0b8e78171779bb1327245bc6a0f6`. El commit posterior de este informe no cambia producto.

## Resultado y contrato

Ocho tablas propias de Recetas, biblioteca/composición con identidad independiente, historial, nombre activo único, archivo protegido por uso vigente, preview y snapshots técnicos de resolución. Servicios/DTOs acordados con B en `server/library.ts`, `server/compositions.ts` y `server/contracts.ts`, sin stubs ni imports de Stock hacia Recetas. `recipes.ts` del esquema es la única entrada pública de las ocho tablas; los helpers crean tablas internas y el test comprueba los ocho owners `recipes`, sin modificar guardias.

El cierre conserva su publicación genérica actual. Editar una receta publica resoluciones de todos sus productos en la misma transacción, manteniendo revisiones de composición. Consumo y lectura aceptan slot `recipe` legado o `composition` R1 y rechazan ambos simultáneamente. Un movimiento por línea/insumo, con procedencia Q6/Q3 por receta/revisión/composición persistida en la misma transacción. Mayor residuo conserva la suma del ledger; positivos redondeados a cero conservan procedencia y estado incompleto, nunca costo cero inventado. Los snapshots monetarios 0230 permanecen intactos.

Migraciones aditivas y herramientas de preflight/corte local; el corte no se ejecuta automáticamente al migrar. Manifiesto inmutable por producto y nombres deterministas con categorías/sufijos, disponibles para B por `listMigrationRenames`. Un reintento conserva mapping y nombres corregidos por el comercio. Los fixtures 0227 ahora preparan recetas/composiciones mediante dominio R1; sus cierres POS y retries siguen siendo reales.

## Evidencia

Node `24.20.0`. Configuración CI seleccionada `/private/tmp/checkpass-specs/ci-selected.env`, siempre a través de `tools/neon-test.sh`; no se imprimieron valores ni se usó PROD. DB reservada durante ejecución y limpieza. No hubo skips ni ampliaciones de timeout. Evidencia focal, sin `verify` global.

- `pnpm --filter @mi-pasaporte/db typecheck` y `pnpm --filter @mi-pasaporte/merchant typecheck`: EXIT0.
- ESLint de fuentes/tests A y tool, Prettier focal y `git diff --check`: EXIT0.
- Vitest unitario: **45/45**, ocho archivos: `recipes/parse.test.ts`, `recipes/server/consumption-snapshot.test.ts`, `recipes/server/model/expand.test.ts`, `stock/server/consumption-cost.test.ts`, `recipes/server/model/schema-owner.test.ts` y las tres fronteras `modules-boundary{,-between,-literals}.test.ts`.
- Wrapper CI, `recipes/recipes.neon.integration.test.ts`: **7/7**, incluido teardown, nombre/archivo/tenant, preview, fanout, rollback de publicación y carrera receta/composición.
- Wrapper CI, `recipes/server/model/consumption.neon.integration.test.ts`: **4/4**, consolidación/procedencia, versiones del cierre, retry con costo congelado, rollback completo al fallar procedencia, redondeo cero y dos locales.
- Wrapper CI aislado, `recipes-r1-migration.neon.integration.test.ts --no-file-parallelism`: **1/1**, duplicados sembrados con/sin categoría, colisión contra nombre original reservado, equivalencia de cantidades ×1, mapping estable, corrección posterior conservada y retiro del puente dentro de una transacción revertida.
- Wrapper CI, `recipes/server/consumption-cost.neon.integration.test.ts`: **5/5**, regresión 0230 de costo/null/cero, aplicación posterior al cierre, moneda, estados y aislamiento. La posterior corrección de FK solo modifica cascadas de eliminación, sin cambios en writer ni lector monetario.
- Wrapper CI, `stock-local.neon.integration.test.ts`: **4/4**, cierre real, mesa libre ante fallo, retry concurrente, receta editada después del cierre, producto eliminado, módulos apagados y venta con pase.
- Wrapper CI, `stock-local-recipes.neon.integration.test.ts`: **2/2**, publicación atómica y permisos/locales.
- Total: **23 casos DB de producto distintos**. Las corridas repetidas por correcciones no se suman.
- CLI de rollout `--help` y carga SSR de sus exports: EXIT0, sin consultas DB en esas comprobaciones.
- Limpieza final por wrapper de los dos mundos propios que quedaron tras el teardown fallido: EXIT0, dos eliminados y ausencia comprobada por SQL. Sonda temporal conservada fuera del repo en `/private/tmp/checkpass-r1-fixture-recovery.ts`; no se suma a los 23 casos de producto. Su primer intento falló antes de mutar por un nombre de export incorrecto del script temporal; se corrigió y se ejecutó la limpieza, sin cambios al producto ni a los tests permanentes.

Ejemplos exactos de invocación, desde el worktree y después de `source ~/.nvm/nvm.sh && nvm use`:

```sh
NEON_TEST_ENV_FILE=/private/tmp/checkpass-specs/ci-selected.env tools/neon-test.sh src/modules/recipes/server/model/consumption.neon.integration.test.ts src/modules/recipes-r1-migration.neon.integration.test.ts --no-file-parallelism
NEON_TEST_ENV_FILE=/private/tmp/checkpass-specs/ci-selected.env tools/neon-test.sh src/modules/stock-local.neon.integration.test.ts --no-file-parallelism
```

## Fallos observados y correcciones

1. Primer wrapper abortó antes de Vitest sin diagnóstico de Drizzle. La instrumentación temporal sanitizada del coordinador dentro del mismo wrapper confirmó SQLSTATE `42830`: Drizzle había ordenado una FK compuesta antes de su índice único. Se corrigió el orden de 0088 **antes de que existiera aplicada**; el journal seguía con 88 entradas y las tablas nuevas no existían. Migración posterior por wrapper EXIT0. No se atribuyó el problema a red/SSL ni se modificó el wrapper.
2. Las siete aserciones de dominio pasaban, pero su teardown falló con SQLSTATE `23001`: `RESTRICT` del insumo impedía borrar el comercio con cascadas. Se agregó **0090**, manteniendo 0088/0089 ya aplicadas: FK `NO ACTION DEFERRABLE INITIALLY DEFERRED` conserva protección del insumo aislado y permite completar cascadas del agregado. El archivo completo volvió a pasar, incluido teardown.
3. El fixture multi-local omitía local al crear el insumo después de abrir un segundo local: `422 location_required`, antes de alcanzar el consumo. `newItem` ahora envía el local de su mundo explícitamente; archivo de consumo completo PASS.
4. El caso POS con pase no comprobaba el resultado del retry y solo sondeaba el ledger. Se hizo determinista como los otros casos reteniendo la aceleración asíncrona y dejando actuar al retry forzado real; se agregó aserción `applied=1`, `failed=0`. El archivo completo pasó con sus presupuestos originales. El primer fallo no conservó diagnóstico de delivery suficiente para afirmar su secuencia exacta de claims; no se lo presenta como causa medida ni como fallo definitivo del producto.

## SQL aplicado a CI y límites del corte

Los tres SQL siguientes se aplicaron por el wrapper y quedan congelados; no se editaron después de su aplicación:

| Migración                         | SHA-256                                                            |
| --------------------------------- | ------------------------------------------------------------------ |
| `0088_recetas_independientes.sql` | `acce4e2cf65818236000a1384c228650bef27aac837167938e3c91ecfb84eb58` |
| `0089_recipes_r1_invariants.sql`  | `ac899ca90c923cc73786524d21c457e88a11905d847d74c9949710dbe04794e2` |
| `0090_recipes_r1_cascade.sql`     | `72d3a0329426a74f3a99e3c88b771b5c342f931d905d584cf05f4a9edae52fbf` |

**En esta entrega A no se ejecutó el corte global de datos ni se midieron duplicados del comercio local real.** El caso de migración sembró al menos dos grupos duplicados y validó su mapping; su `DROP TRIGGER` y todo el backfill se revirtieron juntos. No es un manifiesto real entregado al comercio ni autorización para PROD.

Después de QA del candidato combinado, el coordinador alineará la app local y retirará writers antiguos. Comandos operativos exactos, guardados contra cualquier host que no sea local:

```sh
node --env-file=/private/tmp/checkpass-specs/local-selected.env packages/db/src/migrate-local.ts
node --env-file=/private/tmp/checkpass-specs/local-selected.env tools/recipes-r1/index.ts preflight
node --env-file=/private/tmp/checkpass-specs/local-selected.env tools/recipes-r1/index.ts cutover --writers-drained
node --env-file=/private/tmp/checkpass-specs/local-selected.env tools/recipes-r1/index.ts preflight
```

`--writers-drained` requiere comprobar y retirar los procesos/escrituras antiguos; no es una detección automática. Preflight devuelve número de productos con líneas, líneas y grupos/productos duplicados de catálogo y recetas; registrar esos valores reales al ejecutar. Cutover conserva el mapping inicial y devuelve cuántos productos migró; `GET /api/modules/recipes/migration-renames` del contrato B entrega los renombrados bajo permiso `recipes`. Los datos históricos, flag y EXPAND 0227 de Stock se conservan. No borrar revisiones ni revertir a un consumidor solo legado después del primer evento R1.

## Siguiente paso

B integra adaptadores HTTP, dictado/foto y retiro de UI sobre este producto. Por acuerdo del coordinador, **el backend antiguo permanece compilable en este checkpoint** y se retira en una continuación corta desde el candidato combinado con B; no se publica ni se declara la tarea completa con ese pendiente. QA independiente certificará la combinación congelada y el corte local tendrá evidencia separada. Sin P1, código del kit/guardias, índices/estados comunes, push ni operaciones PROD.

## Hallazgos abiertos de la revisión estática posterior

La revisión del candidato combinado identificó dos límites que **siguen abiertos**, sin invalidar la identidad de los casos focales ya medidos ni equivaler a aceptación final:

- Preflight debe ampliar sus mediciones a revisiones/punteros vacíos, eventos pendientes, ledger/snapshots y cantidades comparables antes/después, según la spec. El helper actual solo mide catálogo/recetas con líneas y duplicados; no es aún el preflight completo de rollout.
- Un combo con una receta vacía y otra con ingredientes conocidos puede omitir la cobertura incompleta del componente vacío. Se debe conservar la suma conocida de la otra receta y devolver incompleto, con caso focal real y unitario. No se resuelve recalculando costos ni convirtiendo ausencia en cero.

El coordinador asignará ambos fixes en la continuación desde B combinado, junto con la retirada del backend antiguo. La alineación y medición local que realice coordinación tienen evidencia propia; esta entrega no se atribuye esas operaciones.

## Continuación sobre el candidato combinado: pendientes cerrados

Base `a139aad367e6067add2a62f564e343efd1067a94`, con el adaptador HTTP de B integrado. Los hallazgos del apartado anterior quedan cerrados en esta continuación:

- Se retiraron `recipes.ts`, `read.ts` y `cost.ts` antiguos del módulo y los helpers HTTP legados sin consumidores. Se conserva el parser útil en `server/model/input.ts`. Se eliminó `cost.test.ts` asociado al lector actual retirado; las pruebas de valoración histórica 0230 y las pruebas del dominio nuevo permanecen. No se conserva un backend incompatible bajo las rutas nuevas ni un lector de costo actual 1.3.
- Una resolución con componente vacío comunica cobertura incompleta a Stock sin perder los ingredientes presentes. El caso real de combo vacío + completo confirma un único movimiento de `-2.000`, snapshot unitario `3.000000`, procedencia de la receta completa, `knownCost=6.00`, estado `incompleto` y razón `sin_receta`. No se calcula el costo de la receta vacía como cero.
- Preflight ahora informa revisiones/punteros vacíos o inválidos, slots simultáneos, estados de entregas, snapshots legados/desconocidos/conocidos/cero, grupos de cantidades por local y colisiones de primeros candidatos de nombre. Añade conteos/huellas de esquema y manifiesto. Las cantidades por producto/insumo y cada campo de eventos/deliveries/ledger/snapshots/promedios locales participan en huellas exactas calculadas en PostgreSQL; no se vuelcan filas, nombres ni datos de cliente al log.
- El corte verifica la expansión de venta ×1 de cada producto recién migrado contra sus ingredientes, cantidades decimales y unidades de origen. También compara conteos/huellas de todos los datos preservados antes/después y aborta la transacción ante diferencias. Reejecutar no compara una composición ya corregida por el comercio contra su origen legado ni sobrescribe el mapping. El CLI usa lectura `REPEATABLE READ` y registra entorno local, SHA y si el árbol estaba modificado; el retiro real de writers sigue siendo una comprobación operativa explícita.

Evidencia de esta continuación, Node `24.20.0`, configuración CI seleccionada y wrapper obligatorio:

- Merchant y DB typecheck, ESLint focal, Prettier y `git diff --check`: EXIT0.
- **48/48 unitarios**, nueve archivos: parser, expansión, preflight/comparación, cobertura/costo Stock, snapshot legado, ownership canónico y las tres fronteras. El nuevo caso de comparación detecta cambio de huella monetaria aunque el número de movimientos sea igual, además de adiciones a stock local.
- `NEON_TEST_ENV_FILE=/private/tmp/checkpass-specs/ci-selected.env tools/neon-test.sh src/modules/recipes/server/model/consumption.neon.integration.test.ts src/modules/recipes-r1-migration.neon.integration.test.ts --no-file-parallelism`: **6/6**, EXIT0, ambos teardowns completos. Consumo cubre el caso mixto nuevo y los cuatro casos anteriores. Migración siembra snapshots legado NULL, costo desconocido, cero y conocido; un puntero/revisión vacíos y una entrega pendiente; confirma huellas y stock iguales antes/después, equivalencia de cantidades y replay sin sobrescribir correcciones.
- CLI `--help`: EXIT0 sin DB. Los hashes 0088/0089/0090 siguen exactamente iguales a los publicados arriba; no se añadió ni modificó SQL. No hubo skips ni cambios de presupuesto para alcanzar el verde.

DB CI liberada después del wrapper. Esta continuación no ejecutó el corte local global ni midió nombres del comercio real. Coordinación conserva su evidencia separada de backup/esquema/preflight local; debe repetir el preflight ampliado y ejecutar el corte sobre el candidato aceptado, con writers retirados. Los mismos comandos operativos anteriores siguen vigentes. El resultado del corte contiene `migrated`, `equivalentProducts`, inventarios antes/después y `comparison.unchanged`; el manifiesto cuenta productos mapeados/renombrados y el endpoint entrega su detalle al comercio.

No quedan pendientes de los tres ajustes asignados. La aceptación corresponde a QA independiente del SHA combinado; esta evidencia no sustituye esa revisión ni autoriza push/PROD.
