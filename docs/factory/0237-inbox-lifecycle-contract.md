# 0237 — Contrato de implementación del ciclo de avisos

Encargo autorizado: implementar el ciclo de avisos con dos implementadores y QA independiente tras revisión documental. La aprobación final del owner cierra producto. Sin cron remoto, push, deploy ni PROD. Producto AN-1/AN-2/AN-3 en main local `5afa5294`; último borrador de retención `e6061e1b`. Mandan [spec0237 §3](../specs/0237-analiticas-inbox-y-resumenes-diarios.md) y ADR0152/0153. La propuesta `5d6e265b` y el [adversarial](0237-inbox-lifecycle-adversarial.md) `3819d497` son antecedentes: las excepciones de retención de ese diseño quedan sustituidas por la respuesta posterior del owner, no son el contrato vigente.

## Reserva documental

Coordinador writer único de docs/specs/0237-analiticas-inbox-y-resumenes-diarios.md, addendum de docs/adr/0152-analiticas-inbox-accionable.md, este contrato y docs/estado/gpt.md. No INDEX/TASKS/estado Claude. Preservar informes y fallos anteriores; no reescribir evidencia histórica.

## Decisiones de producto cerradas

- Una tarjeta vigente por asunto, sin copias por recálculo. Navegar no cierra. Cerrar elimina texto inmediatamente y conserva solo el último control necesario para evitar repetición sin datos nuevos.
- Categorías explícitas: informativa, accionable y Marketing. Informativa: Visto/Ignorar, sin Solucionado ni snooze. Accionable: Solucionado/Ignorar/Recordarme luego dentro de su vigencia. Marketing queda reservado a la tarjeta 11 parqueada, sin avisos activos en este encargo.
- Resumen diario marcado se retira; sin marcar, el día siguiente actualiza misma tarjeta/ID y su período/versión, sin acumular anteayer. Navegación al histórico no marca; histórico intacto. Demanda/día flojo solo para su día objetivo. Informes de conteo/campaña son hechos distintos, no se agrupan por calendario.
- **Corrección del owner:** el máximo de 90 días también alcanza pendientes y pospuestos. No hay excepción por edad ni fechas a 180 días. El inicio del episodio queda fijo; actualizar texto, volver a exponer o posponer no reinician el plazo. El lector excluye vencidos sin esperar el cron. El job semanal elimina contenido viejo, conservando únicamente control compacto necesario y datos de negocio.
- **Tarjeta 11 parqueada:** dejar de generar/exponer, incluso candidatas existentes y fallback. Conservar eventos, métricas e histórico de clientes. No nuevas reglas de ausencia, veinte tarjetas individuales, audiencia agregada ni enviar cupón. La futura tarjeta depende de Marketing y de una decisión de presentación; no es trabajo de este encargo.

El owner exige política única configurable y confirma archivos versionados documentados, sin pantalla ahora.
Última respuesta: «Aprobado con esa aclaración al llegar al recordatorio vuelve a competir». Default central
`snooze.noveltyOnDue = "reset"`: novedad1 una vez por vencimiento, mismo ID y expiresAt; nuevas exposiciones decaen.
No se reinician decaimiento por edad del hecho, monto, urgencia ni reglas de elegibilidad; mantiene mínimo de peso,
prioridad y máximo de5. No garantiza aparecer ni renueva el plazo. Retry/lectura/recalcular no repiten el reset.

No quedan decisiones de producto pendientes. Gate previo a código: QA documental de spec/contrato sobre SHA
congelado y preparación de base/worktrees. Si surge otra contradicción material, preguntar y parar. El requisito
de rendimiento y las operaciones de publicación conservan sus límites; esta aprobación no significa PASS frío.

## Investigación de Marketing solicitada por el owner

Agente de solo lectura `/root/marketing_research`, sobre fuente `4de3ffbf`. Sin escrituras, DB, API, red ni credenciales. Hallazgos:

