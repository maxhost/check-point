---
spec: 0072
fecha: 2026-09-17
estado: anexo
resumen: Contrato HTTP normativo de la spec 0072 — los cinco `code` del gate unificado del owner (`unauthorized`, `not_owner`, `email_not_verified`, `business_suspended`, `business_closed`) con su status, las 33 rutas que los emiten, el eje `status` en el mostrador, los dos logins y el enrolamiento publico, y los codigos de rebote del backoffice. Es lo que consume quien construye la UI por fuera (ADR 0070 §16) y es el oraculo del revisor. Declara ademas, como ESTADO ACTUAL y no como decision, que `POST /api/staff/:userId/pin` NO es una superficie del owner, y declara el eje `status` de `POST /api/onboarding/program`, que se gateo EN EL WRITER (`saveProgram`) porque es un writer con dos puertas.
---

# 0072 — Contrato de API: entitlements y estado del negocio

> **Este documento es un entregable, no documentacion opcional** (spec 0072 §Alcance /
> ADR 0070 §16-17). Un endpoint sin su fila aca **no esta terminado**, y un `code` que el
> contrato declara y la ruta no emite —o al reves— es un FAIL de revision. Mismo rol
> normativo que `0055-contratos-del-orquestador.md`, `0067-contratos-de-api.md` y
> `0069-contratos-de-api.md`.
>
> **El arco entrega API, NO interfaz.** La UI la construye el owner por fuera; este archivo
> es su insumo. **No hay ninguna pantalla nueva en la spec 0072** y el diff no toca un solo
> `.tsx`.

## Convenciones

- `content-type: application/json` en la entrada y en la salida, salvo los dos endpoints de
  imagen (`brand/logo-upload` y `loyalty-program/qr` devuelven bytes en el camino feliz; sus
  **errores** si son JSON).
- **Todo fallo del gate del owner responde
  `{ "error": "<texto en español>", "code": "<codigo estable>" }`**, y ademas
  `"suspensionReason": "<texto>"` **solo** en `business_suspended`. El `code` es el contrato;
  el `error` es copia y la UI puede reescribirlo.
- **La clave del motivo en el cuerpo es `suspensionReason` (camelCase)**, la convencion de
  este API (`archiveCount`, `deactivateCount`, `retryAfterSeconds`, `mustChangePin`). La spec
  0072 lo nombra `suspension_reason` porque asi se llama **la columna**
  (`core.business.suspension_reason`); son el mismo dato. Esta declarado aca para que la UI no
  tenga que adivinar cual de las dos ortografias viaja.
- La autenticacion del owner es la **cookie de sesion de better-auth**
  (`better-auth.session_token`, `HttpOnly`). Ninguna ruta acepta un token por header.
- **Ningun identificador de negocio viaja en el cuerpo ni en el query de una ruta
  autenticada**: siempre sale de la sesion (ADR 0070 §15.3).

---

## 1. Los cinco `code` del gate del owner, y su ORDEN

`server/api-owner.ts` (`requireApiOwner`) es el resolvedor de owner de las **32 superficies
autenticadas del owner** que esta spec unifica. **NO es el unico resolvedor de owner que existe
en el API**, y la diferencia importa para quien construye la UI: las tres rutas del wizard
(`api/onboarding/{business,program,prefill}`) resuelven la sesion a mano y **quedaron fuera de
esta spec** — ver la lista de exclusiones al final de §1.
Evalua en este orden, y **el orden es contrato** (ADR 0073 §1), no una optimizacion:

| # | Pregunta | Status | `code` | ¿lleva `suspensionReason`? |
|---|---|---|---|---|
| 1 | ¿hay sesion? | **401** | `unauthorized` | no |
| 2 | ¿es owner con membresia `active`? | **403** | `not_owner` | no |
| 3 | ¿tiene el email verificado? | **403** | `email_not_verified` | no |
| 4 | ¿el negocio opera? (`suspended`) | **403** | `business_suspended` | **SI** (si la columna no es NULL) |
| 4 | ¿el negocio opera? (`closed`) | **403** | `business_closed` | no |

**Lo que la UI tiene que saber, y es contrato:**

1. **Un INTEGRANTE (no owner) recibe SIEMPRE `not_owner`**, aunque su email no este
   verificado y aunque el negocio este suspendido. El email de un integrante es sintetico
   (`staff-<uuid>@staff.invalid`) y **no se verifica nunca**, asi que `email_not_verified`
   le pediria hacer algo que no puede hacer; y `business_suspended` le contaria a un tercero
   el estado de un negocio ajeno.
