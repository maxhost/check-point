# 0242 — CP2a.6 base explícita de composición y costo comparable

Estado: preparada, sin autor/reserva. Base común0104/expansor medido/consumidores aceptados. Autor nuevo/contexto vacío; coordinador fija base/WT. No subdelegar. Leer protocolos/contrato0242 §2/§4 y ADR0148 §3, código pertinente. El ajuste de lockRecipes business-config→proveedor es del writer catálogoV2; no tocar common.ts en paralelo y verificar ese combinado antes de aceptación final.

## Publicación inmutable

DTO de composición/preview/revisiones expone basisQuantity Decimal, basisUnit unit/kg/lb/g y conversionVersion mass-si-1 desde captura inmutable, sin inferir base por precio/nombre. Datos antiguos default1unit. PUT composición actual admite ambos campos de base explícitos juntos; cantidad positiva estricta9dec/límite nuevo, unit discreta, unidad conocida, conversión fija. Campos parciales/vacíos/null/0/negativos/desconocidos se rechazan sin publicar. Omitir campos por caller legacy conserva la base vigente capturada; solo ausencia real histórica de composición/slot representa1unit. No resetear una composición mass aunit porque el editor anterior omita campos. Producto mass sin base explícita ni base vigente válida exige measurement_basis_required, nunca inventar1unit.

Antes de cambiar unit↔mass de producto se permite preparar explícitamente la base nueva en Recetas, conforme spec. No inferir equivalencia entre pieza ykg. Revisión nueva conserva recipes/posición/isCombo/revision optimistic; resolución copia los tres campos de ESA revisión y fanout conserva la base al publicar otra resolución. Mantener punteros/FKs por negocio/immutabilidad/triggers y versión resource composition; no repuntar historia ni editar snapshot de venta. Cambio solo de pricingUnit mass no reescribe base. Los writers siguen usando lockRecipes y tx actuales; el lock común final incluirá business-config primero por entrega catálogoV2, no duplicar otro protocolo.

Read/preview valida coherencia revisión/resolución/base. Preview de composición describe ingredientes para la base declarada, no los presenta falsamente como una pieza/kg cuando producen otra cantidad; incluir metadata y conservar asignación/rounding existentes para cantidades de receta. No crear modo de vista/captura adicional no contratado.

## Costo de Recetas por la unidad tarifaria

listRecipeCosts compara cantidades equivalentes. Para producto unit, proyectar una unidad vendida contra base unit; para mass, una unidad tarifaria kg/lb/g contra base mass, con helpers racionales/expandMeasured aceptados y ledger3 una vez al final por insumo. No dividir un costo ya redondeado ni usar Number/toFixed. Stock mantiene unidad propia; precio/costo/profit/margen se refieren a la misma cantidad de producto. Base incompatible con modo vigente no produce costo/profit ficticio: metadata explícita de incompatibilidad y valores incompletos, sin inventar conversión unit↔mass. Tiny positivo que no genera ledger no equivale a costo0 completo.

Mantener ruta legacy basis1unit/tarifa histórica compatible sin cambiar sus cifras/estados. Tarifa nueva9dec usa originales exactos y normalización monetaria compartida solo para presentación/cálculo correspondiente, respetando currency/minorUnit y conservación legacy. Null/incompleto no se convierte en0. Nuevos metadatos de DTO pueden ser aditivos para callers/fixtures anteriores, pero respuestas reales siempre deben incluir base/unidad tarifaria necesarias; sin claves privadas. No cambiar dinero histórico ni normalizar DB.

La barrera real de producto mass y tarifa precisa sigue hastaCP2c. Probar proyección mass con helpers puros; CI canónica puede probar bases unit diferentes de1 y bases mass preparadas sobre producto todavía unit (incompatibilidad explícita), sin retirar constraints. Gate real de producto mass/precisión/cierre se completa enCP2c. No afirmar ese flujo probado ahora.

## Paths previstos

- apps/merchant/src/modules/recipes/server/contracts.ts
- apps/merchant/src/modules/recipes/server/model/input.ts
- apps/merchant/src/modules/recipes/server/model/publication.ts
- apps/merchant/src/modules/recipes/server/compositions.ts
- apps/merchant/src/modules/recipes/server/costs.ts
- apps/merchant/src/modules/recipes/server/measured-cost.ts y measured-cost.test.ts, nuevos si se necesita separar proyección pura
- apps/merchant/src/modules/recipes/server/composition-basis.neon.integration.test.ts, nuevo
- docs/factory/0242-cp2a-composition-basis-server-handoff.md

Sin common.ts/schema/journal/catalog writer/importación/Stock/consumers/producer/UI/kit/guardias/tooling/deps/estados/índices. Endpoints existentes llaman composition functions; no ruta alternativa. Si serialización de revisiones en otro archivo requiere cambio, pedir ampliación concreta antes de editar. No tocar helpers exactos aceptados para facilitar fixture.

## Gate

Node24, tipos3/lint/formato/focales/guardias pertinentes. Puros de bases y costo:1/2/10unit,100g/base1lb, kg/lb/g tarifarios, tiny/costo0/missing/incompatible, historia y moneda propia. CI exclusiva transferida por root, solo tools/neon-test.sh --no-file-parallelism/env privado hasta teardown owners/sesiones. Guard HTTP Recipes existente real y fixture propia con referencias válidas; permisos/tenant/optimistic revision/invalid bodies sin efectos. Publicación/cambio/fanout conserva snapshots previos y copia base a cada resolución; replay resource version no vuelve adefaults. Caller legacy sin base preserva captura vigente. Read/preview/cost se refieren a base correcta, unit2/10 costo comparable y base mass vs modo unit incompleta explícita. Regresión basis1unit de composición/costos compatible, sin fixture imposible ni constraints debilitadas.

Congelar SHA antes CI y guardar stdout completo con comando/SHA/exit real en archivo privado fuera WT; pipefail si tee. No fullverify/browser/build/M0/M1 por ceremonia. QA nuevo independiente del combinado catálogoV2/commonlock+estaentrega, evidencia compatible con límites/fallos/skips y sin afirmar integralverde por retries. Commit limpio/0procesos; factory/integración del coordinador; sin push/PROD. UI de base y catálogo por autores nuevos después de contratos aceptados.
