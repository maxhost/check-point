---
spec: 0218
fecha: 2026-10-13
estado: cerrada
resumen: Parte Claude del ingreso del equipo por `staff.checkpass.club` (ADR 0140). Tercera audiencia en `decideHostRoute` (`STAFF_ORIGIN`), portada del host reescrita al ingreso del equipo, cruces 308 entre `staff.` y `business.`, `noindex` en todo el host y `robots.txt` por host, `landing` calculado por el servidor en el login del equipo, y el cambio del PIN temporal OBLIGATORIO del lado del servidor (403 `pin_change_required`). Las pantallas las define el owner con GPT.
disjunta: si
archivos: packages/domain/src/server/hosts.ts (+test), apps/merchant/src/proxy.ts, apps/merchant/src/app/robots.txt/route.ts, apps/merchant/src/app/api/merchant/auth/staff/route.ts, apps/merchant/src/server/staff-landing.ts (+test), apps/merchant/src/server/pin-change-gate.ts (+test), guards del backoffice y de la API
---

# 0218 — Ingreso del equipo por `staff.checkpass.club` (parte Claude)

Nivel **L2** (login y sesiones: piso L2). Decisiones: ADR 0140 (owner 2026-10-13), ADR 0106 (un subdominio por
audiencia), ADR 0070 §4 (identificador + PIN, cambio obligatorio en el primer ingreso), contrato 0067 §1 y §3.

## Problema (medido 2026-10-13)

- Ninguna pantalla llama a `POST /api/merchant/auth/staff`: el unico acceso del panel es el del dueño (ADR 0137). Un
  integrante no puede entrar.
- `decideHostRoute` (`packages/domain/src/server/hosts.ts`) conoce dos audiencias (`business.`, `my.`), no `staff.`.
- El cambio del PIN temporal no es obligatorio en el servidor: el login devuelve `mustChangePin` y nada mas; con la
  sesion abierta el integrante usa el panel con el PIN que le paso el dueño (contradice ADR 0070 §4).
- El merchant no tiene `robots.txt` ni cabecera `noindex`.

## Alcance

**Entra:** host `staff.` (rutas, reescritura, 308, `noindex`, `robots.txt`), `landing` en la respuesta del login del
equipo, compuerta del cambio de PIN obligatorio, tests.

**No entra:** pantallas (owner + GPT), alta del dominio en Vercel y DNS (paso del owner, o de Claude con OK explicito),
cambiar el login del dueño.

## Diseño

### Host (`decideHostRoute`, puro)

- Entrada nueva `staffOrigin` (`process.env.STAFF_ORIGIN`). H1: sin `STAFF_ORIGIN` el host `staff.` no se trata
  distinto (todo sigue como hoy). H2: solo se decide sobre el host exacto de `STAFF_ORIGIN`. H3: `/api` nunca.
- La decision pasa a devolver `{ redirect }` (308, como hoy), `{ rewrite }` o `null`:
  - en `staff.`: `/` → **rewrite** a `/acceso-equipo` (la URL queda `staff.checkpass.club/`); `/backoffice/**` → sigue;
    paginas del dueño (`/<locale>/business/**`) → 308 a `business.`; paginas del cliente → 308 a `my.` (como hoy).
  - en `business.`: `/acceso-equipo` → 308 a la portada de `staff.`.
- `/acceso-equipo` es la ruta INTERNA de la pantalla del ingreso del equipo (la construye GPT).

### `noindex`

- `proxy.ts`: toda respuesta de pagina en el host `staff.` lleva `X-Robots-Tag: noindex, nofollow`.
- `app/robots.txt/route.ts`: en `staff.` → `User-agent: *` / `Disallow: /`; en los demas hosts →
  `User-agent: *` / `Allow: /` (equivalente a hoy, que no tiene robots).

### `landing` en el login del equipo

`POST /api/merchant/auth/staff` suma `staff.landing` (string, path del mismo host), calculado por
`server/staff-landing.ts` (puro + lectura):
- permisos EFECTIVOS = los del integrante que tienen efecto hoy: `pos` solo con el POS encendido
  (`core.business.pos_enabled`), un permiso de modulo solo con su modulo encendido, los del core siempre.
- efectivos = exactamente `{pos}` → `/backoffice/pos`; cualquier otro conjunto no vacio → `/backoffice`;
  vacio → `/backoffice` (el panel general muestra que no tiene accesos; **hallazgo a decidir por el owner**: ¿se le
  niega la entrada?).
- Si `mustChangePin` es true, la pantalla va primero al cambio de PIN y despues a `landing`.

### Cambio de PIN obligatorio (servidor)

Mientras `core.business_membership.pin_must_change = true` para la sesion de un integrante:
- paginas del backoffice → redirect a `/acceso-equipo?cambiar-pin=1` (la pantalla del cambio);
- API → **403 `pin_change_required`** («Cambia tu PIN temporal para continuar.»), EXCEPTO
  `POST /api/staff/:userId/pin` (el propio cambio), `GET /api/merchant/session` y el cierre de sesion.
- El owner no tiene PIN: nunca entra en la compuerta.
- Se implementa en la escalera de guards existente (`api-permission` / `api-owner` / `requireBackofficeSession`), una
  sola vez, no ruta por ruta.

### Cookie

Verificar (medido, no supuesto) que la cookie que emite `openMerchantSession` NO lleva `Domain` (queda atada al host):
una sesion abierta en `staff.` no viaja a `business.`. Si lleva `Domain`, PARAR y reportar.

## Plan de pruebas

Clases de error: **host equivocado o bucle de 308**, **un integrante usa el panel sin cambiar el PIN temporal**,
**destino que muestra mas de lo permitido**. Presupuesto < 10 min.

1. Unitario de `decideHostRoute`: tabla de casos (staff `/` rewrite; staff `/backoffice/pos` sigue; staff
   `/es/business/onboarding` → business; business `/acceso-equipo` → staff; sin `STAFF_ORIGIN` todo `null`; `/api`
   nunca; sin bucle: ningun destino vuelve a redirigir).
2. Unitario de `staff-landing`: `{pos}` + POS encendido → POS; `{pos}` + POS apagado → `/backoffice`;
   `{pos, catalog}` → `/backoffice`; `{stock}` con Stock apagado → vacio → `/backoffice`.
3. Neon: login devuelve `landing`; con `pin_must_change` una ruta cualquiera → 403 `pin_change_required` y
   `POST /api/staff/:id/pin` con el PIN actual → 200 y despues la ruta anda; el owner nunca recibe el 403.
4. `next dev` con `STAFF_ORIGIN` local: cabecera `X-Robots-Tag` en `staff.`, `robots.txt` por host, cookie sin `Domain`.
5. Mutacion: quitar la compuerta → el test 3 da rojo.
6. typecheck + lint.
