---
adr: 0085
fecha: 2026-09-23
estado: aceptada
resumen: La importacion de catalogo NO avisa por email. La funcion se elimina entera —modulo, copys, tests y la columna `notified_at`—, no se apaga con un flag. Decision del owner el 2026-09-23, textual: nunca pidio que el cliente reciba un email. El merchant se entera por la pantalla, que ya polea y muestra el resumen; el analisis tarda menos que el mail.
---

# 0085 — La importacion de catalogo no manda email

## Contexto

El ADR 0082 §12 introdujo un aviso por email al terminar la importacion, con este razonamiento:
como el analisis es asincrono, el merchant sube el archivo, cierra la pantalla y se olvida, asi
que hace falta algo que lo traiga de vuelta. La spec 0091 §7 lo mantuvo y le cambio el momento
(pasa a salir **despues** del resultado final, no al llegar a `ready`).

**Nunca fue un pedido del owner.** Al revisar los huecos de verificacion de la 0091 aparecio que
la mitad «una sola vez» del aviso no tiene oraculo, y al preguntar por como cerrarla el owner
respondio (2026-09-23), textual: *«de hecho jamas pedi que el cliente reciba un email.
desactivemos esta funcion o eliminemosla. no necesito que reciba un email cuando acabe esto»*.

## Decision

**La importacion de catalogo no manda ningun email, ni de exito ni de fallo.** Y no se apaga: se
**elimina**, porque el owner pidio explicitamente que no quede codigo ni archivos sucios.

Se van, en el mismo commit: `catalog-import/notify.ts`, su suite, las dos llamadas de
`finish.ts` (`accepted` y `failed`), los dos copys, el oraculo de cableado de §7 —que pinnea un
invariante que deja de existir— y la columna `notified_at` con su migracion.

**Lo que NO se toca:** `server/email/` entero. El canal lo usan la recuperacion de contraseña y
el alta de staff; esto es solo la importacion.

## Por que se puede

El aviso existia para un flujo que **ya no existe**. En el ADR 0082 el analisis terminaba en un
borrador que alguien tenia que ir a revisar: el email traia a esa persona de vuelta a hacer
trabajo. Desde el ADR 0084 el analisis termina con **el catalogo escrito**: no hay nada que el
merchant tenga que ir a hacer, y si cerro la pantalla, el catalogo ya tiene sus productos la
proxima vez que la abra. `GET /api/catalog/imports` devuelve el ultimo import con su `result`
(spec 0091 §9), asi que la pantalla que vuelve encuentra el resumen sin ayuda de nadie.

## Consecuencias

- **Un merchant que cierra la pantalla no recibe ninguna notificacion.** Aceptado: se entera al
  volver al catalogo, que es donde iba a ir igual. **No hay push** (ADR 0082 §12 ya lo dejaba
  afuera) y esto no lo reabre.
- **Un fallo tampoco avisa.** El import queda en `failed` con su `code` saneado y la pantalla lo
  muestra al volver. Es el mismo trato que el exito.
- **La columna `notified_at` se borra**, asi que se pierden las marcas de los avisos ya
  mandados. No tienen valor: eran el candado de «una sola vez» de una funcion que deja de
  existir.
- **ORDEN DE DESPLIEGUE, y no es opcional:** el codigo que corre HOY en produccion **escribe**
  `notified_at`. Una migracion que borra una columna que el codigo viejo escribe va **DESPUES**
  del deploy, nunca antes (gotcha medido en la spec 0081). El deploy primero, la migracion
  despues.
- Un hueco de verificacion se cierra **borrandolo**, que es la unica forma que no cuesta
  mantenimiento: la mitad «una sola vez» de `notified_at` ya no tiene que probarse.

## Alternativas descartadas

- **Apagarlo con un flag.** Descartada por pedido explicito del owner. Ademas deja el codigo, la
  columna y el hueco de verificacion vivos, o sea el costo completo sin el beneficio.
- **Dejarlo y cerrar el hueco con un test en Neon.** Era mi recomendacion cuando la pregunta era
  «como lo pinneamos»; dejo de aplicar cuando la respuesta fue que la funcion no se queria.

## Referencias

- ADR 0082 §12 — introdujo el aviso. Esta decision lo **supersede**.
- ADR 0084 — la importacion escribe directo; es lo que deja al aviso sin trabajo.
- Spec 0091 §7 — el invariante «el aviso sale despues del resultado final», que desaparece.
