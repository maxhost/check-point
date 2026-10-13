# Encargo para GPT — pantallas del POS y Mesas como modulos (spec 0220, parte 2b)

Lo arma Claude. Decision del owner (plan de modulos, 2026-10-13): las pantallas de modulo las mueve GPT con encargo de
Claude. Solo la parte 2b de `docs/specs/0220-pos-y-mesas-como-modulos.md`; nada mas.

## 0. Antes de empezar

- Leer `docs/MODULOS.md`, `docs/adr/0141-puntos-de-enganche-del-pos-y-mesas.md` y la tabla de rutas de la spec 0220.
- Rama `dev`, commits chicos, sin push. Tu spec se numera desde **0222**.
- El servidor ya esta en `dev` (`52690f3`, `c5f2036`, `db48f51`, revisor PASS): las rutas viejas del POS y Mesas
  **ya no existen** y las pantallas hoy llaman URLs borradas. No toques `modules/*/server/**`, `modules/*.ts` (salvo tus
  lineas de `ui-registry.ts`) ni `packages/db`.

## 1. Lo que hay que lograr

El core del panel no puede nombrar al POS ni a Mesas. Lo vigilan `modules/modules-boundary-literals.test.ts`
(`PENDING_GPT`) y `modules/modules-boundary.test.ts` (`PENDING_GPT_DIRS`, `PENDING_GPT_IMPORTS`, `PENDING_GPT_SCREENS`),
con la cuenta exacta de lo que falta. **Terminas cuando esas listas quedan vacias y los tests en verde**, salvo las tres
filas de `session-view.ts`, `read-surfaces-leak.test.ts` y `session.neon.integration.test.ts` (`posEnabled`
transitorio del servidor): esas las saca Claude despues de tu entrega. No dejes de leer `posEnabled` en ninguna
pantalla: usa `business.enabledModules` de `GET /api/merchant/session`.

### A. Mudar las pantallas

- `app/backoffice/pos/**` → `modules/pos/ui/**`; borrar `app/backoffice/pos/` (lo sirve el despachador
  `app/backoffice/[module]/[[...path]]`). En `ui-registry.ts`: `pos: { screens: { "": <la consola> }, settingsPanel }`.
- El panel de Mesas (`locations/location-tables.tsx`) → `modules/tables/ui/`; en `ui-registry.ts`:
  `tables: { screens: {}, locationPanel }` (props `{ location: { id, name } }`).
- El ticket (`settings/ticket-settings.tsx` + tipos) → `modules/pos/ui/`, como `settingsPanel` del POS.
- `pos-settings.tsx` se borra: el switch del POS es el generico de Ajustes (ver C).
- `posRequest` (hoy en `pos/pos-types.ts`, lo usan Stock, Recetas, Locales y Ajustes) → un helper del core del panel; un
  modulo no puede importar de otro que no requiere.
- La impresion ya esta en `modules/pos/ui/printing/` (la movio Claude): solo actualizar los imports.

### B. URLs nuevas (misma forma de cuerpo y respuesta salvo lo marcado)

| Antes | Ahora |
|---|---|
| `/api/pos/<resto>` | `/api/modules/pos/<resto>` (`catalog`, `orders`, `orders/:id`, `…/close`, `…/void`, `resolve`, `coupon-state`, `coupon-remove`, `tables`, `ticket`) |
| `GET\|PUT /api/merchant/business/ticket` | `GET\|PUT /api/modules/pos/ticket-settings` (solo owner) |
| `PUT /api/merchant/business/pos` `{enabled}`→`{enabled}` | `PUT /api/modules/pos` `{enabled}`→`{module}` |
| `/api/locations/:l/tables[/:t[/status]]` | `/api/modules/tables/locations/:l[/:t[/status]]` |

Codigos que cambian: `pos_disabled` → `module_disabled` (403). `GET /api/modules/pos/tables` con Mesas apagado responde
`{ tables: [] }`; una orden con mesa y Mesas apagado es 422 `tables_disabled`.

