# 0242 — Revisión documental independiente

## Actualización al retomar

Owner resolvió: «No aplican a productos por peso. Gratis ni 2x1». Spec/anexo/ADR/plan actualizados en0e413c94 y revisión focal independiente conforme en42bf3422, incorporada en [QA CP0](0242-cp0-qa.md). El bloqueo monetario descrito abajo es histórico y está resuelto; no se captura peso bonificado. Spec funcional cerrada, CP0 ejecutable/M0 y QA de producto siguen pendientes. Leer [fichas vigentes](0242-cp0-launch.md); las revisiones siguientes corresponden al mapeo anterior.

2026-10-18. Agente QA en contexto fresco, solo lectura. Base de producto5f9cb2b2; reserva documentalec454681. Esta revisión valida especificación/plan contra lectura del código. No ejecutó tests, DB ni servidores y no certifica producto o rendimiento.

## Primera revisión: FAIL con dos bloqueos

1. Spec/anexo fijaban gratis/2x1 en masa como una unidad tarifaria1kg/lb/g sin una decisión monetaria del owner. El código actual solo define piezas enteras. Mostrar reglas/exclusión no resuelve el importe. Corrección: obtener respuesta sobre cantidad y fijar fórmula/preview/tests.
2. Business describía GET/PUT genérico sin recurso. El código expone /api/business/regional|fiscal con revisión compartida. Corrección: ruta exacta de unidades/body/response/revision/permisos/conflictos, más transporte de catalogRevision.

Sin otros bloqueos concretos: V3→V4, cantidades enteras POS/core, ledger Stock escala3, counter también Clientes, retiro de writers y suspensión canje, ciclo completo, compatibilidad y límites0238 concordantes. Observación menor: consumo positivo que redondea a cero debe seguir ADR0148 redondeo_sin_consumo/coste incompleto.

## Corrección y segunda revisión focal

**PASS focal del bloqueo2**. El contrato ahora define GET/PUT /api/business/sales-units, revisión/mutex compartidos, payload/respuesta, errores y sincronía de formularios. Catálogo tiene rutas/cabecera v2/salesRevision/catálogoRevision y writers concurrentes definidos. Hook genérico no rompe core/módulos. Se explicitó redondeo_sin_consumo. Ejemplo catalogRevision se cambió de opaque a3.

**Revisión global pendiente del bloqueo1.** Se envió una pregunta concreta al owner con tres alternativas: operador indica peso bonificado, usar una unidad tarifaria, o diferir bonificación automática. No inferir respuesta por tiempo o por aprobación general del laboratorio. La spec queda en borrador técnico y no autoriza implementar esa semántica mientras siga pendiente.

## Límites

El PASS focal no equivale a PASS global, QA de entrega ni QA combinada. CP0/contrato ejecutable/M0 y toda la implementación siguen pendientes. Check-numbers, enlaces de documentos y formato se verifican por el coordinador; no se presentan como validación financiera.
