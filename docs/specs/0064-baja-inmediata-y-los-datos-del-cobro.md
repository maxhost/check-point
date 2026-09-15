---
spec: 0064
estado: implementada
fecha: 2026-09-13
resumen: La baja a Free pasa a ser inmediata y sin devolucion (ADR 0063), con aviso de cuando conviene bajar; y se cierran los cuatro huecos de UI que el QA de la 0063 encontro — etiqueta del intervalo, modal de confirmacion del cambio de intervalo, fecha de renovacion, e importe cobrado con link al recibo de Stripe.
---

# 0064 — Baja inmediata y los datos del cobro

**ESTADO: `implementada` (2026-09-15).** Commit `ca2d746`, desplegado a prod (`Vercel: success`
verificado para ESE sha) y **QA del owner en prod: TODO EN VERDE** — que es el oraculo que define
(`CLAUDE.md`). **No hubo revision independiente final: el owner corto el ciclo de verificacion**, y de
ahi salio la regla de presupuesto y condicion de corte.

**LAS TRES DECISIONES DEL ORQUESTADOR (O-2, O-3, O-4) ESTAN ACEPTADAS Y CERRADAS (2026-09-15).**
Decision literal del owner: «si estan implementadas y funcionando por mas que no las acepte y no las
rechace marcalas como terminadas». **Como se aceptaron, que es lo que hay que saber para no leer de mas:
EN BLOQUE y sobre el producto YA FUNCIONANDO**, no evaluadas una por una — al owner se le presentaron las
tres, etiquetadas como decisiones del orquestador y con **O-3 marcada explicitamente como contraria a un
pedido literal suyo**, y eligio cerrarlas. O sea: **son decisiones VIGENTES del producto**, con el mismo
peso que cualquier otra, y quien quiera cambiarlas abre una spec nueva.

**La unica nota operativa que sobrevive (no es una decision abierta, es diagnostico):** el camino de
**O-3** —no migrar los negocios ya diferidos— **todavia no lo ejercito nadie**. `A3 Test`
(`e9c96528-5f3e-4952-b283-7434ec867b4f`) sigue diferido al **13-10**. Si ese dia no aterriza en `free`
limpio, **el sospechoso es O-3 y no un bug nuevo** — arrancar por ahi ahorra perseguir un fantasma.

## De donde sale

Del **QA del owner sobre la spec 0063 en prod** (2026-09-13), que dio 21 casos en verde y dejo tres
cosas: un bug (D4), una contradiccion de diseño (D3 → **ADR 0063**) y cuatro huecos de UI (F2).
**Los cuatro huecos NO son fallas del implementador: la spec 0063 nunca los pidio** — verificado
leyendola. Es la clase de agujero que solo aparece cuando alguien usa la pantalla.

## Alcance

### 1. La baja es inmediata (ADR 0063)

- Al confirmar la baja, se cancela la suscripcion en Stripe **en el acto** (`subscriptions.cancel`,
  **sin** `prorate` ni `invoice_now`: los dos vienen `false` por default, verificado en los tipos de
  `stripe@22.5.0`). El plan queda `free` y se pierde el acceso Plus al instante.
- **El modal lo dice ANTES de confirmar**: que es inmediato y que no se devuelve el tiempo pagado.
- **`subscriptions.cancel` NO esta en el gateway** (`billing/gateway.ts:25` expone
  `retrieve | update | list`). Hay que agregarlo, y agregarlo tambien al fake.
- El bloqueo por locales activos y su modal **no cambian**.

### 2. El aviso de cuando conviene bajar

- **VIVE EN EL MODAL DE LA BAJA** (respuesta del owner), no como cartel permanente: aparece cuando el
  merchant esta por perder plata. Indica **la fecha conveniente: dos dias antes de la renovacion**,
  derivada de `items.data[0].current_period_end` del `retrieve` (`billing/derive-rules.ts:79`).
