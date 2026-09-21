---
spec: 0087
fecha: 2026-09-21
estado: cerrada
resumen: Nace `PATCH /api/staff/{userId}` y edita **solo el nombre**. Como el identificador sigue al nombre (ADR 0080), el renombre **re-deriva el handle** y por lo tanto CAMBIA con que string entra esa persona: la respuesta devuelve siempre el `identifier` nuevo y el contrato lo declara. La re-derivacion pasa por `nextSuggestion` —asi hereda las reservadas y el sufijo de colision— y **excluye el handle actual del target**, sin lo cual cada renombre bumpearia el sufijo. La ruta **RECHAZA con 400 `permissions_not_here`** un cuerpo que traiga `permissions` en vez de ignorarlo: `PATCH …/permissions` queda INTACTA y las dos politicas de autorizacion nunca se tocan en el mismo camino de codigo. Uno mismo SI edita su propio nombre (R3 no se extiende), pero R4 sigue: la membresia del owner no se toca. Sin migracion: la columna `handle` ya existe y ya es unica por negocio.
disjunta: si
archivos: apps/merchant/src/server/staff-rename.ts, apps/merchant/src/app/api/staff/[userId]/route.ts, apps/merchant/src/server/staff-create.ts, docs/specs/0087-contratos-de-api.md
---

# 0087 — Editar el nombre del integrante

> **Plantilla CHICA (ADR 0071).** Valen las tres: **un solo dominio** (staff), **sin
> migraciones** (la columna `handle` ya existe y ya es unica), **sin decision de producto
> abierta** (ADR 0080, decidido por el owner el 2026-09-21).
>
> **Nada de codigo empieza sin esta spec en `cerrada`.**

## Problema

**No hay forma de editar a un integrante.** Medido sobre el arbol el 2026-09-21: bajo
`app/api/staff/` hay **cinco** `route.ts` y los metodos que exponen son `GET`+`POST` en la raiz,
`PATCH` en `…/permissions`, y `POST` en `…/status`, `…/pin` y `…/pin/regenerate`. **No existe
`PATCH /api/staff/{userId}`**.

Consecuencias concretas:

- **Un nombre mal escrito en el alta no se arregla.** Y como **tampoco hay `DELETE
  /api/staff`**, la unica salida es desactivarlo y crear otro, con PIN nuevo.
- **El error se fosiliza en el identificador.** El `handle` se deriva **una sola vez** en el alta
  (`staff-create.ts:121`, `freeHandle(business.id, input.name)`), asi que «Crla» queda como
  `crla@slug` para siempre — y ese string es el que la persona **tipea para entrar**
  (`api/merchant/auth/staff/route.ts:194`, `eq(memberships.handle, handle)`).

## Alcance

**Entra:**

- `PATCH /api/staff/{userId}` con `{ "name": "…" }`, que **re-deriva el handle** y devuelve el
  `StaffDTO` completo con el `identifier` nuevo.
- El **rechazo explicito** de `permissions` en esa ruta (`400 permissions_not_here`).
- Extraer la derivacion del handle a una funcion reusable **con exclusion del target**.
- El contrato HTTP escrito: `docs/specs/0087-contratos-de-api.md`.

**No entra:**

- **Fusionar el nombre con los permisos.** `PATCH …/permissions` **no se toca ni una linea**
  (ADR 0080 §2). Si el implementador siente la tentacion de unificar, es señal de estar fuera de
  alcance.
- **Cambiar el identificador SIN cambiar el nombre.** Hoy no se puede y no se pidio (ADR 0080,
  Consecuencias).
- **`DELETE /api/staff`.** Dar de baja sigue siendo `POST …/status`.
- **Cualquier `.tsx`.** La UI la construye el owner por fuera (ADR 0070 §16-17). Consecuencia
  declarada: **`pnpm test:e2e` NO aplica**, y se demuestra con `git diff`, no se asume.
- **Migraciones.** Ninguna.

## Diseño

### 1. La re-derivacion, y LA TRAMPA que hay que cerrar

`freeHandle` (`staff-create.ts:83-90`) lee **TODOS** los handles del negocio:

```ts
.where(eq(memberships.businessId, businessId));   // sin excluir a nadie
return nextSuggestion(slugify(name), taken);
```

**Reusada tal cual para renombrar, esta MAL.** Renombrar «Carla» a «Carla» (o a cualquier nombre
que slugifique igual) veria su **propio** `carla` como ocupado y devolveria `carla-2` —
bumpeando el sufijo en **cada** renombre hasta el infinito.

**La funcion pasa a aceptar un `excludeUserId` opcional.** Con el, ese handle sale de `taken`;
sin el, el comportamiento es **byte por byte el del alta**, que no se toca. El alta sigue
llamandola sin el parametro.

**Lo que NO se reimplementa, y es la razon tecnica de que el handle no sea un campo libre:** la
derivacion sigue pasando por **`nextSuggestion`** (`slug.ts:87`), que trata `RESERVED` como
ocupadas (`slug.ts:91`) y sufija ante colision. Escribir el handle a mano habria obligado a
reconstruir las dos cosas y habria permitido pedirse `admin`.

