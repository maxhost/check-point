---
adr: 0055
fecha: 2026-09-08
estado: aceptada
resumen: Un staff desactivado que se loguea con credenciales validas ve un mensaje explicito («Miembro del staff desactivado») en vez de rebotar en silencio. Se acepta a proposito que eso revele el estado de la cuenta, porque solo lo ve quien YA probo conocer la contraseña — no habilita enumeracion. Ademas el rechazo deja de crear una sesion huerfana: el login de un miembro desactivado no deja sesion viva.
---

# 0055 — El rechazo por staff desactivado se dice en voz alta

> Nace del QA del owner del 2026-09-08 (item C8 de la spec 0055). El owner verifico que un
> staff `disabled` **no puede** operar el mostrador —el guard funciona— pero reporto que el
> login **no muestra nada**: «deberiamos poner un toast que diga "Miembro del staff
> desactivado" por que hoy no muestra nada». Lo implementa la **spec 0057**.

## Contexto

Hoy el rechazo funciona, pero es mudo y deja basura. El recorrido real, verificado leyendo el
codigo:

1. `LoginPage` llama a `merchantAuthClient.signIn.email`. **better-auth autentica contra
   `merchant_auth`, que no sabe nada de `core.business_membership`**: un staff desactivado con
   la contraseña correcta se loguea **con exito** y se le **crea una sesion nueva**.
2. El cliente hace `window.location.assign("/backoffice")`.
3. `requireBackofficeSession` (`auth-guards.ts`) ve `status !== 'active'` y hace
   `redirect("/login")` — **sin ningun parametro, sin ningun motivo**.
4. El usuario vuelve a ver el formulario de login vacio. Desde afuera es indistinguible de
   «el login esta roto» o «puse mal la contraseña».

Dos consecuencias, y la segunda no estaba reportada:

- **La visible:** no hay forma de que un empleado desvinculado entienda que su cuenta fue
  desactivada. Va a reintentar, va a pedir un reseteo de contraseña que no lo va a ayudar, y
  va a llamar al owner por un problema que no es tecnico.
- **La invisible:** el paso (1) **deja una sesion viva de un miembro desactivado**. No otorga
  acceso al backoffice (el guard la frena en cada render) ni al mostrador (`operatorBusiness`
  filtra `status = 'active'` desde la spec 0055), pero existe. `setStaffStatus` se toma el
  trabajo de borrar las sesiones al desactivar (`staff.ts`), y este camino las vuelve a crear:
  la garantia que el codigo se propuso dar queda a medias.

## Decision

**1. El rechazo se dice en voz alta.** El guard redirige con un motivo y el login lo muestra:
«Miembro del staff desactivado» — las palabras del owner.

**2. Se acepta a proposito que el mensaje revele el estado de la cuenta.** Es un tradeoff de
enumeracion, y se resuelve a favor de decirlo **por una razon concreta, no por comodidad: el
mensaje solo aparece DESPUES de una autenticacion exitosa.** Quien lo ve ya probo conocer el
email **y** la contraseña. No le enseña nada que no supiera: si adivinara credenciales validas,
el estado de la membresia es lo de menos. Un atacante que no conoce la contraseña sigue viendo
exactamente el mismo error generico que antes. **Es decir: no se abre ningun canal de
enumeracion.** Lo que se rechaza es el patron opuesto —callar el motivo «por seguridad»— que
aca no compra seguridad y cuesta soporte.

**3. El login de un miembro desactivado no deja sesion viva.** El guard **revoca la sesion**
antes de redirigir. Asi la promesa de `setStaffStatus` («desactivar mata las sesiones») deja de
tener un agujero por el que se vuelven a crear.

## Alternativas consideradas

- **Bloquear dentro de better-auth** (`databaseHooks.session.create.before`) para que la sesion
  nunca nazca. Es mas limpio en teoria y se descarta por dos razones: acopla el dominio de
  membresias —que vive en `core`— al ciclo de vida de `merchant_auth`, y el error que llegaria
  al cliente es el generico del plugin, con lo cual **habria que resolver el mensaje igual**.
  La spec 0046 ya dejo escrito lo que cuesta asumir el comportamiento de un plugin sin
  verificarlo. Si algun dia hay mas de un motivo de rechazo post-login, se reevalua.
- **Mensaje generico** («No pudimos iniciar sesion»). Es lo que hay hoy de facto y es
  exactamente lo que el owner rechazo.

## Consecuencias

- El login deja de ser un componente 100% cliente: necesita leer el motivo de la URL, asi que
  se parte en pagina servidor + formulario cliente. Es el patron que el repo ya usa en otras
  pantallas.
- El motivo viaja en la URL y por lo tanto es **falsificable**: cualquiera puede escribir
  `/login?e=staff_disabled` y ver el cartel. No importa — el mensaje no otorga nada, y el
  control de acceso real sigue siendo el guard del servidor. **Se declara para que nadie
  confunda el cartel con una decision de autorizacion.**
