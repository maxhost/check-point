---
adr: 0077
fecha: 2026-09-20
estado: aceptada
resumen: El onboarding se parte en DOS recursos con ciclos de vida opuestos — el CHECKLIST («que hay que hacer y en que estado esta», derivado de hechos de la base, sobrevive a cualquier rediseño) y el TUTORIAL de cada item («toca aca, abri la camara», que ES la descripcion de una pantalla concreta y cambia cada vez que esa pantalla cambia). Meterlos en un endpoint los ata a la cadencia del mas volatil. El orden y la obligatoriedad los dicta la API, nunca la UI, y el texto viaja en la respuesta para que un segundo idioma sea un cambio de servidor; pero el ANCLA es una clave estable (`"verify-email"`), nunca un selector ni una coordenada, o cada rediseño de UI rompe el tour en produccion sin señal. Arranca con UN item (`verify-email`) y su almacenamiento es CODIGO: con un item no hay orden que cambiar ni obligatoriedad que alternar, y mover a tabla despues es invisible para la UI porque el JSON no cambia.
---

# 0077 — El onboarding son dos recursos: el checklist y el tutorial

## Contexto

El ADR 0070 §9 ya decidio que hay un onboarding guiado despues del wizard y que **el progreso
se DERIVA de los hechos que ya estan en la base**, no de una columna `onboarding_step`. Lo que
no decidio es la forma de la API, y eso quedo anotado en `0074-contratos-de-api.md` §3 como
**«el checklist derivado del ADR 0070 §9 no existe y esta diferido, con seis decisiones del
owner abiertas»**.

Este ADR cierra esas decisiones. Salen de una conversacion con el owner del 2026-09-20, donde
aparecio ademas un requisito que no estaba en el 0070 y que cambia la forma de la API: el
onboarding tiene **dos niveles**, no uno.

Textual del owner:

> *«una cosa es el checklist del propio onboarding, pero estos pasos a paso dentro de cada
> item, donde vivirian?»*

Y su cierre:

> *«no son la misma api o endpoint a pesar de que son de la misma familia onboarding, pero uno
> es el checklist es decir lo que hay que hacer y en que estado esta y el otro es un tutorial»*

## Lo que se midio antes de decidir (2026-09-20)

- **`GET /api/onboarding/state` ya existe** y aplica el §9 al pie de la letra («devuelve
  HECHOS, nunca un numero de paso»), pero su alcance declarado es **«que falta para terminar
  el alta»**, corre **antes** de la verificacion de email y **no lleva gate** a proposito
  (ADR 0070 §11). No es el checklist y no puede serlo.
- **`requireApiOwner` aplica el gate de email SIEMPRE**, en el paso 3 de su escalera fija
  (`api-owner.ts:30-40`): no tiene opcion para saltarlo.
- **`email_verified` ya viaja en la sesion de better-auth** y se lee sin consulta extra
  (`auth-guards.ts`, `session-view.ts`).
- **Los colores de marca nacen con default `NOT NULL`** (`schema/business.ts:87-91`,
  `'#176548'` / `'#E78132'`), asi que «¿el merchant eligio sus colores?» **no es derivable**.
  `logo_object_key` y `stamp_image_object_key` **si** lo son: son nullable.
- **No hay columna de idioma del merchant** en ninguna tabla. `core.terms_template` y
  `otp_delivery` tienen `locale` (este ultimo con `CHECK in ('es','pt','en')`), pero **no hay
  de donde sacar en que idioma hablarle a un owner**.
- **No hay una sola dependencia de IA en el repo** y el catalogo crea **de a un producto por
  request**: no hay endpoint de importacion en lote.
- **La API de staff ya esta completa** (`GET`/`POST /api/staff`, `/[userId]/pin`,
  `/[userId]/status`). Lo que falta de staff es pantalla, no API.
- **El staff no tiene email al que escribirle:** su direccion sintetica termina en
  `@staff.invalid` (`UNDELIVERABLE_EMAIL_DOMAIN`, aseverado en `auth-start.test.ts:92`) y
  `POST /api/merchant/auth/verify-email` la rechaza con 400 `invalid_email`.

## Decisiones

### 1. Son DOS recursos, y la razon es que tienen ciclos de vida opuestos

