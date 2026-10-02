---
adr: 0115
fecha: 2026-10-02
estado: aceptada
resumen: Las campañas pasan de la Wallet a la PWA. Solo quedan activas Bienvenida y Venta cruzada; el resto (reactivacion, saldo, valle) se oculta al merchant, el tick deja de correrlas y las vivas se pausan, sin borrar codigo. Campañas y avisos de mostrador van por push de la PWA o solo dentro de la app (nunca Wallet); la Wallet queda para el recordatorio y, en otro ADR, avisos generales de CheckPass. El paso 4 del tick (proximidad del pase) deja de correr y su codigo queda, lo que resuelve la #67. Los limites de hoy quedan, centralizados en un solo modulo.
---

# 0115 — Las campañas pasan de la Wallet a la PWA

## Contexto

Hasta hoy la Wallet era la superficie del cliente (ADR 0031) y el canal primero de todo aviso:
`planTransports` (`apps/merchant/src/server/wallet/push-transports.ts:191`) manda `transactional`, `campaign` y
`reminder` por Apple/Google si hay pase alcanzable, y por Web Push **solo** si no lo hay (ADR 0040, 0095). Las
campañas de reactivacion ademas ocupan la **proximidad** del pase: el paso 4 del tick (`marketing/tick.ts:248-255`,
`placeConsumers`) activa turnos y escribe `consumer.pass_placement` (ADR 0065).

Dos hechos medidos el 2026-10-02 empujaron la decision:

- **El paso 4 es el ~98 % del tick** (87,7 s de ~89 s con 99 consumidores en `ci-integration`, ~8 consultas por
  consumidor; `PARQUEADO.md` #67). Crece lineal con los clientes y bloquea en local todo push con Neon completo.
- **La Web Push ya existe de punta a punta** (tabla `consumer.web_push_subscription`, VAPID, `apps/consumer/public/sw.js`,
  `PushPrompt`, `api/public/push/subscribe`), y **la Bienvenida ya exige «app instalada abierta + Web Push activo»**
  (`packages/domain/src/server/marketing/welcome-issue.ts:21,65`; commit `f3982ef`, migracion `0059`), sin un ADR
  que lo registrara.

El owner cambio el foco (textual, 2026-10-02):

> «de todas maneras, creo que esto va a mutar y muy pronto. Porque ahora el foco no es que instalen el pase en el
> wallet, es que instalen la PWA en la home y activen notificaciones. Entonces esto cambia radicalmente como
> funcionan las campañas de marketing: Wallet queda para notificaciones generales de CheckPass como por ejemplo
> "tienes beneficios por vencer" o "hay un evento especial en la ciudad" cosas asi. mientras que las
> notificaciones push quedan para el resto de campañas de marketing. vamos a poner limites para evitar abusos. Por
> eso, tambien la manera en que tratamos las campañas cambiara radicalmente»

> «de echo, vamos a enfocarnos solo en dos campañas y vamos a desactivar el resto para que el merchant no las pueda
> ver porque las que hoy son clave serian Bienvenida y Venta cruzada. Son las dos que vamos a hacer foco.
> Bienvenida porque ayuda a crecer la base de clientes usando checkpass y venta cruzadas ayuda a aumentar ventas al
> comercio»

Ante la #67 eligio **«Primero el rediseño»**: se resuelve aca, no con un arreglo del tick.

## Decision

Cada punto lleva la respuesta del owner (2026-10-02). Las que vinieron como opcion elegida se citan por su rotulo.

### 1. Solo dos campañas activas: Bienvenida y Venta cruzada

Todas las demas plantillas —`missed_you`, `at_risk`, `win_back`, `near_reward`, `unclaimed_reward` y `valley`— se
**ocultan y se apagan** (owner: «Ocultar y apagar»; valle: «Sí, se desactiva»):

- el merchant **no las ve ni las puede crear**: el catalogo de plantillas no las lista y la API las rechaza;
- **el tick deja de ejecutarlas** (pasos 1, 1b y el refresco de valle);
- las campañas **vivas** de esas plantillas se **pausan**;
- el **codigo queda** (mismo criterio que la proximidad, §4) para reactivarlas despues.

Esto **supera la prioridad de Horas valle** registrada en la spec 0113 / ADR 0105.

### 2. Canales: la PWA para campañas y mostrador, la Wallet no se gasta en eso

| Aviso | Con notificaciones de la PWA activas | Sin ellas |
|---|---|---|
| Campaña de un comercio (`campaign`) | push de la PWA | **solo dentro de la app** — nunca Wallet (D1) |
| Aviso de mostrador (`transactional`) | push de la PWA | **solo dentro de la app** (D3 «PWA para no gastatar wallet», D5 «Solo en la app») |
| Recordatorio del dia sin compra (`reminder`, spec 0111) | **Wallet**; si no hay pase, push de la PWA (D7 «Wallet», respaldo «Push de la PWA») | — |
| `pass_refresh` (silencioso) | sin cambio | — |

D1, textual: «llegan solo al APp, luego tendremos que ver la manera de identificar si tienen o no instalada el PWA
y si tienen o no notificaciones activadas para mediante wallet incentivarlos a activar las notificaciones. si las
notificaciones no estan activadas todavia recibe los beneficios porque el PWA no requiere de notificaciones para
funcionar (salvo Bienvenida, esa campaña solo recibe luego de activar las notificaciones)».

Es el **inverso** de `planTransports` de hoy para `campaign` y `transactional`.

### 3. Bienvenida: se gana con la PWA instalada y las notificaciones activadas

Owner: «PWA + notificaciones». **Ya esta implementado** (`welcome-issue.ts`, commit `f3982ef`). Este ADR lo
registra y **supera el disparador del ADR 0099** («regala al instalar el pase»). No hay trabajo nuevo aca.

### 4. La proximidad del pase queda sin uso, sin borrarse

Owner: «en el futuro definiremos que campañas podran usar esto y como. pero no eliminemos el mecanismo de
proximidad, solo quedara sin uso por ahora». Y sobre el paso 4: **«Deja de correr»**. El tick no ejecuta
`placeConsumers`, asi que el pase no muestra ni promos ni saldos cerca del local. El codigo (planner, applier,
`pass_placement`) se conserva.

**Consecuencia: la #67 se resuelve.** Sin el paso 4, lo que queda del tick son las fases con alcance (~1,1 s
medido).

