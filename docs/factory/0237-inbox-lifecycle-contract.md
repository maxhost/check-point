# 0237 — Contrato de implementación del ciclo de avisos

Encargo actual: actualizar la spec y preparar el plan; **no iniciar implementación, DB ni cron remoto en esta tarea documental**. Base de producto AN-1/AN-2/AN-3 en main local `5afa5294`; dev documental previo `f10a7092`. El owner aprobó el ciclo propuesto y ahora el corte recomendado de 90 días móviles/semanal. Mandan spec0237 §3 y ADR0152/0153; [adversarial](0237-inbox-lifecycle-adversarial.md) `3819d497` y propuesta histórica `5d6e265b`.

## Reserva documental

Coordinador writer único de docs/specs/0237-analiticas-inbox-y-resumenes-diarios.md, docs/adr/0152-analiticas-inbox-accionable.md (solo addendum de estas decisiones), este contrato y docs/estado/gpt.md. No INDEX/TASKS/estado Claude. Se conservan informes históricos; no reescribir el FAIL de rendimiento.

## Cierre de producto antes de lanzar código

Tres aclaraciones se consultaron al owner para que el implementador no elija caducidades ni reavisos: tarjetas informativas/del día al vencer su período (con pospuestos protegidos), y nuevo umbral temporal de la11 tras cierre. Se completará el catálogo con la respuesta; **no anunciar listo para implementar con celdas pendientes**. El resto de reglas aprobadas se documenta y revisa mientras se espera. Ante nueva contradicción material: preguntar y parar.

## Alcance de implementación futura

Una tarjeta activa/pospuesta por asunto, IDs estables, contexto y frescura por tipo, cierre que elimina texto conservando control compacto; fuentes5/9 separadas de copias diarias; reactivación de8 con consumo posterior pertinente/reposición; navegación independiente; Solucionado/Ignorar/Recordarme luego y Visto informativo; prioridad de stock≤24h; recordatorios; limpieza interna semanal90d solo de residuos cerrados/vencidos, nunca pendientes/pospuestos/control necesario; transición conservadora del legado. Se reutilizan las tablas existentes, sin nueva tabla de log, particionado o archivo de copias. No cambia dinero, mínimos de historia, fórmulas de métricas, eventos de origen, permisos, core sin switch ni corte de Stock.

Rendimiento ≤1s sigue pendiente y **no se certifica** por este cambio de ciclo. No resolver CI compartida, clima/Vercel, ciudades, «cuánto ahorraste» ni demás diferidos por extensión de scope. Sin push, deploy, lectura/migración PROD, verify global o mutaciones.

## Base y migración

La 0100 de rendimiento existe solo en rama analytics-performance (fuente b3ca9c6f, entrega058d7c48 rechazada por rendimiento) y ya está aplicada en las DB efímeras. Su hash d7be0529f9325bb3dbaa6d3517e10ad3ac9b59a677034f849c258289e5fcfe5a y las0097–99 no se reescriben. No tratar0100 como número libre, no resetear ledger ni descartar la rama/harness pendiente.

Antes del kickoff el coordinador congela base común compatible: integra en dev la base funcional de rendimiento por merge que conserve los commits, reutilizando QA de equivalencia y dejando explícito el FAIL1817,621042ms; esto no acepta rendimiento ni habilita main. La tarea documental actual no realiza ese merge de producto. Después asigna **una sola migración nueva0101** para el ciclo sobre esa base ya con0100. No generar ni aplicar0101 antes de ese paso. Inventario de ledger y selección de replay válido por wrapper; ninguna reparación de hashes ni replay global por conveniencia.

## Flujo futuro y asignación

Coordinador integra serialmente; hasta dos implementadores y QA independiente, sin subdelegación. Worktrees propios desde dev congelado y reservas factory exactas antes de código. Un solo writer de esquema/journal, HTTP escrito antes de UI. Se preservan los worktrees actuales: performance tiene harness sin commit, no se retira ni cambia su base por detrás del trabajo. El coordinador asigna/reutiliza capacidad respetando tres worktrees operativos; no force/discard.

- A, ciclo/datos/servidor: packages/db/src/schema/analytics.ts, migración0101/snapshot/journal exclusivamente; packages/domain/src/analytics/types.ts, weights.ts, cards/ y pruebas pertinentes; apps/merchant/src/server/analytics/queries/, evaluation/, lifecycle/ (nuevo servicio común) e ingestion/ si el cableado real lo exige. Escribe docs/factory/0237-inbox-lifecycle-data.md. No tocar kit/guardias/UI.
- B, HTTP/UI: apps/merchant/src/server/analytics/http/ y actions/, apps/merchant/src/app/api/analytics/inbox/, apps/merchant/src/app/api/internal/analytics/cleanup/, apps/merchant/src/app/backoffice/analytics/inbox.tsx y contratos UI necesarios. Usa kit existente/tuteo, sin nuevos nativos/CSS/paleta ni cambios kit/guardias. Escribe docs/factory/0237-inbox-lifecycle-ui.md. No tocar esquema/dominio/query/evaluation del writer A; consume el servicio/DTO acordado.
- QA independiente: solo docs/factory/0237-inbox-lifecycle-qa.md y artefactos externos. Entrega dictámenes de A/B y combinación exacta. No implementa lo certificado ni repite suites por ceremonia.