- **Es un aviso, no un agendamiento.** El ADR 0063 deja escrito que esto es peor UX que la baja
  programada que reemplaza, y que el owner lo eligio sabiendolo.

### 3. Los cuatro huecos de UI del QA (F2)
(El punto 4 usa **la ultima factura PAGADA** — respuesta del owner.)

1. **La seccion dice el INTERVALO**: «Plus mensual» / «Plus anual», no «Plan activo» a secas.
2. **El cambio de intervalo pide CONFIRMACION en un modal.** Hoy se aplica al apretar **y cobra
   inmediato** (`always_invoice`): es plata sin confirmar. El modal dice que el cobro es inmediato.
3. **Se muestra la FECHA DE RENOVACION / proximo pago**, en mensual y en anual.
4. **Se muestra el IMPORTE COBRADO y un LINK AL RECIBO de Stripe.** Decision literal del owner:
   «poner el importe cobrado, fecha de renovacion, link para descargar el recibo de stripe». Los
   campos existen (`amount_paid`, `hosted_invoice_url`, `invoice_pdf` en el tipo `Invoice`), pero
   **no tocamos `invoices` en ningun lado todavia**: hay que sumarlo al gateway y al fake.

### 4. NO EXISTE LA BAJA DIFERIDA. SE BORRA `resume`

Respuesta del owner, literal (2026-09-13): «no hay baja diferida […] cancela en el momento, no hay
reanudar, no hay diferido, se cae HOY si doy de baja HOY, sin devolver dinero.»

- **Se BORRA la ruta `app/api/billing/resume/route.ts`** y su boton. Con eso **desaparece el bug D4**
  del QA (fallaba siempre) sin arreglarlo: no se arregla codigo que no va a existir.
- Se borran tambien sus tests y el `resume` de la tabla de ofertas (`billing/view.ts`).

#### 4.b EL ERROR FANTASMA DEL TIPO GENERADO — se cierra ACA, no se hereda

Pedido explicito del owner (2026-09-13): que borrar la ruta **no deje un error que alguien persiga
sin que sea un error**. Va con su mecanismo **medido**, porque la frase corta se lee al reves:

**Que pasa exactamente.** `apps/merchant/.next/types/validator.ts` es un archivo **GENERADO** por
Next con **un bloque por ruta**; cada bloque hace
`import("../../src/app/api/billing/<ruta>/route.js")` (verificado: lineas 293-305 del validator
actual, con los bloques de `cancel` y `checkout`). `tsconfig` lo incluye, asi que **`tsc` lo
typechequea**. Si se borra `resume/route.ts` y el validator todavia tiene SU bloque, `pnpm typecheck`
falla con `Cannot find module '.../resume/route.js'` **apuntando a un archivo que acabamos de borrar
a proposito**.

**LO QUE EL BUILD REGENERA ES EL VALIDATOR, NO LA RUTA.** El validator se deriva del arbol de
archivos: regenerado despues del borrado, **sale sin el bloque de `resume`**. La ruta borrada no
vuelve. (La redaccion anterior de esta spec decia «se borra ese archivo y el proximo build lo
regenera», y se puede leer como que reaparece la ruta. No: reaparece el validator, ya sin ella.)

**Por que no explota en CI ni en Vercel:** `.next/` esta **gitignoreado** (verificado con
`git check-ignore`) y alla se buildea de cero, asi que el validator viejo no existe. **El fantasma es
SOLO de una maquina con `.next` tibio** — la del owner o la de un agente — y por eso es tan
confusable: el rojo aparece en el unico lugar donde alguien lo va a perseguir a mano.

**OBLIGATORIO EN ESTA SPEC, no opcional:**
1. Borrar la ruta **y en el mismo paso** `rm -f apps/merchant/.next/types/validator.ts`.
2. Correr `pnpm run typecheck` y **verificar que da VERDE**. Si sale rojo nombrando `resume`, el
   borrado del validator no se hizo.
