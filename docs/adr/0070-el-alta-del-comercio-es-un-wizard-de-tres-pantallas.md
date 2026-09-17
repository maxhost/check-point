---
adr: 0070
fecha: 2026-09-16
estado: aceptada (decisiones del OWNER, 2026-09-16) — la spec que la implementa todavia NO existe
resumen: El alta deja de ser 3 pasos con contraseña y eleccion de plan, y pasa a ser un WIZARD de tres pantallas (entrar · negocio+local · programa) que termina en una pantalla con el QR listo, con el programa de fidelizacion YA ACTIVO. Decisiones del owner: (1) no se elige plan, todos entran `free`; (2) no hay contraseña — el owner entra por email y queda logueado al registrarse, verifica el email para el onboarding y usa LINK MAGICO en los logins siguientes; (3) el staff NO usa email: cada negocio tiene un handle (`@lafarmacia`) y cada miembro entra con `nombre@lafarmacia` + PIN de 6 digitos que el owner genera y regenera; (4) marca sin logo ni colores, con «marca avanzada» opcional, y un SELLO PLACEHOLDER nuestro hasta que suba el suyo; (5) categoria OBLIGATORIA, guardada como `gcid:` de Google; (6) pais prellenado por dispositivo/IP pero editable, + Mexico; (7) los limites por plan viven en una capa de entitlements unica; (8) la base se borra entera y se arranca limpia. Google Business es una feature SEPARADA que el dia de mañana reemplaza la pantalla 1 y autocompleta el wizard; el diseño de hoy debe poder recibir ese paquete sin reescribirse.
---

# 0070 — El alta del comercio es un wizard de tres pantallas

## Contexto

El objetivo que puso el owner: **«que el comerciante pueda darse de alta en minutos y tener
su programa de fidelizacion andando en 10 minutos, porque esto es lo que mas valor le
dara»**, con la friccion lo mas cerca de cero posible.

Y una restriccion de arquitectura explicita: **la UI la va a trabajar por afuera** (con
ChatGPT), asi que lo que se construye aca es la **capa de logica y los endpoints**. Textual:
*«el dia de mañana si creamos una app mobile o cambiamos completamente la UI estariamos
abstrayendo la capa de logica de la UI»*.

El alta de hoy son 3 pasos (cuenta con contraseña · datos del negocio · eleccion de plan) y
despues hay que configurar la marca aparte para poder activar el programa.

## Lo que se midio antes de decidir (2026-09-16)

Cuatro hechos del arbol que abarataron decisiones que parecian caras:

1. **La marca ya nace configurada.** `core.business` tiene los tres colores con default y
   `logo_object_key` es nullable (`schema/business.ts:37-42`). «Configurar la marca para
   activar el programa» **no era un gate tecnico**, era una creencia de la UI.
2. **El sello ya es opcional en la base.** `stamp_image_object_key` es nullable y el insert
   escribe `stamp?.objectKey ?? null` (`loyalty-program.ts:157-170`). Y existe **una ruta
   publica** que lo sirve (`/api/public/loyalty/[businessId]/[programId]/stamp`), que hoy
   contesta 404 sin imagen: el placeholder se implementa **ahi adentro** y lo reciben todos
   los consumidores —Wallet, tarjeta, preview— sin tocar ninguno.
3. **El plan ya nace `free` en el servidor.** La ruta de alta inserta
   `subscriptions {plan:'free', status:'active'}` (`api/onboarding/business/route.ts:139`) y
   el paso 3 es un checkout **posterior** del cliente. Sacarlo es borrar UI, no tocar el modelo.
4. **Las reglas de plan estan en tres lugares distintos** — `locationLimitForPlan` /
   `effectiveLocationLimit` (`locations/core.ts:78-102`), `campaignsAllowedFor`
   (`marketing/plan-gate.ts`), `plan-brake.ts` / `plan-change.ts` — y **ya divergieron una
   vez** (esta declarado en el docblock de `plan-gate.ts`). Cada feature nueva suma un cuarto.

## Decisiones

### 1. El wizard son tres pantallas, y termina en el QR

