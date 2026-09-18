---
adr: 0076
fecha: 2026-09-18
estado: aceptada
resumen: El gate de email deja de vivir en la PUERTA HTTP y baja al WRITER, porque en la puerta es evadible — reproducido contra Neon: la misma sesion sin verificar reescribe el programa por `POST /api/onboarding/program` (200) y come 403 por `PUT /api/loyalty-program`. En su lugar, un PERMISO DE ALTA que el servidor escribe en la fila de la SESION al crear la cuenta: no viaja en ningun request, no lo puede falsificar el cliente, es acotado a las escrituras del alta y caduca (email verificado · 5 min tras el alta completada · 60 min desde la creacion de la cuenta, lo que pase primero). Ademas: UNA sola ruta de escritura del programa en vez de dos, la API acepta `kind` (la UI es del owner, no la decide el API), y el TOS pasa a ser por PAIS con personalizacion libre en el panel — las dos sin migracion de esquema, porque `terms_template` ya tiene `jurisdiction_scope` y las clausulas ya aceptan texto libre.
---

# 0076 — El permiso de alta vive en la sesion, y el gate baja al writer

## Contexto

El arco del alta (ADR 0070) puso el wizard **antes** de verificar el email, por decision
textual del owner: *«para el alta no pedimos verificacion»*. La spec 0072 despues aplico
`requireApiOwner` —cuyo paso 3 es `email_not_verified`— a 12 entradas HTTP. La 0075 ya tuvo
que sacarle ese paso a una de ellas (el QR) porque volvia inalcanzable el resultado del
propio alta.

Este ADR cierra el problema de fondo en vez de seguir parchando superficies de a una.

### El motivo original del gate NO era de seguridad

El **ADR 0070 §11** registra el motivo del owner, textual: *«hoy Staff es gratis, pero va a
pasar a ser parte del plan de pago quizas»* — una cuenta no verificada no puede quedar
habilitada a consumir lo que mañana se cobra. El propio ADR lo dice con todas las letras:
**«El motivo que dio el owner no es de seguridad sino de negocio»**.

Se implemento como control de seguridad **transversal de API**. Ese desajuste es el que
viene produciendo friccion spec tras spec.

### Y el gate en la puerta es EVADIBLE — medido, no supuesto

Reproducido contra Neon el 2026-09-18 con una sonda temporal, **un solo usuario con
`emailVerified: false`, una sola sesion**:

| Llamada | Resultado |
|---|---|
| `POST /api/onboarding/program` (2da vez, programa existente) | **200** `{"created":false}`, y la base quedo `{"target":50,"unitName":"sello"}` — **reescrito** desde `target: 8` |
| `PUT /api/loyalty-program`, **misma cookie** | **403** `{"code":"email_not_verified"}` |

La puerta del wizard no solo crea: **edita**, y sin gate. Y **ya habia pasado**: el
comentario de `server/loyalty-program.ts:109-116` cuenta que la spec 0072 encontro lo mismo
con el eje `status` («la otra reescribia el programa de un negocio `suspended` — medido: 200
con `created:false` contra el 403 de la gateada») y lo arreglo **bajando el invariante al
writer**. El del email quedo afuera. Es el mismo bug, por la misma grieta, dos veces.

## Decision

### 1. El invariante baja al writer, no a la ruta

`saveProgram` es **el unico lugar que escribe un programa**. Ahi vive la regla, y por eso
deja de importar cuantas puertas HTTP haya. Misma forma que la 0072 le dio al eje `status`.

**La regla que aprende:** crear no es editar. El alta puede **crear**; **editar** exige
email verificado, salvo que corra el permiso de alta de §2.

### 2. El permiso de alta vive en la fila de la SESION, y no viaja

`POST /api/merchant/auth/start` es el unico punto donde el servidor sabe, **por si mismo**,
que arranca un alta: es el que crea la cuenta y abre la sesion. Ahi escribe el permiso **en
la fila de la sesion**.

**LO QUE HACE QUE ESTO SEA SEGURO, y es la propiedad central de este ADR: el permiso NO
VIAJA.** El cliente nunca lo manda, no esta en ninguna respuesta, no esta en la cookie, la
UI no sabe que existe. El servidor lo lee de la fila que **ya** consulta para saber quien
sos. **No hay ningun campo de ningun request que pueda influir en esa lectura**: para
mentir habria que escribir en la base.

