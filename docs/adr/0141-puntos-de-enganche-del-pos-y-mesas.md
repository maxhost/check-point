---
adr: 0141
fecha: 2026-10-13
estado: aceptada
resumen: Los puntos de enganche que el POS y Mesas le piden al contrato de modulos (amplia el ADR 0139), todos genericos — pantalla de operacion (barra movil con accion principal y aviso de prueba discreto), pagina de inicio (PWA e ingreso del personal), accion por local, regla para no apagarse (bajo el mismo lock del toggle), dependencia OPCIONAL entre modulos y rutas solo del owner. Mesas es modulo propio que requiere el POS; con Mesas apagado el POS toma ordenes sin mesa. La app pasa a llamarse «CheckPass Negocios».
---

# 0141 — Puntos de enganche del POS y Mesas

## Contexto

- ADR 0139 §2 dejo escrito: «Lo que el POS va a necesitar (`fullscreen`, `startPage` de la PWA, `locationActions`,
  `canDisable`) se agrega al manifiesto en la spec del POS con este mismo criterio». Decisiones del owner de la Fase 2
  en `docs/plan-modulos-plugin-2026-10-13.md` (esquema `pos`, permisos del modulo, rutas bajo `/api/modules`,
  pantallas por GPT, Mesas modulo propio con `requires: ["pos"]`).
- **Medido 2026-10-13** (lo que el core hace hoy por el POS, y que este ADR reemplaza por puntos genericos):
  - no hay «pantalla completa»: hay una **barra movil propia** (`backoffice-navigation.tsx:408-440`, `segment === "pos"`,
    tres columnas con «Nueva orden» que dispara `POS_NEW_ORDER_EVENT`) y el **aviso de prueba** que en el POS solo se
    muestra en los ultimos 7 dias (`trial-notice.tsx:29-35`);
  - la **PWA** abre `/backoffice/pos` y se llama «CheckPass POS» (`app/manifest.ts`, `app/layout.tsx:30`);
  - el **ingreso del personal** manda a `/backoffice/pos` a quien tiene solo `pos` (`staff-landing.ts`, spec 0218);
  - **Locales** dibuja «Mesas» si `posEnabled` (`locations-console.tsx`);
  - **apagar el POS con ordenes abiertas** es 409 (`server/pos/module.ts`), serializado con crear orden por la fila de
    `core.business` (`FOR UPDATE` / `FOR SHARE`);
  - el POS **usa las mesas** (selector, ocupacion por el unico parcial de `pos_order.dining_table_id`), pero Mesas
    `requires: ["pos"]`: una dependencia en los dos sentidos que el contrato no tenia como expresar.
- Owner 2026-10-13 (no volver a preguntar): **con el POS encendido y Mesas apagado, el POS toma ordenes sin mesa**
  (solo nombre libre; las mesas quedan guardadas y vuelven al reencender; Mesas no se apaga con ordenes abiertas en una
  mesa). **La app se llama «CheckPass Negocios».**

## Decision

Cada punto lo ofrece el core sin nombrar ningun modulo; el modulo lo declara. Se suman al manifiesto (`contract.ts`) y,
lo que es servidor o pantalla, a `server-registry` / `ui-registry`.

### 1. Pantalla de operacion — `operation`

```ts
operation?: { primaryAction: { label: string; icon: string } }
```

En las rutas `/backoffice/<id>/…` de un modulo que la declara:
- la barra movil del core muestra las entradas de menu de ese modulo + un boton principal (`label`, `icon`) que dispara
  en `window` el evento `checkpass:module-primary` con `detail: { moduleId }`; la pantalla del modulo lo escucha;
- el aviso de prueba gratis solo aparece en los ultimos 7 dias (la regla de hoy del POS, generalizada).

No se agrega un `fullscreen`: lo medido no lo usa (el marco del panel sigue visible en escritorio).

### 2. Pagina de inicio — `startPage`

```ts
startPage?: { path: string; permission: string }   // path relativo a /backoffice/<id>
```

- **PWA**: `start_url` = `/backoffice/start` (pagina del core). Resuelve el primer modulo del registro ENCENDIDO con
  `startPage` cuyo `permission` tiene el usuario (el owner los tiene todos) → redirige a su pagina; si no hay, a
  `/backoffice`. Mismo comportamiento de hoy con el POS encendido; con el POS apagado deja de abrir una pagina muerta.
- **Ingreso del personal** (spec 0218): si los permisos EFECTIVOS del integrante son exactamente el `permission` de un
  `startPage` de un modulo encendido → esa pagina; si no, `/backoffice`. Es la regla del owner («si es una persona con
  acceso al POS va al pos, si tiene mas accesos … la pantalla general») sin nombrar el POS.
- La app instalada se llama **«CheckPass Negocios»** (`name`, `short_name`, titulo). **Excepcion nombrada**: el `id` de la
  PWA queda congelado en su valor historico (`"/backoffice/pos"`): cambiarlo hace que los navegadores traten la app
  instalada como otra app. Es un identificador opaco, no una ruta que el core use; el test de frontera lo lista.

