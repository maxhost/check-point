---
spec: 0064
estado: cerrada
fecha: 2026-09-13
resumen: La baja a Free pasa a ser inmediata y sin devolucion (ADR 0063), con aviso de cuando conviene bajar; y se cierran los cuatro huecos de UI que el QA de la 0063 encontro — etiqueta del intervalo, modal de confirmacion del cambio de intervalo, fecha de renovacion, e importe cobrado con link al recibo de Stripe.
---

# 0064 — Baja inmediata y los datos del cobro

**ESTADO: `cerrada` (2026-09-13).** El owner contesto las tres preguntas de producto; la cuarta
(de medicion) **dejo de existir** porque la ruta que la generaba se borra.

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
- **Al borrar la ruta, ojo con el tipo GENERADO:** `pnpm typecheck` puede fallar con
  `.next/types/validator.ts(...): Cannot find module '.../route.js'`. No es un error del codigo — se
  borra ese archivo y el proximo build lo regenera (`CLAUDE.md`).
- Se borran tambien sus tests y el `resume` de la tabla de ofertas (`billing/view.ts`).

**DECISION DEL ORQUESTADOR (n.o 1 de esta spec), NO del owner — esta etiquetada para que se pueda
rechazar:** si alguien cancela a fin de periodo **desde el dashboard de Stripe**, el webhook va a
seguir recibiendo `cancel_at_period_end` igual, porque eso es de Stripe y no nuestro. Como en
nuestro producto **la baja diferida no existe**, la app **no ofrece reanudar nada**: registra el
hecho y la seccion lo muestra como informacion («Stripe tiene una cancelacion programada para el
<fecha>»). **`effectiveLocationLimit = min(vigente, pendiente)` se queda solo para ese caso**, que es
lo unico que impide aterrizar en `free` con mas locales de los permitidos.

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
