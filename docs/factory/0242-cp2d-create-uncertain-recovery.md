# 0242 — CP2d.3b conservar creación incierta durante recuperación rechazada

Estado: preparada, sin autor/reserva. Hallazgo de integración posterior a aceptar comandos7dd6: autor NUEVO/contexto vacío, no reusar autor retirado. Bloque de fix de helper, separado del editor visual ya en otro autor. Coordinador fija base/factory. Leer protocolos, contrato0242 create idempotente y helper/test actuales.

## Fallo reproducido

Sobre producto aceptado ba9f, create pierde respuesta después de posible commit y queda uncertain. Retry usa mismaUUID correctamente pero recibe403 (permiso cambió); helper pasa a rejected. Otra llamada create genera UUID2 y puede duplicar el recurso desconocido al recuperar permiso. Un rechazo de la petición de recuperación no demuestra que la primera petición no se haya confirmado.

Repro root externo: /private/tmp/checkpass-pos-0242/uncertain-retry-evidence/reproduce.cjs y reproduce.log, EXIT1 esperado con generated2/sentKeys key1,key1,key2. Dobla solo dependencia de contexto y transporte para aislar state; NO prueba auth/DB ni commit real. Primer intento del script falló por resolución TSX, setup-failure.log preservado, no evidencia de producto. El fallo de estado posterior sí es reproducible. No modificar este artefacto ajeno; usar evidencia propia fueraWT.

## Resultado

Crear conserva memoria de ambigüedad por intención POST. Tras haber quedado incierto, un error definitivo posterior en retry no libera otra UUID/cuerpo mientras no haya DTO canónico válido del recurso ni cambio REAL de identidad que retire la intención. No introducir GET/endpoint nuevo ni inferir ausencia por403/422/409. Mantener error autorizado completo para que editor explique el rechazo de recuperación y permita revisión/reintento explícito bajo misma captura. Sin retries automáticos ni persistencia fuera documento.401/context_changed siguen retirando para no enviar bajo otra identidad.

Primera petición que obtiene rechazo definitivo sin ambigüedad previa conserva semántica rejected/conflict vigente. PUT conserva su contrato: incierto reenviado con mismo body/version puede responder409version_conflict con orden actual para revisión; no convertirlo en éxito ni bloquear para siempre un conflicto resuelto. Una respuesta POST canónica utilizable resuelve la incertidumbre de identidad del recurso; conflicto local de cache_revision_ahead posterior debe seguir presentando revisión del recurso conocido, no perder DTO ni inventar éxito.

Proponer API interna mínima antes código, preferir flag de intento y transición correcta antes que framework de estados nuevo. Sin cambiar forma pública innecesariamente; coordinar con autor editor MeasuredEditorSession (coordinador comunica) si requiere propiedad explícita de incertidumbre previa. No reimplementar captura/transport/financial/cache.

## Paths autorizables

- apps/merchant/src/modules/pos/ui/measured-order-commands.ts
- apps/merchant/src/modules/pos/ui/measured-order-commands.test.ts
- docs/factory/0242-cp2d-create-uncertain-recovery-handoff.md

Sin cache/modelo/editor/console/transport/backend/contratos/kit/guardias/tooling/deps/estados/índices. Pedir extensión concreta antes editar otro archivo. Autor editor sigue sus paths en paralelo y recibirá fix aceptado antes QA de combinación.

## Gate

Node24 tipos merchant/lint/formato/UIguard y focales de helper real hasta fetch mocked: POST perdido→retry403/422/409 conserva MISMA intención y no genera nuevaUUID por create; reintento posterior canónico acepta mismo recurso; body/scope congelados pese mutación; primer403/422 sin incertidumbre sigue definitivo; cambio identidad retira y no reenvía; PUT perdido→version_conflict preserva revisión. Conservar46 regresiones aceptadas, no amplia batería ni browser por este fix. Sin DB/env/wrapper/build/browser/fullverify/M0/M1 ni nueva certificación auth nativa.

Evidencia SHA/base/config/comandos/exits/fallos/skips fueraWT; QA NUEVO independiente, autor conserva fixes; entrega limpia0procesos, factory/integración coordinador. Sin push/PROD/3201/túnel/M0/demos/artefactos ajenos.
