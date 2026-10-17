# 0237 — Contrato de implementación del ciclo de avisos

Encargo actual: actualizar la spec y preparar el plan; **no iniciar implementación, DB ni cron remoto en esta tarea documental**. Base de producto AN-1/AN-2/AN-3 en main local `5afa5294`; dev documental previo `f10a7092`. El owner aprobó el ciclo propuesto y ahora el corte recomendado de 90 días móviles/semanal. Mandan spec0237 §3 y ADR0152/0153; [adversarial](0237-inbox-lifecycle-adversarial.md) `3819d497` y propuesta histórica `5d6e265b`.

## Reserva documental

Coordinador writer único de docs/specs/0237-analiticas-inbox-y-resumenes-diarios.md, docs/adr/0152-analiticas-inbox-accionable.md (solo addendum de estas decisiones), este contrato y docs/estado/gpt.md. No INDEX/TASKS/estado Claude. Se conservan informes históricos; no reescribir el FAIL de rendimiento.

## Cierre de producto antes de lanzar código

Dos aclaraciones se consultaron al owner para que el implementador no elija caducidades ni reavisos: tarjetas informativas/del día al vencer su período (con pospuestos protegidos), y nuevo umbral temporal de la11 tras cierre. Se completará el catálogo con la respuesta; **no anunciar listo para implementar con celdas pendientes**. El resto de reglas aprobadas se documenta y revisa mientras se espera. Ante nueva contradicción material: preguntar y parar.

## Alcance de implementación futura

Una tarjeta activa/pospuesta por asunto, IDs estables, contexto y frescura por tipo, cierre que elimina texto conservando control compacto; fuentes5/9 separadas de copias diarias; reactivación de8 con consumo posterior pertinente/reposición; navegación independiente; Solucionado/Ignorar/Recordarme luego y Visto informativo; prioridad de stock≤24h; recordatorios; limpieza interna semanal90d solo de residuos cerrados/vencidos, nunca pendientes/pospuestos/control necesario; transición conservadora del legado. Se reutilizan las tablas existentes, sin nueva tabla de log, particionado o archivo de copias. No cambia dinero, mínimos de historia, fórmulas de métricas, eventos de origen, permisos, core sin switch ni corte de Stock.

Rendimiento ≤1s sigue pendiente y **no se certifica** por este cambio de ciclo. No resolver CI compartida, clima/Vercel, ciudades, «cuánto ahorraste» ni demás diferidos por extensión de scope. Sin push, deploy, lectura/migración PROD, verify global o mutaciones.

## Base y migración

La 0100 de rendimiento existe solo en rama analytics-performance (fuente b3ca9c6f, entrega058d7c48 rechazada por rendimiento) y ya está aplicada en las DB efímeras. Su hash d7be0529f9325bb3dbaa6d3517e10ad3ac9b59a677034f849c258289e5fcfe5a y las0097–99 no se reescriben. No tratar0100 como número libre, no resetear ledger ni descartar la rama/harness pendiente.

Antes del kickoff el coordinador congela base común compatible: integra en dev la base funcional de rendimiento por merge que conserve los commits, reutilizando QA de equivalencia y dejando explícito el FAIL1817,621042ms; esto no acepta rendimiento ni habilita main. La tarea documental actual no realiza ese merge de producto. Después asigna **una sola migración nueva0101** para el ciclo sobre esa base ya con0100. No generar ni aplicar0101 antes de ese paso. Inventario de ledger y selección de replay válido por wrapper; ninguna reparación de hashes ni replay global por conveniencia.

## Flujo futuro y asignación

Coordinador integra serialmente; hasta dos implementadores y QA independiente, sin subdelegación. Worktrees propios desde dev congelado y reservas factory exactas antes de código. Un solo writer de esquema/journal, HTTP escrito antes de UI. Se preservan los worktrees actuales: performance tiene harness sin commit, no se retira ni cambia su base por detrás del trabajo. El coordinador asigna/reutiliza capacidad respetando tres worktrees operativos; no force/discard.

- A, ciclo/datos/servidor: packages/db/src/schema/analytics.ts, migración0101/snapshot/journal exclusivamente; packages/domain/src/analytics/types.ts, weights.ts, cards/ y pruebas pertinentes; apps/merchant/src/server/analytics/queries/, evaluation/, ingestion/ si el cableado real lo exige. Escribe docs/factory/0237-inbox-lifecycle-data.md. No tocar kit/guardias/UI.
- B, HTTP/UI: apps/merchant/src/server/analytics/http.ts y actions.ts, app/api/analytics/inbox/, app/api/internal/analytics/cleanup/, app/backoffice/analytics/inbox.tsx y contratos UI necesarios. Usa kit existente/tuteo, sin nuevos nativos/CSS/paleta ni cambios kit/guardias. Escribe docs/factory/0237-inbox-lifecycle-ui.md. No tocar esquema/dominio/query/evaluation del writer A; consume el servicio/DTO acordado.
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
