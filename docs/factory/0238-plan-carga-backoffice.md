# 0238 — Plan de implementación y medición

Estado vigente: implementación autorizada por checkpoints; spec cerrada y ADR aceptado tras aceptación explícita de scopeKey por owner (2026-10-18 UTC). M0 todavía precede al código. El texto de planificación/revisiones más abajo conserva contexto histórico; las tareas condicionales de §4.3 quedan habilitadas por esta decisión. Base de diseño `005b8235d3178295037efbf5deca29596f69c80a`; confirmar dev y cambios ajenos al asignar implementación. [Spec](../specs/0238-carga-inicial-del-backoffice.md), [ADR](../adr/0154-contexto-del-backoffice-por-peticion.md), [medición inicial](0237-inbox-measurement.md). El owner eligió implementar 1 + 2 + 3 y medir el conjunto; este turno prepara los documentos, no ejecuta ese código.

## Avance operativo

M0, A1, B1a y A2a aceptados con evidencia en el informe QA. A2b comienza sobre dev4e3b0a56. Mientras B1b espera los constructores A2c, B adelanta **S1-client**, únicamente helpers de transporte opt-in con pruebas y sin consumidores activos; entrega9de98a2b pendiente de QA. La adopción efectiva de cabecera permanece supeditada al guard servidor y a la integración correspondiente. Esta subdivisión no cambia el contrato ni los gates del conjunto.

B2a se subdivide además en **B2a-owner**, propietario puro aislado de solicitudes de los cuatro recursos ya contratados, sin wiring ni consumidores. Puede avanzar en paralelo a A2b sobre dev514b33bd: dos archivos propios, deduplicación pendiente, tickets/generaciones explícitos, un pendiente, retiro por identidad y suscriptores StrictMode. QA de esta pieza no prueba montaje ni HTTP. La integración atómica con provider y consumidores permanece en B2 posterior a B1b; no habilita marca/caché parcial en producto.

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

## Ejecución con dos implementadores

Plan solicitado tras las revisiones. Referencia documental inspeccionada: `21f4f629a7bc9a519cbb8285c1c82f79ddc728ee`. Al iniciar, congelar el SHA real de dev, comprobar diferencias y registrar la base efectiva; este SHA no reserva recursos ni permite descartar cambios posteriores. **Este documento prepara el reparto: no inicia agentes, worktrees ni producto.**

### Entrada y camino crítico

1. **D0, coordinador:** resolver la decisión de §4.3 (`scopeKey`), actualizar spec/ADR/INDEX a cerrada/aceptado con la decisión explícita y registrar reserva local. Recomiendo adoptar la protección acotada propuesta; pedir un plan para dos agentes no equivale a aceptarla. Si se rechaza, retirar sus garantías y tareas antes de despachar, sin inventar una alternativa durante implementación.
2. **M0, coordinador:** congelar harness/fixtures/receta y capturar base de build según este documento, antes de cualquier optimización. Reservar DB protegida, puertos y paths concretos. La instrumentación de0237 no queda incorporada por defecto; si requiere cambios DB/tooling, asignar sus archivos exactos en una tarea de medición separada antes de escribirlos. No iniciar A2/B1 mientras falte una referencia válida.
3. **A1, implementador A:** entregar en commit separado el contrato mínimo compartido, firmas de lectura y tabla de decisiones/transiciones. Coordinador y B comprueban que se puede consumir sin importar código servidor al navegador; no es otro reviewer. Congelar ese commit y llevarlo al worktree B mediante integración local explícita del coordinador. A1 no contiene un refactor parcial oculto.
4. **En paralelo:** A implementa A2 (servidor); B implementa B1 y después B2 (shell/cliente). B puede usar fixtures tipadas del contrato para avanzar; no inventa otra forma de DTO ni declara smoke real con respuestas simuladas. Cada uno corrige sus propios hallazgos.
5. **C, coordinador:** integrar serialmente A y B en dev, resolver solo conflictos de integración, ejecutar smoke real y congelar candidato. Una entrega que cambia contratos vuelve a A1 y avisa al otro implementador; no mover su checkout por detrás de una prueba.
6. **M1 y Q:** medir el conjunto contra control contemporáneo; QA independiente revisa entregas e interacciones sobre SHA congelado. Correcciones vuelven al autor y generan revisión nueva. Repetir evidencia afectada, conservando fallos. Main local solo tras aceptación; sin publicación automática.