- Solo welcome y cross están habilitadas. missed_you, at_risk, win_back y compositor están apagados: [enabled-campaigns.ts](../../packages/domain/src/server/marketing/enabled-campaigns.ts). No habilitarlos indirectamente.
- Las etapas bienvenida/activo/te extrañamos/en riesgo/perdido/irrecuperable y escalera por rubro están en [spec0110](../specs/0110-etapas-de-ciclo-de-vida-por-rubro.md), todavía borrador. No se encontraron stageOf/STAGE_LADDERS/activeUntilDays/lostFromDays/goneAfterDays implementados en apps/merchant/src o packages. No describirlas como clasificación disponible.
- Hay reglas anteriores conservadas de ritmo y días en [templates.ts](../../packages/domain/src/server/marketing/templates.ts) y [at-risk.ts](../../packages/domain/src/server/marketing/at-risk.ts); las correspondientes campañas de reactivación están apagadas.
- No hay envío manual individual desde tarjeta ni selección manual de veinte destinatarios. [campaign-input.ts](../../apps/merchant/src/server/marketing/campaign-input.ts) configura campaña/premio/fechas/locales, sin destinatarios individuales. Bienvenida y cruzada emiten automáticamente en sus flujos propios; no equivalen a una acción manual.
- Existe [audience-preview.ts](../../apps/merchant/src/server/marketing/audience-preview.ts) con conteos agregados, pero usa dormantDays/locales con atRisk:null, no etapas oficiales. No constituye una tarjeta agregada de clientes en riesgo.
- La tarjeta 11 integrada sí es individual, por mediana, y su acción actual es Ver cliente: [customer-promo.ts](../../packages/domain/src/analytics/cards/customer-promo.ts). Es antecedente a retirar del inbox por esta decisión, no regla oficial de Marketing ni acción de envío de cupón.

La diferencia entre documentación y capacidad viva queda informada, sin resolverla con cambios de producto. No bloquea el parqueo explícito de 11. Reabrirla exige fuente oficial de segmentación, forma agregada y acción real de campaña/cupón en otro encargo.

## Alcance y límites

Reutilizar card_candidate/card_state/evaluation_run y resúmenes existentes, sin tabla nueva de historial, archivo paralelo ni particionado. Separar contexto factual necesario de 5/9 del texto de notificación antes de borrarlo. Fuente/fecha/contexto por tipo, versiones y locks; reapertura de 8 solo con consumo pertinente posterior o recuperación seguida de escasez; prioridad stock crítico ≤24 h sobre invitaciones; rutas v2, UI de categoría/decisiones, cleanup interno y transición conservadora.

No cambiar métricas, dinero, valores iniciales aprobados de las tarjetas activas, permisos, arquitectura core/eventos ni corte Stock. Los parámetros de tarjetas se trasladan a la política única para futuros balances explícitos. No habilitar Marketing, inventar campañas, publicar clima/calendario o resolver diferidos por extensión. Sin push, deploy, lectura/migración PROD, verify global ni mutaciones. Solo la tarjeta 11 deja el catálogo activo por decisión explícita.

## Política central configurable: requisito del owner

Manda spec §3.11. El catálogo único contiene reglas habilitadas/parqueadas, categoría, evidencia/umbrales/ventanas, frecuencia/enfriamiento, peso/urgencia/decaimiento/prioridad, vida útil/recordatorios, textos/plantillas, decisiones y claves de acciones. Las cifras de la spec son defaults iniciales, no constantes repetidas en motor/SQL/HTTP/UI/cleanup. Analíticas sigue core siempre activa; deshabilitar una regla del catálogo no introduce switches de módulo o entorno.

