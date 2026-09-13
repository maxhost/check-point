---
adr: 0062
fecha: 2026-09-12
estado: aceptada
resumen: Que un server component no filtre datos internos al navegador NO se prueba con el HTML renderizado, ni con `JSON.stringify` de las props, ni con una allow-list de claves, ni leyendo las props dos veces, ni aseverando el conjunto completo en UN SOLO estado: las CINCO tienen preimagen, y las cinco estuvieron en verde. Se prueba con las cuatro aserciones juntas —`type`, `key`, UNA lectura (`structuredClone`) y VALOR EXACTO de todas las props— corridas COMPLETAS en CADA estado, cada estado en su propio `it`. Vive en un helper (`expectCrossesExactly`) justamente para que repetirlo entero sea mas barato que recortarlo.
---

# 0062 — Lo que cruza al cliente se pinnea por valor exacto, y en una sola lectura

## Contexto

La spec 0063 (D7) agrega `/backoffice/subscription`: un **server component** que lee la fila de
`core.subscription` —con `stripe_customer_id`, `stripe_subscription_id` y
`downgrade_requested_at`— y le pasa a un componente **cliente** (`SubscriptionConsole`) un DTO
que omite esos tres campos. `CLAUDE.md` ya tiene la regla de producto («una ruta que devuelve una
entidad al navegador nunca serializa claves internas»; un revisor ya cazo esa fuga en marca, spec
0025), y la spec exigia un test que la cerrara.

El oraculo se escribio **seis veces**. Las cinco primeras estaban en verde y **no cerraban la
propiedad** — cada una la cazo una mutacion, y **cinco de las seis las encontro un revisor
independiente, nunca el autor**. Las dos ultimas las introdujo el intento de cerrar la anterior:
es el patron de sub-correccion de la spec 0057, y aca se repitio dos veces seguidas.

## Las seis vueltas, con lo que cada una enseño

1. **El render del HTML (`renderToStaticMarkup`) es un PROXY.** Bajar la fila CRUDA
   (`subscription: row`) dejaba **66/66 en verde**. Motivo: `renderToStaticMarkup` **no emite el
   payload RSC**, asi que las props de un componente cliente **nunca aparecen en el markup**. El
   test pinneaba «la consola no IMPRIME las claves», no «la pagina no las PASA» — dos propiedades
   distintas, y la que el diseño afirma es la segunda. Es el hueco de `choosePushPromptView` de la
   tarea 38 otra vez: extraer/renderizar convierte una propiedad de COMPORTAMIENTO en una de
   DECISION y **deja el cableado sin oraculo**.
2. **`JSON.stringify` de las props tambien es un proxy, y su preimagen es IDIOMATICA.** Inspeccionar
   las props y buscar `cus_` por substring se evade con un **`Map`** (`JSON.stringify` de un `Map`
   da `{}`) y, peor, con **`Promise.resolve(row)`** — que es el **idiom de Next 15**: la propia
   pagina recibe `searchParams` asi. **Flight SI serializa `Map`, `Set` y `Promise`**; el
   `stringify` los borra. Verde con la fuga puesta.
3. **La allow-list de CLAVES no ve el valor.** Fijar el conjunto exacto de las 8 props cierra «una
   clave de mas», pero no «un valor de mas dentro de una clave permitida»: un `Map` o una `Promise`
   **anidados** pasan (residual R13), y sobre todo pasa un **secreto TRANSFORMADO** — un
   `cus_…` en **base64** bajo la clave permitida `notice` evade la allow-list, el chequeo de
   planitud y el substring, **y Flight lo manda tal cual**. Todo guard por FORMA o por SUBSTRING
   tiene una preimagen por TRANSFORMACION.
4. **Un oraculo por valor exacto tampoco cierra si LEE DOS VECES lo que el consumidor lee UNA.**
   Con `toEqual` del objeto entero mas un recorrido de planitud, el test lee cada prop **dos**
   veces; **Flight lee cada valor una sola vez**. Un **getter con estado** (primera lectura
   `cus_…`, siguientes `"Plus"`) o un **`Proxy`** con `get` equivalente dejan **15/15 en verde** y
   **Flight manda el secreto** — verificado con una sonda sobre `react-server-dom-webpack`, que
   emitio `"endpoint":"cus_secret_ZZ9"`. El canal no es la forma ni el valor: es el **conteo de
   lecturas**.
5. **Y aun asi quedaba un canal ENTERO afuera: `element.key`.** Toda la discusion anterior es sobre
   `element.props` — pero **Flight serializa el ELEMENTO**, que es `type`, `key` y `props`. El `key`
   **no vive en `props`** (ni, por lo tanto, en su `structuredClone`) y **tampoco se renderiza a
   HTML**, asi que era invisible para TODAS las aserciones sobre `props` y para el test del markup a
   la vez. Con
   `key={row.stripeCustomerId}` el alcance entero quedaba **VERDE 15/15** y la sonda sobre
   `react-server-dom-webpack` mostraba el wire `["$","div","cus_secret_ZZ9",{…}]`: **fuga medida, no
   limite**. Lo cazo el revisor de la sesion B. La leccion es de ALCANCE, no de forma: **aseverar
   exhaustivamente un objeto no dice nada de lo que vive al lado de ese objeto.**