3. `grep -rn "resume" apps/merchant/.next/types/validator.ts` tiene que dar **vacio** despues del
   siguiente build.

**Y EL GUARD PARA QUE NO VUELVA A PASAR (item propio del DoD).** La regla es verificable con un
comando, asi que va a un hook y no a prosa (`CLAUDE.md`): un hook que detecte que
`.next/types/validator.ts` referencia un `route.ts` **que ya no existe en el arbol** y lo **borre**
—es un artefacto de build puro, borrarlo no destruye nada y se regenera—, diciendo en pantalla que lo
hizo y por que. **Se entrega con la prueba de que MUERDE:** correrlo contra un validator que
referencia una ruta inexistente y verificar el mensaje; y contra uno sano, verificando que **no
toca nada** (un hook que borra siempre es tan inutil como uno que no borra nunca).

**DECISION DEL ORQUESTADOR (n.o 1 de esta spec), NO del owner — esta etiquetada para que se pueda
rechazar:** si alguien cancela a fin de periodo **desde el dashboard de Stripe**, el webhook va a
seguir recibiendo `cancel_at_period_end` igual, porque eso es de Stripe y no nuestro. Como en
nuestro producto **la baja diferida no existe**, la app **no ofrece reanudar nada**: registra el
hecho y la seccion lo muestra como informacion («Stripe tiene una cancelacion programada para el
<fecha>»). **`effectiveLocationLimit = min(vigente, pendiente)` se queda solo para ese caso**, que es
lo unico que impide aterrizar en `free` con mas locales de los permitidos.

## DoD adicional que sale del pedido del owner

- [x] Borrada la ruta `resume`, `pnpm run typecheck` **VERDE** tras `rm -f
      apps/merchant/.next/types/validator.ts`, y `grep resume` sobre el validator regenerado da vacio
      (verificado tras un `build` real: 12 referencias a rutas de billing, ninguna a `resume`).
- [x] **Hook nuevo** `.claude/hooks/stale-validator.sh`, **probado por el orquestador**: muerde ante una
      ruta inexistente (borra + mensaje) y **deja intacto un validator sano** (mismo `shasum` antes y
      despues). Lo invoca `verify.sh` en su primera linea util — el implementador **declaro** que no pudo
      verificar desde adentro de un turno que el orden del array `Stop` se respete, y tomo el camino
      garantizado por construccion en vez de afirmar lo que no midio.

## Lo que NO entra

- **Reembolsos y creditos de cualquier tipo** (ADR 0063: decision explicita del owner).
- **Frenar campañas de marketing al bajar de plan.** El owner lo menciono en el QA; es alcance nuevo
  y no tiene diseño. Va como tarea aparte, no aca.
- El sentido anual → mensual (sigue siendo la tarea 55).

## Riesgo conocido, escrito antes de implementar

La clase de defecto que origino esta spec **no la caza una mutacion**: no habia ningun invariante
roto: cada regla cumplia su contrato y la COMPOSICION era incoherente. El plan de pruebas tiene que
incluir, ademas de las mutaciones, **al menos un caso que recorra la secuencia completa** (upgrade →
baja → estado resultante → que puede hacer el merchant) y asevere que lo que se cobra y lo que se
puede usar coinciden.

## RESPUESTAS DEL OWNER (2026-09-13) — las tres, cerradas

1. **Baja diferida: NO EXISTE.** Se borra `resume`. Ver §4.
2. **El recibo es el de la ULTIMA FACTURA PAGADA.** Literal: «claro que la ultima que tiene pagada».
3. **El aviso vive EN EL MODAL** de la baja, en el momento en que el merchant va a perder plata.
   No es un cartel permanente de la seccion.

**La cuarta pregunta (por que falla `resume`) se cae con la ruta.** Lo que **entra igual** es que el
`catch` de las rutas que llaman a Stripe **registre la causa**: hoy `cancel/route.ts:135` descarta el
objeto de error entero, asi que un 503 no deja rastro ni en los logs del server. Es un defecto propio
y se arregla con la ruta de cancelar, que es la que se queda.

