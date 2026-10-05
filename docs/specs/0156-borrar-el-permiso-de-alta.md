---
spec: 0156
fecha: 2026-10-04
estado: cerrada
resumen: (A) Borra el permiso de alta (`onboarding_grant_until`, spec 0077 / ADR 0076 §2) que quedo sin funcion al salir el programa del wizard (ADR 0121). Editar el programa exige email verificado sin excepcion temporal; crear sigue permitido como hoy. Migracion DROP COLUMN despues del deploy. Cierra PARQUEADO #71. (B) CHECK email = lower(email) en merchant_auth.user: el unico de email pasa a ser insensible a mayusculas por garantia de la base.
disjunta: no
archivos: packages/domain/src/server/{onboarding-grant,loyalty-program}.ts, apps/merchant/src/app/api/loyalty-program/route.ts, apps/merchant/src/app/api/onboarding/signup/route.ts, apps/merchant/src/server/{auth,merchant-session,onboarding-grant-support,api-owner-surfaces-support,onboarding-tours-support}.ts, packages/db/src/schema/auth.ts, packages/db/drizzle/<nueva>, tests que nombran el permiso
---

# 0156 — Borrar el permiso de alta y email en minusculas en la base

**Nivel N2** (sesiones + migracion). Decisiones del owner (2026-10-04): (A) «perfecto, borramos», tras la revision de que
hace el permiso; (B) «Emails con mayusculas corregimos ahora dentro de este arco» (hallazgo del implementador de la 0155).

## Problema

El permiso de alta (ADR 0076 §2, spec 0077) es una ventana de 60 min en la fila de la sesion, escrita al crear la
cuenta, que deja **editar** el programa sin email verificado (crear esta permitido siempre; el QR tiene su guard propio
sin email, spec 0075). Existia para volver atras en el paso de programa del wizard. Con el ADR 0121 ese paso no existe:
el permiso no habilita nada que el flujo use, y el signup de la 0155 lo sigue emitiendo solo por compatibilidad
(PARQUEADO #71). Es codigo sin uso (`CLAUDE.md` §Codigo).

## Problema (B)

`merchant_auth_user_email_unique` es sobre `email` crudo, no `lower(email)`. Hoy todo escritor guarda minusculas
(medido 2026-10-04: better-auth 1.7.6 hace `email.toLowerCase()` en `createUser`/`updateUser`/`findUserByEmail`,
`dist/db/internal-adapter.mjs`; `signup` usa `normalizeEmail`; el staff usa `staff-<uuid>@staff.invalid`), y en PROD hay
0 de 14 cuentas con mayusculas y 0 duplicados por `lower`. Pero la base no lo garantiza: un escritor futuro o un `UPDATE`
a mano con `Juan@x.com` crearia un duplicado que el unico deja pasar y que solo frena la rama de email conocido de
`signup` (caso de la 0155 «email CONOCIDO guardado con mayusculas»).

## Alcance

**Entra:**
1. `packages/domain/src/server/onboarding-grant.ts`: se borran `ONBOARDING_GRANT_MINUTES`,
   `ONBOARDING_GRANT_AFTER_COMPLETION_MINUTES`, `onboardingGrantActive`, `shortenOnboardingGrant` y el campo
   `onboardingGrantActive` de `ProgramCaller`. Quedan `ProgramCaller` (`emailVerified`, `isStaff?`) y
   `programEditDenied`, cuya regla pasa a: crear → permitido; editar → `isStaff === true` o `emailVerified` → permitido;
   si no, `403 email_not_verified`. Si el modulo queda solo con eso, se renombra a `program-caller.ts` (y se actualizan
   los imports); el nombre «onboarding-grant» no debe sobrevivir.
2. `saveProgram` (`loyalty-program.ts`): se borra el acortado (`shorten`) del batch de creacion.
3. `app/api/loyalty-program/route.ts` `callerOf`: devuelve `{ emailVerified }` (y lo de staff como hoy).
4. `signup` (0155) y `openMerchantSession`: sin la opcion `onboardingGrantUntil`.
5. `server/auth.ts`: se borra `session.additionalFields.onboardingGrantUntil`.
6. Esquema: se borra la columna de `packages/db/src/schema/auth.ts` y se genera la migracion con `drizzle-kit generate`
   (un `ALTER TABLE "merchant_auth"."session" DROP COLUMN "onboarding_grant_until"`).
7. **(B)** `packages/db/src/schema/auth.ts`: `check("merchant_auth_user_email_lowercase", sql`${table.email} = lower(${table.email})`)`
   en `users`. Va en la MISMA migracion generada que el `DROP COLUMN`.
8. **(B)** El caso de la 0155 «email CONOCIDO guardado con mayusculas» (`onboarding-signup.neon`) siembra una fila que el
   CHECK ahora rechaza: se reemplaza por «insertar un `user` con mayusculas → 23514 (check_violation)». La rama de
   email conocido de `signup` queda (defensa en profundidad), con su caso en minusculas.
9. Tests: se borran `onboarding-grant.test.ts`, `onboarding-grant.neon.integration.test.ts`,
   `onboarding-grant-cortes.neon.integration.test.ts`, `onboarding-grant-support.ts` y los casos que solo prueban la
   ventana; los demas (`loyalty-*.neon`, `permisos-brand-loyalty.neon`, `onboarding-program-*`, supports, etc.) se
   ajustan quitando el campo. **Los casos de crear ≠ editar se conservan** reescritos sin permiso (ver plan de pruebas).

**No entra (hallazgos a decidir del owner, PARQUEADO #72 y #73):**
- Que crear el programa siga permitido sin email verificado (regla del alta, ADR 0070 §11).
- Que `GET /api/loyalty-program/qr` siga sin chequeo de email (spec 0075).

## Diseño

### Orden de despliegue (gotcha «migracion primero o deploy primero»)

El codigo que corre en PROD **lee y escribe** `onboarding_grant_until` (better-auth lo selecciona por
`additionalFields`; `start`/`signup` lo escriben). Por eso: **1) deploy del codigo sin la columna; 2) recien despues,
migracion `DROP COLUMN`** a PROD (paso del orquestador, con el owner aprobando la llamada). Un `DROP` antes del deploy
rompe el login de todos los merchants. Entre 1 y 2 la columna queda huerfana sin efecto (nullable, nadie la lee).

