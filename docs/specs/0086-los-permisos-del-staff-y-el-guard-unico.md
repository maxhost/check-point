---
spec: 0086
fecha: 2026-09-20
estado: cerrada
resumen: Implementa el ADR 0079 §1-§6 y §8. `business_membership` gana `permissions text[]` con tres CHECK que hacen imposibles los estados invalidos (permiso desconocido, owner con permisos, staff con cero). Nace `requireApiPermission` —la escalera del ADR 0073 con un paso nuevo entre membresia y email— y las diez superficies delegables migran a el; las cuatro del §8 se quedan en `requireApiOwner`. El alta de staff acepta `permissions` (>= 1), nace `PATCH /api/staff/:userId/permissions` con las cuatro reglas anti-escalada del ADR 0079 §3, el mostrador pasa a exigir el permiso `counter` y `GET /api/merchant/session` devuelve `permissions` para que la UI no adivine. **SIN BACKFILL, por decision del owner: la migracion BORRA las membresias de staff existentes** —el owner las recrea— porque el CHECK valida filas viejas y el proyecto todavia esta en prueba; se borra la membresia y NO el `user`, que la FK de `order.created_by_user_id` protege. El eje PLAN no se toca: sigue en el writer, y por eso el staff hereda los topes sin una linea nueva.
disjunta: no
archivos: apps/merchant/drizzle/0041_*, apps/merchant/src/server/schema/business.ts, apps/merchant/src/server/api-permission.ts, apps/merchant/src/server/staff-permissions.ts, apps/merchant/src/server/staff.ts, apps/merchant/src/server/staff-create.ts, apps/merchant/src/server/session-view.ts, apps/merchant/src/server/auth-guards.ts, apps/merchant/src/app/api/{staff,catalog,locations,marketing}/_auth.ts, apps/merchant/src/app/api/counter/_auth.ts, apps/merchant/src/app/api/staff/[userId]/permissions/route.ts, apps/merchant/src/app/api/{brand,loyalty-program,loyalty-terms}/**/route.ts, apps/merchant/src/app/api/merchant/session/route.ts
---

# 0086 — Los permisos del staff y el guard unico

> **Nada de codigo empieza sin esta spec en `cerrada`.**

## Problema

**El rol ES el permiso.** Medido sobre el arbol el 2026-09-20: un integrante llega a **una
sola superficie** —`/api/counter/*`, cuyo `requireOperator` acepta cualquier membresia activa
del negocio— y las **once restantes** pasan por `requireApiOwner`, que contesta `403
not_owner` en el paso 2, antes de mirar nada mas. No hay columna donde escribir un estado
intermedio ni guard que lo sepa leer.

La consecuencia observable: **delegar cualquier tarea de configuracion obliga hoy a entregar
la cuenta del owner.** No hay forma de que alguien cargue el catalogo sin poder tambien abrir
un checkout de Stripe, cambiar el `slug` publico del negocio o cerrar el programa de
fidelizacion.

## Alcance

**Entra:**

- La columna `permissions` con sus tres `CHECK` y el backfill de las filas existentes.
- `requireApiPermission` y su hermana sin gate de email, y la migracion de las **diez**
  superficies delegables del ADR 0079 §1.
- `POST /api/staff` aceptando `permissions`, y `PATCH /api/staff/:userId/permissions`.
- Las tres reglas anti-escalada del ADR 0079 §3 (solo el owner otorga `staff`; nadie se edita
  a si mismo; ninguna superficie de staff toca la membresia del owner).
- El mostrador exigiendo el permiso `counter`.
- `permissions` en `GET /api/merchant/session` y en `BackofficeSession`.
- El hueco de `suspended` en el guard de PAGINAS (ADR 0079, Consecuencias).
- El **contrato HTTP escrito**: `docs/specs/0086-contratos-de-api.md`.

**No entra:**

- **El log de auditoria.** Es la spec B. Esta spec **no** escribe una sola fila de log.
- **El archivado del catalogo.** Es la spec C. Hasta entonces el `DELETE` sigue siendo duro y
  **owner-only**, que es lo que esta spec si deja cerrado.
- **Las cuatro superficies del ADR 0079 §8** (`billing`, `business/slug`, `onboarding`, estado
  del negocio): conservan `requireApiOwner` **sin tocar una linea**.
- **Cualquier `.tsx`.** La UI la construye el owner por fuera (ADR 0070 §16-17). Consecuencia
  declarada: **`pnpm test:e2e` NO aplica a esta spec**, y eso se verifica con `git diff --stat`,
  no se asume.
