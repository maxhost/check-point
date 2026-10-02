---
spec: 0120
fecha: 2026-10-02
estado: implementada
resumen: «No soy yo» tambien en «Ya sos parte», «Cerrar sesion» en Configuracion (revoca la sesion en la base y borra la cookie) y los botones de Google y Apple con el estilo de marca oficial de cada uno.
disjunta: si
archivos: apps/consumer/src/app/(consumer)/provider-buttons.tsx, apps/consumer/src/app/(consumer)/enroll/[programId]/page.tsx, apps/consumer/src/app/(consumer)/enroll/[programId]/enroll-buttons.tsx, apps/consumer/src/app/(consumer)/wallet/settings-tab.tsx, apps/consumer/src/app/api/public/session/logout/route.ts, packages/domain/src/server/consumer/session.ts
---

# 0120 — Cambiar de cuenta y botones con la marca de Google y Apple

> Sigue a la 0119 (ADR 0111). Nace del QA del owner en Android el 2026-10-02.

## Problema

- Con sesion viva y ya miembro, `/enroll/<id>` muestra «Ya sos parte de X» + «Ver mi tarjeta» y nada mas
  (`apps/consumer/src/app/(consumer)/enroll/[programId]/page.tsx:96-118`): no hay «No soy yo». Medido en PROD: el
  Android del owner traia una sesion de alta por telefono del 2026-10-01 (30 dias) y no habia forma de pasar a
  Google sin borrar los datos del navegador.
- La app del cliente no tiene «Cerrar sesion» en ningun lado, y el dominio no tiene como revocar una sesion:
  `packages/domain/src/server/consumer/session.ts` solo exporta `issueSession` (`:15`) y `resolveSession` (`:37`).
- Los botones de proveedor usan el color del comercio y no la marca de Google/Apple
  (`apps/consumer/src/app/(consumer)/provider-buttons.tsx:43-45`).

## Alcance

**Entra:** «No soy yo» en el estado «Ya sos parte»; el nombre de la cuenta en ese estado; ruta de logout;
`revokeSession`; boton «Cerrar sesion» en Configuracion; botones con estilo oficial de Google y de Apple.

**No entra:** rotar `web_view_token` ni tocar el icono instalado (ver «Declarado afuera»); cerrar sesiones de otros
dispositivos (hallazgo #65); cambios de copy fuera de estos botones; la revision independiente completa (el owner
pidio una revision liviana, 2026-10-02: «sin revision extrema»).

## Diseño

**Dominio — `session.ts`:** `revokeSession(token: string | undefined, now = new Date()): Promise<void>`.
Sin token, no hace nada. Con token: `UPDATE consumer.consumer_session SET revoked_at = now WHERE token_hash =
hashToken(token) AND revoked_at IS NULL`. Nunca lanza por token desconocido. El rol ya tiene `UPDATE` en
`consumer_session` (`0060`).

**Ruta — `POST /api/public/session/logout`:** lee la cookie `SESSION_COOKIE`, llama a `revokeSession`, responde
**204** y borra la cookie con los mismos atributos con que se emite (`httpOnly`, `secure`, `sameSite: "lax"`,
`path: "/"`, `maxAge: 0`). Sin cookie, igual 204 (idempotente). Un POST de otro sitio no lleva la cookie `Lax`, asi
que no se puede forzar el logout de un tercero con su sesion. Error de base → 503 `logout_failed` y la cookie
**no** se borra (no mentir que se cerro).

**`/enroll/<id>`, estado «Ya sos parte»:** titulo «Ya sos parte de <negocio>», debajo «Entraste como <firstName>»
(si el nombre esta vacio, no se muestra esa linea), «Ver mi tarjeta» como hoy, y un link «No soy yo» que reemplaza
el bloque por los botones de proveedor (mismo patron que `OneTapEnroll`). Un componente cliente nuevo
`MemberNotMe` en `enroll-buttons.tsx`.

**Configuracion (`settings-tab.tsx`):** al final, boton «Cerrar sesion». `POST /api/public/session/logout`; 204 →
`window.location.assign("/wallet")` (que sin sesion muestra los botones); otro status → aviso «No pudimos cerrar la
sesion. Probá de nuevo.» y no navega.

