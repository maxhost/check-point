# 0242 CP2a.1 — metadatos de catálogo y configuración dormidos

Base limpia confirmada antes de escribir: `b109a36540035e4f3de7bb9ea36e373289e37cce`; worktree `/private/tmp/checkpass-pos-0242/catalog-measure-storage-0242`, rama/task `catalog-measure-storage-0242`. Código/SQL/test congelados y CI ejecutada sobre `30c684348fbdb6558aca459563fff0bbe81db927`. Commit posterior añade únicamente este handoff, sin cambiar la identidad del código probado. Sin subdelegación, push, conexión local ni operación PROD.

## Cambio y contrato

`packages/db/src/schema/catalog.ts` añade `soldByWeight=false`, `pricingUnit=unit`, `salesRevision=1`, no null. Constraint permanente acepta únicamente false/unit o true/kg|lb|g, y otra exige revisión positiva. La constraint temporal `product_sale_measure_legacy_check` exige false/unit hasta CP2c. Todas las restricciones de tarifas/centavos/rango previas siguen intactas. No se habilitan productos mass, endpoints ni DTO/writers nuevos; los writers legacy conservan sus contratos actuales.

`packages/db/src/schema/sale-commission.ts`, sólo businessConfiguration: `salesMassUnits text[] NOT NULL DEFAULT ARRAY['kg']`, con constraint de dimensión1, cardinalidad1..3, sólo kg/lb/g, sin nulls y cada valor como máximo una vez. No cambia `businessId`, `revision`, mutex ni writers compartidos; la migración no inserta filas de configuración ni crea revisiones.

`0105_catalog_measure_storage_expand.sql` generado offline desde último journal real0104 mediante `pnpm --filter @mi-pasaporte/db db:generate --name catalog_measure_storage_expand`; ocho ALTER TABLE ADD, ninguna operación de reescritura comercial. SQL SHA256 `bc45625df27153b41a45aa96bc0798e39b9acfbac6d26a3604fd636af6a3f562`. Comparación semántica de snapshots0104→0105: exclusivamente core.product (3 columnas y3 constraints nuevas), core.business_configuration (1 columna y1 constraint nueva), id/prevId del snapshot. Cero columnas/checks previos alterados/eliminados y cero drift en las otras113 tablas o secciones del snapshot. Journal añade sólo0105. Único writer de journal en esta entrega.

## Evidencia offline

Node24.20.0, pnpm11.4.0, Vitest4.0.18. Dependencias propias del worktree; configuración y lock no modificados. Lock SHA256 `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821`; drizzle.config.ts `e53ee9595e5f28ecb1034088a2ead25255dfb9f42c6a6b1281707a37f69721cc`; merchant vitest.config.ts `073bf307a361c779b82c9b696e3918a5a1a8cdd0e01dd4838117470d654f7e81`. Vitest usa setup AI fake, sin OpenAI real.

- `pnpm --filter @mi-pasaporte/db typecheck`, domain typecheck y merchant typecheck: EXIT0. Merchant repetido sobre el código final congelado tras ampliar la prueba de writers legacy: EXIT0.
- ESLint focal schema/catalog.ts, schema/sale-commission.ts y test nuevo: EXIT0; Prettier focal de esos archivos/journal/snapshot: EXIT0; `git diff --check`: EXIT0.
- `node tools/ui-guard.ts --base b109a36540035e4f3de7bb9ea36e373289e37cce`: EXIT0,0 archivosUI y sin aumentos.
- Vitest focal `src/modules/pos/unit-expand-compat.test.ts` y `src/modules/pos/server/lines.test.ts`:46PASS,0FAIL/0SKIP. Se ejecutaron junto a guardias; el proceso conjunto salió1 por guardias, no se afirma EXIT0 de esa invocación.
- Guardias `src/modules/modules-boundary.test.ts`, `modules-boundary-between.test.ts`, `modules-boundary-literals.test.ts`: resultado final24PASS/2FAIL,0 nuevos offenders. Principal10PASS; between6PASS/1FAIL por `modules/expenses/server/immediate.neon.integration.test.ts → modules/stock/count.ts`; literals8PASS/1FAIL por cinco archivoscore: `app/backoffice/backoffice-context-controller.test.ts`(3), `app/backoffice/backoffice-context-refresh.test.ts`(1), `app/backoffice/onboarding/checklist-context-resource.test.ts`(1), `server/analytics/evaluation/policy-simulation.test.ts`(2), `server/analytics/lifecycle/index.ts`(1). Backlog exacto conocido, no PASS global.

La primera corrida offline de guardias tuvo23PASS/3FAIL: el test nuevo usaba image_source='stock' y disparaba una colisión literal con el id del módulo. Se corrigió la fixture a proveedor 'unsplash' antes del commit/CI; la segunda corrida volvió al backlog24/2. No se modificaron guardias ni expectativas para ocultar fallos. No hubo fallos de tipos, lint o pruebas puras.

