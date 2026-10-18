# 0242 — CP1c.0 contrato/decoder V4 dormido, sin conectar productores

Estado: preparada; código solo con reserva concreta y autor nuevo/contexto vacío. Entrega pura independiente de la expansión física en curso; no declara terminado CP1c ni conecta subscribers. Leer AGENTS/protocolos, anexo0242 §4 y helpers medidas/financial pertinentes, esta ficha y tipos/decoder/tests actuales. Sin históricos ni subdelegar.

## Contrato y corte seguro

Definir `SaleClosedEventV4` derivado de V3: eventVersion4, quantity decimal string y measure explícita por línea, conservando sourceLineId/productId/resourceVersions/position/money/discountOrigin/productLabel/commissionMinor/pagos. No añadir campos no acordados por analogía con DTO de orden: el evento anterior no lleva unitPrice; los originales monetarios auditados conservan su contrato. No inventar dinero financiero para V1.

Para no forzar la adaptación de todos los consumidores en este mismo bloque, conservar `SaleClosedEvent` y `decodeSaleClosedEvent` actuales como entrada legacy V1–V3. Añadir unión explícita `MeasuredSaleClosedEvent` y `decodeMeasuredSaleClosedEvent` para V1–V4. El nuevo decoder reutiliza validación legacy y núcleo financiero existente, sin duplicar reparto/cálculo monetario. No cambiar `CapturedModuleEvent`/suscripción legacy ni wiring de productor/consumidores en esta entrega. Migración gradual posterior usará la entrada nueva; el corte final de activación será explícito y compatible.

La unión wire es `SaleClosedEvent | SaleClosedEventV4` y el decoder nuevo devuelve el payload validado sin cambiar shape/identidad. La vista explícita separada `MeasuredSaleClosedEventView {payload,lines}` y helper `toMeasuredSaleClosedEventView` pueden normalizar cantidad/medida en copias de líneas; `payload` conserva el objeto original. No etiquetar una copia normalizada con quantity string como payload durable histórico V1–V3.

El decoder no decide por typeof string ni UUID: V4 exige shape/version/measure y cantidad válida; V1–V3 conservan cantidad unit histórica. Una medida V4 ausente/inválida jamás activa fallback legacy. Rechazar versiones desconocidas, IDs/refs/fechas inválidos, sourceLineId repetido, pagos/financial inconsistente y metadatos V3/V4 ausentes. Si se proporciona versión externa de envelope, exigir coincidencia con payload; no reinterpretar payload para arreglarla.

No estrechar el contrato anterior de cantidad safeInteger de V1–V3 al crear su vista: el límite INT32 de snapshots DB no sustituye la validación histórica del decoder legacy. La entrada V4 medida sí usa su contrato explícito; no elegir permisividad por typeof string.

V4 unit de historia confiable conserva cantidad INT32 y medidas coherentes; mass valida límites de captura9dec/unidades/conversión. Usar helpers existentes, no ensanchar parserHTTP. Una vista/helper medido de líneas legacy puede exponer quantity string y medida unit mediante copia explícita y versionada, sin mutar/regrabar el payload original ni fabricar evidencia financiera de V1. No introducir número JS en cálculos de masa/dinero ni reconstruir racional desde una proyección redondeada.

## Paths previstos

- `apps/merchant/src/server/module-events/types.ts`, solo nuevos tipos exportados sin ampliar aún el tipo usado por subscribers legacy
- `apps/merchant/src/server/module-events/decode.ts`, validación compartida legacy/nueva sin cambiar comportamiento anterior
- `apps/merchant/src/server/module-events/decode.test.ts`
- `apps/merchant/src/server/module-events/decode-measured.test.ts` nuevo
- `docs/factory/0242-cp1c-decoder-handoff.md`

Fuera: publish/append/index/retry/subscribers, schema/migraciones/DB, Recetas/Stock/analytics/POS operacional/UI/auth/kit/tooling/deps/estados/índices. Pedir ampliación antes de editar; reserva heredada no autoriza paths viejos. No producerV4 ni masa operativa.

## Aceptación y evidencia

Fixtures V1/V2/V3 siguen decodificando por la API anterior con igualdad completa y sin cambio/mutación del objeto; financial legacy no se inventa. API medida valida también esos tres y V4 con unit/mass/mezcla, quantity string explícita,1lb/gramos/conversiones exactas usando medidas, total0/pagosvacíos, monedas0/2 y originales racionales válidos. Negativos de versión/payload/envelope, measure ausente/incoherente, string bajo versión antigua, qty fraccional unit/captura inválida, overflow y financial/pagos/metadatos corruptos. V4 nunca se acepta por decoder legacy ni se publica accidentalmente por añadir un tipo.

Node24; Vitest decoder antiguo+nuevo y regresión focal financial/measure afectada, tipos merchant/domain, lint/formato/diff/boundary pertinente. Sin Neon/build/browser para este bloque puro. QA independiente nuevo sobre candidato congelado, evidencia SHA/base/runtime/lock/config/comandos/resultados/fallos/skips/límites. Autor commit limpio y termina al aceptar; próximos consumidores requieren otras fichas/autores. Sin push/PROD.
