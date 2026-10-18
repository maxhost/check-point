# 0238 — Plan de implementación y medición

Estado: propuesta documental, sin tareas de producto iniciadas. Base de diseño `005b8235d3178295037efbf5deca29596f69c80a`; confirmar dev y cambios ajenos al asignar implementación. [Spec](../specs/0238-carga-inicial-del-backoffice.md), [ADR](../adr/0154-contexto-del-backoffice-por-peticion.md), [medición inicial](0237-inbox-measurement.md). El owner eligió implementar 1 + 2 + 3 y medir el conjunto; este turno prepara los documentos, no ejecuta ese código.

## Secuencia y entregas

| Fase | Entrega verificable | Dependencia |
| --- | --- | --- |
| D0 | Spec/ADR, contratos, fila INDEX y reserva mediante commit local | Este encargo documental |
| M0 | Referencia comparable de build de entrega y receta congelada; todavía sin optimizar | Documentos aceptados/cerrados, recursos reservados |
| A1 | Tipo interno de contexto, proyección mínima, tabla de guards/selecciones y constructores puros | M0, escritor único del contrato |
| A2 | Resolvedor por petición, JOIN con facturación y wrappers equivalentes; reporter/checklist sin repetición interna | A1 |
| B1 | Seed del layout, propietario cliente, navegación/TrialNotice y módulos sin consultas de montaje redundantes | A1 estable; A2 antes de smoke real |
| B2 | Peticiones simultáneas compartidas, invalidación y protección frente a identidad/respuestas anteriores; Inbox con efectos conservados | B1 |
| C | Candidato 1 + 2 + 3 integrado y congelado con checks focales y matriz funcional | A2+B2 |
| M1 | Medición posterior del conjunto, con mismo protocolo que M0 | C |
| Q | QA de combinación, resultado funcional/rendimiento y handoff por SHA | M1 y evidencia compatible |

M0 es la preparación indispensable para comparar; no sustituirla por las cifras dev ni medir parcialmente cada alternativa para seleccionar el mejor resultado. Las comprobaciones funcionales de cada entrega sí ocurren antes de integrar. No ejecutar tareas de implementación por haber preparado esta ficha.

## Asignación propuesta

Coordinador: contratos, índices/estado, reservas, orden de integración y método de medición. No modifica trabajo ajeno.

Servidor: `server/backoffice-context*` y proyección; `auth-guards.ts`, `api-owner.ts`, `api-permission.ts`, `billing-gate.ts`, `staff.ts` exclusivamente helpers de lectura; `server/onboarding/checklist-facts.ts`; constructores compartidos para reporter y módulos cuando sea necesario; pruebas focales de datos/guards/HTTP. Único escritor del contrato común A1. Los guards también sirven a otras rutas: inventariar esos consumidores antes del primer cambio y ejecutar regresiones pertinentes, no migrarlos de producto por extensión.

Asignación explícita adicional a servidor: `apps/merchant/src/modules/activation.ts`, solo constructor/lecturas que acepten categoría precargada y permitan reutilizar la vista sin consultar otra vez el negocio. No cambiar activación/desactivación, locks, writers o dependencias. Si se extrae un helper puro, reservar su path antes del código.

Cliente: `app/backoffice/layout.tsx`, `page.tsx`, provider/hooks nuevos, `backoffice-navigation.tsx`, `subscription/trial-notice.tsx`, `settings/module-request.ts`, `analytics/inbox-state.ts` y checklist si aplica. Pruebas de montaje, semillas, invalidación, carreras e integración real. No escribir el helper/contrato del otro writer. `layout.tsx` se asigna exclusivamente a cliente tras A1.

QA: revisión independiente sobre candidato inmóvil; equivalencia de decisiones/tenant y evidencia de app real, más lectura de mediciones y trazas. La organización y asignación efectiva seguirán ADR 0144 al iniciar el producto; este encargo no lanza agentes ni worktrees adicionales. QA no certifica su propia implementación.

No asignados: kit, guardias, tooling de publicación, esquema, migraciones o proveedor auth. Un harness de medición que requiera tocar tooling/cliente DB se asignará explícitamente antes del código, solo en worktree propio, opt-in y limitado a ambiente no PROD. El harness local de 0237 se conserva como evidencia, no se integra automáticamente al producto.

