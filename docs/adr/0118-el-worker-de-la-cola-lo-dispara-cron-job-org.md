---
adr: 0118
fecha: 2026-10-03
estado: aceptada
resumen: El worker de la cola de avisos (`GET /api/internal/wallet-push`) lo dispara cron-job.org cada 10 min, solo de 7:00 a 18:00 hora de Guayaquil, editable en su pantalla sin deploy; se borra el GitHub Action que lo disparaba (medido cada 2,4–7,8 h). Neon duerme el resto. Consecuencias aceptadas por el owner: los avisos diferidos de despues de las 18:00 salen a las 7:00, y el recordatorio del dia sin compra cuya hora cae despues de las 18:00 no sale.
---

# 0118 — El worker de la cola lo dispara cron-job.org, de 7 a 18

## Contexto

El aviso de mostrador sale en el momento: se despacha inline con `after()` (`dispatchGranted`,
`apps/merchant/src/server/wallet/push.ts`). Todo lo **diferido** de `consumer.wallet_push_queue` —una campaña detras de
la separacion de 3 min, los reintentos, el recordatorio del dia sin compra (spec 0111, que se planifica dentro del
worker) y desde la spec 0143 el «regalo misterio» de la Venta cruzada— sale solo cuando corre el worker.

En Vercel Hobby un cron nativo solo puede ser diario, asi que lo disparaba `.github/workflows/wallet-push-cron.yml`
con `*/5`. **Medido el 2026-10-03** por la API de Actions: en las ultimas 40 corridas programadas, entre **2,4 y 7,8
horas** de distancia (4 corridas desde el 2 de octubre); cada llamada al endpoint tardo **2 a 4 s** y dio HTTP 200.

Llamar al worker cada minuto mantendria despierta la base. Neon esta en el plan Launch: **USD 0,106 por CU-hora**, se
suspende tras 5 min sin uso (pagina de precios, 2026-10-03). Hoy la rama `main` esta despierta el **36 %** del tiempo
(23 h de ~65 h del periodo), en el minimo de 0,25 CU: despierta 24/7 seria un techo de ~USD 19 al mes.

## Decision (owner, 2026-10-03)

1. **cron-job.org**, no Vercel Pro por ahora. Owner: «me gusta la opcion de cron-job.org es gratis, parece confiable».
   Verificado en su FAQ y su API: gratis, hasta cada minuto, sin tope mensual declarado («fair usage»), corta la
   conexion a los 30 s, no promete puntualidad, desactiva un job despues de **mas de 25 fallos seguidos** (con aviso
   por email opcional, `onDisable`), y cada job tiene `hours`, `minutes` y `timezone` propios.
2. **Cada 10 minutos, de 7:00 a 18:00, editable sin deploy.** Owner: «cron-job.org cada 10 minutos, pero solo en
   horario comercial de 7am a 6pm que podamos modificar esto de forma simple para que mas a delante pueda cambiarlo a
   9pm o a24h si lo necesitamos. asi neon duerme». El job: `minutes` 0,10,20,30,40,50; `hours` 7–17 (la ultima corrida
   es 17:50); `timezone` `America/Guayaquil` (la de los 8 comercios activos, medido en PROD). Pasar a las 21:00 es
   sumar las horas 18–20 en la pantalla de cron-job.org; 24 h es «todas las horas».
3. **Se borra el GitHub Action** (owner: «borrarlo»), cuando cron-job.org ya este corriendo. A la pregunta de usar
   GitHub para encender y apagar el job: no hace falta, el horario es del propio job; y GitHub es justo lo que se
   midio corriendo cada 2–8 h.

## Consecuencias

Aceptadas por el owner, que eligio «7:00 a 18:00» con estas dos en la pregunta:

- Un aviso diferido encolado despues de las 17:50 sale a las 7:00 del dia siguiente. El «regalo misterio» de una
  compra a las 18:30 llega a la manana (la spec 0143 no le pone ventana; la pone el horario del worker).
- El recordatorio del dia sin compra (spec 0111) tiene hora objetivo entre 9:00 y 20:30 y no sale a partir de las
  21:00 (`packages/domain/src/server/wallet/reminder.ts:118-127`): al cliente cuya hora objetivo cae despues de las
  17:50, **no le llega**.

Otras:

- El regalo misterio llega entre 3 y ~13 min despues de la compra, mas la demora de cron-job.org (15–40 s reportados
  en horas pico).
- Si cron-job.org desactiva el job, la cola espera hasta que se reactive a mano; el email `onDisable` tiene que estar
  encendido. Los fallos no se reintentan.
- La configuracion del job vive fuera del repo; la documenta `docs/notificaciones/README.md`. El `CRON_SECRET` va en el
  header `Authorization: Bearer …` del job y lo carga el owner.
- Supera el «interim» de la spec 0033 (el GitHub Action). Vercel Pro sigue siendo el camino si el horario no alcanza.
