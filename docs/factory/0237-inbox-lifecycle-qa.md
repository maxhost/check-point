# 0237 — QA independiente del ciclo de avisos

**PASS funcional de las entregas A y B y de la combinación indicada, con dictámenes separados.** La revisión conserva los límites de evidencia y el FAIL de rendimiento; no certifica publicación o PROD.

## Dictámenes separados

| Objeto | Fuente exacta | Dictamen |
|---|---|---|
| A, dominio/datos/servicios | Entrega `6582570cc8912c92ee070c4680eda57cacac5ed3`, producto `d07265cd571dae727da103e359622686903979c8` | **PASS de entrega A** en su alcance asignado, cotejando handoff final y evidencia compatible descrita abajo. La entrega añade solo documentación sobre el producto revisado. |
| B, HTTP/UI/actions | Entrega `1038c2efd4c99bf9dd8b5d8a5453084bcf76c710`, checks propios en `f5b92a38` | **PASS de entrega B** en su alcance asignado. Los mocks HTTP/browser no certifican por sí solos DB o Next real. |
| Combinación funcional | `c90a8f30da97db602773b20b20438a80fad438fb` | **PASS funcional de combinación** por revisión de interacción y evidencia compatible ligada a fuentes, sin inventar una corrida completa nueva. Producto `apps/packages/tests` idéntico a A d072, que incluye B; respecto de `5c4746b2` solo se incorpora el handoff A. |
| Rendimiento | Experimento `b3ca9c6f`, entrega `058d7c48` rechazada | **FAIL conservado: 1817,621042 ms TOTAL >1000 ms.** No medido otra vez ni aprobado por este ciclo. |

Mandantes: [spec0237 §3](../specs/0237-analiticas-inbox-y-resumenes-diarios.md), [contrato](0237-inbox-lifecycle-contract.md) y [QA documental](0237-inbox-lifecycle-plan-qa.md) de fuente `74125ab9`. El [adversarial](0237-inbox-lifecycle-adversarial.md) es antecedente: su antigua protección indefinida de pendientes y snoozes informativos fue sustituida expresamente por el owner. Hoy todo contenido tiene vigencia finita, 11 está parqueada y las informativas no se posponen.

QA trabajó en el WT asignado desde `65b5152e`, leyendo blobs congelados, aserciones, diffs y logs. No implementó producto ni ejecutó DB, API, benchmark, build, suites de producto, servidor o clima. No movió el checkout para certificar una fuente distinta. Los scripts propios solo comprobaron metadatos, hashes, enlaces y paths; el único archivo versionado de esta entrega es este informe. No subdelegación ni edición de estados/índices comunes.

## Matriz funcional cerrada

