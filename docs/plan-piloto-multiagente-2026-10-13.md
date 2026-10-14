> Investigación/plan previo. El owner adoptó el piloto en ADR0144; las reglas vigentes están en TRABAJO-EN-PARALELO, AGENT-WORKFLOW y VERIFICACION. Este documento conserva el razonamiento previo y no impone gates adicionales.

# Plan de implementación: dos features, coordinador y QA

Fecha: 2026-10-13. Estado: **plan preparado; implementación diferida hasta que Claude cierre su trabajo y el repositorio quede integrado y sincronizado**.

**Evolución investigada:** [flujo continuo de software y Symphony](investigacion-software-factory-symphony-2026-10-13.md). Evalúa convertir los dos implementadores en un pool que toma tareas sucesivas mientras QA verifica entregas anteriores; no instala ni activa ese flujo.

Encargo actual: preparar el plan y contrastarlo con documentación oficial. No empezar a cambiar el harness, las zonas, los hooks ni el producto mientras Claude termina. Este plan concreta [la revisión de ajustes](revision-ajustes-harness-multiagente-2026-10-13.md); no sustituye por sí solo las reglas vigentes.

## Resultado que buscamos

Poder encargar dos features independientes y obtener su combinación lista para publicación: un coordinador prepara y supervisa, dos agentes implementan UI/backend en worktrees separados y un QA independiente comprueba aceptación e interacciones. El owner interviene en decisiones de producto y publicación; el equipo resuelve implementación, coordinación y correcciones rutinarias.

Los cuatro roles caben en los cuatro lugares activos de esta sesión. El coordinador es el agente principal. Los dos implementadores y QA son tres agentes distintos. No crear revisores adicionales por defecto ni permitir que los workers vuelvan a delegar y agoten los lugares. GPT puede recibir UI y backend a partir de la adopción de la política.

## Fase 0 — Esperar cierre e integrar el trabajo existente

**Ahora:** conservar el plan y los documentos de investigación. No reservar números de spec/ADR todavía, iniciar workers, reorganizar archivos o cambiar la rama compartida. No interferir con staging, migraciones, pruebas o servidores de Claude.

**Después de su entrega final:** el responsable de integración comprueba estas condiciones, antes de adoptar el harness nuevo:

- Claude entregó commits y un handoff actualizado de todo su trabajo pendiente, incluidas correcciones/revisiones exigidas por ese lote. No inferirlo del estado histórico o del silencio.
- Las entregas UI y backend existentes están combinadas; los pendientes funcionales del lote y el cierre conjunto están identificados y resueltos según sus specs. Los ajustes del harness no sustituyen ese cierre.
- El candidato del trabajo anterior pasó los gates vigentes pertinentes y el QA acordado. La evidencia puede reutilizarse cuando corresponde al mismo código/entorno; un rojo obligatorio no cuenta como cierre.
- Los cambios sin seguimiento están clasificados: trabajo que debe incorporarse, artefactos locales o documentos de propuesta. No incorporar todos los untracked ni exigir borrarlos para obtener un status vacío.
- El merge del lote anterior y su sincronización siguen las reglas actuales. Push/deploy/migraciones de producción solo con la autorización correspondiente; este plan no adelanta esa publicación.
- Se hace fetch y se comprueban las refs reales. Si el lote anterior ya se publicó, el punto de partida preferido es `main = origin/main = dev = B`. Si no se publicó, se deja explícita la diferencia y se espera la sincronización prevista antes de empezar, salvo que el owner cambie esa condición.
- Si hubo cambios de DB, se confirma la compatibilidad del código/esquema y del entorno local. Igualdad de refs no prueba igualdad de datos ni que un deploy esté listo.

**Salida:** SHA base `B`, lista de entregas incluidas, evidencia de cierre y situación de publicación/sincronización. No fijar ahora ese SHA: Claude sigue cambiando el árbol.

La instrucción de esperar persiste. No iniciar automáticamente al detectar un commit nuevo; retomar cuando el owner indique que Claude terminó y se verifique este cierre.

## Fase 1 — Adoptar una política común sobre la base B

Un único responsable hace este bloque documental. Se reserva el siguiente número disponible en ese momento y se registra un ADR que sustituya las cláusulas incompatibles de 0071/0113/0114/0128/0129. Se reserva también una spec técnica cerrada para el cambio del harness antes de tocar tooling; no usar el plan como sustituto implícito de esa spec.

