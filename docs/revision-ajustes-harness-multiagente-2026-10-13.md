> Investigación/plan previo. El owner adoptó el piloto en ADR0144; las reglas vigentes están en TRABAJO-EN-PARALELO, AGENT-WORKFLOW y VERIFICACION. Este documento conserva el razonamiento previo y no impone gates adicionales.

# Revisión de los ajustes del harness para múltiples features

Fecha: 2026-10-13. Estado: **propuesta para revisión del owner; no aprobada ni aplicada**.

**Plan preparado posteriormente:** [piloto con dos features, coordinador y QA](plan-piloto-multiagente-2026-10-13.md). Su ejecución espera el cierre de Claude y la integración/sincronización del trabajo anterior; incluye contraste con documentación oficial de OpenAI.

Completa y corrige [el diseño de orquestación](diseno-orquestacion-paralela-2026-10-13.md). El owner aclara que, **a partir de la aprobación del cambio**, GPT trabajará tanto en UI como en backend. Esa futura capacidad no cambia los permisos vigentes durante esta investigación. Tampoco implica quitarle backend a Claude o conceder automáticamente acceso al kit, guardias, tooling o producción.

## Corrección principal de la propuesta anterior

La organización propuesta es por **feature y encargo**, con agentes que pueden implementar las capas necesarias. GPT ya no quedaría obligado a pedir a Claude cada endpoint. El coordinador asigna el alcance completo, contratos, recursos y criterios de aceptación. Un especialista entra solo cuando lo necesita el cambio.

Hay que distinguir:

- **Capacidad:** GPT puede implementar UI y backend.
- **Responsabilidad:** un agente es responsable de una feature, otro de QA y uno de integrar el lote.
- **Exclusión:** un recurso compartido tiene un escritor a la vez, cualquiera que sea el modelo autorizado.
- **Permiso de producción:** escribir backend no autoriza migrar, publicar ni operar datos productivos.

Propongo mantener kit/guardias/tooling como recursos de mantenimiento explícito y asignación separada. Las migraciones forman parte del trabajo backend, pero su generación e incorporación deben serializarse. Estas reglas son decisiones propuestas, no autorizaciones concedidas aquí.

## Huecos que faltaban o estaban insuficientemente resueltos

### 1. Varias sesiones no pueden crear varios coordinadores del mismo lote

Había hablado de un coordinador sin definir quién lo elige y cómo evita otro coordinador simultáneo. Cada lote debe tener ID, coordinador activo, base y features; todas las sesiones que trabajen en ese repo consultan su reserva. Una sesión nueva puede unirse al lote o hacer una tarea disjunta, pero no asumir silenciosamente el control de integración.

En el piloto basta un registro común y un único escritor. Al automatizar, la adquisición de coordinación debe ser atómica. Un agente vencido no puede seguir integrando después de transferir su responsabilidad. La caída del coordinador pausa la incorporación de entregas; los implementadores pueden seguir sus encargos ya asignados.

### 2. Una feature debe estar suficientemente definida sin bloquearse por decisiones menores

La ficha necesita objetivo observable, alcance, criterios de aceptación, dependencias, contrato cuando corresponda y comandos pertinentes. El agente puede resolver detalles rutinarios dentro de ese alcance. Cambios de comportamiento acordado o contratos incompatibles vuelven al coordinador y, si hay una decisión de producto abierta, al owner.

No exigir una lista perfecta de todos los archivos antes de explorar. Se asignan paths acotados y el agente propone ampliar la reserva cuando descubre un consumidor relevante. El coordinador comprueba colisiones antes de habilitar esa ampliación. Un arreglo de implementación dentro del alcance no necesita una spec nueva; una ampliación material sí modifica el acuerdo correspondiente.

### 3. La base de release puede ser distinta de HEAD de dev

El diseño anterior conservaba `dev` como integración, pero no resolvía completamente el caso A+B sin C. Si `dev` ya incluye C, `merge --ff-only dev` publica C también. La base de release debe identificar los commits ya publicados/aprobados y las dependencias necesarias, no ser automáticamente el HEAD local.