Estado real que motiva el trabajo: WEIGHTS centraliza mínimo0,05/máximo5/decaimiento0,6, pero cards/index.ts aún fija mínimos28d/4ocurrencias, cobertura0,8, invitación7d y ausencia de gastos45d; stock.ts fija cuantiles0,25/0,75, riesgo4d, suba5% y decaimiento0,7; customer-promo.ts contiene urgencias y ventanas de anulaciones; queries/index.ts mantiene ventanas SQL fijas. actions/index.ts resuelve acciones con ramas propias. Mover solo WEIGHTS no satisface este requisito.

A crea packages/domain/src/analytics/policy/ con contrato AnalyticsPolicy, validación, defaults y registro de AnalyticsRuleDefinition. Inyección explícita e inmutable de un único snapshot/version en dominio y servidor; sin I/O o reloj escondidos en evaluadores. El registro refiere evaluadores/condiciones/plantillas/acciones soportados: agregar/quitar una definición no requiere tocar selección, API o UI. Un cálculo/evento/acción realmente nuevo requiere implementarlo/probarlo y registrarlo; no se promete generar código ni se ejecuta SQL/JS arbitrario desde configuración.

B consume las capacidades y la vigencia resueltas por ese mismo contrato, sin catálogo propio ni límites numéricos duplicados. Las consultas derivan ventanas de las reglas habilitadas, para que cambiar28d no deje una lectura truncada. Las acciones siguen claves genéricas/registro/permisos; ningún href libre ni import de un módulo desde core. Los defaults de las tarjetas activas conservan fórmulas/umbrales actuales, además de las revisiones explícitas de ciclo y parqueo11.

Validación de límites finitos, referencias/IDs/acciones, combinaciones categoría-decisión y coherencia temporal. No publicar parcialmente ni sustituir una política inválida por defaults sin avisar. Versión de política en candidato/control y mutaciónCAS; no copiar todo el catálogo por aviso. Cambio de configuración no cuenta como consumo/venta, no reinicia edad, no borra lo atendido y no resucita vencidos. Deshabilitar regla retira contenido de lectura/sincronización; volver a habilitarla respeta el control atendido. El job usa expiresAt efectivo, no otro90 fijo. GET declara policyVersion y no sirve resultados de una política anterior como si fueran nuevos. El cambio de política invalida trabajo ready del día para reevaluar lo afectado; no reinicia estado/edad ni crea copias. Hasta tener contenido compatible, preparación/exclusión segura sin recalcular historia pesada al abrir. Ninguna regla deshabilitada ni caducada vuelve por ese lapso. Referencia de versión en las tablas existentes; no otra tabla de trabajo.

TTL inicial90d central, finito y validado. Reducción revalida existentes; ampliación solo episodios nuevos, sin prórroga de episodios abiertos/atendidos/vencidos. Todo snooze se acota al expiresAt efectivo. Cadencias/presupuestos/lotes también se declaran centralmente; scheduler externo y política deseada deben concordar, pero no se opera cron remoto ni se declara una frecuencia nueva ya desplegada por editar el catálogo.

Simulación pura con un mismo snapshot y dos políticas: motivos de elegibilidad, componentes del peso, orden y vencimiento sin escrituras. A entrega inventario de todos los parámetros de cada tipo, valor inicial/ruta anterior/nuevo campo, consumidores y límites; QA verifica que no queden decisiones de producto dispersas ni una modificación oculta de defaults. Casos focales de cambiar solo peso, umbral, ventana, frecuencia, acción y TTL verifican efectos entre capas, además de inválidos/versión/deshabilitar y no resurrección.

**Superficie cerrada por el owner: archivos, sin consola en esta etapa.** Conjunto previsto en policy/: config.ts único catálogo editable; rules.ts registro sin defaults duplicados; schema.ts contrato/validación; index.ts entrada pública del snapshot; README.md guía en español. Una futura pantalla consumirá el mismo contrato, pero no se preparan endpoints/almacenamiento/permisos de edición ni tablas de políticas por anticipado.