| # | Pantalla | Pide | Prellenado |
|---|---|---|---|
| 1 | Entrar | email | — |
| 2 | Negocio + local | nombre · **categoria** · direccion | pais, moneda y timezone; nombre del local «Principal», oculto con un solo local |
| 3 | Programa | cada cuantos sellos · que premio | Sellos, premio en texto libre |
| → | **Tu QR** | nada: es la recompensa | ya generado |

El owner unifico negocio y local en una sola pantalla («si el local solo pone direccion,
¿por que no unificarlo?»). Con un solo local el nombre ni se muestra: aparece cuando da de
alta el segundo, que es cuando empieza a significar algo.

**La cuarta no es un paso, es el momento de valor.** Hoy el kit con el QR esta tres clics
adentro del backoffice; sin llegar a una pantalla que el comerciante pueda mostrar o
imprimir, «programa andando en 10 minutos» no tiene como demostrarse.

**Fuera del wizard, explicitamente:** eleccion de plan, contraseña, logo, colores, sello y
catalogo.

### 2. No se elige plan

Todo comercio que se registra entra en `free`. Textual: *«es friccion innecesaria»*. El
limite del plan gratis se define despues, y por eso →

### 3. Los limites viven en UNA capa de entitlements

Pedido literal del owner: *«mañana añado una feature nueva que sera para free o un limite
que sera para free y deberia ser simple decir "esta nueva feature es solo acceso para
cuentas Business", o "esta feature tiene un limite de 3 para cuentas gratis"»*.

Forma acordada: un catalogo declarativo de features y limites, una API unica de consulta
(`can()` / `limitOf()`), **el plan efectivo calculado una sola vez** —y no solo desde
`subscription.plan`: ya esta aprendido que hace falta `pending_plan` y `hasLiveSubscription`,
y que esa logica duplicada ya divergio— y un endpoint para que la UI sepa que mostrar con
candado sin re-derivarlo pantalla por pantalla. Los tres call-sites de hoy se migran a ella.

### 4. Identidad: el owner por email, el staff por handle + PIN

**Owner.** No hay contraseña. Textual del owner: *«cuando se registre con el email ya queda
logueado, pero debe verificar su email para el Onboarding, y sera Link magico para
siguientes login»*. O sea: la pantalla 1 no tiene espera — escribe el email y entra.

**Staff.** No necesita email. Cada negocio tiene un **handle** derivado de su nombre
(«La Farmacia» → `@lafarmacia`), y cada miembro se loguea con `nombre@lafarmacia` + un
**PIN de 6 digitos**. Textual: *«lo añado en staff con nombre y esto genera el id
lucas@lafarmacia y un pin. Ese pin se genera automaticamente, entonces el owner se lo da a
Lucas. En el primer login le pide cambiar el pin por uno que el recuerde. Si Lucas pierde
ese pin, el owner lo re-genera desde su panel de staff»*.

Esto reemplaza al alta de staff de hoy, que lo crea con `signUpEmail` y una contraseña de
>=8 que elige el owner y le pasa por fuera (`staff.ts:119`).

**Consecuencia que se acepta y hay que ejecutar:** sin contraseña **se borra** todo el arco
de recuperacion —`/forgot-password`, el middleware que da 503, `PASSWORD_RECOVERY_ENABLED`,
`merchant-recovery*`—. Sin contraseña no hay nada que recuperar: el login **es** la
recuperacion. Es superficie que desaparece, no que se mantiene.

**Verificado en el arbol:** el plugin `username` de better-auth esta disponible (1.6.26). Su
validador por defecto es `/^[a-zA-Z0-9_.]+$/` —**no acepta `@`**— pero es configurable via
`usernameValidator`.

### 5. El handle del negocio y la URL publica son el MISMO identificador

El owner adelanto que cada comercio va a tener su pagina publica tipo Yelp en
`checkpass.club/es/lafarmacia`, y que esa va a ser la web que use en Google Business.

Es el mismo `lafarmacia` del login del staff. **Se diseña una sola vez.**

### 6. Marca minima, sello con placeholder

