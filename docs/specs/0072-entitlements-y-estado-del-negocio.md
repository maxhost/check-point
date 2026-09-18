---
spec: 0072
fecha: 2026-09-17
estado: implementada
resumen: Una capa de entitlements para los limites por plan, un `requireApiOwner` unico para las 10 superficies de API del owner (hoy solo 2 tienen gate de email), y los guards que hacen real a `core.business.status` (hoy no lo lee nadie).
disjunta: si
archivos: apps/merchant/src/server/entitlements/*, apps/merchant/src/server/api-owner.ts, apps/merchant/src/app/api/{billing,catalog,locations,marketing,staff,counter}/_auth.ts, apps/merchant/src/app/api/{brand,loyalty-program,loyalty-terms}/**/route.ts, apps/merchant/src/app/api/merchant/auth/{magic-link,staff}/route.ts, apps/merchant/src/server/{locations/core.ts,locations/index.ts,marketing/plan-gate.ts,billing/derive-rules.ts,consumer/enrollment.ts,auth-guards.ts}
---

# 0072 — Entitlements y estado del negocio

> **Nada de codigo empieza sin esta spec en `cerrada`.**
>
> No es ceremonia. En tareas **imposibles o mal especificadas** los modelos frontier
> fingen exito **~50% de las veces**, y **23-35% aunque se les diga explicitamente que
> no**. En tareas resolubles y bien definidas, el reward hacking bajo a **0%**.

Es la **3a tajada del ADR 0070** (identidad → wizard → **entitlements** → onboarding
derivado), y absorbe las filas **56** y **57** de `PARQUEADO.md`.

## Problema

Tres agujeros medidos el 2026-09-17 contra el arbol en `5f89d18`, que comparten los mismos
archivos y por eso se cierran juntos.

### P1 — El conocimiento de plan vive en tres lugares y ya divergio una vez

| Que | Donde | Regla de hoy |
|---|---|---|
| Tope de locales activos | `server/locations/core.ts:64` `PLAN_LOCATION_LIMITS` | `free:1, plus:3, none:1`; plan desconocido cae al mas restrictivo; el efectivo es `min(vigente, pendiente)` |
| Campañas permitidas | `server/marketing/plan-gate.ts:31` `PLAN_WITH_CAMPAIGNS` | `plan==='plus'` **+** `pending_plan` no baja **+** `hasLiveSubscription` |
| Que plan es pago / como se llama | `server/billing/derive-rules.ts:42` `PAID_PLANS` y `server/billing/view.ts:99` `planLabel` | `{plus}` |

**La divergencia esta documentada en el propio codigo** (`plan-gate.ts:48`): el `planAllows`
de la fase B1 miraba **solo** `plan==='plus'`, sin `pending_plan` ni `hasLiveSubscription`,
y por eso una baja programada no frenaba la activacion de una campaña.

**Dos correcciones a lo que decia `TASKS.md`, medidas:** `server/billing/plan-change.ts`
**NO es un tercer call-site divergido** — importa `locationLimitForPlan` de locations, no lo
recopia; y **staff y catalogo de productos no tienen ningun tope por plan** (`rg` sobre
`server/staff.ts` y `server/catalog/*.ts`: 0 matches), asi que ahi no hay nada que unificar.

### P2 — El gate de email verificado cubre 2 superficies de 11

Censo ejecutado ruta por ruta. Hay **seis** resolvedores de owner, uno por dominio, y
**solo uno** chequea `emailVerified`:

| Resolvedor | Archivo | Resuelve owner con | Gate de email |
|---|---|---|---|
| `requireStaffOwner` | `app/api/staff/_auth.ts:10` | `ownerContext` | **si** (`:50`) |
| `requireLocationsOwner` | `app/api/locations/_auth.ts:12` | `ownerContext` | no |
| `requireMarketingOwner` | `app/api/marketing/_auth.ts:17` | `ownerContext` | no |
| `requireBillingOwner` | `app/api/billing/_auth.ts:60` | `ownerContext` | no |
| `requireOwner` (catalogo) | `app/api/catalog/_auth.ts:10` | **`ownerBusiness`** | no |
| `requireOperator` (mostrador) | `app/api/counter/_auth.ts:14` | `operatorBusiness` | no aplica (staff no tiene email) |

