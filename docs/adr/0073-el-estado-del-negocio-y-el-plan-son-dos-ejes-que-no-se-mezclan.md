---
adr: 0073
fecha: 2026-09-17
estado: aceptada
resumen: Suspender un comercio no es bajarle el plan (decision del owner). `status` y `plan` son dos ejes ortogonales, se evaluan en orden fijo y `can()` NUNCA mira `status` — mezclarlos hace que la app le diga «mejora tu plan» a un negocio suspendido. Y el catalogo de entitlements declara `requiresLiveSubscription` por entrada en vez de derivar un `effectivePlan` unico, porque la asimetria entre locales y campañas existe a proposito.
---

# 0073 — El estado del negocio y el plan son dos ejes que no se mezclan

## Contexto

La 3a spec del arco del alta (ADR 0070) unifica los limites por plan en **una** capa de
entitlements, y al mismo tiempo tiene que volver real a `core.business.status`, que esta en
produccion desde la migracion `0036` y **no lo lee ningun guard**.

Las dos cosas caen sobre los mismos archivos —los `_auth.ts` de cada dominio— y la tentacion
obvia es resolverlas con una sola pregunta: «¿este negocio puede hacer X?». El orquestador
llego a plantearle al owner el caso «un negocio `free` que ya excedio un limite que despues
se baja» como si fuera el mismo problema.

**El owner lo corrigio el 2026-09-17, textual:** «Nosotros no bajamos nada, estas hilando muy
fino […]. **Si yo suspendo un comercio no es cambiar de plan es deja de acceder a las
funciones**, si lo cierro no hay ni siquiera login».

## Decision

### 1. Dos ejes, orden fijo, y `can()` no mira `status`

```
1. ¿hay sesion?            → 401 unauthorized
2. ¿es owner activo?       → 403 not_owner
3. ¿email verificado?      → 403 email_not_verified
4. ¿el negocio OPERA?      → 403 business_suspended | business_closed   ← eje status
5. ¿el plan lo permite?    → 402 plan_not_allowed | 409 limit_reached   ← eje plan
```

El eje `status` responde «¿este negocio opera?» y el eje `plan` responde «¿su plan lo
permite?». **Son preguntas distintas con respuestas distintas y accionables distintas**, y
por eso no comparten funcion: `can(ctx, 'campaigns.enabled')` recibe la fila de
`core.subscription` y **nunca** la de `core.business`.

**Lo que cierra:** un `can()` que devolviera `false` por suspension haria que la superficie
diga «mejora tu plan» a un negocio suspendido — la accion **contraria** a la que necesita.
Es el mismo error que el ADR 0063 [R2] ya corrigio una vez en locales, donde «Mejora tu plan
para abrir otro» era falso con una baja programada.

**El orden 2 → 3 → 4 tambien es la regla, no una optimizacion:** puestos antes de resolver
al owner, un INTEGRANTE recibe `email_not_verified` en vez de `not_owner` (lo cazo un test de
la spec 0067) y un tercero puede sondear el estado de un negocio ajeno.

### 2. El catalogo declara `requiresLiveSubscription` por entrada

La capa **no** deriva un `effectivePlan` unico del que todo cuelgue. Cada entrada del
catalogo declara si exige suscripcion viva:

- `locations.max` → `requiresLiveSubscription: false`
- `campaigns.enabled` → `requiresLiveSubscription: true`

**Lo que cierra:** la asimetria de hoy existe **a proposito**. Un `plus` con `interval` NULL
y sin `stripe_subscription_id` —la forma A1 de la spec 0063, que existio en produccion— no
puede activar campañas, pero **si conserva sus 3 locales**, porque el tope de un negocio sin
suscripcion es 1 «y no 0» para que pueda **archivar y salir** (`locations/core.ts:68-72`).
Un `effectivePlan` que degradara a `free` es mas simple de leer y **cambia el comportamiento
de locales**. Esta capa es una unificacion, no un cambio de producto.

### 3. Agregar un limite es una fila, y el plan sin fila pone la suite en rojo

Requisito explicito del owner el 2026-09-17: «tendremos que tener una forma de añadir nuevos
limites de forma simple y clara». La fila del catalogo es **lo unico** que se escribe.

Y su contraparte: hoy un plan sin fila cae al tope **mas restrictivo en silencio**, asi que
introducir `enterprise` lo aterrizaria en 1 local — el peligro ya esta escrito como
advertencia en `locations/core.ts:58-62` y no tiene oraculo. Un test recorre
`ENTITLEMENTS × PLANS_CONOCIDOS` y exige fila explicita: **el plan nuevo sin limites
declarados se descubre en la suite, no en produccion.**

## Consecuencias

- **La spec 0072 no resuelve «bajamos un limite y alguien ya lo excedia»**, y eso es
  correcto: el owner lo difirio («cuando lleguemos alli trabajaremos en ello»). El unico
  caso vivo —el owner pide bajar de plan— ya esta resuelto con el bloqueo duro
  (`409 downgrade_blocked` / `downgrade_blocked_campaigns`) y el freno del webhook
  (`marketing/plan-brake.ts`).
- **El guard de `status` va en cada superficie, no solo en el login.** Medido: `auth.ts` no
  pisa `session.expiresIn`, asi que rige el default de better-auth 1.6.26, **7 dias**
  (`dist/context/create-context.mjs:147`). Cerrar la puerta no expulsa a quien ya entro: un
  staff con la sesion viva seguiria acreditando una semana.
- **`auth/start` no decide nada.** No resuelve negocio (solo toca `merchant_auth.user`) y el
  owner de un negocio `suspended` **si tiene que poder entrar**, para ver el motivo y el
  boton de contacto. El corte de `closed` va donde se **crea** la sesion.
- **El motivo (`suspension_reason`) se serializa solo al owner.** El staff no obtiene sesion
  y el consumidor nunca lo recibe.