6. **Y la sexta la abrio el fix de la quinta: aseverar el conjunto completo en UN SOLO ESTADO.** Al
   agregar el segundo estado (la rama bloqueada) se aseveraron **solo `key` y la prop que
   cambiaba** — porque el conjunto entero «no entraba» en el archivo. Dos mutaciones quedaron
   **VERDES 44/44**: un secreto en **otra** prop (`notice`) **gateado a ese estado** (nulo en el
   primero, asi que pasaba su `toEqual`; no mirado en el segundo) —y encima **se imprimia en el
   HTML**, o sea que cruzaba por los dos caminos—; y un secreto **dentro de `downgradeBlock.message`**
   conservando el substring que el `expect.stringContaining("2")` exigia. **Un oraculo parcial en un
   estado nuevo no es «cobertura incompleta»: es una puerta.** Y el sintoma que lo delata es
   presupuestario —«el conjunto completo no entra»—, no conceptual: de ahi que la decision sea
   ponerlo en un HELPER, para que repetirlo entero sea **mas barato** que recortarlo.

## Decision

**El oraculo de «esto no cruza al cliente» tiene CUATRO requisitos, y los cuatro son necesarios:**

1. **No es el render.** Se inspeccionan **las props del elemento** que devuelve el server component
   (patron ya usado en `locations-backoffice-pages.neon.integration.test.ts`), no su HTML.
2. **Se asevera el VALOR EXACTO de TODAS las props con un `toEqual` del objeto entero** — no una
   allow-list de claves, no un substring, no `JSON.stringify`. Contra un objeto esperado completo no
   hay clave de mas, valor de mas ni transformacion que pase **DENTRO DE ESE OBJETO**, porque el test
   deja de preguntar «¿esta lo prohibido?» y pasa a exigir «¿es exactamente esto?». **La primera
   version de este ADR escribia esa frase SIN el «dentro de ese objeto», y esa omision es
   exactamente por donde entro la quinta preimagen.**
3. **La lectura es UNA SOLA: `structuredClone(element.props)`, y las aserciones van sobre el clon.**
   Es lo unico que cierra el canal del conteo de lecturas, y ademas **rechaza por construccion** lo
   que Flight serializa y un objeto plano no deberia tener: un `Proxy` no clonable muere con
   `DataCloneError`.
4. **Se asevera tambien `element.type` y `element.key`, y las CUATRO aserciones se corren
   COMPLETAS en CADA estado, cada estado en su propio `it`.** Las cuatro viven juntas en
   `expectCrossesExactly` (`billing-pages-support.ts`) — no por estilo: **un helper es lo que hace
   que repetir el conjunto entero salga mas barato que recortarlo**, y el recorte fue la sexta
   preimagen. Tres precisiones medidas:
   - **`type`**: un `type` que salga de datos viaja al wire y ni el clon ni el `key` lo ven.
     Aseverar el componente esperado ademas hace que un refactor que **envuelva** la consola
     (`<main><SubscriptionConsole/></main>`) diga lo que pasa: `expected 'main' to be [Function
     SubscriptionConsole]`, en vez de un rojo que hable del `structuredClone`.
   - **cada estado en su propio `it`**: adentro de un mismo `it` el primer rojo corta y los estados
     siguientes **no se evaluan** (medido: la fuga del `key` solo exhibia el secreto del primero),
     asi que el rojo no dice CUAL estado se rompio.
   - **cada estado se siembra con claves internas REALES**: el estado bloqueado no tenia ninguna y
     lo mas que podia exhibir una fuga del `key` era el string `"null"` (React coacciona:
     `key = '' + config.key`). Con claves sembradas, la misma mutacion da **dos** rojos que nombran
     **dos** secretos distintos: `expected 'cus_props_…' to be null` y `expected 'cus_bloq_…' to be
     null`. Un oraculo que no puede exhibir el secreto no es un oraculo.

Se conserva un helper `nonPlainPaths` (en `billing-pages-support.ts`) **solo por el mensaje de
error**: dice el CAMINO del valor no plano (`props.offers.leak: [object Map]`), que es lo que
convierte un rojo en un diagnostico. No es el que cierra la propiedad. **Y ojo con lo que dejo de
hacer al pasar al clon: `structuredClone` APLANA el prototipo de una instancia (`Leak` →
`Object.prototype`), asi que sobre el clon `nonPlainPaths` ya NO detecta instancias** —sigue
detectando `Map`/`Set`/`Date`—. No es un agujero, y eso tambien esta medido: **Flight RECHAZA las
instancias y los `Object.create(null)`** («Only plain objects, and a few built-ins, can be passed to
Client Components»). Es un limite, no una fuga — pero el comentario del test que decia lo contrario
era falso y se corrigio.

