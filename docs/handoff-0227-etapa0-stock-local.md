# Handoff — implementación de etapa 0, spec 0227

## Punto de arranque y autorización

Owner autorizó implementar después de cerrar la spec. Pidió este handoff para hacer clear antes de iniciar. **No hay implementadores escribiendo código todavía.** Al retomar, continuar sin pedir otra aprobación para trabajo local. Push y cada migración de DB de producción requieren autorización explícita nueva. El owner configura cron-job.org; no configurarlo por él.

Spec cerrada: [0227](specs/0227-stock-por-local-y-consumo-por-receta.md). ADR aceptada: [0145](adr/0145-consumo-stock-al-cobrar.md). Entrega documental del agente: `2e7a01915905378e14a586095ffec69297c6b2bf`; corrección posterior solo aclara atribución de parámetros técnicos. Base de código publicada: `54dbff34`. Usar el HEAD real de dev tras este handoff, no la base vieja de fotos bca17ec.

Los documentos se escribieron sin INDEX/TASKS/estado, conforme encargo original de solo spec. Al iniciar la implementación, el coordinador debe reservar sus filas de INDEX mediante commit local antes del código; revalidar números existentes y la reserva local stock-spec. No hacer push para reservar. No crear otra spec por cada paso rutinario.

## Producción y entorno actual

`origin/main` publicado en `54dbff34`; cuatro deploys Vercel completados. Pre-push EXIT0: tipos/lint/guardia/formato, unit2726, cuatro buildsTurbopack, browser390PASS62skip, Neon3674PASS282skip con cinco suites DDL aisladas. Owner aplicó personalmente0079→0080→0081. Verificación READ ONLY: hashes/journal/esquema correctos, cero pendingAIhuérfanos, huella local==PROD19categorías, Merchant/Consumer health200. No repetir esas migraciones ni publicar cambios de etapa0 ahora. `tools/local-db/huellas-prod.txt` actualizado con lectura real posterior.

Túnel local queda activo: dev-business.checkpass.club→3201 y dev-my.checkpass.club→3200, sesión ejecutora36747, logs .dev-local/. DB localDocker con datos ficticios y82migraciones. Root estuvo sirviendo código54dbff34; los commits de este cierre agregan documentos/huella, sin cambiar producto. No detener procesos ajenos ni copiar .envPROD a workers. Artefactos/skills/assets ajenos sin seguimiento deben preservarse.

## Decisiones cerradas

- Insumos/unidad y recetas por comercio; movimientos, saldos y último costo por insumo+local. Sin promedio ponderado ni costo congelado/IVA/equilibrio/ingeniería de menú.
- Un local activo: automático y sin selector. Varios: selector Stock/Recetas; default primer activo por created_at,id, conservación de elección durante pantalla/sesión. Contratos locales usan permiso del módulo, no exigen permiso locations.
- Receta YA guarda cantidades por unidad: consumo=cantidad guardada×unidades vendidas. No dividir otra vez ni añadir rendimiento persistido.
- Consumir al closed en local de orden; negativo permitido; sin producto/receta o módulos apagados no genera consumo. Sin reconstrucción histórica al reactivar.
- **Fallo de consumo jamás impide registrar venta, closed ni liberar mesa.** POS no muestra Stock. Outbox y referencias genéricas de revisiones inmutables se capturan en el commit del cierre; expansión/aplicación Stock después. Indisponibilidad del propio commit de venta no se presenta como éxito ficticio.
- Conteo drena pendientes anteriores y revalida corte; si falla,409 consumption_pending/count_changed bloquea SOLO ese ajuste. Ningún lockPOS durante drenaje. Probar concurrencia del corte, no asumir que un timestamp basta.
- Local archivado conserva saldo/historial y recibe consumo de órdenes abiertas; compras bloqueadas, conteos PERMITIDOS. Staff con permiso actual opera todos los locales del comercio.
- Backfill hacia único activo; multi requiere mapaowner, sin destino no inventarlo. Owner informa que hoy no tiene comercios multi-local; medir preflight al ejecutar. POS selector multi-local YA EXISTE: conservarlo; servidor garantiza local/autoúnico y resuelve históricos ambiguos antes NOTNULL.
- Reintento inmediato/próximo cobro/abrirStock y cron propio separado wallet:0/30min,24h, CRON_SECRET. Vacío sale con consulta indexada barata; puede despertar Neon. Batch50/20s/backoff son diseño técnico, no benchmarks ni permisos nuevos.

