---
adr: 0117
fecha: 2026-10-02
estado: borrador
resumen: BORRADOR (decisiones del owner en curso). La Venta cruzada pasa de «a pedido» a disparada por la compra — escanear en el comercio A le entrega al cliente UNA oferta de un comercio cercano de otro rubro, ya emitida como cupon suyo — y el criterio para elegir CUAL (entre B, C, D) se investiga antes de decidirlo, con el objetivo del owner: visitas y ventas incrementales para el comercio local, no envios por enviar.
---

# 0117 — La Venta cruzada se dispara por la compra (BORRADOR)

> **Borrador:** guarda las decisiones del owner del 2026-10-02 mientras se cierran las que faltan. No se escribe
> ninguna spec ni codigo hasta que este en `aceptada`.

## Contexto

Hoy (spec 0136, ADR 0104) la Venta cruzada es **a pedido** y **sin notificacion**: el comercio B activa la plantilla
(premio, tope mensual, vigencia, publico: no clientes / dormidos / cualquiera); el cliente abre «Mis beneficios» y ve
las ofertas de rubro distinto al ultimo comercio escaneado (o al local donde esta parado, con GPS), a ≤ 2 km del GPS o
del ultimo local escaneado, dentro del publico, no reclamadas y con cupo; la reclama y se emite el cupon
(`packages/domain/src/server/marketing/cross-rules.ts:190` `decideCrossOffer`; `consumer/cross-offers.ts`).

El ADR 0115 §6 dejo el aviso abierto. Owner, textual: «si es un beneficio que te da comprar en otro comercio, el
beneficio te lo envian a tu cuenta my.checkpass.club entonces si entra en push notificacion y dentro del app como
ahora».

## Decidido por el owner (2026-10-02)

1. **Disparador: comprar en otro comercio.** Al escanear en el comercio A, el cliente recibe la oferta de un comercio
   cercano de otro rubro. (Opcion elegida: «Comprar en otro comercio», no «Las dos».)
2. **Entrega: el cupon ya es suyo.** Se emite solo y aparece en su cuenta; no hay paso de reclamo. Gasta el tope
   mensual de B aunque el cliente no vaya.
3. **Una sola oferta por compra.** Textual: «le llegaria una, aqui tendriamos que pensar cual. Si compra en comercio
   A, y comercios B, C, D tienen activadas ventas cruzadas y queremos mandarle solo 1 al cliente, cual de las tres
   enviamos? Esto tendriamos que investigar mas a fondo cual nos convendria, la idea es que nos obsesionemos con que
   nosotros queremos aumentar las visitas y ventas a un comercio local. Es decir, no nos sirve enviar por enviar ni
   enviar ofertas sin sentido. tenemos que ver de que manera establecemos que consumidor es el mas idoneo para cada
   cosa, en este caso el consumidor recibe la oferta cruzada de B, C o D? y porque».
4. **El comercio A no decide por ahora** («Lo veo después»): que a sus clientes les lleguen ofertas de otros despues
   de comprarle es parte de la red, a revisar mas adelante.

Canal (ADR 0115 §2 y 0116): push de la PWA si tiene notificaciones; si no, el cupon igual queda en su cuenta y se ve
en la app.

## Abierto

- **El criterio de eleccion entre B, C, D** (punto 3): se investiga. Insumo ya existente en el repo: el merito por
  LIFT con holdout de la proximidad (ADR 0066), que mide visitas incrementales y no la tasa cruda.
- **Que pasa con «Mis beneficios» a pedido** (el modelo de hoy): el owner eligio «Comprar en otro comercio» y no «Las
  dos»; falta confirmar si la lista a pedido se apaga.
- **Cuando sale el push** respecto de la compra (inmediato o diferido) y su texto.
