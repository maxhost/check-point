---
spec: 0131
fecha: 2026-10-02
estado: cerrada
resumen: Dos suites Neon de servidor rojas en `main` por tests desactualizados: el doble de sesion de `marketing-backoffice-pages` describe una sesion imposible (sin `permissions`) y `marketing-push-enable` espera el voseo «necesitás».
disjunta: si
archivos: apps/merchant/src/server/marketing-backoffice-pages.neon.integration.test.ts, apps/merchant/src/server/marketing-push-enable.neon.integration.test.ts
---

# 0131 — Tests de servidor rojos en `main`

> Fase 3 del plan de alineacion (owner, 2026-10-02): dejar `main` verde. La parte de e2e la hace GPT aparte.

## Problema

- `marketing-backoffice-pages.neon.integration.test.ts:55-67` — `sessionFor` arma `membership: { role, status }` sin
  `permissions`. Desde `f61b163`, `apps/merchant/src/app/backoffice/marketing/page.tsx:9` lee
  `session.membership.permissions.includes("marketing")` → `TypeError: Cannot read properties of undefined (reading
  'includes')`: 7 rojos de 8 (reproducido 2026-10-02). En produccion `permissions` siempre existe
  (`apps/merchant/src/server/auth-guards.ts:62`, expandido por `permissionsForRole` en `session-view.ts:25`): el doble
  describe una sesion que la app no puede producir.
- `marketing-push-enable.neon.integration.test.ts:126-127` espera `"No se puede activar: necesitás un programa de
  fidelización con un premio."`; el codigo dice «necesitas» (`apps/merchant/src/server/marketing/template-store.ts:179`,
  tuteo de `4a69db7`, `apps/merchant/COPY.md`). 1 rojo de 5.

## Alcance

**Entra:** `sessionFor` gana `permissions: permissionsForRole("owner", <lo que pida la firma>)` importado de
`@mi-pasaporte/db/permissions-catalog` (la funcion real, no una lista a mano); el literal de `push-enable` pasa a
«necesitas».

**No entra:** la pagina, `template-store.ts`, los e2e (GPT), `marketing-valley` (PARQUEADO #67).

## Diseño

Arreglo del doble en la fuente (skill §2.0-bis: el default del seed es la forma de produccion). Si algun caso de la
suite necesita un integrante SIN `marketing`, se le pasa explicito; no se inventa en el default.

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/server/marketing-backoffice-pages.neon.integration.test.ts` | editar |
| `apps/merchant/src/server/marketing-push-enable.neon.integration.test.ts` | editar (1 literal) |

**Disjunta?** Si.

## Definition of Done

- [ ] `tools/neon-test.sh` sobre las dos suites, de a una → verdes. Nunca contra `DATABASE_URL`.
- [ ] Gates de root con Node 24, una vez al final: `typecheck`, `lint`, `test`, `format:check`, `build`.
- [ ] `rg -n MUTATION apps tools packages` → vacio.

## Mutaciones — presupuesto: 1. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| M1 | `apps/merchant/src/app/backoffice/marketing/page.tsx:9`: el guard `!…permissions.includes("marketing")` pasa a `false` (la pagina deja de exigir el permiso) | algun caso de `marketing-backoffice-pages` que pruebe el 404 sin permiso. **A medir:** si ningun caso lo prueba, se declara el hueco (no se escribe uno nuevo en esta spec) |

**Protocolo:** `shasum` limpio → fila de bitacora antes de medir → etiqueta `MUTATION` → medir y transcribir →
revertir con `diff` contra copia limpia. Leer la asercion del rojo.

## Declarado AFUERA

- Los e2e (52 + 3 rojos en `main`): los resuelve GPT.

## Handoff

UN implementador; revision liviana del orquestador.

## Abierto

Nada.
