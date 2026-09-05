---
adr: 0051
fecha: 2026-09-05
estado: aceptada
resumen: Supersede al ADR 0050 ENTERO. Enrolarse con un teléfono ya registrado NO modifica nada del perfil — ni el nombre: se crea la membresía con los datos que ya están en la base y la confirmación avisa con un toast ("Ya tienes una cuenta con ese teléfono: te enrolaste en el programa con tus datos"). El enroll vuelve a ser una operación de solo-lectura sobre la cuenta. La confusión que originó el 0050 (el pase decía "Cliente iOS 4" y no el nombre recién tipeado) se resuelve informando, no mutando.
---

# 0051 — El re-enroll no toca el perfil, y avisa con un toast

> **Supersede al ADR 0050 completo.** Decisión directa del owner (2026-09-05), tras ver
> implementado el 0050 y rechazarlo: *"al re-enrolarme en otro programa no se actualiza
> nombre nuevo, simplemente me enrola en el nuevo programa con los datos que ya tenemos
> en la DB [...] y le avisa con un toast, nada más"*.

## Contexto: cómo llegamos acá (dos correcciones del owner)

1. El QA en vivo mostró que el pase salía como "Cliente iOS 4" cuando el owner acababa de
   tipear "Logan Wolf". Se le presentaron opciones y eligió "el re-enroll actualiza el
   nombre" → **ADR 0050** + spec 0053, implementada con PASS.
2. Al ver el comportamiento completo, el owner lo rechazó: la actualización del nombre
   **nunca fue lo que quería**. Lo que quería es que el usuario existente quede enrolado
   con sus datos guardados **y se entere de por qué** ve esos datos.

La lección de producto que queda: la confusión del pase no era un problema de datos, era un
problema de **información** — el usuario no sabía que ya tenía cuenta. Se arregla avisando,
no reescribiendo el perfil.

## Decisión

1. **El enroll no escribe NADA en `consumer_account` cuando la cuenta ya existe.** Ni
   `first_name`/`last_name` ni ninguna otra columna. Se crea la membresía y punto — el
   comportamiento original, previo a la spec 0053.
2. **El 201 informa que la cuenta ya existía** (un booleano tipo `existingAccount`), y la
   confirmación muestra un **toast**: *"Ya tienes una cuenta con ese teléfono: te enrolaste
   en el programa con tus datos."*
3. El nombre tipeado en el form, cuando la cuenta ya existe, **se descarta** — ahora por
   decisión explícita, con el aviso como contrapartida.

## Consecuencias

- El invariante "una operación no exitosa no deja efectos" (la parte del 0050 que el owner
  sí validó) queda cubierto **gratis**: el enroll ya no escribe en la cuenta en ningún
  camino, exitoso o no. Los tests que lo pinnean se conservan.
- El booleano `existingAccount` en el 201 **no filtra nada**: le dice al propio dueño de la
  sesión recién emitida algo que ya sabe mejor que nadie (si ese teléfono es suyo). Para un
  tercero que conozca el teléfono, no revela nada que el flujo no revelara ya (la tarea 41
  documenta ese problema preexistente, que este ADR no toca).
- El margen de abuso que el 0050 agregaba (reescribir el nombre ajeno conociendo el
  teléfono) **desaparece** con la reversión.
- La spec 0053 queda **revertida**; la reversión la implementa la spec 0054.
