---
spec: 0095
fecha: 2026-09-25
estado: implementada
resumen: Dos arreglos de la pantalla de catalogo pedidos por el owner. El boton «Probar importador» pasa a «Importar con IA». Los filtros del listado (categoria y local) dejan de ser `<select>` nativos con el estilo viejo `.catalog-filter` y usan `SelectField` del sistema de diseño —el mismo del wizard de alta y del editor de producto—, que gana una prop opcional `hideLabel` para dejar el label solo para lectores de pantalla.
disjunta: si
archivos: apps/merchant/src/app/backoffice/catalog/{catalog-page.tsx,products-tab.tsx}, apps/merchant/src/ui/select-field.tsx, apps/merchant/src/app/globals.css
---

# 0095 — Catalogo: boton de IA y filtros del sistema de diseño

> Plantilla **chica**: un dominio, cero migraciones. Decision del owner, 2026-09-25, textual:
>
> *«en la pantalla catalogo el boton "Probar importador" no deberia tener ese label, deberia ser
> otro que indique que es la funcion de importar con IA. luego en la misma pantalla de catalogo, el
> dropdown que funciona como filtro de categorias no tiene el mismo estilo que el resto de inputs,
> puedes tomar como ejemplo el formulario del wizard para comprender a que me refiero»*
>
> El texto elegido es **«Importar con IA»**. El filtro de **local** tiene el mismo problema y el
> mismo estilo viejo que el de categoria: se migra con el, para no dejar dos selects distintos lado
> a lado.

## Problema

- `catalog-page.tsx`, la seccion «Carga inteligente»: el boton dice «Probar importador», que suena
  a demo y no dice que es IA.
- `products-tab.tsx`, `.catalog-toolbar`: los dos filtros son `<select className="catalog-filter">`
  nativos (flecha del navegador, estilo de `globals.css` `.catalog-filter`). El wizard de alta
  (`business/onboarding/_components/business-step.tsx`, `program-step.tsx`) y el editor de
  producto (`product-editor.tsx`) usan `SelectField` (`ui/select-field.tsx`, react-aria, tokens del
  sistema).

## Alcance

**Entra:** el texto del boton; los dos filtros a `SelectField`; la prop `hideLabel` de
`SelectField`; el ancho de los filtros en el toolbar.

**No entra:** el buscador, el resto del copy de la seccion «Carga inteligente», otros `<select>`
nativos del backoffice.

## Diseño

- `SelectField` gana `hideLabel?: boolean` (default `false`). Con `true` el `<Label>` suma la clase
  `sr-only`: sigue nombrando al control para lectores de pantalla, no ocupa lugar. Sin la prop,
  ningun uso existente cambia.
- `products-tab.tsx`: cada filtro es `<SelectField hideLabel className="catalog-toolbar-select"
  label="Filtrar por categoría" | "Filtrar por local" …>`. La opcion «todas» usa el id `"all"`
  (react-aria no admite bien una `Key` vacia) y se traduce al `""` del estado actual:
  `selectedKey={categoryId || "all"}`, `onSelectionChange={(key) => setCategoryId(key === "all" ?
  "" : String(key))}`. La logica de `filtered` no cambia.
- `globals.css`: `.catalog-toolbar .catalog-toolbar-select { min-width: 0; }`. **El ancho NO lo
  decide esta regla**: hay dos `.catalog-toolbar` y la segunda (grid con `grid-template-columns`)
  gana; un `flex` aca seria codigo muerto (lo cazo el revisor). El `onSelectionChange` trata `null`
  como «sin filtro», para que un `String(null)` no vacie el listado.
  Las reglas `.catalog-filter` quedan sin uso y **se borran** (CLAUDE.md: no dejar rastros viejos),
  incluida `.catalog-toolbar .catalog-filter`.
- `catalog-page.tsx`: «Probar importador» → «Importar con IA».

## Addendum (2026-09-25) — alineacion con el buscador

QA del owner, textual: *«el dropdown no esta alineado al buscador verticalmente en catalogo
deberian tener el mismo alto y estar alineados en desktop dropdown esta ligeramente arriba»*.

**Causa, MEDIDA** en Chromium (Playwright sobre el CSS compilado, a 1280 px): el buscador es un
`<label class="catalog-search">` y heredaba `margin-top: 15px` de la regla global `label`
(`globals.css`); medido: buscador `top 51 / 46 px`, dropdown `top 42.5 / 48 px`. **Fix:**
`.catalog-toolbar { align-items: center }` y `.catalog-toolbar .catalog-search { min-height: 48px;
margin: 0 }` (48 px = `min-h-12` de `SelectField`). **Despues:** los dos `top 36 / bottom 84 / 48
px` a 1280 px; a 400 px apilados, ambos de 48 px. El harness no carga las variables de marca, asi
que no mide colores ni bordes.

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/ui/select-field.tsx` | editar (prop opcional) |
| `apps/merchant/src/app/backoffice/catalog/products-tab.tsx` | editar |
| `apps/merchant/src/app/backoffice/catalog/catalog-page.tsx` | editar |
| `apps/merchant/src/app/globals.css` | editar |

**Disjunta?** Si.

## Definition of Done

- [ ] `rg -n "Probar importador" apps/merchant/src` → vacio; `rg -n "Importar con IA"` → 1.
- [ ] `rg -n "<select" apps/merchant/src/app/backoffice/catalog` → vacio.
- [ ] `rg -n "catalog-filter" apps/merchant/src` → vacio.
- [ ] Gates de root con Node 24: `typecheck`, `lint`, `test`, `format:check`, `build`, `test:e2e`.

## Mutaciones — presupuesto: 0

Sin oraculo automatico: no hay tests de componente con interaccion y el e2e no visita
`/backoffice/catalog`. Se declara.

## Declarado AFUERA (sin oraculo, a proposito)

- Que filtrar por categoria y por local siga funcionando al elegir en el nuevo desplegable, que
  «Todas las categorías» vuelva a mostrar todo, y el aspecto: **QA del owner**.

## Handoff

La implementa el orquestador; revisor independiente sobre el diff antes de `implementada`.

## Abierto

Nada.
