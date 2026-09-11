---
adr: 0061
fecha: 2026-09-11
estado: aceptada
resumen: El solape de dos entregas del mismo webhook se cierra AHORA (decision del owner, 2026-09-11), y el claim pasa a tener TRES resultados, no dos — `claimed`, `already_processed` (200 `{duplicate:true}`) e `in_flight` (**no-2xx**, para que Stripe reintente). El lease en `received_at` propuesto por la fase B, implementado sin esta distincion, habria reintroducido el bug del §Problema-4 de la spec 0063: un reintento rechazado por el lease habria contestado 200, Stripe lo habria dado por entregado y un evento cuya primera entrega murio no se habria procesado NUNCA.
---

# 0061 — La entrega que se retira no contesta 2xx

Supersede **un solo punto** del §HALLAZGO DE LA FASE B de la spec 0063: el trade-off declarado
del lease. El mecanismo del lease (un predicado sobre `received_at` en el mismo `setWhere`, sin
columna nueva, sin migracion, sin lock) **se mantiene tal cual y esta medido**. Lo que cambia es
que el lease **solo es seguro acompañado de la respuesta HTTP correcta**, y esa parte no estaba.

## Que decidio el owner

**Cerrar el solape ahora, no aceptarlo como limite.** Entra como **fase C** de la spec 0063; lo
que era la fase C (rutas + UI + D8 + D10) pasa a ser la **fase D**.

El orquestador habia recomendado lo contrario —reescribir el item del DoD y dejar el solape
documentado— sobre la base de que cerrarlo bien costaba mas que una linea de SQL. Sigue siendo
cierto que cuesta mas que una linea; el owner decidio pagarlo.

## El hallazgo que obliga a este ADR

El §HALLAZGO DE LA FASE B de la spec 0063 propuso el lease y declaro su unico trade-off asi:

> un reintento de Stripe que llegue **dentro** de la ventana del lease recibiria
> `{duplicate:true}` y el evento esperaria al reintento siguiente. Es tolerable porque los
> reintentos de Stripe estan a minutos/horas

**La segunda mitad de esa frase es una suposicion no verificada sobre el calendario de reintentos
de Stripe, y la primera esconde el problema real:** `{duplicate:true}` sale con **HTTP 200**, y
para Stripe **cualquier 2xx es una entrega exitosa**. No hay «reintento siguiente»: Stripe deja
de reintentar. La secuencia completa:

```
t=0s   entrega #1 gana el claim  →  el proceso MUERE (lambda cortada, crash, o el retrieve tira)
       →  processed_at queda NULL, received_at = t0
t=20s  reintento de Stripe  →  el lease lo rechaza  →  200 {duplicate:true}
       →  Stripe marca el evento ENTREGADO  →  no reintenta nunca mas
       →  EL EVENTO NO SE PROCESA JAMAS
```

Eso es **exactamente** el bug del §Problema-4 que la spec 0063 vino a matar (la version vieja
marcaba el evento recibido ANTES de procesarlo, con lo cual un fallo hacia que el reintento
contestara `{duplicate:true}` y el evento no se procesara nunca), reintroducido por la puerta de
atras y con una ventana mas chica.

**Y es una regresion neta respecto de no hacer nada.** Hoy, sin lease, el solape deja el estado
final **correcto**: las dos entregas ganan, las dos escriben, y el `UPDATE` es idempotente. El
lease con 200 lo dejaria **sin escribir nunca**. Un agujero cosmetico cambiado por una perdida de
datos.

Es `CLAUDE.md` otra vez, en la variante del **costo declarado**: el §HALLAZGO DE LA FASE B nacio
corrigiendo un limite sobredimensionado (el implementador habia dicho que cerrarlo costaba una
columna nueva con lease; era falso) y, al corregirlo, **fijo un precio nuevo que tampoco se
verifico** — «una linea de SQL mas su test de solape». Sub-corregir se siente como rigor y deja
el mismo agujero mas chico. El precio real incluye el tri-estado y la respuesta no-2xx.

## La decision tecnica

**El claim tiene TRES resultados, no dos, y cada uno tiene su respuesta HTTP.** La regla que los
ordena es una sola, y es la que hay que recordar:

> **Un 2xx es una promesa: «este evento ya no es tuyo, no lo mandes mas».** Solo se puede hacer
> esa promesa cuando el evento esta REALMENTE terminado. Retirarse porque otro lo tiene tomado
> **no** es terminarlo.