## Orden de trabajo

1. Cerrar catálogo y contratos HTTP; revisión documental independiente. Gate: ninguna regla de producto sin decidir.
2. Congelar base funcional compatible con0100 y asignar IDs/SHAs/paths/recursos factory. Verificar herramientasNode24, ledger seleccionado y ausencia de writers.
3. A implementa fundamento de0101, tipos/contexto/máquina de estados/locks y servicios. Checkpoint congelado para que B avance desde esa base, preservando commits y refrescando factory antes de editar.
4. A adapta evaluación/ingesta/fuentes5/9/reconciliación12/transición; B implementa HTTP, navegación desacoplada, decisiones explícitas/fecha de recordatorio y ruta de limpieza, sobre contrato fijo.
5. Autores corrigen; QA entrega+combinación. Coordinador verifica producto combinado idéntico a fuentes probadas y checks de interacción pertinentes. Main solo con QA PASS y decisión de cierre del requisito de rendimiento; sin publicar.
6. Tras ciclo estable, retomar rendimiento sobre la base definitiva. Conservar fallos y el objetivo TOTAL≤1000ms, sin mezclarlo con PASS funcional. No nuevos benchmarks en esta tarea documental.

## Criterios de aceptación

Se detallarán rutas, catálogo y escenarios en la spec. Piso: misma tarjeta/ID entre días, eventos y posposición; cierre atómico con cursor atendido y texto eliminado; ninguna fila nueva por recálculo idéntico; evento ajeno/viejo/replay no reabre; consumo posterior menor y reposición→escasez sí reabren8; accionamiento con versión esperada no cierra datos no vistos; navegación no cierra; recordatorio futuro>90d sobrevive; condición resuelta cancela y no resucita; delivery12 no pisa snooze; lectores no dependen de hoy/ayer ni actividad35d para pendientes; limpieza no toca históricos numéricos/cursores de ingesta/control necesario; legado desconocido se conserva.

Pruebas proporcionales: unit de estado/contexto/orden crítico y bordes temporales; Neon focal de persistencia, idempotencia, carreras y aislamiento, una corrida serial en replay válido con tools/neon-test.sh/Node24; navegador de tres decisiones, navegación y recordatorio con kit en390/1280; schema/snapshot/hash/ledger coherentes. Sin suites globales ni mutaciones. Registrar fuentes/logs, fallos, skips y límites. No DB real/PROD ni programar cron remoto para probar la ruta.

## Detalle técnico que el agente debe entregar antes del checkpoint

- Tipos/DTO compartidos en packages/domain/src/analytics/types.ts, máquina de estados y comparadores puros por cada fila del catálogo. Lista de campos exactos, evidencia de origen y orden; no hash de todoinput/fecha como detector de novedad. Persistencia por asunto/episodio, última decisión/contexto y orden causal; sin duplicar el texto para conservar hechos5/9.
- A implementa servicios lifecycle para cierre, snooze, sincronización, recordatorio y cleanup; B consume esos servicios desde http/index.ts y rutas. B no escribe SQL por su cuenta ni crea un segundo sistema de locks/estado. Los contratos de §3.5 son la única interfaz entre capas.
- expectedVersion corresponde al contexto presentado; operationId identifica retry sin log nuevo. Guardar control suficiente para devolver éxito idempotente si ya se eliminó el texto, sin cerrar una versión posterior. Casos tenant ajeno404, contrato viejo409 sin side effects, contexto obsoleto409, timestamp inválido/pasado422; permisos de destinos independientes.
- Registrar recuperación y secuencia de gauges del mismo insumo/local durante ingesta permite distinguir reposición intradiaria aunque el gauge final coincida con el cerrado. No resolverlo leyendo Stock ni comparando solo amountMinor=null. Nuevos campos/eventos de origen, si hicieran falta, vuelven primero al coordinador para ampliar paths/contrato.
- Estado/identidad persistentes pasan medianoche: ninguna operación puede depender únicamente de locks por negocio/día. Definir un orden único de locks entre delivery, evaluación, acciones y limpieza; CAS sobre contexto cuando el usuario responde a una versión vieja.
- Cron de limpieza semanal no es un scheduler de recordatorios. GET filtra remindAt ya cumplido; el cliente refresca según nextReminderAt y al recuperar foco. No nuevo push/email ni cálculo de detalle al abrir; ningún límite de90 días para la fecha elegida. La sincronización temporal también alcanza comercios sin actividad35d pero con pendientes.
- Antes de0101, inventario de legado que distinga registros demostrablemente vigentes/duplicados/cerrados y desconocidos. Accepted previo es navegación, no Solucionado; no inventar fechas/capturas del contexto visto ni borrar desconocidos para forzar una nueva restricción. Si la unicidad nueva choca con legado, preservar evidencia y proponer transición conservadora; no resolver con DELETE global.
- La matriz de regresiones debe ligar cada fila del adversarial a un test o invariante verificable: anti-replay90d, borrado contenido/cursor retenido, fuentes5/9, snooze12, ausencia11, listas sin runhoy/ayer, medianoche/actividad35d, carrera cerrarA/publicarB, snooze/cleanup, exactitud del corte, rollback/backlog y legacy. QA revisa fuente exacta y no transforma diagnostico caliente en PASS≤1s.

