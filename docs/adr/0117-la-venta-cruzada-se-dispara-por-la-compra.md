---
adr: 0117
fecha: 2026-10-02
estado: aceptada
resumen: La Venta cruzada deja de ser «a pedido»: escanear en el comercio A le entrega al cliente UNA oferta de un comercio cercano de otro rubro, ya emitida como cupon suyo, con push de la PWA unos 3 min despues del de mostrador («regalo misterio»). Se elige por loteria H4 —igual por oportunidad, bono al comercio sin clientes nuevos en el mes, 20 % de azar editable en limits.ts—, se registra cada decision desde el dia uno, exito = canje, sin grupo de control por ahora, y un cliente recibe una sola vez cada campaña.
---

# 0117 — La Venta cruzada se dispara por la compra

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

5. **La lista «a pedido» de hoy se apaga** («Sí, se apaga»): solo existe la cruzada que llega despues de comprar;
   «Mis beneficios» muestra los cupones que el cliente ya tiene, incluidos los cruzados recibidos.
6. **Momento y texto del push** (preferencia del owner, sujeta a la investigacion): «yo esperaria la investigacion.
   Pero creo que lo ideal seria Cliente compra en comarcio > Comercio A escanea y asigna lo que tenga que asignar >
   cliente recibe push sobre los sellos o puntos que obtuvo > si hay una oferta cruzada se dispara en 60 segundos luego
   de esa notificacion. esto da tiempo entre que la compra finalizo y quizas el cliente abandono el comercio. incluso
   quizas mas, no 60, si no 120 segundos osea unos 2 a 3 minutos. La notificacion llega con algo como "Gracias por tu
   compra en Comercio A, recibiste un beneficio especial, abre tu app para descubrirlo" o algo asi, el copy deberia ser
   mucho mejor y mas corto como para una notificacion push y para incentivar a que el cliente abra el app y vea que
   gano». Medido: la separacion minima entre dos avisos al mismo cliente ya es 3 min (`COOLDOWN_MINUTES`,
   `packages/domain/src/server/notifications/limits.ts`), asi que un push encolado tras el de mostrador sale a ~3 min sin
   mecanismo nuevo; y suma 2 de los 3 avisos con sonido del dia (`NOTIFYING_PER_24H`). **Corregido el 2026-10-03:
   media medicion.** La separacion existe, pero el push diferido sale cuando corre el worker, y el worker lo dispara
   `.github/workflows/wallet-push-cron.yml` (`*/5`), que GitHub corrio cada **2,4 a 7,8 horas** (ultimas 40 corridas
   programadas; 4 desde el 2 de octubre). Ver «Cerrado despues».

7. **Criterio de arranque: B (al azar entre las elegibles, ponderado por cercania), registrando datos para aprender**
   (owner, 2026-10-02, sobre `docs/notificaciones/venta-cruzada-criterio.md`). Textual: «podemos usar la B, pero
   registrar datos suficicientes para ir aprendiendo? me refiero, a que queremos dar a todos los comercios de la red
   oportunidades. No queremos que el que mas venda venda mas mientras el que venda menos nunca llegue a mas clientes.
   comprendes? este es nuestor trabajo y nuestra obsesion. La venta cruzada sirve para volver a traer clientes viejos,
   pero tambien llegar a clientes que quizas jamas te hubieran conocido. Tenemos que aprender sobre los habitos de cada
   consumidor, pensar en que le sirve mas, y siempre tener una cuota de azar o de "discoveribilidad" para los comercios
   que quizas no hubiera aparecido, darles la oportunidad. aqui quizas necesitamos investigar algoritmos o matematicas
   para tratar de pensar que sistema seria el indicado para algo como esto».
8. **Exito = el canje del cupon cruzado en B** («Solo el canje»).
9. **Fraccion de azar inicial:** «Lo decido después».
10. **Se registra todo desde el dia uno** («Sí, todo»): cada decision con sus candidatos, factores, probabilidad y numero
    sorteado; el segmento del cliente respecto de cada candidato (nuevo / dormido / habitual); las compras con 0
    elegibles; y el resultado, incluidas las compras en el comercio elegido aunque no canjee (el exito sigue siendo solo
    el canje, punto 8). Detalle en `docs/notificaciones/venta-cruzada-algoritmo.md` §4.
11. **Sin grupo de control por ahora** («Ninguno por ahora»): con el volumen de hoy no mediria nada; como el segmento
    queda registrado, se puede encender despues para dormidos y habituales.
12. **«Lo justo» = H4** (owner, 2026-10-03: «arrancamos con H4»): igual por oportunidad —cada vez que un comercio es
    candidato cuenta igual; el atrasado recibe mas boletos— mas un bono al comercio que no consiguio ningun cliente
    nuevo en el mes. Acepta el trade-off medido en la simulacion (`docs/notificaciones/venta-cruzada-equidad.md`): mas
    alcance de la red a cambio de menos canjes totales que «gana el mejor».

13. **Azar inicial: 20 %, editable** (owner, 2026-10-03: «20 % editable»): constante en
    `packages/domain/src/server/notifications/limits.ts`, junto a los demas limites (spec 0141).
14. **Texto del push: «regalo misterio»** (owner, 2026-10-03). Titulo «🎁 Tenés un regalo»; cuerpo «Por tu compra en
    {A}. Abrí la app y descubrí qué es.» No dice cual es el beneficio. Sale despues del aviso de mostrador, separado por
    la separacion minima entre avisos (3 min).
15. **Un cliente recibe una sola vez cada campaña** (owner, 2026-10-03, en lugar de los dos filtros propuestos):
    «recuerda que la venta cruzada es una campaña con fecha de inicio y fin. entonces al mismo cliente no le sale otra
    venta cruzada del mismo comercio de la misma campaña». Ya existe: `claimed` en `decideCrossOffer`
    (`packages/domain/src/server/marketing/cross-rules.ts:151`). No se suman «B abierto en la vigencia» ni «no repetir B
    en 30 dias».

Canal (ADR 0115 §2 y 0116): push de la PWA si tiene notificaciones; si no, el cupon igual queda en su cuenta y se ve
en la app.

## Para la spec (no son decisiones abiertas del owner)

- **Medido:** hoy una campaña cruzada puede no tener fecha de fin (`core.campaign.ends_at` nulo; el check de
  `packages/db/src/schema/campaign.ts:185` no lo exige para `cross`). El owner la describe «con fecha de inicio y fin»:
  la spec lo trae como hallazgo a decidir, no lo asume.
- Investigaciones: `docs/notificaciones/venta-cruzada-criterio.md`, `venta-cruzada-algoritmo.md` (que registrar: §4) y
  `venta-cruzada-equidad.md` (H4 y la simulacion).
- Es la spec 4 del ADR 0115: **`specs/0143-venta-cruzada-por-la-compra.md`**.

## Cerrado despues (owner, 2026-10-03, al escribir la spec 0143)

- **Ventana horaria:** «No, sale con la compra». El regalo misterio no espera a la ventana 9–21 del comercio B.
- **Fecha de fin:** «Exigir fecha de fin». La API rechaza activar una cruzada sin `endsAt`; el `check` de la base no
  cambia y las vivas sin fin quedan como estan (no hay usuarios reales).
- **Disparador:** «Solo acreditar». Solo una orden nueva del mostrador; canjear un premio o un cupon no dispara.
- **Demora del push → ADR 0118:** cron-job.org cada 10 min, de 7:00 a 18:00 (Guayaquil), editable sin deploy; se borra
  el GitHub Action. El regalo misterio llega entre 3 y ~13 min despues; de una compra despues de las 17:50, a las 7:00.
