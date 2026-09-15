---
spec: 0058
fecha: 2026-09-08
estado: implementada; su PREMISA sobre Checkout caduco (ver Cierre)
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

- [x] Se verifico en su momento; **esta premisa YA NO VALE y el riesgo lo cerro la spec 0063** (ver Cierre).
- [x] El aviso de staff desactivado y el error de credenciales se renderizan como toast de error — `login-notice.test.ts` (13 tests).
- [x] Un reintento reemplaza el aviso previo; no hay dos mensajes simultáneos — `login-form-retry.test.ts`.
- [x] `typecheck`, `lint`, `test`, `format:check` y `build` pasan (suite completa verde al 2026-09-15).

## Plan de pruebas y verificación

- [x] Trazabilidad estática — **RE-CORRIDA EL 2026-09-15 Y YA NO DA LO MISMO: hay DOS llamadores** (ver Cierre).
- [x] Render estático: el aviso aparece en `.toast.error`, con `role="status"`.
- [x] Probe de reintento: el mismo prop `message` de `Toast` cambia del aviso al error de credenciales.
- [x] Ejecutado: 17/17 verdes en `src/app/login`, y la suite completa en verde.

## Abierto

Nada. La solicitud del owner cierra tanto la autorización como la preferencia visual.


## Cierre (2026-09-15) — implementada, PERO con una premisa que caduco

Marcada `implementada` **por decision del owner** («ya estan corriendo»). El toast y el aviso del login
tienen **17 tests verdes** en `src/app/login` (`login-notice` 13, `login-form` 3, `login-form-retry` 1),
corridos al marcar: esa mitad de la spec esta pinneada de verdad.

**LO QUE HAY QUE SABER ANTES DE CITAR ESTA SPEC — su premisa central YA NO ES CIERTA.** Esta spec cerro
el hallazgo de Checkout como «no aplicable» con este argumento: *«solo existe durante onboarding»*, *«un
unico llamador (`OnboardingPage`)»*, *«un caso no alcanzable desde producto»*. **Re-corrida la
trazabilidad hoy, hay DOS llamadores:**

- `app/onboarding/page.tsx:158` (el original), y
- `app/backoffice/subscription/subscription-console.tsx:246` — **la seccion de suscripcion, que creo la
  spec 0063**. O sea que **la superficie de upgrade posterior SI existe** desde entonces.

**El riesgo NO quedo abierto: lo cerro la propia 0063**, que puso `requireBillingOwner` en
`checkout/route.ts:41` y lo pinneo en `billing-routes-auth.neon.integration.test.ts` (staff activo,
staff desactivado y owner desactivado reciben 403 en las rutas de billing, checkout incluido).

**La leccion, que es la de `CLAUDE.md` sobre residuales heredados, del lado del que ESCRIBE:** cerrar un
hallazgo como «no alcanzable» ata la spec a una foto del producto, y el producto sigue. Lo que la salvo
no fue este documento —que quedo afirmando algo falso— sino que **otra spec puso el guard igual**. Si
hubiera dependido de esta frase, hoy habria un agujero.