A es writer de esos archivos y su guía. La guía debe permitir al owner leer y trabajar la política: mapa/flujo, diccionario por parámetro (qué significa, unidad, default, rango, efecto y consumidores), ficha de cada regla, ejemplos antes/después, cómo cambiar peso/umbral/frecuencia/acción/TTL, deshabilitar o registrar una regla, validar/simular/comprobar y revertir. Incluir efectos sobre avisos vigentes/atendidos/vencidos, policyVersion y necesidad de reevaluación; diferenciar datos de configuración de nuevos algoritmos/fuentes/acciones. Documentar límites y permisos de acciones y la relación con el cron externo.

QA debe poder seguir esas recetas sobre la fuente congelada: variar un solo archivo, ejecutar comandos reales de validación/simulación, observar resultados y revertir sin escrituras en DB. No comandos ficticios ni una guía que copie defaults que luego divergen; enlazar la definición canónica. El catálogo es de código versionado: el proceso usa la versión cargada, no una lectura dinámica de archivos o DB en cada request. Explicar recarga local/revisión y que cambiar un archivo no actualiza automáticamente un despliegue publicado. No push/deploy en este encargo.

## Caducidad y no repetición

Inicio de episodio fijo; expiresAt = inicio + 90×24 h. Hechos con origen conocido no se rejuvenecen al procesarlos tarde; condiciones calculadas usan su primer contexto elegible persistido. El resumen nuevo renueva período sin crear archivo. Un aviso vence al superar expiresAt aunque esté pendiente o pospuesto: GET lo excluye y cancela recordatorio, cleanup borra el contenido. El límite exacto se conserva; justo después vence. Snooze exige now < remindAt ≤ expiresAt y no modifica inicio/edad. No hay fechas a 180 días ni prórrogas por volver a posponer.

Limpieza semanal interna: corte único UTC now−90×24 h, eliminar contenido de episodio anterior al corte y residuos cerrados con fecha probada anterior al corte. Lotes ≤500, presupuesto 10 s, revalidar bajo lock/CAS, omitir ocupados y retomar; sin barridos/locks globales. Backlog no amplía visibilidad. No afirmar borrado físico antes de 97 días ante fallos. No crear cron remoto en esta fase.

Borrar un aviso viejo no permite recrearlo mañana con los mismos datos. Conservar únicamente último contexto/cursor necesario por asunto; sin texto ni log de decisiones. Estados por hechos caducados se depuran cuando edad de origen y deduplicación garantizan no reemisión. Estados permanentes se actualizan por asunto, no crecen por cada lectura/decisión. Eventos, revisiones/contribuciones, gauges e histórico numérico quedan fuera de limpieza.

Legado: accepted antiguo era navegar, no Solucionado. Agrupar duplicados con evidencia y tomar el inicio más antiguo demostrable, no la última copia diaria. Si no hay edad demostrable, anclar retención una vez al instante de transición sin inventar fechas/cierres históricos; también vence en 90 días y no se reinicia cada corrida. No preservar contenido desconocido indefinidamente ni borrar datos de negocio para lograr unicidad. La migración debe retirar contenido de 11 por su parqueo y conservar métricas de clientes.

## Base y migración

0100 de rendimiento existe solo en analytics-performance: fuente `b3ca9c6fda419306b013f3781dcc14c9780cd25b`, entrega `058d7c483bffc07f245611a675f92623eb8a3ea5` rechazada por FAIL frío 1817,621042 ms. SQL SHA256 `d7be0529f9325bb3dbaa6d3517e10ad3ac9b59a677034f849c258289e5fcfe5a`; ya aplicada en DB efímeras. No reescribir 0097–0100, hashes, journal o ledger ni usar 0100 como número libre. La rama y su harness diagnóstico sin commit se preservan.

