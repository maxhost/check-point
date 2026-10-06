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

## Implementacion

> Implementador, 2026-10-05, worktree `check-point-wt/sin-gate-email` (rama `sin-gate-email`), Node 24.20.0.
> **Sin PASS de revisor todavia**: la spec sigue `cerrada`. M1–M3 son del revisor y no se corrieron.

**Commit:** `8ab9e73` feat(merchant): catalogo y ciclo del programa sin email verificado (0165).

### Rojo previo (oraculos nuevos contra el codigo de hoy, antes de tocar los guards)

- Unidad — `vitest run catalog-sin-email-guard.test.ts api-owner-surfaces.test.ts api-permission-surfaces.test.ts`:
  `Tests 36 failed | 145 passed (181)`. Las 34 del barrido (17 entradas × 2 estados de sesion) con
  `AssertionError: expected 'email_not_verified' not to be 'email_not_verified'`; las 2 de la fila `catalog` de
  la matriz con `AssertionError: expected 403 to be 200`.
- Neon — `tools/neon-test.sh src/server/catalog-sin-email.neon.integration.test.ts src/server/loyalty-program-sin-email.neon.integration.test.ts`:
  `Tests 8 failed | 4 passed (12)`. Los 5 pasos del catalogo con
  `expected '{"error":"Verifica tu email para gest…' not to contain 'email_not_verified'`, el piso con
  `expected 5 to be 11`, y `DELETE`/`PATCH` del programa con el cuerpo recibido
  `{ "code": "email_not_verified", "error": "Verifica tu email para gestionar el programa." }`. Los 4 casos que ya
  pasaban (ver/crear/editar programa, QR, plantillas) siguieron verdes.

### DoD — salida ejecutada

- `rg -l 'SinGateDeEmail' apps/merchant/src/app/api | sort` → 7 archivos: `catalog/_auth.ts`,
  `catalog/imports/_auth.ts`, `loyalty-program/qr/route.ts`, `loyalty-program/route.ts`,
  `loyalty-program/stamp-upload/route.ts`, `loyalty-terms/templates/route.ts`, `onboarding/checklist/route.ts`.
- `rg -n 'await requireApiOwner\(|await requireApiPermission\(' apps/merchant/src/app/api/catalog apps/merchant/src/app/api/loyalty-program` → vacio (rc=1).
- `git diff origin/main -- …/api-owner.ts …/api-permission.ts` → 18 inserciones / 5 borrados; lineas `+`/`-` que no
  empiezan con ` *` = 0 (solo docblocks).
- `pnpm exec vitest run apps/merchant/src/server/api-owner-surfaces.test.ts apps/merchant/src/server/api-permission-surfaces.test.ts` → `Test Files 2 passed`, `Tests 146 passed (146)`.
- `tools/neon-test.sh` de `catalog-sin-email`, `loyalty-program-sin-email` y `permisos-delegados` → `Test Files 3 passed`,
  `Tests 16 passed (16)` (incluye «un STAFF con `catalog` recibe 403 `not_owner` en los DOS borrados, y el OWNER no»,
  sin tocar ese archivo).
- `pnpm verify` → `verify: ok` (tabla abajo).
- `rg -n MUTATION apps packages tools` → vacio (rc=1).

### `pnpm verify` (corrida final)

```
gate                  | corrio/salteado (motivo)    | ok/ROJO | segundos
typecheck             | corrio                      | ok      | 9.8
lint                  | corrio                      | ok      | 5.9
ui-guard              | corrio                      | ok      | 0.5
format:check          | corrio                      | ok      | 6.4
test                  | corrio                      | ok      | 35.9
build                 | corrio                      | ok      | 7.2
test:e2e              | salteado (no se toco UI)    | -       | -
neon related merchant | corrio                      | ok      | 89.7
neon related consumer | salteado (nada de consumer) | -       | -
verify: ok
```

`test`: `Tests 2372 passed | 995 skipped (3404)`; `neon related merchant`: `Test Files 61 passed`, `Tests 681 passed`.

### Desvios (con motivo)

1. **`pnpm verify` corrio DOS veces, no una.** La primera dio ROJO por dos errores mios: `format:check` (3 archivos de
   test sin Prettier) y dos tests con `vi.mock("./api-permission")` que solo exportaban `requireApiPermission`
   (`catalog-import-routes.test.ts`, 5 rojos en `test`; `catalog-import-guard.neon.integration.test.ts`, 5 rojos en
   `neon related`), con `No "requireApiPermissionSinGateDeEmail" export is defined on the "./api-permission" mock`.
   No era PARQUEADO #74. Se corrigio y la segunda dio `verify: ok`.
2. **Archivos fuera de la lista de la spec:** (a) esos dos `vi.mock` renombran la clave doblada a
   `requireApiPermissionSinGateDeEmail` — es el montaje que sigue al guard renombrado, ninguna asercion cambia;
   (b) un comentario en `catalog/product/[id]/route.ts` y `catalog/category/[id]/route.ts` que decia «conserva
   `requireApiOwner`» (falso tras este cambio), solo comentario.
3. **Doble de `./db` extendido** (`api-owner-surfaces-support.ts`): `where()` suma `orderBy: async () => []`. Sin
   el, `listCatalog` revienta y `GET /api/catalog` da 503, y la fila `catalog` no tendria desenlace positivo
   `200`. El desenlace asevera `products/categories/locations: []` y `currencyCode: "USD"` (de la fila del guard),
   **no** `importInProgress`, que con este doble sale `true` (la rama `.limit()` devuelve la fila del slug).
4. **Barrido del punto 3:** archivo nuevo `catalog-sin-email-guard.test.ts` (17 entradas, piso `ENTRADAS.length === 17`),
   en dos estados (`emailVerified: false` y sin la clave). Asevera `code !== "email_not_verified"` **y** status no
   401/403.
5. **`loyalty-program-sin-email`**: el cuerpo se asevera antes que el status en `DELETE`/`PATCH` (un rojo muestra el
   `code`, no solo un 403). `DELETE` manda una ventana futura (`2099-01-01T10:00` / `2099-02-01T10:00`): con `{}` el
   dominio contesta 422.
6. **El worktree no tenia `apps/merchant/.env.local`** (`tools/worktree-new.sh` solo enlaza los `.env*` de la raiz):
   se enlazo con `ln -s` al del repo principal (gitignored, no se commitea) para correr `tools/neon-test.sh`.

### Hallazgos a decidir

- **El `toEqual` del inventario NO muerde M1.** `SURFACES_SIN_GATE_DE_EMAIL` sale de `NOMBRES_SIN_GATE_DE_EMAIL`, una
  lista estatica: volver a poner el gate en `requireOwner` no cambia esa lista. Lo que muerde M1 en la matriz es el
  desenlace positivo de la fila `catalog` (rojo previo medido: `expected 403 to be 200`), mas el punto 1 y el barrido.
  La tabla de mutaciones de la spec lo nombra como oraculo de M1: es una prediccion que no se cumple.
- Copy muerto en pantallas (zona GPT): el texto de `email_not_verified` de catalogo/programa ya no puede llegar.