Dependencia efectiva: `D0 → M0 → A1 → [A2 || B1→B2] → C → M1/QA de combinación → aceptación local`. QA de entrega puede comenzar sobre una entrega congelada mientras termina la otra; no equivale a QA de combinación.

### Tamaño de las entregas y checkpoints

El reparto A/B asigna responsabilidad, no dos encargos monolíticos. No podemos garantizar capacidad por la amplitud de un prompt: la evidencia son entregas pequeñas que compilan y superan sus casos decisivos. Despachar **solo el siguiente checkpoint habilitado** de cada agente, con paths/casos concretos y el SHA de entrada. Los checkpoints refinan A1/A2/B1/B2; no añaden features ni agentes.

| Checkpoint | Responsable / dependencia | Límite de cambio y comprobación antes de seguir |
| --- | --- | --- |
| A1, contrato común | A; después de M0 | DTO público mínimo, firmas, modos y transiciones acordados con B/coordinador. Compila en servidor/cliente sin importar secretos o runtime servidor; fixtures tipadas. Congelar contrato antes de trabajo paralelo |
| A2a, contexto por petición | A; A1 | Compartir resolución de sesión/datos manteniendo inicialmente las consultas separadas. Distinguir RSC/Request y modos; comprobar no repetición interna, identidad intercalada y revocación entre Requests. No introducir todavía JOIN |
| A2b, JOIN y precedencia | A; A2a | Sustituir solo obtención de membresía/billing, proyección nullable y fallback único. Negativos reales, selección múltiple, fallo parcial y caller autorizado; SQL/plan focal. Este checkpoint concentra el riesgo de datos/auth |
| A2c, constructores y consumidores servidor | A; A2b | Seed core autorizado, constructor puro de módulos/reutilización de categoría, reporter y checklist equivalentes. Verificar gates de módulos, ausencia de datos privados y conteos. Entregar helper estable que B conectará al shell |
| B1a, provider y estado inicial | B; A1 | Provider, hooks y tickets del seed en componentes/pruebas aisladas. Core/módulos loading/ready/restricted/unavailable y rechazo/seed tardío. Todavía no sustituir efectos de producción mediante una integración a medias |
| B1b, shell y streaming | B; B1a, y A2c disponible para smoke real | Conectar layout/page/hoja Suspense, navegación y TrialNotice; retirar sus efectos iniciales repetidos. Probar módulos lentos/rechazados y conteos reales; no declarar correcto el cableado con fixtures simuladas |
| B2a, transportes compartidos | B; B1b | Inbox/checklist comparten solicitudes en curso; suscriptores/cleanup/finally por ticket y generación. Probar Strict Mode, dos consumidores, rechazo/reintento y GET anterior a decisión. Conservar máquina/temporizadores/idempotencia de Inbox |
| B2b, revalidación e integración cliente | B; B2a | Conectar foco/reconexión/mutaciones/reporters y reconciliación RSC. Probar ámbito retirado, respuesta tardía, restricted→ready y formularios autorizados; no bucles ni fan-out. Entrega cliente completa para candidato C |
| S, ámbito condicional | A y B, cada uno en sus paths; solo si se acepta §4.3 | Servidor entrega primero marca/verificación/409 y negativos sin modificar dominio; B adopta captura de intención y recuperación tipada en otro commit. Comprobar ambos juntos, cookie A→B y no reintento de escritura. Contrato exacto en A1; no activar consumidores nuevos con medio protocolo conectado |

B puede desarrollar pruebas y componentes contra A1 mientras A completa A2a–c. La conexión real B1b depende de A2c: no prometer dos líneas de trabajo independientes durante todo el encargo. El coordinador transmite commits necesarios de A al worktree B de forma explícita, con estado limpio y pruebas detenidas, sin incorporar trabajo no entregado.

Cada checkpoint termina en commit identificable, diff acotado y evidencia focal; el siguiente no comienza con fallos del anterior sin resolver. Son puntos de control internos: commits intermedios no equivalen a un producto aceptado ni se avanzan a main por separado. QA puede revisar evidencia de entregas coherentes sin ejecutar una batería nueva por cada commit. M0/M1 y aceptación de rendimiento siguen evaluando el conjunto 1+2+3, sin benchmarks parciales para escoger resultados. Si cambia un invariante del contrato, detener solo la parte dependiente y resolverlo con el coordinador antes de seguir.

