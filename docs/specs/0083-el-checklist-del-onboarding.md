---
spec: 0083
fecha: 2026-09-20
estado: borrador
resumen: `GET /api/onboarding/checklist` — el checklist del onboarding del ADR 0070 §9, que estaba diferido desde la 0074. Arranca con UN item (`verify-email`), cuyo hecho ya viaja en la sesion y cuya accion ya existe. La API dicta `position` y `required` (la UI no tiene lista propia) y el texto viaja en la respuesta con `locale: "es"` fijo y declarado. NO lleva gate de email —un endpoint que dice «verifica tu email» no puede estar bloqueado por no haberlo verificado— y por eso no usa `requireApiOwner`: reusa `ownerContext` y `businessStatusFailure` y recorre la escalera del ADR 0073 §1 salteando SOLO el paso 3. Sin migracion: el catalogo de items es codigo tipado, como `ENTITLEMENTS`.
disjunta: si
archivos: apps/merchant/src/server/onboarding/checklist.ts, apps/merchant/src/app/api/onboarding/checklist/route.ts, apps/merchant/src/server/onboarding/checklist.test.ts, apps/merchant/src/server/onboarding-checklist.neon.integration.test.ts
---

# 0083 — El checklist del onboarding

> **Plantilla CHICA (ADR 0071).** Las tres condiciones valen: **un solo dominio**
> (onboarding), **sin migraciones** (el catalogo de items es codigo) y **sin decision de
> producto abierta** (las seis se cerraron en el ADR 0077, 2026-09-20).
>
> **Arquitectura de referencia: ADR 0077**, que decide todo lo que esta spec implementa. Si
> algo de aca contradice al 0077, manda el 0077.

## Problema

- **El checklist del ADR 0070 §9 no existe.** Esta declarado como diferido en
  `docs/specs/0074-contratos-de-api.md` §3: *«El checklist derivado del ADR 0070 §9 (logo,
  colores, costos, staff, wallet) no existe y esta diferido, con seis decisiones del owner
  abiertas»*. Las seis se cerraron en el ADR 0077.
- **`GET /api/onboarding/state` no puede hacer de checklist y lo dice en su propio docblock**
  (`app/api/onboarding/state/route.ts:26-31`): su alcance es «que falta para terminar el
  alta», corre **antes** de la verificacion de email y **no lleva gate a proposito** (ADR 0070
  §11). Es del wizard, no de despues del wizard.
- **El primer paso del onboarding no tiene superficie que lo reporte.** El ADR 0070 §11 dice
  que *«el primer paso del onboarding es verificar el email, y sin eso no avanza el resto»*,
  y la accion existe (`POST /api/merchant/auth/verify-email`), pero **ninguna ruta le dice a
  la UI que ese paso esta pendiente**. La spec 0082 saco el rebote de la puerta justamente
  para que el owner pudiera ver ese paso desde adentro; falta lo que se lo muestre.

## Alcance

**Entra:**

- `GET /api/onboarding/checklist`, con **un** item: `verify-email`.
- El catalogo de items como **constante tipada en codigo** (ADR 0077 §4).
- El guard del ADR 0077 §6: escalera del ADR 0073 §1 **salteando solo el paso 3**.
- El contrato HTTP escrito: `docs/specs/0083-contratos-de-api.md` (ADR 0070 §16).

**No entra:**

- **Ninguna pantalla.** Esta spec no toca un solo `.tsx` (ADR 0070 §16: el arco entrega API,
  la UI la construye el owner por fuera).
- **El recurso de tutorial** (`/api/onboarding/guide/{item}`). No existe y se diseña cuando
  exista el primer tutorial real (ADR 0077 §5).
- **Los items 2 a 5** (catalogo, staff, programa, marca). Cada uno con la spec de su feature.
- **Tabla de configuracion, migracion o superficie de escritura.** ADR 0077 §4.
- **Eleccion de idioma.** `locale: "es"` fijo y declarado (ADR 0077 §3).
- **Tocar `GET /api/onboarding/state`**, que sigue como esta.

## Diseño

### D1 — El catalogo de items, en codigo

`apps/merchant/src/server/onboarding/checklist.ts`, con la forma de `ENTITLEMENTS`
(`entitlements/catalog.ts`): objeto `as const satisfies Record<string, ChecklistItemDef>`, de
modo que **una entrada mal formada no compila**.

```ts
type ChecklistFacts = { emailVerified: boolean };

type ChecklistItemDef = {
  position: number;
  required: boolean;
  /** Clave ESTABLE que la UI mapea a un elemento. NUNCA un selector ni una coordenada
   *  (ADR 0077 §3): si la API guardara coordenadas, cada rediseño de UI romperia el tour
   *  en produccion sin poner rojo a nadie. */
  anchor: string;
  title: string;
  body: string;
  /** El «¿esta hecho?». Es una funcion y no un dato porque cada item lo deriva de un hecho
   *  distinto — por eso agregar un item va a exigir deploy aunque el catalogo mude a tabla
   *  algun dia (ADR 0077 §4). */
  done: (facts: ChecklistFacts) => boolean;
};
```