### 3. Accion por local — `locationAction`

```ts
locationAction?: { label: string; icon?: string; permission: string }
```

`ui-registry` del modulo aporta `locationPanel: ComponentType<{ location: { id: string; name: string } }>`. Locales dibuja
un boton por modulo encendido que la declara (y cuyo permiso tiene el usuario) y abre el panel como hoy abre «Mesas».

### 4. Regla para no apagarse — `beforeDisable` (servidor)

`server-registry` acepta, por modulo, `beforeDisable?: (tx, businessId) => Promise<ModuleError | null>`. El toggle del
core (`setModuleEnabled`) lo llama al APAGAR, dentro de su transaccion y despues de su advisory lock por negocio, y
despues del chequeo de dependientes (`module_required_by` sigue primero). Un error devuelto es la respuesta (el POS:
409 `pos_has_open_orders` con `openCount`; Mesas: 409 `tables_has_open_orders`).

Para que «apagar» y «crear algo que impide apagar» no se crucen, el core ofrece
`lockModuleEnabled(tx, businessId, moduleId)`: toma el MISMO advisory lock en modo compartido
(`pg_advisory_xact_lock_shared`) y relee el modulo; apagado → 403 `module_disabled`. El toggle lo toma exclusivo. Reemplaza
el `FOR UPDATE`/`FOR SHARE` sobre `core.business` de `server/pos/module.ts`.

### 5. Dependencia opcional — `optional`

```ts
optional?: readonly string[]   // modulos que este USA si estan encendidos, y sin ellos degrada
```

- Un modulo puede NOMBRAR (como id) a un modulo de `requires` u `optional`, y consultar si esta encendido
  (`isModuleEnabled` / `lockModuleEnabled`). Solo puede IMPORTAR codigo o tablas de los de `requires`.
- Encender o apagar un modulo `optional` no tiene 409 por dependencia: el que lo usa degrada.
- POS: `optional: ["tables"]`. Con Mesas apagado: no ofrece selector de mesa, `GET …/pos/tables` devuelve `[]`, y una
  orden con `diningTableId` es 422 `tables_disabled`. Crear u ocupar una mesa toma `lockModuleEnabled(…, "tables")`.

### 6. Datos de Mesas viven en el esquema `pos`

Decision del owner 1 (plan): «las tablas del POS **y Mesas** se mudan a un esquema propio `pos`». `dining_table` vive en
`pos` junto con `pos_order` (la FK `pos_order.dining_table_id` queda dentro del esquema) y la usan dos modulos:
- **POS** (sus datos): selector de mesa, ocupacion (unico parcial), validar la mesa al crear la orden;
- **Mesas** (`requires: ["pos"]`, puede importar del POS): alta, edicion, archivo y orden de las mesas de cada local.
`ticket_settings` (el ticket impreso del POS, spec 0184) tambien pasa a `pos`: es dato del POS, sin excepciones al
patron.

### 7. Rutas solo del owner

`ModuleRoute` acepta `owner: true`: el despachador aplica `requireApiOwner` en vez del permiso, y despues el modulo
encendido. Es lo que hoy hace `PUT /api/merchant/business/ticket`.

### 8. Contexto de la ruta

`ModuleRouteContext.business` pasa de `{ id }` a `{ id, currencyCode, status }` (lo que ya trae `requireApiPermission`):
los handlers del POS lo necesitan para acreditar y no lo vuelven a leer.

### 9. Frontera — reglas nuevas (cada una con su mutacion vista en rojo)

- **7.** Un modulo importa solo del core y de los modulos de su `requires`; nombra como id solo a los de `requires` y
  `optional`.
- **2 ampliada.** El core tampoco nombra los PERMISOS de un modulo (`includes("<perm>")`, `=== "<perm>"`,
  `permission: "<perm>"`), barrido con los permisos de los manifiestos.
- `optional` y `requires` solo nombran ids del registro, y ningun modulo se lista a si mismo.

## Consecuencias

- El POS entra al registro como cualquier modulo; Mesas tambien. El core pierde `posEnabled`, `requirePosOperator`,
  `assertPosGrantable`, el permiso `pos` del catalogo del core y las rutas `/api/pos/*`, `/api/merchant/business/{pos,ticket}`
  y `/api/locations/:id/tables…`.
- La escalera del POS pasa a ser la del despachador (`requireApiPermission`): mismo orden (sesion, miembro, permiso,
  email del owner, `status`, cobro, PIN temporal) — cambian las copias de dos mensajes y el codigo `pos_disabled` →
  `module_disabled`.
- Mudar las tablas rompe al codigo viejo: la migracion va JUNTO con el deploy (plan, Fase 2c).
- Lo que no cubre: un modulo que necesite pantalla sin el marco del panel. Si aparece, otro ADR.