No se pide logo ni colores: se ofrece «marca avanzada» para quien quiera tomarse el tiempo.
El **tipo** de programa sigue siendo elegible (Sellos / Puntos) y la **imagen del sello**
tiene un diseño propio nuestro por defecto hasta que el comerciante suba el suyo.

### 7. Categoria obligatoria, con el identificador de Google

La categoria entra al wizard como campo **obligatorio** y se guarda como **`gcid:` de
Google**, no como un enum propio: `categories.list` devuelve `{categoryId:"gcid:cafe",
displayName}` filtrado por `regionCode` + `languageCode`, y esos ids son estables.

Como esa API exige el Basic API Access aprobado, se arranca con una **lista curada corta**
versionada en el repo con los `gcid` reales. El dia que Google apruebe, la lista se
reemplaza por la API **sin migrar un solo dato**.

### 8. Pais prellenado pero editable, + Mexico

El timezone sale del dispositivo (`Intl.DateTimeFormat().resolvedOptions().timeZone`), que
es exacto; el pais de la IP (`x-vercel-ip-country`, disponible en todos los planes de
Vercel) como respaldo; y la lat/long de la IP para **sesgar el autocomplete de Geoapify**,
que es el campo de mas friccion del wizard. **Siempre editable en el wizard.**
`COUNTRY_CURRENCY` ya mapea `MX → MXN`; falta sumarlo a la lista del wizard y a
`supportedCountryCodes`.

### 9. Onboarding: despues del wizard, guiado y no bloqueante

Checklist en el backoffice —logo, colores, sello propio, catalogo, costos, staff, mas
locales, Wallet— enseñando a usar la app. **El progreso se DERIVA de los hechos que ya
estan en la base**, no de una columna `onboarding_step`: un contador se desincroniza el dia
que alguien hace las cosas fuera de orden o desde otro dispositivo, y ademas es lo que
permite que Google Business llegue con cuatro campos llenos y tres pasos aparezcan
completos sin inventar reglas de salto.

### 10. Base de datos desde cero

Textual: *«borramos todo, comercios, usuarios, staff, locales, programas, todo, comenzamos
con una DB limpia para pruebas»*. No hay migracion de datos y el esquema queda libre.
**Lo que no vive en la base y hay que cerrar aparte: Stripe** — customers y subscriptions
siguen ahi, y una suscripcion viva sigue facturando y mandando webhooks contra un negocio
que ya no existe.

## Lo que queda para despues (features con spec propia)

- **Google Business.** Reemplaza la pantalla 1 y autocompleta el wizard. Dos scopes con
  costos distintos: `openid email profile` para entrar (barato, sin verificacion pesada) y
  `business.manage` para traer la ficha (scope **sensible**, con verificacion de la app).
  Ademas exige el **Basic API Access** por formulario, cuyo prerequisito es **un Google
  Business Profile verificado y activo 60+ dias** con un sitio web. Ese es el reloj mas
  largo del proyecto y no se acelera escribiendo codigo.
- **Catalogo por foto del menu con IA.**
- **La pagina publica por comercio.**

## Hallazgos a decidir — NO acordados con el owner

Se escriben aca como abiertos, no como decision suya:

1. **Que bloquea exactamente la falta de verificacion del email.** El owner dijo que el
   owner «debe verificar su email para el Onboarding», pero no si puede terminar el wizard
   sin verificar, ni que pasa con el programa si no verifica nunca. Mientras no este
   verificado, cualquiera puede escribir el email de otro y quedarse con una sesion.
2. **Las reglas del slug**: unico global, palabras reservadas, sugerido pero editable con
   chequeo de disponibilidad, y que **no cambie solo** si el negocio se renombra (romperia
   logins y URLs). Es propuesta del orquestador.
3. **La defensa del PIN.** 6 digitos son 1.000.000 de combinaciones: sin rate limit por
   cuenta y bloqueo progresivo es forzable en minutos, y da acceso a acreditar saldo. Entra
   como requisito tecnico de la spec, con su test.
4. **Que hace el wizard si el pais detectado esta fuera de la lista soportada.**
