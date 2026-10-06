---
spec: 0165
fecha: 2026-10-05
estado: cerrada
resumen: ADR 0125. Todo `/api/catalog/*` (import con IA incluido) pasa a `requireApiPermissionSinGateDeEmail(…, "catalog")`; los borrados duros de producto/categoria y `DELETE`/`PATCH cancel-close` de `/api/loyalty-program` pasan a `requireApiOwnerSinGateDeEmail` (siguen solo del owner). Inventario cerrado de exenciones actualizado y oraculos contra Neon con owner sin verificar.
disjunta: si
archivos: apps/merchant/src/app/api/catalog/_auth.ts, apps/merchant/src/app/api/catalog/imports/_auth.ts, apps/merchant/src/app/api/loyalty-program/route.ts, apps/merchant/src/server/api-owner.ts, apps/merchant/src/server/api-permission.ts, apps/merchant/src/server/api-owner-surfaces.test.ts, apps/merchant/src/server/api-owner-surfaces-support.ts, apps/merchant/src/server/api-owner-surfaces-desenlaces.ts, apps/merchant/src/server/api-permission-surfaces.test.ts, apps/merchant/src/server/loyalty-program-sin-email.neon.integration.test.ts, apps/merchant/src/server/catalog-sin-email.neon.integration.test.ts, docs/adr/0125-catalogo-y-ciclo-del-programa-sin-email-verificado.md, docs/INDEX.md
---

# 0165 — Catalogo y ciclo completo del programa sin email verificado

> **N2** (auth: cambia que caller pasa el guard). Un implementador, un revisor. Decisiones del owner en el ADR 0125
> (2026-10-05), tomadas ANTES de esta spec. Trabajo en el worktree `check-point-wt/sin-gate-email` (GPT commitea la
> Fase 1 en local sobre `main` sin pushear: este cambio sale solo).

## Problema

- Un owner con el email sin verificar recibe `403 email_not_verified` en todo `/api/catalog/*`: `requireOwner`
  (`api/catalog/_auth.ts:31`) e `requireImportAccess` (`api/catalog/imports/_auth.ts:26`) usan `requireApiPermission`,
  cuyo paso 4 lo exige al owner (`server/api-permission.ts:104`). Los borrados duros usan `requireCatalogOwner` →
  `requireApiOwner` (`api/catalog/_auth.ts:59`, paso 3 en `server/api-owner.ts:101`).
- Retirar el programa y cancelar el retiro: `requireApiOwner` (`api/loyalty-program/route.ts:147` y `:172`). Lo fija
  hoy `loyalty-program-sin-email.neon.integration.test.ts:152` («RETIRAR sigue exigiendo email verificado»).
- Las pantallas no traban nada (`rg emailVerified apps/merchant/src/app --glob '!app/api/**'`: solo el checklist y el
  wizard, que piden verificar, no bloquean). El import con IA no manda emails.

## Alcance

**Entra:**

1. `requireOwner` y `requireImportAccess` → `requireApiPermissionSinGateDeEmail(request, "catalog", …)`, con los mismos
   mensajes de `missingPermission`/`notMember` que hoy (se borra el `emailNotVerified` de catalogo: el tipo de la
   hermana no lo acepta).
2. `requireCatalogOwner` → `requireApiOwnerSinGateDeEmail(request, { notOwner })` con el mismo `notOwner`.
3. `DELETE` y `PATCH` de `api/loyalty-program/route.ts` → `requireApiOwnerSinGateDeEmail(request, { notOwner })`
   (`OWNER_MESSAGES.notOwner`).
4. Docblocks de `requireApiOwnerSinGateDeEmail` y `requireApiPermissionSinGateDeEmail` (y el de `requireOwner`/
   `requireCatalogOwner`): el inventario y el motivo nuevos, con el ADR 0125. Sin cambiar el cuerpo de
   `requireApiOwner`, `requireApiPermission` ni las dos hermanas.
5. Tests: el inventario cerrado y los oraculos de abajo.

**No entra:** staff, locales, marca, campañas, billing, superficies de la cuenta (conservan el gate); el mostrador
(`api/counter/_auth.ts:92`, guard propio); cambiar copy de UI (`email_not_verified` en pantallas de catalogo queda
como texto muerto: zona GPT, va en el handoff); cupos nuevos para la IA (riesgo aceptado, ADR 0125); migraciones.

