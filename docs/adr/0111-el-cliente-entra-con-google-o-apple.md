---
adr: 0111
fecha: 2026-10-01
estado: aceptada
resumen: El cliente se da de alta y entra SOLO con Google o Apple (OIDC, codigo de autorizacion server-side, `jose` para verificar el id_token); se borran el formulario nombre/apellido/telefono, la recuperacion por SMS y toda la infraestructura OTP. La identidad pasa a ser (proveedor, sub) en una tabla nueva `consumer.consumer_identity`; el telefono queda opcional para siempre. Sin union de cuentas (ni por email). Con sesion viva, el QR de otro comercio se resuelve en UN toque («Sumarme como Juan»). Supersede la clave de identidad del ADR 0032 y el ADR 0051 entero.
---

# 0111 — El cliente entra con Google o Apple

## Contexto

Hoy el cliente escanea el QR de un comercio y completa nombre, apellido y telefono (`enroll-form.tsx`). El telefono
es la clave de identidad (`consumer.consumer_account.phone_e164`, unico y `NOT NULL`, ADR 0032) y **no esta
verificado**: el que conoce un telefono ajeno obtiene una sesion de esa cuenta (tarea 41). Volver a entrar desde otro
navegador es la recuperacion por SMS (`/recover`, spec 0032), con proveedor OTP pago (Twilio/ClickSend).

El owner quiere que el segundo comercio no cueste nada: «si el customer se dio de alta en algun programa de la red, la
siguiente vez que escanea el registro sea casi tan simple que no tenga que hacer nada».

**Medido el 2026-10-01** (StatCounter, moviles): Argentina **Android 87,37% / iOS 12,63%**; Sudamerica Android ~77–82%.
Todo Android trae cuenta de Google (Play Store) y todo iPhone un Apple ID. Auth0/Okta (marzo 2022, global, no LatAm):
Google 73–82% del login social, Apple segundo. No hay dato publico confiable de login social en LatAm.

**PROD el 2026-10-01** (Neon `main`, solo lectura): 9 cuentas de cliente en toda la red; Plátano Garden (el unico
comercio real) tiene 1 cliente, el owner.

## Decisiones del owner (2026-10-01, textuales)

1. «si simplificamos los login a google, apple … me parece suficiente sin necesidad de tener que pedirle nombre,
   apellido y telefono. el nombre y apellido y email podemos obtenerlo del llamado, el telefono podemos pedirlo mas a
   delante en el perfil». **CheckPass como tercer boton se descarta** («no sirve si el usuario no tiene una cuenta
   previa»).
2. «formulario actual lo borraria, simplemente dejaria los dos botones».
3. «telefono seria opcional para siempre … esto tambien me evita tener que enviar por sms otp para recuperar cuenta o
   acceder».
4. «no hay usuarios reales … no hace falta unir cuentas ahora».
5. «Tengo cuenta en apple como dev».
6. Segundo escaneo con sesion viva (AskUserQuestion): **«Un toque»** — boton «Sumarme como <nombre>» + «No soy yo».

## Decision

1. **Dos proveedores, Google y Apple, los dos visibles en todo dispositivo** (el del sistema primero: Apple en
   iOS, Google en el resto). Un usuario de iPhone que usa Google, o uno que cambio de telefono, tiene que poder
   elegir el mismo proveedor que la primera vez.
2. **OIDC con codigo de autorizacion, resuelto en el servidor del cliente** (`apps/consumer`), sin SDK de
   proveedor ni `better-auth` (la auth del cliente ya es propia, ADR 0032). El `id_token` se verifica con `jose`
   (ya esta en el lockfile, `jose@6.2.8`, transitivo de `better-auth`): firma contra el JWKS del proveedor, `iss`,
   `aud`, `exp` y `nonce`. Google ademas con PKCE. Apple: el `client_secret` es un JWT ES256 firmado en cada canje
   con la clave `.p8` (vida 5 minutos).
3. **La identidad es `(provider, subject)`** en una tabla nueva `consumer.consumer_identity`, unica por ese par.
   **Nunca se busca una cuenta por email**: no hay union de cuentas (decision 4) y el email de Apple puede ser un
   reenvio. La misma persona con Google y con Apple tiene dos cuentas; aceptado.
