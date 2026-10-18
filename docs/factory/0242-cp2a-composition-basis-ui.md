# 0242 — CP2a.8 base de composición y costo comparable en Recetas

Estado: preparada, sin autor/reserva. Iniciar solo después de aceptar servidor CP2a.6 y su QA combinado. Autor nuevo/contexto vacío; coordinador fija base/WT/paths. No subdelegar. Leer protocolos, contrato0242 §2/4, ficha/handoff CP2a.6 y COPY; contexto pertinente, sin historia completa.

## Resultado

En el editor existente de Recetas, mostrar y editar cantidad de producto que produce la composición y unidad unit/kg/lb/g. Capturar explícitamente basisQuantity string positiva9dec/límite nuevo, unit discreta, basisUnit y conversionVersion mass-si-1. Reutilizar helpers exactos aceptados, no Number como autoridad ni inventar equivalencia pieza↔kg. Cargar base desde composición; campos omitidos al editar nunca reinician una captura mass. Solo ausencia completa de metadata en DTO legacy representa1unit; metadata parcial/inválida bloquea guardado y permite reconsultar, no defaults silenciosos.

Permitir preparar base mass sobre producto todavía unit antes de cambiar modo en catálogo, y viceversa: esa preparación es parte del contrato. No limitar selector a unidad tarifaria ni unidades de captura de catálogo. La base de composición y la unidad tarifaria son conceptos diferentes. Nueva base define el producto obtenido por las recetas/cantidades seleccionadas, NO la unidad propia de los insumos ni el rendimiento de una receta de biblioteca. Cambiar base no escala automáticamente ingredientes/componentes/precio. No cambiar semántica del draft IA/yield ni su normalización aceptada; conservar biblioteca compartida y aviso de efectos sobre otros productos.

GET composición y PUT existentes, expectedRevisionId vigente; payload explicita base incluso si solo se cambia nombre/ingrediente. Actualizar compositionPayload de forma compatible con callers/tests anteriores cuando no dan metadata, pero nuevo editor envía captura explícita válida. Conserva cantidades/revisiones/posición/isCombo y no serializa floats. Confirmación nombra base del producto; no presenta ingredientes como si todos fueran para una pieza/kg cuando la composición produce otra cantidad. Diferenciar la unidad de receta de biblioteca del producto producido, especialmente componente multiplicador distinto de1.

Listado de costos muestra base declarada y unidad tarifaria a la que se refieren costo/precio/ganancia. Reemplazar el «por unidad» indiscriminado; no dividir costos en el browser ni recalcular márgenes con Number. Usar recipeMoney exacto/metadata servidor. costStatus incompatible_basis y rounded_to_zero se explican con copy operativo claro y nulls; no costo/profit0 ficticios. missing_costs conserva nombres de insumos y local; costo0 real completo sigue válido. Campos DTO opcionales solo por compatibilidad legacy, respuestas nuevas ya explícitas.

Errores422/409/red/5xx conservan base/componentes/ingredientes e intención. Conflicto de revisión exige revisar estado remoto antes de guardar explícitamente con nueva revisión; no overwrite/retry automático. Conservar borrador y mostrar diferencias pertinentes; si no existe producto no convertirlo en alta. No duplicar receta/insumos ya guardados cuando falle solo la composición: conservar savedBody/revisión/id y la advertencia partialSave vigente. Estado incierto tras red/5xx no repite publicación a ciegas: consultar estado/revisar antes de nueva intención. Bloquear doble submit y respuestas tardías de otro producto/local/modal;401/403 retira acceso/datos. No cambiar panelRequest compartido para esto: usar su error tipado existente.

UI refinamiento Operate existente con kit/COPY/guard. Impeccable aplicada, contexto root cargado una vez; no rerun/init/drift ni artefactos ajenos. Leer harden y craft-floor inmediatamente antes de editar. Sin nuevos nativos/handlers/style/paleta/CSS ni tocar kit/guard para evitar rojo. Se permite extraer campos/revisión del modal a componente propio para no aumentar tamaño/deuda del archivo ya grande; no refactor ajeno a la base.

## Paths autorizables

- apps/merchant/src/modules/recipes/ui/recipes-console.tsx
- apps/merchant/src/modules/recipes/ui/recipe-modal.tsx
- apps/merchant/src/modules/recipes/ui/recipe-types.ts
- apps/merchant/src/modules/recipes/ui/recipe-types.test.ts
- apps/merchant/src/modules/recipes/ui/recipe-requests.ts
- apps/merchant/src/modules/recipes/ui/composition-basis-fields.tsx, nuevo
- apps/merchant/src/modules/recipes/ui/composition-basis-draft.ts y composition-basis-draft.test.ts, nuevos si separan estado/validación
- tests/e2e/recipes-basis.spec.ts, nuevo
- tests/e2e/support/recipes-basis-harness.tsx y recipes-basis-fixture.ts, nuevos; reutilizar startCatalogHarness importado sin editar su tooling
- docs/factory/0242-cp2a-composition-basis-ui-handoff.md

Sin server/contracts/model/Stock/sourceIA/schema/journal/POS/business/catalog/kit/guardias/tooling/deps/panelRequest/estados/índices. Si hace falta otro archivo, pedir ampliación concreta a root antes de editar.

## Gate

Node24, tipos3/lint/formato/UIguard/guardias pertinentes, puros de base/compatibilidad real. Browser focal sobre UI real y API controlada: legacy1unit,2/10unit,base100g o1lb exacta, cambio/remontaje conserva metadata y multiplicador, fracción unit/0/exponente/>9dec rechazados, preparación incompatible permitida y costo incompleto visible, tiny vs costo0, conflicto conservando intención,401/403/error incierto/doble envío, fallo composición tras guardar biblioteca no duplica POST ni insumos, cambio de producto/local no contamina otro borrador. No fingir prueba HTTP/guard/DB real con mocks. El servidor ya tiene CI independiente; UI no usa DB por defecto.

Capturas390/1280 abiertas, ronda agrupada+una confirmación máximo. Servidor/puerto/artefactos propios; no3201/túnel/M0/demos. Logs completos privados con SHA/comando/exit, congelar código para checks, guardar fallos/skips/límites. No build/fullverify/M1 por ceremonia. Producto mass real, cierre y activación de precisión siguen CP2c, no retirar barreras. Entrega limpia/cero procesos; QA nuevo independiente, factory e integración del coordinador. Sin push/PROD.
