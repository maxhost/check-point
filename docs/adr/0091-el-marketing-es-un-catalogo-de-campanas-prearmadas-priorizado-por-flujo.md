---
adr: 0091
fecha: 2026-09-26
estado: aceptada
resumen: Marketing se ofrece en DOS MODOS — campañas PREARMADAS (plantilla con reglas fijas; el comercio activa un toggle y edita pocos parametros: fechas, premio, dias de inactividad, mensaje pre-llenado) y un modo CUSTOM (compositor que combina). El catalogo son 16 campañas atomicas en 5 grupos; SMS y email quedan fuera. Como las campañas solo alcanzan a la base enrolada, se priorizan las de FLUJO (actuan sobre cada cliente nuevo y valen desde el dia uno) sobre las de STOCK (valen segun el tamaño de la base): primero Bienvenida + Segunda visita fusionadas, despues Te falta poco / Premio sin canjear, despues Te extrañamos. El catalogo de premios es feature propia y se diseña DESPUES de las plantillas, pero la prioridad 1 depende de el para lanzarse.
---

# 0091 — El marketing es un catalogo de campañas prearmadas, priorizado por flujo

## Contexto

El motor de marketing (ADR 0064) tiene hoy UN tipo de campaña, proximidad por wallet (spec 0065),
armado con un compositor de 5 bloques. El owner, al revisarlo (2026-09-26): los comercios «no
comprenden como» configurar una campaña; la referencia es el AutoPilot de Fivestars. Marketing es
el motivo para pagar premium, asi que tiene que traducirse en mas visitas, ventas o consumo.

Hechos verificados en el arbol ese dia: `core.campaign` solo admite `kind in ('proximity')`; no
existe ningun concepto de plantilla; no existe nada de bienvenida (grep de `welcome|bienvenida`
vacio en server, api y portal del consumidor); el cupon existe EMBEBIDO en la campaña y atado al
turno de proximidad (`server/counter/coupon.ts`, canje escaneando el QR del pase); la clase
`campaign` de la cola de push no tiene productor y conserva un fan-out provisional
(`wallet/push-transports.ts:211`).

## Decision (del owner, 2026-09-26)

1. **Dos modos.** **Prearmadas**: la campaña viene con sus reglas; el comercio la enciende con un
   toggle y solo edita unos pocos parametros (inicio/fin, premio si aplica, dias de inactividad en
   opciones cerradas, el mensaje que ve el cliente — pre-llenado y editable). Queda activa y corre.
   **Custom**: un formulario para combinar sus propias reglas. El compositor actual es la semilla
   del modo custom, de un solo tipo.
2. **SMS y email quedan fuera** (email ya lo estaba por el ADR 0064 §7). Los canales son
   proximidad (wallet), push del Wallet y Web Push.
3. **El catalogo son 16 campañas atomicas** (lista aprobada por el owner):
   - A. Ciclo de vida: 1 Bienvenida · 2 Segunda visita · 3 Te extrañamos · 4 Cliente en riesgo ·
     5 Recuperar perdidos · 6 VIP (push, **no** proximidad: ADR 0065 §13).
   - B. Programa: 7 Te falta poco · 8 Premio sin canjear.
   - C. Fechas: 9 Aniversario · 10 Cumpleaños (falta la fecha de nacimiento) · 11 Fecha especial
     (envio programado, concepto nuevo).
   - D. Operacion: 12 Franja floja · 13 Local nuevo · 14 Producto/categoria · 15 Subir el ticket.
   - E. 16 Pedir opinion (sin incentivo, ADR 0022).
   - Fuera: red cruzada (ADR 0064 §3), referidos (ADR 0023), permanencia, juegos (ADR 0057).
4. **Orden en tres pasos:** listar (hecho) → diseñar cada plantilla (que es fijo, que se edita,
   que falta) → recien entonces el **catalogo de premios** como feature propia.
5. **Prioridad por FLUJO antes que por STOCK.** Las campañas de flujo actuan sobre cada cliente
   nuevo y valen aunque la base sea chica; las de stock escalan con la base. Orden: **1+2
   fusionadas** («escaneá hoy y en tu proxima visita te llevas X»: sube la conversion del alta y
   crea el motivo para volver) → **7 y 8** → **3** (ya existe por proximidad) → el resto.

## Consecuencias

- 13 de las 16 necesitan un **canal push de campaña**, que no existe: es el desbloqueo mayor del
  catalogo, con su propio ADR (transporte por campaña, tope de frecuencia por consumidor — el slot
  «Ultima novedad» es uno por consumidor y compartido entre comercios, ADR 0064).
- La prioridad 1 necesita un premio emitible fuera de un turno, canjeable y medible: **el
  catalogo de premios es dependencia de su lanzamiento**, aunque se diseñe despues.
- Con varias plantillas encendidas un consumidor puede caer en varias campañas del mismo comercio:
  el diseño de plantillas tiene que fijar la regla de convivencia.
- Con bases chicas el holdout del 10 % no mide nada: los resultados de esas campañas se muestran
  con metricas observadas (altas, segundas visitas, canjes), sin afirmar causalidad (ADR 0021).

## Abierto (propuesto por el orquestador, NO decidido)

- Si referidos o la red cruzada se revisan como palancas de crecimiento de la base.
- Si alguna campaña de flujo (la Bienvenida) esta disponible en `free` como gancho.
- Teaser en `free` con la audiencia existente («tenes N clientes que no vuelven…»).
