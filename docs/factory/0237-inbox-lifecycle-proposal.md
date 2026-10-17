# 0237 — Ciclo de avisos y retención

El owner aprobó la propuesta de una tarjeta vigente por asunto, tres decisiones explícitas y memoria compacta del último contexto atendido; pidió un adversarial y un corte de limpieza para contener la tabla. Este documento concreta el diseño a revisar. El coordinador propone **90 días móviles para restos de avisos cerrados o vencidos y limpieza semanal**; nunca caducar pendientes por antigüedad. No implementado ni aplicado a DB. Spec 0237 vigente aún no se modifica; esta propuesta explicita los cambios posteriores a su cierre original.

## Avisos vigentes y decisiones

- Una tarjeta activa o pospuesta por comercio/tipo/sujeto (por ejemplo insumo+local). Datos posteriores actualizan esa tarjeta; no se inserta otra por cada día o venta.
- Solucionado e Ignorar cierran y eliminan el contenido de la tarjeta; el primero es declaración del owner, no comprobación automática. Visto es el cierre para tarjetas informativas. Navegar a Registrar compra/Ver cliente/etc. no cierra.
- Recordarme luego conserva identidad y contenido actualizado de la misma tarjeta, con la fecha/hora elegida; respeta la postergación, sin reavisar antes por cada nuevo dato. Si la condición deja de ser válida, se retira y cancela el recordatorio. No se inventa una política de escalamiento que anule la decisión del usuario.
- Se conserva un control compacto del contexto atendido, actualizado por asunto, suficiente para no reabrir al recalcular lo mismo. No guardar un registro de cada interacción ni un texto diario.
- En stock, menos existencia por un consumo posterior que agrava la escasez puede habilitar otro aviso después del cierre. Venta ajena al insumo, repetición del mismo evento o mero cambio de día no reabre. Reponer y luego volver a escasear habilita otro episodio. Nuevos conteos posteriores deben distinguirse de un replay antiguo. Cada tipo define el contexto relevante; no usar una revisión global del comercio.
- El tiempo sí puede constituir cambio relevante en tarjetas temporales como habitual ausente o fin de mes. No extrapolar la política de stock a todas las tarjetas. Conservar umbrales/mínimos y fuentes puras originales, salvo cambios aprobados de este ciclo de vida.
- Se mantienen cinco visibles, incluido resumen de ayer. Dentro de los otros cupos, riesgo de agotar stock en ≤24h tiene precedencia sobre invitaciones a completar información; novedad no vuelve invisible ese riesgo abierto. Solucionado/Ignorar/Recordarme luego siguen respetándose.

## Retención propuesta

1. No crear un historial nuevo para conservarlo 90 días. Tarjetas cerradas nuevas se eliminan al cerrar; el cron sirve de red de seguridad y para depurar restos históricos/vencidos que aún existan.
2. El corte es una antigüedad de 90 días desde cierre o vencimiento efectivo, no desde creación ni desde la última actualización automática. El 10 de abril de 2026, el corte por fecha es 10 de enero; febrero y marzo no se borran enteros. En ejecución se compara el instante UTC completo, estrictamente anterior al corte.
3. Pendientes y pospuestos quedan excluidos aunque tengan más de 90 días o el recordatorio sea para dentro de varios meses. La condición puede caducar por una regla explícita del tipo; cumplir 90 días no demuestra resolución ni vencimiento.
4. El control mínimo anti-repetición no se borra ciegamente a los 90 días. Se sobrescribe por asunto y solo se elimina cuando ya no puede hacer falta para impedir que un contexto atendido vuelva a entrar. Para sujetos ligados a períodos, se purga cuando su período dejó de ser elegible y no queda recordatorio/aviso/reconciliación pendiente; para condiciones persistentes se conserva su único control mientras sea necesario. No convertir ese control en un log diario.
5. Movimientos, eventos, contribuciones/revisiones y resúmenes numéricos del negocio quedan fuera de esta limpieza. No usar retención de notificaciones para borrar datos que alimentan histórico o deduplicación de eventos.

## Ejecución propuesta

Un job semanal, propuesto domingo 03:30 America/Guayaquil, solo ruta interna autenticada con el mecanismo ya existente. No configurar cron remoto ni PROD en esta revisión. Borrado por lotes acotados (propuesta inicial 500 filas y presupuesto 10s por invocación), retomable e idempotente. Omitir filas en uso y revalidar estado/fecha/control dentro de la transacción para no borrar una tarjeta que acaba de ser pospuesta o actualizada. Un fallo no debe perder pendientes ni obligar a un barrido/lock global; siguiente corrida retoma lo pendiente. El horario no define el corte por meses.

Reutilizar las tablas actuales con una migración acotada cuando exista encargo de implementación; no particionar ni archivar copias en otra tabla. Tener en cuenta que hoy card_candidate almacena snapshots diarios y sirve como entrada de tarjetas 5/9; no ejecutar DELETE sobre el modelo viejo sin adaptar antes esa dependencia. Rendimiento pendiente y harness del segundo ciclo siguen detenidos; esta revisión no opera DB ni mide.

## Contrato de adversarial

Solo diseño/lectura de código, sin implementación, tests, DB/API, procesos, migraciones, push ni main. Revisor independiente en worktree propio continuado desde dev; escritor únicamente docs/factory/0237-inbox-lifecycle-adversarial.md. No subdelegación ni editar specs/estados/índices comunes.

Intentar romper la propuesta con: aviso pendiente de seis meses; recordatorio futuro con más de 90 días; control cerrado viejo con condición idéntica aún elegible; reintento/arrival tardío de un evento antiguo; una venta de otro producto; nueva escasez tras reposición; ausencia del habitual sin evento nuevo; dato cambia durante postergación; condición resuelta antes del recordatorio; limpieza que compite con posponer/evaluación/delivery12; tarjetas 5/9 cuyo dato actual vive en candidatas; períodos vencidos y fallback de ayer; límite temporal exacto; fallo parcial/catch-up del job; crecimiento por asuntos frente a crecimiento diario. Identificar gaps reales, condiciones de aceptación y decisiones que aún requieren al owner. No declarar PASS de implementación ni suficiencia de performance por esta revisión.
