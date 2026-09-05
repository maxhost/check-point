---
adr: 0050
fecha: 2026-09-05
estado: supersedido por el ADR 0051
resumen: Enrolarse con un teléfono ya registrado actualiza el nombre de la cuenta con lo que se acaba de tipear, en vez de descartarlo en silencio. Decisión del owner tras el QA (se enroló como "Logan Wolf" y el pase salió "Cliente iOS 4"). El dato más fresco gana. NO cambia el modelo de identidad — la cuenta se sigue resolviendo por teléfono — y el margen de abuso que agrega es despreciable frente a lo que ese mismo camino ya concede (una sesión completa), que queda como hallazgo separado.
---

# 0050 — El re-enroll actualiza el nombre de la cuenta

> **SUPERSEDIDO ENTERO por el ADR 0051 (2026-09-05, mismo día).** El owner rechazó esta
> decisión al verla implementada: el re-enroll NO debe tocar el perfil; en su lugar, la
> confirmación avisa con un toast que la cuenta ya existía. Este archivo queda como
> registro histórico — no implementar nada de lo que dice.

## Contexto

`enroll()` resuelve la cuenta por `phone_e164`. Si ya existe, la reutiliza **sin tocar el
nombre**: el que el usuario acaba de tipear se descarta sin aviso. El QA en vivo lo cazó de
la peor forma posible — el owner se enroló como "Logan Wolf" y el pase de Apple salió como
"Cliente iOS 4", el nombre que esa misma cuenta tenía desde un QA de tres semanas antes.

El comentario del código dice `→ reuse it (do not overwrite)`, pero eso está escrito para
la carrera de inserción concurrente (23505), no como decisión de producto sobre el nombre.

## Decisión

**Un enroll EXITOSO sobre una cuenta existente actualiza `first_name` y `last_name`** con
los valores validados del form. El dato más fresco gana: si el usuario se toma el trabajo de
escribir su nombre, es el que quiere ver en su tarjeta.

**El nombre se escribe SÓLO si el alta de membresía tuvo éxito.** Una operación rechazada no
deja efectos: si el enroll termina en `409 already_member` (o en cualquier otro error), la
cuenta queda intacta. Esto se declara acá porque la primera implementación hizo lo contrario
—actualizaba el nombre y después rechazaba— y **eso nunca fue una decisión del owner**: fue
un efecto del orden del código que se documentó por error como si estuviera acordado.

Se descartan las otras dos opciones que se le presentaron al owner:
- *Avisar "ya tenés cuenta" con el nombre guardado* — agrega una pantalla a un flujo cuyo
  valor es no tener fricción, y obliga a explicar por qué el sistema ya lo conoce.
- *Dejarlo como está y documentarlo* — es exactamente el comportamiento que el QA rechazó.

`phone_e164`, `country_iso`, `qr_token` y `web_view_token` **no** se tocan: la identidad y
las credenciales de la cuenta no son parte de esta decisión.

## Consecuencias

- El nombre del pase de Wallet y del portal reflejan lo último que el usuario escribió.
- **Margen de abuso que agrega: quien conozca un teléfono ajeno puede reescribir el nombre
  de esa cuenta.** Es despreciable **en términos relativos**, y conviene decir por qué sin
  maquillarlo: ese mismo camino, hoy y desde antes de este ADR, ya le entrega al que conoce
  el teléfono una **sesión de consumidor completa** sobre la cuenta existente — el enroll no
  verifica el teléfono. Quien puede hacer eso ya puede leer los programas y el QR; poder
  además cambiar el nombre no mueve la aguja.
- **Eso último NO es consecuencia de este ADR y no queda saldado por él.** Es un hallazgo
  preexistente, registrado como tarea aparte, y merece su propia decisión (¿OTP en el
  re-enroll de un teléfono ya registrado? ¿enrolar sin abrir sesión cuando la cuenta ya
  existe?). Se anota acá para que nadie lea "margen despreciable" como "no hay problema".
- Sin migración: las columnas ya existen.
