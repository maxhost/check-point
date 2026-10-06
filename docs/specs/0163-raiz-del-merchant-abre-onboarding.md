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

La página raíz lee `headers()` y redirige inmediatamente cuando `getSessionCookie` de Better Auth no encuentra una cookie de sesión. Otras cookies del navegador no provocan consultas a Auth o a la base de datos. Cuando sí hay cookie de sesión, consulta `getMerchantAuth().api.getSession` con los mismos headers, como el guard existente. Si el resultado es `null`, ejecuta `redirect("/es/business/onboarding")`. Si existe sesión, conserva la portada actual para evitar el ciclo del guard. La consulta es dinámica por usar `headers()`; no se comparte el resultado entre usuarios. Los errores del proveedor de sesión siguen el manejo normal de Next, sin tratarse como ausencia de sesión. El e2e intercepta solo las respuestas de estado y prefill del wizard, que pertenecen a otro contrato y no requieren base de datos para comprobar la entrada.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/app/page.tsx` | editar |
| `tests/e2e/merchant-entry.spec.ts` | crear |

**Disjunta?** Sí: no comparte archivos con las specs abiertas conocidas.

## Definition of Done

- [x] En contexto limpio, `GET /` termina en `/es/business/onboarding` y muestra el wizard.
- [ ] La raíz no redirige a `/backoffice` cuando hay sesión; se conserva el rebote del guard.
- [x] `pnpm exec playwright test tests/e2e/merchant-entry.spec.ts` pasa con Node 24.
- [x] `pnpm verify` en verde con Node 24, una vez al final, con tabla de gates registrada.
- [x] `rg -n MUTATION apps/merchant/src/app/page.tsx tests/e2e/merchant-entry.spec.ts` no devuelve resultados.

`pnpm verify` final (Node 24.20.0):

| Gate | Resultado |
|---|---|
| typecheck | ok |
| lint | ok |
| format:check | ok |
| test | ok |
| build | ok |
| test:e2e | ok; 179 pasan, 21 omitidos |
| neon related merchant | ok; sin tests relacionados |
| neon related consumer | omitido; sin cambios consumer |

## Mutaciones — presupuesto: 1. Clase: los plausibles

| # | Mutación | Oráculo que tiene que ponerse ROJO |
|---|---|---|
| 1 | Cambiar el destino a `/backoffice` | El e2e exige la URL exacta de onboarding. |

**Protocolo:** hash limpio antes de mutar, fila de bitácora antes de medir, etiqueta `MUTATION`, salida real, restauración y `diff` vacío.

**Bitácora M1, antes de medir:** SHA-1 limpio `2d59db5c26bf1e0ba611564b9fafb88a09285b98`. Cambiar el primer destino a `/backoffice`; se espera rojo en `toHaveURL` por recibir el rebote del guard o un error de sesión en vez del onboarding. Después, restaurar la copia limpia y comparar hashes.

**Resultado M1:** `pnpm exec playwright test tests/e2e/merchant-entry.spec.ts` salió `1 failed`. Oráculo: `Expected .../es/business/onboarding`, `Received .../backoffice` en `merchant-entry.spec.ts:15`; el error de Better Auth del panel fue secundario. Restauración: SHA-1 `2d59db5c26bf1e0ba611564b9fafb88a09285b98`, `diff -u` vacío, `rg -n MUTATION` sobre código y test vacío.

## Declarado AFUERA (sin oráculo, a propósito)

- El caso de sesión activa no se automatiza aquí: requiere identidad de prueba y está cubierto por el guard existente; esta spec conserva su rama sin cambios de destino.

## Handoff

Implementador: GPT. [Handoff con evidencia](../handoff-0163-entrada-merchant-2026-10-05.md). Revisor independiente: pendiente después de la implementación. `implementada` exige PASS y verificación real.

## Abierto

Nada.