- **El PIN fuera de banda** (`PARQUEADO` fila 60) y con el, cerrar la escalada residual del
  perfil administrador. Esta spec la **implementa aceptada**, no la resuelve.

## Diseño

### Especificación técnica

#### 1. La columna y sus tres CHECK (migracion `0041`)

```sql
alter table core.business_membership
  add column permissions text[] not null default '{}';

-- 1. Ningun valor fuera del catalogo. `<@` es contencion de conjuntos.
alter table core.business_membership add constraint business_membership_permissions_check
  check (permissions <@ array['staff','locations','loyalty','marketing','catalog','brand','counter']::text[]);

-- 2. El owner NO tiene permisos: los ignora por definicion (ADR 0079 §4). Sin esto existe el
--    estado «owner con permisos» y alguien va a terminar decidiendo por el.
alter table core.business_membership add constraint business_membership_owner_no_permissions_check
  check (role <> 'owner' or permissions = '{}');

-- 3. Un staff SIEMPRE tiene al menos uno. `array_length('{}',1)` devuelve **NULL**, no 0:
--    sin el `coalesce` este CHECK no muerde el caso que existe para cazar.
alter table core.business_membership add constraint business_membership_staff_has_permission_check
  check (role <> 'staff' or coalesce(array_length(permissions, 1), 0) >= 1);
```

**NO HAY BACKFILL. Las membresias de staff existentes se BORRAN**, decision textual del owner
del 2026-09-20: *«no necesitamos backflip, olvidate de hacer que los usuarios existentes
puedan seguir operando porque estamos en prueba, simplemente los eliminamos de la db y vuelvo
a crearlos»*.

```sql
-- Va ANTES de los CHECK 2 y 3, en la misma migracion.
delete from core.business_membership where role = 'staff';
```

**Por que el DELETE vive en la migracion y no en un paso manual previo:** `ADD CONSTRAINT
CHECK` **valida las filas existentes**, asi que el CHECK 3 hace fallar la migracion contra
cualquier rama que tenga un staff con `'{}'` — y las ramas de Neon de CI e integracion **si
tienen filas**, aunque produccion tenga cero negocios. Un paso manual previo a una migracion
es un paso que se olvida; en un entorno limpio este `delete` es un **no-op**.

**Se borra la MEMBRESIA, no el `user`.** Dos motivos, los dos verificados:

- `order.created_by_user_id` y `reward_redemption.created_by_user_id` referencian `users.id`
  **sin `onDelete`**, o sea `NO ACTION`: borrar un `user` con historial **falla con violacion
  de FK**. Es el diseño correcto (ADR 0007: la auditoria sobrevive al actor) y no se pelea con
  el.
- Sin membresia, ese `user` es **inerte**: no resuelve negocio (`operatorBusiness` filtra por
  membresia), no puede loguearse por `handle@slug` y no lo enumera `listStaff`.

**Costo declarado:** quedan filas huerfanas en `merchant_auth.user` con su email sintetico.
No colisionan al recrear —el sintetico lleva un `uuid` nuevo por integrante— y limpiarlas es
imposible para las que tengan historial, por la FK de arriba. **Se deja escrito, no se
esconde.**

**`role <> 'staff'` y no `role = 'owner'`** en los CHECK 2 y 3: si mañana el `CHECK` de `role`
gana un tercer valor, la forma con `<>` **falla cerrado** sobre el valor nuevo en vez de
dejarlo pasar sin invariante.

**Normalizacion.** El CHECK de contencion **no impide duplicados** (`{catalog,catalog}` lo
satisface). El writer normaliza —deduplica y ordena— y eso tiene su caso de prueba; no se
intenta expresarlo como constraint.

#### 2. `requireApiPermission` — archivo NUEVO, `server/api-permission.ts`

**No va en `api-owner.ts`: ese archivo tiene 254 lineas y el limite del hook `file-size` es
300.** Dividir, no extender.

```
1. ¿hay sesion?                    → 401 unauthorized
2. ¿membresia ACTIVA del negocio?  → 403 not_member          ← code NUEVO
3. ¿owner, o staff con el scope?   → 403 missing_permission  ← code NUEVO
4. ¿email verificado?              → 403 email_not_verified  ← SOLO si role === 'owner'
5. ¿el negocio OPERA?              → 403 business_suspended | business_closed
```