4. **`consumer_account.phone_e164` pasa a nullable** (el indice unico `consumer_account_phone_unique` se queda: Postgres admite varios NULL) y se
   agrega `email` nullable. El email se guarda, **no es clave** y no se expone al comercio.
5. **El nombre se toma del proveedor.** Apple lo entrega **solo en la primera autorizacion** (campo `user` del
   `form_post`, no en el `id_token`); se guarda en ese momento o no vuelve. Si falta, `first_name` = `""` y
   `last_name` = `""` (las columnas siguen `NOT NULL`); la presentacion ya hace `trim()` (`wallet/apple.ts:56`).
   **Una cuenta existente nunca se reescribe al volver a entrar** — el espiritu del ADR 0051 se conserva: entrar
   es una operacion de solo-lectura sobre el perfil.
6. **El alta es la vuelta del proveedor.** Tocar «Google» en `/enroll/<programId>` es el consentimiento de sumarse a
   ese programa: el callback crea o encuentra la cuenta, crea la membresia (con su `loc`, ADR 0042), emite la
   Bienvenida, abre la sesion y redirige a la confirmacion que ya existe (`/enroll/<id>/ready`, que emite el
   manifest por sesion — ADR 0049 sigue valiendo sin viajar en un 201).
7. **Un toque con sesion viva.** Si `/enroll/<programId>` ve una sesion valida, muestra «Sumarme como <nombre>»
   (POST con la cookie, sin cuerpo de datos) y «No soy yo» (muestra los dos botones). La cookie de sesion es
   `SameSite=Lax`: un POST de otro sitio no la lleva, asi que el toque no es forzable desde afuera. No hay alta
   automatica al abrir la pagina.
8. **Entrar sin programa**: `/wallet` sin sesion muestra los mismos dos botones (login puro, sin membresia).
9. **Se borra** el formulario, `/recover` y sus 4 rutas, `server/otp/*`, `consumer/recovery/*`, el rate limit por
   telefono, las tablas `otp_challenge`, `otp_delivery` y `enroll_attempt`, y los tests que solo median eso
   (ADR 0070 §17: no dejar rastros). `rotatePassCredentials` queda sin llamador y se borra.
10. **La cookie transitoria del OAuth es `__Host-`, `SameSite=None; Secure`, 10 minutos**, y guarda `state`,
    `nonce`, el verificador PKCE, el proveedor, el `programId` y el `loc`. `None` porque Apple vuelve por **POST
    cross-site** (`response_mode=form_post`, obligatorio al pedir `name email`) y una cookie `Lax` no viaja en ese
    POST. La proteccion CSRF del callback es el `state`, no el SameSite. `__Host-` impide que otro subdominio de
    `checkpass.club` la plante.

## Consecuencias

- **Se cierra la tarea 41**: la identidad la verifica el proveedor, no un telefono tipeado.
- **Se pierde el «perdi el telefono → rotar el pase y cerrar sesiones»** que hacia la recuperacion: entrar en un
  dispositivo nuevo NO rota credenciales (varios dispositivos son legitimos). Hallazgo a decidir, a `PARQUEADO.md`.
- **La busqueda por telefono del comercio** (`listByPhone`, `apps/merchant/src/server/customers/list.ts:125`) sigue
  andando, pero los clientes nuevos no tienen telefono: devuelve vacio para ellos. Hallazgo a decidir.
- **Apple no se puede probar en local ni en previews**: sus Return URLs se registran exactas y sin `localhost`. El
  QA de Apple es en `my.checkpass.club`. Google acepta `localhost` como redirect.
- Las 9 cuentas actuales siguen con su pase y su sesion; si entran con Google/Apple nace otra cuenta.
- **Supersede**: la clave de identidad del ADR 0032 (el esquema propio y la sesion opaca siguen); el ADR 0051 entero
  (no hay datos tipeados que descartar ni toast que mostrar).

## Fuentes

- StatCounter, Mobile OS Argentina / South America, sep 2026.
- Auth0/Okta, *Social Login Report*, 2022.
- Apple Developer Forums 118209 y 121760: `form_post` obligatorio con `name email`; nombre solo en la primera
  autorizacion.