## Estado de prod al escribir esta spec

`A3 Test` (`e9c96528-5f3e-4952-b283-7434ec867b4f`) quedo con `pending_plan='free'` y
`pending_plan_at=2026-10-13` del QA. **Con `resume` borrado, ese negocio no tiene salida por la app**
hasta que se implemente esta spec: hay que cancelarlo desde el dashboard de Stripe (o dejarlo caer el
13-10). Es un negocio de PRUEBA, asi que no bloquea — pero **la migracion de estado de los que ya
esten diferidos al desplegar es parte del DoD**, no un detalle.

---

# ANEXO TECNICO (orquestador, 2026-09-13) — lo que faltaba para despachar

La spec estaba cerrada **en producto** y sin **diseño tecnico**: no tenia fases, contratos,
archivos previstos, plan de pruebas ni DoD ejecutable, que es lo que `AGENT-WORKFLOW.md` le
exige al orquestador comprobar antes de entregar un encargo. Esto lo agrega **sin tocar
ninguna decision de producto**. Las decisiones nuevas van etiquetadas y son rechazables.

## Premisas VERIFICADAS antes de escribir este anexo (no supuestas)

| Hecho | Como se verifico |
|---|---|
| `subscriptions.cancel(id, params?, options?)` existe; `prorate` e `invoice_now` son `?boolean` **default `false`** | `esm/resources/Subscriptions.d.ts:26` y `:2678-2695` de `stripe@22.5.0` |
| `invoices.list({customer, subscription, status:'paid', limit})` existe | `esm/resources/Invoices.d.ts:41`, `:2425-2457` |
| `Invoice.amount_paid: number` (no opcional), `hosted_invoice_url?: string\|null`, `invoice_pdf?: string\|null` | `esm/resources/Invoices.d.ts:158,307,311` |
| El fantasma del validator **es real en esta maquina AHORA** | `apps/merchant/.next/types/validator.ts:320-323` tiene el bloque de `resume` |
| Tras `settleToFree` (que pone `stripe_subscription_id=null`), un `customer.subscription.deleted` tardio **se IGNORA** | `applicability.ts`: id distinto → `adoptable` (id null) → regla 2: la suscripcion recuperada esta `canceled` ∈ `DEAD_STRIPE_STATUS` → `not_adoptable`. **Es la pieza que hace viable la baja inmediata** y por eso tiene test propio (A-T4) |
| Baseline del arbol: limpio, `typecheck`+`lint` verdes, Node 24.20.0 | corrido antes de escribir esto |
| `resume` se referencia en **24 archivos** | `grep -rln resume apps/merchant/src` |

## Decisiones del ORQUESTADOR en este anexo — NO las dijo el owner, se pueden rechazar

**O-2. El link del recibo CRUZA al navegador como prop** (`hosted_invoice_url`, con fallback a
`invoice_pdf`), en vez de proxiearlo por una ruta propia que haga el `retrieve` y redirija. Motivo:
es exactamente el link que Stripe publica para mandarle al cliente por email —el owner ya lo recibe
asi— y la ruta proxy agrega superficie HTTP autenticada y un round-trip por click sin cerrar ninguna
amenaza (quien ve la pagina ya es el owner). **No viola la regla de `CLAUDE.md`**, que prohibe
serializar claves internas (`*ObjectKey`, `stripeCustomerId`, `stripeSubscriptionId`): ninguna de
esas viaja. **Lo que si obliga:** actualizar `expectCrossesExactly` con las props nuevas y aseverar
—con un `it` propio— que el customer id y el subscription id **siguen sin cruzar**.