| Área | Resultado revisado y oráculo pertinente |
|---|---|
| 1, 2 y 13 | Resumen renovable por período con misma ID, sin acumular días; versión atrasada no cierra el resumen nuevo. Demanda/día flojo solo para día objetivo; aprendizaje respeta progreso y frecuencia. Navegar al histórico no marca. |
| 3, 4, 6 y 7 | Contexto por mes/configuración/producto y datos pertinentes. Baseline depende del cálculo relevante, no de versión global/texto/peso; cambiar ventana con datos antiguos no reabre, dato posterior pertinente sí puede hacerlo. Material de 7 usa su producto, conservando presentación agregada. Dinero conocido/null y finanzas exactas preservados. |
| 5 y 9 | Hecho estructurado separado del texto, orden/revisión y origen preservados. 9 distingue conteos/eventos por insumo; no colapsa hechos distintos. Cambio de captura exige base racional/snapshot de resúmenes al origen; no usa ventas futuras, tablas de módulos ni GET pesado. Simulación informa `unavailableFacts` si faltan datos. |
| 8 | Cursor causal usa gauge pareado del mismo evento/local/insumo, no hora de delivery ni fecha económica de venta. Cantidad del propio consumo prueba agravación; ajuste posterior no la sustituye. Recuperación intradiaria permanece aunque llegue después del gauge de escasez más nuevo. Replay viejo no reabre; venta antigua cuyo movimiento se aplica después puede ser stock nuevo. Reglas apagadas conservan evidencia. Prioridad crítica respeta cierre/snooze y cupo. |
| 10 y 11 | Anomalía por local y ventanas originales. 11 no genera/exhibe contenido ni fallback; métricas, cohortes e histórico de clientes intactos. Control legacy innecesario de 11 se depura tras TTL sin tocar clientes. |
| 12 | Emisión distinta de mantenimiento; tardíos actualizan misma ID y no reabren ciclo atendido. Nuevo ciclo exige cursor real posterior aplicado. Focal real prueba A visto → snapshot B → misma ID/nueva edad → cupón único → replay ignorado → B visto y canje tardío sin reapertura. Sin atribución causal de ventas a la promo. |
| Identidad/CAS/retry | Exclusión común de negocio antes de fuentes/asuntos; cruza medianoche. Versión incorpora contexto, política y revisión de decisión/remindAt. Cerrar A durante publicación B no cierra B. Última operación/digest reconoce retry sin reaplicar; conflicto no pisa decisión posterior. Sin historial creciente de operaciones. |
| Snooze/exposición | Misma ID/fecha, instante UTC elegido en zona del comercio y futuro ≤ expiresAt. Al vencer renueva novedad una vez, sin renovar edad, urgencia, decaimiento del hecho ni cupo. `nextReminderAt` es estrictamente futuro/autorizado. POST exitoso cuenta primera exposición de la sexta candidata; retry reconocido no la vuelve a contar. |
| Retención/cleanup | Exactamente en expiresAt se conserva; después se excluye sin esperar job. Inicio fijo y origen conocido no rejuvenecidos. Cleanup usa caducidad efectiva, índices, presupuesto/lotes, locks/CAS, avance justo y retorno a ocupados; rollback no avanza. Preserva métricas/eventos/revisiones. No garantiza borrado físico antes de 97 días. |
| Política/guía | Config único, registro por ID extensible, validación/versionado/inmutabilidad y mismo snapshot entre SQL, dominio, ciclo, acciones y DTO. Dos reglas del mismo handler se procesan, incluso primera apagada. Ready incompatible reevalúa; disabled no resucita atendidos. Guía y receta real permiten inspeccionar un balance válido sin relajar regresión de defaults. |
| HTTP/UI | Guard de sesión/membresía/analytics, tenant/actor exclusivos del guard; legacy 409 sin efectos, ISO con zona y errores 401/403/404/409/422. Capacidad declarada por servidor, enlaces sin POST de cierre, kit/tuteo, 390/1280. Try-read/try-eval ocupado no esperan al writer y devuelven preparación segura sin writes/exposiciones. |

No queda abierto un hallazgo funcional de los revisados en la fuente final. Comparadores, simulación y servicios se cotejaron como interacción; los tests no se trataron como prueba suficiente por su nombre o cantidad.

## Evidencia reutilizada y límites

La evidencia final es **composición explícita de corridas compatibles**, con lectura de cambios y aserciones. No se afirma que todos los casos se ejecutaron juntos sobre d072.

| Fuente / log | Resultado real | Qué demuestra |
|---|---|---|
| `7da87404`, `/private/tmp/analytics-lifecycle-a3-neon-7da87404.log` | 32 PASS /1 FAIL /33, sin skips; 180,87 s | Siete sync causales, nueve servicios, cinco clientes/promos, tres stock y ocho evaluación. Incluye guarda/tenant reales, snapshots completos/orden, stock fuera de orden, política y poda. Único fallo COP por selector de día antiguo, descrito abajo. |
| `e6773759`, `/private/tmp/analytics-lifecycle-a3-focal-e6773759.log` | 3 PASS /15 filtrados; 34,11 s | COP por ID/asunto/período correcto y 40 COP/unidad0; recuperación antigua calificable; nuevo ciclo12 por ingesta real. No son 18 PASS ni rerun de33. |
| `d07265cd`, `/private/tmp/analytics-lifecycle-a3-threshold-d07265cd.log` | 1 PASS /9 no seleccionados; 6,71 s | Evento legacy identificado/aplicado revela origen antiguo aun con builder0 por umbral actual; conserva ID/revisión, acorta inicio/vencimiento, retira texto/remind y conserva métrica. |
| `fd5e6ae1`, `/private/tmp/analytics-lifecycle-services-fd5e6ae1.log` | 9/9 PASS, sin excluidos | Evidencia previa de servicios, incluido try-lock real y fairness. La segunda corrida A3 repite esos nueve sobre el motor posterior; no se necesita otra repetición. |
| `e6773759` | Autor 72 unit y Merchant tipos/lint PASS; d072 tipos/lint PASS | Regresión pura de dominio/política/simulación/decodificación y correcciones posteriores acotadas. No atribuir tests no ejecutados de d072 como corrida unitaria nueva. |
| B `f5b92a38` | 28/28 actions/HTTP/fallback, sin skips/retries | Adaptadores con auth/servicios simulados, permisos/destinos y catálogo de etiquetas. Root repitió 28/28 en `84d771af` (b60+B), raw `/private/tmp/analytics-lifecycle-combination-http-84d771af.log`, 1,70 s. |
| B cfe/632/923/acc | 19 browser iniciales +4 focales +1 con barrera reforzada +1 preparación | Evidencia compatible, **no corrida única nueva**. Componente real con HTTP simulado, sin Next ni DB. |