## Flujo de implementación

Coordinador + dos implementadores que también corrigen + QA independiente. Sin subdelegación ni reviewer adicional por defecto. Max3worktrees operativos; retirar el árbol documental al incorporarlo a main local antes de preparar workers. `tools/factory.ts` mantiene reservas/scopes/SHA y limpieza. Identificar rama/worktree, base exacta, puertos y DB de prueba por tarea. Reservar CI durante migraciones/tests/teardown; DDL sin suites concurrentes.

1. Primer implementador prepara fundamento compartido: esquema/migraciones/backfill, contrato genérico de versiones/eventos/delivery/retry, primitive Stock applyConsumption y contratos locales. Es el **único writer de packages/db, journal/snapshots, core genérico y server-registry**. Asignar explícitamente estos paths; no generar dos journals a la vez.
2. Congelar interfaces mínimas y su commit de base antes de código dependiente. Dos tareas: A Stock backend por local/ledger/conteos/costo y fundamento común; B integración POS/Recetas, revisión inmutable+puntero atómico, consumidor y UI mínima Stock/Recetas. B NO edita esquema/registro compartidos; pide cambios a A/coordinador. Puede preparar UI contra contratos cerrados mientras A termina backend. No fingir independencia de módulos que comparten transacción/modelo.
3. QA independiente revisa aceptación e integración sobre SHAs congelados. No repetir todos los comandos del autor. Fallos vuelven al implementador de scope; otra revisión invalida solo checks afectados. Root integra serialmente en dev; main local solo con evidencia pertinente.

Contrato central: sourceLineId estable/productId/quantity/local/closedAt/user; eventVersion1 y resourceVersions(providerId,slot,versionId), elegibilidad congelada. Recipes requiereStock, no importaPOS; IDs sin FK módulo→POS prohibida. Core no nombra/importa tareas de módulos. Stock movements únicos por business+order+line+item; snapshot inmutable, aplicación toda/nada+delivery en mismaTX. Guardar receta/revisión/puntero genérico atómicamente. Ver detalles completos en spec/ADR antes de programar.

Rollout especificado expand→puente temporal→backfill validado→nuevo código/activación→contract tras retirar writers viejos. Consumo nuevo inicialmente apagado hasta validación; ninguna reconstrucción retroactiva. Generar SQL por fases y medir compatibilidad/rollback; no aplicar nada a PROD con la autorización de implementación local.

## Comprobaciones proporcionales

Usar casos focales de spec: receta normalizada desde rendimiento≠1, cierre/retry/concurrencia único, negativo, skip receta/módulos, fallo de lectura de revisión/aplicación con mesa libre, conteo con pendientes/concurrencia, backfill1/multi/sindatos, aislamiento comercio/local y permisos. UI: flujo decisivo de selector/payload; QA visualowner. Tipos/lint/guardia pertinentes. No verify global/mutaciones/browser+unit+Neon por cada paso. DB tests SOLO wrapperCI/local protegida, jamás DATABASE_URLPROD. Gate de publicación vigente al preparar push autorizado, no requisito automático de cada entrega.

## Retoma tras clear

Leer este handoff, bloque vigente de docs/estado/gpt.md, TRABAJO-EN-PARALELO, AGENT-WORKFLOW, VERIFICACION y spec/ADR. Confirmar refs/árbol/procesos y registro local; preservar ajenos. Reservar filas INDEX antes de código, repartir writers/contratos y lanzar flujo. No reabrir preguntas respondidas ni pedir permiso para operaciones locales autorizadas. Si aparece decisión nueva real de producto, explicarla concretamente; no elevar detalles rutinarios de ingeniería al owner.