**O-3. NO HAY MIGRACION DE DATOS de los negocios ya diferidos.** La spec pedia «la migracion de los
que ya esten diferidos al desplegar». Limpiarles `pending_plan` dejaria a Stripe con la cancelacion
viva y a la DB diciendo «Plus activo» — el estado incoherente que la 0063 existe para prohibir. Se
reencuadran en la **decision n.o 1 de esta spec, que ya existe**: una baja programada que nuestro
flujo ya no crea se **informa** («Stripe tiene una cancelacion programada para el <fecha>»), no se
ofrece reanudar, y cae sola por el webhook al fin del periodo. Cero SQL, cero ventana incoherente.
**Verificacion en vez de migracion:** correr por SQL el conteo de filas con `pending_plan='free'`
antes de desplegar y dejarlo escrito en `TASKS.md` (al escribir esto: `A3 Test`, de prueba).

**O-4. LA BAJA INMEDIATA CONSERVA EL PASO 2 (la marca de intencion), no lo borra.** El reflejo al
leer «la baja es inmediata» es cancelar en Stripe y escribir `free`. **Esta mal por dos motivos
medidos**, y por eso el orden de abajo es normativo:
1. sin el paso 2, un 503 del paso 3 deja la fila en `plus` con la baja quizas aplicada en Stripe, y
   el `cancel` siguiente no tiene de donde saber que ya se pidio → se pierde la idempotencia que
   `cancel` tiene hoy;
2. sin `downgrade_requested_at` puesto **antes** de llamar a Stripe, un webhook `deleted` que gane
   la carrera al paso 4 ve `plan='plus'` + `downgradeRequestedAt=null` y aterriza en **`none`** en
   vez de `free` (`derive.ts:216`) — el discriminante del ADR 0060, alcanzado por la puerta de atras.

## Fase A — dominio y rutas (servidor). NO toca UI

**A1. `billing/gateway.ts`** — sumar a `StripeGateway`:
`subscriptions: Pick<…, "retrieve"|"update"|"list"|"cancel">` y `invoices: Pick<Stripe["invoices"], "list">`.
El fake (`billing-stripe-fake.ts`, **hoy en 299/300 lineas**) deja de compilar hasta implementarlos:
eso es el punto de la costura. **El fake NO se puede extender sin dividirlo antes** — el corte lo
decide el implementador y se mide **al hook**, no con `wc`.

**A2. `app/api/billing/cancel/route.ts` — ORDEN NORMATIVO de la baja inmediata:**
1. tx: `lockBusiness` → leer → contar activos → `decidePlanChange({intent:'downgrade'})`.
   `blocked` → 409 y nada mas. `settle_to_free` → `settleToFree` y **cero llamadas a Stripe** (se
   conserva tal cual).
2. **MISMA tx**: `scheduleDowngrade` (marca `pending_plan='free'` + `downgrade_requested_at`).
   Commit. Load-bearing por los dos motivos de **O-4**.
3. **Fuera del lock**: `gateway.subscriptions.cancel(subId, undefined, { idempotencyKey })`. **Sin
   `prorate` ni `invoice_now`** (default `false` = lo que el owner pidio; escribirlos explicitos
   tambien es aceptable, pero entonces el test lo asevera).
4. tx corta: `settleToFree` → `plan='free'`, `status='active'`, `stripe_subscription_id=null`, las
   tres columnas de baja limpias.
- **Fallo del paso 3 → 503 y el estado QUEDA PUESTO** (capado en 1, conservador). El revert corre
  **solo** ante rechazo determinista Y `createdNow` — se conservan `isDeterministicRejection` y el
  guard `createdNow` **con sus docblocks y sus tests**: no son andamiaje de la baja diferida.
- **El `catch` REGISTRA LA CAUSA** (pedido explicito de la spec; hoy `cancel/route.ts:135` descarta
  el error entero). `console.error` con el error, **sin** secretos ni cuerpos de request.

