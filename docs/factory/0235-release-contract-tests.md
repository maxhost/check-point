# 0235 — Contratos de módulos y evento legacy después del traslado a core

Task/rama `negocio-release-contract-tests`, worktree `/private/tmp/checkpass-negocio-followups/negocio-release-contract-tests`, base `3fbcd8a6ad969dbde01087cacd734193abfb3d11`. Corrección exclusivamente de cinco suites y este handoff, por contratos obsoletos detectados en el pre-push real. Sin runtime, migraciones, guardias, índices, estados ni operaciones PROD;0mutaciones.

## Señal y correspondencia con el diseño aprobado

Código congelado: `80b724bcb944f9b661774d81df7ab27e7fce038e` (primeras tres suites) y `a855777314f760a3ddd09d59cb9ea6179f29982f` (ampliación histórica) y `f0a7a8f039a0d0f3e95d7a791d1e9b5b2c7eab38` (contrato de consumo; incluye los anteriores).

El log `/private/tmp/checkpass-negocio-release/prepush.log` muestra tres aserciones previas al traslado0235: conteos de tablas POS7/Rentabilidad5, descripción de Rentabilidad con comisiones y ACKs legacyv1 aplicados2. Se verificaron schema, migración0093, manifest y registro de suscriptores actuales antes de editar.

- `modules-fk`: las dos tablas de medios dejan POS; las dos tablas de comisión dejan profitability. Ahora se exige POS5 y profitability3, con nombres exactos de cada tabla operacional/de costos, además de comprobar que las cuatro tablas trasladadas existen exclusivamente en core. No se reemplazan los conteos por mínimos ni se ignoran tablas inesperadas. Recetas/Stock conservan el piso previo. El CONTROL que crea una FK prohibida en transacción y el rechazo core→módulo permanecen intactos.
- `modules-registry`: se actualizan ambas descripciones exactas de Rentabilidad al manifest aprobado («Costos fijos y sueldos de tu negocio» / «Ver y editar costos fijos y sueldos.»). El registro sigue llamándose `profitability`; no se implementa el renombre a Gastos. Todos los DTOs, orden, permisos, guards, dependencia, idempotencia, conservación de insumos y aislamiento se mantienen.
- `module-events`: un evento v1 **recién publicado** en este candidato solo crea la obligación `recipes`; el cálculo de comisión de nuevos cierres es core/sincrónico y profitability ya no declara ese suscriptor. Se verifica la lista exacta de deliveries antes (recipes/pending) y después (recipes/applied con fecha), y el resultado exacto claimed1/applied1/pending0/failed0. No se limita a bajar un contador. Se conservan consumo legacy0,500, costo3,50, ausencia de sources modernas y comisión incompleta/null con `commission_legacy_event`; ninguna tarifa actual rellena el evento. No se modifican deliveries históricas pendientes ni se marcan aplicadas/skipped.

- `profitability-migration`: la inspección de la fase aislada aún no alcanzada detectó referencias al almacén de comisiones anterior. El replay se limita al límite real0086/0087 de costos/personas, conserva ambos hashes de migración y todas sus aserciones de backfill, sesión/permisos, fechas e infinitos, dinero y rollback. No elimina los objetos de comisiones trasladados a core; exige los mismos OIDs de ambas tablas y función inmutable, más hashes de filas antes/dentro/después del replay y rollback. Así mantiene el trigger del header de venta que también depende de `core.p1_immutable()`. Este hallazgo por inspección se separa de las tres fallas observadas en el log.

- `recipes/server/consumption-cost`: el pre-push completo también observó el contrato anterior de una delivery no-recipes en skipped. Ahora el oráculo consulta todas las obligaciones de ese evento y exige exactamente recipes/applied; no permite ni una obligación retirada extra ni una aplicación de consumo faltante. Conserva claim vivo, compra/pre-drain sin consumo anticipado, costo COP completo/0 y acumulación, congelado, desconocidos, aislamiento y reintentos recuperables.

## Comprobaciones

Node24.20.0/pnpm11.4.0, lockfile sin cambios. Merchant typecheck final, ESLint focal de los cinco archivos, Prettier focal y diff-check: EXIT0. Tipos sobre `f0a7a8f0`: `/private/tmp/checkpass-negocio-followups/release-contract-types-final.log`; ampliaciones previas en `release-contract-types.log` y `release-contract-types-migration.log` del mismo directorio.

El coordinador transfirió `db:modules-ci` después de terminar el pre-push rojo y su teardown. Cuatro invocaciones consecutivas, sin concurrencia, usando exclusivamente `tools/neon-test.sh` y el archivo CI seleccionado `/private/tmp/checkpass-recipes-margin/0234-ci.env` (sin copiar ni imprimir valores). Todas sobre `f0a7a8f039a0d0f3e95d7a791d1e9b5b2c7eab38`:

| Selección relativa a merchant, seguida de `--no-file-parallelism` | Resultado | Log/JSON |
| --- | --- | --- |
| `src/modules/modules-fk.neon.integration.test.ts src/modules/modules-registry.neon.integration.test.ts` | 2 archivos,10/10, EXIT0 | `catalog-contracts` |
| `src/modules/module-events.neon.integration.test.ts` | 1 archivo,5/5, EXIT0 | `sale-delivery-contract` |
| `src/modules/recipes/server/consumption-cost.neon.integration.test.ts` | 1 archivo,5/5, EXIT0 | `frozen-consumption-contract` |
| `src/modules/profitability-migration.neon.integration.test.ts` | 1 archivo aislado,2/2, EXIT0 | `profitability-history` |

Total real: **5 archivos,22/22,0 skips,0 retries**; presupuesto0mutaciones. Cada invocación también migró CI mediante el wrapper con EXIT0. El runner propio `/private/tmp/checkpass-negocio-release-contract-tests/run-focal.mjs` ejecuta `bash tools/neon-test.sh <selección>` con el env seleccionado en memoria; sanitiza credenciales/URLs DB antes de persistir stdout/stderr. Los cuatro pares `.log`/`.json` del mismo directorio guardan comando exacto, SHA, hashes de los cinco fuentes, fechas UTC, señal y EXIT. Ventana completa: `2026-10-17T02:52:05.444Z`–`2026-10-17T02:55:26.923Z`.

Las cuatro sesiones y sus teardowns terminaron antes de avisar al coordinador que el recurso estaba libre. La comprobación de procesos propios, con escalación local porque `ps` estaba bloqueado por el sandbox, confirmó que no quedaban Vitest/wrapper/runner de este worktree. Sin más DB en este encargo.

La evidencia corresponde a la corrección focal local, **no declara verde el pre-push global ni el CI remoto histórico**. El hook anterior permaneció rojo y no transmitió el push; la combinación y el nuevo hook corresponden al coordinador. Sin push adicional ni operación PROD por esta entrega.
