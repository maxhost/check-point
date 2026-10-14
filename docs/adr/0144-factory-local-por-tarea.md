---
adr: 0144
fecha: 2026-10-13
estado: aceptada
resumen: Owner autoriza piloto con dos implementadores que corrigen, coordinador y QA independiente, GPT UI/backend y worktrees temporales. Dev es base/integracion; main local recibe lo listo; cada push a main remoto/PROD exige autorizacion explicita. Worktree limpio se elimina solo despues de preservar su entrega en main local, sin procesos ni pendientes.
---

# 0144 — Factory local por tarea

Decision del owner en esta sesion: usar dev `bca17ec` como base, main local como lo listo para push y main remoto como produccion. **No hace falta publicar el lote anterior para comenzar el piloto.** Sustituye las clausulas incompatibles de ADR0071/0113/0114/0128/0129 sobre carpeta/rama unica, zonas UI/backend, subagentes soloL3 y gates completos/revisor por cada feature.

- Coordinador integra/reserva; dos implementadores implementan y corrigen; QA es otro agente en contexto independiente. Workers no delegan, publican ni cambian refs de integracion.
- GPT y Claude pueden hacer UI/backend del encargo. Kit/guardias/migraciones/tooling necesitan una asignacion explicita; el owner autoriza aqui los ajustes del harness de spec0225, sin operacionesPROD.
- Cada writer usa worktree/ref local propio desde base comprometida; QA usa un checkout de candidato congelado. Maximo tres worktrees operativos del piloto (dos workers yQA), no uno por cada mensaje. Dependencias/contratos/puertos/DB/esquema se reservan y serializan cuando corresponde.
- Entrega con commits exactos libera al worker para otra tarea preparada, preservando el checkout/refs anteriores hasta cerrar QA. No se elimina ni reutiliza para escribir la misma revision mientrasQA la verifica.
- Dev mantiene integracion. Tras QA del candidato, main local avanza al candidato listo; origin/main permanece intacto. No afirmar que el main local adelantado ya esta publicado. **Cada publicacion requiere autorizacion explicita del owner para ese candidato.**
- Tras incorporar la entrega en main local: comprobar ancestro, scope limpio, procesos terminados y ausencia de pendientes; retirar worktree y su rama ya integrada sin force. El owner autoriza esa limpieza; no descartar trabajo incompleto o ajeno. Evidencia/handoff permanecen en el repo; recursos nuevos solo si hacen falta.
- L0/L1 no requieren spec/ADR/tests nuevos por ceremonia; L2 spec chica y pruebas focales; L3 cobertura amplia cuando el riesgo/impacto lo exige. PisoL2 para cambios de comportamiento de dinero/auth/tenant/migracionesPROD. Paralelismo depende de independencia, no del nivel.
- QA verifica aceptacion y combinacion; reutiliza evidencia de entradas compatibles. No repetir todos los comandos del autor/coordinador. Mutaciones y revisor especialista solo por riesgo/duda concreta. No convertir retries/skips o presupuesto agotado enPASS.
- Durante este piloto el gate de release vigente se conserva: un verify sobre el candidato final, pre-push sin bypass. Reutilizacion automatica solo para evidencia completa e identidad comprobada; no esconder la duplicacion hasta que el mecanismo este validado.

Reglas operativas en TRABAJO-EN-PARALELO, AGENT-WORKFLOW y VERIFICACION. No se instala Symphony ni un servicio permanente en este piloto. Arquitectura de modulos, kit, antiPROD y contratos permanecen obligatorios.
