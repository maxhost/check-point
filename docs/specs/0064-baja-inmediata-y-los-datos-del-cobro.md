---
spec: 0064
estado: borrador
fecha: 2026-09-13
resumen: La baja a Free pasa a ser inmediata y sin devolucion (ADR 0063), con aviso de cuando conviene bajar; y se cierran los cuatro huecos de UI que el QA de la 0063 encontro — etiqueta del intervalo, modal de confirmacion del cambio de intervalo, fecha de renovacion, e importe cobrado con link al recibo de Stripe.
---

# 0064 — Baja inmediata y los datos del cobro

**ESTADO: `borrador`. NO SE TOCA CODIGO HASTA QUE ESTE `cerrada`.** Hay **cuatro preguntas
abiertas** al final; tres son del owner y una es de medicion.

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

- Con una suscripcion Plus viva, la UI indica **la fecha conveniente para bajar: dos dias antes de
  la renovacion**. La fecha sale de `items.data[0].current_period_end` del `retrieve`, que es de
  donde ya se deriva hoy (`billing/derive-rules.ts:79`).
- **Es un aviso, no un agendamiento.** El ADR 0063 deja escrito que esto es peor UX que la baja
  programada que reemplaza, y que el owner lo eligio sabiendolo.

### 3. Los cuatro huecos de UI del QA (F2)

1. **La seccion dice el INTERVALO**: «Plus mensual» / «Plus anual», no «Plan activo» a secas.
2. **El cambio de intervalo pide CONFIRMACION en un modal.** Hoy se aplica al apretar **y cobra
   inmediato** (`always_invoice`): es plata sin confirmar. El modal dice que el cobro es inmediato.
3. **Se muestra la FECHA DE RENOVACION / proximo pago**, en mensual y en anual.
4. **Se muestra el IMPORTE COBRADO y un LINK AL RECIBO de Stripe.** Decision literal del owner:
   «poner el importe cobrado, fecha de renovacion, link para descargar el recibo de stripe». Los
   campos existen (`amount_paid`, `hosted_invoice_url`, `invoice_pdf` en el tipo `Invoice`), pero
   **no tocamos `invoices` en ningun lado todavia**: hay que sumarlo al gateway y al fake.

### 4. Que hace la app con una baja diferida que NO creo ella

El dashboard de Stripe puede seguir seteando `cancel_at_period_end`, y el webhook va a seguir
escribiendo `pending_plan='free'`. **Ese estado no desaparece con esta spec.** Ver pregunta abierta 1.

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

## PREGUNTAS ABIERTAS — la spec no se cierra sin estas

1. **(Owner) Baja diferida que llega desde el dashboard de Stripe: ¿que hace la app?**
   (a) la muestra y ofrece «Reanudar» — entonces **hay que arreglar el bug D4**, que hoy falla
   siempre; (b) la muestra **solo informativa** («cancelacion programada desde Stripe») y se
   resuelve alla. La (b) borra la ruta `resume` y su superficie; la (a) la mantiene viva.
2. **(Owner) El importe cobrado y el recibo: ¿que factura?** ¿la ULTIMA siempre (queda visible en la
   seccion para cualquier plan vivo), o solo como confirmacion DESPUES de una operacion que cobra
   (upgrade y cambio a anual)?
3. **(Owner) El aviso «te conviene volver el dia X»: ¿donde vive?** ¿siempre visible en la seccion
   mientras haya Plus, o solo dentro del modal de la baja, en el momento en que va a perder plata?
4. **(Medicion, del orquestador) ¿Por que falla `resume` HOY?** Solo importa si la respuesta a la 1
   es (a). La evidencia esta en el log de Stripe de `sub_1UFDC4A9Vc14QXDyLAy78CsX`; el `catch` de
   `resume/route.ts:81` descarta el error, asi que el server no lo sabe. **Arreglar ese `catch` para
   que registre la causa entra igual**, decida lo que decida el owner: un 503 que esconde su motivo
   es un defecto propio, y el mismo patron esta en `cancel/route.ts:135`.

## Estado de prod al escribir esta spec

Hay **un negocio de prueba con la baja diferida puesta**: `A3 Test`
(`e9c96528-5f3e-4952-b283-7434ec867b4f`), `pending_plan='free'`, `pending_plan_at=2026-10-13`,
`sub_1UFDC4A9Vc14QXDyLAy78CsX`. **Sirve como caso real para la pregunta 1** — conviene NO limpiarlo
hasta decidirla.