### Contratos de los implementadores y propiedad de archivos

Raíz de paths de producto: `apps/merchant/src/`. Los paths nuevos siguientes son nombres previstos, no archivos ya creados. El coordinador convierte esta lista en reservas factory de archivos reales, sin globs, antes de despachar. Si la extracción necesita otro archivo, ampliar primero la reserva; no reservar todo `server/` o `backoffice/`.

| Tarea / escritor | Paths exclusivos previstos | Entrega y evidencia decisiva |
| --- | --- | --- |
| `0238-server`, A | Nuevo `backoffice-context-contract.ts` puro/serializable y sin imports runtime servidor; nuevos helpers `server/backoffice-context.ts` y `server/backoffice-initial-context.ts`; `server/auth-guards.ts`, `server/api-owner.ts`, `server/api-permission.ts`, `server/billing-gate.ts`, helpers de lectura en `server/staff.ts`; `server/onboarding/checklist-facts.ts`; `app/api/merchant/session/route.ts`; `modules/activation.ts`; `app/api/modules/route.ts` solo si necesita reutilizar constructor/contexto | A1 separado de A2. Contexto por petición, JOIN nullable/proyección, gates y reporter equivalentes; constructor autorizado de seed core/módulos, sin renderizar shell. Negativos tenant/auth/fallo billing, SQL/plan y conteos reales. Contrato no exporta filas privadas ni obliga al cliente a importar helpers servidor |
| `0238-client`, B | `app/backoffice/layout.tsx`, `app/backoffice/page.tsx`, `app/backoffice/backoffice-navigation.tsx`, `app/backoffice/subscription/trial-notice.tsx`, `app/backoffice/analytics/inbox-state.ts`, `app/backoffice/settings/module-request.ts`, `app/backoffice/onboarding/onboarding-checklist.tsx`; nuevos `app/backoffice/backoffice-context.tsx` y `app/backoffice/backoffice-modules-seed.tsx`, con helpers locales adicionales solo tras reservar | B1 separado de B2. Layout/page consumen funciones de A; la hoja RSC asíncrona/Suspense y el provider pertenecen a B aunque la hoja corra en servidor. Cero GET inicial sesión/módulos con seed ready, un Inbox, checklist compartido; invalidación/tickets/abortos y edición autorizada preservada. Pruebas de interacción y smoke real tras integrar A |
| Condicional a aceptar §4.3, A | Helper servidor de scope, reservado por nombre en A1; comprobación en guards comunes. Solo si el inventario demuestra necesidad: adapters de `server/analytics/http/index.ts`, `app/api/onboarding/checklist/route.ts`, `app/api/onboarding/tours/[tourId]/route.ts` y dispatcher de módulos identificado por A1 | Capturar ámbito autenticado ya resuelto, comparar después de gates/antes de dominio, 409 tipado y no-store. No cambiar writers/lifecycle. Si el guard común basta, no editar adapters por ceremonia |
| Condicional a aceptar §4.3, B | `app/backoffice/panel-request.ts`, `app/backoffice/settings/module-request.ts`, `app/backoffice/onboarding/onboarding-api.ts`, consumidores adoptados ya asignados a B | Capturar marca al inicio de intención; recuperación única; distinguir código de cambio de contexto del conflicto de tarjeta. Sin repetición automática de escrituras ni marcas en logs |

Tests tienen el mismo escritor que su capa. A empieza por suites existentes `server/auth-guards.test.ts`, `server/api-permission.test.ts`, `server/api-owner-surfaces.test.ts`, `server/billing-auth-guards.neon.integration.test.ts`, `app/api/merchant/session/session.neon.integration.test.ts` y checklist cuando corresponda; selecciona casos afectados en vez de ejecutar todas por defecto. B posee `app/backoffice/layout-guard.test.ts`, `app/backoffice/layout-billing.test.ts` y pruebas nuevas focales del provider/Inbox/streaming. Los archivos nuevos de tests y cualquier soporte compartido se nombran/reservan en A1. No dos escritores sobre el mismo test o contrato; QA no arregla el código que certifica.

### Recursos, entregas y aceptación

