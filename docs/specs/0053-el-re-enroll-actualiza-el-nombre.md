---
spec: 0053
fecha: 2026-09-05
estado: cerrada
resumen: Enrolarse con un teléfono ya registrado actualiza `first_name`/`last_name` de la cuenta con lo tipeado, en vez de descartarlo en silencio (implementa el ADR 0050). El pase de Wallet y el portal pasan a mostrar el nombre que el usuario acaba de escribir. No toca teléfono, país ni tokens. Sin migración.
disjunta: si
archivos: apps/merchant/src/server/consumer/enrollment.ts, + tests (unidad e integración Neon)
---

# 0053 — El re-enroll actualiza el nombre

> Implementa el **ADR 0050**. Nace del QA en vivo del owner (2026-09-05, tarea 39): se
> enroló como "Logan Wolf" y el pase de Apple salió como "Cliente iOS 4" — el nombre que esa
> cuenta tenía desde un QA anterior con el mismo teléfono.

## Problema

`enroll()` (`server/consumer/enrollment.ts`) hace `accountByPhone(input.phoneE164)` y, si la
cuenta existe, la reutiliza tal cual. El `firstName`/`lastName` validados del form **se
descartan sin aviso**. Verificado por SQL en prod: la membresía del 2026-09-05 21:32 UTC
quedó sobre la cuenta `+593998877654321`, creada el 2026-08-16 como "Cliente iOS 4".

`buildPassJson` arma el titular con el nombre **de la cuenta**, así que el pase es fiel a la
base — el bug está en el enroll, no en el pase.

## Alcance

**Entra:**
- En `enroll()`, cuando la cuenta ya existe: `UPDATE` de `first_name` y `last_name` con los
  valores **validados** del input, y seguir con el alta de membresía.
- Que el `account` devuelto (y por lo tanto el 201, el pase y el portal) lleve **el nombre
  nuevo**, no el viejo.
- Que aplique también en el camino de la **carrera concurrente** (`23505` → re-lectura de la
  cuenta): ahí también el nombre tipeado debe ganar, para que el resultado no dependa de
  quién ganó la carrera.

**No entra:**
- Tocar `phone_e164`, `country_iso`, `qr_token`, `web_view_token` ni `verified`.
- El **409 de ya-miembro**: lanza en el insert de membresía, después del update del nombre.
  Que el nombre se actualice y la membresía sea rechazada es aceptable (el usuario ya es
  miembro y acaba de decir cómo se llama). **Declararlo en el handoff**, no cambiarlo.
- Verificación del teléfono en el re-enroll. Es el hallazgo preexistente de la tarea 41 y
  necesita su propia decisión — **no se resuelve acá ni se agrava**.
- El arte visual del pase (tarea 29).

## Criterios de aceptación (verificables)

- [ ] Enrolar con un teléfono **ya registrado** y un nombre distinto → la cuenta queda con el
  nombre nuevo en la base. **Test de integración Neon** (es un efecto sobre la base; un
  unit test con mocks no lo prueba).
- [ ] El `account` devuelto por `enroll()` trae el nombre **nuevo** (no el de antes del
  update), así que el 201 y el pase lo reflejan. **Test.**
- [ ] Enrolar con un teléfono **nuevo** sigue creando la cuenta igual que hoy. **Test.**
- [ ] `phone_e164`, `country_iso`, `qr_token` y `web_view_token` **no cambian** en el
  re-enroll. **Test que los compara antes/después.**
- [ ] El camino de carrera concurrente (`23505`) también deja el nombre nuevo. **Test.**
- [ ] Los 5 gates verdes; el conteo de tests **no baja** de 340.

## Pruebas

- **Integración Neon** (rama efímera): el re-enroll actualiza nombre y preserva teléfono y
  tokens; el alta nueva no cambia.
- **Unidad:** que el `account` devuelto sea el actualizado.
- **Anti-falso-verde:** cada test nuevo tiene que ponerse rojo con el código actual
  (`git show HEAD:...`), no sólo pasar con el nuevo.

## Notas
- Sin migración: las columnas ya existen.
- El ADR 0050 declara explícitamente que el margen de abuso que agrega es despreciable
  **sólo en términos relativos**, porque ese camino ya entrega una sesión completa. Eso es
  la tarea 41 y no queda saldado por esta spec.