- **El orden es la regla, no una optimizacion** (ADR 0073 §1). Los pasos 4 y 5 van despues de
  resolver la membresia por el mismo motivo por el que ya iban despues de resolver al owner:
  puestos antes, filtran informacion de un negocio ajeno a un tercero.
- **El paso 4 saltea al staff**, con el precedente medido de `api/counter/_auth.ts`: el
  integrante tiene un email sintetico `@staff.invalid` que nunca se entrega y **ninguna accion
  con la que verificar nada**. `role === 'owner' && emailVerified !== true` — `!== true` y no
  `!`, fail-closed en el dato.
- **El paso 5 reusa `businessStatusFailure`**, la misma hoja pura que ya usan
  `requireApiOwner`, el login por PIN y el mostrador. No se escribe una segunda escalera.

**Retorno:** `{ business: ApiOwnerBusiness; userId: string; role: string; permissions: string[] }`.
`role` y `permissions` viajan porque los necesitan las reglas del §4 — no son decoracion.

**`requireApiPermissionSinGateDeEmail`**, para `GET /api/loyalty-program/qr` y
`PUT /api/loyalty-program`. Es la misma escalera **sin el paso 4**, y existe como funcion
propia y no como flag por la razon de la spec 0075 §D1: *un booleano que apaga un gate de
seguridad viaja en un copy-paste y no se puede contar con un `rg`.*

**⚠️ Invariante del inventario, y cambia de forma:** `rg 'SinGateDeEmail' apps` tiene que
seguir devolviendo **exactamente tres rutas**, ahora repartidas en dos funciones — `qr` y
`PUT /api/loyalty-program` en la nueva, `GET /api/onboarding/checklist` en la vieja.
`api-owner-surfaces.test.ts` asevera ese conjunto como **cerrado** y hay que actualizarlo para
que siga aseverando tres y no dos.

#### 3. Las diez superficies que migran, y las cuatro que no

| Permiso | Rutas | Donde vive el guard hoy |
|---|---|---|
| `staff` | `/api/staff/*` | `app/api/staff/_auth.ts` |
| `locations` | `/api/locations/*` | `app/api/locations/_auth.ts` |
| `catalog` | `/api/catalog/*` | `app/api/catalog/_auth.ts` |
| `marketing` | `/api/marketing/*` | `app/api/marketing/_auth.ts` |
| `brand` | `GET/PUT /api/brand`, `brand/logo-upload` | en las rutas, directo |
| `loyalty` | `GET/PUT /api/loyalty-program`, `stamp-upload`, `qr`, `loyalty-terms/templates` | en las rutas, directo |
| `counter` | `/api/counter/*` | `app/api/counter/_auth.ts` |

**NO migran, y es la mitad del valor de esta spec** (ADR 0079 §8): `api/billing/*`,
`POST /api/merchant/business/slug`, `api/onboarding/*`. Conservan `requireApiOwner` y su
`403 not_owner`, que ahi **sigue siendo cierto**: son superficies que piden al owner.

**`not_owner` desaparece de las diez que migran, y es un cambio de contrato.** Hoy los tres
casos —sin membresia, integrante, owner de otro negocio— colapsan en `not_owner`; pasan a ser
`not_member` y `missing_permission`. Esta declarado en `0086-contratos-de-api.md` y hay tests
que lo aseveran hoy: se actualizan, no se borran.

#### 4. Las cuatro reglas anti-escalada — `server/staff-permissions.ts` (archivo NUEVO)

`staff.ts` tiene 219 lineas y `staff-create.ts` 180: el writer va aparte.

| # | Regla | Respuesta |
|---|---|---|
| R1 | **Solo el owner otorga o quita `staff`.** Un caller con `role !== 'owner'` que mande `staff` en la lista | `403 permission_not_grantable` |
| R2 | **Un no-owner SI otorga cualquier otro permiso**, tenga o no ese permiso el mismo | — (decision del owner, ADR 0079 §3.2) |
| R3 | **Nadie edita sus propios permisos**, tampoco el owner | `403 self_permission_edit` |
| R4 | **Ninguna superficie de staff toca la membresia del owner** | `409 target_is_owner` |

**R4 ya existe para el estado** —`setStaffStatus` (`staff.ts:176`) tira `409 target_is_owner`—
y la ruta de permisos usa **el mismo `code` y el mismo status**, no uno nuevo. `listStaff` ya
filtra `role = 'staff'`, asi que la membresia del owner **tampoco se enumera**.

