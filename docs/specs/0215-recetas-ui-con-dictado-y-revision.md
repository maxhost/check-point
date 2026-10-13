---
spec: 0215
fecha: 2026-10-12
estado: implementada
resumen: Gestión de recetas por producto, selección del catálogo, dictado y revisión editable antes de guardar mediante contratos 0210/0214.
disjunta: si
archivos: apps/merchant/src/app/backoffice/recipes/**
---

# 0215 — Recetas: selección de producto, dictado y revisión

Nivel L2. Un dominio, sin migraciones. Owner define Nueva receta → modal de búsqueda del producto → texto dictado con micrófono del teclado → análisis → ingredientes editables → confirmar.

## Problema

`apps/merchant/src/app/backoffice/recipes/page.tsx` muestra solo un mensaje provisional. No permite crear ni editar recetas con las API implementadas0210/0214.

## Alcance

Entra: lista de recetas guardadas, selección entre productos sin receta devueltos por GET recipes, edición de receta existente, dictado, carga manual alternativa, revisión de ingredientes existentes/nuevos, guardado y recarga. Skeleton, vacío, carga, errores y reintento. Conserva contenedor de Stock/Catálogo.

Fuera: costes/márgenes/analítica, fotos/audio grabado, subrecetas, API/servidor/kit y publicación.

## Diseño

- GET `/api/modules/recipes` devuelve todos los productos; lineCount distingue recetas guardadas y productos disponibles para Nueva receta. Buscador local por nombre dentro del modal.
- GET `/api/modules/recipes/:productId` carga ingredientes para editar; GET `/api/modules/stock/items?status=all` permite conservar archivados ya presentes, sin añadir archivados nuevos.
- POST `/api/modules/recipes/:productId/draft` `{text}` trim1..2000; responde draft `{yield,lines,unparsed}`. Cantidades ya por unidad y en g/ml/unit: no dividir otra vez. quantity null obliga completar. sourceText visible. Análisis no guarda.
- Revisión: seleccionar insumo activo o crear nuevo, nombre1..80, cantidad positiva hasta3 decimales, unidad compatible. Máximo50; sin repetidos. unparsed requiere reconocimiento explícito. Dictado alternativo conserva texto al volver, sin borrar receta existente hasta recibir borrador exitoso.
- PUT `/api/modules/recipes/:productId` `{lines:[{itemId|newItem:{name},quantity,unit}]}` reemplaza receta y crea insumos atómicamente. Vaciar receta existente permite guardar lines[]; una nueva requiere al menos un ingrediente válido.
- Errores HTTP `{error,code}` se muestran tal cual:401/402/403,404 product_not_found/item_not_found,409 item_archived/item_name_taken,422 invalid_text/invalid_line/invalid_quantity/invalid_unit/unit_mismatch/duplicate_item/too_many_lines,503 draft_unavailable. Error conserva borrador; análisis fallido permite manual. Requests bloquean doble envío y cierre durante escritura/análisis. Éxito cierra modal y recarga lista; fallo de recarga no repite escritura.
- Guard de página catalog existente; servidor aplica módulo/permisos/aislamiento. Solo contratos HTTP, sin importaciones del servidor de módulos.

## Archivos

`recipes/page.tsx`, `recipes-console.tsx`, `recipe-modal.tsx`, `recipe-lines.tsx`, `recipe-types.ts`, `recipe-types.test.ts`.

Disjunta con implementación backend0214. Ajustes de Stock locales anteriores se conservan.

## Definition of Done

- Tipos merchant, ESLint, Prettier, ui-guard sin aumentos y diffcheck pasan.
- Tests específicos de payload: null/a gusto impide guardar, coma decimal, insumo nuevo/existente, unidad incompatible, repetidos, archivado existente/conservado, límites, no dividir cantidades por yield.
- Revisión visual y LLM real por owner en dev-business: no Chrome por indicación previa. Sin verify global hasta publicación (ADR0129).

## Declarado afuera

Sin suite de navegador ni escrituras reales por herramientas; no se afirma verificación visual ni proveedor real. No subagentes/adversarial para L2 (ADR0129).

## Abierto

Ninguno.

## Verificación ejecutada (2026-10-13)

Vitest con config de merchant:12/12 en183ms. Primer comando con filtro de proyecto merchant no coincidía con ningún proyecto; se corrigió usando config/cwd del paquete. Typecheck final0 (aserción de test sobre union itemId/newItem corregida), ESLint0, Prettier0, ui-guard sin aumentos y diffcheck0. No Chrome ni escrituras HTTP reales/LLM por herramientas: owner revisa en dev-business. Spec reservada en92c088d; implementación868f3b3, merge local a main3dcd5a5 autorizado por owner. API/kit intactos.

## Cierre de pendientes (2026-10-13)

Revisada por pedido del owner: no queda funcionalidad pendiente dentro del alcance. Dictado, revisión de cantidades vacías, rendimiento por unidad, insumos nuevos, edición y errores ya implementados. QA visual/LLM real del comercio sigue declarado fuera de los oráculos ejecutados; no se presenta como probado por GPT.

Ajuste posterior L1: cantidades recibidas por GET/draft se inicializan en español sin agrupación para los campos editables (15.000→15;7.500→7,5;0.100→0,1). No se reformatea al teclear. Payloads convierten coma a punto y conservan valor; 13/13 tests específicos en136ms. Tipos merchant/ESLint/formato/guardia sin aumentos/diffcheck0. No se movieron archivos: migración de pantallas de0216 queda para el encargo posterior.
