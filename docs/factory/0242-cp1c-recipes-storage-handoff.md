# 0242 CP1c.2 — almacenamiento de base/procedencia racional

Base: `86c5ad009e64b7a12e7088f482ed6d47c630f132`. Implementación exclusivamente aditiva, sin consumidores medidos, productores V4 ni backfill. Migración generada desde última entrada real0103: `0104_recipes_measurement_storage_expand`,15sentencias. JSONdiff semántico0103→0104: únicamente11columnas y3checks en `recipes.composition_revision`, `recipes.sale_resolution`, `recipes.consumption_source`; sin cambios a índices/FKs/triggers ni otras tablas.

Bases capturadas default1/unit/mass-si-1, positivas hasta999999999.999999999 y unit entera. Procedencia defaultV1 conserva proyecciones positivas y cuatro null. V2 requiere cuatro strings enteros canónicos positivos y proyecciones>=0; allocated>=0, sin NaN. Reducción de fracciones corresponde a aplicación futura.

Prueba nueva propia: clones privados pre0104 desde snapshot0103 y filas legacy reales; sustitución estricta de identificadores de tabla en migración canónica. Sin rollbackDDL global ni filas ajenas. Fixture legacy llama writers y consumidor existentes. FixtureV4 raw autorizado por coordinador solo en test:1g/base1lb, composición.001, ingrediente.001g; receta100/45359237 e insumo1/453592370, ambas proyecciones0. Referencias reales del mismo negocio; decoder comprueba payloadV4; no delivery ni consumidor medido. Teardown propio elimina esquema, negocio y owner y comprueba ausencia.

Evidencia inicial: Node24.20.0, pnpm11.4.0. Tipos db/domain/merchant PASS; lint PASS; guardias módulos24PASS/2FAIL: principal10PASS, between expenses→stock y literals cinco archivoscore idénticos al backlog de base; cero infractores nuevos. No se editaron guardias.

Candidato congelado antes de CI: pendiente de registrar. CI exclusivamente `NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env tools/neon-test.sh src/modules/recipes/server/model/measurement-storage.neon.integration.test.ts --no-file-parallelism`; ninguna DB local/PROD. Resultados y huellas se completarán tras ejecución.