**R1 es la regla que sostiene todo el §3 del ADR.** Sin ella un administrador fabrica otro
administrador y el perfil deja de tener techo.

#### 5. Las dos escrituras

**`POST /api/staff`** pasa a aceptar `{ name, permissions: string[] }`. `permissions` es
**obligatorio y con al menos un elemento** (decision del owner); un valor desconocido es `400
unknown_permission` **antes** de llegar a la base — el `CHECK` es la red, no el validador.

**`PATCH /api/staff/:userId/permissions`**, cuerpo `{ permissions: string[] }`. Es un
**reemplazo total**, no un delta: la UI manda el conjunto de toggles que quedo prendido, que
es exactamente lo que el owner describio. Lista vacia → `400 permissions_required`; quitarle
todo a alguien ya tiene nombre y es **desactivarlo**.

**Ruta nueva y no `PATCH /api/staff/:userId`**: no existe hoy una ruta de edicion general del
integrante, y abrirla arrastraria decidir que mas se edita (el nombre, el handle). Fuera de
alcance.

#### 6. El mostrador exige `counter`

`api/counter/_auth.ts`: un caller con `role === 'staff'` y sin `counter` en sus permisos
recibe `403 missing_permission`. **Es un cambio de comportamiento** —hoy alcanza con ser
miembro— y por eso el backfill del §1 existe. El owner nunca lo necesita.

`operatorBusiness` (`counter/core.ts:93`) ya trae `role` desde el `innerJoin(memberships)`;
sumar `permissions` es **una columna mas en esa misma consulta**, y su docblock ya declara por
que eso no puede mover que fila resuelve el guard.

#### 7. Lo que NO se toca, y es una propiedad, no una omision

**El eje PLAN no entra en el guard.** Sigue en la transaccion que escribe, via `can()` /
`limitOf()` (ADR 0073 §1). Verificado: `EntitlementContext`
(`server/entitlements/index.ts:47`) es `{plan, pendingPlan, status, stripeSubscriptionId}` y
**no tiene nocion de usuario** — sale de la suscripcion del NEGOCIO. Un staff con `locations`
choca contra el mismo tope que el owner **sin una linea nueva**.

**El invariante que hay que defender es el inverso:** ninguna ruta migrada puede quedar con un
camino que llegue al `INSERT` sin pasar por el writer que evalua el plan. Tiene mutacion
propia en el plan de pruebas.

**Y `saveProgram` no se toca.** Su gate de crear-vs-editar vive en el writer desde la spec
0077 y depende del **permiso de alta de la sesion**, que un staff nunca tiene: un integrante
con `loyalty` **edita** el programa y **no puede crearlo**. Es correcto y queda declarado.

#### 8. Las dos lecturas

**`GET /api/merchant/session`**: `membership` gana `permissions: string[]`. Sigue siendo
**siempre 200** (spec 0074) y la regla de membresia no-`active` → `null` no cambia. Para
`role === 'owner'` se devuelve **el catalogo completo de los siete**, no `[]`: la UI pinta lo
que puede hacer, y un owner puede todo. La columna sigue en `'{}'` — la forma de la API y la
forma de la fila no tienen por que coincidir, y el CHECK 2 del §1 depende de que no coincidan.

**`BackofficeSession`** (`auth-guards.ts`) gana lo mismo, de la misma fila.

**El hueco de `suspended` en el guard de PAGINAS.** Hoy `auth-guards.ts:149` rebota solo con
`closed`, y `suspended` pasa **a proposito** para que el owner lea el motivo. Pasa a ser:
rebota si `businessStatus !== 'active'` **y** `role !== 'owner'`. El owner conserva su pantalla
de cuenta suspendida; el integrante no entra a un backoffice de un negocio que no opera.

### Arquitectura de referencia