**TOCTOU asumido, igual que en el alta:** la lectura de `taken` y el `UPDATE` no son atomicos. La
unicidad la garantiza `core_business_membership_handle_unique` y el choque se traduce a
**`409 handle_taken`**, el mismo `code` que ya usa el alta (`staff-create.ts:184`).

### 2. Autorizacion — que se reusa y que NO

| Regla | Aplica | De donde sale |
|---|---|---|
| Guard de la ruta | `requireStaffAccess` | el mismo de `…/permissions` y `…/pin/regenerate` |
| **R3** (nadie se edita a si mismo) | **NO aplica** | ADR 0080 §3: al nombre **si** se lo edita uno mismo |
| **R4** (no se toca la membresia del owner) | **SI aplica**, `409 target_is_owner` | mismo `code` y status que `setStaffStatus` (`staff.ts:241`) |
| Inexistente o de otro negocio | `404 staff_not_found` | **la misma respuesta para los dos**, a proposito (`staff.ts:236`) |

**R1 y R2 no aparecen**: son reglas sobre `permissions`, y esta ruta **no acepta `permissions`**.

**Aislamiento:** el `UPDATE` lleva `business_id` en el `WHERE`, resuelto **desde la SESION** y
nunca del cuerpo (mismo patron que `…/pin/regenerate`). Un caller del negocio A apuntando a un
staff de B **no matchea ninguna fila → 404**, no 403: un 403 confirmaria que ese id existe.

### 3. El cuerpo, y el rechazo que es el punto de la spec

```jsonc
{ "name": "Carla Gómez" }
```

`name`: string, `trim()`, **1 a 80** caracteres — **exactamente los mismos limites Y LOS MISMOS
`code` del alta**, no unos nuevos: cuerpo que no es objeto → `400 invalid_body`; vacio o solo
espacios → `400 name_required`; mas de 80 → `400 name_too_long` (`staff-create.ts:33-41`).
**No se inventa un `invalid_name`**: la UI ya mapea estos tres.

**Si el cuerpo contiene la clave `permissions`, la ruta responde `400 permissions_not_here`.**

- **Se chequea la PRESENCIA DE LA CLAVE, no su valor.** `"permissions" in body` — tambien si
  viene `null`, `[]` o identica a la actual. «Es el mismo valor, es un no-op» es exactamente el
  bypass que esta regla existe para cerrar.
- **Se rechaza, NO se ignora.** Un descarte silencioso haria que la UI crea haber guardado
  permisos que nadie guardo (ADR 0080 §2).

### 4. La respuesta `200`

El `StaffDTO` completo, la **misma forma** que devuelven el alta y `…/permissions`, **sin `pin`**:

```jsonc
{ "staff": { "userId": "…", "name": "Carla Gómez", "identifier": "carla-gomez@la-farmacia",
             "role": "staff", "status": "active", "permissions": ["catalog","counter"],
             "createdAt": "…" } }
```

**El `identifier` nuevo viaja SIEMPRE**, aunque no haya cambiado. Es la condicion que el ADR 0080
§1 pone para que la decision no sea una trampa silenciosa: **renombrar cambia con que string
entra esa persona**, y la UI tiene que poder decirselo.