El coordinador prepara una ref de candidato con las features seleccionadas y dependencias verificadas. `dev` conserva su papel de integración general. Main recibe el candidato elegido, con fast-forward cuando la historia lo permita; no se mueve a dev por rutina. Si hay que reconstruir una selección desde la base de release, esa combinación recibe su propia validación.

Una base también puede contener cambios anteriores todavía no aprobados. Debe enumerarlos y decidir cuáles son prerrequisitos antes de lanzar features nuevas. No basta que la base esté comprometida en Git.

### 4. Contratos y cambios de esquema requieren una secuencia propia

Los contratos siguen siendo necesarios aunque el mismo agente haga UI/backend: coordinan consumidores, fixtures y otras features. Un cambio incompatible debe notificar y bloquear las entregas dependientes. Las dependencias del lote incluyen contratos, permisos, dependencias de paquetes, esquema y recursos comunes, además de paths.

Dos agentes generando Drizzle desde la misma base pueden producir journals/snapshots incompatibles aunque sus tablas sean distintas. Propongo: cada agente entrega su intención/cambio de esquema; el responsable asignado incorpora y genera las migraciones en orden sobre la base integrada. El siguiente cambio se prepara sobre esa secuencia. Nunca combinar journals o SQL por un merge textual a ciegas.

Para tests sobre una DB compartida, el lock protege **preparación/migración, ejecución y limpieza**. No cubre solo el comando de test. El esquema y datos de prueba deben ser compatibles con el candidato. Si no lo son, se necesita una DB aislada/recreada para ese candidato; serializar dos procesos no restaura por sí solo el esquema anterior.

### 5. La preparación actual de worktrees contradice el aislamiento propuesto

`tools/worktree-new.sh` crea dependencias propias, pero enlaza `.env`, `.env.*`, `apps/*/.env.local` y `packages/*/.env.prod.local` del checkout de origen. Además, usa la base actual implícita y crea el destino en una carpeta hermana del repo.

Para el flujo nuevo necesita base explícita, ruta admitida por el sandbox, instalación con lockfile fijo, configuración de prueba seleccionada y reserva de puertos. No debe enlazar de forma general secretos/entornos productivos. Un permiso denegado al crear el destino debe resolverse por autorización o una ubicación permitida, no por evasión del sandbox.

No hace falta construir otro preparador desde cero. Se ajusta el existente y se comprueba que cada worktree tiene sus artefactos y dependencias. Los servicios externos que el backend puede invocar durante pruebas usan fakes/configuración de test salvo una comprobación real autorizada.

### 6. Integración y QA deben trabajar con versiones congeladas

Cada entrega tiene revisión propia y commits exactos. El coordinador incorpora entregas en orden y registra SHAs origen/destino. Si corrige un conflicto o una interacción, el arreglo queda en un commit y el responsable recibe la nueva base; no puede devolver después una revisión que reintroduzca el código anterior.

QA puede revisar criterios y preparar pruebas mientras se implementa. Puede validar entregas terminadas sin esperar las tres features. La validación de combinación ocurre sobre un candidato congelado. Agregar una feature o corregir código produce otro candidato; no editar detrás de QA mientras ejecuta comandos.

QA tampoco modifica el producto que está certificando. Una prueba que agrega cambia las entradas de verificación y se incorpora de forma explícita. Después de un arreglo, QA verifica el comportamiento afectado; no se resuelve el FAIL cambiando criterios de aceptación o relajando aserciones.

### 7. Faltaba separar errores de producto, entorno y pruebas

Un rojo debe tener reproducción y categoría: producto, interacción, entorno o test. Se corrige la causa y se repite el caso pertinente. Un reintento o un skip no convierten un rojo en evidencia válida. Un defecto del runner no necesita rediseñar la feature ni repetir toda la suite.

Una prueba obsoleta puede actualizarse cuando el comportamiento aprobado cambió, dejando el motivo y manteniendo su cobertura útil. Esto debe distinguirse de quitar protección para obtener verde. Un bloqueo crítico sin resolver impide publicar el candidato; tareas independientes pueden continuar en sus worktrees.

### 8. La política de evidencia sigue forzando trabajo duplicado

`CLAUDE.md` y la skill de verificación exigen reproducir hallazgos ajenos. Para coordinar con agilidad, la regla debe diferenciar **validar evidencia** de **repetir todos los comandos**.