| resultado | cuando | respuesta | por que |
|---|---|---|---|
| `claimed` | no habia fila, o hay fila con `processed_at IS NULL` y el lease **vencido** | sigue el procesamiento | |
| `already_processed` | `processed_at IS NOT NULL` | **200** `{received:true, duplicate:true}` | terminado de verdad. Stripe **debe** dejar de reintentar. Es el caso que pinnean M3/M7 |
| `in_flight` | `processed_at IS NULL` y `received_at` **dentro** de la ventana | **no-2xx** | otro lo tiene tomado, o lo tomo y murio. Stripe **tiene** que reintentar |

## Por que el lease no se puede reemplazar por una comparacion de timestamps

El owner pregunto —y la pregunta es buena— si no alcanza con el timestamp que Stripe manda en
cada entrega, dado que la segunda llega despues que la primera. Hay dos timestamps distintos:

- **`event.created`**: propiedad del **evento**. Las dos entregas del mismo evento traen **el
  mismo valor**, asi que no las distingue. Es el que usa el guard de orden de D5
  (`applicability.ts`, `event.created < row.last_event_at`): sirve entre eventos **distintos**, no
  entre entregas del mismo.
- **El `t=` del header `Stripe-Signature`**: ese **si** es por entrega (verificado en el SDK
  instalado, `stripe@22.5.0`, `esm/Webhooks.js:208` — `kv[0] === 't'`, con `DEFAULT_TOLERANCE` de
  300 s).

Pero no cambia nada, por dos motivos:

1. **Esa informacion ya la tenemos, y en nuestro reloj.** Cuando la primera entrega gana el claim
   escribe `received_at`. Comparar contra `received_at` es la misma comparacion, sin depender del
   reloj de Stripe contra el nuestro.
2. **Y es el motivo de fondo: un timestamp dice CUANDO empezo la primera, no SI SIGUE VIVA.**
   «Arranco hace 2 s y esta esperando el `retrieve`» y «arranco hace 2 s y murio» dejan la fila
   **identica**: `processed_at IS NULL`, `received_at` hace 2 s. Son indistinguibles, y en el
   primer caso la segunda entrega debe retirarse mientras que en el segundo es la unica
   oportunidad que le queda al evento.

Por eso el lease es una **apuesta** («si arranco hace menos de X, asumo que sigue viva») y no una
deduccion — y por eso la respuesta no-2xx es obligatoria: **es lo que hace que perder la apuesta
sea gratis.** Si nos equivocamos y el que la tomo estaba muerto, Stripe reintenta, el lease vence
y el evento se procesa. Con un 200, equivocarse cuesta el evento.

## Consecuencias

- **La ventana del lease deja de ser un numero magico y pasa a tener una cota inferior
  derivable:** tiene que ser **estrictamente mayor que la duracion maxima de la funcion**, porque
  pasado ese tope el proceso esta muerto con certeza. Eso obliga a **fijar `maxDuration`
  explicitamente** en la ruta del webhook: hoy no esta declarado y la premisa vive en un default
  de Vercel que no controlamos ni versionamos.
- **Un reintento de Stripe que llegue dentro de la ventana despues de un fallo real se DEMORA
  hasta el reintento siguiente.** No se pierde. Es el unico costo que queda, y ahora es el costo
  de verdad.
- **El `retrieve` duplicado desaparece**: la segunda entrega se retira antes de llamar a Stripe.
- **Riesgo que hay que vigilar:** un `in_flight` es, para Stripe, una entrega fallida. Si la
  ventana quedara mal configurada (enorme), **todos** los reintentos fallarian y Stripe terminaria
  desactivando el endpoint. Es el espejo del riesgo que ya documenta la spec 0063 para
  `resource_missing`. La ventana chica y su test no son cosmeticos.
- **Nada de esto toca [R1-M1] ni el ADR 0054:** el claim sigue siendo su propia transaccion corta
  que commitea antes del `retrieve`, y el predicado del lease vive en el **mismo** `setWhere`, que
  el `EXPLAIN` sobre Neon pone en el mismo nodo post-lock — no es un pre-chequeo tipo `InitPlan`.

## Lo que queda como premisa declarada, no verificada por nosotros

**«Stripe considera entregado cualquier 2xx y deja de reintentar»** es la semantica documentada de
los webhooks de Stripe, y es la premisa de la que cuelga este ADR entero. **No la podemos pinnear
con un test nuestro**: ningun oraculo en nuestro arbol observa la decision de reintentar de
Stripe. Lo que si se pinnea, y es lo que la fase C tiene que hacer, es **el status que nosotros
devolvemos** en cada uno de los tres casos — que es la parte que esta bajo nuestro control y la
que la mutacion puede romper.

Queda anotado asi, y no como «verificado», precisamente por el ADR 0054.
