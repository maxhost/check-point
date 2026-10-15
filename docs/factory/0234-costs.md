# Entrega 0234 — costo y margen en Recetas

- Tarea `recipes-margin`; spec0234 cerrada y autorizada por el owner.
- Base combinada: `f3a5443bc670f5112136daf45c72ba0ed2ad9650` (wizard L1 integrado).
- Backend primero: `1949f358`; producto completo: `8edee7520016fca773863e3ec9d1e267de750310`.
- Rama/worktree: `factory-recipes-margin`, `/private/tmp/checkpass-recipes-margin/factory-recipes-margin`.
- Sin push, integración, cambios de estado/índices, migraciones propias o escrituras de producto en Stock/core. Este documento no declara QA independiente ni spec implementada.

## Resultado y contrato

`GET /api/modules/recipes/costs?locationId=<uuid>` devuelve una lista completa del local con composición vigente, conteos, costo de receta, precio, ganancia, margen y nombres de insumos sin costo. Preserva el GET raíz en404 y las escrituras R1. Permiso `recipes`, sin exigir Stock/Catálogo adicionales. Local ajeno/inválido404; falta local422; permiso/módulo conservan sus rechazos. Promedio nulo/ausente oculta costo total, ganancia y margen; cero es conocido. Precio nulo muestra costo sin ganancia/margen; precio cero tiene ganancia negativa y porcentaje indefinido.

Transacción `repeatable read read only`; consultas por lote del comercio/local, resoluciones publicadas y revisiones capturadas. Reutiliza `expandComposition` para coincidir con preview/consumo, con una unidad vendida. Sin inicializar pares, usar último costo, drenar consumos ni leer datos fiscales/`unit_cost`. Cantidad3 × promedio6 se suma exacto a escala9: costo se redondea una vez a moneda; ganancia resta ese costo visible; porcentaje usa costo exacto y1decimal. Las referencias publicadas incompatibles fallan en vez de ocultar productos; precio incompatible con unidad mínima devuelve422 sin modificarlo.

La lista conserva nombres, conteos, Combo, Editar y wizard. Agrega selector/local en cabecera y cuatro valores por fila, faltantes nombrados y el alcance «no incluye merma, packaging ni comisiones». Una lectura monetaria reemplaza los detalles por producto anteriores. Cambiar local invalida datos e ignora respuestas anteriores; guardar refresca el local elegido. El formato usa BigInt y conserva las fracciones enviadas por el backend.

Archivos de producto: `server/costs.ts`, `server/contracts.ts`, `server/routes.ts`, `server/costs.neon.integration.test.ts`, `ui/recipes-console.tsx`, `ui/recipe-requests.ts`, `ui/recipe-types.ts`. No se modificaron modal, líneas ni pasos del wizard, kit, core, Stock, tooling, dependencias o esquema.

## Evidencia focal

Node24.20.0, lockfile/dependencias de la base. Configuración CI elegida por coordinador en `/private/tmp/checkpass-recipes-margin/0234-ci.env`; solo wrapper Neon, recurso `db:modules-ci` reservado durante prueba y teardown. El wrapper aplicó sus migraciones pendientes habituales a CI; no se generó SQL ni se operó PROD.

| Comando | Resultado y límite |
| --- | --- |
| `NEON_TEST_ENV_FILE=/private/tmp/checkpass-recipes-margin/0234-ci.env tools/neon-test.sh src/modules/recipes/server/costs.neon.integration.test.ts` | PASS1/1, sin skips,53.90s; log `/private/tmp/checkpass-recipes-margin/0234-neon-final.log`. |
| `pnpm --filter @mi-pasaporte/merchant typecheck` | PASS exit0; log `/private/tmp/checkpass-recipes-margin/0234-typecheck.log`. |
| `pnpm exec eslint apps/merchant` | PASS exit0, sin warnings; log `/private/tmp/checkpass-recipes-margin/0234-lint.log`. |
| `git diff --check` | Sin errores de whitespace. |

Neon cubre producto normal, combo con insumo compartido y cantidades0.400/0.100, costos faltantes nulo/par ausente, sin precio, dos locales distintos, costo/precio cero, pérdida, receta vacía, cantidad redondeada a cero, USD/COP y permiso real solo Recetas. Compara snapshots de7tablas antes/después para detectar escrituras/inicialización. Ejemplo decisivo: costo exacto0.104900, precio0.21 → costo0.10, ganancia0.11, margen50.0% (no52.4%). Verifica la mitad0.105000, la identidad costo+ganancia=precio, aislamiento y negativos de local/permiso/módulo.

Primer intento falló en fixture: integrante sin permisos violaba `business_membership_staff_has_permission_check`, antes de assertions. Se corrigió a integrante solo Stock, sin Recetas; promedios conocidos llevan marcador real. Segundo intento PASS1/1,54.98s, antes de editar UI (`0234-neon-fixed-fixture.log`). Se repitió únicamente el mismo test al cambiar dos literales del combo para cubrir cantidades distintas: PASS final arriba. No se atribuye PASS al primer intento ni a un retry sin corrección.

Identidad: backend del PASS previo y del final es el de `1949f358`; UI final es la de `8edee752`. Tipos/lint se ejecutaron con esos cambios funcionales de UI y antes del ajuste de dos literales del fixture y wrapping Prettier; no cambió ningún tipo ni comportamiento de producto después. El PASS Neon final incluye el fixture exacto de `8edee752`. Sin e2e, browser, build, unitarios adicionales ni suites globales, según el encargo.

## Browser y siguiente paso

1. En la app local/de desarrollo, abrir `/backoffice/recipes`: revisar producto simple y Combo, cuatro valores por fila, aviso de alcance y Editar hacia paso4 del wizard.
2. Cambiar entre dos locales con promedios distintos, también durante carga; comprobar costo/margen actuales y mismo precio. Con un insumo sin costo, revisar nombres del aviso y ausencia de margen. Con precio ausente, revisar «Sin precio».
3. Guardar una receta desde el wizard y comprobar refresco del local elegido; validar el caso decisivo de redondeo anterior con datos de desarrollo apropiados. No se cambió el wizard para esta pieza.

QA del browser a cargo del owner; QA independiente y combinación pendientes del coordinador sobre candidato congelado. Sin servidores propios ni procesos de test pendientes. La reserva de DB queda para que el coordinador la libere. El sandbox bloqueó inicialmente `git index.lock`; los commits locales autorizados se completaron con escalación, sin bypass ni push.
