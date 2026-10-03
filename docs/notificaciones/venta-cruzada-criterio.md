# Venta cruzada: como elegir UNA oferta entre B, C y D

Investigacion del 2026-10-02 para el ADR 0117 §3 (borrador). Pregunta del owner: «el consumidor recibe la oferta
cruzada de B, C o D? y porque», con el objetivo de **aumentar visitas y ventas incrementales del comercio local, no
enviar por enviar**. Lo medido en el repo lo verifico el orquestador; la evidencia externa la reunio un agente de
investigacion (19 busquedas) y se cita con su nivel. La recomendacion es opinion, no decision.

## 1. Lo que ya hay (medido)

- **Hoy gana la mas cercana.** `decideCrossOffer` solo dice si/no (`packages/domain/src/server/marketing/cross-rules.ts:190`);
  con varias elegibles, `packages/domain/src/server/consumer/cross-offers.ts:145-149` ordena por valle primero, despues
  distancia, despues `campaignId`.
- **El merito por lift existe pero no mide la cruzada.** `apps/merchant/src/server/marketing/merit.ts` (α = 20,
  `MERIT_ALPHA`) calcula «tasa con turno − tasa del grupo de control», achicada hacia el promedio de la red (ADR 0066),
  y lee solo turnos de proximidad (`core.campaign_turn`). La matematica es reusable; el insumo no: el cupon cruzado no
  tiene grupo de control (`campaign_coupon` no tiene `holdout`; `campaign_turn` y `campaign_push` si).
- **El owner ya lo habia pedido:** ADR 0103 §6 — al competir, «urgencia → rotacion → cercania, enriquecido con
  novedad, comercio nuevo en la red, el horario habitual de la persona y una fraccion de exploracion al azar (medible
  contra el grupo de control, ADR 0066)»; §8 — cupo agotado no sale, beneficio ignorado 3 veces descansa.
- **Datos disponibles:** pedidos con comercio, local, cliente, monto y hora; rubro del comercio; coordenadas por local;
  horarios por local (`core.location_hours`, hoy solo los usa Horas valle); canjes de cupon; membresias.
- **Volumen:** la spec 0136 midio el 2026-09-29 «5 comercios, 2 rubros… 0 pedidos». Hoy ningun modelo tiene señal.

## 2. Lo que dice la evidencia externa

- **Hay que medir lo incremental, no los canjes.** Booking.com, Uber y DoorDash optimizan con modelos de uplift: a
  quien iba a comprar igual no se le regala (practica de empresas; tutorial de Booking en WWW 2021). Contar canjes
  «puede parecer un triunfo y estar pagando demanda que ya existia» (Kard, fuente interesada).
- **Explorar es obligatorio cuando sale UNA sola oferta.** Un ranking codicioso nunca le da datos a C y D si B arranca
  bien. Los bandits (Amazon 2018, estudio) optimizan el efecto incremental y generan su propio grupo de comparacion;
  para evaluar despues otra politica, la eleccion tiene que ser al azar con probabilidad conocida y guardada.
- **La cercania y el momento importan, y la cruzada esta bien planteada:** promocionar a quien esta cerca de OTRO lugar
  capta demanda nueva; promocionar a quien esta cerca del propio canibaliza (Fong et al., JMR 2015, experimento de
  campo). Con el usuario cerca, cuanto antes llega el aviso mas vende (Luo et al., Management Science 2014,
  experimento con 12 265 usuarios): respalda el push a los 2–3 minutos. El canje cae con la distancia (Subway, 9 880
  cupones).
- **Menos es mas:** mandar menos baja desuscripciones 59 % a cambio de 5–8 % menos ingreso de corto plazo (Baek et al.,
  experimento de campo).
- **Equidad entre comercios:** sin cuidado, los populares se quedan con toda la exposicion. Mercari asigna cupones para
  maximizar cuantos vendedores logran al menos una venta: 10–15 % mas vendedores exitosos (practica con experimento).
- **No se encontro** evidencia primaria sobre «B esta abierto ahora» como factor: es sentido comun, no hallazgo.

## 3. Opciones, de la mas simple a la mas sofisticada

Todas con los filtros de hoy, el cupo, «ignorado 3 veces descansa» y una cruzada por compra.

| | Criterio | Arranca con 0 datos | Mide si funciona | Riesgo principal |
|---|---|---|---|---|
| **A** | La mas cercana, con rotacion | si | solo si se agrega grupo de control | el mismo B para todos los clientes de A; no aprende |
| **B** | Al azar entre las elegibles, ponderado por cercania, con grupo de control y probabilidad guardada | si, es la mejor con pocos datos | si: por comercio, por par de rubros y la red | a veces sale una oferta peor que la ideal |
| **C** | Lift medido por comercio (reusar el merito de la proximidad) + fraccion de exploracion al azar | si (el dia 0 decide la cercania + exploracion) | si | sin exploracion, C y D nunca reciben datos; el lift de un comercio chico es ruido mucho tiempo |
| **D** | Bandit (Thompson) sobre el lift, despues con contexto (par de rubros, distancia, abierto ahora, hora habitual) | se comporta como B | si, con el grupo de control aparte | complejidad; con pocos datos no gana a B ni a C |

## 4. Recomendacion (opinion del agente, compartida por el orquestador)

**C en su version minima, que el primer dia funciona como B:**

1. Filtrar con lo de hoy, mas «B abierto al menos unas horas dentro de la vigencia del cupon» cuando tenga horario
   cargado.
2. **Registrar cada decision:** compra que la disparo, candidatos, B elegido, probabilidad, si fue grupo de control,
   distancia. Es lo que permite contestar «¿por que B?».
3. **Grupo de control (~10 %):** compras en las que no sale oferta, el cupo no se gasta y se anota que B habria
   salido.
4. **Elegir** por lift achicado + exploracion alta al principio (30–50 % al azar ponderado por cercania), que baja a
   10–20 % cuando cada comercio tiene datos. Con todos en 0, desempata la cercania. Respuesta al «¿por que B?»: porque
   genera visitas que no habrian ocurrido, o porque todavia no lo sabemos y lo estamos probando.
5. **Contra el acaparamiento:** penalizar al B que ya gano con ese cliente o con ese A en los ultimos 7 dias.

**Como evoluciona:** primero medir si la cruzada funciona en la red entera contra el grupo de control (si no da
positivo, elegir entre B, C y D da igual); despues el lift por par de rubros (junta datos mucho mas rapido que por
comercio); despues el lift propio de cada comercio; con volumen real, el bandit con contexto y, si se prioriza, un
objetivo de equidad tipo Mercari.

## 5. Lo que tiene que decidir el owner

1. El criterio (A, B, C o D).
2. El tamaño del grupo de control y que no gaste cupo.
3. Que cuenta como «visita incremental»: el canje del cupon, o cualquier compra en B dentro de la vigencia.
4. La fraccion de exploracion inicial.
