# Encargo para GPT — 2026-10-12: pantallas de modulos, Stock y Recetas

Lo arma Claude a pedido del owner. Pedido del owner: **«salir de aqui con los modulos instalables o desactivables y
el sistema de stock y de recetas para poder probarlo mañana con un comercio real»**; las pantallas son de GPT
(ADR 0114). La API la hace Claude (spec 0210).

## 0. Rama `dev`, sin push

Commits chicos en `dev`. Sin merge a `main` ni push: el paso a live lo hace Claude con el OK del owner. Tu spec se
numera desde **0211**.

## 1. Fuente de verdad

- Spec `docs/specs/0210-modulos-stock-y-recetas.md` §«API — contrato HTTP»: rutas, formas, errores. Leelo entero. La API se esta implementando en paralelo: si al terminar cambia algo del contrato, Claude edita la
  spec y te avisa por el owner.
- ADR `docs/adr/0138-los-modulos-son-plugins-desacoplados-del-core.md`.
- No toques `apps/merchant/src/modules/**`, `app/api/**` ni `packages/db/**`. Si el contrato no alcanza, avisale al
  owner.
- Errores: `{ error, code }`. Mostrá `error` tal cual (viene en español).
- Numeros: llegan como string decimal (`"12.50"`, `"100.000"`); se mandan como number o string.

## 2. Lo que pidio el owner

### A. Activar y desactivar modulos

- **En Ajustes, junto a POS e Imprimir** (owner 2026-10-12: se activan «desde settings como hoy POS e Imprimir»;
  `backoffice/settings/page.tsx`, hoy renderiza `PosSettings`). Un switch por cada modulo de `GET /api/modules`
  (`PUT /api/modules/:id` `{ enabled }`), solo para el owner. El POS sigue con su switch actual (todavia no esta en
  el registro de modulos); que se vean iguales es decision de pantalla.
- Los `409 module_requires` / `module_required_by` traen `missing` / `dependents`: mostrar el `error` (ej. «Recetas
  necesita Stock»).
- Desactivar no borra datos.

### B. Stock (visible con el modulo `stock` encendido)

- Lista de insumos con nombre, stock estimado (`onHand` + unidad) y ultimo costo por unidad.
- Crear insumo (`POST /api/modules/stock/items` `{ name, unit }`, unidad `g` | `ml` | `unit`).
- Cargar compra de un insumo (`POST …/items/:id/purchases` `{ quantity, totalCost }`).
- Corregir stock con lo contado (`POST …/items/:id/adjustments` `{ countedQuantity }`).
- Archivar / reactivar y renombrar (`PATCH …/items/:id`).

### C. Recetas (visible con el modulo `recipes` encendido)

- Lista de productos del catalogo con precio, costo, margen y margen % (`GET /api/modules/recipes`); marcar los que
  no tienen receta y los de costo incompleto (`costComplete: false`).
- Editar la receta de un producto: elegir insumos y poner cantidades (`GET` / `PUT /api/modules/recipes/:productId`
  `{ lines: [{ itemId, quantity }] }`), viendo el costo de cada linea y el total.

## 3. Propuestas de Claude (no las pidio el owner; decidilas con el)

- «Stock» y «Recetas» como entradas del menu del backoffice que salen de
  `GET /api/modules` (`enabled`), sin nombrar modulos en la navegacion (ADR 0138).
- Mostrar `kg`/`l` en pantalla convirtiendo a `g`/`ml` al mandar (la API guarda la unidad base).
- Marcar como «Sugerido» los modulos con `suggested: true`.