| | Item del checklist | Paso del tutorial |
|---|---|---|
| Que es | «Verifica tu email», «Carga tu catalogo» | «Toca aca → abri la camara → saca la foto» |
| Como se sabe que esta hecho | Un **hecho en la base** | Un **toque en la pantalla** |
| ¿Sobrevive al cambio de dispositivo? | Si, es un hecho del negocio | No importa: es un tutorial |
| ¿Tiene sentido sin UI? | Si | No: **es** la descripcion de una pantalla |
| ¿Cambia si se rediseña la pantalla? | **No** | **Siempre** |

La ultima fila es la que manda. **El item sobrevive a cualquier rediseño; el tutorial ES el
rediseño.** Servirlos juntos ata el recurso estable a la cadencia del volatil, y ademas
obliga a bajar el texto de **todos** los tutoriales en cada carga del backoffice — que es
justo lo que no se quiere en movil, donde el checklist se pide siempre y un tutorial se abre
una vez.

```
GET /api/onboarding/checklist      → ESTADO.     Chico, en cada carga, cambia poco.
GET /api/onboarding/guide/{item}   → CONTENIDO.  Mas grande, bajo demanda, cambia con la pantalla.
```

**El segundo no se construye todavia** — ver §5.

### 2. El orden y la obligatoriedad los dicta la API, nunca la UI

Textual del owner: *«lo importante cmo dije es poder controlarlos via API e incluso indicar el
orden, un paso que hoy es 1, mañana sera 3 si asi lo considero y unpaso que hoy es opcional
malana puede ser obligatorio»*.

La respuesta trae `position` y `required` por item. La UI **no** tiene una lista propia de
pasos ni decide cual bloquea: pinta lo que recibe, en el orden que recibe.

`required` tiene **un** significado definido, y es la regla que el owner dicto para el email:
*«sin esto no desbloqueas nada de lo que sigue»*. O sea: **un item `required` que no esta
`done` bloquea a todos los de `position` mayor.** No se introduce un segundo campo para
separar «obligatorio» de «bloqueante» — hoy no hay ningun caso que los distinga, y un campo
sin caso es el molde generico que el owner rechazo explicitamente.

### 3. El texto viaja en la API; el ancla es una clave, no una coordenada

Textual del owner: *«que viva en el API, porque si mañana tenemos otro lenguaje, es mas facil
que todo el guide venga del api y la UI se encargue solo de pientar en coordenadas
especificas»*.

Se acepta, **con un limite**: si la API guardara coordenadas o selectores, pasaria a conocer
la estructura de cada pantalla y **la dependencia quedaria invertida** — el backend atado al
frontend, con cada rediseño de UI convertido en un cambio coordinado del servidor. Peor: un
hotspot que apunta a un boton que ya no existe **no le rompe nada a nadie en CI**, aparece en
produccion y no avisa.

Por eso: **la API dice que decir y en que orden; la UI dice donde.** El item trae un `anchor`
que es una **clave estable** (`"verify-email"`), y la UI la mapea al elemento real. El dia que
el boton se mueva, se mueve el mapa de la UI y la API no se entera.

**Limite de hoy, declarado y no resuelto:** no hay columna de idioma del merchant, asi que el
servidor no tiene de donde elegir. La respuesta declara `"locale": "es"` fijo. **De donde sale
el idioma de un merchant es su propia spec**, la misma que traiga el segundo idioma.

### 4. Arranca con UN item, y su almacenamiento es CODIGO

Textual del owner: *«feature es empezar por un solo item del onboarding, porque me permite
probar el concepto y luego añado el segundo»*, y *«no necesitas el molde extensible, porque
nadie te pidio que anotes nada»*.

El unico item es **`verify-email`**, y es el unico de los cinco candidatos que **no necesita
pantalla nueva ni feature previa**: su accion ya existe
(`POST /api/merchant/auth/verify-email`) y su hecho ya viaja en la sesion.

**El almacenamiento arranca en codigo**, no en tabla, por tres razones medidas:

1. **Con un item no hay nada que configurar.** `position` es 1 y `required` es `true` por la
   regla del propio owner. Una tabla daria cero flexibilidad real y costaria una migracion.
2. **Mover a tabla despues no cambia el contrato de la UI.** El JSON es identico; el eje «quien
   manda» (§2) ya quedo resuelto del lado de la API y es independiente de donde se guarde.
3. **El repo ya tiene el patron** para un catalogo chico y tipado: `ENTITLEMENTS`
   (`entitlements/catalog.ts`), donde una fila mal formada **no compila**.