**A3. Borrar `resume` — en UN solo paso, y el validator con el:**
`rm` de `app/api/billing/resume/route.ts`; el `{kind:'resume'}` de `decidePlanChange` y sus codigos
(`nothing_to_resume` y el de suscripcion muerta); `offers.resume`; el boton y el `done=resume` de la
UI; y **sus tests** (borrarlos esta autorizado por la spec §4 y se declara en el handoff —
`CLAUDE.md` prohibe borrar tests para que un gate pase, no borrar el test de una feature que deja de
existir). **En el mismo paso:** `rm -f apps/merchant/.next/types/validator.ts`.
**`clearPendingPlan` NO se borra**: queda usado por el revert del paso 3.

**A4. `server/billing/facts.ts` (archivo NUEVO) — la renovacion y el recibo.**
`readBillingFacts(gw, { stripeCustomerId, stripeSubscriptionId })` → `{ renewalAt: Date|null,
lastPaidInvoice: { amountPaid: number; currency: string; receiptUrl: string|null } | null }`.
- `renewalAt`: de `subscriptions.retrieve(subId)` → `items?.data?.[0]?.current_period_end`, con el
  **mismo acceso defensivo** que `derive-rules.ts` (`items` es un `ApiList` truncado y sin orden
  contractual; `data[0]` pelado tira `TypeError`). Unix seconds → `* 1000`.
- `lastPaidInvoice`: `invoices.list({ customer, status:'paid', limit: 10 })` y **se elige el de
  `created` MAXIMO explicitamente**. NO se toma `data[0]`: que la lista venga ordenada desc no es
  contractual, y es el bug exacto que `CLAUDE.md` ya cobro una vez (`select` sin `order by` +
  `.at(-1)`). `receiptUrl = hosted_invoice_url ?? invoice_pdf ?? null`.
- **ESTA FUNCION NO PUEDE TIRAR.** Mismo contrato que `reconcileOnOpen`: cualquier fallo devuelve
  los campos en `null` y la UI omite el dato. Una pantalla de plan no se cae porque Stripe no
  conteste. **Costo declarado y aceptado:** suma hasta 2 llamadas de red por render de una pantalla
  de baja frecuencia.

**A5. `billing/view.ts`** — sacar `resume` de `SubscriptionOffers`; agregar la **etiqueta de
intervalo** («Plus mensual» / «Plus anual») a `subscriptionOffers`, que ya recibe `view.interval`.
**El archivo esta en 260 lineas**: si la etiqueta lo pasa de 300, se divide (sibling, como ya se
hizo con `billing-offers`), **medido al hook**.

## Fase B — UI. Entra DESPUES del PASS de la A

`subscription-console.tsx` esta en **274/300** y esta fase le suma cinco cosas: etiqueta de
intervalo, fecha de renovacion, importe + link al recibo, **modal de confirmacion del cambio de
intervalo** (hoy cobra al apretar, sin confirmar: es plata sin confirmar) y el **aviso en el modal
de baja**. **Va a pasar el limite: se divide ANTES de agregar, no despues.** Corte propuesto por el
orquestador (rechazable): la tarjeta de plan (`plan-card`) a su propio archivo y el modal de
intervalo a otro.
- **El aviso del modal de baja** (respuesta 3 del owner: vive en el modal, no como cartel): dice
  que la baja es **inmediata y sin devolucion**, que ya pago hasta el `renewalAt`, y **la fecha
  conveniente = `renewalAt - 2 dias`**. Si no hay `renewalAt` (Stripe no contesto), el modal
  **omite el aviso** y sigue diciendo que es inmediato: nunca inventa una fecha.
- Fechas: `Intl.DateTimeFormat` con el `timeZone` del negocio **fijado** (patron ya en el archivo);
  sin fijarlo hay mismatch de hidratacion.
- Importe: `amount_paid` viene en **centavos** → se divide por 100 y se formatea con `currency`.

## Fase C — el hook del validator (item propio del DoD, §4.b)

