---
spec: 0156
fecha: 2026-10-04
estado: implementada
resumen: (A) Borra el permiso de alta (`onboarding_grant_until`, spec 0077 / ADR 0076 §2) que quedo sin funcion al salir el programa del wizard (ADR 0121). Sin la regla de email del programa (ver C). Migracion DROP COLUMN despues del deploy. Cierra PARQUEADO #71. (B) CHECK email = lower(email) en merchant_auth.user: el unico de email pasa a ser insensible a mayusculas por garantia de la base. (C) ADR 0122: el programa (ver, crear, editar, sello, plantillas) no exige email verificado; se borra programEditDenied y tres rutas pasan a requireApiPermissionSinGateDeEmail. Cierra PARQUEADO #72 y #73.
disjunta: no
archivos: packages/domain/src/server/{onboarding-grant,loyalty-program}.ts, apps/merchant/src/app/api/loyalty-program/route.ts, apps/merchant/src/app/api/onboarding/signup/route.ts, apps/merchant/src/server/{auth,merchant-session,onboarding-grant-support,api-owner-surfaces-support,onboarding-tours-support}.ts, packages/db/src/schema/auth.ts, packages/db/drizzle/<nueva>, tests que nombran el permiso
---

# 0156 — Borrar el permiso de alta, email en minusculas y programa sin email verificado

**Nivel N2** (sesiones + migracion). Decisiones del owner (2026-10-04): (A) «perfecto, borramos», tras la revision de que
hace el permiso; (B) «Emails con mayusculas corregimos ahora dentro de este arco» (hallazgo del implementador de la 0155); (C) ADR 0122 («se puede crear el programa sin verificar email [...] solo
necesitas una sesion activa y ser owner de la marca de la sesion [...] a no ser que tengas los permisos en staff»; «el
qr si se podra mostrar y usar sin email verificado»). **(C) se agrego con la spec ya despachada (2026-10-04).**

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
1. **(A+C)** `packages/domain/src/server/onboarding-grant.ts` **se borra entero**: `ONBOARDING_GRANT_MINUTES`,
   `ONBOARDING_GRANT_AFTER_COMPLETION_MINUTES`, `onboardingGrantActive`, `shortenOnboardingGrant`, `ProgramCaller` y
   `programEditDenied` (ADR 0122 §2: el dominio no tiene regla de email). Si `saveProgram` queda sin uso para su 3er
   argumento `caller`, el argumento se borra y se actualizan todos los llamadores.
2. `saveProgram` (`loyalty-program.ts`): se borran el acortado (`shorten`) del batch de creacion y la llamada a
   `programEditDenied`.
3. `app/api/loyalty-program/route.ts`: se borra `callerOf`. **(C)** `GET` pasa de `requireApiPermission` a
   `requireApiPermissionSinGateDeEmail` (mismos `MESSAGES` sin `emailNotVerified`). `PUT` ya lo usa. `DELETE` y `PATCH`
   **no se tocan** (`requireApiOwner`, ADR 0122 §4).
3b. **(C)** `app/api/loyalty-program/stamp-upload/route.ts` (`POST`) y `app/api/loyalty-terms/templates/route.ts`
   (`GET`): de `requireApiPermission` a `requireApiPermissionSinGateDeEmail`. El QR no se toca (ya lo usa).
   `api-owner-surfaces-support.ts` y los tests que listan que superficie lleva paso 4 se actualizan a esto.
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

**No entra:**
- `DELETE`/`PATCH` de `/api/loyalty-program` (retirar y cancelar el retiro): siguen con owner verificado (ADR 0122 §4).
- El paso 4 del resto de las superficies delegables (staff, locales, marca, campañas, catalogo, billing).

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
- [ ] Migracion nueva generada por drizzle-kit con el `DROP COLUMN` y el `CHECK` de (B); aplicada a la rama de CI por
      `tools/neon-test.sh`; **no** aplicada a PROD (eso va despues del deploy, fuera de esta spec).
