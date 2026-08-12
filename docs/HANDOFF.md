# Handoff — cierre de onboarding real / próxima fase Staff

**Fecha:** 2026-08-12
**Estado:** Spec 0022 cerrada y desplegada. Próximo arco: CRUD real de Staff.

## Cerrado

- Registro y login Owner con Better Auth autoalojado y Neon.
- Alta inicial transaccional de negocio, membresía `owner`, suscripción Free y local.
- Stripe Checkout Plus y webhook firmado/idempotente preparados para test/live.
- Selector de planes del onboarding: carrusel de una card, Plus mensual visible y activo por
  defecto, Free a la izquierda, flechas agrupadas arriba a la derecha y CTA dentro de la
  card activa.
- Dirección de local: Geoapify busca POI/dirección; Mapbox sólo toma relevo automático
  ante error técnico de Geoapify. Al elegir un resultado no se vuelve a buscar.
- Las direcciones canónicas excluyen el nombre del POI. Caso validado en Neon:
  `LaCraft` → `Rafael Torres Beltrán, 010204, Cuenca, Ecuador`,
  `-2.9125413, -78.9989325`, procedencia Geoapify conservada.

## Cambios recientes que deben estar desplegados

- `8a9c60a` — dirección canónica sin nombre del POI.
- `8272839` — carrusel de planes en onboarding.
- `7db67a2` — controles del carrusel sobre la card.
- El ajuste final de flechas agrupadas arriba a la derecha queda en el commit actual.

## Verificación realizada

- `pnpm format:check` — PASS
- `pnpm lint` — PASS
- `pnpm typecheck` — PASS
- `pnpm test` — PASS (15 pruebas)
- `pnpm --filter @mi-pasaporte/merchant build` — PASS con Node 24.19.0
- QA manual en Vercel: selección Geoapify de LaCraft y persistencia comprobada en Neon.

## Próximo arco: CRUD real de Staff

Crear una spec nueva para reemplazar el demo de Spec 0016. Debe partir de membresías y
autorización real: Owner crea/invita, define permisos, reenvía invitación/reset, archiva
sin borrar acceso histórico y elimina cuando corresponda. Mantener el patrón de UI y los
componentes existentes; no implementar hasta fijar el modelo de invitación, tokens,
expiración, roles/permisos, auditoría y email (Resend sigue pendiente de dominio).

## Seguridad a conservar

- Nunca conceder Plus desde `success_url`; sólo webhook Stripe firmado.
- Secretos sólo en Vercel/local, nunca navegador, commits ni logs.
- El usuario de sesión autoriza negocio, checkout y futuros cambios de Staff; no IDs de
  owner recibidos del navegador.
- Una ubicación sólo se crea desde selección verificada con coordenadas; mantener la
  procedencia en `location_verification`.