`.claude/hooks/stale-validator.sh`: si `apps/merchant/.next/types/validator.ts` referencia un
`route.ts` que **ya no existe en el arbol**, lo **borra** (es un artefacto de build puro) y dice en
pantalla que lo hizo y por que.
- **Evento: `Stop`, ordenado ANTES de `verify.sh`** — si corriera despues, `verify.sh` ya fallo con
  el fantasma. **El implementador VERIFICA que el orden del array de `settings.json` se respeta**;
  si no se respeta, el chequeo se incorpora al principio de `verify.sh` y se declara el cambio.
- **Se entrega con la prueba de que MUERDE y de que DISCRIMINA** (`CLAUDE.md`: un guard sin prueba
  de que muerde es peor que ninguno): (a) contra un validator con un bloque de ruta inexistente →
  borra + mensaje; (b) contra un validator **sano** → **no toca nada** (verificado por `shasum`
  antes/despues). Un hook que borra siempre es tan inutil como uno que no borra nunca.

## Plan de pruebas

**LA TABLA DE MUTACIONES SE EJECUTA, NO SE PREDICE** (`CLAUDE.md`): cada fila «mutacion → rojo el
test Y» se corre y se transcribe el resultado real, con el **alcance** (todos los archivos que
pueden ver la mutacion) escrito en la fila. La fila de la bitacora **se abre ANTES de mutar** con
`id + archivo + shasum limpio + que invariante ataca`; y antes de mutar se mira `git status --short`
(un `??` no tiene `git checkout` de emergencia; un ` M` tiene uno que **se lleva tambien el trabajo
no commiteado**) y se saca copia a `/tmp`.

**Y el barrido que la fase D1 de la 0063 pago cuatro veces:** al cerrar cada fase, **listar los
comentarios del codigo nuevo que afirman un invariante** («esto es lo que hace que X», «sin esto
pasaria Y») **y mutar cada uno**. Los que queden verdes son el trabajo que falta. La tabla escrita
desde el diseño no los ve, porque el diseño es anterior al docblock.

**A-T4 — EL CASO DE SECUENCIA COMPLETA, que la spec exige explicitamente** («la clase de defecto que
origino esta spec no la caza una mutacion»): un test de integracion que recorra **upgrade → baja →
estado resultante → que puede hacer el merchant** y asevere **por SQL** que lo que se cobra y lo que
se puede usar coinciden. Incluye las dos carreras del webhook contra el paso 4:
- `deleted` **antes** del paso 4 (fila en `plus` + marca puesta) → `free`, **nunca `none`**;
- `deleted` **despues** del paso 4 (fila ya en `free`, sin sub id) → **ignorado** (`not_adoptable`),
  la fila no se ensucia.

**Comandos (scripts de ROOT, Node 24 — `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use`):**
`pnpm run typecheck`, `pnpm run lint`, `pnpm run test`, `pnpm run format:check`, `pnpm run build`.
Unit suelto: `pnpm --filter @mi-pasaporte/merchant exec vitest run <path>`.

## DoD ejecutable

**Fase A**
- [x] `cancel` cancela en Stripe **en el acto** y la fila queda `free` con `stripe_subscription_id=null`; el 503 deja el estado puesto y `cancel` sigue siendo idempotente.
- [x] `settle_to_free` sigue haciendo **cero** llamadas a Stripe.
- [x] `resume` no existe: ni ruta, ni intent, ni oferta, ni `done=resume`.
- [x] `pnpm run typecheck` **VERDE** tras `rm -f apps/merchant/.next/types/validator.ts`, y `grep -rn "resume" apps/merchant/.next/types/validator.ts` **vacio** sobre el validator regenerado.
- [x] El `catch` de `cancel` registra la causa (sin secretos), con test.
- [x] `readBillingFacts` no tira nunca ante un fallo de Stripe, y elige la factura pagada por `created` **maximo**, no por posicion.
- [x] A-T4 en verde, con las dos carreras del webhook.
- [x] Tamaños **al hook** sobre TODO el alcance (los ` M` **y** los `??`), no solo los archivos nuevos.