### 5. Limites: los de hoy, en un solo lugar

Owner: «dejemos los de hoy, pero necesitamos que sea facil de revisar porque la idea es que cada comercio tenga su
limite. entonces lo centralizamos en un archivo o funcion que podamos editar simplemente luego para no tener que
andar dando vueltas por todo el codigo para cambiar esto».

Los valores actuales no cambian: presupuesto de 24 h (`push-budget.ts`: 2 de mostrador, 3 con sonido), ventana
9–21, separacion de 3 min, cooldown y topes de `DEFAULT_PLACEMENT_LIMITS`, tope mensual de la Bienvenida. Lo que
cambia es **donde viven**: un unico modulo de limites, que es la puerta para limites por comercio. **Los valores por
comercio NO estan decididos**; este ADR solo pide que el lugar exista.

### 6. Venta cruzada: push + app, a pensar mejor

Owner, textual: «esto necesitamos pensarlo mejor. porque si es un beneficio que te da comprar en otro comercio, el
beneficio te lo envian a tu cuenta my.checkpass.club entonces si entra en push notificacion y dentro del app como
ahora».

La direccion es **push de la PWA + dentro de la app**. El cuando y el como del aviso **quedan abiertos**, a cerrarse
en su propia spec con el owner antes de escribirla.

### 7. Afuera, a otro ADR

Los avisos generales de CheckPass por Wallet («beneficios por vencer», «evento en la ciudad»): owner, «Después».
Tambien detectar si la PWA esta instalada sin notificaciones para incentivar desde la Wallet (D1: «luego»).

## Consecuencias

- **Se superan parcialmente:** 0031 (la Wallet ya no es «la» superficie del cliente), 0040 y 0095 (ruteo de
  `campaign`/`transactional`: PWA, nunca Wallet), 0065 (la proximidad queda sin uso), 0099 (disparador de la
  Bienvenida), 0103 §3 (el presupuesto deja de derivarse del tope de Google; se conserva por decision) y la
  prioridad de 0105/0113 (valle apagado).
- **Specs que salen de aca** (cada una con su TEMPLATE, cerrada antes del codigo):
  1. **Apagar plantillas + paso 4:** catalogo y API filtran a `welcome`/`cross`; el tick no corre las apagadas ni
     `placeConsumers`; las campañas vivas de esas plantillas se pausan. **Cierra la #67** (y su limpieza de los 99
     turnos vivos historicos de `ci-integration`, que la corrida completa del 2026-10-02 NO reprodujo).
  2. **Canales:** `planTransports` y el contrato del aviso de mostrador segun §2.
  3. **Limites centralizados** (§5), sin cambiar valores.
  4. **Aviso de la Venta cruzada** (§6), despues de cerrar el como con el owner.
- La UI de las plantillas apagadas es de GPT (zona pantallas, ADR 0114). Este lado entrega el filtro en la API y
  el contrato.

## Abierto

- Si la pausa de las campañas vivas apagadas se le avisa al merchant (y como). No preguntado.
- Que pasa con los `pass_placement` ya escritos en los pases emitidos cuando el paso 4 deja de correr (el pase
  sigue mostrando la ultima foto hasta que algo lo reescriba). Hallazgo a decidir en la spec 1.