Una sola entrada:

| id | position | required | anchor | done |
|---|---|---|---|---|
| `verify-email` | `1` | `true` | `"verify-email"` | `(f) => f.emailVerified` |

El `title` y el `body` son copia en español y **no son contrato** — lo que la UI puede dar por
estable es el `id` y el `anchor`.

`required: true` significa **exactamente** lo que dicto el owner: un item `required` que no
esta `done` bloquea a todos los de `position` mayor. **No hay un segundo campo** que separe
«obligatorio» de «bloqueante»: hoy no hay caso que los distinga (ADR 0077 §2).

### D2 — La funcion pura que arma la vista

```ts
export function toChecklistView(facts: ChecklistFacts): ChecklistView
```

Devuelve `{ locale: "es", items: [...] }` con los items **ordenados por `position` ascendente**
y cada uno con su `done` ya resuelto. Es pura: no toca base ni sesion, asi que su test no
necesita Neon. El `sort` por `position` **se hace en la funcion y no se asume del orden de
declaracion** del objeto — el dia que el catalogo mude a tabla, el orden de las filas no esta
garantizado, y un `sort` que ya esta ahi es lo que evita que ese dia el bug sea silencioso.

### D3 — La ruta y su guard

`apps/merchant/src/app/api/onboarding/checklist/route.ts`, `export const dynamic = "force-dynamic"`.

**La escalera, y el salteo es el punto de la spec** (ADR 0077 §6 / ADR 0073 §1):

| Paso | Chequeo | Respuesta | Pieza reusada |
|---|---|---|---|
| 1 | ¿hay sesion? | **401** `unauthorized` | `getMerchantAuth().api.getSession` |
| 2 | ¿owner con membresia `active`? | **403** `not_owner` | **`ownerContext`** (`server/staff.ts`) |
| 3 | ¿email verificado? | **SE SALTEA** | — |
| 4 | ¿el negocio opera? | **403** `business_suspended` \| `business_closed` | **`businessStatusFailure`** (`server/business-status.ts`, funcion pura) |
| — | todo bien | **200** con la vista | `toChecklistView` |

**Por que no se usa `requireApiOwner`:** su escalera evalua el email en el paso 3 **siempre** y
no admite saltarlo (`api-owner.ts:30-40`, verificado). Usarlo devolveria 403
`email_not_verified` justo al owner que viene a que le digan que verifique el email.

**Y por que NO se escribe un resolvedor nuevo:** seis resolvedores divergidos es el agujero
que mato la spec 0072 y no se reabre. Se reusan las **mismas** piezas compartidas
(`ownerContext`, `businessStatusFailure`, `API_OWNER_CODES`); lo unico propio de esta ruta es
**el orden en que las llama**, con el paso 3 ausente.

**El paso 4 NO se saltea**, a proposito: saltear el 3 tiene una razon (auto-gateo), saltear el
4 no tendria ninguna.

**El `code` es el contrato, el `error` es copia** (convencion de los contratos 0072/0074/
0078/0079/0081). Los cuatro `code` de fallo salen de `API_OWNER_CODES`, sin inventar ninguno,
**menos `email_not_verified`, que esta ruta NO puede emitir nunca.**

Fallo de base → **503** `onboarding_unavailable`.

### D4 — Costo de la lectura