**Regla general, que es lo que hay que llevarse:** cuando un oraculo inspecciona un objeto que otro
runtime va a serializar, **el oraculo tiene que leerlo de la misma forma y la misma cantidad de
veces que el consumidor real**. Si el consumidor lee una vez y vos leyendo dos, existe un valor que
te miente. Y antes de creerle a un guard sobre serializacion, **medi que manda el serializador de
verdad** (acá: una sonda de ~30 lineas sobre `react-server-dom-webpack` respondio que manda
`Map`/`Set`/`Promise`/`TypedArray`/getters/`toJSON`, y que **no** manda props extra de arrays,
claves `Symbol` ni no-enumerables) — sin eso no se distingue una **fuga** de un **limite**.

## LIMITE DECLARADO — y es la parte mas importante de este ADR

**«La pagina no filtra NADA por NINGUN canal» es una afirmacion UNIVERSAL, y ningun conjunto finito
de mutaciones la demuestra.** Este ADR llego a **seis** vueltas de oraculo y cada vuelta la cerro un
revisor plantando un canal nuevo: el markup, `JSON.stringify`, la allow-list de claves, el conteo de
lecturas, `element.key`, el estado parcial. Habia una septima empezada (una fuga en `notice` gateada
a `?done=cancel`, o sea un TERCER estado) cuando el owner corto el ciclo — **y tenia razon: el bucle
no tiene condicion de corte, porque siempre queda un canal mas.**

**Lo que este oraculo SI prueba** (cada punto con su mutacion en rojo, transcrita mas abajo): que lo
que cruza al cliente en los DOS estados sembrados es **exactamente** el objeto esperado, leido una
sola vez, con el `type` y el `key` que corresponden. **Eso cubre todo error PLAUSIBLE**: agregar una
prop, bajar la fila cruda, olvidarse del DTO, anidar algo no serializable.

**Lo que NO prueba, y se declara en vez de perseguirse:** un canal que alguien introduzca **a
proposito** por una via no aseverada — un estado que el test no siembra, o una prop del elemento
distinta de `type`/`key`/`props`. Cerrar eso pide un oraculo de otra clase (interceptar el
serializador en el render real), no otra mutacion.

**La regla de metodo, que vale mas que este caso:** una propiedad UNIVERSAL («nada de X pasa jamas»)
se cierra con **un oraculo acotado MAS un limite declarado**. Si se la trata como una propiedad
comun, la revision adversarial no termina nunca — y el costo no lo ve nadie hasta que lo pregunta el
dueño del producto. Aca fueron horas, sobre una feature cuyo riesgo real se habia cerrado en la
primera vuelta.

## Consecuencias

- El test vive en `billing-pages.neon.integration.test.ts` («la pagina le pasa a la consola el DTO,
  NO la fila») y su segundo estado en «con 2 locales activos el boton de bajar NO se deshabilita».
  Las CINCO preimagenes quedan como mutaciones ejecutadas con su asercion literal en
  `/tmp/delta-d2.md`, `/tmp/revision-sesion-b.md`, `/tmp/sesion-b-bis.md` y el plan de pruebas.
- **Los cuatro puntos estan APLICADOS al arbol, y cada mutacion esta EJECUTADA con su asercion
  transcrita** (sesion B-ter): `key` → **dos** rojos, `expected 'cus_props_27bf91c1' to be null` y
  `expected 'cus_bloq_27bf91c1' to be null`; fuga en `notice` gateada al estado bloqueado → rojo
  **solo** en el `it` de ese estado, `- "notice": null` / `+ "notice": "cus_secret_SIXTH_S1"`; fuga
  en `downgradeBlock.message` → rojo en el `toEqual`; `<main>` envolviendo la consola → `expected
  'main' to be [Function SubscriptionConsole]`. El requisito 3 lo midio la sesion A (E4 getter → `+
  "endpoint": "cus_secret_ZZ9"`; E5 `Proxy` → `DataCloneError`).
- **CORRECCION DE UNA TRANSCRIPCION INFLADA DE LA VERSION ANTERIOR:** decia `expected
  'cus_secret_ZZ9' to be null` «en los DOS estados». Falso por dos motivos a la vez — el segundo
  estado no tenia claves sembradas (daba el string `"null"`) y encima **compartia el `it`, asi que
  no llegaba a evaluarse**. Las dos cosas estan arregladas arriba, y el numero de rojos que este ADR
  cita ahora sale de una corrida, no de una expectativa.
- **Lo que este ADR enseña sobre SI MISMO:** su primera version afirmaba que contra un `toEqual` del
  objeto entero «no hay clave de mas, valor de mas ni transformacion que pase». Era una afirmacion
  absoluta sobre un alcance implicito, y fue falsa en 24 horas. **Un ADR que declara una propiedad
  cerrada tiene que nombrar SOBRE QUE la cerro** — si no, la proxima preimagen no vive en el
  mecanismo sino en el borde que nadie escribio.
- Cualquier pagina futura que baje un DTO a un componente cliente copia este patron. Un test que
  mire el HTML, el `stringify` o solo las claves **no** cumple este ADR.
- No cambia nada de produccion: es una decision sobre COMO SE PRUEBA, no sobre que hace el producto.
