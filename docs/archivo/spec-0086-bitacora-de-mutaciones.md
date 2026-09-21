# Bitácora de mutaciones — spec 0086 (ABIERTA ANTES DE MEDIR)

Presupuesto: 6 (M1–M6 del §Plan de pruebas). Corte: dos vueltas seguidas de «el fix abrió la
siguiente» → se corta y se declara.

shasum LIMPIOS (copias en /tmp/limpio-<basename>):

| archivo | estado git | shasum limpio |
|---|---|---|
| apps/merchant/src/server/permissions-catalog.ts | ?? | 7c5c0210de190008f9405f8d5528f876ab725ca0 |
| apps/merchant/src/server/api-permission.ts | ?? | 5a36cdc567028df3a0655a1f29e3d83bfb8b95ac |
| apps/merchant/src/app/api/counter/_auth.ts | _M | d1d4d6ca2447fd6856e0ea9242373382a251f4a9 |
| apps/merchant/src/server/staff-permissions.ts | ?? | 240156e15e817385e2d1515b06bbef540a18688c |
| apps/merchant/src/server/locations/address.ts | (limpio) | 20a022e2aa7a6d1b4c00ebfc7f537e3892771a98 |

**Los cuatro `??` NO tienen blob: `git checkout` no los salva.** El punto de retorno son las
copias de /tmp y el shasum de arriba.

| id | archivo | invariante que ataca | resultado |
|---|---|---|---|
| M1 | permissions-catalog.ts `hasScope` | el paso 3 decide: un staff sin el scope NO entra | (pendiente) |
| M2 | api-permission.ts `resolveMembership` | el paso 2 va ANTES del 3: un no-miembro dice `not_member` | (pendiente) |
| M3 | api-permission.ts + counter/_auth.ts | el paso 4 (email) NO alcanza al staff | (pendiente) |
| M4 | staff-permissions.ts `assertGrantable` | R1: un no-owner no otorga `staff` | (pendiente) |
| M5 | staff-permissions.ts `assertNotSelf` | R3: nadie edita sus propios permisos | (pendiente) |
| M6 | locations/address.ts `createLocation` | §7: el eje PLAN alcanza al staff en el WRITER | (pendiente) |

## RESULTADOS EJECUTADOS (2026-09-21)

| id | archivo(s) | rojos | revertida |
|---|---|---|---|
| M1 | permissions-catalog.ts `hasScope` → `return true` | 29 tests / 6 archivos | sí, diff vacío, shasum 7c5c0210 |
| M2 | api-permission.ts: paso 3 antes del paso 2 | 15 tests / 3 archivos | sí, diff vacío, shasum 5a36cdc5 |
| M3 | api-permission.ts + counter/_auth.ts: el paso 4 alcanza al staff | 28 tests / 5 archivos | sí, diff vacío x2, shasum 5a36cdc5 / d1d4d6ca |
| M4 | staff-permissions.ts `assertGrantable` → no-op | 5 tests / 3 archivos | sí, diff vacío, shasum 240156e1 |
| M5 | staff-permissions.ts `assertNotSelf` → `if (false)` | 4 tests / 2 archivos | sí, diff vacío, shasum 240156e1 |
| M6 | locations/address.ts: el writer salta el cap del plan | 4 tests / 2 archivos | sí, diff vacío, shasum 20a022e2 |

`rg -n MUTATION apps tools` → vacío (exit 1). Los 6 shasum coinciden con los limpios de arriba.

## ENMIENDA §10 — presupuesto 6 → 8. Filas ABIERTAS ANTES DE MEDIR (2026-09-21)

| archivo | git | shasum limpio |
|---|---|---|
| server/brand.ts | _M | (ver salida) |
| server/loyalty-program/owner.ts | _M | (ver salida) |
| server/onboarding-grant.ts | _M | (ver salida) |

| id | archivo | invariante que ataca | resultado |
|---|---|---|---|
| M7 | brand.ts + loyalty-program/owner.ts `ownerBusiness` | el `businessId` del guard MANDA: el dominio no re-resuelve owner-only | (pendiente) |
| M8 | onboarding-grant.ts `programEditDenied` | el writer sabe que el caller es staff y no re-impone el gate del paso 4 | (pendiente) |

## RESULTADOS M7/M8 (2026-09-21)

shasum limpios de la enmienda:
  brand.ts              96606bea355dcc3ede0f1ab246ebc8b2ef1863a6
  loyalty-program/owner.ts  84ded3889fe44541e674fe57bb60e5c358e2cc70
  onboarding-grant.ts   82363e3d73e0ce7b669ffc4e15a7cb36686eeb8f

| id | rojos | nota |
|---|---|---|
| M7 | 6 tests / 1 archivo | brand.neon y loyalty-program.neon quedaron VERDES: el owner no pasa businessId, y esa es la propiedad del DoD §10 ítem 3 |
| M8 | **1ª medición VERDE — ORÁCULO FALSO.** 2ª medición: 1 rojo | `seedMember` creaba el user con `emailVerified: true`; un staff real nace en `false`. Reparado el oráculo, re-medido rojo, y revertido → verde |

`rg -n MUTATION apps tools` → vacío (exit 1). Los 8 shasum coinciden.

## M3-BIS (2026-09-21) — RE-CORRIDA de M3, no una 9ª del presupuesto

Motivo: el revisor midio (RV9) que `permisos-delegados.neon` y `permisos-mostrador.neon`
quedaban VERDES bajo M3 porque `seedMember` creaba el staff con `emailVerified: true`.
Cambiado el default a `false` en la FUENTE, se re-mide M3 para probar que el arreglo MUERDE.

archivos: api-permission.ts (5a36cdc5…) + counter/_auth.ts (d1d4d6ca…), los mismos de M3.
invariante: el paso 4 NO alcanza al staff — ahora visible desde las suites delegadas.
resultado: (pendiente)
resultado M3-bis: **7 rojos** — 3 en `permisos-delegados.neon` (`expected 403 to be 201` /
`to be 404` / `to be 409`) y 4 en `permisos-mostrador.neon` (`expected 403 to be 200` y
`expected 403 not to be 403`). ANTES del cambio de `seedMember` las dos quedaban en VERDE.
Revertida: diff vacio x2, shasum 5a36cdc5 / d1d4d6ca.

## PRUEBA DE QUE EL ORACULO NUEVO MUERDE (punto 3 del revisor)

No es una mutacion de CODIGO sino de ESQUEMA, sobre la rama de integracion:
`alter table core.business_membership drop constraint business_membership_staff_has_permission_check`.

- Con el CHECK caido → **3 rojos** en `membership-permissions-checks.neon`:
  `CHECK 3 ... lista vacia explicita` → `expected undefined to be '23514'` (el INSERT entro),
  `CHECK 3 ... DEFAULT de la columna` → `expected '23505' to be '23514'` (colateral: choco la PK
  contra la fila que el caso anterior dejo entrar), y el control positivo tambien.
- RESTAURADO y verificado: `pg_get_constraintdef` devuelve la definicion identica a la original
  y los SEIS CHECK de la tabla estan presentes.