## CI protegida, primera corrida y limpieza

El coordinador transfirió explícitamente la reservaCI mediante factory después del teardown de QA recipes-events. No se conectó DB antes de esa transferencia. Ejecución exclusiva y serial, incluyendo DDL/teardown, sobre SHA `30c684348fbdb6558aca459563fff0bbe81db927`:

```sh
source ~/.nvm/nvm.sh && nvm use
NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env tools/neon-test.sh src/modules/pos/server/catalog-measure-storage.neon.integration.test.ts --no-file-parallelism
```

Resultado EXIT0:1archivo,5PASS/0FAIL/0SKIP,25.63s totales,23.51s tests, primer intento. Log `/private/tmp/checkpass-pos-0242/private/catalog-measure-storage-ci-30c68434.log`. Wrapper validó interlock antiPROD y aplicó migración0105; la suite contrastó hash SQL canónico con drizzle.__drizzle_migrations por timestamp journal y verificó tipos/defaults/nullability/checks reales. Advertencia por URL del rolconsumer no configurada: estas pruebas no ejecutan ni certifican ese oráculo. Ninguna credencial abierta/impresa/copiada ni env productivo heredado.

Prueba nueva en `apps/merchant/src/modules/pos/server/catalog-measure-storage.neon.integration.test.ts`:

- Clona únicamente product/configuration a esquemaUUID propio mediante LIKE INCLUDING ALL. Retira columnas nuevas sólo de esas copias para reconstruir definición anterior; nunca retrocede ni elimina constraints de core real. Copia incluye todos los campos/defaults/checks/indexes previos (LIKE no copia FKs).
- Siembra producto histórico con IDs/categoría/negocio, tarifas máximas/0/null, imagen/atribución/disponibilidad y timestamps de microsegundos, más configuraciónrevision17 y negocio sin configuración. Ejecuta exactamente los ocho statements canónicos, sustituyendo estrictamente sólo identificadores cualificados de las dos tablas (incluidas referencias de CHECK), y comprueba ausencia de referencias core remanentes. Compara fila completa antes/después con tarifas como text y timestamps dentro de JSONB para no perder precisión. Defaults aplican a históricos e inserción legacy; revisión/configuración/ausencia se conservan.
- Retira únicamente de la tabla propia la barrera temporal y prueba los cuatro pares válidos del modelo final, combinaciones cruzadas y unidad desconocida. La barrera mass real permanece puesta y rechaza true/kg|lb|g en core.
- Negativos reales de revisión0/-1, camposnuevosnull y tarifas negativas/fuera de rango/no centavos/NaN; rechazos dejan el producto real idéntico. Configuración acepta las15 permutaciones no vacías de subconjuntos kg/lb/g y rechaza listas vacías, duplicadas, desconocidas, elementosnull, arreglonull y revisiones no positivas.
- Lectura regional ausente conserva fallbackrevision1 sin insertar configuración. Writer regional actual incrementa revisión17→18 y conserva unidades almacenadas lb/kg. Catálogo/POS leen null/0/máximo como antes; createProduct/updateProduct legacy funcionan sin campos nuevos y conservan metadata/tarifas. Se crea/lee ordenPOS con tarifa máxima×1 exacta.

Teardown pasó dentro de la corrida: DROP sólo del esquema propio; dropPosWorld; borrado explícito owner; aserciones owner/negocio/esquema ausentes. Todas las sesiones de comandos finalizaron. `ps` inicial fue bloqueado por sandbox; inspección escalada posterior autorizada mostró cero vitest/drizzle/servidores de este worktree (sólo el propio comando de inspección y shell ajeno con palabra drizzle en hints). Ningún servidor propio iniciado. Cero procesos propios y recursoCI comunicado liberable al coordinador; ninguna conexión posterior.

Git add inicial recibió index.lock EPERM del sandbox, avisado inmediatamente; escalación limitada a add/commit de los seis archivos propios permitió congelar el código. Sin operar ramas o índices ajenos.

## Entrega y límites

Cambian únicamente los paths reservados: dos esquemas, SQL/journal/snapshot nuevos, test nuevo y este handoff. No cambios de tooling/deps/kit/guardias/writers/estados/índices. Sin fullverify/build/browser/M0/M1 por ceremonia. Venta por peso y precisión tarifaria nueva siguen desactivadas; no se certifica activación CP2c.

Pendiente QA independiente sobre candidato congelado y aceptación por coordinador. Root aplica migraciónLOCAL protegida después de QA y antes del descriptor que exige las columnas; este autor no aplica migración local/PROD. Retengo fixes hasta aceptación. No quedan fixtures, procesos ni acciones DB pendientes del autor.
