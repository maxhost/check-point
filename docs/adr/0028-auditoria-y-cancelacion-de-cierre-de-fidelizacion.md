---
fecha: 2026-08-12
resumen: Cada cambio operativo del programa de fidelización se audita en una tabla de eventos; el cierre fechado puede cancelarse antes de la fecha de canje y las ediciones concurrentes usan last-write-wins.
estado: aceptada
---

# ADR 0028 — Auditoría y cancelación del cierre de fidelización

## Contexto

El programa de fidelización (ADR 0027) es una fila mutable con transiciones
`active → closing → inactive`. En el futuro varios usuarios de un mismo negocio podrán
editar, cerrar o cancelar el cierre. Sin un rastro, no hay forma de responder «quién cambió
qué y cuándo», y las operaciones actuales devuelven éxito aunque la fila no haya cambiado
(por ejemplo si el estado cambió entre la lectura y la escritura). Además el cierre fechado
es hoy el único mecanismo para apagar un programa y es irreversible: un error de fecha deja
al Owner bloqueado toda la ventana de canje.

## Decisión

- **Auditoría por eventos.** Una tabla `core.loyalty_program_event` registra cada operación
  relevante: `created`, `edited`, `closing_scheduled`, `closing_canceled` y `expired`. Cada
  fila guarda el `program_id`, el `business_id`, el actor (`actor_id` a `merchant_auth.user`,
  nulo cuando el actor es el sistema/cron en `expired`), la `action` y un `details` jsonb con
  el detalle mínimo de la operación. Es append-only; no se edita ni se borra.
- **El evento se escribe sólo si la fila cambió.** Las escrituras usan `RETURNING id`. Si la
  actualización guardada por estado (`WHERE status = …`) no afecta ninguna fila, la operación
  falla con `409` en vez de devolver un éxito falso, y no se emite evento.
- **Cancelar el cierre.** Mientras el programa está `closing` y `ahora < redemption_ends_at`,
  el Owner puede cancelarlo: vuelve a `active` y limpia `earning_ends_at`/`redemption_ends_at`.
  Se permite durante toda la ventana de canje —no sólo antes de que deje de acumular— porque
  en esta etapa aún no existe emisión/canje real que revertir. Después de la fecha de canje el
  programa ya es (o será) `inactive` y no se puede cancelar.
- **Ediciones concurrentes: last-write-wins.** No se añade control optimista de versión para
  la edición de configuración/términos de un programa `active`. Dos ediciones simultáneas de
  owners distintos resuelven por última escritura; la auditoría deja el rastro de ambas. La
  protección de invariantes se limita al estado (`WHERE status = 'active'`), no al contenido.
- **Normalización de `configuration`.** El servidor persiste únicamente las claves válidas
  por modalidad (`unitSingular`/`unitPlural` para puntos; `unitName`/`target` y
  `stampImageObjectKey` opcional para sellos). Claves desconocidas enviadas por el cliente se
  descartan antes de guardar.

## Consecuencias

- Se puede reconstruir la historia operativa de un ciclo sin versionar la configuración.
- El futuro ledger y las vistas de administración leen los eventos para atribución.
- La cancelación mantiene el invariante de un único programa operativo por negocio: `closing`
  y `active` comparten el índice parcial, así que volver a `active` no crea una segunda fila.
- `last-write-wins` es una decisión consciente para esta fase sin saldos; si en el futuro la
  edición concurrente causa pérdida de trabajo real, se reevaluará con control optimista.

## Relación

Complementa ADR 0027 (programa mutable con cierre fechado) y sigue el énfasis de auditoría de
ADR 0007. No cambia el modelo de estados ni el de términos informativos.
