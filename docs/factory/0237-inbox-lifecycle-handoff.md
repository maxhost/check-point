# 0237 — Ciclo del inbox y política central

**Candidato en preparación; todavía sin QA final ni integración en main local.** Este informe registra el trabajo autorizado posterior a AN-3. No reemplaza los handoffs funcionales de AN-1/AN-2/AN-3 ni certifica rendimiento.

## Contrato y comportamiento

Mandan [spec 0237](../specs/0237-analiticas-inbox-y-resumenes-diarios.md), addendum de ADR0152 y [contrato cerrado](0237-inbox-lifecycle-contract.md). Una tarjeta activa por comercio/regla/asunto, identidad estable y control mínimo contra repetición. Solucionado e Ignorar retiran contenido; Recordarme luego conserva la tarjeta y, al vencer, vuelve a competir con novedad renovada una vez, sin cupo garantizado. Navegar no cierra.

Informativas permiten Visto/Ignorar, sin posponer. El resumen diario sin marcar renueva su período sobre la misma identidad; marcado se retira y el siguiente período puede aparecer. Marketing queda como categoría propia, con tarjeta11 parqueada incluida su exposición desde contenido previo/fallback; visitas e histórico se conservan.

Contenido pendiente o pospuesto vence a los90 días por defecto, incluso sin cron. Episodio y plazo no se rejuvenecen por lectura, texto, política o posposición. Cleanup semanal acotado retira contenido; conserva solo control mínimo necesario para impedir reapariciones injustificadas. Stock crítico tiene prioridad y solo reabre con evidencia pertinente. La política única documentada vive en `packages/domain/src/analytics/policy/`, con validación, versión y simulación; no hay consola ni almacenamiento nuevo de configuración.

## Fuentes y evidencia disponible

- Base común: `65b5152e7897ab55023f36358add4df0bd49cb7f`; incorpora base funcional de rendimiento sin aceptar su FAIL. Catálogo/contrato cerrado `74125ab9`, QA documental `ae4c7592`.
- A, datos/dominio/evaluación: fuente final `d07265cd571dae727da103e359622686903979c8`, entrega documental pendiente. [Handoff A](0237-inbox-lifecycle-data.md). Unit72/72 en e677 compatible; tipos/lint focal PASS en d072. La recuperación usa la fecha del hecho aplicado identificado incluso si el umbral actual no genera candidata: solo acorta inicio/plazo, retira contenido/reminder vencido y conserva identidad/decisiones. Combinación de producto congelada `5c4746b2ab9cec2f564392a58dfd99437a6cad8a`, sin diferencias de producto frente a esa fuente más B.
- B, HTTP/UI/actions: entrega aceptada `1038c2efd4c99bf9dd8b5d8a5453084bcf76c710`. [Handoff B](0237-inbox-lifecycle-ui.md), PASS independiente de ese alcance. HTTP/actions/fallback28/28; browser de componentes390/1280 con HTTP simulado. No smoke nuevo de Next ni DB de B. Revisión combinada del coordinador en `84d771af`:28/28 sin filtros/retries, log crudo `/private/tmp/analytics-lifecycle-combination-http-84d771af.log`.
- Neon A3 inicial `b60db5c2`:21 PASS/12 FAIL/0 SKIP, log `/private/tmp/analytics-lifecycle-a3-neon-b60db5c2.log`. SQL de claim, fixture de importe insuficiente y orden del oráculo corregidos en7da, sin quitar exigencias de dinero/orden. Segunda corrida7da:32 PASS/1 FAIL/0 SKIP,180.87s, log `/private/tmp/analytics-lifecycle-a3-neon-7da87404.log`. No se presenta como PASS completo.
- Correcciones focales: e677,3 PASS/15 no seleccionados,34.11s en `/private/tmp/analytics-lifecycle-a3-focal-e6773759.log`: selector COP por identidad con período/día vendido e importe40/COP/minorUnit0, recuperación antigua calificable y nuevo ciclo12 por ingesta real con cupones/replays/cierre tardío. d072,1 PASS/9 no seleccionados,6.71s en `/private/tmp/analytics-lifecycle-a3-threshold-d07265cd.log`: recuperación antigua por debajo del umbral, builder0 pero vencimiento probado y retirada real. QA cotejó ambos logs; no se afirma una corrida única35/35 ni nuevos PASS de los casos filtrados.
- Servicios previos compatibles `fd5e6ae1`:9/9 Neon, log `/private/tmp/analytics-lifecycle-services-fd5e6ae1.log`. Bloqueos reales, límite exacto90 días, CAS/rollback, recordatorio único y fairness. No sustituyen la comprobación de los nuevos focales.
- Guía de política: receta real cambió TTL90→60 y peso stock1→1.2, inspección1 PASS/17 filtrados, expresamente sin afirmar regresión completa. `/private/tmp/analytics-lifecycle-policy-recipe.log`; configuración restaurada exactamente, SHA256 `b924d0364421be5cdf498f606a31a2ca3360ceec7f1dc69f9619f63e21e8fb5f`. QA cotejó log, backup, código y receta.

Node24.20.0; DB exclusivamente con `tools/neon-test.sh`, replay privado seleccionado y recurso serial de A. Sin verify global ni mutaciones, push, deploy, lectura/migración PROD ni nueva llamada de clima. Archivos ajenos preservados; INDEX/TASKS/estado Claude intactos.

## Migración y límites

Una0101, aplicada una vez únicamente en replay protegido: SHA256 `dfb581e66cddd45ddcad7b400de57db86f372cf4de53c57bc9d7aaf9625f191b`. Inmutable;0097–0100 preservadas. Solo tablas existentes de candidatas/controles/ejecución e índices, sin tabla de historial. Primer post tuvo interferencia entre fixtures propia documentada:7 PASS/2 FAIL/1 fase no seleccionada; recovery posterior1 PASS/1 fase no seleccionada verificó estado existente, sin afirmar replay limpio ni reescribir ledger.

Control de campaña12 no equivale a contenido notificable: tras vencer se compacta al último ciclo/cursor y solo se poda cuando ambas fronteras máximas admitidas de delay local y TTL absoluto, además de sourceproof/CAS, demuestran que no puede reemitirse. Ampliar límites estructurales exige revisar esa prueba. Rebalancear no inventa fuentes antiguas cuyo detalle nunca se conservó ni hace backfill desde módulos.

## Pendientes y cierre

Pendientes de este candidato: entrega documental A, informe QA de combinación exacta, aceptación y disposición explícita del gate de rendimiento antes de mover main. No hay defectos funcionales pendientes de los focales conocidos. Worktrees se conservan; no retirar hasta entregas aceptadas ancestros de main y sin procesos.

Rendimiento permanece **FAIL1817.621042ms frente a1000ms**, fuente `b3ca9c6f`, entrega rechazada `058d7c48`; diagnóstico `a900bde2` preservado y excluido. Ninguna nueva medición ni afirmación de mejora en este ciclo. Siguen diferidos CI compartida (rojo remoto original), invocación operativa de ciudades/cron remoto, mostrar clima/calendario y «cuánto ahorraste». Marketing agregado/cupón y reactivación de11 requieren otro encargo. La llamada real de clima de AN-3 permanece cerrada en su handoff, no se repitió.

Main local sigue `5afa5294aa844d260313cfc3673f6f69265e0254`; referencia local origin/main `db3175d237cdcf4ec41e32d70cc1c4f1e06ab2cf`. Nada publicado.
