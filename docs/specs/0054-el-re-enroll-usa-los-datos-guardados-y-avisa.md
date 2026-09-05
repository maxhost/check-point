---
spec: 0054
fecha: 2026-09-05
estado: cerrada
resumen: Revierte la spec 0053 e implementa el ADR 0051. Enrolarse con un teléfono ya registrado NO modifica nada del perfil — la membresía se crea con los datos que ya están en la base — y la confirmación avisa con un toast ("Ya tienes una cuenta con ese teléfono: te enrolaste en el programa con tus datos"). El 201 suma un booleano `existingAccount`. Se conserva de la 0053 el invariante "una operación no exitosa no deja efectos" y sus tests. Sin migración.
disjunta: si
archivos: apps/merchant/src/server/consumer/enrollment.ts, app/api/public/enroll/[programId]/route.ts, enroll/[programId]/enroll-form.tsx + enroll-confirmation.tsx, + tests (los de la 0053 se invierten/adaptan, autorizado por el ADR 0051)
---

# 0054 — El re-enroll usa los datos guardados y avisa

> Implementa el **ADR 0051** (supersede al 0050). Decisión directa del owner: *"volver al
> comportamiento original + un toast que diga algo como «Ya tienes una cuenta con ese
> teléfono, te enrolaste en el programa con tus datos»"*.

## Alcance

**Entra:**

1. **`enroll()` vuelve a no escribir en `consumer_account`** cuando la cuenta existe:
   se elimina `applyFreshName` y toda mutación del perfil. La membresía se crea con la
   cuenta tal cual está. El camino de carrera (`23505`) también reusa la fila sin tocarla.
   Los comentarios que citan el ADR 0050 se reescriben citando el 0051.
2. **`enroll()` informa si la cuenta era preexistente** (p. ej. `existingAccount: boolean`
   en su resultado) y **el 201 lo expone** con ese nombre. Ningún camino de error lo
   incluye (mismo criterio que `walletManifestPath` en la 0051-instalación).
3. **La confirmación muestra un toast cuando `existingAccount`**: texto
   *"Ya tienes una cuenta con ese teléfono: te enrolaste en el programa con tus datos."*
   Estilo toast/aviso no bloqueante sobre la pantalla de confirmación existente
   (`enroll-confirmation.tsx`); el resto de la pantalla no cambia.
4. **Los tests de la 0053 se invierten/adaptan** (autorizado por el ADR 0051): el re-enroll
   conserva el nombre guardado. La assertion original de
   `consumer-enrollment.neon.integration.test.ts` (`"Marcos"`/`"Pérez"`) **vuelve a su
   forma pre-0053**. Se **conservan**: el test de que el 409 no modifica la fila (ahora
   trivial y sigue siendo un guard válido) y los de columnas/tokens intactos.

**No entra:**
- El **409 de ya-miembro**: su status, mensaje y pantalla quedan como están.
- Verificación del teléfono (tarea 41). El booleano `existingAccount` no la agrava: se lo
  dice al dueño de la sesión recién emitida, que ya ve sus programas.
- El arte del pase (tarea 29).

## Criterios de aceptación (verificables)

- [ ] Re-enroll (teléfono existente, programa nuevo) → membresía creada y la cuenta queda
  **byte a byte idéntica** (las 13 columnas, `updated_at` incluido). **Test de integración
  Neon comparando la fila antes/después** — es la inversa exacta del criterio de la 0053.
- [ ] El 201 de ese caso trae `existingAccount: true`; el de un alta nueva,
  `existingAccount: false`. Ningún camino de error lo incluye. **Test por caso.**
- [ ] La confirmación muestra el toast **sólo** cuando `existingAccount` es `true`.
  **Test** (estático o de contrato, sin jsdom).
- [ ] El 409 sigue sin modificar la fila (test de la 0053 conservado).
- [ ] Alta con teléfono nuevo: igual que siempre, cero updates. **Test.**
- [ ] `enroll()` no contiene **ninguna** llamada de escritura sobre `consumerAccounts` más
  que el `insert` del alta nueva. **Test** (el fake db de la 0053 ya cuenta statements).
- [ ] Los 5 gates verdes; el conteo de tests no baja de 357.
- [ ] **QA en vivo (owner):** re-enrolarse con un teléfono ya registrado en otro programa →
  ver el toast, y el pase/portal con los datos guardados.

## Notas
- Ningún doc queda afirmando la decisión vieja: ADR 0050 marcado supersedido, spec 0053
  marcada revertida, INDEX y TASKS actualizados en el mismo commit.
- Sin migración, sin secreto, sin dependencia nueva.
