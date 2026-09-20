# QA del arco 0076 — checklist para el owner

> **Que se esta probando:** las specs **0077, 0078, 0079, 0080 y 0081**, desplegadas en prod en el
> commit **`a7a35f9`** con las migraciones `0037`, `0038` y `0039` aplicadas y verificadas por SQL.
>
> **LO QUE ESTE ARCO ENTREGO ES API, NO PANTALLAS** (ADR 0070). El wizard de alta existe y usa la
> ruta nueva, asi que **el flujo principal SI se prueba clickeando**. Lo demas —Puntos, el monto
> por sello, el panel de TOS— **existe en la API y todavia no tiene UI**: se prueba con `fetch`
> desde la consola del navegador, y es exactamente lo que va a construir la etapa siguiente.

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

- **Pantalla para el monto por sello.** El API lo acepta y lo guarda; **la pantalla la decide la
  etapa siguiente**, con el contrato ya escrito.
- **Pantalla para Puntos.** Idem.
- **Panel de TOS personalizado.** El endpoint devuelve las plantillas; la UI no existe.
- **`cashback` y `tiers`.** Dan **422** a proposito: estan en la base pero no habilitadas.

## D) Trampas conocidas, para no perseguir fantasmas

- **No crear un SEGUNDO negocio con el mismo usuario.** Hay un defecto **preexistente** (0072 §D3,
  sigue abierto): con 2+ negocios, el guard evalua el mas viejo y el writer escribe en el mas
  nuevo. **No lo introdujo este arco** y no tiene oraculo.
- **La CI de `main` esta ROJA y es ajeno**: `tests/e2e/loyalty.spec.ts:16`, un timeout de la UI
  vieja de `/backoffice/demo`. Medido antes y despues del arco con contadores identicos.
- **El TOS ya emitido no cambia** al archivar `global-draft`: `terms_markdown` se guarda
  renderizado. Verificado en el programa real: mismos 235 caracteres y su hash.

## Como cerrar el QA

Cada `[ ]` de A y B, marcado con lo que **viste en pantalla o en la respuesta**. Lo que falle va
con **que hiciste, que esperabas y que salio** — con eso se abre la spec de correccion.

**El orquestador puede verificar por SQL contra prod** lo que el owner haga por pantalla (que fila
quedo, que TOS se guardo, que `accrual_mode` tiene el programa). Pedirselo en vez de adivinar.
