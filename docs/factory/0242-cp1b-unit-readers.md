# 0242 — CP1b.1 lectores unit compatibles antes del expand

Estado: preparada, pendiente reserva concreta. Nuevo implementador/contexto vacío; una entrega sobre schema actual, sin DDL. Entrada CP1a financiale9d409ac/QA9a4a52a6 y scope servidor1af3d7f3/QA0b52df93 aceptados. Base/WT exactos por factory al despachar.

## Objetivo y contrato

Preparar los bordes de lectura POS/core para el futuro quantity numeric:string y padding9, conservando DTOv1 unit y eventos V1–V3. Reutilizar helpers confiables CP0; no ampliar validadores HTTPv2 ni reinterpretar piezas como gramos. Mantener cantidad histórica hastaINT32 y tarifa snapshot/catalogo legacy12,2, con total monetario persistible. Una capturaHTTPv1 sigue su contrato unit anterior hasta cutover; fracción/string/exponente fuera de ese contrato no se acepta porque un adaptador DB lo admita.

Lecturas pertinentes: AGENTS/protocolos, anexo0242 §1/§4 compatibilidad, esta ficha, CP0data propuestaexpand, helpers measures/legacy y financial aceptados, archivos enumerados abajo. No históricos ni implementación de mass/eventosV4/UI. No subdelegar.

## Paths autorizables

- `packages/domain/src/measures/legacy.ts` y `packages/domain/src/measures.ts`, solo adaptadores confiables unit adicionales/reexport si necesarios
- `apps/merchant/src/modules/pos/server/read.ts`
- `apps/merchant/src/modules/pos/server/list.ts`
- `apps/merchant/src/modules/pos/server/orders.ts`, solo adaptación de filas en `linesForClose`; no cambiar writers integer todavía
- `apps/merchant/src/modules/pos/server/lines.ts`
- `apps/merchant/src/server/counter/resolve-catalog.ts`, solo cantidades históricas para personalPicks y formato legacy de precio si requiere el mismo adaptador
- `apps/merchant/src/server/counter/grant-input.ts`, snapshots/precios DB y suma/multiplicación exactas del carrito unit; preservar parseMoney HTTP legacy público
- `apps/merchant/src/modules/pos/server/lines.test.ts`
- `apps/merchant/src/modules/pos/unit-expand-compat.test.ts` nuevo
- `apps/merchant/src/modules/pos/server/unit-expand-compat.neon.integration.test.ts` nuevo, fixtures propias con teardown completo
- `docs/factory/0242-cp1b-unit-readers-handoff.md`

Pedir antes cualquier path adicional. Reservas heredadas no amplían encargo. No schema/migraciones/journal/DDL, writes de quantity string, catálogoV2/precisión nueva, Recetas/Stock/analytics, productorV4, auth/scope/cliente/UI/kit/tooling/deps/estados/índices.

## Criterios decisivos

Los adaptadores aceptan DBnumber anterior y DBstring con ceros de expansión (`"2.000000000"`), validan entero positivoINT32 y convierten a number solo después de comprobar seguridad para DTO unit. Nada de BigInt directo sobre string decimal ni coerción general Number. Lecturas/listados/cierre/personalPicks reciben unidades enteras normalizadas; eventos conservan forma antigua. No relajar dominios para tolerar masa prematuramente.

Tarifa DB se valida exactamente antes de proyectar al formato legacy de centavos. Padding cero se elimina sin redondear. Una fracción nueva incompatible no se trunca ni se convierte por Number/toFixed: rechazo explícito conforme contrato de actualización de cliente donde corresponda. Nunca usar el parser de captura nuevo para rechazar una tarifa legacy autoritativa válida. No modificar precios históricos/JSON financieros ni volver a elegir descuentos.

Eliminar Number/toFixed de la aritmética de `buildDetailed` y del formateo de snapshots leído por POS que toca esta entrega. Calcular línea/suma con racional/BigInt compartido; validar overflow de línea/agregado antes de DB y de devolver un formato persistible. Mantener0 distinto de null y los errores de Counter/Pos serializables actuales; MeasureError no debe escapar como500 por un input inválido. No refactorizar parseMoney público ni otros consumidores ajenos.

Pruebas puras: formatos antiguos/padding9 equivalentes; INT32 máximo a precio0; tarifa9999999999.99×1 exacta; fracción/no entero/exponente/overflow rechazados; ceros/null; suma y multiplicación exactas; ninguna ampliación de parserHTTP. Con schema actual, probar representación futura mediante valores SQL numeric(24,9) pasados por los mismos adaptadores, sin ALTER temporal. El cambio Drizzle real y prueba antes/después del DDL se hacen en el corte posterior.

CI protegida: fixture propia, lectura/listado/edición de nota conserva snapshots, nueva adición desde catálogo legacy extremo y cierre con/sin pase/reintento sin duplicación sobre importes legales. No exigir cerrar simultáneamente tarifa máxima×cantidad máxima: ese total debe rechazar overflow. Reutilizar suites actuales compatibles para cupones/cierre si aportan señal; no copiar todos los tests ni alterar sus oráculos para esconder regresión. Fixtures imposibles no acreditan negativos.

## Checks y continuación

Node24; tests focales financial/measure/lines nuevos, merchant/domain types, lint/formato/diff. Dinero requiere señal real CI exclusivamente por tools/neon-test.sh; reservar CI incluido teardown. No DB productiva ni envPROD. Sin servidores/puerto. Registrar comandos/SHA/runtime/lock/schema/fixture/resultados/fallos/skips/límites; autor commit limpio, QA nuevo en candidato congelado, sin push/PROD.

Después, otros agentes nuevos harán (2) catálogo numeric24,9 con guardias de representabilidad legacy y migración serial; (3) quantity/tarifas snapshot POS/core numeric:string junto con writers y sus pruebas de compatibilidad. No asumir número de migración: journal actual0101 debe comprobarse al reservar el writer. Mass/V4 operativos siguen apagados hasta CP2c compatible. Este entregable no autoriza esos siguientes bloques.