Lo unico que viaja es la cookie de sesion. **Medido en este repo** (sonda sobre
`ctx.authCookies.sessionToken`): `httpOnly: true`, `sameSite: lax`, `maxAge` 604800 (7 dias),
y el valor va firmado con HMAC-SHA256 (`makeSignature`, `server/merchant-session.ts:38`). El
navegador no la lee ni la altera: cualquier cambio rompe la firma y `getSession` la rechaza.
(`secure` sale `false` solo porque se midio en local sobre `http`.)

**Medido tambien que el vehiculo existe sin plugin:** better-auth 1.6.26 soporta
`session.additionalFields` de forma nativa (el core lee `options.session?.additionalFields`
al parsear la salida). Importa porque **un plugin SI agregaria superficie HTTP** por el
catch-all — la leccion de la spec 0046, que vive en la skill `gotchas-del-repo`.

### 3. Que autoriza el permiso, y que NO

**Autoriza solo escrituras del alta:** crear y editar **mi** negocio y **mi** programa.

**No autoriza nada mas:** staff, locales, marca, campañas, catalogo y billing conservan el
gate entero. Es exactamente lo que el ADR 0070 §11 protege y lo que el motivo de negocio del
owner pide.

**El QR queda AFUERA del permiso, a proposito.** `GET /api/loyalty-program/qr` conserva su
guard propio de la spec 0075 (sin paso 3, permanente). Si dependiera del permiso, el
comerciante que vuelve al dia siguiente sin verificar dejaria de ver su QR — que es
justamente lo que la 0075 arreglo. El permiso gobierna **escrituras**; el QR es una lectura
de una URL publica, ya analizada y declarada segura en esa spec.

### 4. Cuando se cierra la ventana

**Lo que ocurra primero de estas tres:**

1. **El email se verifica.**
2. **5 minutos despues de que el alta este completa** (existen negocio y programa).
   Decision del owner.
3. **60 minutos desde que se creo la cuenta.** **Agregado por el agente y confirmado por el
   owner**: sin este tope, quien crea la cuenta y **nunca termina el wizard** no dispara
   nunca el evento de (2), y el permiso vive lo que dure la sesion — **7 dias medidos**.

El corte por hechos derivados —y no por un contador de pasos— es el principio que el **ADR
0070 §9** ya fijo para el onboarding: *«el progreso se DERIVA de los hechos que ya estan en
la base»*, no de una columna `onboarding_step`.

### 5. UNA sola ruta de escritura del programa, no dos

Hoy hay dos endpoints que escriben el mismo programa y llaman a la misma `saveProgram`:
`POST /api/onboarding/program` (cuerpo corto, sin gate) y `PUT /api/loyalty-program` (cuerpo
completo, gateado). **Se unifican en una**, que acepta cuerpo corto o completo.

Decision del owner: *«Una sola ruta de api si hacen lo mismo y vamos a solucionar el gate de
otra manera»*. Y el motivo tecnico coincide: **dos puertas sobre un mismo writer es
precisamente lo que produjo el bypass**, dos veces. Cada puerta extra es un lugar mas donde
olvidar un invariante.

### 6. La API acepta `kind`; la pantalla es del owner

Textual del owner: *«deberiamos permitirlo a nivel de API y ya como yo hago la UI para eso es
otro tema. Pero no deberia ser el API la que no me lo permita»*.

Queda como regla general del arco: **la API no niega una modalidad que el dominio soporta
porque la pantalla todavia no exista.** Hoy el dominio habilita `points` y `stamps`
(`loyalty-program/validation.ts:11-12`); `tiers` y `cashback` estan en el CHECK del esquema
pero **no** en el codigo, asi que esas dos siguen siendo trabajo de dominio, no de contrato.

Lo que cada modalidad le exige a quien llama, medido:

| | Sellos | Puntos |
|---|---|---|
| `configuration` | `unitName` + `target` 2–50 | `unitSingular` + `unitPlural` |
| `accrual` | `per_purchase` o `per_amount` | **forzado a `per_amount`** (`accrual.ts:22-27`): `grant` >0 **y** `blockAmount` >0 |
| `rewards` | exactamente 1, sin costo | 1..N, cada uno con `pointsCost` >0 (`rewards.ts:14-15`) |

### 7. El TOS es por PAIS, y el personalizado se edita entero en el panel

Decision del owner: un TOS por pais, **empezando por EC**, elegido por el pais que el negocio
selecciona en el wizard. Y personalizacion **avanzada en el panel de admin, no en el
wizard**: hereda el texto por defecto y se puede editar entero como texto libre.

**Ninguna de las dos necesita migracion de esquema**, medido:

