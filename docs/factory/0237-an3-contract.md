# 0237 — Contrato AN-3

Encargo del owner: SOLO AN-3 (§7 y comunes §1–§4), ADR0152/0153, sobre dev `dfe9ea70e02f6e026d3bc57f6b8b6266edf395c5`. Coordinador, dos implementadores y QA independiente. Candidato integrado primero en dev; el owner autorizó después continuar autónomamente hasta QA PASS y merge en main local. Sin push, deploy, lectura o migración PROD. Sin INDEX/TASKS/estado Claude, verify global ni mutaciones. No cambiar tarjetas AN-1/AN-2 ni reabrir rendimiento, housekeeping, ciudades/cron operativos o «cuánto ahorraste». Prueba real Visual Crossing ahora sí entra, con clave leída exclusivamente en memoria y sin imprimirla.

## Worktrees y continuidad

Se reutilizan los tres worktrees propios limpios de AN-2 mediante `factory continue` desde el nuevo dev, conservando las entregas aceptadas y sus commits. Los IDs/rutas históricos siguen `analytics-an2-{events,product,qa}` bajo `/private/tmp/checkpass-an2/`; esta continuación tiene handoffs separados AN-3. No se retiran porque AN-2 no es ancestro de main local y no se fuerza cleanup ni se crea un cuarto worktree. Bases, paths y recursos registrados antes del código.

## A — eventos y contexto

Writer de vocabulario `packages/domain/src/analytics/metrics.ts`, `packages/db` (una0099 solo si necesaria;0097/0098 intactas), `server/analytics/ingestion`, `server/module-events`; módulos POS y registro servidor/manifiesto POS para publicación/traducción y acción de anulados; core `server/counter/{orders,coupon-store,grant-coupon}.ts` y nuevo soporte propio `server/counter/analytics-events.ts`; productores/snapshots de campaña en `server/marketing` solo paths reservados; contexto `server/analytics/context` y ruta interna context. Handoff `0237-an3-events.md`. No subdelegación ni cambios a corte Stock.

Tres eventos pedidos atómicos con origen, local nullable donde origen lo permite, nombres/moneda/dinero exactos e identidades capturadas. Visita corresponde a nueva acreditación `core.order`, sin bienvenida ni repetir en reintento; preservar atomicidad también en grant sin cupón (hoy CTE de un solo statement). Canje de core se identifica por cupón único, origen de `discountOrigin.sourceId`; evitar doble conteo independientemente del orden de deliveries mediante contrato genérico acordado con B. Traductores puros, sin DB/reloj. Core no importa ni nombra módulos concretos.

Hallazgos notificados y resueltos expresamente por el owner antes del código: business_customer no tiene UUID id. Se calcula UUID v5 determinístico de (businessId,consumerId), namespace fijo propio de Analíticas, en el productor visit.recorded; SIN nueva columna ni backfill. Se confirman snapshots de ciclo de campaña en alta, edición y transiciones con endsAt/endedAt, para evaluar12 al día siguiente de ends_at o ended desde resúmenes, sin leer campañas ni cambiar su ciclo actual. Si otra necesidad requiere migración, máximo una.

DB exclusiva inicialmente A: `/private/tmp/checkpass-0237/migration.env`, solo `tools/neon-test.sh` con Node24, serial durante pruebas/teardown. No ci.env/perf/PROD. Un caso por evento nuevo y evento adicional si se confirma, con rollback/local/corte/idempotencia y deduplicación de canjes. No leer/exportar DATABASE_URL del checkout principal.

Prueba real clima: extraer solo VISUAL_CROSSING_API_KEY de `apps/merchant/.env.local` principal a memoria del proceso de prueba; no copiar env ni imprimir URL con clave, headers, cuerpo de errores o credenciales. Llamar ruta interna real autenticada sobre DB aislada, persistir forecast/observed de Cuenca y comprobar datos/respuesta del proveedor/cuota; no mostrar contexto en merchant. Detener e informar si proveedor falla, sin bucles hasta verde ni plan pago. Respetar hora real y registrar cómo se ejecutó el gate de las06h, sin fabricar fetched_at futuro.

## B — producto y consultas

Writer dominio `packages/domain/src/analytics` salvo metrics.ts, servidor `{evaluation,queries,actions,http}`, UI `app/backoffice/analytics` y destino cliente necesario en `app/backoffice/customers`, servidor/ruta cliente acotada si se necesita (solicitar paths antes). Handoff `0237-an3-product.md`. No subdelegación. Aporta tarjetas10/11/12, histórico clientes/promos y acciones genéricas, sin cambiar tarjetas previas ni kit/guardias/CSS. Leer impeccable para UI y copy tuteo.