Y **cuatro superficies mas resuelven owner a mano**, con `getSession` + `ownerBusiness`
inline: `api/brand`, `api/brand/logo-upload`, `api/loyalty-program`,
`api/loyalty-program/stamp-upload`, `api/loyalty-terms/templates` y
`api/loyalty-program/qr`.

**Consecuencia hoy:** un owner con el email sin verificar crea sucursales, sube marca, arma
campañas, carga catalogo, edita el programa de fidelizacion y **abre un checkout de
Stripe**. Ademas los tres `ownerBusiness` (`brand.ts:32`, `catalog/core.ts:73`,
`loyalty-program.ts:51`) **no filtran `memberships.status='active'`**, que `ownerContext`
(`server/staff.ts:56-72`) si filtra.

**Correccion a la fila 56 de `PARQUEADO.md`:** enumera 9 superficies y son **10** — le falta
`api/loyalty-program/qr`, que nacio con la spec 0069, despues de que la fila se escribiera.

### P3 — `core.business.status` esta en produccion y no lo lee nadie

La migracion `0036` aplico `status` / `suspension_reason` / `status_changed_at` con
`CHECK (status IN ('active','suspended','closed'))`. **Ningun guard la lee**: hoy un negocio
`suspended` esta suspendido en la base y **plenamente operativo en la app**.

**Y cerrar el login no alcanza, medido:** `apps/merchant/src/server/auth.ts` no pisa
`session.expiresIn`, asi que rige el default de better-auth 1.6.26 —
`3600 * 24 * 7` = **7 dias** (`dist/context/create-context.mjs:147`,
`dist/db/internal-adapter.mjs:24`). Un staff con la sesion ya abierta **sigue acreditando
hasta una semana** despues de que el negocio se cierre, porque `requireOperator` solo
verifica que haya sesion y que resuelva negocio. El guard tiene que estar en **cada**
superficie, no solo en la puerta.

## Alcance

**Entra:**

1. **La capa de entitlements** (`can()` / `limitOf()`) con un catalogo declarativo, y la
   migracion de los tres call-sites de P1 a leerlo. **Refactor sin cambio de comportamiento.**
2. **`requireApiOwner`**: un unico resolvedor para las 10 superficies de API del owner, con
   `emailVerified`, con `memberships.status='active'` y con los `code` estables en los
   401/403. Los seis `_auth.ts` y los seis sitios ad hoc pasan a consumirlo.
3. **Los guards de `business.status`**: en el login (consumo del link magico y PIN del
   staff), en `requireApiOwner`, en `requireOperator` (mostrador) y en
   `requireBackofficeSession`.
4. **El corte del enrolamiento publico** —el alta NUEVA— en `suspended` y en `closed`.
   Decision del owner del 2026-09-17, textual: «el alta nueva tambien queda suspendida si el
   negocio esta suspendido, si esta cerrado queda cerrado para altas nuevas».

**No entra (explicito):**

- **Cualquier apagado del lado del consumidor sobre lo YA EMITIDO.** Decision del owner del
  2026-09-17: los pases de Wallet, los sellos acumulados y la tarjeta **no se tocan**. No se
  contesta `410` en el web service de passkit — un pase borrado del telefono no vuelve, y
  `status` es reversible. **La linea que separa lo que entra de lo que no es «ya emitido» vs
  «alta nueva»**, no «comercio» vs «consumidor»: el enrolamiento es un alta nueva y SI entra.
- **Limites nuevos.** Decision del owner: «no de momento». El catalogo nace con los dos que
  ya existen. Lo que SI entra es que **agregar el tercero sea una sola linea** (§D2.3).
- **Que pasa cuando NOSOTROS bajamos un limite** y un negocio ya lo excedia. Decision del
  owner: «todavia no esta resuelto esto, cuando lleguemos alli trabajaremos en ello».
