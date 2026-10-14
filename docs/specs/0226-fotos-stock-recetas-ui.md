---
spec: 0226
fecha: 2026-10-13
estado: implementada
resumen: Rehabilitar Foto en Stock y Recetas con contratos0224, camara/galeria1-3fotos, JPEG2000px o original si no decodifica, multipart y borrador editable existente. Dos tareas independientes del piloto0225 y QAconjunto, sin cambiosAPI/kit/PROD.
disjunta: si entre Stock y Recetas; helpers comunes preparados antes por coordinador
archivos: apps/merchant/src/modules/{stock,recipes}/ui/**, apps/merchant/src/app/backoffice/{panel-request.ts,draft-photos.ts}, tests/e2e/{stock-photos,recipes-photos}.spec.ts, tests/e2e/support/*photos*, docs/factory/**
---

# 0226 — Foto en Stock y Recetas

## Problema y alcance

StockInputModal soloAudio/Manual; RecipeEditor solo dictado/manual. Servidor0224 ya expone foto. Owner pide rehabilitar imagenes en ambos. Preservar identidad, flujo y borradores; sin servidor/kit/migraciones/cambios de producto laterales.

## Diseño

- BotonFoto junto al dictado: camara o galeria,1-3fotos. KitFileButton existente, ninguna inputnativa nueva. Seleccion reemplazable/quitable, limites y espera visibles; texto tuteado.
- Preparar fotos secuencialmente, JPEG2000px lado mayor sin ampliar pequeñas; si browser no decodifica, mandar original. Validar1-3, max4MiBporfoto/4,4MiBtotal despues de preparar. Nada de photos guardadas en storage/log/URL; liberar recursos de preview al cambiar/cerrar.
- HelperHTTPcomun preparado por coordinador: FormData `photos` sin Content-Type manual; error del servidor visible conservando archivos/borrador para reintentar o cargar a mano.
- StockPOST `/api/modules/stock/entries/draft-photo` y RecetasPOST `/api/modules/recipes/:productId/draft-photo` → `{ draft }` existente. Foto solo en nueva cargaStock, no ajuste. Receta siempre del producto abierto, sin nueva receta por foto.
- Hasta45s de analisis: espera clara, locksincrono contra dobleenvio y cierre bloqueado; respuesta tardia no actualiza un componente desmontado. Error422/413/415/503/403 y404Recetas se muestran con recuperacion.
- IA solo genera borrador; ningunaregistro de Stock/receta se escribe hasta revisar y guardar con flujo existente. Unparsed/acknowledgement, yield/cantidades/null, archivados y validaciones actuales conservados.

## Tareas y reservas

Coordinador prepara panel-request/draft-photos antes. Workerstock: solo modules/stock/ui y testsstockphotos propios. Workerrecipes: solo modules/recipes/ui y testsrecipesphotos propios. QAindependiente usa snapshots exactos, registra evidencia; helpers/core/registros/contratos no se editan simultaneamente.

## Definition of Done y pruebas

- [x] Camara/galeria1-3fotos, preparacion/tamaño/fallback y reeleccion disponibles en ambas superficies.
- [x] Multipart correcto, error/retry conserva seleccion, dobleenvio/cierre bloqueados.
- [x] Borrador editable y guardado explicito preservan flujo de Stock/Recetas; dictado/manual siguen disponibles.
- [x] E2e focales de exito+error+concurrencia y limites de fotos, render390/1280 inspeccionado en maxdosrondas.
- [x] Tipos/lint/guardia sin aumentos; buildMerchant en candidato; QAindependiente comprueba aceptacion conjunta.

No unit+Neon+browser+mutaciones universal: browserpara archivos/multipart/interaccion, helperunitpara logica si aporta. Contrato/guardsDB ya tienen pruebas0224; smoke real si entorno disponible, nuncaIAcontraPROD. Gatefinal0225 cubre backlog.

## Abierto

Nada de producto abierto. IAreal necesita entorno local configurado; no inventar evidencia ni tocar Vercel/PROD. Spec0224 §Encargo aGPT y ADR0143 son fuente del contrato.

## Entrega y verificación

Stock244882bb y Recetasa2fab2e2, QA independiente2b7ae272 PASS.9/9browser focal;390/1280 inspeccionados. Smoke OpenAI real en DBlocal ficticia: ambas200,2/3líneas, yield2Recetas, sin guardado. Gates y límites en docs/factory/0225-qa.md y estadoGPT. Sin push/PROD.