### Decisiones concretas a incorporar

1. **Responsables por tarea:** GPT puede implementar UI, API, servidor y sus pruebas dentro del encargo. Claude también puede recibir trabajo completo. Kit/guardias/tooling siguen requiriendo asignación explícita; no se abren como cambios laterales de una feature.
2. **Aislamiento:** un worktree/ref local por escritor; solo el coordinador incorpora entregas en integración. Ninguna rama de feature se pushea.
3. **Dependencias:** contratos y recursos compartidos con responsable y versión. Esquema/journals/migraciones se incorporan en secuencia; la DB mutable se reserva durante todo el ciclo preparación/prueba/limpieza.
4. **Riesgo y paralelismo separados:** L0–L3 decide documentación/verificación; independencia y recursos deciden concurrencia. Dos features L2 pueden ejecutarse juntas sin convertirse artificialmente en L3.
5. **Calidad proporcional:** checks focales durante desarrollo, QA de aceptación/interacción y controles del candidato de release. Mutaciones/adversarial solo por riesgo o duda concreta; no como casillas universales.
6. **Release por candidato:** se publican las features elegidas y sus dependencias desde una base conocida. Dev puede contener trabajo que todavía no debe publicarse.
7. **Continuidad:** un coordinador activo por lote, un handoff por tarea y un registro pequeño de entregas/recursos. Las sesiones antiguas vuelven a leer la política al recibir encargos nuevos.

### Archivos que se alinean en ese bloque

| Grupo | Archivos | Resultado |
| --- | --- | --- |
| Entradas | `AGENTS.md`, `CLAUDE.md` | Instrucciones breves consistentes, GPT UI/backend, directorio/rol asignados |
| Protocolo | `TRABAJO-EN-PARALELO.md`, `AGENT-WORKFLOW.md`, referencia breve de verificación | Aislamiento, roles, dependencias, entregas, QA, recuperación y release |
| Templates | `TEMPLATE-CHICA.md`, `TEMPLATE.md` | Aceptación y pruebas justificadas; sin gate global/mutaciones/revisor universal por feature |
| Roles y skills | Implementador, coordinador, QA; revisión especialista; verificación/gotchas/handoff | Misma política sin duplicarla; QA independiente y entregas por tarea |
| Referencias | `MODULOS.md`, referencias de propiedad en design-system/ADRs, estados y TASKS | Nueva asignación compatible con arquitectura/guardias; workers no escriben índices o estados comunes |

La spec describe comportamiento/alcance. La ficha operativa contiene base, worktree, puertos y reservas. No volver a escribir la spec porque cambie un puerto.

**Validación:** formato, enlaces/referencias y búsqueda dirigida de órdenes incompatibles —main compartido, subagentes solo L3, GPT sin backend, verify/mutaciones universales— distinguiendo historia de reglas vigentes. No suite de producto por cambiar documentación.

**Salida:** política coherente, spec de implementación y versión/commit de protocolo `H1`. Los documentos de investigación quedan como respaldo, no lectura obligatoria de cada worker.

## Fase 2 — Preparar el mínimo técnico necesario

Este bloque se implementa de forma serializada antes de lanzar las dos features. Las zonas actuales se respetan hasta que la fase 1 las sustituya; el nuevo alcance se aplica explícitamente a quien implemente cada pieza.

| Pieza | Implementación mínima | Comprobación decisiva |
| --- | --- | --- |
| Preparación de worktrees | Ajustar `tools/worktree-new.sh`: SHA base/destino explícitos, dependencias propias por lockfile, solo configuración de test y puertos propios | Dos checkouts de la base asignada; cambiar/buildar uno no cambia fuentes ni artefactos del otro; sin enlace general de env PROD |
| Registro y reservas | Un registro de lote con único coordinador, tareas, paths/recursos, refs y entregas; reserva exclusiva atómica donde se automatice | Rechazar segunda reserva incompatible y segundo integrador; conservar estado tras reinicio |
| Lanzamiento por rol | Cada agente recibe task ID, worktree, base, contrato y alcance; confirmar cwd antes de escribir | Un intento de escritura/integración fuera de asignación se rechaza antes de ejecutar cuando el mecanismo lo permita; entrega fuera de scope se rechaza en integración |
| Feedback durante tarea | Adaptar hook Stop/selector al alcance asignado; types/lint/guardias y pruebas pertinentes, sin toda la suite por terminar un mensaje | Comprobar plan de tarea, cero selección injustificada de DB para UI pura y ausencia de verde con tests requeridos no ejecutados |
| QA/candidato | Plan explícito según diff de combinación, con fallback amplio si no se sabe acotar; incluir UI modular, backend y entradas de harness | UI en `modules/*/ui` recibe cobertura; un borrado/entrada dinámica no desaparece silenciosamente del plan |
| Evidencia y pre-push | Registro simple ligado a candidato/base/runtime/config/DB relevante; el hook valida la ref empujada o corre lo que falta | Resultado del candidato X no autoriza Y; cambios de entorno relevante invalidan el gate correspondiente |
| Permisos y hooks efectivos | Adaptar settings, auditoría de zonas y hooks de estado/staging/compactación para rol/worktree; controlar push/migración aparte | Mismo contrato operativo en GPT/Claude; un trailer de modelo no sustituye autorización; ningún worker actualiza el estado central |