**Lo que la tabla comprara el dia que se elija, y lo que NO:** el «¿esta hecho?» de cada item
es **codigo** (una consulta distinta por dominio), asi que **agregar un item nuevo va a exigir
deploy igual**. Una tabla solo vuelve sin-deploy tres cosas: reordenar, alternar
obligatoriedad y editar el texto. Esa es la decision que hay que tomar cuando exista el
**segundo** item, con dos ejemplos reales a la vista en vez de uno imaginario.

### 5. El tutorial no se diseña hasta que exista el primero

Hoy **no hay ningun tutorial**: el paso del email es una accion de un toque —textual del
owner, *«eso es algo que se hace de a fuera, esta bien»*— y los items que si lo necesitan
(catalogo, staff) todavia no tienen pantalla.

Diseñar ahora el recurso del tutorial seria diseñar contra un ejemplo imaginario, que es el
mismo error que este ADR evita en §4. **Se decide cuando llegue el primero**, que sera el de
catalogo o el de staff.

**Lo que si se hace ahora, porque cuesta cero y evita el error caro:** el contrato HTTP declara
que el tutorial **es un recurso aparte que todavia no existe**, para que quien construya la UI
no meta los pasos del tour adentro del checklist y despues haya que desarmarlo.

### 6. El checklist NO puede llevar el gate de email, y por eso no usa `requireApiOwner`

Un endpoint cuyo primer item es «verifica tu email» **no puede estar bloqueado por no haber
verificado el email**: se gatearia a si mismo y el owner nunca veria la instruccion que vino a
buscar. Es el mismo argumento que ya sostiene el 200-siempre de `/api/merchant/session`
(`0074-contratos-de-api.md` §1).

`requireApiOwner` no sirve, porque su escalera **siempre** evalua el email en el paso 3 y no
admite saltarlo. **Pero no se escribe un resolvedor nuevo** — eso reintroduciria la
divergencia de seis resolvedores que la spec 0072 mato. El checklist reusa las **mismas piezas
compartidas** y recorre la escalera del ADR 0073 §1 **salteando solo el paso 3**:

```
1. ¿hay sesion?       → 401 unauthorized          (getSession, igual que todos)
2. ¿es owner activo?  → 403 not_owner             (ownerContext, la MISMA funcion)
3. ¿email verificado? → SE SALTEA, a proposito    ← la unica desviacion, y es el punto
4. ¿el negocio OPERA? → 403 business_suspended | business_closed  (businessStatusFailure, pura)
```

**El paso 4 NO se saltea**, y la asimetria es deliberada: saltear el 3 tiene una razon
(auto-gateo); saltear el 4 no tendria ninguna, y un negocio `closed` no necesita un checklist
de onboarding.

**Y el paso 2 hace trabajo real, no es ceremonia:** el staff **no tiene email al que
escribirle** (`@staff.invalid`), asi que un checklist que le llegara le pediria verificar una
casilla que no existe y cuya accion contesta 400. El 403 `not_owner` es lo que lo evita.

## Lo que este ADR NO decide

- **Como se almacena el checklist cuando haya dos o mas items.** Se decide entonces (§4).
- **La forma del recurso de tutorial.** Se decide cuando exista el primero (§5).
- **De donde sale el idioma de un merchant.** Su propia spec, junto al segundo idioma (§3).
- **Los items 2 a 5 que el owner enumero** (catalogo, staff, programa, marca). Cada uno llega
  con la spec de su feature. Lo unico medido sobre ellos, para que no se redescubra:
  **catalogo por foto con IA no tiene nada en el repo** (cero dependencias de IA, sin import en
  lote) y ya figura en el ADR 0070 como feature con spec propia; **staff no necesita API**,
  solo pantalla; **los colores de marca no son derivables** y el afiche y la rentabilidad son
  acciones que **no dejan rastro**, asi que esos tres sub-pasos no tienen forma de marcarse
  `done` sin una decision que todavia no se tomo.

## Correccion a una premisa, medida

En la conversacion que origino este ADR el owner planteo que *«hoy el modelo de como funcionan
los programas no te permiten ediciones en un programa activo»*. **Es falso hoy**, y conviene
que quede escrito para que no motorice un rediseño innecesario: `PUT /api/loyalty-program` es
un upsert y **edita un programa activo sin problema**. Solo hay dos bloqueos
(`loyalty-program.ts:98-109`):

- `status = 'closing'` → 409 *«El programa esta en cierre y no puede editarse.»*
- cambiar `kind` (Sellos ↔ Puntos) → 409 *«Cierra el programa actual antes de cambiar su
  modalidad.»*

Nombre de los puntos, diseño de tarjeta, sello, premios y TOS **se editan hoy**, con el
programa activo.
