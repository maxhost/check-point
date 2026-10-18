# 0242 — CP2a.2 configuración de unidades, servidor

Estado: preparada, sin autor/reserva. Depende de metadatos catálogo0105 aceptados. Coordinador fija base/WT y autor nuevo/contexto vacío. No subdelegar. Leer protocolos, contrato0242 §2 y archivos pertinentes; no históricos completos.

## Entrega

Añadir GET/PUT `/api/business/sales-units` al catch-all existente, bajo requireApiPermission(request,'business'). GET retorna exactamente salesMassUnits/revision, defaultkg/revision1 si falta configuración sin insertar fila. PUT recibe exclusivamente salesMassUnits/revision, lista no vacía única de kg/lb/g, revisión positiva; desconocidos/duplicados/vacía/null o campos ajenos producen422 invalid_sales_units con fields.salesMassUnits conforme contrato. No modificar moneda/fiscalidad/timezone indirectamente. Revisión desactualizada409 business_revision_conflict.

Mismo mutex business-config/<businessId> y business_configuration.revision que regional/fiscal; comparar/incrementar/validar/escribir en una transacción. Conservar handlers regional/fiscal y su revisión compartida; GET no fabrica otra revisión. Los futuros writers catálogo/publicación usarán ese mutex antes de locks de recurso, pero no se conectan aquí. Retirar unidad referenciada por producto mass actual del mismo negocio devuelve409 unit_in_use con productos pertinentes autorizados; historia/snapshots no bloquean ni se borran. No nombres/imports de módulos concretos en business/core.

Respuestas de la ruta nueva privadas/no-store, incluidos errores guard/body/revisión/DB. Error seguro/tuteo. BusinessError puede extender metadatos opcionales tipados para fields/productos sin modificar CounterError compartido; serializar solo datos previstos. Preservar acceso owner/staff business y la no enumeración entre negocios. No implementar scopePOS en ruta business ni crear API alternativa.

Este corte no habilita mass ni precisión: la barrera temporal de0105 sigue intacta. Implementar consulta unit_in_use, pero la prueba sobre productos mass canónicos y su carrera con catálogo se ejecuta después de retirar barrera en candidato CP2c. No debilitar DB real ni insertar una fixture imposible para certificar ese negativo ahora; registrar ese límite explícito en entrega y mantener gate final pendiente. Las revisiones compartidas, validaciones, permisos y rollback sí se prueban realmente en esta entrega.

## Paths previstos

- apps/merchant/src/server/business/configuration.ts
- apps/merchant/src/server/business/http.ts
- apps/merchant/src/server/business/error.ts
- apps/merchant/src/lib/business-contract.ts
- apps/merchant/src/modules/pos/server/business-sales-units.neon.integration.test.ts, nuevo junto al harness business existente
- docs/factory/0242-cp2a-sales-units-api-handoff.md

Sin schema/journal, catálogo/importación, composición/publicación, UI/kit/tooling/deps/guardias/estados/índices. Si hacen falta otros paths/helper/test, pedir ampliación con razón antes de editar. No cambiar tests ajenos ni ocultar fallos.

## Gate

Node24, tipos domain/db/merchant, focales/lint/formato/diff/guardias pertinentes. CI exclusiva solo tras transferencia root, tools/neon-test.sh --no-file-parallelism/env privado seleccionado hasta teardown dueño/negocio/sesiones propias. Usar Request→businessHttp→guard→DB reales del harness, sin permisos mock. GET sin configuración no escribe; PUT válido crea/avanza una revisión; lectura de regional/fiscal refleja misma revisión y sus valores permanecen. Guardar regional/fiscal con revisión vigente vuelve obsoleta la intención de unidades y viceversa, sin sobrescritura ni inserción parcial. Dos PUT concurrentes con misma revisión: uno gana, otro409. Inválidos/campos ajenos preservan datos/revisión; acceso sin permiso401/403 y tenantB no alteraA. Respuestas nuevas privadas/no-store en éxito y fallos. Actualizar luego gate mass/carrera en CP2c, no afirmarlo probado aquí.

QA independiente sobre candidato congelado y evidencia SHA/config/runtime/resultados/fallos/skips/límites. Sin build/browser/M0/M1/fullverify por ceremonia. Commit limpio/cero procesos; factory/aceptación/integración del coordinador, sin push/PROD. UI business tercera sección y reconciliación de tres borradores corresponde a otro entregable con otro autor.
