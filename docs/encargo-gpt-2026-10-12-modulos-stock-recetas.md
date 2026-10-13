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

### Separacion (owner 2026-10-12, corrige la version anterior de este encargo)

Recetas y Stock son pantallas de **GESTION**. Lo que es lectura (stock restante, costo, margen, «cuanto gano») es de
**Analitica**, que todavia no se diseño: **no va en estas pantallas**. Owner: «la pantalla de recetas deberia
gestionar recetas como catalogo gestiona productos, stock deberia gestionar stock pero incluso lo veo como un "log"
de inputs».

### B. Stock (visible con el modulo `stock` encendido)

- Insumos: crear (`POST /api/modules/stock/items` `{ name, unit }`, unidad `g` | `ml` | `unit`), renombrar,
  archivar / reactivar (`PATCH …/items/:id`).
- **Registro general (el log):** `GET /api/modules/stock/movements` trae TODOS los insumos del mas reciente al mas
  viejo, con fecha, `itemName`, `unit`, tipo (compra / conteo), cantidad y precio (o null). Es la pantalla principal.
- **«Añadir»** (compra, una o varias cosas juntas): `POST /api/modules/stock/entries` con `lines`, cada una con un
  insumo existente (`itemId`) o uno nuevo (`newItem: { name }`), cantidad, unidad (`g | kg | ml | l | unit`, la API
  convierte) y precio OPCIONAL. Cada linea queda como un registro separado en el log. Es el mismo endpoint que va a
  usar el audio mas adelante: no hace falta pensar el audio ahora.
- **«Ajustar stock»** (conteo): `POST /api/modules/stock/items/:id/adjustments` `{ countedQuantity }`.
- El historial de un solo insumo sigue en `GET …/items/:id/movements` si hace falta.

### C. Recetas (visible con el modulo `recipes` encendido)

- Gestionar recetas como Catalogo gestiona productos: lista de productos con o sin receta (`GET /api/modules/recipes`,
  usar `lineCount`) y editar la receta de un producto: elegir insumos y poner cantidades (`GET` / `PUT
  /api/modules/recipes/:productId` `{ lines: [{ itemId, quantity }] }`).

## 3. Propuestas de Claude (no las pidio el owner; decidilas con el)

- «Stock» y «Recetas» como entradas del menu del backoffice que salen de
  `GET /api/modules` (`enabled`), sin nombrar modulos en la navegacion (ADR 0138).
- Marcar como «Sugerido» los modulos con `suggested: true`.
- Crear un insumo desde el buscador del editor de recetas, sin salir de la receta.
- Un renglon con el costo resultante dentro del editor de recetas (dato para decidir la cantidad, no analitica). **El
  owner no lo decidio: preguntale antes de hacerlo.**
