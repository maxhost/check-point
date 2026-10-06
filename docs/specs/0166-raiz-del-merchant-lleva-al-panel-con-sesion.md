---
spec: 0166
fecha: 2026-10-06
estado: implementada
resumen: La raíz del merchant manda al panel a una sesión válida sin `?e=`, y el guard cierra la sesión sin negocio para que no haya ciclo.
disjunta: no
archivos: apps/merchant/src/app/page.tsx, apps/merchant/src/server/auth-guards.ts, apps/merchant/src/server/auth-guards.test.ts, apps/merchant/src/app/page.neon.integration.test.ts, docs/specs/0067-contratos-de-api.md
---

# 0166 — Con sesión, la raíz del merchant lleva al panel

Nivel N2 (toca el guard de sesiones). Implementa Claude (servidor, ADR 0114).

## Problema

- Un dueño con sesión y negocio que abre `business.checkpass.club/` ve la portada estática de la 0163, sin ningún
  enlace al panel (`apps/merchant/src/app/page.tsx:19`). **Decisión del owner (2026-10-06):** «si el negocio entra con
  sesión activa a business.checkpass.club debe ser redirigido al dashboard».
- La 0163 dejó la portada con sesión a propósito: los rebotes del guard (`auth-guards.ts`) apuntan a `/`. Medido en
  el árbol: tres rebotes llegan a `/` con la sesión VIVA, y una redirección indiscriminada a `/backoffice` cerraría un
  ciclo `/` ↔ `/backoffice`:
  - `:136` `!row` (sesión sin membresía) → `/`, sin revocar;
  - `:166` negocio `closed` → `/?e=business_closed`, sin revocar;
  - `:182` integrante de negocio no-`active` → `/?e=business_suspended`, sin revocar.
  `:152` (`staff_disabled`) ya revoca antes de redirigir, y `setStaffStatus` (`staff.ts:258`) revoca al desactivar.
- Además, `magic-link/route.ts:12` rebota a `/?e=magic_link_invalid`, que puede llegar con una sesión vieja viva.

**Sesión sin negocio:** hoy no se puede crear (`createOwnerWithBusiness` crea cuenta y negocio en un `db.batch`;
medido en PROD el 2026-10-06: 15 usuarios, 15 membresías, 0 sin membresía). Criterio del owner (2026-10-06): un
acceso que no corresponde cierra su sesión directamente. El `!row` pasa a revocar, igual que `staff_disabled`.

## Alcance

**Entra:**
- `page.tsx`: con `?e=` presente (cualquier valor no vacío) **nunca** redirige, con o sin sesión: renderiza la portada
  actual. Sin `?e=`: sin cookie o sesión inválida → `/es/business/onboarding` (como hoy); sesión válida → `/backoffice`.
- `auth-guards.ts:136`: `!row` revoca las sesiones del usuario (el mismo `DELETE` que `:151`) y después
  `redirect("/")`.
- Tests: unitario del guard (`!row` revoca) y el de Neon de la raíz al comportamiento nuevo, con el caso anti-ciclo.
- `0067-contratos-de-api.md` §Códigos de rebote: una línea con el comportamiento de la raíz.

**No entra:**
- Lo que la portada MUESTRA con `?e=` (el motivo y su botón): spec de UI de GPT, posterior y serializada con esta.
- Revocar sesiones en `closed`/`suspended`: el `?e=` ya corta el ciclo, y el owner de un negocio suspendido tiene que
  poder entrar.
- `restoredStage` del wizard y el flujo del alta.

## Diseño

### Especificación técnica

`page.tsx` recibe `searchParams` (Next 16: `Promise<Record<string, string | string[] | undefined>>`). Orden:

1. `e` = `searchParams.e`; si es string no vacío (o array con algún elemento no vacío) → `return` la portada. Sin
   tocar Auth. `?e=` vacío cuenta como ausente.
2. Sin cookie de sesión (`getSessionCookie`) → `redirect("/es/business/onboarding")`.
3. `getSession` con los headers; `null` → `redirect("/es/business/onboarding")`.
4. Sesión válida → `redirect("/backoffice")`.

La página no consulta membresía ni negocio: eso lo decide el guard de `/backoffice`. El ciclo queda cerrado porque
todo rebote del guard a `/` **sin** `?e=` sale sin sesión (`:113` no la tenía; `:136` la revoca), y todo rebote **con**
`?e=` cae en el paso 1.

Guard `:136`: `if (!row) { await getDb().delete(sessions).where(eq(sessions.userId, session.user.id)); redirect("/"); }`
— el `await` antes del `redirect` (que lanza), mismo motivo que `:149`.

### Arquitectura de referencia

