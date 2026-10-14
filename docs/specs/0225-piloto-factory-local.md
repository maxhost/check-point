---
spec: 0225
fecha: 2026-10-13
estado: cerrada
resumen: Implementar el piloto local aprobado en ADR0144: instrucciones comunes, roles, preparacion de worktrees sin envPROD, reservas/entregas y cleanup comprobable; pruebas focales y gate final vigente. Dos tareas de foto0226 y QAindependiente, sin push/PROD.
disjunta: no; herramientas/documentos compartidos preparados por el coordinador antes de despachar workers
archivos: AGENTS.md, CLAUDE.md, docs/{TRABAJO-EN-PARALELO,AGENT-WORKFLOW,VERIFICACION,MODULOS,design-system,INDEX}.md, docs/specs/TEMPLATE*.md, .claude/{agents,skills,hooks}/, tools/{factory*,worktree-new.sh,verify.ts,zone-audit.ts}, .gitignore
---

# 0225 — Piloto factory local

## Problema

Las reglas actuales requieren carpeta dev compartida, GPT soloUI y subagentes soloL3. El Stop hook ejecuta pruebas globales por respuesta y el preparador enlaza envPROD. No permiten el flujo aprobado.

## Alcance y diseño

ADR0144 aprobado por owner. Devbca17ec base; main local recibe candidato trasQA; ningunpush. Un coordinador, dos writers en worktrees aislados yQAindependiente. Registro local recuperable de tareas/reservas/entregas; exclusión atomica de ediciones del registro, scope/refs y limite de worktrees. No scheduler distribuido/controllerSDK/Symphony.

Preparacion con SHA/destino explicitos, dependencias propias con lockfile fijo y env de pruebas opcional sin secretos productivos. Worker no usa env compartido ni cambios de rama root. Cleanup exige checkout limpio, entrega ancestro de main local y sin procesos/pendientes. Solo coordinador reserva/integra/retira; handshake de cierreQA documentado. Preservar archivos/artefactos ajenos.

Verificacion focal por tarea; scope de modulos reconocido por selector. Stop considera HEAD y ejecuta pisoestatico del alcance, sin unitglobal por cada respuesta. Gate final vigente se conserva; no inventar reutilizacion segura del pre-push sin pruebas de identidad. Role/skills/templates enlazan una politica comun, sin mutacion/revisor universal.

## Definition of Done

- [ ] ReglaGPT UI/backend y dev→mainlocal→push explicito coherentes en entradas/protocolos/templates/roles/modulos.
- [ ] Worktrees con base fija/node_modules propio y sin enlace general de envPROD; reservas excluyen paths/recursos solapados.
- [ ] Identidad de tarea, version de entrega y evidence/handoff preservadas; limpieza rechaza tarea pendiente, worktree sucio o entrega fuera de main.
- [ ] Casos decisivos de registro/scope/cleanup y selector pasan; formato/lint herramientas nuevas y checks de paquete pertinentes.
- [ ] Dos tareas0226 ejecutadas en paralelo conQAindependiente e integradas; main local recibe solo candidato verificado, sin push/PROD.
- [ ] Worktrees del piloto retirados tras incorporacion; estado y límites reales documentados.

## Pruebas

Vitesttools focal: reserva duplicada/solapada, escritura fuera de scope, entrega/cleanupinvalida. Preparacion real de los dos worktrees y comprobacion de dependencias/artefactos propios. QAindependiente observa harness y feature; no nuevas pruebas de dineroDB por una reserva de paths. Verify final una vez sobre candidato combinado porque contiene el backlog transversal anterior; no uno por worker. No se repiten mutaciones/capturas por ceremonia.

## Handoff y abierto

Handoff con SHAorigen/destino, comandos/resultados y pendientes. Nada bloqueante de producto. La prueba conIAreal anterior sigue declarada pendiente hasta ejecutarse o informarse con su limite; no se llamaPASS porHTTPsimulado.