## Contratos antes de delegar

1. Fijar tipo servidor, modos de selección, función pública de lectura por petición y proyección cliente versión 1, incluida recuperación de módulos y datos que nunca se serializan.
2. Decidir el propietario de cada dato: acceso del servidor; presentación inicial y revisiones del provider; efectos de Inbox en servicio vigente. No dos fuentes de módulos/roles que compitan por navegación.
3. Documentar helper compartido en Route Handlers, ámbito RSC y invalidación tras escritura. Probar que argumentos equivalentes no crean memorias independientes ni datos cruzados.
4. Inventariar superficies HTTP tocadas y su resultado anterior; GET sesión sigue reporter y POST Inbox conserva contrato 2/operationId/versiones. La consulta JOIN no introduce códigos nuevos.
5. Entregar juntos en A1 el protocolo de recuperación excepcional del JOIN, tabla de transiciones del provider y tickets de seed/peticiones de spec§3.2/4.1/4.2. No dejar que cada writer elija una semántica distinta. La versión del DTO no es revisión de frescura.

## Recursos y seguridad del experimento

- Worktrees/ref/SHAs y paths mediante factory antes de escribir. Puertos propios seleccionados tras inventario, nunca asumir que 43151 o un puerto del owner están disponibles.
- DB no PROD protegida y recurso exclusivo durante fixture/migración/test/teardown. Configuración seleccionada por worktree, sin copiar env productivo. Tests directos DB solo por `tools/neon-test.sh`.
- Antes del wrapper, inventariar estáticamente journal y pendientes. No aplicar DDL por sorpresa, operar CI compartida sin reserva, usar la DB perf histórica por inercia ni reparar ledgers. Esta implementación no necesita migración.
- Fixtures identificadas y sintéticas, con volúmenes/monedas/roles declarados y mismos datos en M0/M1. No resetear Joyas ni datos del owner. Preparación/restauración fuera del reloj, pero ninguna operación necesaria para responder se excluye de la medición.
- Login por flujo existente en cada servidor de prueba; cerrar sesiones propias, eliminar cookies privadas y detener procesos propios al acabar. No guardar tokens, parámetros SQL, cuerpos privados o HAR sin sanear. No leer un perfil privado de navegador.

## Receta de medición que debe congelarse en M0

Registrar fuente/harness SHA y hashes, runtime/lockfile, comando de build/start, hostname/puerto, región/red, configuración auth, tamaño/dataset/hash, esquema/ledger y actividad concurrente. Ambos usan build de entrega con misma configuración local o CI protegida, sin usar `NODE_ENV=production` como autorización para apuntar a PROD: comprobar hostname/huella antes de arrancar.

Seleccionar una configuración de ejecución compatible y repetirla en base/candidato; si Webpack es necesario, usarlo en ambos y registrar que difiere de un deploy Turbopack. No apagar Strict Mode para borrar duplicaciones: comprobar desarrollo separadamente; rendimiento cuantitativo sobre build de entrega.

Casos independientes:

- Ready vacío, con configuración completa y sin evaluación pendiente.
- Ready con hasta 5 tarjetas representativas y mismas decisiones/acciones/costos, registrando los efectos de exposición.
- Preparación pendiente, incluyendo fallback y segundo refresco; registrar hasta estado final o timeout real.
- Contención real por comercio; respuestas sin bloqueo indefinido y exposición/versión correctas.

Para cada ready: conservar primera entrada tras arranque en contexto limpio, con condición térmica declarada (no llamarla DB fría sin prueba), más 30 recargas con servidor/rutas ya usados. Mantener sesiones equivalentes y contar las renovaciones aparte, sin eliminarlas del tiempo total. Capturar todos los intentos, fallos y timeouts; no reemplazarlos por retries ni percentiles solo de éxitos. El costo de exponer tarjetas o leer módulos no se mueve fuera del reloj para mejorar el número.

Reloj principal: inicio de navegación → Inbox utilizable en DOM. Acompañar TTFB, primera pintura con contenido, comienzo/respuesta del Inbox, conteos HTTP/SQL y su solapamiento, auth/contexto/BEGIN/lock/lectura/efectos/COMMIT, conexión/espera cuando sean observables y bytes iniciales. Para HTTP distinguir cabeceras/cuerpo/decodificación; para driver WS el resultado; ejecución de Postgre SQL requiere otra evidencia y no se infiere de esos relojes.

