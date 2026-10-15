# Handoff — próximas features tras clear

## Punto de partida

0228 y 0229 terminadas, QA independiente de entrega/combinación PASS e integración autorizada en main local. Producto verificado `07393f2c`; candidato con informe `9b7b323f`; cierre documental `120ecbc968468db489ea0d76295de7cdbdb058ce`. [Informe QA](factory/0228-0229-qa.md), [estado vigente GPT](estado/gpt.md), [fichas anteriores](factory/0228-0229-contract.md). No retomar el handoff antiguo como una implementación pendiente.

Antes de este handoff, main y dev apuntan a120ecbc9. Este cierre sólo añade documentación a dev; usar su HEAD real como base y comprobar refs al volver. No hubo push, deploy ni migración de producción. Las tres reservas anteriores están retired y sus worktrees/ramas operativas fueron retirados con factory; sólo queda el checkout principal. Se preservan ref candidate y backup/0229-brand-before-foundation.

El owner quiere nuevas features con el mismo proceso; **todavía no indicó cuáles**. Recibir ese encargo y sus decisiones antes de implementar. No inventar una feature ni reabrir decisiones de0228/0229.

## Entornos y migración local posterior

Owner aclaró que dev-business.checkpass.club corresponde al entorno local por túnel y Vercel usa producción. Al abrir Recetas, GETstock/items fallaba503 con PostgreSQL42703: el código nuevo consultaba weighted_average_unit_cost y la base local sólo tenía0083. CI sí había recibido0084 para pruebas; eso no actualizaba local ni Vercel.

Owner pidió aplicar0084 **a local**. Ejecutado con Node24 y el migrador existente db:local:migrate, limitado a db.localtest.me; no reset, seed adicional ni cambio de código. Verificación posterior y al preparar este handoff: cinco columnas presentes y último hash de journal `8bf7a3919dc381ba9f57ffdf63c8fbf4f61035099307fc1971b275c4507b6dc5`, igual al SQL0084. El migrador informó85 entradas de journal. No se afirmó un smoke autenticado del editor de Recetas sólo por verificar SQL.

Al entregar una feature con migración, comprobar también que la base usada por la app local tiene el esquema del código. QA en una DB aislada no sustituye esa alineación. Las operaciones PROD siguen requiriendo autorización explícita por caso. Conservar EXPAND0227 y flag de consumo; no aplicar contract ni seed de rollout por inferencia.

## Proceso para la próxima feature

Leer AGENTS.md, docs/TRABAJO-EN-PARALELO.md, docs/AGENT-WORKFLOW.md, docs/VERIFICACION.md y sólo el bloque vigente de docs/estado/gpt.md; contexto funcional pertinente, Node24 antes de comandos.

- Coordinador + **dos implementadores que también corrigen + QA independiente**. Sin subdelegación/reviewers extra por defecto; máximo tres worktrees operativos.
- Dev es base/integración. Preparar spec/contrato cerrado cuando corresponda y fichas con base exacta, paths, checks y recursos; reservar índices por commit local y recursos mediante tools/factory.ts antes de código.
- Repartir tareas independientes; un writer para esquema/journal/exports compartidos y DB reservada también durante teardown. Sin merges textuales de snapshots. UI modular en modules/<id>/ui, kit/copy y contratos HTTP existentes; no alterar guardias para evitar rojos.
- Checks proporcionales, entrega por SHA, QA independiente y luego combinación exacta. Reutilizar evidencia compatible; no PASS por skips/retries ni verify global por ceremonia. Mantener el host despierto durante pruebas de presupuesto; la suspensión contaminó diagnósticos anteriores.
- DB tests según AGENTS y wrapper protegido tools/neon-test.sh, sin credenciales PROD ni confundir CI de pruebas con DB de la aplicación. Antes de operaciones, identificar destino local/CI/PROD y respetar el alcance explícito del owner.
- Avanzar automáticamente hasta candidato concreto con QA completo PASS; pedir autorización final de merge a main local. Push/deploy/migración PROD nunca implícitos. Tras merge autorizado, factory integrate/cleanup sin force y sin tocar trabajo ajeno.

## Pendientes y trabajo ajeno

Credencial CI expuesta accidentalmente por contexto del driver durante diagnóstico: rotación pendiente. Es la contraseña compartida por NEON_CI_DATABASE_URL y NEON_CI_DATABASE_URL_UNPOOLED; la credencial consumer es distinta. No imprimir valores, prefijos ni objetos de error del driver. Logs redactados/restringidos; fix de listener idle ya integrado y probado.

Al preparar este handoff hay modificaciones ajenas en docs/estado/claude.md y docs/estado/claude-historico.md y artefactos/skills no versionados previos. No editarlos, stagearlos, descartarlos ni incluirlos en el cierre GPT. Reconciliar estado real al retomar.

## Prompt de retoma

«Lee docs/handoff-proximas-features.md y el bloque vigente de docs/estado/gpt.md. Retomamos el proceso con dos implementadores, coordinación y QA independiente. Las nuevas features son: [descripción del owner]. Prepara contratos/reservas y continúa hasta QA completo PASS; pide autorización para main local al final. Sin push ni operaciones PROD.»