**Botones de proveedor (`provider-buttons.tsx`), dejan de usar el color del comercio:**
- **Google** (Sign in with Google branding guidelines, tema claro): fondo `#FFFFFF`, borde `1px solid #747775`,
  texto `#1F1F1F`, fuente `Roboto, system-ui` peso 500, el logo «G» oficial de 4 colores (`#4285F4`, `#34A853`,
  `#FBBC05`, `#EA4335`) en SVG inline de 20px a la izquierda, texto «Continuar con Google».
- **Apple** (Human Interface Guidelines, estilo negro): fondo `#000000`, texto `#FFFFFF`, fuente del sistema
  (`-apple-system, system-ui`) peso 500, el logo de Apple en SVG inline blanco a la izquierda, texto «Continuar con
  Apple».
- Los dos del **mismo alto (48px), ancho completo, radio 10px**, logo y texto centrados juntos. El orden por sistema
  (Apple primero en iOS) no cambia. La prop `primaryColor` se borra de `ProviderButtons` y de sus llamadores.

## Archivos

| Archivo | Accion |
|---|---|
| `packages/domain/src/server/consumer/session.ts` | editar (`revokeSession`) |
| `apps/consumer/src/app/api/public/session/logout/route.ts` | crear |
| `apps/consumer/src/app/(consumer)/provider-buttons.tsx` | editar |
| `apps/consumer/src/app/(consumer)/enroll/[programId]/enroll-buttons.tsx` | editar (`MemberNotMe`) |
| `apps/consumer/src/app/(consumer)/enroll/[programId]/page.tsx` | editar |
| `apps/consumer/src/app/(consumer)/wallet/settings-tab.tsx` (+ `wallet/page.tsx` si pasa props) | editar |
| tests: `session-logout-route.test.ts` (nuevo), `settings-tab.test.ts`, `provider-buttons.test.ts` (nuevo) | crear / editar |

**Disjunta?** Si: ninguna otra spec abierta toca estos archivos.

## Definition of Done

- [ ] Unit `session-logout-route.test.ts` (doble de `revokeSession`): con cookie → 204, `revokeSession` llamado con
      ese token, `Set-Cookie` con `Max-Age=0`; sin cookie → 204; `revokeSession` lanza → 503 y SIN `Set-Cookie`.
- [ ] Integracion (`tools/neon-test.sh --app consumer`, COMO el rol): tras `revokeSession(token)`,
      `resolveSession(token)` → `null` (caso nuevo en `consumer-role-auth.neon.integration.test.ts`).
- [ ] Render (`renderToStaticMarkup`): `ProviderButtons` contiene `#747775` y el path del logo G en el de Google, y
      `#000000` en el de Apple; no contiene ningun color de comercio. `SettingsTab` contiene «Cerrar sesión».
- [ ] `rg -n "primaryColor" "apps/consumer/src/app/(consumer)/provider-buttons.tsx"` → vacio.
- [ ] Gates de root con Node 24, una vez al final: `typecheck`, `lint`, `test`, `format:check`, `build`.
- [ ] `rg -n '\b(MUTATION|MUTACION)\b' apps/*/src packages/*/src` → vacio.

## Mutaciones — presupuesto: 2. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| 1 | `revokeSession` no escribe `revoked_at` (solo retorna) | integracion: `resolveSession(token)` despues del logout no es `null` |
| 2 | la ruta borra la cookie aunque `revokeSession` falle | unit: «`revokeSession` lanza → 503 y SIN `Set-Cookie`» |

**Protocolo:** el de la skill `protocolo-de-verificacion` (shasum, bitacora antes de medir, etiqueta, `diff`).

## Declarado AFUERA (sin oraculo, a proposito)

- **El icono instalado vuelve a abrir la sesion.** Su `start_url` es `/c/<web_view_token>` (ADR 0048), y ese link
  emite una sesion nueva. «Cerrar sesion» corta la del navegador; en la app instalada dura hasta que se la
  desinstale. Cortarlo exige rotar el token del pase (hallazgo #65), fuera de esta spec.
- La fidelidad visual exacta a las guias de Google/Apple: la verifica el owner en el telefono.

## Handoff

Implementa el orquestador (cambio chico, pedido del owner de ir rapido). **Revision liviana** por un revisor
independiente: lee el diff contra esta spec y re-ejecuta la mutacion 1; sin sondas extra.

## Abierto

Nada.