- **Quien ESCRIBE `status`.** Diferido por el owner a las API de admin de CheckPass.club,
  que no existen (`apps/platform` tiene una sola ruta, `/api/health`). Por ahora, `UPDATE`
  a mano.
- **UI.** ADR 0070 §16: el arco entrega API y contrato. El entregable de pantalla es
  `docs/specs/0072-contratos-de-api.md`.
- **Migraciones.** La `0036` ya esta en produccion.

## Diseño

### D1 — Los dos ejes no se mezclan

**Decision del owner (2026-09-17): «Si yo suspendo un comercio no es cambiar de plan, es
dejar de acceder a las funciones».** `status` y `plan` son **ortogonales** y se evaluan por
separado, en orden fijo:

```
1. ¿hay sesion?            → 401 unauthorized
2. ¿es owner activo?       → 403 not_owner
3. ¿email verificado?      → 403 email_not_verified
4. ¿el negocio OPERA?      → 403 business_suspended | business_closed   ← eje status
5. ¿el plan lo permite?    → 402 plan_not_allowed | 409 limit_reached   ← eje plan
```

**El orden es la regla, no una optimizacion.** Los pasos 3 y 4 van **despues** de resolver
al owner: puestos antes, un INTEGRANTE recibiria `email_not_verified` en vez de `not_owner`
—lo cazo un test de la spec 0067— y un tercero podria sondear el estado de un negocio ajeno.

**`can()` NUNCA mira `status`.** Un `can(ctx, 'campaigns.enabled')` que devolviera `false`
por suspension haria que la UI diga «mejora tu plan» a un negocio suspendido, que es la
accion contraria a la que necesita — el mismo error que el ADR 0063 [R2] ya corrigio una vez
en locales.

### D2 — La capa de entitlements

**`server/entitlements/catalog.ts`** — un unico objeto declarativo, la fuente de verdad:

```ts
export const ENTITLEMENTS = {
  "locations.max": {
    kind: "limit",
    byPlan: { free: 1, plus: 3, none: 1 },
    fallback: 1,
    requiresLiveSubscription: false,
    pendingRule: "min",
  },
  "campaigns.enabled": {
    kind: "flag",
    byPlan: { free: false, plus: true, none: false },
    fallback: false,
    requiresLiveSubscription: true,
    pendingRule: "min",
  },
} as const satisfies Record<string, EntitlementDef>;
```

**D2.1 — `pendingRule: "min"` conserva la regla del ADR 0063 D2:** el valor efectivo es el
**menor** entre el plan vigente y el `pending_plan`, y un `pending_plan` **vacio no es una
baja programada** ([R1-N8]: sin ese detalle el tope caia solo a 1). Es `min` y no «gana el
pendiente» porque un upgrade programado no debe subir el tope antes de que el pago este
confirmado.

**D2.2 — `requiresLiveSubscription` por entrada, y no un `effectivePlan` unico.** Es la
asimetria que hoy existe **a proposito** y que un unificador borraria: un `plus` con
`interval` NULL y sin `stripe_subscription_id` (la forma A1 de la spec 0063, que existio en
prod) **no activa campañas** pero **si conserva sus 3 locales**, porque `none` vale 1 «y no
0» para que un negocio sin suscripcion pueda archivar para salir (`locations/core.ts:68-72`).
**Alternativa rechazada:** degradar a `free` en la capa. Es mas simple de leer y **cambia el
comportamiento** de locales para la forma A1 — esta spec es una unificacion, no un cambio de
producto.

**D2.3 — Agregar un limite nuevo es UNA fila** (requisito explicito del owner: «tendremos que
tener una forma de añadir nuevos limites de forma simple y clara»). La fila del catalogo es
lo unico que se escribe: la clave se tipa sola (`keyof typeof ENTITLEMENTS`), y
`limitOf`/`can` la resuelven sin tocar nada mas. **Y el `fallback` deja de ser silencioso:**
hoy un plan sin fila cae al mas restrictivo sin que nada avise, asi que introducir
`enterprise` lo aterrizaria en 1 local (peligro ya escrito en `locations/core.ts:58-62`). El
catalogo declara los planes conocidos y un test recorre `ENTITLEMENTS × PLANS_CONOCIDOS`
exigiendo fila explicita: **agregar `enterprise` sin declarar sus limites pone la suite en
rojo**, no en produccion.