Tarjeta10: mínimo mes,7d por local >max(3,media+2desvíos8semanas previas), dinero y acción anulados declarada por POS.11:≥4 días distintos con visitas, última90d, distancia>2medianas y≥mediana+7; gasto promedio por día visitado×días de visita esperados perdidos del mes. H5: Marketing actual selecciona audiencias de campañas, no se encontró envío manual a un cliente; confirmar lectura final y usar «Ver cliente» si se ratifica, informarlo.12: día después del fin/cambioended, descuentos y ventas asociadas sin atribución causal. No leer campañas/órdenes/canjes desde Analíticas; acordar hechos/resúmenes genéricos con A antes de código. Pesos/novedad/tope comunes; coeficientes no fijados en§7 se explicitan en handoff sin cambiar producto.

Métricas customer/campaign, local conservado en ventanas, dinero exacto y cohortes por cliente sin perder intervalos; no inferir cuatro visitas de cuatro días si hubo varias el mismo día sin definir su tratamiento por contrato. Histórico agrega bloques HTTP conservando AN-1/AN-2, períodos/local/tenant. Tests unitarios por bordes, focal Neon consultas/acciones tras GO de DB coordinador, browser proporcional.

## QA — independiente

Writer solo `docs/factory/0237-an3-qa.md`, artefactos externos si necesarios. Leer fuentes/spec/contrato, revisar entregas y combinación congelada, reutilizar evidencia compatible y reproducir señal decisiva. No implementar producto ni repetir global/benchmark. Verificar3eventos atómicos y cualquier snapshot adicional confirmado; deduplicación POS/canje ambas órdenes, cortes, tenant/local,10/11/12 bordes, acciones/H5, histórico, contexto real persistido invisible y secreto nunca impreso. Fallos/reintentos/skips no equivalen a PASS. Informe con SHAs/entorno/comandos/fallos/migración/cuota real del clima.

## Acuerdos técnicos de ejecución

- Continuación factory A/B/QA desde `bebf26c99b42754f7915b392487162b408a51833`, worktrees propios de AN-2 preservados. Dos implementadores y QA fresco `/root/an3_{events,product,qa}`.
- A/B acuerdan grupos adicionales de traducción con sourceKey/revision para canjes: `coupon:<couponId>` revisión2 desde venta financiera, revisión1 desde canje; grupo base sale.closed intacto. Costo capturado se conserva aparte sin que el grupo ganador lo borre. Sin dependencia del orden de deliveries, DB o reloj en traductor.
- Visitas desde daily_metric con count por cliente/local. Decisión posterior expresa del owner: para el hábito de la11 se agrupa por fecha local y se exigen≥4 días distintos con visitas; múltiples operaciones del mismo día cuentan como un solo día para intervalos/frecuencia. Las operaciones y sus importes se conservan completos. Mediana entre días distintos; gasto medio por día visitado (suma de importes/fechas distintas) para ponderar días esperados perdidos. Monto conocido usa el neto capturado. No tabla adicional de visitas. Una0099 para snapshot campaña si necesaria.
- H5 confirmado: no envío manual individual de cupón; acción11 «Ver cliente». El destino Customers existente usa permiso `counter`, que conserva el nuevo detalle específico, con tenant y reader restringido.
- Clima: una petición real del proveedor por rango ayer/hoy (dos registros), ruta interna GET real autenticada. El harness puede inyectar el gate mínimo de hora0 en el runner real, sin bypass HTTP/flag y conservando now/fetchedAt reales; proveedor/DB reales. No se fabrica una captura futura.
- CI remoto main `db3175d` sigue rojo por aserción histórica de conteo; no se corre verify global ni se afirma corregida la publicación. Se preserva mientras no se prepare push autorizado.

- Instrucción posterior del owner: ante una contradicción nueva se presenta la pregunta y se PARA todo el trabajo hasta su respuesta. No continuar trabajo independiente durante esa espera. Las aclaraciones anteriores están resueltas.
- A amplía scope a `server/marketing/plan-brake.ts` para cubrir las escrituras de estado internas del ciclo de campaña, preservando su comportamiento.

- Pausa por mediana cero cerrada por aprobación expresa del owner: «El conteo es por días… Si tenemos4 visitas en un día eso cuenta como una… aprobado». Se reanuda todo el flujo con≥4 días distintos para tarjeta11, sin reducir métricas históricas de operaciones. Mantener pausa ante cualquier contradicción nueva.

## Cierre verificado

Candidato `1713d942`, entregas A `99eac508` / B `ef3b4227` y QA independiente PASS de entregas/combinación. Hábito de la tarjeta 11 une días entre locales del comercio; métricas históricas conservan operaciones. Reconciliación de la 12 por delivery genérica tras grupos realmente aplicados, incluso con run ready. Una 0099, anteriores intactas. Clima real ejecutado después de las 06 h: gate normal, sin override, una petición/queryCost=2; datos persistidos y secreto no impreso. Handoffs `0237-an3-{events,product,qa,handoff}.md` y prueba textual durable. A amplió paths a `analytics-translators.test.ts` para corregir selección posicional obsoleta sin quitar assertions y `docs/factory/0237-an3-weather-proof.txt`. Main local autorizado después de QA; no push ni PROD.
