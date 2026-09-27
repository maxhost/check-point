---
adr: 0095
fecha: 2026-09-26
estado: aceptada
resumen: El push de campaña es un CANAL de una plantilla, no un tipo de campaña. Una plantilla (#3/#5) corre por proximidad, push o ambos (default ambos); el compositor custom sigue solo en proximidad. Cada envio decidido es una fila `core.campaign_push` (holdout 10 %, como la proximidad) que encola un `campaign` en `wallet_push_queue`; la cola lo entrega con el mismo criterio que el transaccional (wallet alcanzable, si no Web Push, nunca los dos), solo dentro del horario del negocio (9–21 por defecto, editable) y re-chequeando al entregar (campaña activa, sin opt-out, sin visita desde que se decidio). Convivencia por GRUPOS fijos de plataforma: una plantilla no se envia si el cliente ya recibio, desde su ultima visita, un push de ella o de una de mayor rango de su grupo (#5 > #3). Conversion = compra dentro de 7 dias del envio contra el holdout. El click se registra solo por Web Push.
---

# 0095 — El push de campaña es un canal de la plantilla

## Contexto

La clase `campaign` de `consumer.wallet_push_queue` existe desde el ADR 0037 y **no tiene productor**:
su transporte es un fan-out provisional (`wallet/push-transports.ts:211`). Las plantillas #3/#5 de la
spec 0101 corren solo por proximidad, que alcanza al cliente cuando pasa cerca de una puerta con
coordenadas y tiene pase. 13 de las 16 campañas del catalogo (ADR 0091) necesitan push.

Decisiones del owner que este ADR consume (2026-09-26, en `docs/TASKS.md`): transporte = el del
transaccional; registrar clicks «si es posible»; grupos estilo Talon.One fijos de plataforma (#4 > #5
> #3); SIN tope global ni tope de 7 d «hasta que entendamos como aplicarlo»; horario editable por
negocio, 9–21 por defecto, solo para push de campaña; «al activar siempre se muestra el editor … puede
cambiar … entre proximidad, push o ambos»; proximidad y push independientes. Y las cuatro de la B1
(AskUserQuestion, mismo dia): conversion a **7 dias**; **mismo mensaje** en los dos canales; push
**solo en plantillas**; `enable` sin canales → **ambos**.

## Decision

1. **Canal, no tipo.** `core.campaign.kind` sigue siendo `proximity` (el tipo describe la AUDIENCIA,
   ADR 0064 §2); los canales son dos columnas `channel_proximity`/`channel_push` con al menos uno en
   `true`. El compositor crea siempre `proximity=true, push=false`.
2. **Una decision de envio es una fila.** `core.campaign_push` = «el tick decidio avisarle a ESTE
   cliente por ESTA campaña», con `holdout` (10 %, el mismo sorteo que el turno). El holdout se
   registra y no encola nada: es el grupo de control. El no-holdout encola una fila `campaign` y guarda
   su `queue_id`.
3. **La cola es el outbox; la campaña decide al ultimo momento.** Al reclamar una fila `campaign`, el
   worker pregunta a marketing si todavia corresponde: si la campaña dejo de estar activa o vencio, si
   el cliente se dio de baja o perdio la membresia, o si **compro desde que se decidio el envio**, la
   fila se **cancela** (estado nuevo `cancelled`). Fuera del horario del negocio, se reprograma al
   proximo inicio del horario. Un aviso decidido a las 20:55 que sale a las 21:05 no sale: sale a las 9.
4. **Transporte = el del transaccional** (ADR 0040): wallet si hay pase alcanzable, si no Web Push,
   nunca los dos. El fan-out provisional se borra.
5. **Grupos.** Cada plantilla declara `group` y `rank` en el catalogo (codigo, no base). Una plantilla
   no decide un envio para un cliente que, **desde su ultima visita** (su ultima compra en el negocio, o
   su alta si nunca compro), ya tiene un `campaign_push` no cancelado —holdout incluido— de ella misma
   o de una plantilla de rango MAYOR o IGUAL del mismo grupo. Escala (#3 → #5), nunca baja (#5 → #3).
   En un mismo tick se evalua primero el rango mayor. El holdout cuenta como «ya decidido»: si no, el
   control se re-sortearia cada 6 h hasta terminar recibiendo el push.
6. **Horario.** `core.business.push_window_start_hour`/`push_window_end_hour` (inicio 0–23, fin
   1–24, `start < end`, 9/21), en la `timezone` del negocio, intervalo `[start, end)`. Solo lo lee el push de campaña.
7. **Texto.** Titulo = nombre del negocio; cuerpo = `campaign.message` y, si la campaña tiene cupon,
   ` · {coupon_label}`. Se congela al encolar.
8. **Cupon.** El push emite un `campaign_coupon` (ADR 0093) **al entregarse**, con procedencia
   `push_id`, vigente hasta `ends_at` (ADR 0094). No se emite si el cliente ya tiene un cupon de esa
   campaña sin canjear — *(ORQUESTADOR: el ADR 0093 le delego esta regla a la B1; se informa al owner
   al pedir el OK)*.
9. **Medicion.** Conversion = al menos una compra en el negocio dentro de los **7 dias** posteriores al
   envio (`sent_at`; para el holdout, la decision). Se compara contra el holdout con la misma formula y
   el mismo piso de 30 que la proximidad (`estimateEffect`). El click es **observado y solo Web Push**
   (el pase del Wallet no informa aperturas).

## Consecuencias

- **Sin tope global, la frecuencia la ponen las reglas del grupo:** un cliente dormido recibe a lo sumo
  un push de «Te extrañamos» y uno de «Recuperar perdidos» por cada ausencia, por negocio. Con N
  negocios, hasta 2·N. *(Consecuencia a declarar, no decidida por el owner.)*
- La cola gana `cancelled`, y `pass_refresh`/`transactional` no lo usan nunca.
- «Ultima novedad» del pase (`consumer_account.latest_message`, compartida entre negocios) pasa a
  mostrar tambien avisos de campaña: es como Apple muestra un push de pase.
- Una plantilla solo-push no necesita puertas con coordenadas: el `409 no_usable_location` aplica solo
  si incluye proximidad.

## Alternativas descartadas

- **`kind = 'push'` como tipo aparte.** Duplica audiencia, plantillas y resultados por canal, y el owner
  pidio elegir el canal dentro del mismo editor.
- **Cancelar en el tick en vez de al entregar.** El tick corre cada 6 h y el worker cada 5 min: una
  visita, una baja o un apagado entre medio mandarian el push igual.
- **Emitir el cupon al encolar.** Un envio cancelado dejaria un cupon que el cliente nunca vio.