ADR 0055 (revocación por `DELETE` de sesiones, sin mecanismo nuevo), spec 0067 §7 (los rebotes van a `/`),
spec 0072 §D4 y 0086 §8 (códigos `closed`/`suspended`), spec 0163.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/app/page.tsx` | editar |
| `apps/merchant/src/server/auth-guards.ts` | editar (`:136` y su docblock) |
| `apps/merchant/src/server/auth-guards.test.ts` | editar (caso `no membership` revoca) |
| `apps/merchant/src/app/page.neon.integration.test.ts` | editar (comportamiento nuevo + anti-ciclo) |
| `docs/specs/0067-contratos-de-api.md` | editar (una línea) |

### Disjunta?

**No** con la futura spec de UI de GPT del motivo de `?e=` (mismo `page.tsx`): esta va primero.

## Definition of Done

- [ ] Sin `?e=`: sin cookie → onboarding; cookie basura → onboarding; sesión válida con negocio → `/backoffice`.
- [ ] Con `?e=<x>`: portada, con y sin sesión (sin redirect).
- [ ] Anti-ciclo, compuesto con el guard real y la misma cookie en Neon: para cada rebote del guard (sin membresía,
  `closed`, integrante de `suspended`), el destino que devuelve el guard, pasado a la página, NO es `/backoffice`.
- [ ] `!row` revoca las sesiones del usuario antes de redirigir (unitario: un `DELETE` sobre `sessions` con su id).
- [ ] `rg -n MUTATION apps/merchant/src` vacío.
- [ ] `pnpm verify` en verde con Node 24, tabla transcripta.

## Plan de pruebas y verificación

- Unitario `auth-guards.test.ts`, caso `session but no membership`: destino `/` **y** `deletes` con un `DELETE` de
  `sessions` y `params` `["u1"]` (mismo patrón que el caso `disabled membership`).
- Neon `page.neon.integration.test.ts` (`tools/neon-test.sh src/app/page.neon.integration.test.ts`): la página se llama
  con `{ searchParams: Promise.resolve({...}) }`. Casos: los de DoD 1–2; anti-ciclo para los tres rebotes (sembrar un
  negocio `closed`, uno `suspended` con un integrante no-owner, y un usuario sin membresía): `requireBackofficeSession()`
  da `redirect:<dest>` y `landing(cookie, dest)` ≠ `redirect:/backoffice`. Para `!row`, además: la sesión ya no existe
  (`select` de `sessions` por `user_id` vacío) y la página manda a onboarding.
- Comandos: `pnpm exec vitest run apps/merchant/src/server/auth-guards.test.ts`; la suite Neon de arriba; `pnpm verify`.
- Manual (owner, después del deploy): logueado como dueño, abrir `business.checkpass.club/` → panel. Sin sesión →
  alta.

### Mutaciones — presupuesto 3, clase: los plausibles

| # | Mutación | Mecanismo (archivo:línea) | Oráculo que tiene que ponerse ROJO |
|---|---|---|---|
| M1 | Quitar el paso 1 (`?e=`) | `page.tsx`, chequeo de `e` | Neon anti-ciclo `closed`/`suspended`: recibe `redirect:/backoffice` |
| M2 | Quitar el `DELETE` del `!row` | `auth-guards.ts:136` | unitario `deletes` vacío; Neon anti-ciclo `!row`: `redirect:/backoffice` |
| M3 | Sesión válida → portada (quitar el paso 4) | `page.tsx` | Neon «sesión válida con negocio»: recibe `portada` |

Guard hermano: ninguno; la raíz es la única que decide el destino de `/`. El e2e `merchant-entry.spec.ts` solo cubre
sin cookie y no ve M1–M3 (medido en la revisión de la 0163).

## Handoff requerido

Implementador y revisor con el formato de `docs/AGENT-WORKFLOW.md`. `implementada` exige PASS independiente.

**Resultado (2026-10-06).** Implementación `2e45d0f` (`pnpm verify` ok con Node 24; M1–M3 rojas por la propiedad).
Revisor independiente: **PASS**; barrió todos los `redirect` a `/` del merchant: los que llegan sin `?e=` salen sin
sesión (`!session`) o la revocan (`!row`). Sus mutaciones: R1 (`DELETE` después del `redirect`) y R3 (`?e=` después de
Auth) rojas; R2 (`?e=` vacío como presente) quedó verde. El orquestador agregó el caso `?e=` vacío → panel en la suite
Neon y midió R2: `expected 'portada' to be 'redirect:/backoffice'`, revertida con `shasum` idéntico. También corrigió
el comentario vencido de `magic-link/route.ts` («owner sin negocio entra normal») y alineó el paso 1 con el código
(array con algún elemento **no vacío**). Sin oráculo, declarado: cómo llega `searchParams` en Next 16 en el dominio
real (QA del owner).

## Abierto

Nada.