Antes del kickoff, el coordinador integra en dev la base funcional de rendimiento mediante merge que preserve commits, reutilizando evidencia de equivalencia y dejando el FAIL explícito: no acepta rendimiento ni habilita main. Este encargo documental no hace ese merge. Solo después asigna **una nueva migración 0101**, sobre tablas existentes, y congela el SHA común. Inventario de ledger por wrapper/replay válido, sin reset/reparación ni replay global por conveniencia.

## Roles y paths futuros

Coordinador integra serialmente; hasta dos implementadores y QA independiente, sin subdelegación. Worktrees propios desde dev congelado y reservas factory antes de código. Un writer de esquema/journal. Máximo tres worktrees operativos, respetando performance y su harness sin commit; no force/discard ni checkout ajeno.

- A, datos/dominio/servidor: packages/db/src/schema/analytics.ts y exclusivamente migración0101/snapshot/journal; packages/domain/src/analytics/types.ts, weights.ts, cards/, policy/ nuevo y pruebas pertinentes; apps/merchant/src/server/analytics/queries/, evaluation/, lifecycle/ nuevo e ingestion/ si hace falta. Incluye retirar generación de 11 y sus candidatas, preservando eventos/métricas. Entrega docs/factory/0237-inbox-lifecycle-data.md. Sin UI/kit/guardias.
- B, HTTP/UI: apps/merchant/src/server/analytics/http/ y actions/, app/api/analytics/inbox/, app/api/internal/analytics/cleanup/, app/backoffice/analytics/inbox.tsx y contratos UI pertinentes, bajo apps/merchant/src/. Consume servicio/DTO/política de A, sin SQL propio, parámetros duplicados ni otro sistema de locks. category/expiresAt/decisions/policyVersion explícitos, fechas acotadas y sin controles de 11. No consola de políticas, endpoints de edición ni almacenamiento de configuración; solo consume los archivos centrales a través del contrato público. Kit existente/tuteo, sin nuevos nativos/CSS/paleta ni cambios de kit/guardias. Entrega docs/factory/0237-inbox-lifecycle-ui.md.
- QA independiente: solo docs/factory/0237-inbox-lifecycle-qa.md y artefactos externos. Dictámenes de entregas y combinación exacta; no implementar lo certificado ni repetir suites por ceremonia.

## Secuencia y checkpoint

1. Congelar política en archivos, guía, spec y HTTP con novedad aprobada y completar QA documental. QA documental sobre fuente exacta, con centralización de todos los parámetros y retirada de las antiguas excepciones de edad.
2. Fijar base compatible con 0100, SHAs/paths/factory y recurso DB serial; Node24, replay válido, sin writers.
3. A entrega checkpoint congelado con catálogo/validación/versionado de política, inventario de parámetros, 0101, tipos/contextos, edad/estado/locks y servicios. B parte de ese SHA con factory refrescada antes de editar. No HTTP/UI inventados por cada agente.
4. A completa evaluación, ingesta, fuentes5/9, late12, parqueo11 y legado; B implementa HTTP, UI/decisiones/fechas y wrapper de cleanup sobre servicio común.
5. Autores corrigen; QA de entregas y de combinación. Coordinador verifica interacción y exactitud de fuentes/evidencia. Main solo con QA PASS y decisión explícita de cierre del requisito de rendimiento, sin publicar.
6. Luego retomar rendimiento sobre base definitiva. Conservar FAIL y TOTAL≤1000 ms; no nuevos benchmarks en esta fase documental.

Antes del checkpoint A congela campos y orden causal por tipo: no hash de todo el input, fecha de recálculo o importe null como novedad. Debe registrar recuperación intradiaria aun si consumo posterior llega antes que reposición previa. Traductores puros, sin leer Stock desde core. Si faltan campos en eventos de origen, volver al coordinador para asignar productores; no ampliar paths por cuenta propia.

## Contrato técnico y pruebas focales