No construir un SDK/controller nuevo si los agentes y herramientas existentes permiten operar el piloto. El registro y la integración pueden ser supervisados por el coordinador con herramientas actuales. La exclusión que requiere atomicidad no se confía solo a una frase en el prompt.

Para reutilizar pruebas inicialmente basta identidad comprobada de entradas; sin grafo sofisticado de caché. Una evidencia ausente, vencida o incompleta no autoriza omitir gates. El hook antiguo permanece hasta sustituirlo por una versión comprobada; no usar `--no-verify` para simular la mejora.

Se mantiene el CI posterior al push como red independiente y se alinean los controles obligatorios que falten. El piloto no depende de construir CI previo a deploy. Si más adelante exigimos esa condición, se configura/verifica la promoción correspondiente.

**Validación técnica del harness:** casos de coordinación/selección/identidad, tipos/lint/build si corresponde a las piezas cambiadas y ejecución real de la preparación. No correr suites de dinero o toda Neon para demostrar una reserva de paths. Si el cambio afecta el runner de esas suites, validar su ejecución pertinente antes de confiar en él.

**Salida:** dos entornos aislados preparados y mecanismos críticos comprobados. Todavía no afirmar que el piloto funcional pasó.

## Fase 3 — Elegir y preparar las dos features

Las features concretas se eligen después del cierre de Claude; hoy se nombran **A** y **B**. No inventar trabajo de producto ni tomar sus tareas pendientes como material del piloto.

Selección recomendada: dos features reales L2, acotadas, útiles y con ámbitos independientes; al menos una con UI y backend para comprobar el reparto nuevo. Preferir contratos/esquema existentes para la primera corrida. El mecanismo de migración se documenta/comprueba aparte y se usa cuando una feature real lo necesite; no añadir una migración artificial para probar el proceso.

La independencia se comprueba por paths, contratos, permisos, esquema, dependencias de paquetes y servicios. Si ambas necesitan la misma pieza, preparar primero esa pieza con su responsable o elegir otra combinación; no iniciar dos ediciones incompatibles.

### Ficha mínima por feature

```yaml
task: A
objective: resultado observable acordado
spec: referencia cerrada si corresponde
base: B más los cambios adoptados del harness
worktree: ruta asignada
allowed_paths: ámbitos de implementación y pruebas
contract: versión o referencia pertinente
dependencies: entregas y recursos necesarios
acceptance: criterios del producto y errores relevantes
checks: comandos focales y motivo de selección
resources: puertos, DB de test si aplica, artefactos
```

Se registra también la revisión de entrega y sus commits. El coordinador conserva el registro central; cada agente escribe solo su entrega.

## Fase 4 — Ejecutar el piloto con cuatro roles

| Rol | Encargo | No acumula |
| --- | --- | --- |
| Coordinador | Preparar A/B, reservar recursos, resolver dependencias, integrar, dirigir arreglos y preparar release | Las implementaciones completas y toda la ejecución de QA |
| Implementador A | Feature A completa dentro de scope; comprobaciones focales; commits y handoff | Cambios ajenos, integración central o publicación |
| Implementador B | Feature B completa dentro de scope; comprobaciones focales; commits y handoff | Cambios ajenos, integración central o publicación |
| QA | Revisar aceptación/contratos, preparar casos decisivos, validar entregas y combinación | Implementación de producto y revisión especialista universal |

