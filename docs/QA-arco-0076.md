# QA del arco 0076 — checklist para el owner

> **Que se esta probando:** las specs **0077, 0078, 0079, 0080 y 0081**, desplegadas en prod en el
> commit **`a7a35f9`** con las migraciones `0037`, `0038` y `0039` aplicadas y verificadas por SQL.
>
> **ACTUALIZADO 2026-09-19 — la UI del paso 3 ya se construyo e incluye Sellos y Puntos**
> (commit `b543983`, pusheado hoy). Este documento originalmente decia que Puntos «no tiene UI
> todavia»: eso ya no es cierto, se prueba por pantalla en **A1**. Lo que SIGUE sin pantalla es
> el monto por sello y el panel de TOS — eso se prueba por API en la seccion **B**.

## Antes de empezar (2 minutos)

- [ ] **Rotar la password de `neondb_owner`** en el panel de Neon y actualizar `DATABASE_URL` y
      `DATABASE_URL_UNPOOLED` en Vercel. Quedo en el transcript de la sesion de despliegue.
- [ ] **Saber que prod NO esta vacio**: hay **1 negocio real** (`LaCraft Beer Garden`, EC) con **1
      programa activo** de Sellos. **Prueba con una cuenta NUEVA**, no con esa.

## A) Lo que se prueba POR PANTALLA

### A1 · El alta completa, de punta a punta

- [ ] Crear una cuenta nueva y completar el wizard: **Cuenta → Negocio → Programa**.
- [ ] En el paso 3, elegir **Sellos**, un objetivo (entre 2 y 50) y el nombre del premio.
- [ ] **El programa se crea sin haber verificado el email.** Es el comportamiento correcto y nuevo
      (spec 0077): **crear** esta permitido durante el alta; **editar** no.
- [ ] El **QR** del programa se ve y se puede descargar.
- [ ] Repetir el alta con una SEGUNDA cuenta nueva y en el paso 3 elegir **Puntos**: pide puntos
      otorgados, monto de compra y costo del premio en puntos. Confirmar que el programa se crea
      con esos tres valores.

### A2 · El invariante que cierra el bypass (spec 0077) — el mas importante

- [ ] **Sin verificar el email**, volver a entrar y **editar** el programa (cambiar el objetivo).
      **Tiene que ser RECHAZADO.**
- [ ] Verificar el email y repetir: **ahora si deja editar.**

> ⚠️ **TRAMPA QUE PARECE UN BUG Y NO LO ES:** el permiso de alta **vence**. Dura **60 minutos desde
> que se creo la cuenta** y **5 minutos desde que se completo el alta**, lo que ocurra primero. Si
> el QA se hace pausado y de golpe «no deja crear», **no es una regresion: es el corte funcionando**.
> Crear la cuenta y completar el alta de corrido.

### A3 · El TOS por pais (spec 0078 + 0081)

- [ ] El negocio de prueba tiene que ser de **Ecuador** para ver el TOS de EC; cualquier otro pais
      cae al TOS `default`.
- [ ] Revisar el texto legal del programa: **tiene que decir «Los sellos se acumulan…»**, en
      plural. Si dice **«Los sello se acumulan…»** es el bug viejo y seria una regresion.
- [ ] En un negocio EC, el texto menciona la **legislacion vigente en EC**.

### A4 · Limpieza de `/backoffice/demo/*` (borrado hoy)

- [ ] Al terminar el wizard, tocar «Ir a mi panel»: llega a `/backoffice` con las tarjetas reales.
- [ ] La tarjeta **«Analíticas» ya no aparece** en el panel (no tenia pantalla real).
- [ ] Ninguna tarjeta del panel enlaza a `/backoffice/demo/...` (compara con lo que veias antes).

### A5 · El gate de email ya no te deja afuera del panel (spec 0082, commit `5ac30f9`)

**Con una cuenta cuyo email NO esta verificado:**

- [ ] «Ir a mi panel» al cerrar el wizard **entra a `/backoffice`** y se ven las tarjetas.
      Antes rebotaba a `/?e=email_not_verified`. **Este es el caso que disparo la spec.**
- [ ] Entrar a una seccion del panel (Marca, Locales, Catalogo): **la pantalla se ve**.
- [ ] Intentar una ACCION que escriba (guardar marca, crear un local): **tiene que fallar** con
      `email_not_verified`. Entrar si, acciones no.