`emailVerified` sale de la sesion de better-auth: **cero consultas extra**. La unica consulta
es la de `ownerContext`, que es la misma que hace cualquier superficie de owner. Total:
**una consulta**, igual que las demas.

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/server/onboarding/checklist.ts` | crear |
| `apps/merchant/src/app/api/onboarding/checklist/route.ts` | crear |
| `apps/merchant/src/server/onboarding/checklist.test.ts` | crear |
| `apps/merchant/src/server/onboarding-checklist.neon.integration.test.ts` | crear |
| `docs/specs/0083-contratos-de-api.md` | ya escrito (anexo de esta spec) |

**Disjunta?** **Si.** No hay otra spec en ejecucion; los archivos son todos nuevos y ninguna
ruta existente se edita.

## Definition of Done

- [ ] **Un owner SIN el email verificado recibe 200**, con `items[0].id === "verify-email"`,
      `done: false`, `required: true`, `position: 1`. **Este es el caso central de la spec:**
      es la prueba de que la ruta no se gatea a si misma.
- [ ] **Un owner CON el email verificado recibe 200** con el mismo item y `done: true`.
- [ ] **Sin sesion → 401** con `code: "unauthorized"`.
- [ ] **Un integrante (`role='staff'`) → 403** con `code: "not_owner"`, y **no** con
      `email_not_verified`.
- [ ] **Un negocio `closed` → 403** `business_closed`; **`suspended` → 403**
      `business_suspended`.
- [ ] **La ruta no emite `email_not_verified` en ningun camino:**
      `rg -n 'email_not_verified' apps/merchant/src/app/api/onboarding/checklist/` → **vacio**.
- [ ] **No se escribio un resolvedor nuevo:**
      `rg -n 'ownerContext|businessStatusFailure' apps/merchant/src/app/api/onboarding/checklist/route.ts`
      → las dos presentes; `rg -n 'innerJoin|getDb' .../route.ts` → **vacio** (la ruta no
      consulta por su cuenta).
- [ ] **`toChecklistView` ordena por `position`** aunque las entradas lleguen desordenadas
      (test de la funcion pura, sin Neon).
- [ ] **Ningun `.tsx` tocado:** `git status --porcelain | grep -c '\.tsx$'` → **0**.
- [ ] Gates de root con Node 24, **una sola vez al final**: `typecheck`, `lint`, `test`,
      `format:check`, `build`.
- [ ] **`test:e2e` NO aplica y se DECLARA** con el barrido de `.tsx` de arriba (esta spec no
      toca UI, ni CSS global, ni pantalla de `/backoffice`).
- [ ] `rg -n MUTATION apps tools` → vacio.

## Mutaciones — presupuesto: 5. Clase: los plausibles

La clase de error a cazar es **que el guard deje pasar a quien no debe, o bloquee a quien la
ruta existe para servir**, y **que `done` no sea vacuo**.

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| 1 | Agregar el gate de email a la ruta (o cambiar `ownerContext` por `requireApiOwner`) | El caso «owner SIN verificar recibe 200 con su item» → debe dar 403 `email_not_verified`. **Es la mutacion que prueba que el invariante central tiene oraculo** |
| 2 | Sacar el chequeo de owner (paso 2) | El caso del integrante → debe pasar de 403 `not_owner` a 200 |
| 3 | `done: () => true` en la entrada | El caso «owner sin verificar» → `done` debe quedar en `true` y romper la asercion |
| 4 | `done: () => false` en la entrada | El caso «owner verificado» → `done` debe quedar en `false`. **La 3 y la 4 juntas** son las que prueban que `done` lee el hecho y no devuelve una constante |
| 5 | Sacar `businessStatusFailure` (paso 4) | Los casos `closed` y `suspended` → deben pasar de 403 a 200 |

**Protocolo:** `shasum` limpio antes de mutar → fila de bitacora **antes** de medir → etiqueta
`MUTATION` → medir y **transcribir la salida ejecutada** → revertir con `diff` contra copia
limpia. De a una. **Leer la asercion del rojo**: un rojo por el setup no prueba nada.

**Ojo con la M1 y la M2:** las dos pueden dar rojo «por el motivo equivocado» si el test de
staff y el de owner-sin-verificar comparten seed. Verificar que el rojo de la M1 es el caso
del **owner** y el de la M2 es el del **integrante**, leyendo el nombre del test, no el conteo.

**Condicion de corte:** si dos vueltas seguidas terminan en «el fix abrio la siguiente», se
corta y va al owner. Lo que queda afuera se **declara**.

## Declarado AFUERA (sin oraculo, a proposito)

- **El idioma.** `locale: "es"` es una constante; no hay caso que lo mueva porque no hay
  columna de idioma del merchant en ninguna tabla (medido). No se testea la eleccion de
  idioma porque no hay eleccion.
- **Que la UI respete `position` y `required`.** Es comportamiento de la UI, que esta spec no
  construye. El contrato lo dice; el oraculo lo tendra el QA de pantalla del owner.
- **El texto (`title`, `body`).** Es copia, no contrato. Un test que lo asevere se rompe con
  cada ajuste de redaccion sin que nada este mal.
- **El comportamiento con dos o mas items** (orden entre items, bloqueo en cadena). **Hoy hay
  un item y no se puede falsificar con uno solo.** El unico pedazo que si se cubre es el
  `sort` por `position` de `toChecklistView`, que se testea con entradas sinteticas
  desordenadas.

## Handoff

**UN implementador para toda la spec, UN revisor independiente al final** (ADR 0071). El
revisor produce un `PASS` con evidencia ejecutada antes de marcar `implementada`.

**Para el revisor, el foco:** que la M1 este realmente medida y que su rojo sea el caso del
owner sin verificar. Toda la spec existe para esa propiedad; si esa mutacion no muerde, el
resto no importa.

## Abierto

Nada bloqueante. Las seis decisiones que estaban abiertas desde la 0074 se cerraron en el
**ADR 0077** el 2026-09-20.