Preferir un observador externo a la app para el tiempo principal y conteos. Si hace falta instrumentar servidor, misma instrumentación en base/candidato, con costo y límites declarados y sin logs de secretos. No mezclar una corrida solo navegador de base con una candidata cargada de trazas. Un problema del método produce resultado no demostrado, no PASS prestado.

Mediana/p95 de ambos ready deben mejorar y no empeorar TTFB/pintura según §6 de la spec. Adjuntar valores individuales, waterfall y conteos al informe; no solo porcentajes. Un incumplimiento vuelve a corrección, no a ampliar tablas/caché/DDL por cuenta propia. No repetir el benchmark anterior de evaluación fría como si fuera este experimento.

### Control de deriva y estimadores, a congelar antes de M0 (R1)

M0 congela el código base sin optimizar, su build reproducible y las observaciones originales. En M1 ejecutar ese mismo código base como control contemporáneo del candidato, usando el mismo harness revisado en ambos. Si se corrige el harness, conservar M0 y sus límites y medir las dos fuentes con la corrección; no reparar solo el resultado desfavorable. La comparación cuantitativa de aceptación usa este control contemporáneo y el candidato, conservando M0 como referencia histórica.

Por caso ready, hacer seis pares de bloques, cinco recargas por fuente en cada par: orden `A-B, B-A, A-B, B-A, A-B, B-A`, donde A es base y B candidato. Total treinta recargas por fuente/caso. Las primeras entradas tras arranque se registran separadas antes de esos bloques; no seleccionar temperatura o condiciones distintas para una fuente. Solo una instancia de medición genera tráfico a la vez; configurar igual los servidores y registrar otros procesos/carga. Reservar el recurso DB durante los bloques para que no coincidan fixtures o suites ajenas.

Mediana: promedio de los dos valores centrales para n par. P95: rango más cercano, índice `ceil(0.95*n)-1` del vector ordenado, sin interpolación. Reloj monotónico del navegador, misma resolución configurada en ambos; registrar la resolución efectiva y no afirmar diferencias por debajo de ella. Definir utilizable por contenido del DOM esperado (estado ready válido más mensaje vacío o las cinco tarjetas identificadas, con acciones habilitadas cuando corresponda), no solo ausencia del spinner, primera respuesta HTTP o skeleton.

Informar valores individuales, diferencia base/candidato y un intervalo de incertidumbre de 95% mediante remuestreo de los seis pares completos de bloques, conservando cada pareja y el mismo estimador; diez mil remuestreos y semilla fija documentada en el harness antes de M0. La unidad de remuestreo es el par, no muestras sueltas que oculten la correlación de cada bloque. Informar también el orden y resultados por bloque para hacer visible deriva/variabilidad.

El conteo y la equivalencia funcional son gates independientes de la inferencia temporal. Para afirmar mejora de Inbox, las diferencias puntuales y el intervalo deben sostener la dirección de mejora; para afirmar no regresión de TTFB/pintura, el intervalo no debe admitir una regresión resoluble por el reloj. Si no hay evidencia suficiente, clasificar **no demostrado**, aunque el mejor intento sea más rápido. No aumentar muestras hasta obtener PASS: cualquier campaña mayor o método corregido se acuerda y congela antes de ejecutarse, conservando resultados previos. Sin el control A contemporáneo, la comparación M0/M1 solo es descriptiva y no cierra el gate causal de rendimiento.

### Manifiesto temporal y efectos de lectura (R2)

Cada fixture sintética tiene manifiesto versionado con día de negocio/zona, moneda, estado y versión de política, evaluation_run ready/preparing, candidatos/ciclo/revisiones/acciones, inicio/expiración, shownDays/lastShownDay, recordatorios y límites de acceso/prueba. Añadir política de renovación/edad equivalente de las sesiones de medición. No almacenar tokens en el manifiesto. Congelar ventana de ejecución y vigencias que la cubran; no modificar el reloj solo para un lado.

