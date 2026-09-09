---
spec: 0060
fecha: 2026-09-09
estado: borrador
resumen: El micro-portal `/wallet` refleja el saldo nuevo sin que el consumidor tenga que cerrarlo y reabrirlo; hoy el saldo queda congelado en el render del servidor.
disjunta: sí (nadie más toca `app/(consumer)/wallet/**` con specs abiertas)
archivos: `apps/merchant/src/app/(consumer)/wallet/**`, posiblemente `apps/merchant/public/sw.js`
---

# 0060 — El portal del consumidor se actualiza solo

> **BORRADOR — no se toca código hasta que la sección «Abierto» esté vacía.**

## Problema

Observado por el owner en el QA **B1.4** (2026-09-05), con el mostrador acreditando de
verdad: *«con el portal ya abierto hay que cerrarlo y reabrirlo para ver el saldo»*.

El consumidor recibe la notificación de que le acreditaron, abre el ícono de CheckPass Club
que ya tenía abierto en segundo plano, y **ve el saldo viejo**. Para el usuario eso se lee
como que la acreditación no funcionó — que es exactamente lo contrario de lo que pasó.

**No es una regresión ni un olvido.** La spec 0031 sacó la «landing en vivo» de su alcance
de forma explícita y sin reemplazo: *«si el owner más adelante quiere un resultado en vivo,
es una spec nueva — no entra acá»*. Esta es esa spec.

## Por qué pasa (verificado en el código, no asumido)

`app/(consumer)/wallet/page.tsx` es un **server component** con `dynamic = "force-dynamic"`.
Resuelve la sesión y llama `listConsumerPrograms(account.id)` **una sola vez, en el render**,
y le pasa el resultado como props a `WalletShell`, que es cliente. A partir de ahí `programs`
es un valor inmutable en el cliente: nada lo vuelve a pedir. El saldo que ve el consumidor es
una foto del instante en que se renderizó la página.

## El dato que condiciona el diseño

**El service worker NO se entera de una acreditación en el caso normal.** `planTransports`
(`server/wallet/push-transports.ts:139`, ADR 0040) rutea así:

```
transactional + pase de Wallet alcanzable → { apple: true, google: true, webPush: FALSE }
transactional + sin pase alcanzable       → { apple: false, google: false, webPush: true }
```

O sea: al consumidor que **sí** agregó el pase —el camino feliz al que el producto lo
empuja— la acreditación le llega por Apple/Google Wallet y **el Web Push nunca se dispara**.
`public/sw.js` solo tiene handlers de `push` y `notificationclick`.

**Consecuencia:** cualquier diseño del tipo «el service worker avisa a la pestaña abierta
para que se refresque» **funcionaría solo para la minoría sin pase**, y fallaría justo para
los usuarios del camino principal. No es una opción viable por sí sola.

## Opciones de diseño (para decidir, no decididas)

| # | Cómo | A favor | En contra |
|---|---|---|---|
| **A** | `router.refresh()` cuando la pestaña vuelve a ser visible (`visibilitychange`) y/o al recuperar el foco | Ataca **exactamente** el síntoma que reportó el owner (volver al ícono ya abierto). Cero endpoints nuevos: `router.refresh()` re-corre el server component y preserva el estado del cliente. Cero costo cuando la app está en segundo plano | No actualiza si el consumidor **se queda mirando** la pantalla mientras el mostrador acredita |
| **B** | Polling a un endpoint nuevo mientras la pestaña está visible | Cubre también el caso «lo miro en vivo, delante del mostrador» | Endpoint nuevo (`listConsumerPrograms` hoy no tiene ruta HTTP). Costo recurrente de funciones y DB por cada portal abierto. Hay que elegir intervalo y si se corta tras N minutos |
| **C** | A + B: refresco al volver, y además polling acotado mientras está visible | Cubre los dos casos | Es la suma de los dos contras; más superficie que testear |
| **D** | SSE / WebSocket | Instantáneo, sin polling | **Descartable de entrada**: no encaja con funciones serverless de Vercel en plan Hobby, y ya hay un precedente de límite de plataforma mordiendo el deploy (máx. 2 crons diarios) |
| **E** | El service worker avisa a la pestaña | Reusa el push que ya existe | **Inviable solo**, por el ruteo del ADR 0040 explicado arriba: no se dispara para quien tiene el pase |

## Alcance

**Entra:**
- Que el saldo/progreso de `/wallet` se actualice sin que el consumidor cierre y reabra.

**No entra (explícito):**
- Cambiar el ruteo de transportes del ADR 0040.
- Actualización en vivo de la landing de enrolamiento (`/enroll/[programId]`) — la 0031 ya
  la descartó y esta spec no la revive.
- Notificaciones nuevas, sonidos o badges.
- Tocar el pase de Wallet: Apple/Google ya se actualizan por su propio canal (spec 0033).

## Definition of Done

- [ ] Pendiente de cerrar la sección «Abierto».

## Plan de pruebas y verificación

- [ ] Pendiente. **Regla dura de este repo:** la tabla «mutación X → rojo el test Y» no se
      predice, se **ejecuta** y se transcribe el resultado real.
- [ ] **Ojo con el oráculo:** «el usuario ve el saldo nuevo» es una propiedad de
      COMPORTAMIENTO. Un barrido estático de strings no la pinnea — es literalmente el
      defecto que se acaba de documentar en la tarea 50 con las specs 0058/0059. La decisión
      de refresco debe salir a una **función pura** testeable, y hay que declarar
      explícitamente qué parte del cableado queda sin cubrir.

## Abierto

**Todo esto es decisión del owner. La spec no se cierra hasta que estén resueltas.**

1. **¿Qué caso hay que cubrir?** ¿Solo «vuelvo al ícono que tenía abierto» (opción A), o
   también «lo tengo abierto en la mano mientras el encargado acredita» (opción B/C)?
   El síntoma que reportaste es el primero; el segundo es más caro.
2. **Si entra polling: ¿cada cuánto, y hasta cuándo?** Cada portal abierto es tráfico y
   consultas a Neon recurrentes. ¿Se corta después de N minutos sin actividad?
3. **¿Qué ve el consumidor cuando el saldo cambia mientras mira?** ¿Cambia el número y ya,
   o hay una señal («+3 sellos»)? Un número que se mueve solo, sin aviso, puede pasar
   inadvertido o confundir.
4. **¿El refresco alcanza al catálogo de premios y a los términos**, o solo a saldo y
   progreso? El catálogo puede cambiar mientras el portal está abierto.