**Fase B**
- [x] La seccion dice «Plus mensual»/«Plus anual», la **fecha de renovacion**, el **importe cobrado** y un **link al recibo**.
- [x] El cambio de intervalo pide confirmacion en un modal que dice que el cobro es inmediato.
- [x] El modal de baja dice que es inmediata y sin devolucion, y muestra la fecha conveniente (`renewalAt - 2 dias`); **sin `renewalAt` omite el aviso y no inventa fecha**.
- [x] `expectCrossesExactly` actualizado, y un `it` propio que asevera que el customer id y el subscription id **siguen sin cruzar**.

**Fase C**
- [x] Hook entregado con la prueba de que **muerde** y de que **discrimina** (validator sano intacto, verificado por `shasum`).


## Cierre (2026-09-15) — evidencia

**Gates al cerrar, medidos por el orquestador:** 721 unit passed + **240 de integracion de billing**
(31 archivos, con `.env.integration.local` cargado — sin ese env los `.neon.integration` se SALTEAN y
el verde no dice nada), typecheck / lint / format:check / build VERDES, y **cero archivos sobre el
limite de 300** preguntandole al hook sobre todo el alcance (` M` y `??`).

**EL BUG QUE MAS COSTO NO FUE DE PRODUCTO SINO DE INFRAESTRUCTURA DE TEST, Y HABRIA ROTO EL CI ENTERO.**
Un **`import` de VALOR al barrel `./billing`** agregado a `billing-integration-support.ts` cerraba un
ciclo: ese support lo importa la factory de `vi.mock("./stripe-config")`, y el barrel arrastra el dominio
entero de vuelta a `stripe-config` — cuya factory no termino. Los dos
`billing-pages*.neon.integration.test.ts` **colgaban para siempre** (ni `vitest list` terminaba; 0% de
CPU, que es como se ve un deadlock y no una corrida lenta). Apuntarlo a **`./billing/store`** lo bajo de
infinito a **1.06 s**. Es el mismo deadlock que ya documentaba `billing-pages.neon.integration.test.ts`,
**reintroducido por otra puerta**: un `import type` al barrel es gratis (se borra en compilacion), uno de
**valor** no.

**El metodo que lo encontro, que es lo reutilizable:** el sintoma («todo cuelga») se confundio primero
con contencion de maquina — habia 5 procesos vitest zombis de corridas cortadas. **Matarlos NO lo
arreglo, y eso fue el dato.** Un archivo suelto y ajeno corrio en **94 ms**, asi que vitest estaba sano
y el problema era de ESOS archivos; y que colgaran **los dos** hermanos apunto a la cadena COMUN en vez
de al archivo nuevo, que era el sospechoso obvio.

**Hallazgo menor declarado (H2), no bloqueante:** mutar la `idempotencyKey` de `cancel` a un valor FIJO
deja los 233 tests VERDES — ningun test pinnea esa propiedad. **Pero el codigo esta bien** (la clave lleva
la fecha, que es mas conservador que fija); lo dudoso es el ARGUMENTO del docblock, que habla de «dos bajas
del mismo negocio en 24 h» cuando eso exigiria cancelar el MISMO `sub_…` dos veces — y tras la primera baja
la suscripcion muere y la siguiente nace con otro id. **Si alguien lo retoma, el trabajo es corregir el
COMENTARIO, no escribir un test.**

**Proceso, para la proxima:** **cinco agentes se cortaron a mitad** en esta spec. Solo uno dejo mutacion
viva (revertida y verificada por `shasum` + `diff` contra la copia limpia). El cierre lo hizo el
orquestador **a mano**, y los 11 errores que quedaban eran imports huerfanos de archivos a medio partir,
no bugs. **Cuando un encargo no entra en un turno, reanudar sale mas caro que terminarlo a mano.**