2. **`email_not_verified` y `business_suspended` son estados DISTINTOS con acciones
   distintas.** El primero se resuelve con `POST /api/merchant/auth/verify-email`; el segundo
   **no lo resuelve el owner**: es una decision de la plataforma y lo unico que la pantalla
   puede ofrecer es el motivo (`suspensionReason`) y un contacto.
3. **`business_suspended` NO es un problema de plan.** No mostrar «mejora tu plan»: los dos
   ejes son ortogonales (ADR 0073). Los codigos del eje plan son otros — ver §5.
4. **El gate es fail-closed**: una sesion sin la clave `emailVerified` recibe
   `email_not_verified`, y un `status` que no sea `active` ni `closed` recibe
   `business_suspended`.

### 1.1 Las 33 rutas que emiten estos cinco codigos — con UNA excepcion declarada

Todas resuelven por `requireApiOwner`, directa o vía el `_auth.ts` de su dominio. **La unica
excepcion es `GET /api/loyalty-program/qr`** (spec 0075): resuelve por
`requireApiOwnerSinGateDeEmail` y por eso emite **cuatro** de los cinco codigos, no los cinco.
El detalle, abajo de la tabla.

| Grupo | Rutas | Resolvedor |
|---|---|---|
| `api/billing` | `checkout`, `cancel`, `interval`, `settle-free` (4) | `billing/_auth.ts` → `requireBillingOwner` |
| `api/catalog` | `/`, `category`, `category/[id]`, `product`, `product/[id]`, `product/image-upload`, `stock/search` (7) | `catalog/_auth.ts` → `requireOwner` |
| `api/locations` | `/`, `[locationId]`, `[locationId]/status` (3) | `locations/_auth.ts` → `requireLocationsOwner` |
| `api/marketing` | `campaigns`, `campaigns/[id]`, `campaigns/[id]/{activate,pause,end,archive,results}`, `audience-preview` (8) | `marketing/_auth.ts` → `requireMarketingOwner` |
| `api/staff` | `/`, `[userId]/status`, `[userId]/pin/regenerate` (3) | `staff/_auth.ts` → `requireStaffOwner` |
| `api/brand` | `/`, `logo-upload` (2) | `requireApiOwner` directo |
| `api/loyalty-program` | `/`, `stamp-upload` (2) | `requireApiOwner` directo |
| `api/loyalty-program` | **`qr` (1)** | **`requireApiOwnerSinGateDeEmail`** — los pasos 1, 2 y 4, **sin el 3** (spec 0075) |
| `api/loyalty-terms` | `templates` (1) | `requireApiOwner` directo |
| `api/merchant/business` | `slug` (1) | `staff/_auth.ts` → `requireStaffOwner` |
| **Total** | **32 rutas** — las 33 del barrido del DoD **menos** `api/staff/[userId]/pin`, que no es del owner (ver abajo) | |

**⚠️ `GET /api/loyalty-program/qr` NO EMITE `email_not_verified`, Y ES CONTRATO (spec 0075).**
Emite los otros cuatro codigos **enteros y en el mismo orden**: `401 unauthorized`,
`403 not_owner`, `403 business_suspended` (con su `suspensionReason`) y `403 business_closed`,
mas el fail-closed del `status` desconocido. Lo unico que no corre es el paso 3.

**Por que:** la pantalla del QR es la **cuarta del wizard** (ADR 0070 §1: `→ | Tu QR | nada: es
la recompensa | ya generado`) y el owner dicto que la verificacion bloquea *«todo lo que venga
DESPUES del wizard»* (ADR 0070 §11). Una cuenta nueva llega ahi con `email_verified: false`
**por construccion**, asi que el paso 3 volvia inalcanzable el resultado del propio alta. Es la
misma razon por la que `POST /api/onboarding/program` y `GET /api/onboarding/state` tampoco lo
llevan. **La excepcion es de esa ruta y de ninguna otra**: las 11 entradas HTTP restantes
conservan los cinco codigos.

**Lo que esto NO cambia para la UI:** un 403 de esa ruta sigue siendo accionable por su `code`;
simplemente `email_not_verified` no es uno de los posibles. La pantalla del QR **no** tiene que
ofrecer «verificá tu email» como salida de un 403.