**D2.4 — La firma.** `can(ctx, key): boolean` y `limitOf(ctx, key): number`, donde `ctx` es
la fila minima de `core.subscription` que ya leen los dos call-sites
(`{plan, pendingPlan, status, stripeSubscriptionId}`), **no un `businessId`**: la lectura se
queda en el llamador porque el gate de campañas se resuelve **dentro de la transaccion que
escribe** (ADR 0054 §2), y una capa que abriera su propia conexion romperia eso.

**D2.5 — Los call-sites migran, no se duplican.** `locationLimitForPlan` /
`effectiveLocationLimit` y `campaignsAllowedFor` quedan como **envoltorios finos** sobre la
capa, conservando su firma: tienen 30+ llamadores y tests propios, y cambiarlos a todos es
alcance que esta spec no compra. `PLAN_LOCATION_LIMITS` y `PLAN_WITH_CAMPAIGNS` **se borran**
— si sobreviven, la unificacion es decorativa.

### D3 — `requireApiOwner`

**`server/api-owner.ts`**, construido sobre `ownerContext` (`server/staff.ts:56`), que ya es
el mismo `innerJoin(businesses)` que comparten cuatro de los seis resolvedores. Leer `status`
ahi es **una columna mas en un join que ya existe**, no una consulta nueva.

```ts
type ApiOwnerFailure = { status: number; code: string; message: string; reason?: string };
export async function requireApiOwner(request: Request):
  Promise<{ business: ApiOwnerBusiness } | { failure: ApiOwnerFailure }>;
```

Devuelve un **fallo de datos, no una `NextResponse`**: cada dominio tiene su propia forma de
error (`LocationError`, `CampaignError`, `BillingError`, `StaffError`) y su propio `catch`, y
devolver una respuesta armada obligaria a los seis a coincidir en el envoltorio. Cada
`_auth.ts` mapea `failure` a su forma. **Los `code` se normalizan** —`unauthorized`,
`not_owner`, `email_not_verified`, `business_suspended`, `business_closed`— decision ya
tomada por el owner el 2026-09-17 (fila 56: «si al `status='active'`, si a los `code`»).

`ownerBusiness` **pierde sus tres llamadores de API** (brand, catalog, loyalty) y con eso se
cierra la divergencia del filtro `status='active'`.

**⚠️ CORRECCION A ESTA SECCION, medida por el revisor y reproducida por el orquestador: la
divergencia `asc`/`desc` NO se cierra del todo, y la frase original de esta spec afirmaba mas de
lo que el codigo hace.** Los cinco resolvedores vivos quedaron en cuatro `asc`
(`staff.ts:88`, `catalog/core.ts:81`, `brand.ts:51`, `auth-guards.ts:106`) contra **un `desc`**:
`loyalty-program.ts:66`. Y `api/loyalty-program` (GET/PUT) y `api/loyalty-program/qr` siguen
llegando a ese resolvedor `desc` via `programForOwner(auth.userId)` **despues** de que el gate
resolvio con `asc`, asi que con dos negocios por usuario el gate evaluaria el estado de uno y la
ruta devolveria el programa del otro. **Inalcanzable hoy** —`api/onboarding/business:110`
contesta `409` si ya existe cualquier membresia, o sea un negocio por usuario— y **declarado, no
perseguido**: cerrarlo toca `server/loyalty-program.ts`, que no esta en la tabla de archivos de
esta spec.

### D4 — El eje `status`, superficie por superficie

`active` opera normal. Los otros dos, con la semantica textual del owner:

| Superficie | `suspended` | `closed` | Donde |
|---|---|---|---|
| Login del owner (consumo del link magico) | **entra** | **no entra** — no se emite sesion | `api/merchant/auth/magic-link/route.ts` |
| Login del staff (PIN) | **no entra** | **no entra** | `api/merchant/auth/staff/route.ts:151` `findStaff` — ya hace `innerJoin(businesses)` |
| Las 10 superficies de API del owner | 403 `business_suspended` + `reason` | 403 `business_closed` | `requireApiOwner` |
| Mostrador (`grant`/`redeem`/`coupon-redeem`/`resolve`) | 403 `business_suspended` | 403 `business_closed` | `api/counter/_auth.ts` `requireOperator` |
| Backoffice (8 paginas) | pasa, para poder ver el mensaje | rebote a `/?e=business_closed` | `server/auth-guards.ts` |
| Enrolamiento publico (alta nueva) | **403 `business_suspended`** | **403 `business_closed`** | `consumer/enrollment.ts:237` — el join a `businesses` ya existe |
| Pase de Wallet, sellos, tarjeta | **intactos** | **intactos** | — (decision del owner) |

**`auth/start` NO decide nada, y es deliberado.** Solo toca `merchant_auth.user`
(`auth-start.ts:150`) y no resuelve negocio, asi que gatear ahi seria una consulta nueva —
y ademas **el owner de un negocio `suspended` SI tiene que entrar** para ver el motivo. El
corte de `closed` va donde se **crea** la sesion, no donde se pide el link.

**El motivo (`suspension_reason`) se serializa SOLO al owner**, en el 403 de
`requireApiOwner` y en el guard del backoffice. El staff no llega a verlo: no obtiene sesion.
El consumidor nunca lo recibe — su 403 no lleva `reason`.

### Arquitectura de referencia

ADR **0070** (el arco, §11 el gate de email, §16 API sin UI) · ADR **0071** (un implementador
y un revisor) · ADR **0063** / spec 0063 D2 (el tope efectivo y `pending_plan`) · ADR **0058**
§12 (`none`) · ADR **0054** §2 (el gate se lee en la transaccion que escribe) · ADR **0044**
(`requireBackofficeSession`) · spec **0067** §3 (el gate de email va **despues** de resolver
owner).

## Archivos

| Archivo | Accion |
|---|---|
| `server/entitlements/catalog.ts` | crear |
| `server/entitlements/index.ts` (`can`, `limitOf`, types) | crear |
| `server/api-owner.ts` | crear |
| `server/locations/core.ts` | editar — borra `PLAN_LOCATION_LIMITS`, envuelve la capa |
| `server/locations/index.ts` | editar — el barrel re-exporta `PLAN_LOCATION_LIMITS` (`:12`) |
| `server/marketing/plan-gate.ts` | editar — borra `PLAN_WITH_CAMPAIGNS`, envuelve la capa |
| `server/billing/derive-rules.ts` | editar — `PAID_PLANS` sale del catalogo |
| `server/staff.ts` | editar — `ownerContext` selecciona `status` y `suspensionReason` |
| `server/auth-guards.ts` | editar — el eje status en `requireBackofficeSession` |
| `server/consumer/enrollment.ts` | editar — condicion de `status` en el join que ya existe |
| `app/api/{billing,catalog,locations,marketing,staff}/_auth.ts` | editar — consumen `requireApiOwner` |
| `app/api/counter/_auth.ts` | editar — `requireOperator` lee `status` |
| `app/api/brand/route.ts`, `app/api/brand/logo-upload/route.ts` | editar — dejan el `getSession` ad hoc |
| `app/api/loyalty-program/{route.ts,stamp-upload/route.ts,qr/route.ts}` | editar — idem |
| `app/api/loyalty-terms/templates/route.ts` | editar — idem |
| `app/api/merchant/auth/magic-link/route.ts` | editar — corte de `closed` |
| `app/api/merchant/auth/staff/route.ts` | editar — corte de `closed` y `suspended` |
| `docs/specs/0072-contratos-de-api.md` | crear — el contrato HTTP |
| tests (§Plan de pruebas) | crear / editar |

### Disjunta?