El coordinador comprueba candidato, alcance, comando, entorno y resultado; QA comprueba aceptación e interacciones. Se reproduce una señal decisiva si hay duda, contradicción o riesgo que no quedó cubierto. No se repite un gate íntegro para que tres roles puedan decir que lo corrieron.

El hook Stop de Claude hoy ejecuta tipos, lint y todos los unitarios. Su huella no incluye HEAD, por lo que un checkout limpio distinto puede reutilizar el mismo estado vacío. El pre-push verifica el working tree y no el SHA recibido. Ambos requieren corrección real; cambiar sus descripciones no resuelve el problema.

### 9. Hay reglas de propiedad fuera de AGENTS y CLAUDE

La división GPT/Claude también está en `docs/MODULOS.md`, ADRs 0114/0123/0139, `docs/design-system.md` y `tools/zone-audit.ts`. Este último reconoce el trailer de Claude para detectar cambios del kit. El backend fullstack debe reflejarse en todos los puntos normativos aplicables sin falsificar trailers ni ampliar permisos por interpretación.

La arquitectura de módulos y las guardias de UI siguen intactas. Cambia la asignación de responsables, no la obligación de respetar módulos, aislamiento de negocios, DTOs o kit.

### 10. Estado, cambios de prioridad y cancelación necesitan reglas cortas

La unidad de estado de un worker es la tarea, no `gpt.md` o `claude.md`. Solo el coordinador mantiene el estado del lote y actualiza índices comunes. Un ID por tarea, revisión y handoff permite recuperar el trabajo sin exigir un commit documental después de cada mensaje.

El owner puede cambiar prioridad o cancelar una feature. El coordinador detiene trabajo dependiente, preserva los commits y libera recursos cuando los procesos terminaron. No descarta automáticamente cambios ajenos. Si cancela una feature ya integrada, reconstruye o corrige el candidato y verifica lo afectado; no supone que un revert aislado deja sanas sus dependencias.

Una entrega contiene lo necesario para continuar —commits, decisiones, evidencia, bloqueos— y no toda la conversación. La regla de `/clear` de Claude no debe convertirse en un requisito universal para cada devolución de un subagente. El registro en disco permite reanudar aunque cambie el thread.

### 11. Producción incluye despliegues parciales y compatibilidad de datos

El push puede afectar varias apps. El resultado debe indicar qué despliegues corresponden al candidato y cuáles están listos; un READY aislado no declara todo el lote publicado. Si cambia el esquema, se necesita compatibilidad con el código anterior y secuencia de migración/deploy.

Se conserva aprobación del owner para publicar y operar producción. Un permiso para publicar A+B no incluye añadir C después. Un fallo después del push requiere reconciliar commits, despliegues y datos antes de reintentar; revertir código no revierte una migración.

El CI actual se ejecuta después del push. Para el primer piloto basta el gate local vigente; si se decide exigir CI previo al deploy, hay que implementar ese mecanismo. No declararlo resuelto con documentación.

## Política de calidad propuesta, sin batería universal

La precisión empieza en criterios observables y contratos, continúa con implementación acotada y se confirma con las señales adecuadas. No se mide por cantidad de agentes, tests o capturas.

| Cambio | Verificación suficiente por defecto | Cuándo ampliar |
| --- | --- | --- |
| L0, texto/imagen/variante local | Diff y comprobación estática pertinente; render si hay incertidumbre | Si afecta contrato, accesibilidad o consumidores compartidos |
| L1, layout o ajuste local | Checks pertinentes y recorrido/viewport afectado | Si aparece un cambio de comportamiento o impacto amplio |
| L2, feature UI/backend | Checks del paquete y casos decisivos de aceptación, error y regresión de la capa modificada | Si toca persistencia, contratos, auth/tenant/dinero o cableado real |
| L3, cambio transversal/crítico | Cobertura de invariantes e interacciones del candidato; suite amplia cuando el impacto no puede acotarse | Hallazgo concreto, dependencia transversal o alcance desconocido |

Dinero, sesiones, tenant y migraciones productivas conservan el piso L2 **cuando cambia su comportamiento**. No exigir unit + integración + browser + snapshots + mutaciones para todas las features. Elegir la capa más directa que detecta el defecto plausible; usar browser real cuando debe comprobarse el cableado y no solo el componente simulado.