## Comandos y evidencia de esta fase

Solo documentos, Node24 y comprobaciones proporcionales: diff--check, enlaces/paths relativos, frontmatter coherente, formato de archivos tocados y revisión independiente del catálogo/contrato. No suites de producto, DB, migraciones, servidores ni benchmarks para aprobar texto. Registrar SHAs y límites en docs/factory/0237-inbox-lifecycle-plan-qa.md. No presentar el plan como lanzable hasta cerrar las tres aclaraciones pendientes y el dictamen documental.

## Entrega y pruebas focales del agente

A dejará servicios y pruebas de ciclo/contexto en apps/merchant/src/server/analytics/lifecycle/ (nuevo), y una prueba de persistencia/carreras en ese mismo directorio. B dejará las pruebas HTTP de decisiones/cleanup en http/ y navegación/fecha/estado en el área del inbox, con fixture que no omita version/decisions/nextReminderAt. Reutilizar casos de evaluación/ingesta pertinentes en lugar de duplicar suites. Cada prueba nueva debe verificar un invariante del adversarial, no reflejar meramente la forma del código.

DB única de aceptación inicial: NEON_TEST_ENV_FILE=/private/tmp/checkpass-0237/migration.env tools/neon-test.sh con archivos concretos y --no-file-parallelism, después de que el coordinador haya fijado la base con0100 y aplicado0101 por migrador oficial. Este env es una selección privada de replay válido, no copiarlo a .env.local ni usar DATABASE_URL raíz. No ejecutar la semilla perf, reset de CI o coldtest para validar el ciclo. El coordinador reserva DB durante migración, prueba y teardown; B no la usa mientras A tenga el recurso.

Comprobaciones locales de autor: unit focales de lifecycle/contextos/selección y HTTP; tipos Merchant y lint de paths tocados; guardia UI vigente comparada con su base congelada; navegador390/1280 con navegación independiente, tres decisiones y recordatorio, sin retries/skips como aprobación. Las pruebas de concurrency/tenant/migración requieren Neon real por wrapper; browser con HTTP simulado no las reemplaza. Las pruebas/fuentes compatibles se reutilizan; no hay verify global ni builds/DB extra por ceremonia.

Cada entrega incluye base/source/delivery SHAs, archivos y contratos finales, logs de pruebas realmente corridas, fallos corregidos, casos no seleccionados, migración/hash, procesos/recursos pendientes y límites. QA entrega no equivale a QA combinación. No declarar solucionado el objetivo de rendimiento ni main/publicación habilitados si solo pasó el ciclo funcional. Handoff final del coordinador docs/factory/0237-inbox-lifecycle-handoff.md.

## Precisiones de concurrencia y recordatorio de la revisión documental

La version opaca incluye el contexto de negocio y la revisión de decisiones/remindAt; no solo el fingerprint de datos. Un retry de snoozeA no puede sobrescribir snoozeB posterior aunque el stock no cambie. El control compacto retiene última operationId, digest y revisión suficientes: retry reconocido retorna resultado actual sin aplicar de nuevo; ID reutilizado con otro comando/cuerpo devuelve409; retry antiguo ya sustituido y no reconocible devuelve409/404 sin efectos. No guardar un log ilimitado para prometer respuestas200 eternas. Lecturas/shownDays no cambian por sí solas la versión de decisión que el cliente acaba de recibir.

nextReminderAt es mínimo estrictamente futuro entre pospuestos vigentes/autorizados. Un recordatorio ya debido se filtra como candidato disponible, nunca devuelve una fecha pasada que vuelva a programar refrescos inmediatos en bucle. Si ninguno queda, null. Añadir pruebas de dos postergaciones/retardo de retry y de recordatorio debido más otro futuro, sin modificar políticas de producto.

## Pausa de revisión documental

QA detectó un tercer punto de producto: un recordatorio vencido puede seguir bajo el mínimo por novedad acumulada. Consultado al owner renovar novedad al vencer, manteniendo ID, tope de cinco y prioridad crítica, o conservar decaimiento. No se presume respuesta. Revisión y ejecución detenidas hasta contestación, junto con las aclaraciones de vigencia y tarjeta 11.

Hallazgos técnicos registrados para retomar después: verificar recuperación intradiaria de stock también con deliveries fuera de orden; actualizar el inventario de rendimiento de la spec con el FAIL de 1817,621042 ms sin borrar los anteriores. Las precisiones CAS e idempotencia ya escritas son borrador pendiente de revisión sobre el próximo SHA.