- [ ] **(C)** Owner sin verificar recien creado por `signup`: `GET /api/loyalty-program` 200, crear (`PUT`) 200/201,
      editar (`PUT`) 200, `GET /api/loyalty-terms/templates` 200, `GET .../qr` 200 (o `no_program` antes de crear).
      Staff **sin** `loyalty`: `PUT` 403 `missing_permission`. Staff con `loyalty`: `PUT` 200. Owner sin verificar:
      `DELETE` 403 `email_not_verified` (sin cambio).
- [ ] **(B)** `insert` de un `user` con `Juan@X.com` contra la rama de CI → error `23514`; con `juan@x.com` → ok.
- [ ] `pnpm verify` verde con Node 24 + suites Neon tocadas.

## Plan de pruebas y verificación

- [ ] Neon: los casos de la DoD (C). El aislamiento entre comercios no tiene parametro que mutar (el negocio sale de
      la membresia de la sesion, paso 2); lo fijan los casos `not_member` existentes de `permisos-brand-loyalty.neon` y
      `api-permission.test`, que se conservan.
- [ ] **Mutaciones (revisor, presupuesto 3):**

  | # | Mutacion | Oraculo esperado | Guard hermano |
  |---|---|---|---|
  | M1 | `GET /api/loyalty-program` vuelve a `requireApiPermission` | rojo: Neon «owner sin verificar ve su programa → 200» | ninguno |
  | M2 | en `saveProgram`, negar la EDICION a `emailVerified !== true` (reintroducir la regla vieja) | rojo: Neon «owner sin verificar edita → 200» | la puerta `PUT` no tiene paso 4: el unico lugar es el dominio |
  | M3 | sin el `check` (una migracion aplicada a una rama no se «des-muta» editando el `.sql`): correr el caso contra una rama Neon efimera hija de `ci-integration` **antes** de aplicar la migracion nueva | rojo: el insert con mayusculas pasa; despues de migrar, verde con `23514` | ninguno: el unico es sobre `email` crudo |

- [ ] Comandos: `pnpm verify`; `tools/neon-test.sh` con las suites editadas.

## Handoff requerido

Formato de `docs/AGENT-WORKFLOW.md`; PASS del revisor antes de `implementada`.

## Abierto

Nada bloqueante.

## Resultado (2026-10-04)

- **Implementada:** A+B en `3411fab`, C en `931fa2b` (rama `onboarding-google`, sin push). Migracion
  `packages/db/drizzle/0065_borrar_permiso_de_alta.sql` (DROP COLUMN + CHECK) aplicada **solo a `ci-integration`**.
- **Implementador:** M1–M3 (A/B) y C-M1/C-M2, todas rojas y revertidas (bitacora en `docs/TASKS.md`). M3 medida contra
  `ci-integration` antes de migrar (sin rama efimera: el agente no tenia herramientas de Neon).
- **Revisor: PASS** (`26f60b6`): `pnpm verify` ok (Neon completo 381 archivos / 3047 tests); R1 (el `PUT` sin el
  negocio del guard → staff con `loyalty` 403), R2 (stamp-upload con paso 4 → rojo en unidad), R3 (columna repuesta en
  el esquema = codigo de PROD contra base migrada → signup 503) rojas y revertidas. Sin huecos de aislamiento.
- **Orquestador:** barrido de cierre vacio; Neon `loyalty-program-sin-email` + `permisos-brand-loyalty` +
  `onboarding-signup` 19/19. El rojo de `catalog-import-reconcile`/`-guard` en una Neon completa del implementador es el
  flake conocido de la spec 0092 (PARQUEADO #74), no de esta spec. Docblock de `requireApiPermissionSinGateDeEmail`
  reescrito (decia «DOS rutas» y que el gate vivia en `saveProgram`).
- **Declarado:** stamp-upload sin caso Neon (el paso 4 lo fija la unidad, R2); la rama de email conocido del signup
  queda como defensa en profundidad sin oraculo Neon que la distinga del unico + rollback.
- **Despliegue (paso del orquestador, con el owner):** (1) deploy de este codigo; (2) `select count(*) from
  merchant_auth."user" where email <> lower(email)` → 0 en PROD; (3) migracion 0065 a PROD. **Despues del paso 3 no
  se puede volver a un deploy anterior a `3411fab`**: el codigo viejo inserta `onboarding_grant_until` en cada sesion
  nueva y el login cae (lo midio R3). Un rollback de codigo exige reponer la columna antes.
