# 0235 — Cierre local de CI y retiro condicionado

Encargo owner: aplicar migraciones locales, un agente para CI rojo y otro para punto4. Contrato05863466 y ampliacionesb5f6f1af. Sin push, deploy, drenaje, consulta ni escritura PROD. QA independiente /root/qa_release_plan, sin DB/suites propias ni mutaciones; dos implementadores, sin subdelegación.

## Migraciones locales

Coordinador ejecutó db:local:migrate con Node24 y DATABASE_URL solo en memoria, guard de host local y huella16d3a8712ad6. EXIT0,96 entradas antes/después; hashes0093/0094/0095 coinciden con journal y archivos SQL. Ya estaban aplicadas; no reset/seed ni migraciones nuevas. Evidencia /private/tmp/checkpass-negocio-local-migration-confirmation.json.

## Fix CI aceptado e integrado

Entrega **99d18e2f6cfa958e2b743ad34d9c5e78497a038f**, base05863466; QA PASS local. Integrada por merge conservando commits en dev **794140d4561e0e94f0f17a94f227d5acbbfcff53**. Comparación contra la entrega en apps/packages/tools/.github dio EXIT0; solo se agregaba contexto documental del coordinador. [Handoff CI](0235-ci-fix.md).

Log remoto confirma dos problemas: la inyección Stock terminaba1598ms antes de su budget2000ms; el teardown fallaba40P01 mientras GitHub ejecutaba pnpm test directo y mezclaba DDL con otros writers. Se conserva el DELETE, sin tragarse errores ni reintentar para ocultarlos. Ahora CI usa tools/neon-test.sh, archivo efímero0600/trap y la misma selección/exclusión para migraciones e inyección global de business-failures. Metadata real de Vitest confirmó que el glob definitivo las excluye de la fase paralela y selecciona12 archivos seriales.

Stock mantiene2000/2500ms y todas las expectativas de cancelación; añade INSERT real seguido de2,7s de espera SQL para que el disparador exceda el budget sin depender de RTT. Confirma rollback, falta de ACK y recuperación de una sola delivery. El montaje anterior que reabría dos skipped quedó corregido filtrando subscriber, sin modificar el estado terminal de otras obligaciones.

Evidencia focal: timeout final1PASS/9 fuera de selección, EXIT0; vecino de rollback y alta/permisos con teardown PASS en la tanda anterior. Esa tanda fue EXIT1 por expectativa aplicada3, conservada en handoff y corregida sin relajar el resultado esperado. Guard final21/21, plan verify40/40 de fuente compatible, acceso/frontera13/13, tipos/lint/formato/bash-n/diff PASS. Nada de verify global ni suites enteras.

La verificación combinada anterior de0235 omitió la guardia de literales y dejó un test core que nombraba POS. Se corrigió trasladando el archivo completo a modules/pos/business-page-access.test.ts, con sus cuatro casos idénticos; guardia intacta. Fue un rojo local adicional, distinto de la causa del run remoto5b834ca0.

GitHub continúa mostrando el run histórico38971334745 rojo: no se publicó ni se ejecutó un rerun. Este cierre valida el arreglo local y su cableado, no declara un run remoto verde. Antes del futuro release hay que actualizar el candidato puente basado en e5eaa741 con estos fixes y ejecutar sus gates; el antiguo SHA puente no contiene esta corrección.

## Retiro aceptado como artefacto separado

Entrega **1dfb776b**, runtime d4eda771; QA de entrega PASS. [Handoff y precondiciones](0235-retirement.md). Retira elección de esquema, onEnable y provider de medios POS, ramas Brand precorte, aplicador y dispatch históricos. Conserva tablas, mapping de origen, lectura histórica, sale_settlement, IDs, revisión y avisos. Una obligación sin handler se rechaza antes del ACK; no se borra ni maquilla.

Dos selecciones DB protegidas y seriales sobre el runtime congelado: retiro5/5 PASS28,46s y Resources9/9 PASS50,78s, ambos EXIT0, sin skips y teardown completo. SQL solo lectura detecta esquema requerido, pending/processing y cualquier claim sin resolver; no certifica READY ni ausencia de writers antiguos. La fixture aplicada conserva resultado3%=0,06 y sus IDs sin aplicador; pending/claim bloquea certificación y no cambia su estado.

El único rojo unitario propio fue62/63 por el test core de literales ya corregido en CI. No se presenta esa tanda como verde. La evidencia de puente/DDL/ACK sigue versionada en e5eaa741; los tests del binario postdrain prueban su comportamiento distinto, con cambio semántico aprobado y sin skips para esconder la retirada.

## Combinación verificada y límites

Candidato separado **27a3befb6436ffdd21d7ebce5a766a96f8dea1ed**, CI integrado794140d4 más retiro1dfb776b, rama negocio-followup-qa. No se fusiona hacia dev/main. QA PASS local condicionado después de leer código, handoffs y logs:

- Merchant typecheck EXIT0.
-67/67 unitarios, cinco archivos,2,81s: Marca37, fronteras10+9+7 y acceso4. El rojo de literales queda resuelto en combinación.
- Un build Merchant Turbopack EXIT0: compilación9,7s, tipos10,2s,36 páginas estáticas. Next-env generado restaurado exactamente al contenido versionado; no quedó cambio de producto ni servidor propio.
- DB/domain tipos del autor EXIT0, evidencia compatible; no se repitieron las14 pruebas DB ni las13 financieras originales sin cambio que lo justificara.

El retiro queda preparado y **retenido en ramas/worktrees propios**, sin integrar en dev/main ni publicar hasta certificar corte, esquema0093–0095 completo, ausencia de writers viejos y drenaje de obligaciones/claims. Primero se usa el puente compatible y actualizado; después del movimiento no se vuelve al binario0092 ni se mueven tablas hacia atrás. Cada operación PROD conserva su autorización propia.

La reserva db:modules-ci se transfirió secuencialmente tras teardown de CI y se liberó tras teardown de retiro a2026-10-17 01:51:03UTC. No hay suites DB, servidores ni túneles propios pendientes. Logs reales sanitizados en /private/tmp/checkpass-ci-baseline-0235/, /private/tmp/checkpass-negocio-followups/retirement-logs/ y /private/tmp/checkpass-negocio-followups/combined-{typecheck,unit,build}.log. Sin values de env ni transcripciones presentadas como logs originales.