**Excluidas del barrido, y por que:**

- `POST /api/merchant/auth/staff` — es el **login publico** del integrante. Ver §3.
- `GET /api/public/catalog/[productId]/image` — es publica, sin sesion.
- **`POST /api/staff/[userId]/pin` — ESTADO ACTUAL DECLARADO, y corrige el DoD de la spec.**
  La lista de 33 la incluye por su ruta, pero **no es una superficie del owner**: es el
  integrante cambiando **SU PROPIO** PIN (spec 0067 §4, el cambio obligatorio del primer
  uso), y la propia ruta contesta `404 staff_not_found` cuando
  `userId !== session.user.id`. Gatearla con `requireApiOwner` dejaria a **todo** el staff
  sin poder cambiar su PIN (`not_owner`), que es romper el producto. **Queda sin el gate del
  owner a proposito.** Su consecuencia declarada: un integrante con la sesion ya viva puede
  cambiar su PIN en un negocio `suspended`. No acredita, no resuelve, no entra al mostrador
  —eso ya esta cortado en §2— y no obtiene sesion nueva —§3—; lo unico que puede es rotar su
  propio secreto. **Es un hallazgo a decidir, no una decision del owner.**
- **`api/onboarding/prefill` — sin gate de negocio, y no lo necesita.** Devuelve la lista de
  paises, las categorias y el sesgo geografico de los headers de Vercel. **No lee una sola fila
  del negocio** (verificado leyendola), asi que no hay estado que gatear: pedirle un `status`
  seria una consulta nueva para rechazar la lectura de datos estaticos.
- **`api/onboarding/business` — sin gate de negocio, y es INALCANZABLE que lo necesite.** Solo
  CREA: si ya existe **cualquier** membresia del usuario contesta **`409`** antes de escribir
  (`route.ts:110`, verificado). Un owner cuyo negocio esta `suspended` ya tiene membresia, asi
  que nunca llega a un write.
- **✅ `api/onboarding/program` — GATEADO, y el gate vive en el WRITER.** Era el unico agujero
  real de los tres, y esta cerrado por **decision del owner del 2026-09-17 («cerralo ahora»)**,
  que ademas señalo que no era una decision nueva: su regla textual para `suspended` ya decia
  «no pueden … **cambios en programa**».
  **El gate NO esta en la ruta: esta en `saveProgram`** (`server/loyalty-program.ts`), porque es
  **UN writer con DOS puertas** —esta y `PUT /api/loyalty-program`— y una defensa en el borde
  deja la otra puerta abierta, que es exactamente como nacio el agujero. Ventaja adicional: el
  guard lee el `status` de **la misma fila** que el write va a tocar, o sea que no le afecta la
  divergencia `asc`/`desc` que la spec §D3 declara abierta.
  **Esta ruta NO lleva el gate de email, a proposito**: el wizard existe para correr **antes**
  de que el email este verificado (ADR 0070 §11). Son dos ejes distintos (ADR 0073) y aca aplica
  solo el de `status`.

| Caso | Status | `code` | `suspensionReason` |
|---|---|---|---|
| negocio `active` | 200 / 201 | — | — |
| negocio `suspended` | **403** | `business_suspended` | **NO viaja** (ver abajo) |
| negocio `closed` | **403** | `business_closed` | — |

**Excepcion declarada, no silenciosa:** es la **unica** superficie del owner donde
`business_suspended` **no** trae `suspensionReason`. El motivo viaja en las 12 superficies de
`requireApiOwner`; aca plomearlo exigiria sumarle el campo a `LoyaltyError`, y el owner ya recibe
el motivo en todas las demas. `LoyaltyError` **si** gano un `code` opcional, porque sin el el
mapeo por status de esta ruta traducia todo 403 a `not_owner` — un `code` que le miente al
cliente sobre por que lo frenaron.

---

## 2. Mostrador — `api/counter/*`

`requireOperator` (`app/api/counter/_auth.ts`) gatea `resolve`, `grant`, `redeem` y
`coupon-redeem`. Lo opera **cualquier miembro activo** (owner o staff).

| Caso | Status | `code` | `suspensionReason` |
|---|---|---|---|
| sin sesion | 401 | — (cuerpo `{ error }`, sin `code`; **estado actual**, la 0072 no lo cambio) | no |
| sesion sin negocio / membresia `disabled` | 403 | — (idem) | no |
| **owner con el email sin verificar** | **403** | **`email_not_verified`** (spec 0082) | no |
| negocio `suspended` | **403** | `business_suspended` | **NO** |
| negocio `closed` | **403** | `business_closed` | no |

