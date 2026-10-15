# Entrega A — implementación0230

Task `spec-0230`, worktree `/private/tmp/checkpass-specs/factory-spec-0230`, rama `factory-spec-0230`. Base de implementación `2acf94697736fef7b08caade906c8487f9e4d2d6`; producto congelado **`fe5fb583106b801e7341a80cbc10062b0259e856`**. El commit de esta entrega solo añade este informe. Spec0230 cerrada, pendiente de QA funcional independiente y combinación; el autor no la marca implementada. Sin main, push, deploy ni operaciones PROD/local DB.

## Cambio y contrato

- `stock.movement` incorpora costo unitario6, factor6, moneda y escala congelados. SQL0085 aditivo con CHECKs de snapshot completo/legacy, finitud, signo, moneda y escala. Sin backfill, defaults monetarios, cambios de `total_cost`, contract0227 ni flag.
- `stock/consumption.ts` conserva locks, cantidades y conflicto de snapshot0227. Lee promedio del par bloqueado; moneda/escala una vez solo si hay inserts nuevos. Factor1; costoNULL sigue desconocido. Reentrega conserva todos los campos y funciona aunque la moneda actual ya no esté soportada. `lockItemLocations` devuelve promedio bajo lock, sin inicializar/resembrar0228.
- API interna `recipes/server/consumption-cost.ts::readSaleConsumptionCost({ businessId, locationId, sourceOrderId, saleContext? })`. Su futuro consumidor debe autenticar y autorizar el comercio. Wrapper Recetas lee evento/delivery/revisiones capturadas en transacción read-only REPEATABLE READ y pasa cobertura normalizada al lector Stock; este no importa Recetas/POS. Sin HTTP, UI ni cambios core/manifiestos.
- Lectura de venta/líneas: completo/incompleto/pendiente, faltantes y suma parcial `knownCost`. Sin ningún consumo conocido devuelve null; costo conocido positivo COP0.25 puede redondear a0 completo. Suma BigInt exacta antes de redondear por escala congelada (COP/CLP/JPY/PYG0, resto ofrecidas2). Sin mezclar monedas ni sumar líneas ya redondeadas.
- `application_failed` recuperable continúa pendiente. No productor terminal, umbral de abandono, conversión monetaria ni reparación del promedio anterior a un cambio de moneda. Snapshot protege movimientos ya aplicados. Helper aún sin consumidor de producción: fila SM-datos propuesta dentro de la spec, sin editar TASKS.

Archivos: esquema Stock, SQL0085/journal/snapshot, aplicador/local/money/lector y unitario Stock, wrapper y montaje/pruebas Recetas, `modules/stock-consumption-cost-migration.neon.integration.test.ts`. Solo scopes reservados; sin tooling/guardias/kit/índices/estados comunes. Snapshot0085 solo cambia `stock.movement` frente a0084.

## Evidencia de autor

Node24.20.0, pnpm11.4.0, Vitest4.0.18; lockfile SHA256 `a63b2a852e32abcd70ae19f57c8784524f56037d91447a42ca71ba08b7f0cce0`. CI seleccionada `/private/tmp/checkpass-specs/ci-selected.env`, modo0600, SHA256 `95376e14e84df68576d6f93ef07bdf449454b419b201f5956c15f1877e45a938`. Solo clavesCI; no valores de credenciales impresos. DB exclusivamente wrapper antiPROD, reserva serial mantenida durante teardown y `caffeinate -i` durante corridas. Logs redactados antes de disco.

