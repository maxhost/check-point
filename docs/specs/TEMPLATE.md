---
spec: NNNN
fecha: YYYY-MM-DD
estado: borrador | cerrada | implementada
resumen: Una linea. Es lo que se lee en el INDEX sin abrir el archivo.
disjunta: si | no
archivos: rutas que esta spec va a tocar
---

# NNNN — Titulo

> **Nada de codigo empieza sin esta spec en `cerrada`.**
>
> No es ceremonia. En tareas **imposibles o mal especificadas** los modelos frontier
> fingen exito **~50% de las veces**, y **23-35% aunque se les diga explicitamente que
> no**. En tareas resolubles y bien definidas, el reward hacking bajo a **0%**.
> La subespecificacion es el gatillo medido. Cerrar la spec saca al agente del regimen
> donde miente.
>
> Y la palanca: *"una mala linea de codigo es una mala linea de codigo. Pero una mala
> linea de un **plan** puede llevar a cientos de malas lineas."*

## Problema

Que esta mal hoy, o que falta. En terminos observables, no de solucion.

## Alcance

**Entra:**
- …

**No entra:** (explicito — es lo que evita el scope creep del agente)
- …

## Diseño

Como se resuelve. Modulos, contratos, canales IPC nuevos, types nuevos.

### Especificación técnica

Debe cerrar lo necesario para implementar sin inventar decisiones durante el código.

- Arquitectura y límites de responsabilidad.
- Modelo de datos: entidades, campos relevantes, relaciones, estados e invariantes.
- Autorización y aislamiento de datos, si aplica.
- Rutas, API/acciones, entradas, salidas y errores esperados.
- Estados de interfaz y comportamiento móvil si aplica.
- Efectos, idempotencia, concurrencia y auditoría cuando haya asignación, canje o dinero.
- Migraciones, compatibilidad y observabilidad cuando corresponda.

No usar "a definir durante la implementación" en una spec `cerrada`.

### Arquitectura de referencia

Listar los ADRs o decisiones de `docs/ARCHITECTURE.md` que esta feature consume. La spec
no decide framework, proveedor, hosting o stack: esas son decisiones transversales.

## Archivos

Lista completa de archivos a crear o tocar. **Esto es lo que decide si la spec es
disjunta y por lo tanto paralelizable.**

| Archivo | Accion |
|---|---|
| `src/…` | crear / editar |

### Disjunta?

Comparar contra los `archivos` de las otras specs abiertas en el INDEX.

- **Si** → puede correr en paralelo con las otras specs abiertas.
- **No** → serializar. Listar con cual colisiona y por que.

Regla: si dos tareas comparten un archivo, la respuesta **no** es coordinar mejor: es
serializarlas. El caso de falla canonico (16 agentes sobre un compilador de C): *"Every
agent would hit the same bug, fix that bug, and then **overwrite each other's changes**."*

Y el default correcto no es "paralelo siempre que se pueda": 930.292 PRs agenticos midieron
conflictos **30.8% con multiples agentes vs 31.2% con uno solo** — indistinguible.
*"Govern change tempo rather than headcount."* Paralelo cuando el trabajo es
**demostrablemente disjunto**, y eso lo decide esta seccion, no el orquestador en runtime.

### Archivos compartidos

Si esta spec necesita algo compartido (un type, un canal IPC, un util), **el orquestador
lo deja listo antes de que arranquen los agentes**. Los agentes solo consumen.

| Que | Quien lo deja listo | Cuando |
|---|---|---|
| … | orquestador | antes de despachar |

## Definition of Done

La feature solo está terminada cuando todos los criterios son observables y han sido
verificados por el revisor independiente. Evitar criterios como "se ve bien" o
"funciona" sin condición comprobable.

- [ ] …

## Plan de pruebas y verificación

Como se sabe que esta hecho. **Una señal que el agente no escribio.**

- [ ] Prueba unitaria: archivo/caso concreto y comportamiento esperado.
- [ ] Prueba de integración: actor, precondición, acción y resultado esperado.
- [ ] Prueba de autorización/aislamiento, si aplica.
- [ ] Prueba de regresión o caso límite relevante.
- [ ] Comandos exactos: `...`.
- [ ] Verificación manual: dispositivo, pasos y resultado visible.

No vale "deberia andar". El auto-reporte no es evidencia: en 80 casos de auto-critica los
humanos dudaron 7 veces, GPT-4 **cero**.

## Handoff requerido

El implementador y el revisor usan el formato de `docs/AGENT-WORKFLOW.md`. El revisor
debe producir un `PASS` independiente antes de marcar la spec como `implementada`.

## Abierto

Lo que no se sabe todavia. Si esta seccion tiene algo que bloquea, la spec **no** esta
cerrada.