**`email_not_verified` lo recibe SOLO el owner: un integrante NUNCA lo recibe** (spec 0082 §2).
No es una optimizacion — el staff no tiene email por diseño (`handle@slug` + PIN, su `user`
lleva un sintetico `@staff.invalid` que nunca se entrega, spec 0067 §4), asi que un gate que lo
alcanzara dejaria el mostrador **muerto para siempre**: no existe ninguna accion con la que un
integrante pueda verificar nada.

**Y va ANTES del eje `status`**, el orden del ADR 0073 §1 que ya usan `requireApiOwner` y
`requireBackofficeSession`. Consecuencia observable y declarada: un owner sin verificar sobre un
negocio `suspended` recibe **`email_not_verified`**, no `business_suspended`.

**Las cuatro rutas lo emiten** (`resolve`, `grant`, `redeem`, `coupon-redeem`), incluida
`resolve`, que es una **lectura**: es el primer paso de acreditar, y la decision del owner
(2026-09-19) fue «el mostrador» como unidad, no ruta por ruta.

**Por que el motivo NO viaja acá, y es contrato:** el mostrador lo opera tambien el staff, y
`suspension_reason` es una nota interna sobre la cuenta del negocio. Se serializa **solo al
owner** (spec 0072 §D4).

**Por que el guard vive acá y no solo en el login:** `server/auth.ts` no pisa
`session.expiresIn`, asi que rige el default de better-auth 1.6.26 — **7 dias**. Un
integrante con la sesion ya abierta seguiria acreditando **una semana** despues del cierre.
Cerrar la puerta no expulsa a quien ya entro.

---

## 3. Los dos logins

### 3.1 `POST /api/merchant/auth/staff` — login del integrante (`handle@slug` + PIN)

Se suman dos codigos a los del contrato 0067 §1, **despues** de verificar el PIN y **despues**
de `staff_disabled`:

| Caso | Status | `code` | `suspensionReason` |
|---|---|---|---|
| negocio `suspended` | **403** | `business_suspended` | no |
| negocio `closed` | **403** | `business_closed` | no |

**No se emite cookie en ninguno de los dos.** Van despues del PIN por el mismo motivo que
`staff_disabled`: contestarlos antes convertiria la ruta en un oraculo de que negocios existen
y en que estado estan, para cualquiera que tipee un `handle@slug`.

### 3.2 `GET /api/merchant/auth/magic-link` — consumo del link del owner

Sigue siendo un **303** con `location`, nunca JSON.

| Caso | Status | `location` | `set-cookie` |
|---|---|---|---|
| token valido, negocio `active` o `suspended` | 303 | `/backoffice` | **si** |
| token valido, negocio **`closed`** | 303 | **`/?e=business_closed`** | **no** |
| token invalido / vencido / ausente | 303 | `/?e=magic_link_invalid` | no |

**El owner de un negocio `suspended` SI entra** — es lo unico que puede hacer: leer el motivo.
**El de un negocio `closed` no**, y ademas la sesion que el plugin ya habia creado en la base
**se revoca** (`DELETE` sobre `merchant_auth.session`), no solo se deja de reenviar la cookie.

**`POST /api/merchant/auth/start` no decide nada** y es deliberado: no resuelve negocio (solo
toca `merchant_auth.user`), asi que gatear ahi seria una consulta nueva. El corte va donde se
**crea** la sesion.

---

## 4. Enrolamiento publico — `POST /api/public/enroll/:programId`

Es un **alta NUEVA**, y por eso entra (decision del owner del 2026-09-17: «el alta nueva
tambien queda suspendida si el negocio esta suspendido, si esta cerrado queda cerrado para
altas nuevas»).

| Caso | Status | `code` | `suspensionReason` |
|---|---|---|---|
| negocio `suspended` | **403** | `business_suspended` | **NO** |
| negocio `closed` | **403** | `business_closed` | **NO** |

**El consumidor NUNCA recibe el motivo.** Los mensajes son de cara al consumidor («Este
negocio no está aceptando altas nuevas por ahora.» / «Este negocio cerró y ya no admite altas
nuevas.»), no la nota interna.

