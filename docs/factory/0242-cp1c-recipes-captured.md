# 0242 — CP1c.3 captura medida y procedencia de Recetas, sin suscripción V4

Estado: preparada, todavía sin autor/reserva de código. Entradas obligatorias: expansor racional y almacenamiento0104 aceptados por QA independiente e integrados. El coordinador fijará baseSHA y WT al reservar. Nuevo implementador/contexto vacío; no acumular esta entrega en los autores anteriores. Leer protocolos, contratos0242 §4, ADR0148 §3 y archivos pertinentes.

## Resultado y límite

Preparar un camino explícito para resolver consumos desde eventos medidos capturados y persistir ambos racionales. Las suscripciones vigentes y el productor siguen legacy: no conectar V4 a runtime, Stock ni analytics en esta entrega. El circuito unit actual debe conservar su comportamiento y replay. No ampliar el union legacy del framework para hacer compilar consumidores incompatibles.

Añadir `capturedMeasuredConsumption` separado del entrypoint legacy. Recibe `MeasuredSaleClosedEvent` validado; versiones1–3 delegan al camino legacy sin convertir su cantidad safeInteger por el parser nuevo. Para V4, resolver exclusivamente referencias capturadas del mismo negocio/producto. Composición usa su resolución inmutable, base y revisiones guardadas con `expandMeasuredComposition`; nunca receta/base actual, precio ni catálogo. Unit V4 usa el camino explícito de snapshot INT32 confiable del expansor. Masa usa el contrato estricto de captura. No agrupar entre líneas.

La referencia legacy `slot:recipe` solo representa base1unit: V4 unit puede conservar ese significado mediante validación explícita de entero confiable; V4 mass con ese slot falla antes de cualquier escritura. No inferir una base mass para historia. Slots duplicados/conflictivos y resolución/revisión ajena o ausente fallan. Sin referencia válida, conservar el estado de receta ausente para costo; no fabricar consumos.

Sources medidas guardan quantityVersion2, los cuatro textos racionales reducidos y proyecciones3/6/3 del expansor. Legacy mantiene quantityVersion1 y cuatro null sin inventar racionales históricos. Movimientos solo para ledger3 positivo; ingredientes positivos que redondean0 mantienen sources y `roundingOmissions`, nunca costo completo ficticio. Respetar `incompleteRecipe` y estado de receta actuales.

`persistProvenance` acepta el contexto mínimo estructural id/businessId/payload(sourceOrderId,locationId), compatible con llamadas actuales y futuras medidas, sin editar tipos del framework. Normalizar explícitamente versión1/null al comparar con DB, preservar IDs/uniqueness y no sobrescribir historia. Replay idéntico no duplica; diferencias en cualquiera de los cuatro racionales, versión, referencias o proyecciones producen conflicto y rollback. No reconstruir ratios desde decimales ni comparar mediante Number. Mantener seguridad tenant y validación de fracciones reducidas/positivas por helpers existentes.

## Paths previstos

- `apps/merchant/src/modules/recipes/server/model/captured.ts`, únicamente tipos comunes/exportaciones necesarios; entrypoint legacy preservado.
- `apps/merchant/src/modules/recipes/server/model/captured-measured.ts`, nuevo camino explícito.
- `apps/merchant/src/modules/recipes/server/model/provenance.ts`.
- `apps/merchant/src/modules/recipes/server/model/captured-measured.neon.integration.test.ts`, nuevo.
- `apps/merchant/src/modules/recipes/server/model/consumption.neon.integration.test.ts`, ampliación del coordinador tras reproducción: tres expectativas obsoletas de1delivery frente a2 reales (Recetas/core.analytics); exigir resultado exacto y ambas deliveries, conservar aserciones de ledger/costo/procedencia. Limpieza propia comprobable, sin alterar helper común.
- `apps/merchant/src/modules/recipes/server/consumption-event.ts`, ampliación posterior por fallo real de replay: evitar segundo append de recipes.consumption.applied ya existente para el mismo negocio/orden; validar identidad de envelope/payload y conservar evento/deliveries/observedAt originales. No cambiar versión/shape, costos, política de analytics ni framework. No capturar unique-violation para fingir éxito.
- `docs/factory/0242-cp1c-recipes-captured-handoff.md`.

Sin schema/migraciones/journal, publicación/composiciones/UI, subscriptions/metrics, framework/retry/producer, Stock/analytics, auth/kit/tooling/deps ni estados/índices. consumption-event solo admite el arreglo de replay anterior; no contrato V2 ni medidas todavía. Solicitar ampliación justificada de paths antes de editar. Otro autor conectará la cadena cuando los eventos derivados y analytics distingan masa/piezas.

## Gate y evidencia

CI protegida exclusiva por `tools/neon-test.sh`, incluida limpieza; Node24. Fixture con evento V4 raw persistido solo de test, líneas identificadas en payload y referencias reales/coherentes del mismo negocio a producto/insumo/recetas/composición/resolución/revisiones. SourceOrderId/sourceLineId son UUID capturados del contrato, sin exigir filas POS/core en este bloque dormido: no inventar un productor de masa mientras existen barreras unit ni importar POS en Recipes. Registrar esa limitación, sin llamarlos órdenes/líneas DB reales; cierre end-to-end con órdenes reales sigue siendo gateCP2c. No publicar V4 con productor de runtime. Comparar unit versiones1–3 con camino actual y V4 unit equivalente; caso1g/base1lb conserva factor y ambos racionales, dos fuentes/insumo consolidan por línea; venta mixta y dos líneas del mismo insumo no se mezclan. Caso positivo diminuto guarda proyecciones0, ningún movimiento y costo incompleto por redondeo. Verificar que cambiar receta vigente tras capturar no altera resultado.

Persistir y releer los cuatro textos exactos. Replay idéntico mantiene IDs/conteos; racional cambiado aun con mismas proyecciones falla sin filas parciales. Negativos tenant/producto/revisión/slot legacy mass/base incompatible y ratios inválidos. Conservar regresión legacy de provenance y consumo; no retocar suites ajenas ni fixtures imposibles para ocultar fallos. Tipos db/domain/merchant, lint/formato/diff y tres guardias de módulos con backlog separado de nuevos offenders. Sin build/browser/M0/M1.

QA nuevo sobre candidato congelado registra SHA/base/runtime/config/SQL y resultados reales, fallos/skips/límites, teardown completo y0 procesos. Autor entrega commit limpio y handoff; factory/aceptación/integración del coordinador. Sin push/PROD. Esta entrega por sí sola no habilita masa ni V4.

## Recuperación de implementador por capacidad del servicio

El primer autor dejó cuatro archivos propios sin commit y terminó por error de capacidad del modelo. Root verificó0procesosCWD, preservó archivos/hash/patch en `/private/tmp/checkpass-pos-0242/captured-capacity-recovery` y mantuvo la reserva. Su corrida `/private/tmp/captured-neon.log` acabó4FAIL/5PASS: un fixture nuevo esperaba una fuente cuando la composición produce dos; tres fallos legacy eran expectativas delivery1→2. No se cuenta comoPASS. El sustituto parte de esos archivos preservados, no los descarta ni interpreta como cambio ajeno sin dueño; revisión nueva y correcciones necesarias siguen el mismo bloque acotado. CI permanece exclusiva hasta teardown.
