---
spec: 0058
fecha: 2026-09-08
estado: cerrada
resumen: Se verifica y cierra como no aplicable el hallazgo de Checkout —solo existe durante onboarding, antes del alta de staff— y el rechazo de staff desactivado se muestra como toast flotante reutilizable, sin apilarse con el error de reintento.
disjunta: no
archivos: `src/app/onboarding/page.tsx` (evidencia), `src/app/api/onboarding/business/route.ts` (evidencia), `src/app/api/staff/route.ts` (evidencia), `src/app/login/login-form.tsx`, `src/app/login/login-form.test.ts`, `src/app/login/login-form-retry.test.ts`
---

# 0058 — Cierre de Checkout y toast del login

## Problema

Se señaló que el endpoint de Checkout no comprueba rol/estado de la membresía. La
trazabilidad del flujo demuestra que solo se invoca durante onboarding: el negocio se
crea con su owner inmediatamente antes y el staff se crea posteriormente desde una
pantalla exclusiva del owner. No hay upgrade posterior. El aviso pedido para el staff
desactivado sí quedó inline, no como toast.

## Alcance

**Entra:** verificar y cerrar el supuesto de Checkout; presentar flotante el aviso/error del login.

**No entra:** cambiar precios, webhooks, planes, el flujo de onboarding, ni bloquear el login dentro de better-auth.

## Diseño

La evidencia de alcance se conserva en el código existente: `OnboardingPage` llama a
Checkout solo después de recibir `businessId`; la ruta de creación inserta en la misma
operación la membresía `role='owner'`; `POST /api/staff` requiere owner y solo entonces
crea una membresía `role='staff'`. No se modifica Checkout.

`LoginForm` entrega su estado único `error` al componente `Toast` con `kind="error"`.
Al comenzar un reintento lo limpia y, si better-auth responde error, lo reemplaza. El
toast se autocierra según su comportamiento reutilizable existente.

### Arquitectura de referencia

- ADR 0044 — roles y estado de membresías.
- ADR 0055 — el motivo seguro del rechazo post-login.
- ADR 0056 — decisión de esta agrupación.

## Archivos

| Archivo | Acción |
|---|---|
| `src/app/onboarding/page.tsx` | revisar — único llamador de Checkout |
| `src/app/api/onboarding/business/route.ts` | revisar — crea la membresía owner antes de Checkout |
| `src/app/api/staff/route.ts` | revisar — el alta de staff exige owner |
| `src/app/login/login-form.tsx` | editar para reutilizar `Toast` |
| `src/app/login/login-form.test.ts` | ajustar el render del toast |
| `src/app/login/login-form-retry.test.ts` | ajustar el probe del reemplazo |

### Disjunta?

**No.** Comparte `login-form.tsx` con la spec 0057 ya implementada; se serializa como una enmienda de aquella.

## Definition of Done

- [ ] Se verifica que Checkout no tiene superficie de upgrade y que staff nace después del onboarding; no se modifica la ruta por un caso no alcanzable desde producto.
- [ ] El aviso de staff desactivado y el error de credenciales se renderizan como toast de error.
- [ ] Un reintento reemplaza el aviso previo; no hay dos mensajes simultáneos.
- [ ] `typecheck`, `lint`, `test`, `format:check` y `build` pasan.

## Plan de pruebas y verificación

- [ ] Trazabilidad estática: `rg` confirma un único llamador de Checkout (`OnboardingPage`), creación de `role='owner'` antes de ese paso y alta de staff detrás de `requireOwner`.
- [ ] Render estático: el aviso aparece en `.toast.error`, con `role="status"`.
- [ ] Probe de reintento: el mismo prop `message` de `Toast` cambia del aviso al error de credenciales.
- [ ] Ejecutar `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check` y `pnpm build`.

## Abierto

Nada. La solicitud del owner cierra tanto la autorización como la preferencia visual.