## Diseño

### Especificación técnica

Contrato HTTP: **no cambia ninguna forma de respuesta.** Lo unico que cambia es que, para un owner con
`emailVerified = false`, estas entradas ya no devuelven `403 email_not_verified` y siguen al dominio como con un owner
verificado (mismos 200/201/4xx del dominio):

| Entrada | Guard nuevo | Quien pasa (ademas de sesion y comercio operativo) |
|---|---|---|
| `GET /api/catalog`, `POST /api/catalog/product`, `PUT /api/catalog/product/:id`, `POST /api/catalog/product/image-upload`, `POST /api/catalog/category`, `PUT /api/catalog/category/:id`, `GET /api/catalog/stock/search` | `requireApiPermissionSinGateDeEmail("catalog")` | owner, o staff con `catalog` |
| `POST`/`GET /api/catalog/imports`, `GET`/`DELETE /api/catalog/imports/:id`, `POST …/:id/uploads`, `POST …/:id/analyze` | idem | idem |
| `DELETE /api/catalog/product/:id`, `DELETE /api/catalog/category/:id` | `requireApiOwnerSinGateDeEmail` | solo owner (`403 not_owner` al staff, como hoy) |
| `DELETE /api/loyalty-program`, `PATCH /api/loyalty-program` (`cancel-close`) | `requireApiOwnerSinGateDeEmail` | solo owner |

Errores que se conservan, todos ya existentes: `401 unauthorized`; `403 not_member`/`missing_permission` (catalogo) o
`not_owner` (borrados y programa); `403 business_suspended`/`business_closed`. **Ninguna de estas entradas devuelve
`email_not_verified` despues de esta spec.** Aislamiento entre comercios: sin cambio (el comercio sale de la sesion via
`membershipContext`/`ownerContext`, nunca del request).

**Inventario cerrado:** `rg -l 'SinGateDeEmail' apps/merchant/src/app/api | sort` pasa de 5 a exactamente 7 archivos:
los 5 de hoy (`loyalty-program/qr`, `loyalty-program/route.ts`, `loyalty-program/stamp-upload`,
`loyalty-terms/templates`, `onboarding/checklist`) + `catalog/_auth.ts` y `catalog/imports/_auth.ts`. En la
matriz de `api-owner-surfaces-support.ts`, la fila `catalog` pasa a `SURFACES_SIN_GATE_DE_EMAIL` (de 6 a 7; con gate de
9 a 8) con su desenlace positivo en `DESENLACE_SIN_GATE` (owner sin verificar → `200`); el `toEqual` del conjunto exacto
se reescribe con la lista nueva y su comentario suma «la 0165 (ADR 0125) SIETE».

### Arquitectura de referencia