Antes de cada bloque se restaura la misma instantánea lógica protegida o se crean ámbitos sintéticos equivalentes; registrar cuál de esos métodos usa el harness. Restauración solo con wrapper/IDs propios, nunca Joyas ni un reset global, y fuera del reloj. La primera lectura que expone tarjetas permanece dentro del reloj y se informa separada; para las recargas usar el mismo estado estabilizado de exposición en A/B, documentando las transiciones. No reconstruir cinco tarjetas nuevas por detrás de una medición ya iniciada.

Verificar estado esperado, cinco identidades/acciones/versiones y vigencias al comienzo y final de cada bloque. Si cambia día, expiración, sesión o estado de run de modo que el caso deja de ser ready, conservar la observación como tal y no incluirla silenciosamente entre ready exitosos. Ese bloque no demuestra el criterio previsto: diagnosticar y fijar una nueva campaña comparable, no sustituir solo la muestra fallida. El estado temporal observado y el historial de exposición acompañan el hash del dataset.

### Composición y vida de peticiones (R3/R4)

El seed core no espera módulos. El escritor cliente compone la hoja servidor de módulos bajo Suspense propio y un consumidor que aplica su ticket al provider ya montado; estado loading solo para enlaces de módulos. El escritor servidor entrega consulta/constructor que reutilizan categoría del contexto y resuelven ready/unavailable/restricted con autorización equivalente. La hoja observa hasta el final la consulta; no introducir un timeout con Promise.race que abandone el trabajo. Hacer un smoke con lectura deliberadamente lenta y otro con rechazo: demostrar Inbox/core utilizables mientras módulos siguen pendientes, registrar fin del stream/recursos y una recuperación coordinada cuando corresponda.

El provider, no cada consumidor, es propietario de promesas, suscripciones, abortos y generaciones. Fijar en A1 claves, cierre de ticket inicial, retiro por settle con comparación de identidad de entrada y cola máxima de un refresco; B2 implementa ese contrato. Prueba decisiva: GET Inbox previo a decisión no puede servir al refresco posterior, aunque se remonte el componente o recupere foco. Prueba de checklist: desmontaje de un consumidor/primer efecto de Strict Mode no aborta al que conserva la suscripción. No confundir cancelación de fetch con cancelación del SQL del servidor.

## Checks y salida

Servidor: pruebas focales existentes más los casos nuevos decisivos de modo de selección, fila ausente, orden de errores, identidad intercalada y revocación entre peticiones. Join/tenant/negativos reales en DB protegida por wrapper. Mantener fuente de validación de sesión Better Auth.

Añadir fallo exclusivo de subscription para denegaciones previas y caller autorizado, sin fail-open ni PIN adelantado; rama que omite billing, segundo fallo y recuperación con selección consistente. Cliente: reporter con membresía/negocio nulos, navegación interna con layout persistente, cambios estructurales con una sola navegación completa, transición restricted→ready y seed/RSC tardío después de mutación. Estos casos son aceptación de B1/B2 del [informe adversarial](0238-adversarial-review.md), no pruebas opcionales de estilo.

Cliente: browser con seed y red observable; cero GET auxiliares de montaje con seed ready,1 GET Inbox, reintento y foco coordinados, cambios de módulos, cierre de sesión/respuestas tardías y carreras del Inbox. Contratos HTTP simulados sirven para interacción, smoke de app real para cableado. Tipos/lint/guardia UI focales; no cambiar kit/guard para evitar rojo.

Entrega: SHAs de autor, base y candidato; tabla criterio/resultado; logs de comandos, fallos/skips, límites y pendientes; matriz de consumidores de helpers modificados; comparación M0/M1 y reversión conjunta sin DDL. QA de entrega y de combinación separadas. Main local después de gates pertinentes; publicación solo por nueva autorización y pre-push vigente. Ningún PASS en esta documentación: aún no hay código de 0238 ni M0 comparable.

## Revisión adversarial del diseño

El [informe independiente](0238-adversarial-review.md) revisó `03949d2e`: B1/B2 impedían cerrar el contrato; R1–R4 concretaban la ejecución. Este delta incorpora los seis sin nueva decisión de producto ni expansión a caché/DDL/realtime. Pendiente revisión del delta por el mismo agente; no se cambia el estado de propuesta/spec borrador ni se declara PASS de producto. El diagnóstico anterior de rendimiento y los diferidos siguen vigentes.