1. Coordinador registra lote/base y despacha A/B en sus worktrees. QA recibe specs y criterios, no una obligación de correr todo anticipadamente.
2. Los implementadores avanzan simultáneamente. Envían progreso cuando hay entrega, bloqueo, nueva dependencia o ampliación de scope; no transcriben cada comando al coordinador.
3. QA prepara cobertura y puede revisar la primera entrega mientras termina la otra. Si necesita escribir tests, usa su checkout de QA; la incorporación de esos commits se declara antes de verificar el candidato.
4. Coordinador recibe entrega limpia con commits exactos, comprueba scope/dependencias y la incorpora una vez. No arrastra todo el contenido de una rama sin verificar su rango. Registra la correspondencia de SHAs.
5. Incorpora la segunda y cualquier prueba nueva explícita; congela `C1 = base + A + B + pruebas/arreglos declarados`. QA verifica en un checkout propio de ese candidato.
6. Si hay FAIL, QA entrega reproducción, impacto y categoría producto/interacción/entorno/test. Coordinador asigna el arreglo dentro del alcance, integra el commit y genera `C2`. Se repite el caso afectado y se amplía solo con motivo.
7. Si se corrige integración, el worker recibe la nueva base para que una revisión posterior no reponga código anterior. No hacer rebase/update por detrás mientras corre un comando.
8. Cuando aceptación y gates requeridos están completos, el coordinador entrega candidato listo, features incluidas, evidencia y pendientes no bloqueantes acordados. No usar número de tests como criterio de aprobación.

Ante cancelación, se preservan commits y se libera el recurso cuando terminó el proceso. Ante reinicio, se reconcilian refs, entregas y procesos antes de continuar; no duplicar integración ni asumir que un timeout autoriza un segundo escritor.

## Política de pruebas del piloto

| Momento | Selección |
| --- | --- |
| Implementación A/B | Checks estáticos pertinentes y casos que cubran comportamiento nuevo/error/regresión relevante. Aprovechar tests existentes |
| QA de cada entrega | Criterios de aceptación no demostrados y riesgos concretos; no repetir todos los checks del implementador |
| Combinación A+B | Interacciones identificadas, build/tipos/fronteras afectados y smoke real si cambia rutas, sesión o cableado UI/API |
| Release | Controles obligatorios del lote seleccionado, reutilizando resultados compatibles; un runner local responsable, más CI de otro entorno |

UI local sin cambio servidor no activa DB por defecto. Persistencia requiere la integración pertinente; auth/tenant/dinero necesitan negativos e invariantes reales. Una feature no paga automáticamente unit + DB + browser + snapshots + mutaciones. Un cambio transversal o de impacto desconocido sí justifica un gate amplio.

No añadir tests que solo copien el objeto literal del código. Un screenshot sin comparación/inspección no prueba calidad visual. Un retry o un test omitido no resuelven el fallo original. El coordinador valida identidad/alcance de evidencia; reproduce una señal decisiva si hay dudas, no toda la batería por rutina.

Los límites de tiempo son presupuesto de feedback. Al agotarse, informar qué queda pendiente y resolver el bloqueo; no rebajar silenciosamente la aceptación ni declarar verde una prueba que no corrió.

## Fase 5 — Demostrar el flujo y preparar publicación

El piloto pasa cuando:

- A y B cumplen sus criterios en la combinación real, incluida la conexión UI/API donde corresponda.
- No hubo cambios ajenos incorporados ni escrituras/DB/artefactos compartidos sin reserva.
- Las entregas, integración y evidencia corresponden a commits comprobables.
- Se comprueban tres fallos decisivos del proceso: reserva incompatible rechazada, recuperación sin duplicar entregas y evidencia de candidato anterior invalidada. Estas sondas se hacen una vez, en scratch/test, sin tocar producción; se reutiliza la comprobación de E2 cuando corresponde, sin repetirla por cerrar el piloto.
- Se prepara una selección de release coherente. Si se demuestra publicar solo A, se construye esa selección desde la base y no se hereda sin comprobación el PASS de A+B.
- Se registra tiempo hasta candidato listo, tiempo de checks, gates repetidos, bloqueos de entorno y defectos de integración. No prometer ahorro porcentual antes de medir.

La publicación puede ensayarse hasta promoción local/revisión del candidato según autorización, sin push productivo. Cuando el owner pida publicar: confirmar base remota vigente, candidato autorizado y evidencia; promover/publicar; confirmar los despliegues correspondientes y un smoke pequeño. Para esquema/datos, aplicar el plan específico de compatibilidad y recuperación. No probar escribiendo libremente en PROD.