- **Coordinador:** único escritor de spec/ADR/INDEX/estado; administra factory, integración, M0/M1 y evidencia. A/B no editan documentación central ni hacen push. Informes propios: `docs/factory/0238-server-handoff.md` y `0238-client-handoff.md`; QA: `0238-combination-qa.md`. Paths reservados al iniciar cada tarea.
- **A y B:** worktrees/refs locales distintos desde base acordada, con contrato A1 común; dependencias/configuración seleccionadas por checkout, sin env PROD. Hasta tres worktrees operativos: A, B y QA/medición. Reutilizar el tercero en secuencia, sin crear un cuarto por benchmark. Builds base/candidato inmutables con artefactos separados; no modificar un checkout con servidor/captura activos.
- **DB y procesos:** unit/browser simulado pueden correr en paralelo. A/QA/medición reservan DB protegida para cada tramo real y teardown; nunca fixture/test concurrente durante bloques A/B. Cada servidor usa puerto inventariado propio; no reutilizar sesiones o servidores del owner.
- **Entrega individual:** commits solo del scope, checkout limpio para factory deliver, SHA/base, tests/comandos/resultados, inventario de consumidores, límites/fallos y procesos pendientes. El coordinador no acepta por un mensaje «terminado» ni copia PASS de otra revisión.
- **Salida funcional:** guards/reporters/precedencia/tenant conservados, streaming lento y rechazado observado, foco/remount/decisión sin respuestas viejas ni abortos cruzados, forms autorizados preservados. Si se adopta §4.3, negativos de cookie A→B y clientes sin cabecera; si no, limitación explícita.
- **Salida de rendimiento:** máximo4 lecturas comunes de página incluyendo módulos y3 de guard Inbox, conteos cliente de spec§4; ready vacío y cinco tarjetas con mejora demostrada y sin regresión de TTFB/pintura según receta. No confundir número de SELECT con tiempo SQL interno o cinco tarjetas con cinco filas.
- **Salida local:** QA de entrega y combinación identificadas; rollback conjunto 1+2+3 sin DDL. Si rendimiento no queda demostrado, registrar el resultado y corregir antes de declarar entrega cumplida. No añadir cachés/índices o cambiar la aceptación para obtener verde. Push/PROD requieren autorización nueva para ese caso; diferidos y FAIL histórico intactos.

## Contratos antes de delegar

1. Fijar tipo servidor, modos de selección, función pública de lectura por petición y proyección cliente versión 1, incluida recuperación de módulos y datos que nunca se serializan.
2. Decidir el propietario de cada dato: acceso del servidor; presentación inicial y revisiones del provider; efectos de Inbox en servicio vigente. No dos fuentes de módulos/roles que compitan por navegación.
3. Documentar helper compartido en Route Handlers, ámbito RSC y invalidación tras escritura. Probar que argumentos equivalentes no crean memorias independientes ni datos cruzados.
4. Inventariar superficies HTTP tocadas y su resultado anterior; GET sesión sigue reporter y POST Inbox conserva contrato 2/operationId/versiones. La consulta JOIN no introduce códigos nuevos.
5. Entregar juntos en A1 el protocolo de recuperación excepcional del JOIN, tabla de transiciones del provider y tickets de seed/peticiones de spec §3.2/4.1/4.2. No dejar que cada writer elija una semántica distinta. La versión del DTO no es revisión de frescura.
6. Resolver antes del cierre la propuesta adicional de ámbito de spec §4.3: cabecera opt-in, comprobación con datos de sesión ya validados,409 y compatibilidad con clientes sin ella. Es un cambio contractual explícito detectado en la revisión del autor, no un detalle aprobado implícitamente por el gate del adversarial sobre 20e81dfb. Si se acepta, reservar `app/backoffice/panel-request.ts`, `app/backoffice/settings/module-request.ts`, `app/backoffice/onboarding/onboarding-api.ts` y el helper común de guards para los consumidores adoptados; el escritor cliente conserva esas rutas. El writer de dominio de módulos/tours no cambia su cálculo ni esquema.

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

Reloj principal: inicio de navegación → Inbox utilizable en DOM. Instalar el observador antes de navegar y registrar la marca cuando ocurra, aunque el stream siga abierto. No esperar a `load`, DOMContentLoaded, networkidle o EOF para empezar a observar; esos hitos se registran aparte. Esto es indispensable para que el caso de módulos lentos no contabilice su fin como si fuera el comienzo del Inbox utilizable. Misma receta en base/candidato. Acompañar TTFB, primera pintura con contenido, comienzo/respuesta del Inbox, conteos HTTP/SQL y su solapamiento, auth/contexto/BEGIN/lock/lectura/efectos/COMMIT, conexión/espera cuando sean observables y bytes iniciales. Para HTTP distinguir cabeceras/cuerpo/decodificación; para driver WS el resultado; ejecución de PostgreSQL requiere otra evidencia y no se infiere de esos relojes.

