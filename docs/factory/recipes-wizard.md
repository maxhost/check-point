# Entrega recipes-wizard (L1)

- Base `dev`: `b87f5d40def5e4c99de8bafc50a625f55e7712f5`.
- Commit de producto comprobado: `7564d2905543d3c0206b78e11e362891095c9375`.
- Rama/worktree: `factory-recipes-wizard`, `/private/tmp/checkpass-recipes/factory-recipes-wizard`.
- Encargo y mini plan aprobados en conversación. Corrección final del owner: lista sin costo ni aviso de costo incompleto. No spec ni ADR.

## Cambios y archivos

Restaurados la navegación de `recipes/manifest.ts`, el registro en `modules/ui-registry.ts` y la lista en `recipes/ui/recipes-console.tsx` con el formato anterior: producto y cantidad de ingredientes. Los combos muestran la marca Combo y cantidad de recetas. Sin costos, selector de local, filtros, recientes ni archivar.

`recipe-modal.tsx` implementa cuatro pasos: tipo, un producto mediante búsqueda, borrador IA de Catálogo o selección múltiple de recetas de Combo, y revisión/confirmación. El nombre Catálogo viene del producto y se edita en paso 2. Las cantidades de ingredientes y de cada receta componente se editan exclusivamente en paso 4. Editar abre ese paso; elegir un producto ya compuesto abre la composición existente. Atrás permite modificar los pasos anteriores; cambiar producto/tipo limpia las identidades anteriores.

`recipe-source.tsx` conserva texto/fotos al retroceder, mantiene dictado del teclado, fotos y carga manual. `recipe-lines.tsx`, `recipe-types.ts` y su test recuperan el editor y validación anteriores. `recipe-requests.ts` recorre todas las páginas R1 y limita concurrencia al leer composiciones para el listado.

## Contratos consumidos, sin cambios de backend

- `GET /api/modules/recipes/products?limit=100&status=all[&cursor=…]` y `GET library` con la misma paginación. De library se usan `id`, `name`, `status`, `revisionId`, `lineCount`.
- `GET products/:productId/composition`: lectura al listar/seleccionar. `GET library/:recipeId`: ingredientes al editar Catálogo.
- `POST library`: `{name, lines}`. `PUT library/:recipeId`: `{name, lines, expectedRevisionId}`. Las líneas mantienen `{itemId, quantity, unit}` o `{newItem:{name}, quantity, unit}`.
- `PUT products/:productId/composition`: `{isCombo, recipes:[{recipeId, quantity}], expectedRevisionId}`. Combo empieza cada receta en 1 y acepta hasta 3 decimales. Catálogo preserva el multiplicador existente de la composición, normalmente 1.
- `POST draft`: `{name,text}`. `POST draft-photo`: multipart `name` + 1 a 3 `photos`, preparadas con el helper común existente.
- Para el editor de insumos, `GET recipes/locations` provee el local predeterminado (o primero disponible) para `GET stock/items?status=all&locationId=…`. El local no cambia la receta ni se muestra costo.

Se preservan las revisiones optimistas de R1. Confirmar Catálogo sin cambios no reescribe library. Si library se guarda pero falla composition, el modal conserva receta, revisión y IDs de insumos resueltos, y permite reintentar sin recrearlos. Muestra que la receta ya se guardó. R1 no ofrece una operación atómica para ambos guardados: cerrar después del fallo parcial deja la receta en library; la UI lo avisa. La pérdida de respuesta de una escritura se rige por el contrato existente, sin claves nuevas de idempotencia.

Editar una receta compartida actualiza sus usos según el fanout existente de R1; se informa en la revisión. No se tocaron backend, migraciones, kit, tooling, estados, INDEX ni TASKS.

## Evidencia

En este worktree, Node `v24.20.0`, dependencias aisladas, sin env ni DB asignada. Cada comando Node precedido de `source ~/.nvm/nvm.sh && nvm use`.

- `pnpm --filter @mi-pasaporte/merchant typecheck`: exit 0 (`tsc --noEmit`).
- `pnpm exec eslint apps/merchant`: exit 0.
- `pnpm exec vitest run apps/merchant/src/modules/recipes/ui/recipe-types.test.ts`: 1 archivo, 22 tests PASS, sin skips ni retries.
- Prettier en los archivos UI y `git diff --check`: correctos.

Los checks corresponden al contenido de producto del commit indicado; este archivo de handoff se agrega después. No se ejecutaron browser, e2e, build, suites DB ni verify global. QA funcional en browser queda a cargo del owner; los checks estáticos no certifican ese recorrido.

## Prueba manual del owner

1. En el entorno de desarrollo habitual, con Recetas y Stock activos y permiso Recetas, abre `/backoffice/recipes`. Comprueba producto/conteos, combos marcados y ausencia de costos.
2. Nueva receta → Catálogo → buscar un producto sin composición. El listado aparece solo al escribir; al elegir desaparecen los resultados y aparece el nombre editable.
3. Continúa: escribe o dicta ingredientes, o elige/toma fotos, y analiza. En revisión corrige cantidades/insumos, confirma y verifica la fila. Prueba también carga manual y retorno a pasos anteriores.
4. Nueva receta → Combo → buscar producto → buscar y agregar varias recetas. Quita una y agrega otra. En revisión cambia la cantidad de cada receta, incluyendo `0,5`; confirma y vuelve a editar.
5. Editar desde la lista debe abrir paso 4 con datos. Elegir desde el paso 2 un producto con receta/combo debe abrirlo en edición, sin crear otro. En Catálogo vuelve a paso 2 para cambiar el nombre.
6. Si deseas comprobar recuperación de errores, bloquea únicamente el `PUT …/composition` desde las herramientas de red del browser: tras fallar se informa el guardado parcial; habilita la ruta y reintenta sin crear otra receta ni insumos nuevos.

No se levantaron servidores ni procesos persistentes. Sin push ni integración a dev/main. Siguiente paso: revisión independiente del coordinador sobre el candidato congelado y QA browser del owner.
