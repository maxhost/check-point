---
adr: 0070
fecha: 2026-09-16
estado: aceptada (decisiones del OWNER, 2026-09-16; los 4 puntos abiertos cerrados el mismo dia) — la spec que la implementa todavia NO existe
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

## Decisiones del owner sobre los cuatro puntos abiertos (2026-09-16, misma fecha)

Los cuatro «hallazgos a decidir» de la primera version de este ADR **se cerraron con el
owner**. Ya no son abiertos: son decisiones suyas y se citan como tales.

### 11. La verificacion de email NO bloquea el alta, bloquea TODO el onboarding

Textual del owner: *«para el alta no pedimos verificacion. Una vez estemos en la cuenta,
alli para iniciar el onboarding, basicamente cualquier accion si requerimos verificar el
email»*. El flujo que dicto, en tres pasos:

1. El merchant crea la cuenta desde el wizard **sin friccion**.
2. Entra a su cuenta directamente al terminar el wizard y ve el onboarding.
3. **El primer paso del onboarding es verificar el email**, y sin eso no avanza el resto.

O sea: **creada la cuenta sin verificacion, se bloquea todo** lo que venga despues del
wizard. El motivo que dio el owner no es de seguridad sino de negocio: *«hoy Staff es
gratis, pero va a pasar a ser parte del plan de pago quizas»* — una cuenta no verificada no
puede quedar habilitada a consumir lo que mañana se cobra.

**Medido en el arbol (2026-09-16):** la columna `email_verified` **ya existe** con default
`false` (`server/schema/auth.ts:10`) y **no se lee en una sola linea de produccion** — su
unico uso hoy es soporte de tests (`counter-integration-support.ts:56,141`). El gate es
codigo nuevo, no una migracion.

### 12. El slug no sigue al nombre: se cambia explicitamente y se verifica

Decision del owner: *«el slug no cambia con el cambio de nombre, el merchant tiene que
hacer un cambio explicito y eso verifica si esta disponible»*. Renombrar el negocio deja el
slug intacto (cambiarlo solo romperia los logins del staff **y** la URL publica); cambiarlo
es una accion aparte y deliberada, con chequeo de disponibilidad.

**Medido:** no existe hoy ninguna columna `slug` ni `handle` de negocio en el esquema
(`server/schema/*.ts`). Es terreno virgen, sin migracion de datos.

### 13. El PIN se defiende con bloqueo escalado propio, NO con el del plugin

Escalado dictado por el owner: **5 fallos → bloqueo 15 min; 3 fallos mas → 1 h; el
siguiente fallo → 24 h.** PIN **hasheado**. El owner lo ve **una sola vez** al generarlo
para pasarselo al staff, el staff lo cambia en su primer uso, y despues el owner **nunca
puede verlo: solo regenerarlo**.

**Por que no alcanza el plugin — medido en `better-auth@1.6.26`, a pedido del owner:**

| Hecho | Evidencia |
|---|---|
| El plugin `username` no trae **ninguna** regla de rate limit propia | `dist/plugins/username/index.mjs`, cero matches de `rateLimit` |
| Si lo cubre una regla **global**: `/sign-in*` → 3 requests / 10 s | `dist/api/rate-limiter/index.mjs:370-376` |
| Pero la clave es **`(IP, path)`, no la cuenta** | `createRateLimitKey(ip ?? "no-trusted-ip", path)`, linea 287 |
| El storage por defecto es **`memory`** (un `Map` del proceso) y nosotros no configuramos nada | linea 174 + `server/auth.ts` sin `rateLimit` |
| `enabled` = `isProduction`: **apagado en dev y en test** | linea 171 |

Las tres consecuencias que lo descartan como defensa del PIN:

1. **Keyeado por IP, todo el staff de un local comparte el bucket** y se bloquean entre si
   desde el WiFi del negocio. Es palabra por palabra la leccion que este repo ya escribio
   en `consumer/rate-limit.ts:15` («keyed by phone on purpose — many legitimate customers
   enroll from the same shop WiFi»). Y el espejo: un atacante que rote IPs no tiene limite
   por cuenta **ninguno**.
2. **`memory` en Vercel es por instancia de lambda y se evapora**: el escalado 15 min → 1 h
   → 24 h no tiene donde persistir ahi.
3. **Apagado en test**: ningun test puede morder ese oraculo sin encenderlo a mano.

Y el numero: 3/10 s son ~26.000 intentos/dia desde **una sola IP**; contra 1.000.000 de
combinaciones, ~39 dias con una IP y **menos de 10 horas con 100 IPs**. No frena un ataque
distribuido.

Por eso el PIN se verifica en **ruta propia**, con el bloqueo persistido en la base y
keyeado por **`(negocio, handle)`**. El plugin puede seguir siendo el modelo de identidad,
pero su endpoint no es el camino del PIN. **Hallazgo colateral medido:** el plugin tambien
publica `/is-username-available`, que es un enumerador gratuito de handles de negocios —
entra al mismo `disabledPaths` que ya existe para `emailOTP`.

### 14. El pais se prellena pero el selector siempre ofrece TODA la lista

Textual: *«el selector siempre que pueda viene pre llenado, pero tiene todas las opciones
[…] si usa un VPN o algo puede estar en un pais diferente al real. necesitamos que pueda
corregirlo»*. La deteccion es una sugerencia, nunca un filtro: **no se recorta la lista a
lo detectado**.