Preferir un observador externo a la app para el tiempo principal y conteos. Si hace falta instrumentar servidor, misma instrumentación en base/candidato, con costo y límites declarados y sin logs de secretos. No mezclar una corrida solo navegador de base con una candidata cargada de trazas. Un problema del método produce resultado no demostrado, no PASS prestado.

Mediana/p95 de ambos ready deben mejorar y no empeorar TTFB/pintura según §6 de la spec. Adjuntar valores individuales, waterfall y conteos al informe; no solo porcentajes. Un incumplimiento vuelve a corrección, no a ampliar tablas/caché/DDL por cuenta propia. No repetir el benchmark anterior de evaluación fría como si fuera este experimento.

### Precisiones de recursos y recorridos (I1–I4)

La [comparación independiente con prácticas publicadas](0238-industry-review.md) propone estas precisiones de evidencia, sin añadir infraestructura ni modificar los gates temporales:

- **I1, recursos y CPU:** separar JS/CSS transferidos y decodificados hasta Inbox utilizable, documento/RSC y tamaño del seed; evitar doble conteo del RSC embebido. Registrar montaje/inicio del GET y caché por recurso. Una traza focal del hilo principal permite investigar análisis/ejecución, render y tareas largas; si altera el tiempo, hacerla fuera de la campaña cuantitativa y con el mismo método en A/B. No atribuir costo de bundles a imports sin comprobar chunks/Network del build.
- **I2, temperatura y topología:** congelar perfil/contexto, política de caché HTTP, reutilización de assets y prefetch iguales por fuente. Primera entrada en contexto limpio y recargas con assets reutilizados se distinguen del estado del servidor y DB. Registrar proxy local/Neon, transporte, TLS y ubicación; comparación local no demuestra cold starts ni latencia PROD. El pool WS ya existe; construir drizzle por llamada no demuestra una conexión nueva.
- **I3, transición:** añadir un recorrido diagnóstico A/B fijo de navegación interna con layout persistente y otro de cambio permitido del mismo ámbito con refresh, en fixtures propias. Registrar solicitudes/waterfall y estado final, conservación de formularios autorizados y ausencia de bucles/fan-out. No exige treinta repeticiones adicionales ni un nuevo gate de percentiles; comprueba que el costo no se desplazó fuera de la entrada.
- **I4, trabajo SQL:** durante A2/QA adjuntar SQL/proyección y plan del JOIN, con varias membresías, suscripción ausente y cardinalidades sintéticas declaradas. Reutilizar comprobación focal, wrapper y DB protegida reservada; ANALYZE ejecuta la consulta y solo se usa si es necesario. No exigir IndexScan universal ni añadir DDL. Manifiesto distingue volumen total, candidatas/controles del negocio y tarjetas visibles: cinco tarjetas no equivalen a cinco filas leídas.

Estas precisiones no autorizan instalar APM/RUM, operar PROD, rehacer bundles, optimizar lifecycle ni reabrir el FAIL histórico. Las muestras describen esta campaña, no capacidad, p99 poblacional o un SLO de producción.

El [segundo contraste independiente con código/backend](0238-applicability-review.md), sobre `c642af5a`, confirma pertinencia de 1+2+3 y de estas precisiones; no valida el delta documental posterior ni una implementación. Mantener pequeño el provider y reutilizar la máquina de Inbox. Si se acepta `scopeKey`, distinguir `backoffice_context_changed` del 409 genérico de conflicto de tarjeta antes de reintentar/releer. La decisión de ámbito sigue pendiente; ninguna de estas revisiones la sustituye.

### Control de deriva y estimadores, a congelar antes de M0 (R1)

Preparación operativa M1 (sin ejecutarla): artefactos privados `preload-m1.mjs` y `runner-m1.cjs` separan trace/logs/PIDs de M0 para no anexar resultados posteriores al baseline histórico. Solo cambia el destino de salida del preload; control A y candidato B usarán el mismo archivo M1. Runner exige `ci-preflight-m1.json` fresco antes de arrancar y build requiere raíz explícita. Sintaxis Node24 comprobada, no representa medición nueva.

