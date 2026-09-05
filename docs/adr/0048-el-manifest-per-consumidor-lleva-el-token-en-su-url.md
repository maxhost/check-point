---
adr: 0048
fecha: 2026-09-05
estado: aceptada
resumen: Enmienda el punto 5 del ADR 0039. El manifest per-consumidor calculaba su `start_url` leyendo la cookie de sesión, pero un `<link rel="manifest">` se pide SIN credenciales salvo que lleve `crossorigin="use-credentials"` — así que la sesión nunca llega y `start_url` cae siempre a `/wallet`: el re-bootstrap por `/c/<token>` nunca funcionó, ni siquiera desde `/wallet`. El token pasa a viajar en la URL del manifest (`?c=<token>`), server-renderizada por la página que ya tiene la sesión. Sin dependencia de cookies, determinista.
---

# 0048 — El manifest per-consumidor lleva el token en su URL, no en la cookie

> **Enmienda el ADR 0039**, punto 5 (`start_url` per-consumidor derivado de la sesión).
> El resto del 0039 sigue vigente: el objetivo —que el ícono instalado re-bootstrapee la
> sesión en el cookie jar separado del PWA standalone de iOS— **no cambia**. Cambia el
> mecanismo por el que el manifest se entera de quién es el consumidor.

## Contexto

El manifest dinámico (`/wallet/manifest.webmanifest`) resuelve la sesión desde la cookie y
devuelve `start_url = /c/<webViewToken>` para el consumidor logueado, o `/wallet` si no hay
sesión. La intención era que el ícono de inicio abriera el magic link, que emite una sesión
nueva y redirige — resolviendo que **iOS le da al PWA standalone un cookie jar separado**.

## El problema, verificado en producción

Un `<link rel="manifest">` **se pide sin credenciales** salvo que lleve
`crossorigin="use-credentials"`. El HTML servido por producción no lo lleva:

```
<link rel="manifest" href="/wallet/manifest.webmanifest"/>
```

Es decir: el fetch del manifest llega **sin la cookie de sesión**, `resolveSession` recibe
`undefined`, y `start_url` sale `"/wallet"` **siempre**. El `/c/<token>` del ADR 0039 §5
**nunca se materializó, tampoco desde `/wallet`**. No es una regresión: nació así, y el QA
en vivo no lo cazó porque el síntoma (abrir `/wallet` sin sesión) se confunde con "todavía
no me logueé".

Salió a la luz por un hallazgo de QA distinto: instalar desde la confirmación del enroll
—que ni siquiera enlaza el manifest— hacía que el ícono abriera el formulario de registro.
Al arreglar eso quedó claro que el arreglo obvio (enlazar el manifest ahí también) **no
alcanzaba**, porque el mecanismo de fondo estaba roto.

## Decisión

**El token viaja en la URL del manifest**, no en la cookie:

1. La página que ya tiene la sesión **server-renderiza** el link con el token:
   `<link rel="manifest" href="/wallet/manifest.webmanifest?c=<webViewToken>">`.
2. La ruta del manifest lee `?c=`, **valida que el token resuelva a una cuenta** y arma
   `start_url = /c/<token>`. Token ausente, inválido o revocado → `start_url = /wallet`
   (el comportamiento de hoy, que sigue siendo correcto para un visitante anónimo).
3. `id` se mantiene en `/wallet` para que la identidad del PWA no se fragmente entre
   consumidores ni cambie al rotar el token.

## Por qué no `crossorigin="use-credentials"`

Es la alternativa de menos código y fue descartada por dos razones:

- **Falla en silencio.** Depende de que Safari mande cookies en el fetch del manifest, cosa
  que no está documentada de forma confiable entre versiones de iOS. Si no lo hace, el
  resultado es exactamente el estado roto de hoy — `start_url` cae a `/wallet` sin ningún
  error visible. Un mecanismo cuyo modo de falla es indistinguible del bug que arregla no
  es un arreglo.
- **Next no lo puede emitir** desde `metadata.manifest`; obligaría a un `<link>` a mano
  compitiendo con el que ya inyecta la metadata API.

El token en la URL no depende de nada del navegador: es determinista.

## Sobre exponer el token en la URL

**No abre una clase de amenaza nueva.** El `web_view_token` ya es *at-bearer* por el
**ADR 0014** y ya viaja en URLs: es el `/c/<token>` que vive dentro del pase de Wallet y el
que esta misma decisión pone en `start_url`. La rotación en recuperación de cuenta (spec
0032) lo sigue invalidando igual, y un manifest con un token muerto degrada a `/wallet`,
que es el comportamiento seguro.

## Consecuencias

- El manifest se vuelve **per-consumidor de verdad**, no sólo en intención. Ya tiene
  `Cache-Control: no-store`, así que no hay que tocar caché.
- La página del enroll **no** enlaza el manifest y **no** debe hacerlo: el usuario pasa por
  `/wallet` antes de instalar, que es donde el instructivo iOS ya vive y donde la sesión
  existe. Instalar desde el enroll era el bug original.
- Queda una verificación que **sólo un iPhone real puede dar**: que Safari efectivamente
  honre `start_url` del manifest al agregar a inicio. Si lo ignorara y usara la URL actual,
  el ícono abriría `/wallet` — que tras este cambio es igualmente correcto, sólo que sin el
  re-bootstrap de sesión. Es una degradación aceptable, no un fallo.