ADR 0122 / spec 0156 C hicieron lo mismo con el programa: misma hermana, mismo patron de oraculo contra Neon
(`unverified-owner-support.ts`: `seedUnverifiedOwner` nace como nace un alta real, `emailVerified: false`).

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/app/api/catalog/_auth.ts`, `catalog/imports/_auth.ts` | editar (guards y docblocks) |
| `apps/merchant/src/app/api/loyalty-program/route.ts` | editar (`DELETE`, `PATCH`) |
| `apps/merchant/src/server/api-owner.ts`, `api-permission.ts` | editar SOLO docblocks del inventario |
| `apps/merchant/src/server/api-owner-surfaces*.ts`, `api-permission-surfaces.test.ts` | editar (inventario, fila `catalog`) |
| `apps/merchant/src/server/loyalty-program-sin-email.neon.integration.test.ts` | editar: el caso de `DELETE` se invierte (ver plan) y se suma `PATCH` |
| `apps/merchant/src/server/catalog-sin-email.neon.integration.test.ts` | crear |
| `docs/INDEX.md` | filas ADR 0125 y spec 0165 |

### Disjunta?

Si. GPT trabaja en `apps/merchant/src/app/**` fuera de `api/` y en `tests/e2e/**`; esto es `app/api/**` y `server/**`.

### Archivos compartidos

Ninguno con trabajo en curso.

## Definition of Done

- [ ] `rg -l 'SinGateDeEmail' apps/merchant/src/app/api | sort` → exactamente los 7 archivos de §Inventario.
- [ ] `rg -n 'await requireApiOwner\(|await requireApiPermission\(' apps/merchant/src/app/api/catalog apps/merchant/src/app/api/loyalty-program`
      → vacio (hoy da 5: `catalog/_auth.ts:31,59`, `imports/_auth.ts:26`, `loyalty-program/route.ts:147,172`).
- [ ] `git diff origin/main -- apps/merchant/src/server/api-owner.ts apps/merchant/src/server/api-permission.ts` →
      solo lineas de comentario.
- [ ] `pnpm exec vitest run apps/merchant/src/server/api-owner-surfaces.test.ts apps/merchant/src/server/api-permission-surfaces.test.ts` verde.
- [ ] `tools/neon-test.sh src/server/catalog-sin-email.neon.integration.test.ts`,
      `…/loyalty-program-sin-email.neon.integration.test.ts` y `…/permisos-delegados.neon.integration.test.ts` verdes.
- [ ] `pnpm verify` en verde con Node 24, una sola vez al final, tabla transcripta (un rojo SOLO por PARQUEADO #74 se
      declara con la corrida suelta del archivo).
- [ ] `rg -n MUTATION apps packages tools` → vacio.

## Plan de pruebas y verificación

Neon, con `seedUnverifiedOwner` (owner real, `emailVerified: false`, comercio operativo) y las rutas llamadas como
handlers (patron de `loyalty-program-sin-email`):

1. **`catalog-sin-email.neon.integration.test.ts` (nuevo):** owner sin verificar → `POST category` 201 → `POST
   product` 201 → `PUT product/:id` 200 con el nombre nuevo leido por SQL → `GET /api/catalog` 200 que lo lista →
   `GET stock/search` 200 → `POST imports` 201 y `GET imports` 200 que lo lista → `DELETE imports/:id` (status del
   dominio de hoy) → `DELETE product/:id` y `DELETE category/:id` con la fila borrada por SQL. Ninguna respuesta con
   `code: "email_not_verified"`. `uploads`/`analyze` (R2 y proveedor) quedan para el barrido de guard del punto 3.
2. **`loyalty-program-sin-email` (editar):** el caso «RETIRAR sigue exigiendo email verificado» pasa a «RETIRAR sin
   verificar → `200 { ok: true }` y la fila queda en `closing`»; se suma «`PATCH cancel-close` → 200 y vuelve a
   `active`».
3. **Barrido de guard (unidad, en el archivo de superficies o uno nuevo `catalog-sin-email-guard.test.ts`):** cada
   handler de las tablas de §Especificación con sesion de owner sin verificar y los dobles del soporte → el `code` de
   la respuesta NUNCA es `email_not_verified` (un piso: cuenta los handlers barridos = 17).
4. **Lo que NO tiene que cambiar:** `permisos-delegados.neon.integration.test.ts:195` (staff con `catalog` → `403
   not_owner` en los dos borrados) sigue verde sin tocarlo.

**Mutaciones del revisor — presupuesto: 3. Clase: los plausibles (volver a poner el gate o abrir de mas).**

| # | Mutacion (con su linea de hoy) | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| M1 | `requireOwner` vuelve a `requireApiPermission` (`catalog/_auth.ts:31`) | punto 1 (primer `POST category` → 403) y el `toEqual` del inventario |
| M2 | `DELETE` del programa vuelve a `requireApiOwner` (`loyalty-program/route.ts:147`) | punto 2, caso RETIRAR |
| M3 | `requireCatalogOwner` pasa a `requireApiPermissionSinGateDeEmail("catalog")` (abre de mas: staff borra) | `permisos-delegados…:195` |

Guard hermano por fila: M1 — `requireImportAccess` es otro guard, pero el primer paso del punto 1 es `category`, que
solo pasa por `requireOwner`. M2 — ninguno: el writer `closeProgram` no tiene regla de email (`rg emailVerified
packages/domain/src/server/loyalty-program.ts` vacio salvo comentario). M3 — ninguno: el borrado no chequea rol en el
dominio (lo fija hoy esa misma linea del test).

## Handoff requerido

Implementador: codigo + tests + `pnpm verify`, seccion «Implementacion» con lo ejecutado. Revisor: PASS/FAIL con M1–M3
ejecutadas. Para GPT (en el ESTADO de Claude): el copy `email_not_verified` de catalogo/programa queda muerto.

## Abierto

Nada.
