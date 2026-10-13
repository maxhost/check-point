---
adr: 0140
fecha: 2026-10-13
estado: aceptada
resumen: El personal del comercio entra por un subdominio propio, `staff.checkpass.club`, no indexable, con el login (identificador `nombre@negocio` + PIN) en la portada. Es la TERCERA audiencia del mecanismo «un subdominio por audiencia» (ADR 0106), en la misma app. Despues de entrar, cada integrante va a lo que puede ver: solo POS → el POS; mas permisos → el panel general mostrando solo lo suyo. La sesion queda atada al host (no se comparte con `business.`).
---

# 0140 — El equipo entra por `staff.checkpass.club`

## Contexto

- Owner 2026-10-13: «como se loguea un miembro de staff? hoy el login pide email para enviar un pin. Pero el staff no
  tiene un email». Medido: el servidor del login del personal existe y esta probado (`POST /api/merchant/auth/staff`,
  identificador `handle@slug` + PIN, bloqueo escalonado, `mustChangePin`; contrato `docs/specs/0067-contratos-de-api.md`
  §1; ADR 0070 §4), pero **ninguna pantalla lo llama**: el formulario de login se borro con la spec 0067 (`9086c9a`) y
  el unico acceso del panel es el del dueño (email + codigo, ADR 0137). Hoy un integrante no puede entrar.
- Ya existe «un subdominio por audiencia» (ADR 0106, spec 0114): una sola app sirve `business.` (comercio) y `my.`
  (cliente); `decideHostRoute` redirige con 308 la pagina pedida en el host equivocado.

## Decision (owner 2026-10-13, textual: «deberia ser un subdominio staff.checkpass.club no indexable con el login
directo. y esto lo redirige a lo que puede ver, si es una persona con acceso al POS va al pos, si tiene mas accesos
entonces va a la pantalla general como el owner pero viendo solo lo que puede ver»)

1. **`staff.checkpass.club`** es la tercera audiencia de la misma app (`STAFF_ORIGIN`), con las mismas reglas H1-H3 del
   ADR 0106 (sin la variable no se redirige nada; solo se toca ese host; `/api` nunca).
2. **No indexable**: todo el host responde `X-Robots-Tag: noindex, nofollow` y su `robots.txt` lo prohibe entero.
3. **Login en la portada**: `/` de `staff.` es el ingreso del equipo (identificador + PIN). Las paginas del dueño
   (alta, login por codigo) pedidas en `staff.` van a `business.` (308), y viceversa el ingreso del equipo pedido en
   `business.` va a `staff.`.
4. **El panel del equipo se sirve en `staff.`** (`staff.checkpass.club/backoffice/…`): la sesion que abre el login del
   equipo queda atada a ese host y no viaja a `business.`. El dueño sigue en `business.`.
5. **Destino despues de entrar** (lo calcula el SERVIDOR, para que pantalla y servidor no diverjan): si los permisos
   EFECTIVOS del integrante son solo el POS (con el modulo POS encendido) → `/backoffice/pos`; si tiene cualquier otro
   permiso efectivo → `/backoffice` (el panel general, que ya muestra solo lo delegado). Si `mustChangePin`, primero el
   cambio de PIN y despues el destino.
6. **Las pantallas las define el owner con GPT** (zona GPT); Claude hace host, cabeceras, destino y contrato.

## Consecuencias

- Dominio nuevo en Vercel (proyecto merchant) + DNS + `STAFF_ORIGIN` y `BETTER_AUTH_TRUSTED_ORIGINS`: paso del owner (o
  de Claude con OK explicito), no de codigo.
- El credencial que ve el dueño al crear un integrante tiene que decir donde se entra (`staff.checkpass.club`).
- Un integrante sin ningun permiso efectivo no tiene a donde ir: hallazgo a decidir en la spec.