Analizador M1 preparado antes de la campaña: `/private/tmp/checkpass-0238/artifacts/analyze-m1.py`, SHA256 `37e20d531962c5f7628e756405006ebbb67af02b73352aff829ca6d9bf1be9db`. QA independiente comprobó fórmulas y escenarios sintéticos separados (mejora, regresión, intento inválido); detectó aceptación de caso vacío renombrado como cinco en versión anterior a7ff, corregida y revalidada: exige ready-empty/ready-five e IDs/respuestas0/5 coherentes. No hubo medición real. Reutiliza seis pares/10000/semilla congelada, intervalos percentil95 del delta B−A, reloj observado y primeras entradas separadas. Salida boolean false con EXIT0 significa análisis terminado con criterio no demostrado, nunca PASS. Orden createdAt no demuestra ausencia de solapamiento: el coordinador conserva evidencia de ejecución secuencial y configuración/fixtures reales. Controles SQL/HTTP/seguridad/streaming y tamaño de seed siguen independientes del cálculo temporal.

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

Añadir fallo exclusivo de subscription para denegaciones previas y caller autorizado, sin fail-open ni PIN adelantado; rama que omite billing, segundo fallo y recuperación con selección consistente. Cliente: reporter con membresía/negocio nulos, navegación interna con layout persistente, transición restricted→ready y seed/RSC tardío después de mutación. B1/B2 del [informe adversarial](0238-adversarial-review.md) siguen como aceptación, con la precisión posterior de U2: navegación completa solo ante pérdida/cambio de ámbito, no por cualquier cambio de permisos/acceso. Preservar edición local de un formulario todavía autorizado tras trial→subscribed, módulo, nombre o permiso no relacionado; reconciliar RSC sin bucle ni cambio de keys.

Si se acepta U1, probar cambio de cookie entre render/intención y fetch sin foco, también con la misma cuenta pero sesión nueva; marca capturada antes de un await; GET/acciones Inbox, módulos/toggle y checklist/tours. Con marca A/cookie B no hay efecto o lectura de dominio de B y no se reintenta la escritura con otra marca. El header no concede acceso ni cambia el selector del guard; clientes sin header y reporter conservan contratos. Inventariar superficies adoptadas para no afirmar que cualquier API del producto ya implementa el protocolo.

Cliente: browser con seed y red observable; cero GET auxiliares de montaje con seed ready,1 GET Inbox, reintento y foco coordinados, cambios de módulos, cierre de sesión/respuestas tardías y carreras del Inbox. Contratos HTTP simulados sirven para interacción, smoke de app real para cableado. Tipos/lint/guardia UI focales; no cambiar kit/guard para evitar rojo.

Entrega: SHAs de autor, base y candidato; tabla criterio/resultado; logs de comandos, fallos/skips, límites y pendientes; matriz de consumidores de helpers modificados; comparación M0/M1 y reversión conjunta sin DDL. QA de entrega y de combinación separadas. Main local después de gates pertinentes; publicación solo por nueva autorización y pre-push vigente. Ningún PASS en esta documentación: aún no hay código de 0238 ni M0 comparable.

## Revisión adversarial del diseño

El [informe independiente](0238-adversarial-review.md) revisó `03949d2e`: B1/B2 impedían cerrar el contrato; R1–R4 concretaban la ejecución. El mismo agente revalidó el delta congelado `20e81dfb`: **B1/B2 cerrados documentalmente y R1–R4 incorporadas, sin bloqueantes restantes de esa revisión**. Su precisión de observar contenido utilizable antes del cierre del stream queda explícita en esta receta. No se cambia el estado de ADR propuesto/spec borrador por una revisión técnica ni se declara PASS de producto. El diagnóstico anterior de rendimiento y los diferidos siguen vigentes.

El owner pidió después revisión del coordinador. La [revisión del autor](0238-author-review.md), no independiente de la redacción, encontró U1 (vinculación de intención/ámbito efectivo) y U2 (pérdida de formularios por navegación completa innecesaria). U2 corrige las transiciones hacia refresh del mismo ámbito; U1 queda propuesto con un contrato aditivo pendiente de aceptación antes del cierre/M0. No atribuir al agente validación de ese protocolo posterior ni extrapolar su dictamen a un diseño sin asuntos abiertos. Este turno sigue sin código de producto ni nueva medición.