Y el caso del pais no soportado **no se resuelve porque no se admite**: decision del owner,
*«esto de momento es solo para LATAM, entonces no ofreceremos de momento en USA o Europa»*.

**Medido:** la lista de paises esta duplicada en **dos** lugares —el wizard
(`app/onboarding/page.tsx:18`) y el verificador de Geoapify
(`server/location-providers.ts:22`)—, ambas con los mismos 8 (AR BR CL CO EC UY PY PE).
`COUNTRY_CURRENCY` (`lib/currencies.ts:8`) ya cubre ~28 paises, MX incluido: sumar Mexico
toca **dos** listas, no tres, y ninguna tabla de monedas.

### 15. Tres confirmaciones del owner al cerrar la spec 0067 (2026-09-16)

1. **El escalado del PIN** queda tal como lo lee la seccion 13: *«5 intentos y bloquea por 15
   minutos, si vuelve a equivocarse 1h (solo 3 intentos), si se equivoca se bloquea 24h»*, leido
   como 5 fallos → 15 min; tras liberarse, 3 fallos → 1 h; tras liberarse, el siguiente fallo →
   24 h. **Confirmado.**
2. **Un email ya existente NO abre sesion en la pantalla 1.** Textual: *«email existente: exacto no
   abre sesion en pantalla 1, manda magic link, sin contraseña»*. Nacio como requisito tecnico del
   orquestador —sin contraseña, escribir el email de otro merchant le entregaria el negocio— y el
   owner lo **adopto como decision suya**.
3. **El slug no se escribe en el alta, y el staff se crea solo con el nombre.** Textual: *«usa el
   slug del negocio, el merchan crea el usuario, se le adiciona el @ y el slug, el slug no puede
   escribirlo en el momento del alta»*. O sea: el wizard **no expone campo de slug** (se genera del
   nombre), y al dar de alta a un integrante el owner escribe **solo el nombre** — el servidor
   agrega el `@` y el slug del negocio, tomandolo **de la sesion y nunca del body**. Cambiar el slug
   sigue siendo posible, pero es la accion explicita y **posterior** de la seccion 12.

**Consecuencia declarada de (3), que no es decision del owner:** si el slug no es editable en el
alta, la forma que genera el algoritmo es la que el comerciante se lleva puesta. La spec 0067 adopta
`"La Farmacia"` → **`la-farmacia`** (con guion): quitar los separadores, como sugiere la ilustracion
`@lafarmacia` de la seccion 4, colapsa `el-arbol` y `elarbol` en el mismo handle. Si el owner
prefiere sin guiones es una linea de `slugify` y afecta solo a negocios nuevos.

### 16. Lo que este arco entrega es API, y eso incluye el contrato escrito

El «Contexto» de este ADR ya decia que la UI la trabaja el owner por fuera. Se sube a decision
explicita porque **el orquestador se la salteo en la primera version de la spec 0067**, listando dos
pantallas como archivos a editar (el caso completo esta en `docs/LECCIONES.md`).

Cada spec de este arco entrega **dos** piezas: los endpoints, y el **contrato HTTP normativo** que
los describe —metodo, ruta, entrada, salida, todos los `code` de error, si setea cookie— con la
forma del anexo `specs/0055-contratos-del-orquestador.md`. Sin ese documento, «entregamos los
endpoints» no es transferible a quien construye la UI.

**Costo declarado, con decision pendiente del owner:** entregar solo la capa de API rompe
`/login` y `/onboarding`, que hoy llaman a `signIn.email` / `signUp.email`, y deja al producto **sin
entrada** —y por lo tanto sin QA humano— hasta que aterrice la UI de afuera. Las tres salidas y su
costo estan en la seccion «Abierto» de la spec 0067.

### 17. La UI vieja de lo que se refactoriza se BORRA

Decision del owner del 2026-09-16, tomada sobre las tres salidas que la spec 0067 le planteo como
bloqueante y **contra la recomendacion del orquestador**, que era recablear las pantallas viejas a
los endpoints nuevos para conservar el QA humano.

Textual: *«quiero que vayas borrando la UI de lo que vamos refactorizando para justamente no dejar
rastros viejos de lo que se que ya no usaremos»*, y el flujo que describe para la UI nueva: *«luego
le diga a chatGPT mira, necesitamos una UI para un wizard lee aqui la documentacion del api o
endpoint. y el cree la UI»*.

Esto convierte al **contrato de API de la seccion 16 en el entregable critico del arco**: es
literalmente el insumo que recibe quien construye la UI. Un contrato incompleto no produce una UI
incompleta — produce una UI inventada.

**Costo aceptado por el owner, escrito para que ninguna spec del arco lo redescubra al final:**
mientras dure el arco, el producto **no tiene entrada por navegador** y por lo tanto **no hay QA de
pantalla**. Es la excepcion explicita y acotada a la regla «entre una evidencia mas y una pantalla
que el owner pueda probar, gana la pantalla»: aca no hay pantalla que ganar todavia, asi que la
verificacion es por HTTP con las respuestas transcriptas, y se declara como limite en cada spec.

**Lo que el borrado arrastra, y no es opcional:** borrar una pantalla deja enlaces muertos. El caso
medido en la spec 0067 son **10 referencias en 8 archivos**, y tres de ellas son los `redirect` del
guard compartido `requireBackofficeSession` — o sea **control de acceso**: apuntados a una ruta
borrada convierten un rebote en un **404**, y el caso `staff_disabled` del ADR 0055 pierde el canal
por el que explica el rechazo. La limpieza de referencias es parte del borrado.