La parte (B) es aditiva (los datos cumplen, medido) y podria ir antes, pero viaja en la misma migracion y por eso
sigue el orden de (A). Antes de migrar, re-correr en PROD `select count(*) from merchant_auth."user" where email <> lower(email)` → 0.

Antes de migrar: `git show <sha-de-prod>:apps/merchant/src/server/auth.ts | rg onboardingGrant` → vacio.

### Arquitectura de referencia

ADR 0076 (lo que se borra: §2 y §4; §1 crear ≠ editar queda), ADR 0121, spec 0077, spec 0086 §10 (staff exceptuado).

## Archivos

Los del frontmatter. Barrido de cierre: `rg -n "onboardingGrant|onboarding_grant|ONBOARDING_GRANT|onboarding-grant|shortenOnboardingGrant" apps packages tools tests --glob '!packages/db/drizzle/**'`
→ vacio.

### Disjunta?

**No**: se monta sobre la 0155 (el signup) en la rama `onboarding-google`, despues de su PASS.

## Definition of Done

- [ ] Barrido de cierre vacio (comando de arriba, corrido).
- [ ] Migracion nueva generada por drizzle-kit con solo el `DROP COLUMN`; aplicada a la rama de CI por
      `tools/neon-test.sh`; **no** aplicada a PROD (eso va despues del deploy, fuera de esta spec).
- [ ] Owner sin verificar: crear programa 200; editar 403 `email_not_verified` **aunque la cuenta tenga 1 minuto**.
      Owner verificado: editar 200. Staff con `loyalty`: editar 200.
- [ ] **(B)** `insert` de un `user` con `Juan@X.com` contra la rama de CI → error `23514`; con `juan@x.com` → ok.
- [ ] `pnpm verify` verde con Node 24 + suites Neon tocadas.

## Plan de pruebas y verificación

- [ ] Unit (renombrado de `onboarding-grant.test.ts`): tabla de `programEditDenied` — {crear, cualquier caller} → null;
      {editar, verificado} → null; {editar, staff} → null; {editar, no verificado} → 403; {editar, `isStaff`
      undefined, no verificado} → 403.
- [ ] Neon: owner recien creado por `signup` (sin verificar) crea programa → 201/200 y despues editar → 403. Owner
      verificado edita → 200. (Pueden vivir en `loyalty-program.neon` o en el archivo que absorba los casos de
      `onboarding-grant.neon`.)
- [ ] **Mutaciones (revisor, presupuesto 3):**

  | # | Mutacion | Oraculo esperado | Guard hermano |
  |---|---|---|---|
  | M1 | `programEditDenied` permite editar sin verificar (borrar la condicion `emailVerified`) | rojo: Neon «recien creado edita → 403» y unit | ninguno: la ruta usa `requireApiPermissionSinGateDeEmail` (sin paso de email); verificar en el archivo al medir |
  | M2 | `programEditDenied` niega crear a un no verificado | rojo: Neon «recien creado crea → 201/200» | ninguno |
  | M3 | sin el `check` (una migracion aplicada a una rama no se «des-muta» editando el `.sql`): correr el caso contra una rama Neon efimera hija de `ci-integration` **antes** de aplicar la migracion nueva | rojo: el insert con mayusculas pasa; despues de migrar, verde con `23514` | ninguno: el unico es sobre `email` crudo |

- [ ] Comandos: `pnpm verify`; `tools/neon-test.sh` con las suites editadas.

## Handoff requerido

Formato de `docs/AGENT-WORKFLOW.md`; PASS del revisor antes de `implementada`.

## Abierto

Nada bloqueante.