Entrega B acumulativa revisada desde65: preparación `636ddbe2`, UI `cfe0c788`, fix `6324dec6`, oráculo `923da085`, HTTP `acc58d01`, fallback `a871a89e` y etiquetas `3c35094f`; no solo diff documental1038. Las pruebas históricas conservan filtros, histórico y atribución honesta; cambian accept/dismiss por decisiones aprobadas y parqueo11. Merchant typecheck de B había fallado en tres consumidores legacy de A: se corrigieron sin relajar firma v2 y tipos A3 posteriores pasan.

Los 28 de B no tenían raw/tee guardado: `/private/tmp/analytics-lifecycle-b-28-captured-transcript.log` es transcripción declarada de herramientas (sesión28162/chunk a40c69, EXIT0), no nueva ejecución. Su log lint/guard transcrito distingue checks exitosos de `factory --help` no soportado posterior que hizo terminar la cadena EXIT1. No se atribuye EXIT0 a toda la cadena.

Browser: servidor/runners efímeros cerrados por afterAll según handoff, sin Next ni puerto fijo43142. El número efímero no se registró y no se inventa. Caso de GET viejo espera respuesta/finished/dos frames antes del doble foco; fix por token dueño evita liberar el loading de otra lectura. Retry de transporte mantiene mismo cuerpo/opId; due durante lectura/mutación encola solo una actualización. Fechas se probaron con navegador Honolulu distinto de negocio Guayaquil y timer mayor a2³¹−1ms.

## Migración y transición legada

0101 SQL SHA256 **`dfb581e66cddd45ddcad7b400de57db86f372cf4de53c57bc9d7aaf9625f191b`**, revisado en38da antes de primera aplicación; permanece inmutable. QA verificó115→115 tablas, ninguna nueva/eliminada, cambios solo candidate/state/run; snapshot enlaza0100. SQL/snapshots0097–0100 intactos. Control ID sin FK de borrado al contenido, unicidad por asunto,9 no colapsado por insumo. Duración2160 horas absoluta, calendario validado y origenDay sin timestamp correctamente usado antes de día de preparación.

Plan autorizado: preseed sintético propio con journal temporal sin entrada pendiente0101, preservando0097–0100 y restaurando bytes con finally; después wrapper oficial aplica0101. Fuente primera aplicación `f33a99f7`; migrador EXIT0. Journal completo hash `d55e693032f1dc4a0ead296946f2ca81f4ece58af5433dc576f573bbb7935225`, copia externa y restauración descritas por A; prepare1 PASS/verify1 excluido. Ese preseed quedó en transcript y resumen declarado, no raw original. No reset/ledger repair/replay global.

Primer post `/tmp/analytics-lifecycle-0101-post.log`: **7 PASS/2 FAIL/1 fase excluida**. Servicios corrieron antes del verify: cleanup global retiró legítimamente el origen enero vencido en abril, dando deleted2 frente a1 y contenidos5 frente a6. No se observó una instantánea de seis contenidos antes de cleanup. Fairness falló antes de asserts por ID; no se llamó PASS a ese caso.

Recovery estado actual `4f064020`, `/tmp/analytics-lifecycle-0101-recovery-verify.log`: **1 PASS/1 fase excluida**, cinco contenidos/ocho controles/métrica1234-count1. Por IDs exactos: origen enero conserva inicio/expiry abril, expired/remindnull y sin contenido; unknown5/invalid-origin5/margen6/conteo9 OPEN; accepted8 no se inventa resuelto y resumen ignorado mantiene su período. Sin copy en control, teardown propio. Certifica estado posterior registrado, no transición limpia repetida ni seis contenidos observados. Fairness posterior aislado pasó con disponible/ocupado por ID; no depende de count global igual a1.

Recuperación final e677/d072: fecha real se toma de hechos traducidos identificados y elegibles por delivery/H2 **antes de comprobar umbral de tarjeta**. Acorta min(ancla,origen) y min(expiry,inicio+TTL), nunca amplía; retira texto/reminder vencidos en misma tx. Caso d072 exige builder0, ageDecay1, mismo ID/revisión3, Jun1→Aug30 y stock_count_gap exacto−50000/−5/count1. Se conserva evidencia de origen sin leer tablas de módulos, escanear rawhistory o reescribir0101.

