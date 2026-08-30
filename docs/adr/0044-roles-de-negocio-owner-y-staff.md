---
adr: 0044
fecha: 2026-08-20
estado: aceptada
resumen: Modelo de roles a nivel negocio — owner (backoffice completo) y staff (solo mostrador), con acceso gateado por rol, desactivación por estado (sin borrar, preserva auditoría) y provisión vía better-auth.
---

# ADR 0044 — Roles de negocio: owner y staff

## Contexto

Hoy `business_membership.role` es texto libre con default `"owner"` y **sin enum/CHECK**;
en la práctica siempre vale `"owner"`. El mostrador (`server/counter/core.ts:operatorBusiness`)
**no filtra por rol** — acepta cualquier membership del negocio — mientras que marca, programa,
catálogo y analytics filtran `role="owner"` explícitamente. No existe identidad de **staff**
real: sólo comentarios "owner or staff" en el código y una UI **mock** (`app/backoffice/demo/staff`,
sessionStorage, sin backend). El owner necesita que su personal opere el mostrador (escanear +
acreditar puntos/sellos) **sin** darle acceso al resto del backoffice.

## Decisión

**Dos roles a nivel negocio**, sobre la `business_membership` existente:

- `owner` — acceso total al backoffice (marca, programa, catálogo, analytics, personal, mostrador).
- `staff` — **sólo** la pantalla de mostrador (historial del día + escanear/acreditar). Nada más.

Concreto:

1. **`business_membership.role`** gana un CHECK `in ('owner','staff')`. Sigue siendo el punto
   único de rol; no se agrega tabla nueva.
2. **`business_membership.status`** (`'active' | 'disabled'`, default `'active'`) para
   **desactivar sin borrar**: preserva la identidad y la auditoría (`order.operator_user_id`
   ya registra quién acreditó). Desactivar revoca las sesiones better-auth del staff.
3. **Provisión de staff vía better-auth**, nunca insert crudo en `merchant_auth.account`: el
   owner crea al staff con `signUpEmail` del server API (hash de contraseña correcto),
   **sin propagar la cookie de sesión devuelta** (la sesión del owner queda intacta), y luego
   inserta la membership `role='staff'` en su negocio. Un email = un usuario (staff en un solo
   negocio, MVP; sin invitación por email).
4. **Acceso gateado por rol** con un guard compartido: las páginas owner-only redirigen a un
   staff al mostrador (no a onboarding); un staff logueado aterriza en el mostrador; un staff
   `disabled` no puede operar.

El mostrador ya acepta cualquier membership → **funciona para staff sin tocar el dominio**; el
resto ya filtra `role="owner"` → **queda cerrado a staff por diseño**.

## Alternativas descartadas

- **Borrar la membership al desactivar** — pierde auditoría y deja re-onboardear; se prefiere
  un flag de estado.
- **Tabla `staff` separada** — redundante con `business_membership`; el rol ya vive ahí.
- **Roles de plataforma (`platform_admin`)** — fuera de alcance; eso es la spec 0001.
- **Invitación por email / SSO** — innecesario para el MVP; el owner tipea email+contraseña.

## Consecuencias

- Reusa el mostrador (0030) y better-auth (0022) tal cual; migración **aditiva** (una columna +
  dos CHECK).
- Supersede la parte de roles/staff del borrador **0005** y el mock `demo/staff`.
- Extensible a más roles a futuro agregando valores al CHECK y ramas de guard.
- El QA de anti-fuga debe cubrir que ningún DTO de "personal" serialice hash de contraseña ni
  token de sesión.
