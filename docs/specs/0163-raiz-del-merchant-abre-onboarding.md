---
spec: 0163
fecha: 2026-10-05
estado: cerrada
resumen: La raíz del merchant envía al onboarding a quien no tiene sesión.
disjunta: si
archivos: apps/merchant/src/app/page.tsx, tests/e2e/merchant-entry.spec.ts
---

# 0163 — La raíz del merchant abre onboarding sin sesión

## Problema

- `apps/merchant/src/app/page.tsx:7` todavía muestra una portada estática a quien abre `business.checkpass.club/`; no permite empezar el alta.
- `apps/merchant/src/server/auth-guards.ts:113` y `:136` rebotan a `/` cuando una sesión no puede entrar al backoffice. Una redirección indiscriminada desde `/` puede producir un ciclo con el onboarding, que envía al panel a las sesiones con negocio.

## Alcance

**Entra:** al solicitar `GET /` sin sesión merchant, redirigir en el servidor a `/es/business/onboarding`; verificar el destino desde un navegador sin cookies.

**No entra:** cambiar las rutas del guard, el flujo del wizard, el destino de una sesión existente o los códigos de error en `/?e=…`.

## Diseño

La página raíz consulta `getMerchantAuth().api.getSession` con los headers de la solicitud, como el guard existente. Si el resultado es `null`, ejecuta `redirect("/es/business/onboarding")`. Si existe sesión, conserva la portada actual para evitar el ciclo del guard. La consulta es dinámica por usar `headers()`; no se comparte el resultado entre usuarios. Los errores del proveedor de sesión siguen el manejo normal de Next, sin tratarse como ausencia de sesión.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/app/page.tsx` | editar |
| `tests/e2e/merchant-entry.spec.ts` | crear |

**Disjunta?** Sí: no comparte archivos con las specs abiertas conocidas.

## Definition of Done

- [ ] En contexto limpio, `GET /` termina en `/es/business/onboarding` y muestra el wizard.
- [ ] La raíz no redirige a `/backoffice` cuando hay sesión; se conserva el rebote del guard.
- [ ] `pnpm exec playwright test tests/e2e/merchant-entry.spec.ts` pasa con Node 24.
- [ ] `pnpm verify` en verde con Node 24, una vez al final, con tabla de gates registrada.
- [ ] `rg -n MUTATION apps/merchant/src/app/page.tsx tests/e2e/merchant-entry.spec.ts` no devuelve resultados.

## Mutaciones — presupuesto: 1. Clase: los plausibles

| # | Mutación | Oráculo que tiene que ponerse ROJO |
|---|---|---|
| 1 | Cambiar el destino a `/backoffice` | El e2e exige la URL exacta de onboarding. |

**Protocolo:** hash limpio antes de mutar, fila de bitácora antes de medir, etiqueta `MUTATION`, salida real, restauración y `diff` vacío.

## Declarado AFUERA (sin oráculo, a propósito)

- El caso de sesión activa no se automatiza aquí: requiere identidad de prueba y está cubierto por el guard existente; esta spec conserva su rama sin cambios de destino.

## Handoff

Implementador: GPT. Revisor independiente: pendiente después de la implementación. `implementada` exige PASS y verificación real.

## Abierto

Nada.