Los tests nuevos se justifican por comportamiento o regresión relevante que no cubren los existentes. Mutaciones y adversarial dejan de ser casillas universales; tienen encargo concreto por riesgo. QA conserva independencia para evaluar el lote sin generar un revisor extra por cada tarea.

Un presupuesto de tiempo orienta la búsqueda y el feedback; agotarlo obliga a informar lo pendiente, no a declarar aprobado. Para hallazgos no críticos puede registrarse trabajo posterior según el acuerdo de aceptación; los bloqueos críticos no se transforman en deuda automáticamente.

**Primer paso sin caché sofisticada:** desarrolladores ejecutan checks focales; QA valida la combinación; un runner ejecuta controles obligatorios del release. Solo se reutiliza evidencia con entradas idénticas y comprobadas. Durante la transición el pre-push actual seguirá repitiendo verify: se debe declarar ese coste hasta cambiarlo, sin usar `--no-verify` como sustituto del arreglo.

## Mapa completo de ajustes

Los cambios siguientes son el paquete propuesto para aprobación, no archivos ya editados.

| Lugar | Ajuste |
| --- | --- |
| Nuevo ADR + `docs/INDEX.md` | Aprobar responsabilidad por tarea, GPT UI/backend, worktrees, integración única, pruebas proporcionales y release por candidato. Identificar qué cláusulas anteriores sustituye |
| ADRs 0071, 0113, 0114, 0128, 0129 | Referenciar la decisión nueva en los puntos sustituidos; conservar historia. Incluir 0123/0139 solo en aspectos de propiedad que realmente cambien |
| `AGENTS.md`, `CLAUDE.md` | Entradas breves al mismo protocolo; roles/task ID/worktree; GPT fullstack; eliminar contradicciones de main/dev, specs universales y subagentes solo L3 |
| `docs/TRABAJO-EN-PARALELO.md` | Aislamiento, reserva de recursos, inicio por rol, responsables temporales, entorno de test, integración/promoción y cancelación |
| `docs/AGENT-WORKFLOW.md` | Máquina de estados simple; preparación y dependencias; handoff; QA de combinación; bucle de corrección y recuperación |
| `docs/specs/TEMPLATE-CHICA.md`, `TEMPLATE.md` | Separar requisitos funcionales del despliegue operativo; pruebas justificadas; dependencias semánticas además de paths; quitar gates/mutaciones/revisor universales |
| `docs/MODULOS.md`, referencias operativas en `design-system.md` | Sustituir reparto fijo por asignación de tarea donde corresponda; conservar arquitectura/guardias y responsable explícito del kit |
| `.claude/agents/implementador.md`, `revisor.md`; nuevos roles coordinador/QA | Alcance y evidencia por tarea/candidato; especialista solo por riesgo; sin full verify repetido ni mutaciones predeterminadas. Adaptar roles para GPT con el mecanismo que se elija |
| Skills verificación, gotchas y handoff | Misma política; carga de contexto pertinente; entrega por task ID; evidencia comprobable reutilizable; recuperación sin clear universal |
| `docs/estado/gpt.md`, `claude.md`, `docs/TASKS.md` | Punto de retorno del coordinador/sesión y enlace al lote; workers entregan archivos propios, no escriben estados/índices comunes |
| `tools/worktree-new.sh` | Base/destino explícitos, dependencias propias por lockfile, configuración de prueba seleccionada; quitar enlace general de entornos productivos |
| `tools/verify.ts`, `tools/neon-test.sh`, runners browser/build | Alcance tarea/candidato/release, cobertura UI modular/backend/harness, DB antes de ejecutar suites pertinentes, artefactos/puertos aislados |
| `.claude/hooks/verify.sh`, `.githooks/pre-push` | Identidad de código/candidato, checks por etapa y validación de la ref realmente empujada |
| Hooks de estado/compactación/staging/mutaciones | Aplicar al task ID y worktree real; no leer siempre estado Claude; preservar controles útiles sin escanear/cambiar otro checkout |
| `.claude/settings.json`, `.codex/hooks.json`, `tools/zone-audit.ts` | Permisos y hooks acordes al rol/runtime; auditar asignación autorizada, no modelo por trailer. Comprobar efectos de hooks UI en tareas solo backend |
| `.github/workflows/ci.yml` | Guardias necesarias consistentes; exclusión de DB donde corresponde; describir CI posterior o implementar gate previo si se decide |
| `apps/*/AGENTS.md`, `CLAUDE.md` y configuración efectiva | Auditar instrucciones anidadas y generadas. Actualmente los de apps consultados son guía Next/reexport; no hace falta reescribirlos si no contradicen la política |