Llamadas a rutas borradas medidas por Claude: `pos-cache.ts:88,102`, `pos-types.ts:120`, `pos-printing.ts:54`,
`pos-payment.ts:261,304`, `pos-console.tsx:639`, `pos-tables.tsx:24`, `settings/pos-settings.tsx:48`,
`settings/ticket-settings.tsx:37,63`, `locations/location-tables.tsx:19,73-76`.

### C. Puntos de enganche (sin nombrar ningun modulo en el core)

Los modulos encendidos salen de `business.enabledModules` (sesion). Los manifiestos se leen de `MODULES`
(`modules/registry.ts`, puro, se puede importar desde el cliente): `GET /api/modules` no trae `operation` ni
`locationAction`.

- **Barra movil** (`backoffice-navigation.tsx`, hoy `segment === "pos"`): en `/backoffice/<id>/…` de un modulo con
  `operation`, mostrar sus entradas de menu + un boton principal (`operation.primaryAction.label`/`icon`) que dispara
  `window.dispatchEvent(new CustomEvent("checkpass:module-primary", { detail: { moduleId } }))`. La consola del POS
  escucha ese evento en vez de `POS_NEW_ORDER_EVENT`. Visualmente igual a hoy.
- **Aviso de prueba** (`trial-notice.tsx`): en las rutas de un modulo con `operation`, solo en los ultimos 7 dias
  (la regla de hoy del POS, generalizada).
- **Menu**: la entrada POS sale de `navigation` del manifiesto (como Stock y Recetas). Borrar `posLink`.
- **Locales** (`locations-console.tsx`): un boton por modulo encendido con `locationAction` (y cuyo `permission` tiene
  el usuario; el owner todos) que abre su `locationPanel`. Hoy es «Mesas», sin icono.
- **Ajustes**: el switch del POS y de Mesas es el generico de modulos (ya existe). Mostrar los 409 del servidor:
  `module_required_by` (`dependents`), `pos_has_open_orders` y `tables_has_open_orders` (los dos con `openCount`; hoy el
  POS tiene un modal propio «No puedes desactivar el POS»: mismo texto, pero desde el `error` del servidor). Debajo, el
  `settingsPanel` de cada modulo encendido que lo declare.
- **Equipo**: el permiso `pos` ya llega como permiso de modulo (`GET /api/modules` → `permissions`); quitar los casos
  especiales de `posEnabled` en `permission-picker`, `staff-console`, `staff-views`, `staff-api`.
- **POS sin Mesas**: si `tables` no esta en `enabledModules`, el POS no muestra el selector de mesa (orden solo con
  nombre). Adentro de `modules/pos/ui/` SI se puede nombrar `tables` (es `optional` del POS); nunca importar de
  `modules/tables/`.
- `pos-module-changed` desaparece. Hoy no hay un evento generico: el switch generico de Ajustes, despues de un `PUT
  /api/modules/<id>` exitoso, dispara `window.dispatchEvent(new CustomEvent("checkpass:modules-changed"))`, y la
  navegacion y Locales lo escuchan para releer la sesion.

### D. e2e

Reapuntar `tests/e2e/pos.spec.ts`, `pos-printing.spec.ts`, `tables.spec.ts`, `ticket-settings.spec.ts`,
`module-settings.spec.ts` (y el que toque la barra o Equipo) a las URLs y codigos nuevos, sin aflojar aserciones.
Agregar: Mesas apagado → el POS no ofrece mesa; apagar Mesas con una orden en mesa → mensaje del 409.

## 2. Como se verifica

`pnpm --filter @mi-pasaporte/merchant exec vitest run src/modules` verde con las listas vacias (salvo las 3 filas de
`posEnabled` del servidor), typecheck, lint, `node tools/ui-guard.ts --base origin/main` y tus e2e. Despues Claude saca
`posEnabled` del servidor y un revisor adversarial revisa todo junto.