Poda12: tras TTL de contenido solo queda último ciclo/cursor/revisión/decisión temporal necesaria, sin totales/texto/actor/log de decisiones. Poda definitiva exige dos fronteras: finishDay+máximo emissionDelay del registro pasado localmente y finishUTC demostrado+máximoTTL admitido×24h pasado, además sourceproof/CAS/sin contenido/reminder. Máximos estructurales actuales3650d centralizados; ampliarlos exige revisar prueba de poda histórica. No son avisos ni snoozes de diez años. Sin prueba UTC se conserva mínimo necesario. Poda3 de mes anterior y11 retirado conserva negocio/histórico; 9 requiere fuente/revisión que impida replay.

## Política, equivalencia y receta comprobada

Se corrigieron reglas duplicadas ignoradas por find, validación cruzada que omitía ceros, ventana de comparación truncada, período vacío, magnitud ajena7, asociación del consumo8, wiring de policy en acciones y baseline que absorbía hechos por cambios de peso. Simulación/runtime comparten planEpisode y restauración factual; resumen mantiene fijo10, facts5/9 participan y reapertura no conserva expiry viejo. Config sola no se interpreta como consumo/venta; read ocupado no expone viejo ni bloquea el fallback.

SQLliteral de5fac se conserva como oráculo portable. Se proyectan exclusivamente metadatos nuevos y extensión45d explícita; TODOS campos/orden compartidos se comparan con toEqual, incluidas cards/textos/meta/histórico y ties. Extras tienen SQL agregado independiente y bag exacto de día/métrica/local/dim/importe/moneda/unidad/qty/count, con multiplicidad. Agregado base derivado de política más extensión disjunta preserva orden lossless sin normalizar arbitrariamente. Esto no afirma identidad byte-total de inputs A3 con una versión que carecía de metadata y truncaba45d a28.

Guía española inventaría valores/unidades/rangos/efectos/consumidores, todas las fichas, textos/acciones, recarga, simulación y reversión. QA cotejó recetas/comandos reales. `/private/tmp/analytics-lifecycle-policy-recipe.log`: solo config cambió TTL90→60 y stockplata1→1,2; inspector actual1 PASS/17 filtrados mostró plata1,2/baseWeight0,72/expiry60d, sin assertions de defaults. Tras revertir, regresión intacta71 PASS. SHA256 backup y config congelado comprobados por QA: **`b924d0364421be5cdf498f606a31a2ca3360ceec7f1dc69f9619f63e21e8fb5f`**, restauración exact=True. No se editaron varios archivos para experimentar ni se publicaron cambios por editar config.

## Fallos conservados y límites del cierre

- Primera Neon A3 b60: **21 PASS/12 FAIL/0 SKIP**,33 seleccionadas,126,36s; raw `/private/tmp/analytics-lifecycle-a3-neon-b60db5c2.log`. AliasSQL42601, fixture7 por debajo del mínimo y orden compartido alterado. Se corrigieron SQL/fixture con más evidencia y oráculo íntegro; no se bajó mínimo0,05 ni se declararon fallos derivados como casos causales independientes.
- Segunda Neon7da: **32 PASS/1 FAIL/0 SKIP**. COP buscaba día de preparación en vez de período vendido; focal e677 conserva40n/COP0, única summary por asunto y day/period marzo9, más histórico/day40. No se eliminó control de fecha ni dinero.
- A/B conservan fallos de setup/imports/types/lint/browser en handoffs: export policy/index, readonly fixture, llamados legacy, arranque Chromium MachPort, selectores/clock del harness y runner con cwd incorrecto/cero tests. Corridas exitosas posteriores se delimitan; ningún skip/retry cuenta como PASS.

No se ejecutó CI compartida, verify global, mutaciones, benchmark, clima/API real, cron remoto, PROD, push o deploy. Rendimiento conserva TOTAL≤1000ms incumplido y diagnóstico WIP preservado separado;0100 funcional integrado no equivale a aceptar rendimiento. Este PASS funcional no autoriza main ni publicación: el contrato exige decisión explícita de cierre del requisito de rendimiento antes de main.

Handoffs cotejados: `6582570c:docs/factory/0237-inbox-lifecycle-data.md` y `1038c2ef:docs/factory/0237-inbox-lifecycle-ui.md`. Se citan por SHA porque el checkout base de QA no incorpora esos archivos. A y B declararon teardown completo y liberación de recursos sin queries adicionales; QA no operó sus DB. El harness QA se libera antes de factory deliver de este informe. WT retenido, sin cleanup ni main por QA.