ADR **0079** (esta spec implementa §1-§6 y §8) · ADR **0073** §1 (el orden de la escalera, y
que plan y estado son dos ejes) · ADR **0044** (roles y desactivar-sin-borrar) · ADR **0008**
(solo el owner administra su staff) · ADR **0070** §16-17 (esto entrega API y contrato
escrito, no interfaz) · spec **0072** (la consolidacion anterior de los mismos `_auth.ts`) ·
spec **0075** §D1 (por que una funcion hermana y no un flag) · spec **0074** (la sesion es
siempre 200).

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/drizzle/0041_permisos_del_staff.sql` + `meta/` | crear |
| `apps/merchant/src/server/schema/business.ts` | editar — columna + 3 CHECK |
| `apps/merchant/src/server/api-permission.ts` | **crear** — las dos funciones del §2 |
| `apps/merchant/src/server/staff-permissions.ts` | **crear** — parseo, R1-R4, writer |
| `apps/merchant/src/server/staff.ts` | editar — `StaffDTO.permissions`, `listStaff` |
| `apps/merchant/src/server/staff-create.ts` | editar — `permissions` en el alta |
| `apps/merchant/src/app/api/staff/[userId]/permissions/route.ts` | **crear** |
| `apps/merchant/src/app/api/staff/route.ts` | editar |
| `apps/merchant/src/app/api/{staff,locations,catalog,marketing}/_auth.ts` | editar — delegan al guard nuevo |
| `apps/merchant/src/app/api/counter/_auth.ts` | editar — permiso `counter` |
| `apps/merchant/src/app/api/brand/route.ts`, `brand/logo-upload/route.ts` | editar |
| `apps/merchant/src/app/api/loyalty-program/{route,qr/route,stamp-upload/route}.ts` | editar |
| `apps/merchant/src/app/api/loyalty-terms/templates/route.ts` | editar |
| `apps/merchant/src/server/session-view.ts`, `app/api/merchant/session/route.ts` | editar |
| `apps/merchant/src/server/auth-guards.ts` | editar — `permissions` + hueco `suspended` |
| `apps/merchant/src/server/api-owner-surfaces.test.ts` | editar — el inventario cerrado |
| `apps/merchant/src/server/{api-permission,staff-permissions}.test.ts` | crear |
| `apps/merchant/src/server/staff-permissions.neon.integration.test.ts` | crear |
| `docs/specs/0086-contratos-de-api.md` | crear |

### Disjunta?

**No.** Colisiona con la **spec B** (el log de auditoria) en las mismas diez superficies y en
`staff-permissions.ts`: B escribe su fila dentro de las transacciones que A deja migradas.
**Se serializan: A primero, B despues.** La **spec C** (archivado del catalogo) si es disjunta
de esta —toca `schema/catalog.ts` y los lectores del catalogo, que A no abre— pero conviene
correrla despues igual, porque cambia que significa «borrar» para el permiso `catalog`.

### Archivos compartidos

| Que | Quien lo deja listo | Cuando |
|---|---|---|
| `server/api-permission.ts` con sus dos funciones y sus types | el implementador, como **primer** paso | antes de tocar una sola ruta |

## Definition of Done

- [ ] La migracion `0041` corre contra una rama de Neon **con filas de staff preexistentes**,
      esas membresias quedan **borradas** y el `SELECT` posterior devuelve cero filas con
      `role='staff'`. Verificado por `SELECT`, no por lectura del `.sql`.
- [ ] La misma migracion corre contra una rama **sin** staff y el `delete` es un no-op: la
      migracion no falla y el conteo de `business_membership` no se mueve.
- [ ] Los tres `CHECK` **rechazan** sus tres estados invalidos, probados uno por uno con
      `INSERT`/`UPDATE` crudos: permiso desconocido, owner con permisos, staff con `'{}'`.
- [ ] `rg 'SinGateDeEmail' apps` devuelve **exactamente tres rutas**, y
      `api-owner-surfaces.test.ts` asevera ese conjunto como cerrado.
- [ ] Las cuatro superficies del ADR 0079 §8 siguen en `requireApiOwner`: verificado con
      `rg 'requireApiPermission' apps/merchant/src/app/api/billing apps/merchant/src/app/api/onboarding`
      → **vacio**.
- [ ] Un staff con `catalog` **crea y edita** producto y categoria, y recibe `403` en los dos
      `DELETE`. Los dos casos, no uno.
- [ ] R1, R3 y R4 tienen cada una su caso con el `code` exacto del contrato.
- [ ] Un staff **sin** `counter` recibe `403 missing_permission` en las **cuatro** rutas del
      mostrador; con `counter`, las cuatro le responden como hoy.
- [ ] `GET /api/merchant/session` devuelve los siete permisos para un owner y el conjunto
      exacto para un staff.
- [ ] Un staff de un negocio `suspended` recibe `403 business_suspended` de la API y el guard
      de paginas lo rebota; el **owner** del mismo negocio sigue viendo su motivo.
- [ ] Ninguna respuesta serializa el email sintetico ni el `pin_hash` (regla de `CLAUDE.md`,
      ya pinneada para `StaffDTO`): se re-verifica porque el DTO cambia de forma.
- [ ] Los cinco gates de root con Node 24. **`test:e2e` NO aplica**, y se demuestra con
      `git diff --name-only | rg '\.tsx$'` → vacio.
- [ ] `docs/specs/0086-contratos-de-api.md` completo, con los `code` nuevos y **el cambio de
      contrato de `not_owner` declarado**.
- [ ] `rg -n MUTATION apps tools` → vacio.

## Plan de pruebas y verificación

**Presupuesto de mutaciones: 6. Condicion de corte:** si dos vueltas seguidas terminan en «el
fix abrio la siguiente», se corta y se declara. La clase de error a cazar son los **plausibles
del QA del owner**: que un permiso no muerda, que muerda el equivocado, o que una regla
anti-escalada este escrita pero sin oraculo.

| # | Mutacion | Oraculo que TIENE que ponerse rojo |
|---|---|---|
| M1 | el paso 3 devuelve siempre `true` | el caso del staff sin el scope en cada una de las 7 familias |
| M2 | el paso 3 se evalua **antes** del paso 2 | el caso del no-miembro, que tiene que decir `not_member` y no `missing_permission` |
| M3 | el paso 4 deja de exceptuar al staff | el mostrador y una ruta migrada con un staff: mueren las dos |
| M4 | R1 permite que un no-owner otorgue `staff` | el caso de escalada: admin que se fabrica otro admin |
| M5 | R3 deja de comparar el `userId` del caller con el del target | el caso del auto-otorgamiento |
| M6 | el writer del catalogo se llama **sin** pasar por el evaluador del plan | el tope del plan para un caller **staff**, que es el invariante del §7 |

**Cada una con el protocolo del repo:** `shasum` limpio registrado ANTES de mutar, fila de
bitacora abierta ANTES de medir, etiqueta `MUTATION`, reversion verificada con `diff` contra
la copia limpia. La skill `protocolo-de-verificacion` es normativa.

**Aislamiento, y no es opcional:** un staff del negocio A con `catalog` recibe `404`/`403` —el
que ya dé esa ruta— sobre una entidad del negocio B. Un caso por familia, con el **control
positivo** en el mismo vector: la entidad propia sigue respondiendo `200`. Un rojo sin control
positivo no distingue «aislado» de «roto».

**Comandos exactos** (Node 24, scripts de ROOT):

```
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use
pnpm run typecheck && pnpm run lint && pnpm run format:check && pnpm run build
set -a; . ./.env.integration.local; set +a; pnpm run test
```

**Verificacion manual:** con un staff real creado por la API, entrar al mostrador **sin** el
permiso `counter` y **con** el; y leer `GET /api/merchant/session` con las dos membresias.

**Declarado afuera, con su motivo:**

- **La escalada residual del perfil administrador** (ADR 0079 §3): un admin obtiene los seis
  permisos no-`staff` por cuenta interpuesta. **No tiene fix en esta spec** — lo cierra el PIN
  fuera de banda (`PARQUEADO` 60). Se escribe un caso que la **documenta** ejecutandola, para
  que el dia que el PIN cambie de canal ese caso se ponga rojo y avise.
- **El log de auditoria**: spec B. Esta spec no asevera una sola fila de log.
- **`test:e2e`**: no aplica, cero `.tsx`, demostrado con `git diff`.

## Handoff requerido

UN implementador para toda la spec y UN revisor independiente al final (ADR 0071). El revisor
recibe el presupuesto de 6 y la condicion de corte **en el encargo**. Solo un `PASS`
verificable permite marcarla `implementada`.

## Abierto

**Nada. La spec esta `cerrada` (owner, 2026-09-20).**

Las cuatro decisiones que quedaban se tomaron antes de cerrarla, y ninguna es del agente:

1. Los dos endpoints reversibles del ADR 0079 §2 (`locations/:id/status`,
   `campaigns/:id/pause`) **van** con su permiso.
2. `GET /api/activity` lo lee **solo el owner** (ADR 0079 §7.6).
3. El **cambio de contrato** de `not_owner` esta medido y su radio hoy es **cero**: los unicos
   consumidores fuera de tests son `src/ui/api-error.tsx` y `wizard-shared.tsx`, y quien los
   importa es solo el **wizard de alta**, que corre contra `/api/onboarding/*` — superficie de
   la CUENTA, que conserva `not_owner`.
4. **Sin backfill**: la migracion borra las membresias de staff existentes (§1).