## Orden de entregas y qué se puede diferir

| Entrega | Incluye | Condición para avanzar |
| --- | --- | --- |
| E0 | Cierre Claude + integración/sincronización anterior | Base B comprobada y pendientes anteriores cerrados |
| E1 | ADR/spec + reglas, templates, roles y skills coherentes | Encargos sin órdenes contradictorias y autorización por rol clara |
| E2 | Preparación, reservas, checks por alcance e identidad de gates/ref | Mecanismos críticos comprobados; writers y QA pueden operar aislados |
| E3 | Features A/B y QA del candidato | Aceptación y combinación verificadas |
| E4 | Informe breve, candidato y procedimiento de release | Piloto evaluado; publicación solo según autorización |

E1/E2 se desarrollan serialmente: cambiar el mecanismo de coordinación mientras ya coordina dos features dificulta atribuir fallos. Después E3 usa el paralelismo real. No mezclar arreglos del harness con commits funcionales de A/B.

Se difieren: dashboard, controller SDK permanente, selección por grafo sofisticado, nuevas bases por agente si la exclusión de DB alcanza, más agentes, revisión extra universal y CI previo a deploy. Se incorporan solo si el piloto demuestra necesidad. Los worktrees, responsabilidades, entorno no productivo, identidad de evidencia y aceptación final sí son requisitos del piloto.

## Contraste con evidencia oficial de OpenAI

Consulta: 2026-10-13. Estas fuentes apoyan principios; no certifican este diseño ni fijan una receta universal de producción.

| Evidencia oficial | Consecuencia para nuestro plan |
| --- | --- |
| Los subagentes pueden trabajar en paralelo y devolver resultados resumidos; la documentación advierte del consumo extra y de conflictos al escribir simultáneamente | Dos implementadores con encargos independientes, contexto acotado, coordinador y QA. Integración con un escritor; no delegación recursiva automática. [Subagentes](https://learn.chatgpt.com/docs/agent-configuration/subagents) |
| Los worktrees permiten chats paralelos en checkouts separados; una rama solo puede estar activa en uno | Ref/worktree propio por writer y checkout de QA; no varios agentes cambiando la misma rama/carpeta. DB/puertos son responsabilidad adicional nuestra. [Worktrees](https://learn.chatgpt.com/docs/environments/git-worktrees) |
| La guía recomienda calibrar tests, evitar pruebas que reflejen cambios reversibles de bajo impacto y ampliar/repetir solo por cambios, fallos o dudas nuevas | Pruebas pertinentes por tarea y candidato; eliminar full verify por cada devolución, mutaciones por defecto y repeticiones por ceremonia. Mantener controles necesarios. [Testing and verification](https://developers.openai.com/api/docs/guides/latest-model#testing-and-verification) |
| Las reglas de revisión deben ser concretas, actuales y generar poco ruido; un revisor de IA complementa los mecanismos de enforcement | Auditoría focal y guardias deterministas; no declarar seguro un release solo por un PASS narrativo. [Reglas de revisión](https://developers.openai.com/blog/custom-code-review-rules-for-codex) |

La selección de exactamente dos features, la serialización de migraciones, los estados/refs y el piso de riesgo del negocio son decisiones adaptadas a CheckPoint. No se atribuyen a OpenAI. Production grade aquí significa precisión en aceptación, aislamiento, invariantes pertinentes, integración verificable y recuperación operable; no una cantidad fija de tests por feature.

## Situación comprobada al preparar este plan

La rama activa es `dev` y tiene trabajo/staging de Claude todavía en curso. Refs observadas, que pueden avanzar: dev `bdd642b` (tipos centralizador IA, spec0224), main local `fab728e`, origin/main local `4208714`. No están sincronizadas. El estado escrito de Claude es anterior a parte de los cambios actuales; se volverá a comprobar al cierre. No usar esas refs como B definitiva.

`pnpm ci:status` con Node24.20.0 falló primero por acceso de red del sandbox; se repitió con escalación y confirmó CI rojo para main4208714 por POS conocido. No se ejecutaron suites del lote ni se reparó ese rojo en esta tarea de planificación.

Hoy solo se preparó este plan, se enlazó en la revisión y se actualizó el estado propio. No se aplicaron cambios de reglas/tooling/permisos, no se reservaron números, no se crearon agentes/worktrees y no se hizo commit, merge, push ni migración.