**Si.** Las tres specs abiertas del INDEX son borradores viejos y no colisionan: la **0003**
declara `archivos` en `packages/**` y **`packages/` no existe** (el workspace es `apps/*`);
la **0007** y la **0009** declaran «rutas concretas por definir». La 0069 esta `implementada`.

### Archivos compartidos

| Que | Quien lo deja listo | Cuando |
|---|---|---|
| Nada | — | — |

Los tres modulos nuevos los crea el mismo (unico) implementador, en el orden de §Handoff.

## Definition of Done

- [ ] `rg -n "PLAN_LOCATION_LIMITS\|PLAN_WITH_CAMPAIGNS" apps/merchant/src` → **vacio**.
      **Corrido contra el arbol antes de cerrar:** hoy da 8 hits en 4 archivos, y los cuatro
      son alcanzables — `locations/core.ts`, `marketing/plan-gate.ts` y el barrel
      `locations/index.ts:12` estan en la tabla, y el cuarto
      (`billing-plan-change.test.ts:53`) es **un comentario**, no una asercion: ese test
      transcribe el tope a mano (`FREE_LIMIT = 1`, a proposito, para no importar del modulo
      bajo prueba). Actualizar ese comentario **no** es ablandar un test y es lo que vuelve
      satisfacible al barrido.
- [ ] `rg -n "ownerBusiness" apps/merchant/src/app/api` → **vacio**. **Corrido:** hoy da 4
      archivos —`loyalty-program/stamp-upload`, `loyalty-terms/templates`, `brand/route.ts`
      y `catalog/_auth.ts`— y **los cuatro estan en la tabla de archivos**. `ownerBusiness`
      puede seguir viva si la usa `server/`: el barrido es sobre `app/api`.
- [ ] Las **10** superficies de API del owner resuelven por `requireApiOwner`: el barrido
      `rg -L "requireApiOwner" <las 33 rutas>` no reporta ninguna. **Las 33 estan contadas,
      no estimadas**: son los `route.ts` bajo `billing|catalog|locations|marketing|staff|
      brand|loyalty-program|loyalty-terms` mas `merchant/business/slug`, **excluidos**
      `merchant/auth/staff` (login publico) y `public/catalog/[productId]/image`.
- [ ] Un owner con `emailVerified=false` recibe **403 `email_not_verified`** en las 10, no
      solo en `staff` y `slug`.
- [ ] Un INTEGRANTE (no owner) recibe **403 `not_owner`**, nunca `email_not_verified` ni
      `business_suspended` — el orden de §D1 verificado por test.
- [ ] Un negocio `suspended`: el owner entra, cada API del owner responde 403
      `business_suspended` **con `reason`**, el mostrador 403, y el staff **no obtiene PIN
      login**.
- [ ] Un negocio `closed`: **no se emite sesion** ni por link magico ni por PIN, y una sesion
      **ya viva** recibe 403 en API y mostrador.
- [ ] El pase de Wallet, los sellos y la tarjeta del consumidor **no cambian** para ninguno
      de los tres estados: `rg` sobre `app/api/public/wallet/**` no reporta cambios en el
      diff, y el test de la tarjeta sigue verde sin tocarse.
- [ ] Agregar un plan al catalogo sin declarar sus limites **pone la suite en rojo** (§D2.3).
- [ ] `0072-contratos-de-api.md` tiene una fila por cada `code` nuevo, con su status.
- [ ] **Cero `.tsx` en el diff** (ADR 0070 §16), salvo lo que el borrado de UI vieja exija.
- [ ] `rg MUTATION apps docs` → **vacio**.

## Plan de pruebas y verificación

**Presupuesto: 7 mutaciones.** Clase de error a cazar: **los plausibles** — un guard que no
muerde, un orden invertido, y una capa nueva que existe pero **no la lee nadie** (el riesgo
propio de un refactor). **Condicion de corte:** si dos vueltas seguidas terminan en «el fix
abrio la siguiente», se corta y se declara.

