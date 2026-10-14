# Protocolo de tareas y candidatos

ADR0144. Se usa cuando conviene paralelizar tareas independientes de cualquier nivel; riesgo decide pruebas/documentacion, independencia decide concurrencia. No crear specs ni agentes por cada paso trivial. Specfuncional cerrada y contrato antes de implementar.

## Roles

- Coordinador prepara fichas, bases, paths/recursos y dependencias; unico integrador y escritor de indices/estado central. Dirige correcciones, verifica evidencia y prepara main local. PushPROD solo con autorizacion explicita.
- Dos implementadores trabajan UI/backend del encargo y tambien toman fixes. No subdelegan ni editan core compartido fuera de reserva. Entregan commits/evidencia focal, sin marcar implementada.
- QA independiente lee spec/diff y valida aceptacion/interacciones sobre revision congelada. Reutiliza evidencia compatible; reproduce señal decisiva si tiene dudas. No implementa el producto que certifica ni repite todo por ceremonia.
- Revisor especialista adicional solo por riesgo/duda concreta, dentro de capacidad/presupuesto.

## Ficha y estados

Ficha: taskID, objetivo/spec, baseSHA, worktree, paths, contrato/dependencias, aceptacion, checks, puertos/DB/artefactos y fuera de scope. Registrolocal .factory/registry.json; `tools/factory.ts` controla reservas/entrega/cleanup. No modificar el registro a mano durante ejecucion.

Tarea: preparada → ejecutando → entregada → QA(PASS/FAIL) → integrada en mainlocal → retirada. Commitentregado libera implementacion, no equivale a aceptacion. Correccion genera otra revision/handoff, con reproduccion y candidato. Bloqueada incluye dependencia; no es done. Candidato: congelado → verificando → requierecorreccion/listo → mainlocal. Publicado es otro estado, posterior a autorizacion/deploy confirmado.

## Secuencia

Preparar recursos comunes → despachar tareas → checksfocales/entregas → QA temprano → integrar serialmente en dev → congelar candidato → QAinteracciones y gates pertinentes → mainlocal → cleanup. La cola admite tareas nuevas mientras QA trabaja si hay recursos/worktrees disponibles. No actualizar un checkout por detras de una prueba ni publicar automaticamente.

Main local no exige la batería de publicación por defecto: reutilizar checks del autor y validar interacciones afectadas. Gates amplios solo por riesgo concreto o al preparar publicación autorizada. Ante un fallo, corregir y repetir el check afectado; no reiniciar toda la batería si la identidad de las demás evidencias sigue válida. Esta es la corrección operativa tras la demora del primer piloto.

Ante fallo: esperado/observado, reproduccion, categoria(producto/interaccion/setup/test) e impacto. Arreglo rutinario dentro de scope no exige specnueva. Cambio material de producto vuelve al owner. Tests obsoletos pueden actualizarse por comportamiento aprobado dejando motivo; no relajarlos para esconder unbug. Reintentos/skips no son aprobacion.

## Handoff breve

- TaskID y revision/base/SHAentregado.
- Archivos reales, contrato y dependencias.
- Criterios observados y comandos/resultados (incluyendo skips/limites).
- Fallos/pendientes, procesos que detener y siguiente paso.

Un archivo por entrega en docs/factory o referencia versionada de la spec. Solo coordinador actualiza estado/INDEX. Recuperar desde registro, refs, handoffs y procesos; nunca depender solo del historial de chat ni exigir clear en cada devolucion.
