# 0237 — Contrato AN-3

Encargo del owner: SOLO AN-3 (§7 y comunes §1–§4), ADR0152/0153, sobre dev `dfe9ea70e02f6e026d3bc57f6b8b6266edf395c5`. Coordinador, dos implementadores y QA independiente. Candidato local en dev, sin avance de main local, push, deploy, lectura o migración PROD. Sin INDEX/TASKS/estado Claude, verify global ni mutaciones. No cambiar tarjetas AN-1/AN-2 ni reabrir rendimiento, housekeeping, ciudades/cron operativos o «cuánto ahorraste». Prueba real Visual Crossing ahora sí entra, con clave leída exclusivamente en memoria y sin imprimirla.

## Worktrees y continuidad

Se reutilizan los tres worktrees propios limpios de AN-2 mediante `factory continue` desde el nuevo dev, conservando las entregas aceptadas y sus commits. Los IDs/rutas históricos siguen `analytics-an2-{events,product,qa}` bajo `/private/tmp/checkpass-an2/`; esta continuación tiene handoffs separados AN-3. No se retiran porque AN-2 no es ancestro de main local y no se fuerza cleanup ni se crea un cuarto worktree. Bases, paths y recursos registrados antes del código.

## A — eventos y contexto

Writer de vocabulario `packages/domain/src/analytics/metrics.ts`, `packages/db` (una0099 solo si necesaria;0097/0098 intactas), `server/analytics/ingestion`, `server/module-events`; módulos POS y registro servidor/manifiesto POS para publicación/traducción y acción de anulados; core `server/counter/{orders,coupon-store,grant-coupon}.ts` y nuevo soporte propio `server/counter/analytics-events.ts`; productores/snapshots de campaña en `server/marketing` solo paths reservados; contexto `server/analytics/context` y ruta interna context. Handoff `0237-an3-events.md`. No subdelegación ni cambios a corte Stock.

Tres eventos pedidos atómicos con origen, local nullable donde origen lo permite, nombres/moneda/dinero exactos e identidades capturadas. Visita corresponde a nueva acreditación `core.order`, sin bienvenida ni repetir en reintento; preservar atomicidad también en grant sin cupón (hoy CTE de un solo statement). Canje de core se identifica por cupón único, origen de `discountOrigin.sourceId`; evitar doble conteo independientemente del orden de deliveries mediante contrato genérico acordado con B. Traductores puros, sin DB/reloj. Core no importa ni nombra módulos concretos.

Hallazgos notificados al owner y pendientes de respuesta ANTES de resolver: business_customer no tiene UUID id, usa comercio+consumerId; fin de campaña no publica evento y ends_at no cambia estado. Propuesta: UUID opaco tenant en única migración y snapshots de ciclo de campaña publicados en sus escrituras para evaluar12 desde resúmenes al día siguiente, sin leer tablas de origen ni cambiar ciclo existente. Trabajo independiente continúa.

DB exclusiva inicialmente A: `/private/tmp/checkpass-0237/migration.env`, solo `tools/neon-test.sh` con Node24, serial durante pruebas/teardown. No ci.env/perf/PROD. Un caso por evento nuevo y evento adicional si se confirma, con rollback/local/corte/idempotencia y deduplicación de canjes. No leer/exportar DATABASE_URL del checkout principal.

Prueba real clima: extraer solo VISUAL_CROSSING_API_KEY de `apps/merchant/.env.local` principal a memoria del proceso de prueba; no copiar env ni imprimir URL con clave, headers, cuerpo de errores o credenciales. Llamar ruta interna real autenticada sobre DB aislada, persistir forecast/observed de Cuenca y comprobar datos/respuesta del proveedor/cuota; no mostrar contexto en merchant. Detener e informar si proveedor falla, sin bucles hasta verde ni plan pago. Respetar hora real y registrar cómo se ejecutó el gate de las06h, sin fabricar fetched_at futuro.

## B — producto y consultas

Writer dominio `packages/domain/src/analytics` salvo metrics.ts, servidor `{evaluation,queries,actions,http}`, UI `app/backoffice/analytics` y destino cliente necesario en `app/backoffice/customers`, servidor/ruta cliente acotada si se necesita (solicitar paths antes). Handoff `0237-an3-product.md`. No subdelegación. Aporta tarjetas10/11/12, histórico clientes/promos y acciones genéricas, sin cambiar tarjetas previas ni kit/guardias/CSS. Leer impeccable para UI y copy tuteo.

Tarjeta10: mínimo mes,7d por local >max(3,media+2desvíos8semanas previas), dinero y acción anulados declarada por POS.11:≥4visitas, última90d, distancia>2medianas y≥mediana+7; gasto promedio×visitas perdidas del mes. H5: Marketing actual selecciona audiencias de campañas, no se encontró envío manual a un cliente; confirmar lectura final y usar «Ver cliente» si se ratifica, informarlo.12: día después del fin/cambioended, descuentos y ventas asociadas sin atribución causal. No leer campañas/órdenes/canjes desde Analíticas; acordar hechos/resúmenes genéricos con A antes de código. Pesos/novedad/tope comunes; coeficientes no fijados en§7 se explicitan en handoff sin cambiar producto.

Métricas customer/campaign, local conservado en ventanas, dinero exacto y cohortes por cliente sin perder intervalos; no inferir cuatro visitas de cuatro días si hubo varias el mismo día sin definir su tratamiento por contrato. Histórico agrega bloques HTTP conservando AN-1/AN-2, períodos/local/tenant. Tests unitarios por bordes, focal Neon consultas/acciones tras GO de DB coordinador, browser proporcional.

## QA — independiente

Writer solo `docs/factory/0237-an3-qa.md`, artefactos externos si necesarios. Leer fuentes/spec/contrato, revisar entregas y combinación congelada, reutilizar evidencia compatible y reproducir señal decisiva. No implementar producto ni repetir global/benchmark. Verificar3eventos atómicos y cualquier snapshot adicional confirmado; deduplicación POS/canje ambas órdenes, cortes, tenant/local,10/11/12 bordes, acciones/H5, histórico, contexto real persistido invisible y secreto nunca impreso. Fallos/reintentos/skips no equivalen a PASS. Informe con SHAs/entorno/comandos/fallos/migración/cuota real del clima.