**No se serializa** el email sintetico ni `pin_hash` (regla de `CLAUDE.md`).

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/server/staff-rename.ts` | **crear** — el writer y la derivacion con exclusion |
| `apps/merchant/src/app/api/staff/[userId]/route.ts` | **crear** — la ruta `PATCH` |
| `apps/merchant/src/server/staff-create.ts` | editar — `freeHandle` gana `excludeUserId` opcional y se exporta |
| `docs/specs/0087-contratos-de-api.md` | **crear** |

**Disjunta?** **Si.** No colisiona con la spec B (activity log) ni con la C (archivado del
catalogo): no comparte archivo con ninguna. **`staff-permissions.ts` NO se toca.**

**Ojo con `staff-create.ts`:** tiene **`file-size`** encima. Si al exportar `freeHandle` el
archivo pasa el limite, **se divide** (mover la derivacion a `staff-rename.ts` y que el alta la
importe desde ahi), no se extiende.

## Definition of Done

- [ ] `PATCH /api/staff/{userId}` con `{"name":"Carla Gómez"}` sobre un staff `carla` devuelve
      **200** y `identifier` = `carla-gomez@<slug>`, **leido de la base**, no del cuerpo de la
      respuesta.
- [ ] **Renombrar a un nombre que slugifica IGUAL no bumpea el sufijo**: «Carla» → «Carla»
      devuelve `carla@…`, **no** `carla-2`. Repetido **dos veces seguidas** sigue en `carla`.
- [ ] Renombrar a un nombre cuyo handle **ya esta tomado por OTRO** integrante sufija
      (`marcos` → `marcos-2`), y un nombre que slugifica a una **reservada** tampoco la toma.
- [ ] `{"name":"Carla","permissions":["staff"]}` → **400 `permissions_not_here`**, y **la base no
      cambio**: ni el nombre, ni el handle, ni los permisos. Idem con `"permissions": null` y
      con `"permissions": []`.
- [ ] Un staff **se renombra a si mismo** → 200 (R3 **no** aplica), y su `identifier` nuevo viaja
      en la respuesta.
- [ ] El `userId` del **owner** → **409 `target_is_owner`**.
- [ ] Un staff de **otro negocio** → **404 `staff_not_found`**, con **control positivo** en el
      mismo vector: el propio sigue devolviendo 200.
- [ ] `name` vacio y solo espacios → **400 `name_required`**; **81** caracteres → **400
      `name_too_long`**; **80** → 200. Son los `code` del alta, no unos nuevos.
- [ ] Ninguna respuesta serializa el email sintetico ni `pin_hash`.
- [ ] **`PATCH …/permissions` no tiene una sola linea de diff**:
      `git diff --stat -- apps/merchant/src/app/api/staff/\[userId\]/permissions apps/merchant/src/server/staff-permissions.ts`
      → **vacio**.
- [ ] El **alta no cambio de comportamiento**: `staff-create*.test.ts` y
      `staff.neon.integration.test.ts` pasan **sin editarlos** (`git status` sobre ellos → vacio).
- [ ] Gates de root con Node 24, una sola vez al final: `typecheck`, `lint`, `test`,
      `format:check`, `build`. **Forzar con `TURBO_FORCE=1`**, no con `-- --force`.
- [ ] `test:e2e` **NO aplica**, demostrado: `git diff --name-only | rg '\.tsx$'` **y** los `??` →
      vacio.
- [ ] `rg -n MUTATION apps tools` → vacio.

## Mutaciones — presupuesto: 5. Clase: los plausibles del QA del owner

**Las cinco se verificaron contra el arbol antes de cerrar la spec** (regla de `CLAUDE.md`): el
mecanismo que cada una nombra existe y tiene archivo y linea.

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| M1 | la ruta deja de chequear `"permissions" in body` | el caso del cuerpo con `permissions`, que tiene que dar **400 `permissions_not_here`** — es LA regla de la spec |
| M2 | el chequeo de M1 pasa de **presencia de clave** a **valor distinto del actual** | el caso que manda **los permisos ACTUALES** junto al nombre: tiene que seguir siendo 400 |
| M3 | la derivacion pierde el `excludeUserId` (vuelve a `freeHandle` pelado) | «Carla» → «Carla» devuelve `carla-2`: el caso del sufijo que no debe bumpear |
| M4 | la derivacion deja de pasar por `nextSuggestion` (usa `slugify` pelado) | el caso de la colision con otro integrante **y** el de la palabra reservada |
| M5 | el `UPDATE` pierde el `business_id` del `WHERE` | el caso de aislamiento (staff de B desde A), **con su control positivo** |

**Protocolo:** `shasum` limpio antes de mutar → fila de bitacora **antes** de medir → etiqueta
`MUTATION` → medir y **transcribir la salida ejecutada** → revertir con `diff` contra la copia
limpia. De a una. **Leer la asercion del rojo**: un rojo por el setup no prueba nada, y en la
0086 **tres** mutaciones quedaron verdes por un seed irreal.

**Ojo con el seed, que es la leccion fresca de la 0086:** `seedMember` ahora nace con
`emailVerified: false`, que es la forma de produccion. **No lo cambies para que un caso pase.**

**Condicion de corte:** si dos vueltas seguidas terminan en «el fix abrio la siguiente», se corta
y va al owner. Lo que queda afuera se **declara**.

## Declarado AFUERA (sin oraculo, a proposito)

- **Cambiar el identificador sin cambiar el nombre.** No se puede y no se pidio (ADR 0080).
- **`DELETE /api/staff`.** No existe; dar de baja es `POST …/status`.
- **Que el integrante se entere de su identificador nuevo.** Es trabajo de **UI**: la API lo
  devuelve en cada respuesta y el contrato lo declara, pero **nadie le notifica nada** al
  integrante. Es la consecuencia aceptada del ADR 0080 §1 y **va al QA del owner en pantalla**.
- **La sesion activa del integrante sobrevive al renombre** — medido: el login resuelve el handle
  solo para **encontrar** al usuario, y la sesion es por `userId`. No se le escribe caso porque
  no hay codigo nuevo que pueda romperlo.

## Handoff

**UN implementador para toda la spec, UN revisor independiente al final** (ADR 0071). El revisor
recibe el presupuesto de **5** y la condicion de corte **en el encargo**. Solo un `PASS`
verificable permite marcarla `implementada`.

## Abierto

**Nada. La spec esta `cerrada`** (owner, 2026-09-21). Las cuatro decisiones se tomaron antes de
escribir esta prosa y estan en el **ADR 0080**: el identificador sigue al nombre; dos rutas
separadas y nunca una fusionada; la ruta del nombre **rechaza** `permissions` en vez de
ignorarlos; y uno mismo **si** edita su propio nombre.