| Check | Resultado observado |
|---|---|
| `tools/neon-test.sh src/modules/recipes/server/consumption-cost.neon.integration.test.ts src/modules/stock/stock-consumption.neon.integration.test.ts src/modules/stock/stock-average.neon.integration.test.ts --no-file-parallelism` | **25/25PASS**,3archivos, EXIT0;233.62s. Congelación tras compra/conteo/receta/replay, null/cero, compra entre cierre/aplicación, COP0.25, faltantes/pending, locales/comercios/archivado y regresiones0227/0228. Lote10000 aplicado6286ms dentro del presupuesto20s existente; sin modificar presupuestos. |
| Nuevo archivo0230 tras extraer montaje a soporte, mismo comando con solo ese selector | **5/5PASS**, EXIT0;74.50s. Revalidación por cambio de montaje, no retry de fallos; producto idéntico a primera corrida. |
| `tools/neon-test.sh src/modules/stock-consumption-cost-migration.neon.integration.test.ts --no-file-parallelism` | **2/2PASS**, EXIT0;7.82s. Hash CI real, reversión/reaplicación DDL transaccional, legacy sin backfill, EXPAND local nullable, metadatos parciales, negativos/no finitos/límites y compra/ajuste sin snapshot. |
| `pnpm --filter @mi-pasaporte/merchant exec vitest run src/modules/stock/server/consumption-cost.test.ts src/modules/recipes/server/consumption-snapshot.test.ts src/modules/modules-boundary.test.ts src/modules/modules-boundary-between.test.ts src/modules/modules-boundary-literals.test.ts` | **36/36PASS**,5archivos, EXIT0 sobre fuentes finales. Redondeo único USD/COP, suma mayor que columna de compra, estados/cobertura/legacy/monedas y fronteras. |
| Tipos DB/Merchant; ESLint de los10TS afectados; Prettier de esos TS; `git diff --check` | **EXIT0**, sin cambios de producto posteriores. Prettier no tiene parser SQL: un intento incluyéndolo se corrigió a selecciónTS; SQL/journal/snapshot conservan salida generada. |

Todos los comandos DB llevaron `NEON_TEST_ENV_FILE=/private/tmp/checkpass-specs/ci-selected.env`. Logs `/private/tmp/checkpass-specs/0230-functional-db.log`, `0230-functional-final.log`, `0230-migration-db.log`; resúmenes unit/tipos/lint/formato observados en salida de herramientas. Sin skips, retries del runner ni fallos de producto. No verify global/build por helper interno sin rutas/UI; QA independiente conserva su responsabilidad de entrega/combinación.

0085: journal `idx85`, timestamp `1792037544229`, SQL SHA256 **`7e17ff9b5b45f828b83c93a1082f02b1953625d6535b0555044df201e079c0fe`**, comprobado contra `drizzle.__drizzle_migrations` en CI. Teardowns finales completos; ningún servidor, proceso DB ni mundo de pruebas propio pendiente. Se avisó al coordinador para ceder turno DB antes de este informe.

## Integración y rollout pendiente

1. QA independiente usa SHA de producto anterior y configuración CI reservada; puede reutilizar20regresiones compatibles y reproducir decisivos de congelación/null/replay/redondeo/aislamiento. Sin main/push por esta entrega.
2. Coordinador alinea la DB usada por app local antes de integrar/arrancar el código nuevo. CI0085 no migra local ni Vercel. No se inspeccionó ni modificó local DB en este encargo.
3. Rollout futuro: inventariar consumos existentes, comprobar0228 inicializado y cortar/drenar writers de consumo antiguos de forma verificable; aplicar expansión y validar hash/constraints antes del writer nuevo. Mantener EXPAND0227/flag actuales; una activación no reconstruye cierres omitidos. Consumos legacy conservan cuatroNULL e incompleto; pendientes aún sin movimientos se valoran en su primera aplicación exitosa.
4. Rollback conserva columnas/snapshots/eventos; no borrar ni revalorizar consumos, ni rellenar costosNULL al volver. No mantener writers antiguos insertando snapshots ausentes indefinidamente. Cada push/migración PROD necesita autorización específica del owner.

El sandbox impidió inicialmente crear `index.lock` de este worktree; se avisó al coordinador y el stage/commit local autorizado se ejecutó con escalación, sin bypass de hooks ni operación remota. Hooks pre-push presentes; ninguna publicación intentada.
