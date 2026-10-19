# 0242 CP2b.6 — edición completa V2

Task factory: `pos-update-v2-0242`. Base `a96397ab7c4350ab6b1576d7a08c3bb9b8e24a5c`. Implementación y tests congelados en `7d512a76af0f08de1434b4cee8c96c07f1ff3cf6`; esta entrega documental es posterior. Autor conserva fixes hasta QA independiente. Sin push ni operaciones PROD.

## Cambio y contrato

Solo PUT `orders/:id` selecciona `updatePosOrderV2` para `X-Pos-Contract:2`; ausente/1 conserva V1 y desconocido usa el error de upgrade tras guard/scope. Dispatcher y `posRoute` conservan permiso POS y private/no-store. Respuesta canónica V2 y `version_conflict.order` V2 después del rollback.

`measured-update.ts` valida comando completo con saleType DB, status/tenant/version, fuentes propias y contexto. Mantiene IDs/snapshots comerciales/productId incluso borrado; cantidades legacy altas solo intactas contra DB. Usa `resolveExistingMeasuredLine` y núcleo `buildFinancialAmountsFromSnapshots`, sin catálogo para recotizar fuentes, fusión por producto, Number financiero ni snapshots financieros nuevos. Unidades mass deshabilitadas solo conservan exactamente captura anterior; cambios dimensionalmente compatibles conservan tarifa/unidad tarifaria/conversión. Capturas nuevas usan `captureMeasuredLines`, revisiones y disponibilidad del destino. Lista completa elimina ausentes, conserva identidades y asigna posiciones; errores revierten cabecera/versión/contexto y todas las líneas.

Locks: toggle compartido → business-config → negocio SHARE → orden tenant UPDATE → mesa/local SHARE → fuentes UPDATE → nuevos productos ordenados SHARE. Configuración/catálogo usan el mismo mutex antes de productos; creación comparte prefijo y contexto/productos. Mesas consulta ocupación sin bloquear orden; close no toma mutex business-config ni negocio. Contexto histórico intacto conserva mesa/local/label de DB sin exigir reactivación; cambiar contexto valida mesa/local activos, pertenencia, módulo y ocupación.

Regresión encontrada tras aceptación previa de creación: `catalog_changed` enviaba `product` singular incompleto contra `PosConflictV2`. Ampliación explícita del coordinador autorizó shared capture y dos tests create. Ahora devuelve únicamente `products:[PosCatalogProductV2]`, incluye categoryId/imagePath público y excluye costos/storage keys/alias singular. Captura exitosa y replay no cambian.

## Verificación y evidencia

Node v24.20.0, pnpm 11.4.0, lock SHA256 `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821`. Logs privados completos: `/private/tmp/checkpass-pos-0242/evidence/update-7d512a76/` con `commands.txt`, `sha.txt`, `offline.log/.exit`, `ci.log/.exit`.

Offline final en SHA congelado: tipos db/domain/merchant, ESLint focal, formato focal, UI guard (3 archivos, sin aumentos), tests puros 35/35 (27 input existentes, 5 capture/create, 3 update fuentes). Exit 0, sin skips. Los tres casos mass son álgebra/fuentes; no certifican venta canónica mass mientras barreras0102/0103/0105 sigan vigentes.

CI final en SHA congelado: 19/19 PASS (11 create + 8 update), 2/2 archivos, 0 skips/retries, exit 0, duración 187.43 s. Teardown de ambas suites completado con aserciones de businesses/users/sessions ausentes. Los dos stderr code 22012 son fallos SQL intencionales para probar rollback; ambos casos PASS. Exclusivamente `NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env tools/neon-test.sh src/modules/pos/server/measured-update.neon.integration.test.ts src/modules/pos/server/measured-create.neon.integration.test.ts --no-file-parallelism`, reserva exclusiva hasta teardown. Config no copiada ni valores secretos registrados. Wrapper advierte consumer CI URL ausente; selección no ejecuta oráculo del rol consumer.

Casos update: guard/scope/V1/tenant/status; dos versiones simultáneas una gana y otra 409+DTO actual; rollback por fuente/revisión final inválida; fallo SQL real tras header/removal/update/insert; snapshots viejo+nuevo mismo producto/reordenar/eliminar; producto borrado/cantidad legacy alta; efectos de edición; mesa ajena/ocupada/local archivado/contexto conservado. Suite create revalida conflicto products[] y comportamiento previo. SQL de fallo `select 1 / 0` dentro de transacción real, sin DDL ni filas imposibles.

Fallos de desarrollo: tipos detectaron proyección pricingUnit sin estrechar y fixture location incompleto, corregidos antes del freeze. Primer comando Vitest `--project merchant` falló al arrancar por proyecto inexistente; comando correcto usa `pnpm --filter ... exec`. Git index.lock y ps recibieron EPERM sandbox, resueltos mediante escalación propia acotada. No se modificaron guards/tests para ocultar errores del producto.

No se ejecutó browser/build/fullverify ni nuevas migraciones. Sin cambios de GET list/POST exitoso/close/QR/UI/schema/barriers. Proceso/limpieza final: wrapper/vitest/esbuild terminados; ps acotado y lsof CWD confirmaron 0 procesos propios (lsof exit 0, lista vacía). Evidencia `processes.txt`. CI liberada explícitamente al coordinador después del teardown; no se volverá a operar DB desde esta tarea. Worktree queda limpio tras commit de esta entrega documental; factory/QA/integración son del coordinador.