| # | Mutacion | Oraculo que tiene que ponerse rojo |
|---|---|---|
| M1 | Quitar el chequeo de `status` en `requireApiOwner` | una API del owner deja de dar 403 en un negocio `suspended` |
| M2 | Quitar el chequeo de `emailVerified` en `requireApiOwner` | 403 `email_not_verified` en una superficie que **hoy no lo tiene** (billing) |
| M3 | Mover los pasos 3-4 **antes** de resolver owner | un integrante recibe `email_not_verified` en vez de `not_owner` |
| M4 | Quitar el corte de `closed` en el consumo del link magico | el owner de un negocio cerrado obtiene sesion |
| M5 | Quitar el corte en `requireOperator` | una sesion de staff **ya viva** acredita en un negocio suspendido (el caso de los 7 dias) |
| M6 | `requiresLiveSubscription: false` en `campaigns.enabled` | un `plus` forma A1 (sin `stripe_subscription_id`) activa campañas |
| M7 | Cambiar `byPlan.free` de `1` a `2` en `locations.max` | el test del tope de locales — **prueba que el catalogo es la fuente y no una copia muerta** |

- [ ] Unit: `entitlements/` — `limitOf` con `pending_plan` vacio, con baja programada
      (`min`), con plan desconocido (fallback), y `can` con y sin suscripcion viva.
- [ ] Unit: el recorrido `ENTITLEMENTS × PLANS_CONOCIDOS` de §D2.3.
- [ ] Integracion (Neon): la matriz **`{active, suspended, closed}` × {owner, staff,
      consumidor}** sobre una API del owner, el mostrador, los dos logins y el enroll.
- [ ] Integracion: **la sesion preexistente** — emitir sesion de staff, pasar el negocio a
      `suspended` por `UPDATE`, y verificar que el mostrador responde 403 sin re-login. Es el
      unico test que ejercita el hueco de los 7 dias.
- [ ] Aislamiento: el 403 del consumidor **no lleva `suspension_reason`**.
- [ ] Regresion: los tests de locales, campañas y billing **pasan sin tocarse** — la capa es
      refactor. Si un test preexistente hay que editarlo, se justifica archivo por archivo.
- [ ] Comandos: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use` y despues
      `pnpm run typecheck && pnpm run lint && pnpm run format:check && pnpm run test && pnpm run build`,
      y la suite con `.env.integration.local` (esta en la RAIZ del repo).
- [ ] Verificacion manual: **no hay pantalla** (ADR 0070 §16, excepcion declarada a «gana la
      pantalla»). Se baja a `curl` con respuestas transcriptas contra los tres estados.

**Declarado afuera y no perseguido:** la carrera entre el `UPDATE` de `status` y una
transaccion de mostrador ya abierta (el `status` se lee al entrar, no bajo el lock del
negocio); la expiracion real de la cookie de 7 dias; y el comportamiento del web service de
passkit, que esta spec **no toca**.

## Handoff requerido

**UN implementador para toda la spec y UN revisor independiente al final** (ADR 0071). El
implementador trabaja en tres pasos internos, con los gates verdes al final de cada uno:

1. La capa de entitlements + migrar los tres call-sites. **Refactor puro**: la suite entera
   tiene que pasar **sin tocar una sola asercion preexistente**. La unica edicion permitida
   en un test es el comentario de `billing-plan-change.test.ts:53`, que nombra una constante
   que este paso borra. Si hay que cambiar una **asercion**, no es un refactor y se para.
2. `requireApiOwner` y los doce consumidores.
3. El eje `status` en las siete superficies de §D4.

## Abierto

**Nada que bloquee.** La ultima pregunta abierta —el enrolamiento publico— la contesto el owner
el 2026-09-17: el alta nueva se corta en `suspended` **y** en `closed`. Esta en §Alcance punto 4
y en la fila de §D4.

Lo que queda fuera de esta spec no es incertidumbre sino alcance diferido por el owner, y esta
enumerado en §Alcance / «No entra»: quien ESCRIBE `status`, los limites nuevos, y el caso de
bajar un limite que alguien ya excedia.