## Cómo evitar construir otro harness pesado

Tres fuentes operativas, con responsabilidades distintas:

1. `TRABAJO-EN-PARALELO`: dónde/quién puede escribir, recursos y publicación.
2. `AGENT-WORKFLOW`: qué entrega cada rol y cómo avanzan tareas/candidatos.
3. Política de verificación común, extraída a una referencia breve: qué señal corresponde y cuándo repetir/ampliar.

AGENTS/CLAUDE, roles y plantillas enlazan esas fuentes; no copian versiones completas de las mismas reglas. El ADR registra la decisión y la investigación queda como respaldo, sin hacerse lectura obligatoria por cada tarea.

La spec describe la feature. La ficha operativa contiene base/worktree/puertos/reservas; no meter esos campos volátiles en cada spec ni obligar a reconstruirla al cambiar un puerto. Un archivo de entrega por tarea y un registro pequeño por lote bastan para el piloto. La recuperación requiere persistencia y comprobación, pero no un dashboard, una cola distribuida ni una plataforma nueva.

El coordinador prepara, decide y desbloquea; los mecanismos deterministas controlan paths/refs/recursos. No pretender que un prompt garantice exclusión. Si el coordinador acumula demasiadas tareas, se limita el trabajo simultáneo y se prioriza; no se agregan agentes sin capacidad para integrar sus entregas.

## Secuencia propuesta y condición de adopción

1. Owner revisa este paquete de decisiones, incluida GPT UI/backend y la delimitación de recursos especiales. Mientras tanto rigen las reglas actuales.
2. Se documenta la aprobación en ADR y se alinean fuentes, entradas, roles, plantillas y skills. Se publica una versión de protocolo para que agentes con sesiones viejas vuelvan a leerlo antes de asumir encargos nuevos.
3. Se ajustan preparación/permisos/identidad de pruebas y operaciones críticas. El piloto empieza cuando las piezas necesarias están disponibles; lo opcional no bloquea empezar.
4. Se prueban dos features independientes con UI/backend repartidas por tarea, un coordinador y QA. Los cambios anteriores en dev se mantienen identificados; no se incorporan por accidente.
5. Se verifica aceptación e interacción real y tres fallos relevantes del proceso: intento de invadir una reserva, recuperación del coordinador e invalidación de evidencia al cambiar candidato. Se puede simular el release sin publicar.
6. Se mide tiempo hasta candidato listo, trabajo bloqueado, pruebas repetidas y defectos de integración. Solo entonces se añade automatización que aporte un ahorro comprobable.

La propuesta anterior era una base útil, pero no estaba lista para adoptar tal cual. Con estas correcciones queda un paquete de cambios revisable; su funcionamiento todavía debe comprobarse en el piloto, no inferirse del documento.

## Evidencia y límites de esta revisión

Se inspeccionaron reglas comunes, estado GPT, diseño anterior, instrucciones anidadas de las cuatro apps, templates, ADRs relevantes, roles, skills citadas, configuración de hooks, hooks de verificación/estado/staging/compactación/mutaciones, script de worktrees, selector verify, auditoría de zonas y CI. Se ejecutó `pnpm ci:status` con Node 24.20.0: main remoto `4208714` conserva el rojo POS ya documentado; no se diagnosticó nuevamente ese defecto.

Se preservaron cambios y staging paralelos de backend/migraciones. Esta revisión solo añade/actualiza documentos de propuesta y el estado propio. No aplica el nuevo reparto de zonas, no modifica hooks/tooling/políticas, no crea agentes/worktrees y no hace commit, merge, push ni deploy. No se ejecutaron suites de producto para una revisión documental.
