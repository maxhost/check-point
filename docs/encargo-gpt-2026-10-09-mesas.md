# Encargo para GPT — 2026-10-09: pantallas de mesas

Lo arma Claude a pedido del owner. La API de mesas esta hecha, probada y **en live** (`main` = `9405c93`, migracion
0067 aplicada en PROD). Faltan las pantallas (zona GPT, ADR 0114). Cierra el punto (1) de PARQUEADO #83.

## 0. Rama `dev`, sin push

Commits chicos en `dev`. No hagas merge a `main` ni push: el paso a live lo hace Claude con el OK del owner
(`docs/TRABAJO-EN-PARALELO.md` §3). Tu spec se numera desde **0187**.

## 1. Fuente de verdad

- Spec `docs/specs/0182-mesas-del-local.md` §Diseño: rutas, DTO, errores. Es el contrato; leelo entero.
- ADR `docs/adr/0131-*.md` (mesas del local).
- No toques `apps/merchant/src/server/**` ni `app/api/**`. Si el contrato no alcanza, avisale al owner.

## 2. Que pidio el owner (2026-10-09)

### A. Administrar mesas desde Locales

1. En cada tarjeta de local (`backoffice/locations/locations-console.tsx`), un **boton «Mesas»** al lado de
   «Editar». **El modal de Editar no se toca.**
2. El boton **solo se ve con el POS activo**: `business.posEnabled` de `GET /api/merchant/session` (asi lo usa
   `staff/staff-console.tsx`).
3. Abre un **modal propio** «Mesas · <nombre del local>»:
   - Lista de las mesas **activas** (`GET /api/locations/:locationId/tables`, filtrar `status === "active"`).
   - **Boton «+ Añadir mesa»** → input del nombre + **Confirmar** → `POST /api/locations/:locationId/tables`
     `{ name }`. Se guarda en ese momento (no hay «Guardar» general; el modal solo tiene «Cerrar»).
   - **Renombrar** (lapiz): `PATCH /api/locations/:locationId/tables/:tableId` `{ name }`.
   - **Quitar**: `POST /api/locations/:locationId/tables/:tableId/status` `{ status: "archived" }`. No hay borrado:
     archivar la saca de la lista y del POS, y conserva las ordenes viejas.
4. Simple: sin asientos (`seats`), sin reordenar, sin vista de archivadas. La API los soporta; no se piden hoy.

Errores: el cuerpo es `{ error: "<mensaje en español>", code: "<codigo>" }`. **Mostrá `error` tal cual** (ya
viene en español desde el servidor); usá `code` solo si necesitás reaccionar distinto. Los que vas a ver:
`table_name_taken` (409, nombre repetido entre las activas del local), `table_has_open_order` (409, al quitar una mesa
con orden abierta), `too_many_tables` (422, mas de 200), `invalid_input` (422, nombre vacio o de mas de 60).

Solo el owner administra mesas (`requireLocationsOwner`, el mismo permiso que los locales).

### B. Elegir la mesa en el POS

1. En el paso «Mesa» del POS (`backoffice/pos/pos-editor.tsx`, hoy un input «Nombre de mesa»), mostrar las mesas del
   local: `GET /api/pos/tables?locationId=<uuid>` → `{ tables: [{ id, name, seats, openOrderId }] }`.
   - `openOrderId` distinto de `null` = **ocupada**: mostrarla marcada y no elegible para una orden nueva (o que el
     toque abra esa orden, a tu criterio).
2. Elegir una mesa → `POST /api/pos/orders` con `tableId` (el servidor pone el nombre; el `tableLabel` se ignora).
   Cambiar de mesa → `PUT /api/pos/orders/:id` con `tableId`; `tableId: null` vuelve a texto libre.
3. **El texto libre sigue** como alternativa (locales sin mesas cargadas, o una mesa improvisada): sin `tableId`,
   `tableLabel` obligatorio, como hoy.
4. Errores (misma forma `{ error, code }`, mostrar `error`): `table_occupied` (409, otra orden abierta en esa mesa →
   recargar la lista); `unknown_table` (422, la mesa se archivo → recargar la lista); `table_location_mismatch` (422)
   no deberia pasar si mandas el `locationId` del local elegido.
5. `PosOrder` y las filas de `GET /api/pos/orders` traen `tableId: string | null`.

## 3. Como probar

- Local: `pnpm dev:local`. La 0067 ya esta en la base local y en PROD.
- e2e de los dos flujos (crear/renombrar/quitar mesa; abrir orden en una mesa y ver que queda ocupada).
- Antes de avisar que esta listo: typecheck, lint, ui-guard, format:check y tus e2e.