**Lo que NO cambia, y es la linea que separa lo que entra de lo que no: «ya emitido» vs «alta
nueva»** (no «comercio» vs «consumidor»). El **pase de Wallet, los sellos acumulados y la
tarjeta** de quien ya esta adentro **siguen exactamente igual en los tres estados**. No se
contesta `410` en el web service de passkit: un pase borrado del telefono no vuelve, y
`status` es reversible. `app/api/public/wallet/**` **no aparece en el diff de esta spec**.

---

## 5. El eje PLAN, que es OTRO eje

No lo cambia esta spec —la capa de entitlements es un refactor sin cambio de
comportamiento—, pero se lista para que la UI no confunda los dos ejes (ADR 0073 §1):

| `code` | Status | Donde | Que significa |
|---|---|---|---|
| `plan_not_allowed` | **402** | `api/marketing/campaigns*` | el plan no incluye campañas |
| `downgrade_blocked` | **409** | `api/billing/{cancel,settle-free}` | hay mas locales activos que los del plan destino; trae `archiveCount` |
| `downgrade_blocked_campaigns` | **409** | idem | hay campañas activas; trae `deactivateCount` |
| `subscription_live`, `already_on_plan`, `interval_*` | **409** | `api/billing/*` | contrato de la spec 0063 D6 |

**`business_suspended` NUNCA se responde por plan, y `plan_not_allowed` nunca por estado.** Un
`can(ctx, 'campaigns.enabled')` **no mira `core.business`**, ni siquiera lo recibe.

---

## 6. Codigos de rebote del backoffice (`/?e=…`)

Mismo canal y misma allow-list que el contrato 0067 «Codigos de rebote». El parametro crudo
**nunca se renderiza**: la UI busca el codigo en esta tabla y uno desconocido no imprime nada.

| `code` | Lo emite | Cuando |
|---|---|---|
| `staff_disabled` | `requireBackofficeSession` | membresia `disabled` (ADR 0055) |
| **`business_closed`** | `requireBackofficeSession` | **negocio `closed`** (spec 0072 §D4) |
| `magic_link_invalid` | consumo del link | token invalido o vencido |

**`email_not_verified` SALIO de esta tabla (spec 0082)**, igual que de la del contrato 0067: el
guard de paginas dejo de emitirlo porque el owner sin verificar **entra** (ADR 0070 §11, paso 2
textual). Sobrevive **solo como 403 de API** — las 11 superficies del owner (§1) y las 4 del
mostrador (§2). La pantalla lo sabe por `emailVerified`, que `GET /api/merchant/session`
devuelve (`0074-contratos-de-api.md` §1) y `requireBackofficeSession` pone en su contexto.

**`suspended` NO rebota, a proposito.** El owner de un negocio suspendido **entra al
backoffice**, porque es la unica superficie donde puede enterarse de por que. Para que la
pantalla pueda decirlo, `requireBackofficeSession` devuelve dos campos nuevos en
`ctx.business`:

| Campo | Tipo | Quien lo recibe |
|---|---|---|
| `status` | `"active" \| "suspended"` (`closed` no llega: rebota antes) | owner y staff |
| `suspensionReason` | `string \| null` | **solo el owner** — a un integrante le llega `null` aunque la columna tenga texto |

Todo lo que el negocio suspendido puede **hacer** ya esta cortado: las 33 rutas de API
contestan 403 (§1) y el mostrador tambien (§2).

---

## 7. Estado actual declarado (no son decisiones de esta spec)

1. **`api/counter/*` responde sus 401/403 de sesion SIN `code`** (solo `{ error }`). La 0072
   **agrego** `code` a los dos casos nuevos del eje `status`, y **no cambio** los dos viejos:
   normalizarlos es alcance que esta spec no compra.
2. **Las 4 rutas de `/api/loyalty-program` responden sus errores de DOMINIO sin `code`** (ya
   estaba declarado en `0069-contratos-de-api.md`). Lo que **si** lleva `code` desde la 0072
   son sus 401/403 **de gate**.
3. **`api/billing` gana `code` en sus 401/403**, que antes no llevaban. Es la decision del
   owner del 2026-09-17 («si a los `code`»), no un efecto lateral.
4. **Quien ESCRIBE `core.business.status` no existe todavia**: el owner lo difirio a las API
   de admin de CheckPass.club (`apps/platform` tiene una sola ruta, `/api/health`). Por ahora
   es un `UPDATE` a mano, y es asi como lo ejercita
   `server/business-status.neon.integration.test.ts`.