HTTP de spec §3.5 es la única interfaz A/B. Version incluye contexto, política relevante y revisión de decisiones/remindAt; lecturas/exposición no invalidan la versión recién servida. operationId/digest reconocidos devuelven resultado actual sin reapply; reutilización con otro cuerpo 409. Retry antiguo sustituido devuelve409/404 sin efectos, nunca pisa snooze posterior. No log ilimitado para guardar respuestas200 eternas. nextReminderAt solo mínimo estrictamente futuro de accionables aún vigentes; debidos van a cards, sin bucle por fecha pasada.

Acciones/evaluación/delivery/cleanup comparten locks por comercio/asunto que sobreviven medianoche, con orden único y CAS. Revalidar caducidad antes de mostrar o posponer. Cron semanal es limpieza, no scheduler de cada recordatorio: cliente refresca al vencimiento y al foco, sin polling nuevo ni notificaciones OS/email/push.

Unit: misma ID entre días/eventos/snooze; cierre, contexto repetido/ajeno/viejo, reapertura8 pertinente, categorías, resumen renovable, prioridades, cortes de edad y ranking de recordatorio con reset de novedad una vez al vencer, sin cupo garantizado ni extensión de vida. 11 no genera ni se expone desde candidato guardado/fallback; visitas/histórico no cambian. Cada test cubre un invariante, no la forma del código.

Neon focal por tools/neon-test.sh: cerrarA/publicarB, doble snooze con retry antiguo, cleanup/snooze, medianoche, recuperación de stock intradiaria normal/fuera de orden, datos5/9 tras borrar texto, late12 sin duplicación, tenant/permisos y Stock. Cleanup prueba igualdad/justo después de90d, pendientes/pospuestos antiguos eliminados, remindAt fuera del plazo rechazado, inicio no renovado por lectura/actualización/snooze, ancla legacy única, rollback/ocupados/backlog y no resurrección al reevaluar. GET no muestra vencidos aunque cron no corra. No toca histórico/métricas/ingesta. El antiguo caso snooze12 se sustituye por rechazo de snooze informativo y late12 sin copias por la decisión del owner, no para ocultar fallos.

DB inicial única: NEON_TEST_ENV_FILE=/private/tmp/checkpass-0237/migration.env tools/neon-test.sh con archivos concretos y --no-file-parallelism, tras base0100/0101 por migrador oficial. Recurso reservado durante migración/pruebas/teardown. No DATABASE_URL raíz, env productivos, semilla perf, reset de CI o coldtest. B no opera DB mientras A tenga recurso. Los casos tenant/concurrency/migración necesitan Neon real; browser simulado no sustituye esos checks.

Autor: unit focales, tipos Merchant/lint paths y guardia UI contra base congelada; browser390/1280 con navegación independiente, Visto, tres decisiones accionables, límite de fecha, expiración y refresco. Sin verify global, mutaciones, skips/retries como PASS o baterías extra por ceremonia. Logs/fuentes/casos no seleccionados/fallos y límites siempre explícitos; QA entrega no equivale a combinación.

## Evidencia y entrega

Fase actual solo documentos: diff--check, enlaces/paths, coherencia y secciones originales no afectadas, Node24. Archivos confirmados; no ampliar a almacenamiento/UI de edición por adelantado. Informe futuro de QA documental en docs/factory/0237-inbox-lifecycle-plan-qa.md; no afirmar PASS ni implementación hasta disponer de evidencia sobre fuente exacta. No DB, migración, servidor, cron o benchmark para aprobar texto.

Entregas futuras: base/source/delivery SHAs, archivos/contrato, pruebas realmente corridas, fallos/casos no seleccionados, migración/hash, recursos/procesos y pendientes. Handoff de coordinador docs/factory/0237-inbox-lifecycle-handoff.md. Rendimiento y CI/PROD/clima/ciudades/«cuánto ahorraste» conservan sus diferidos; no se certifican por el ciclo funcional.

## Kickoff local autorizado — 2026-10-17