- `core.terms_template` **ya tiene** `jurisdiction_scope`, `locale`, `category`,
  `template_markdown`, `variables_allowlist`, `version`, `status`
  (`server/schema/loyalty.ts:186-208`).
- `renderedTerms` **ya interpola** `business_legal_name`, `program_name`, `program_kind` y
  `country_code` (`loyalty-program/terms.ts:33-41`).
- **El texto libre ya se acepta**: cada clausula es `templateId` **o** `text`
  (`loyalty-program/validation.ts:129-143`).

Lo que falta es **sembrar y seleccionar**: hoy existe un solo scope, `global-draft`/`es`, con
2 plantillas publicadas, y el wizard lo pide **hardcodeado**
(`onboarding/program-defaults.ts:60-68`). El selector pasa a ser `business.countryCode` con
caida a un scope por defecto cuando el pais no tenga plantilla propia.

**Consecuencia declarada, no decidida por el agente:** en cuanto un comercio guarda su TOS
personalizado, ese programa **deja de heredar** las actualizaciones futuras del TOS de su
pais. Es lo normal en un texto personalizado, pero significa que un cambio legal no alcanza
solo a los que editaron.

**Dos defectos de hoy que entran con esto**, los dos vistos en la misma sonda:

1. El texto legal renderizado dice **«Los sello se acumulan…»**: `program_name` se llena con
   `configuration.unitName`, que es **singular**. Es texto que ve el consumidor.
2. **`country_code` se pasa como variable pero NO esta en el `variables_allowlist`** de las
   semillas (solo `business_legal_name` y `program_name`), asi que hoy un TOS por pais **no
   podria nombrar a su pais**.

## Alternativas descartadas

**Un usuario de sistema para el wizard** (propuesta del owner). El instinto es correcto —que
el wizard tenga MENOS poder que una sesion completa— pero el vehiculo rompe el modelo: el
writer resuelve el negocio **desde la sesion** (`saveProgram(userId)` → `programForOwner`).
Con una identidad compartida no hay `userId` del cual resolver, asi que habria que mandar el
`businessId` en el cuerpo — que es lo que el **ADR 0070 §15.3 prohibe** y lo unico que impide
que un comerciante toque el programa de otro. Convierte «edita **tu** programa» en «edita
**un** programa». Ademas no se puede revocar para un caso sin afectar a todos, y la auditoria
queda firmada por el robot en vez de por el comerciante — los dos modos clasicos de fallar de
las service accounts compartidas.

**Un flag en el request** («vengo del wizard»). Es exactamente la falla que la literatura de
step-up auth lista con nombre propio: *aceptar el claim desde el cliente*. La recomendacion
publicada es la contraria —**estado opaco del lado del servidor**— que es lo que §2 hace.

**Un token firmado del lado del cliente** (estilo claim `acr`/`amr` de OIDC). Funcionaria,
pero es **peor** que lo que ya tenemos: un claim firmado vale hasta que expira, y una fila en
nuestra tabla de sesiones se revoca en el acto. No hace falta maquinaria de OIDC cuando ya
hay sesion server-side.

**Gatear «solo durante el onboarding» por un contador de pasos.** Lo prohibe el ADR 0070 §9 y
ya fue declarado no implementable en la spec 0075. El permiso de §2 **no** es un contador: no
describe en que paso esta el usuario, sino que la **sesion nacio de un alta**, que es un
hecho del servidor.

## Consecuencias

- **Cierra un bypass vivo**, reproducido. Y lo cierra en el writer, donde no depende de que
  nadie se acuerde de gatear la proxima puerta.
- **Reconcilia el gate con su motivo declarado**: bloquear el consumo de lo que se va a
  cobrar, no bloquear que un comercio termine su propia alta.
- **Superficie de API mas chica**: un endpoint de escritura del programa en vez de dos.
- **Una migracion nueva** (la columna del permiso en la sesion) y **semillas de TOS por
  pais**. El resto del TOS no toca esquema.
- **Lo que NO cambia:** las 11 entradas restantes del ADR 0073 §1 conservan el gate entero, y
  el QR conserva el guard de la 0075.

## Trabajo que habilita

Tres specs **disjuntas**, en este orden (la tercera depende de las dos primeras):

| # | Alcance | Migracion |
|---|---|---|
| A | TOS por pais: semillas EC + default, seleccion por `countryCode`, `country_code` al allowlist, y el «Los sello» | semillas |
| B | Permiso de alta en la sesion + el invariante crear/editar en `saveProgram` (cierra el bypass) | columna en `session` |
| C | Unificar en una ruta de escritura y aceptar `kind` con los campos de cada modalidad | no |
