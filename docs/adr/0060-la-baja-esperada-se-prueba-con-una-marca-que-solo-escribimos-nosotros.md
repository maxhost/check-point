---
adr: 0060
fecha: 2026-09-11
estado: aceptada
resumen: El discriminante de «esta baja la pedimos NOSOTROS» es `downgrade_requested_at`, una columna que solo escriben nuestras rutas, y NO `pending_plan`. Supersede ese punto del ADR 0059 §5 y del ADR 0058 §12: `pending_plan='free'` lo escribe el webhook ante cualquier `cancel_at_period_end`, que es justo lo que setea el boton de cancelar del dashboard de Stripe — o sea que era falsificable por el actor del que habia que defenderse, y cancelar desde el dashboard con 3 locales activos aterrizaba en `free` con 3 activos, el estado que el arco entero existe para prohibir.
---

# 0060 — La baja esperada se prueba con una marca que solo escribimos nosotros

## Que problema cierra

Los ADR 0058 §12 y 0059 §5 introdujeron una distincion necesaria: un
`customer.subscription.deleted` **inesperado** deja `plan='none'` y bloquea, pero el `deleted`
de **fin de periodo** —el final normal del flujo de cancelacion— **no** debe bloquear a quien
hizo todo bien: aterriza en `free`. La distincion es correcta y no se toca.

**Lo que este ADR corrige es el CAMPO elegido para probarla.** Los dos ADR dicen que el
discriminante es `pending_plan='free'` («ya escrito por el producto», «o sea que el owner ya paso
por el modal»). Eso es falso, y lo es de la peor manera: **`pending_plan` lo escribe tambien el
webhook**, ante cualquier suscripcion con `cancel_at_period_end: true` o `cancel_at` seteado, sin
importar quien lo puso.

**Y quien lo puede poner sin pasar por nuestro producto es exactamente el actor del que habia que
defenderse: el boton «Cancel subscription» del dashboard de Stripe.**

La consecuencia, desarrollada: el owner cancela desde el dashboard con 3 locales activos → Stripe
setea `cancel_at_period_end: true` → nuestro webhook escribe `pending_plan='free'` → al cerrar el
periodo llega el `deleted` → se lo clasifica como «esperado» → aterriza en **`free` con 3 locales
activos**. Ese es, literalmente, el estado que el ADR 0058 §6 y la spec 0063 entera existen para
prohibir.

## Decision

**El discriminante es `core.subscription.downgrade_requested_at`**, una columna cuyo unico
escritor son **nuestras rutas** de baja (`cancel` y `settle-free`). El webhook **nunca** la
escribe; solo la **limpia** cuando la baja se consuma.

```
deleted  +  downgrade_requested_at IS NOT NULL   →  free   (la baja la pedimos nosotros)
deleted  +  downgrade_requested_at IS NULL       →  none   (la pidio otro: dashboard, dunning, API)
```

Con el matiz que ya fija la spec 0063 (D5.d, `[R2-7]`): solo un plan **pago** puede caer a `none`.
Un negocio `free` cuya primera factura expira sigue en `free`, nunca queda «sin plan» por haber
intentado pagar.

## La regla general, que es lo que hay que llevarse

**Un discriminante de INTENCION no puede leerse de un campo que el otro lado tambien escribe.** Al
elegir el campo que prueba una intencion, la pregunta no es «¿alcanza para distinguir los casos que
se me ocurren?» sino **«¿quien mas puede escribir esto?»**. Si la respuesta no es «solo nuestro
codigo», no es un discriminante: es una coincidencia que se sostiene hasta que alguien usa la otra
puerta.

**Reusar una columna existente «para no agregar una nueva» es la forma que toma este error, y se
siente como economia.** La version anterior de la spec 0063 afirmaba textualmente «no hace falta
ninguna columna nueva» — y esa frase era el sintoma. La columna nueva costaba una linea de
migracion; no tenerla costaba el invariante central del producto.

## Que queda superado y que no

| Documento | Que deja de valer | Que sigue valiendo |
|---|---|---|
| **ADR 0059 §5** | que el `deleted` esperado se reconozca por `pending_plan='free'` | todo lo demas: que `none` bloquea, las dos causas del bloqueo, las dos salidas (bajar a `free` o pagar), y que el bloqueo deje pasar `/backoffice/subscription` y `/backoffice/locations` |
| **ADR 0058 §12** | la misma lectura de `pending_plan` como prueba de que «el owner ya paso por el modal» | la decision de fondo: «sin suscripcion» es un estado propio y **no** es `free` |

**Nada de la decision de producto cambia.** Lo que cambia es como se prueba, que es lo unico que
estaba mal.

## Estado de implementacion

La spec **0063** ya implementa esta decision: la migracion `0030` agrega
`downgrade_requested_at`, y las fases A y B —las dos con PASS de revisor independiente— la usan
como discriminante en `planFromSubscription`. O sea que este ADR **documenta lo que el codigo ya
hace**; se escribe porque los dos ADR viejos siguen siendo texto vivo que puede recrear el bug si
alguien los lee sin leer la spec.

## Como se encontro

Lo cazo un **revisor independiente en la segunda ronda** de revision de la spec 0063, leyendo la
propia spec: la jerarquia de `pending_plan` estaba escrita **dos secciones mas abajo** que la regla
del discriminante, y ahi se veia que el webhook la escribe ante cualquier `cancel_at_period_end`.
El drift residual en los dos ADR lo encontro **otro revisor independiente**, en la revision de la
fase B, y por eso este ADR existe.
