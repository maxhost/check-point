# Protocolo de trabajo con agentes

Este protocolo se usa **después** de que una feature haya sido conversada y su spec esté en estado `cerrada`. No sustituye la conversación de producto ni permite empezar código con una spec incompleta.

## Roles

### 1. Orquestador

Es responsable de la dirección, no de declarar éxito por intuición.

- Lee `docs/INDEX.md`, `docs/TASKS.md`, `docs/ARCHITECTURE.md`, la spec cerrada, ADRs relacionados y el estado/diff del repositorio.
- Comprueba que la spec tenga diseño técnico, Definition of Done (DoD), comandos de prueba y archivos previstos.
- Divide o serializa el trabajo según la sección **Disjunta?** de la spec.
- Entrega al agente implementador un encargo acotado: número de spec, objetivo, archivos permitidos, contratos, DoD y comandos exigidos.
- Después de implementación, entrega al revisor la spec, el diff y la evidencia del implementador.
- Marca la spec `implementada` y actualiza tareas solo tras un PASS independiente documentado.

### 2. Implementador

Es responsable de modificar código, exclusivamente dentro de una spec cerrada.

- Lee la spec completa y los ADRs que ésta referencia antes de editar.
- No amplía alcance ni cambia decisiones de producto; reporta bloqueos al orquestador.
- Implementa pruebas automatizadas previstas antes o junto con el código.
- Ejecuta los comandos de verificación definidos y registra salida, comandos y límites conocidos en su handoff.
- No marca una spec como implementada.

### 3. Revisor independiente

Es responsable de buscar incumplimientos, no de asumir que el código funciona.

- Lee la spec cerrada, ADRs relacionados, `git diff` y los archivos modificados.
- Ejecuta por su cuenta los comandos de test, lint, typecheck y build indicados por la spec.
- Comprueba cada ítem del DoD contra evidencia observable y revisa seguridad/autorización, aislamiento por negocio y regresiones pertinentes.
- Devuelve `PASS` o `FAIL`, con una lista concreta de evidencia y hallazgos. No modifica el código salvo que el orquestador abra una spec de corrección separada.

## Secuencia obligatoria

```text
Conversación de feature
  -> ADR si hay una decisión de diseño nueva
  -> spec técnica en borrador
  -> aprobación y estado cerrada
  -> orquestador orienta
  -> implementador cambia código y entrega evidencia
  -> revisor independiente ejecuta pruebas y emite PASS/FAIL
  -> orquestador actualiza spec, índice y tareas
```

Si el revisor responde `FAIL`, vuelve al implementador con hallazgos. No se sustituye un FAIL por auto-revisión del mismo agente ni se marca la feature como terminada.

## Handoff mínimo

Todo implementador y revisor entrega este bloque:

```md
## Handoff — Spec NNNN

Estado: implementado | bloqueado | PASS | FAIL
Archivos tocados/revisados:
- ...

Comandos ejecutados y resultado:
- `...` — salida/resumen verificable

DoD:
- [x] / [ ] criterio y evidencia

Hallazgos, límites o bloqueos:
- ...
```

## Reglas de independencia y seguridad

- Implementador y revisor no pueden ser el mismo agente/turno de trabajo.
- El revisor parte de la spec y del diff, no del resumen del implementador.
- Todo cambio de alcance vuelve a `borrador`; no se arregla silenciosamente en código.
- Un test existente no se edita ni elimina para obtener verde sin una decisión explícita y una spec/ADR que lo justifique.
- Ninguna prueba que requiera secretos muestra archivos `.env` ni credenciales en el handoff.
