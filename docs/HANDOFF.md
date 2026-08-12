# Handoff — Spec 0022

**Fecha:** 2026-08-11
**Estado:** Neon listo; implementación sin revisión independiente ni despliegue.

## Implementado

- `apps/merchant` usa Better Auth autoalojado con email/contraseña, handler
  `/api/auth/[...all]`, cliente de sesión, login, logout y protección server-side de
  `/backoffice`.
- Drizzle/Neon modela `merchant_auth` y `core`; las migraciones versionadas bajo
  `apps/merchant/drizzle/` ya fueron aplicadas y registradas en el proyecto Neon
  `mi-pasaporte` (branch `main`, base `neondb`).
- El onboarding real crea la cuenta antes del pago, crea negocio + membresía owner +
  primer local Free de manera agrupada y exige una dirección seleccionada por Mapbox.
- Plus crea una Stripe Checkout Session en servidor; el webhook firmado, idempotente,
  es quien actualiza la suscripción local. El redirect no autoriza Plus.
- Mapbox limita inicialmente a `EC, AR, CL, PY, UY, PE, CO, MX, BR`.
- R2 y Resend quedan declarados como configuración futura, sin rutas activas ni secretos.

## Pendiente antes de declarar la feature implementada

1. Configurar en Vercel los secretos listados en `.env.example`, crear Price IDs test de
   Stripe y un token público Mapbox con origen restringido.
3. Probar registro → Free → negocio/local → backoffice contra Neon; luego Plus con
   Stripe CLI/webhook test. No usar claves reales en chat ni repositorio.
4. Terminar R2 (logo) y Resend (verificación) cuando existan bucket/dominio, como decidió
   producto; no se simulan.
5. Añadir pruebas de integración contra una rama Neon efímera y fixture Stripe, E2E del
   flujo real y revisión independiente según `docs/AGENT-WORKFLOW.md`.

## Gates ejecutados

- `pnpm format:check` — PASS
- `pnpm lint` — PASS
- `pnpm typecheck` — PASS
- `pnpm test` — PASS, 9 pruebas
- `pnpm build` con Node 24.19.0 — PASS, las tres aplicaciones.

## Seguridad que no se debe relajar

- Secretos sólo en gestor de secretos local/Vercel; configuración no secreta auditada en
  DB según ADR 0024.
- No otorgar Plus por `success_url`; sólo por webhook Stripe firmado.
- No aceptar dirección manual: persistir únicamente una selección Mapbox verificable.
- El usuario de sesión, no IDs recibidos del navegador, autoriza negocio y checkout.
