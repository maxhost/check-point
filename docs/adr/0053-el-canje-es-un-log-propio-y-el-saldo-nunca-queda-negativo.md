---
adr: 0053
fecha: 2026-09-07
estado: aceptada
resumen: El canje se ejecuta en el mostrador (el operador escanea el QR, el cliente elige, el operador confirma) y NO por un inbox de solicitudes; se registra en una tabla propia `core.reward_redemption` con snapshot del premio —nunca como un `mode='redeem'` en `core.order`—; el saldo se debita con clamp a 0 dentro del mismo statement atómico, así que nunca queda negativo; y sin saldo suficiente el canje se bloquea salvo que el programa lo dispense (configuración avanzada por programa).
---

# 0053 — El canje es un log propio y el saldo nunca queda negativo

> Cierra el agujero que dejaron **dos specs cerradas y coherentes**: la 0036 §8 delegó la
> ejecución del canje en la 0030 y la 0030 la declaró fuera de alcance. Lo implementa la
> **spec 0055**. Consume el ADR 0037 (outbox de push), el 0042 (`location_id` universal) y
> el 0044 (roles owner/staff).

## Contexto

El producto podía **acumular** valor y no podía **entregarlo**. El owner configuraba premios
(`core.loyalty_reward`, spec 0036) que ninguna superficie podía canjear: `app/api/counter/`
tenía sólo `resolve` y `grant`. El loop no cerraba.

Al diseñar el canje aparecieron cuatro decisiones que no son de implementación —cambian el
modelo de datos, la superficie o el invariante— y por eso van acá.

## Decisión

### 1. El canje ocurre en el mostrador, no en un inbox de solicitudes

Se evaluaron dos flujos:

- **(A)** El operador escanea el QR del cliente, el cliente elige el premio, el operador
  confirma y entrega.
- **(B)** El cliente escanea un QR de catálogo, pide el premio, y el staff aprueba desde una
  bandeja de solicitudes.

**Se elige (A).** (B) no quita fricción, **la mueve**: el staff igual tiene que confirmar y
entregar, así que la solicitud agrega un paso **antes**, no en lugar de. Y agrega una máquina
de estados (`pendiente/aprobada/rechazada/vencida`), una superficie pública nueva, un póster
por local y notificación de vuelta al cliente.

El argumento decisivo no es el costo sino la **identidad**: el owner pidió auditar *quién
reclama el premio*. En (A) el escaneo del QR **es** esa prueba. En (B) llega una fila que dice
"Julio pidió un café" y el staff tiene que creerle a quien dice ser Julio — o escanear igual,
con lo cual se hicieron las dos cosas.

(B) queda **aditiva**: si algún día hace falta (cola en hora pico), una tabla
`redemption_request` termina llamando al mismo confirmar. Esta decisión no cierra esa puerta.

### 2. El canje es una tabla propia (`core.reward_redemption`), no un `mode` de `core.order`

`core.order` (spec 0030) modela *una venta que acredita*: tiene `mode in ('detailed','quick')`,
`total >= 0`, `currency_code` y `units_granted >= 0`. Un canje no tiene venta, ni total, ni
moneda, y su unidad es un **débito**.

Meterlo en `order` obligaría a **relajar esos checks** (o a sumar columnas que sólo aplican a
la mitad de las filas) y —lo caro— a que **toda** consulta de analítica de ventas se acuerde de
filtrar `mode <> 'redeem'`. Un olvido no rompe nada ruidosamente: infla las ventas del negocio
con premios regalados. Con dos tablas, los checks se quedan estrictos en las dos y ninguna
consulta existente cambia de significado.

### 3. El premio se snapshotea; la FK al premio es best-effort

`saveProgram` (spec 0036) **borra todos los `loyalty_reward` del programa y los re-inserta** en
cada guardado: **el `reward_id` no es estable**. Un log que guardara sólo la FK perdería la
historia de qué se entregó la primera vez que el owner edita el programa — exactamente el dato
que se quería auditar.

Por eso el registro guarda `reward_type`, `reward_label`, `reward_discount_percent` y
`reward_points_cost` como **snapshot**, y el `reward_id` queda nullable con `ON DELETE SET
NULL`. Mismo criterio que `order_item.product_id` en 0030: **el snapshot es la fuente de verdad
del log; la FK es una referencia**.

### 4. El saldo nunca queda negativo: clamp en el `SET`, no validación

Sin saldo suficiente el canje se **bloquea**. Pero el owner puede dispensarlo **por programa**
(`loyalty_program.redeem_allow_insufficient`, configuración avanzada), y en ese caso **el saldo
vuelve a 0**: 9 sellos de 10 → 0; 80 puntos contra un premio de 100 → 0. Se debita lo que haya,
y el log registra **lo que costaba** (`reward_points_cost`) junto a **lo que se pagó**
(`units_debited`), así la contabilidad muestra cuánto se regaló.

**El invariante lo sostiene la función pura `planRedemption`, que es quien decide el
`balanceAfter` y nunca devuelve un negativo** (clamp a 0), dentro de una **transacción
interactiva** que toma el lock de la membresía antes de decidir (**ADR 0054 §2**). Los checks de
DB `points_balance >= 0` / `stamps_count >= 0` (spec 0030) **quedan intactos como red, no como
mecanismo**. Corolario: `units_debited` **no** es el costo del premio, y ni él ni
`insufficient_override` pueden calcularse sobre un saldo leído antes del lock — si no, una
acreditación concurrente hace que el cliente pague el precio completo y el log diga que se le
regaló, inflando justo el dato que se quería auditar.

> **Enmienda del mismo día.** La primera versión de esta decisión ponía el invariante en el
> `SET` (`GREATEST(balance - costo, 0)`) dentro de un statement único. La revisión independiente
> lo tumbó por dos motivos verificados: `GREATEST(x - NULL, 0)` devuelve **`0`** en Postgres, así
> que un premio con `points_cost` nulo **borraba el saldo entero**; y la idempotencia de ese
> patrón está rota de raíz (**ADR 0054**). La decisión de producto —nunca negativo, vuelve a 0—
> no cambió: cambió dónde vive el mecanismo.

La alternativa —permitir saldo negativo— exigía **borrar los dos checks** y enseñarle a toda la
UI (mostrador, wallet, pase) a mostrar saldos negativos, para un caso de excepción.

## Consecuencias

- El loop del producto cierra: acumular → canjear → notificar.
- La auditoría responde por **marca y por local** (`business_id` + `location_id`, ADR 0042) y
  sobrevive a que se edite el programa, se borre el premio o se desactive al staff.
- **Dos tablas de eventos de valor** (`order` y `reward_redemption`) en vez de una: toda
  superficie que quiera "actividad del cliente" tiene que leer las dos. Ya aplica al
  `lastActivityAt` del wallet, que hoy sólo mira `max(order.created_at)`.
- El canje **hereda** la idempotencia por `client_request_id` y el outbox de push de 0030/0037,
  y suma un guard de saldo **dentro del `UPDATE`** (sin TOCTOU) con `FOR UPDATE` para que el
  clamp y el `balance_before` del log sean correctos bajo concurrencia.
- La dispensa de saldo es **por programa**, no global: dos programas del mismo negocio pueden
  comportarse distinto, y el log dice cuál fue el caso (`insufficient_override`).
