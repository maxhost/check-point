# Encargo para GPT — 2026-10-13: pantallas de modulos (Fase 1 del plan de modulos)

Lo arma Claude. Decisiones del owner (2026-10-13): «todo debe seguir el mismo patron a futuro», las pantallas de modulo
las mueve GPT con encargo de Claude, cada modulo declara sus permisos (Stock y Recetas con permisos propios).

## 0. Antes de empezar

- Leer **`docs/MODULOS.md`** (como se trabaja) y `docs/adr/0139-contrato-completo-de-modulos.md`.
- Rama `dev`, commits chicos, sin push. Tu spec se numera desde **0217**.
- La parte de servidor ya esta en `dev` (`4e6973e`, spec 0216): despachadores, registros, `GET /api/modules` para
  cualquier integrante con `navigation` y `permissions`, helper `modules/navigation.ts`. Las URLs y los contratos de
  Stock y Recetas NO cambiaron.

## 1. Lo que hay que lograr

El core del panel no puede nombrar a Stock ni a Recetas. Lo vigila
`apps/merchant/src/modules/modules-boundary-literals.test.ts` (`PENDING_GPT`) y `modules-boundary.test.ts`
(`PENDING_GPT_DIRS`): hoy esas listas tienen la cuenta exacta de lo que falta. **Terminas cuando las dos quedan
vacias (`{}` y `[]`) y el test en verde.** Cada vez que saques un literal, el test se pone rojo hasta que bajes la
cuenta: es a proposito (trinquete).

### A. Mudar las pantallas

- `app/backoffice/stock/**` → `apps/merchant/src/modules/stock/ui/**`
- `app/backoffice/recipes/**` → `apps/merchant/src/modules/recipes/ui/**`
- Borrar las carpetas de `app/backoffice/stock` y `app/backoffice/recipes` (sin ellas, `/backoffice/stock` lo sirve el
  despachador `app/backoffice/[module]/[[...path]]/page.tsx`, que ya aplica sesion, modulo encendido y permiso).
- Actualizar `apps/merchant/src/modules/ui-registry.ts` para que apunte a las pantallas mudadas (es tu linea).
- Adentro de `modules/<id>/ui/` SI se puede nombrar el propio modulo (es el modulo).

### B. Menu desde los manifiestos

- `backoffice-navigation.tsx`: borrar las entradas fijas de Stock y Recetas. Las entradas de modulos salen de
  `moduleNavigation(modules, { isOwner, permissions })` (`modules/navigation.ts`) con lo que devuelve
  `GET /api/modules` (ahora lo puede leer cualquier integrante). `icon` llega como nombre (`"Package"`, `"Book"`):
  un mapa nombre → icono en el menu.
- `settings/module-navigation.ts`: `moduleLinkVisible` no puede comparar contra `"stock"`/`"recipes"`.

### C. Ajustes desde los manifiestos

- `settings/module-settings.tsx`: la lista de modulos sale entera de `GET /api/modules` (nombre, descripcion,
  `requires`, `suggested`), sin nombrar ninguno. Los mensajes de dependencia salen de `requires` y de los 409
  (`missing`, `dependents`).

### D. Permisos de modulo en Equipo

- El selector de permisos (`staff/staff-contract.ts`, `permission-picker.tsx`) muestra los permisos de modulo con el
  `label` y la `description` que trae `GET /api/modules` (`permissions`). Hoy `stock` y `recipes` se conservan al
  reenviar pero se ven como texto crudo. Solo se pueden otorgar con el modulo encendido (el servidor responde 422
  `module_disabled_permission` si no).

### E. e2e

Actualizar los e2e de Stock, Recetas, Ajustes y Equipo a las rutas y pantallas nuevas, sin aflojar aserciones.

## 2. Como se verifica

`pnpm --filter @mi-pasaporte/merchant exec vitest run src/modules/modules-boundary.test.ts
src/modules/modules-boundary-literals.test.ts` verde con las listas vacias, typecheck, lint, `node tools/ui-guard.ts
--base origin/main`, y tus e2e. Despues un revisor adversarial de Claude revisa las dos partes juntas.
