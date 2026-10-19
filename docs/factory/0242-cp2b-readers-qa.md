# 0242 CP2b.3 — QA independiente de catálogo y detalle

PASS acotado a GET catalog y GET orders/:id sobre candidato combinado `574d06af15969b9cdd84a09c9a040f398ca50bf8`. Entrega autor `6a5124cb79607f7131a60998f999977e75caf35b`; producto final `23cf4a2188d127304a0ab32475a562c304eaff0c`, tests finales `143af6c74d887cc0b3e7c600d43fab06e554c436`. No certifica GET orders/listado, comandos, UI ni activación de masa.

QA nuevo, sin subdelegación, en `/private/tmp/checkpass-pos-0242/pos-qa-0242`, rama pos-qa-0242. Leídos AGENTS, protocolos ADR0144, ficha completa y contrato0242 §1/3/5; revisados diff de entrega y deltas correctivos. Inicio `68a07f89`, actualización correctiva `49a18c8f`, fixture final `34973e8f`, cierre `574d06af`; estos últimos solo difieren en tests/documentación respecto al producto23cf. Único archivo editado por QA: este informe.

Se verificó el selector tras guard/scope: ausente/1 conserva V1,2 usa V2 y desconocido409 sin efectos. HTTP real cubre 401/403, mismatch de scope,404 entre tenants y private,no-store. V1 valida kind/unidades/versión y representabilidad antes de convertir. V2 conserva items, strings exactas, medida, orden position/id, producto borrado y legacy alto; tipo persistido autoritativo y fallback null solo por FK real, nunca label. Se mantienen alias, local, nota, operadores/fechas, total gross y sale.total collected. La proyección evita claves privadas y conserva settlement/snapshots congelados; readSale usa rational para el fallback histórico, sin Number/toFixed.

Catálogo limitado al DTO POS, sin costos/objectKey: unidades habilitadas bajo permiso POS, defaultkg solo sin configuración, revisión/string, precio0 incluido y null excluido, filtros vigentes y catálogo completo. Frecuencia usa COUNT DISTINCT orden cerrada/producto,30d/local, desempate fecha/id y solo IDs del catálogo autorizado. El caso duplicado reciente detectaría COUNT(*) defectuoso. V1 conserva ranking por cantidades y rechaza metadata incompatible.

Hallazgos cerrados con señal independiente:

- Histórico cerrado/anulado sin settlement/captura financiera podía normalizar centavos con moneda actual. Repro previo: dos unit0.49/COP daban líneas1/0; corregido conserva0.49/0.49 y total0.98. Open COP conserva normalización vigente.
- El cálculo abierto fabricaba financialSnapshot no persistido, haciendo que canCombinePosLines lo tratara como cerrado. Corregido calcula lineTotal manteniendo null. Fallback defensivo de settlement.lines usa sourceLineId real y respeta prioridad de captura de fila.
- CI23cf tuvo una fixture inválida: borrar financialSnapshot tras cerrar provocó23514, barrera de inmutabilidad funcionando. No se desactivó ni evitó la barrera. La revisión143 conserva la prueba HTTP de congelación y prueba el fallback defensivo en helper puro con settlement real del núcleo.

Evidencia fueraWT en `/private/tmp/checkpass-pos-0242/readers-evidence/`; Node24.20.0, Vitest4.0.18, dependencias/lockfile sin cambios. QA no leyó env ni ejecutó DB/wrapper; CI del autor exclusiva hasta teardown y stdout completo inspeccionado. La compatibilidad se verificó por los deltas: producto23cf no cambia en143/6a512/candidato final; db/domain no cambian en la entrega.

| Evidencia | Resultado observado y reutilización |
| --- | --- |
| 68a07f89-qa-repro.log | QA:2 FAIL/0 skips/EXIT1, reproduce los dos hallazgos originales; no es PASS |
| 49a18c8f-qa-repro.log | QA:3 PASS/0 skips/EXIT0: null abierto, COP histórico y abierto, sourceLineId/prioridad congelada; producto idéntico al final |
| 49a18c8f-qa-pure.log | QA: measured-read+lines,26 PASS/0 skips/EXIT0; delta posterior agrega un caso puro, sin cambiar producto |
| 143af6c7-static.log | Autor: merchant tipos/lint/formato pertinentes y puros finales27 PASS/0 skips/EXIT0; nuevo caso de fallback revisado |
| 143af6c7-neon.log | Autor: GETs finales7 PASS/0 skips/EXIT0,96.86s, teardown completo; incluye correcciones, congelación con/sin cliente/descuento y frecuencia |
| 23cf4a21-neon.log | 12 PASS/1 FAIL/0 skips/EXIT1 por fixture23514. Unit-expand6 PASS reutilizable sobre producto final; no se declara verde la corrida completa |
| 64815917-neon.log | 18 PASS/0 skips/EXIT0; scope4 y best-sellers2 reutilizables, sin cambios posteriores en esos comportamientos. GETs iniciales sustituidos por143 |
| 64815917-static.log / tool-guards.log | Tipos db/domain/merchant, lint/formato y24 puros PASS; app-boundary/UIguard tests17 PASS. Revisiones posteriores repiten checks afectados |
| 64815917-guards.log | UIguard sin aumentos. Guardias24 PASS/2 FAIL,EXIT1: expenses/immediate→stock/count y cinco archivos core con literales exactos; ninguno pertenece al diff de entrega |

Comandos QA: `pnpm exec vitest run src/modules/pos/server/measured-read.test.ts src/modules/pos/server/lines.test.ts` desde apps/merchant; repro externo con `pnpm exec vitest run --config /private/tmp/checkpass-pos-0242/readers-evidence/independent-repro.config.mjs`. Ambos precedidos por source de nvm y nvm use. Diff-check final pertinente PASS. Hubo un intento de lectura git desde /private/tmp fuera de repositorio, corregido al WT; no se atribuye evidencia a ese intento. Autor documenta además su intento inicial con project Vitest inexistente, corregido; sin ocultar fallos/retries.

Límites explícitos: masa/precisión operativas y circuito canónico siguen bloqueados hasta CP2c; masa solo helper puro, sin filas POS imposibles ni cambios a schema/barreras. No nueva DB por ceremonia ni oráculo de rol consumerCI (variable ausente advertida por wrapper, no usada por las suites focales). Guardias globales conservan el backlog indicado: este PASS no significa verify global verde. Sin fullverify/build/browser/M0/M1/3201/túnel/demos/push/PROD. Listado neto tiene entrega y QA propios. Sin procesos/checks QA pendientes; lsof acotado sin entradas y autor confirma teardown/0 procesos. Checkout limpio antes de crear este informe; entrega final queda solo con su commit documental.
