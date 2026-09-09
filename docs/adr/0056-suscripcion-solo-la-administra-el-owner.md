---
adr: 0056
fecha: 2026-09-08
estado: aceptada
resumen: Checkout solo existe durante el onboarding, cuando aún no puede haber staff; no se agrega una restricción redundante. El aviso de staff desactivado se presenta como toast flotante y un reintento de credenciales lo reemplaza.
---

# 0056 — Checkout es parte del onboarding; el aviso es un toast

## Decisión

`POST /api/billing/checkout` solo se invoca desde el paso de plan del onboarding.
Antes de ese paso, `POST /api/onboarding/business` crea el negocio y su única
membresía, con `role='owner'`. El alta de staff vive después en `/backoffice/staff`,
que requiere un owner. No existe una UI de upgrade posterior ni una ruta desde la
consola de mostrador al onboarding, por lo que no hay un escenario de producto en el
que un staff pueda llegar a Checkout. No se agrega una restricción redundante a la
ruta para un flujo que no existe.

El aviso «Miembro del staff desactivado» pasa del formulario a un toast flotante
reutilizable. Conserva el único estado de error del login: al reintentar, primero
se limpia el toast anterior y el resultado de credenciales ocupa ese mismo estado;
nunca se apilan los dos avisos.

## Consecuencias

- No hay migración ni cambio de autorización en Stripe.
- El mensaje sigue siendo solo presentación; la autorización vive en el servidor.
- Los errores de contraseña también se muestran como toast mientras exista el
  formulario de login.