QA documental PASS de fuente74125ab9, entrega ae4c759222fa2c55c6c23395934306c2efd1b894 aceptada e integrada. Base funcional congelada **48d43abbfa71d5f478b0629aac53cca4d5dcd0d9**, merge de entrega058d7c48 exacta con0100; FAIL1817,621042ms conservado, no main/publicación. WIP diagnóstico a900bde2 preservado en ref analytics-performance-diagnostic-preserved y copias externas, excluido de esta base.

A: agente /root/analytics_performance reutilizado, taskfactory analytics-performance, branch nueva analytics-lifecycle-data en /private/tmp/checkpass-analytics-perf/analytics-performance. Base común anterior; paths de A más nueva policy/, lifecycle/,0101 y handoff. No optimizar rendimiento ni editar WIP/0100. B: /root/analytics_lifecycle_ui, task/branch analytics-lifecycle-ui, WT homónimo bajo /private/tmp/checkpass-analytics-perf; mismo SHA común antes de checkpoint. QA: /root/an3_qa, task analytics-performance-qa, WT analytics-performance-qa, writer exclusivo nuevo informe de producto. Sin cuarto WT ni subdelegación.

A debe entregar checkpoint temprano de tipos/contratos/política/esquema/servicios; B empieza producto solo después de consumir ese SHA mediante fast-forward/refresh por el coordinador. Hasta entonces B solo lectura/preparación. El DTO de inbox suma timezone como dato técnico aditivo para seleccionar fecha en zona del comercio, sin nuevo endpoint ni kit. El clock de caducidad usa expiresAt efectivo de política, no90 fijo en SQL.

Recurso serial de replay para A: db:analytics-lifecycle-replay + migration:0101, entorno privado /private/tmp/checkpass-0237/migration.env. Nadie más usa DB hasta liberación explícita tras teardown. No CI compartida/perf/PROD. CI remoto sigue rojo en db3175d2 (Unit+Neon, stock-consumption count_changed); solo se leyó ci:status, no se reparó ni ejecutó suite global.

### Checkpoints A1/A2 y preparación B

A1 congelado25b56583 entrega política/validación/registro y DTOs v2, no0101 ni servicios. Evidencia5/5unitpolicy+Merchanttypes/lint; LegacyInboxCard solo interno, no etiquetaHTTPviejo comoV2. B preparación636ddbe2 solo pruebas/fixtures v2 y adaptación explícita de accept/dismiss/11, sin suitescontraUIvieja ni PASS funcional. Ambos integrados en dev40f1cb68; ByaFF/refresheda40 yGOUIconDTOs, HTTPesperaA2serviciosreales. AcontinúaA2sobreA1, sin mover su checkout por detrás. No ritual de entrega/aceptación funcional para checkpoints incompletos; entregas finales conservan todas las fuentes.

QA temprano de A1 detectó tres defectos a corregir enA2: dos reglas del mismo handler admitidas pero segunda ignorada, comparisonDays fuera de ventanaSQLderivada y guards por truthiness que omiten validaciones cruzadas con0. A los reconoció; no se presentan como PASS global. A2debe incluir pruebas de esos bordes.

B recibió extensión factory a tests/e2e/analytics.spec.ts, analytics-an2.spec.ts, analytics-an3.spec.ts y sus tres fixtures para mantener regresiones del histórico y actualizar solamente el contrato obsoleto aprobado. Harness de componentes aislado, configexterno sin webServers/retries; se permite puertoefímero del patrón existente con puertoefectivo y cierre registrados, no lanzar apps globales.

Adiciones técnicas delDTO: timezone y refreshAfterMs (derivado fallbackWaitMs de política, nullready) para no duplicar valores ni importar Nodecrypto albrowser. No nuevas decisiones de producto. Fechas largas dentro delTTL no deben desbordar setTimeout ni generar loops; pantalla retira/refresca expiración efectiva sin esperar cron.