- [ ] Abrir el **mostrador** y escanear: tiene que contestar
      **«Verificá tu email para operar el mostrador.»**
- [ ] Verificar el email y repetir las tres ultimas: **ahora todas funcionan**.

**Con un INTEGRANTE (staff), que no tiene email por diseño:**

- [ ] El mostrador **funciona igual, sin pedir nada**. Si a un integrante le pide verificar un
      email, es un bug grave: no tiene forma de hacerlo y el mostrador quedaria inutilizable.

## B) Lo que solo se prueba POR API (entregado sin UI, a proposito)

**Como:** logueado en el navegador, abrir la consola (F12) y pegar los `fetch`. Van con la cookie
de sesion automaticamente. **El contrato completo esta en `docs/specs/0081-contratos-de-api.md`.**

### B1 · «Un sello cada $X» — el pedido del owner (spec 0081)

```js
await (await fetch('/api/loyalty-program', {method:'PUT', headers:{'content-type':'application/json'},
  body: JSON.stringify({kind:'stamps', configuration:{target:10},
    rewards:[{type:'custom', label:'Cafe gratis'}],
    accrual:{mode:'per_amount', grant:1, blockAmount:'5.00'}})})).json()
```

- [ ] Responde **201/200** con `programId`.
- [ ] **El TOS cambia solo**: pasa a decir «Se otorgan 1 sellos por cada 5.00 USD…». **Esa es la
      variable #7 que pediste**, y la moneda sale del negocio, no del cuerpo.
- [ ] **Omitir `accrual` sigue dando «un sello por compra»**, con el texto de siempre.

### B2 · Puntos (spec 0079)

```js
await (await fetch('/api/loyalty-program', {method:'PUT', headers:{'content-type':'application/json'},
  body: JSON.stringify({kind:'points', configuration:{unitSingular:'punto', unitPlural:'puntos'},
    rewards:[{type:'custom', label:'Descuento', pointsCost:100}],
    accrual:{mode:'per_amount', grant:10, blockAmount:'1.00'}})})).json()
```

- [ ] Con un programa de Sellos **activo**, esto da **409**: hay que cerrar el programa antes de
      cambiar de modalidad. **Es lo correcto.**
- [ ] En un negocio **sin programa**, crea el de Puntos.
- [ ] **Puntos SIN `accrual` da 422**: el servidor **no inventa** el dinero.

### B3 · Las plantillas que vera el panel de TOS (spec 0081)

```js
await (await fetch('/api/loyalty-terms/templates')).json()
```

- [ ] Cada plantilla trae **`jurisdictionScope`** (`EC` o `default`).
- [ ] **NO aparece ninguna `global-draft`**: quedaron archivadas.
- [ ] Un negocio de EC ve **EC + default**; uno de otro pais ve **solo default**.

## C) Lo que NO hay que esperar que funcione (no existe todavia)

- **Pantalla para el monto por sello.** El API lo acepta y lo guarda (B1); decision del owner NO
  construirla en este arco.
- **Panel de TOS personalizado.** El endpoint devuelve las plantillas; la UI no existe.
- **`cashback` y `tiers`.** Dan **422** a proposito: estan en la base pero no habilitadas.

## D) Trampas conocidas, para no perseguir fantasmas

- **No crear un SEGUNDO negocio con el mismo usuario.** Hay un defecto **preexistente** (0072 §D3,
  sigue abierto): con 2+ negocios, el guard evalua el mas viejo y el writer escribe en el mas
  nuevo. **No lo introdujo este arco** y no tiene oraculo.
- **El TOS ya emitido no cambia** al archivar `global-draft`: `terms_markdown` se guarda
  renderizado. Verificado en el programa real: mismos 235 caracteres y su hash.

## Como cerrar el QA

Cada `[ ]` de A y B, marcado con lo que **viste en pantalla o en la respuesta**. Lo que falle va
con **que hiciste, que esperabas y que salio** — con eso se abre la spec de correccion.

**El orquestador puede verificar por SQL contra prod** lo que el owner haga por pantalla (que fila
quedo, que TOS se guardo, que `accrual_mode` tiene el programa). Pedirselo en vez de adivinar.
