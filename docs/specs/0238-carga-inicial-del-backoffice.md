---
spec: 0238
fecha: 2026-10-17
estado: cerrada
resumen: Reducir lecturas y peticiones repetidas del backoffice compartiendo datos por petición, entregando contexto inicial al navegador y uniendo la lectura de membresía/negocio con facturación; medir el resultado combinado sin cambiar acceso ni ciclo del Inbox.
disjunta: no; contrato servidor/cliente y guards compartidos requieren integración serial y QA de combinación.
archivos: apps/merchant/src/server/auth-guards.ts; server/api-owner.ts; server/api-permission.ts; server/billing-gate.ts; server/session-view.ts y nuevos helpers de contexto; server/onboarding/checklist-facts.ts; app/backoffice/layout.tsx y page.tsx; navegación, trial-notice, contexto cliente e inbox-state; rutas auxiliares afectadas y tests focales. Sin cambios al kit, esquema o migraciones.
---

# 0238 — Carga inicial del backoffice

Piso L2 por autenticación/tenant; alcance transversal acotado según ADR 0144 y `VERIFICACION.md`. Implementa la propuesta [ADR 0154](../adr/0154-contexto-del-backoffice-por-peticion.md). El owner eligió las mejoras 1, 2 y 3 juntas y medición posterior. El owner autorizó iniciar la implementación por checkpoints y aceptó explícitamente `scopeKey` de §4.3 (2026-10-18 UTC). Contrato cerrado para implementar con ADR0154 aceptado; no declara producto implementado, QA aprobado ni autorización de push/PROD.

## 1. Problema y comportamiento esperado

La [medición de Joyas](../factory/0237-inbox-measurement.md) encontró 9 consultas de página, 4 parejas exactas duplicadas, efectos repetidos de módulos/sesión y 4 lecturas secuenciales de acceso por GET Inbox. Las dos recargas dev mostraron el Inbox vacío listo en 4185/4624 ms. No comparar esos tiempos con un build de entrega ni extrapolar Strict Mode a PROD.

Al entrar, los consumidores comparten contexto inicial de negocio, navegación y prueba. El servidor resuelve cada dato común una vez por petición compatible y reduce viajes SQL de acceso. Inbox sigue siendo legible/accionable con la misma semántica. El cambio debe disminuir trabajo y mejorar el tiempo hasta avisos utilizables en medición comparable.

## 2. Alcance de la propuesta

Incluye las tres mejoras:

1. Contexto de datos por petición para página/layout, guards y consumidores auxiliares afectados. Reutilización de promesas y filas, con decisiones de acceso separadas.
2. Contexto inicial mínimo enviado a navegación/TrialNotice y propietario cliente único de módulos/sesión. Deduplicación de peticiones en curso y refrescos del Inbox.
3. Lectura combinada de membresía/negocio y suscripción con filtros/selección equivalentes; reuso de la fila de facturación para acceso y plan. Better Auth mantiene su obtención de sesión/usuario. Paralelismo solo entre cargas independientes.

No incluye caché de autorización entre peticiones, caché de cookie/JWT/Redis/CDN privado, nuevas tablas/índices/migraciones, servicios de realtime, actualización por venta, fórmulas o tarjetas nuevas, equilibrio mensual/diario ni avance del Dashboard, cambios de UI visual, schema de módulos, filtros de permisos nuevos, refactor de todos los guards del sistema, corrección de CI histórica o nuevos crons. Los números del Dashboard son un encargo futuro, no criterio de esta spec.

La revisión posterior del autor detectó un hueco de vinculación entre la intención del cliente y la cookie vigente. §4.3 añade una cabecera de ámbito y un 409 opt-in, aceptados explícitamente por el owner tras explicar el ejemplo de UI deA/cookie deB. La aceptación es adicional a elegir las mejoras 1+2+3. Ver [revisión del autor](../factory/0238-author-review.md).

## 3. Contrato servidor

### 3.1. Datos y ámbito

Nuevo helper servidor de contexto con sesión Better Auth, datos de negocio/membresía, fila nullable de suscripción y reloj de petición. Solo servidor. Factores de selección nombrados y tipados:

| Modo | Selección que debe conservar |
| --- | --- |
| Página y reporter de sesión | Primer negocio por `createdAt ASC`, `limit(1)` con membresía del usuario, incluido estado no activo para aplicar su comportamiento específico |
| API por permiso | Membresía activa, cualquier rol, mismo orden/limit actuales |
| API owner | Membresía activa y rol owner, mismo orden/limit actuales |

No añadir desempates, filtrar estados de negocio, ni escoger otra membresía al hacer JOIN de suscripción. Suscripción ausente continúa siendo dato ausente; no elimina la fila del negocio. `core_subscription_business_unique` asegura relación 0..1.

Dentro de un render, misma identidad+modo comparte promesa; parámetros como `{allowBlocked:true}` no deben generar accidentalmente otra lectura del mismo dato. Route Handlers comparten mediante contexto explícito de la petición, no un Map global ni la confianza en que React.cache funciona allí. Peticiones concurrentes de usuarios diferentes no comparten resultados. No reutilizar lecturas tras mutación; writers siguen validando estado/entitlements dentro de su transacción cuando corresponde.

### 3.2. Guards y precedencia

Conservar firmas públicas, nombres con/sin gate de email, códigos HTTP, mensajes, redirects, motivo de suspensión solo owner, PIN temporal, revocación de sesiones donde ya existe y reglas de owner/staff. No agregar un flag público que desactive controles. Factores puros existentes de facturación, permisos y estado siguen siendo la fuente de decisiones.

En particular: layout admite bloqueado para renderizar cobro; página aplica su gate. GET sesión sigue siendo reporter 200, incluso sin sesión, negocio bloqueado/suspendido o membresía no activa, con la misma proyección pública y sin nuevas revocaciones. Una API invocada directamente valida de nuevo, independientemente de haber cargado el Dashboard.

La consulta puede traer facturación con membresía, pero un caller sin permiso no debe recibir información de facturación/estado ni cambiar de error por esa lectura anticipada. Preservar también errores operativos: una falla de obtención no se convierte en acceso concedido ni un estado de éxito inventado.

**Fallo del JOIN y precedencia (B1).** Si falla la obtención combinada después de validar la sesión, permitir una única recuperación excepcional de membresía/negocio sin suscripción. Usar la misma sesión, modo, filtros, orden y límite; compartir el resultado excepcional en ese Request y no volver a intentar el JOIN automáticamente. Aplicar con esa fila íntegra solo las decisiones que ese wrapper evalúa antes de necesitar billing. Si corresponde una denegación anterior, conservar su código o redirect; si alcanza un gate que necesita billing, propagar el error operativo original, sin conceder acceso ni convertir el error en suscripción ausente. Un segundo fallo de obtención permanece operativo. No mezclar datos parciales del JOIN fallido con la fila recuperada ni cambiar de negocio/modo buscando uno permitido.

En APIs de permisos, el PIN se evalúa **después** de billing: no adelantarlo para ocultar un billing desconocido. En páginas, `allowBlocked` y owner suspendido pueden omitir billing dentro del guard, pero los consumidores que necesitan facturación para presentar el shell/plan todavía deben tratar su fallo explícitamente. No prometer un snapshot histórico que la base no tenía entre lecturas separadas. Mantener controles transaccionales de writers. La recuperación excepcional cuenta y se mide aparte; no se excluye de los tiempos ni del informe total.

### 3.3. Objetivos de consultas, condiciones normales

No contar renovación excepcional de Better Auth ni datos adicionales de un caso de error como duplicación normal; reportarlos separados.

- Página+layout: una resolución de sesión Better Auth y una consulta de contexto página que incluya facturación; desaparecen las 4 parejas medidas y el SELECT extra de plan/status. Con el adaptador actual, objetivo 3 lecturas de datos comunes más 1 de módulos para el contexto inicial: **máximo 4**, frente a 9 anteriores que no incluían módulos iniciales.
- Guard de API Inbox: sesión/usuario actuales de Better Auth y 1 consulta de contexto permiso con facturación: **máximo 3 lecturas**, frente a 4. No sustituir Better Auth para alcanzar el conteo.
- Checklist: segunda lectura de sesión/usuario del mismo Request se reutiliza; su consulta de tours sigue independiente y restringida al negocio del guard.
- Toda reducción se demuestra con conteo real, diferenciando SELECT de datos, lock,BEGIN/COMMIT y escritura de renovación. No ocultar trabajo trasladándolo a otra API: medir el conjunto de la entrada.

Si el adaptador o una dependencia impiden un objetivo sin cambiar seguridad/semántica, registrar el desajuste y revisar el diseño antes de relajar el criterio o introducir un atajo.

## 4. Contrato inicial y coordinación del cliente

El layout entrega una proyección de presentación `BackofficeInitialContext`, interna y serializable: versión de contrato 1, ámbito opaco de usuario/negocio, negocio mínimo, permisos efectivos/rol, facturación pública de `SessionBilling`, y módulos con el contrato existente necesario para navegación. Reutilizar tipos/constructores actuales donde corresponda. Plan/status privado que usa la página no debe filtrarse en GET sesión. Sin token, sesión cruda, headers, IP, identificadores Stripe ni motivos internos de staff.

Estado de módulos: `{state:'ready', modules:[...]}`, `{state:'unavailable'}` o `{state:'restricted'}`. El seed evalúa las mismas condiciones de acceso y ámbito de GET módulos antes de serializarlo: que el layout admita acceso bloqueado/suspendido para mostrar su estado no concede acceso a información que la API deniega. Restricted no dispara recuperación automática; vuelve a evaluarse tras un cambio de contexto. Error de lectura no concede links ni invalida una sesión válida: navegación core y el resto de página permanecen utilizables; recuperar por revalidación coordinada. No convertir un error en ready vacío ni esperar un servicio remoto opcional sin límite en el camino crítico. La lectura usa DB core/local de módulos existente, no tablas ni llamadas externas de cada módulo. La consulta combinada del contexto incluye categoría y metadatos core necesarios para construir el DTO de módulos, evitando otra consulta al negocio.

Aplicar las decisiones del guard de módulos sobre el contexto ya elegido y validado de la página, sin invocar otra vez un guard HTTP que reabra sesión/selección. Una primera membresía de cualquier estado que resulta activa y pasa el guard de página satisface, para ese ámbito, la condición de primera membresía activa; no es una autorización para reutilizar el modo owner o cambiar de negocio. Si la página selecciona una membresía no activa, aplica antes su revocación/redirect y no produce seed de módulos. Compartir evaluadores puros de los gates, no copiar una segunda escalera divergente. Probar equivalencia en usuarios con múltiples membresías y mantener el orden existente, sin añadir desempates nuevos.

**Composición elegida para módulos (R3).** Separar el seed core del seed opcional de módulos. El provider recibe el core autorizado y puede montar Inbox/core sin esperar módulos. Un componente servidor asíncrono dentro de una frontera Suspense propia obtiene módulos y entrega al mismo provider el resultado final; mientras tanto hay un estado cliente `loading` que solo oculta enlaces de módulos. No suspender todo el provider, layout o Inbox por esa lectura. No añadir un `Promise.race` que deje trabajo/rechazos sin observar: el componente servidor espera la consulta bajo los límites ordinarios del driver/hosting, captura el fallo y entrega `unavailable`; denegación entrega `restricted` sin leer módulos. Un smoke de módulos lento debe demostrar contenido e Inbox utilizables antes de que termine esa lectura. El rechazo tardío y una navegación interrumpida no deben iniciar recuperaciones huérfanas ni actualizar otro ámbito. Medir tanto el contenido utilizable como el fin del stream y sus recursos; el trabajo de módulos no desaparece del conteo total por usar streaming.

Un provider compartido en el árbol cliente consume el seed. Durante montaje sin invalidaciones, para owner con acceso:

| Recurso | Peticiones desde navegador en build de entrega |
| --- | --- |
| Sesión | 0: navegación y TrialNotice usan seed |
| Módulos | 0 si seed ready; como máximo 1 recuperación si unavailable |
| Inbox | 1 |
| Checklist | Como máximo 1, conservando sus condiciones actuales |

Sin doble consulta inicial de módulos por efectos distintos. Compartir promesas en curso también en remounts de Strict Mode para estos consumidores, sin desactivar Strict Mode ni depender de flags NODE_ENV para esconder duplicaciones.

Las siguientes causas invalidan o actualizan el estado: operación exitosa que cambie módulos/permisos/acceso, evento existente de módulos, logout/cambio de identidad/negocio, foco después de la carga inicial y reconexión. Datos de mutaciones aplicados antes de refetch; un resultado viejo nunca pisa una revisión más nueva. Un refresco simultáneo tiene 1 solicitud en curso por recurso/ámbito, con como máximo 1 refresco pendiente si hubo cambio durante ella. Nueva identidad descarta promesas/respuestas anteriores; error no conserva permisos como credencial para APIs ni recupera datos de otro negocio.

No persistir este contexto en localStorage/IndexedDB ni usarlo para dar permiso en servidor. Todas las APIs siguen validando. Una revalidación fallida presenta estado de recuperación; una respuesta sin sesión o de identidad distinta limpia el contexto anterior y sigue la navegación de acceso vigente. Conservar estados de error/accesibilidad de los consumidores con componentes del kit existente.

### 4.1. Seed, layout persistente y transiciones (B2)

La versión 1 del contrato describe su forma, no su frescura. Cada arranque servidor del árbol tiene un `bootId` opaco, sin valor de autorización. El provider conserva una época local de identidad/acceso y una generación por recurso. El seed core inicializa el provider una sola vez por documento; el seed de módulos en streaming se acepta solo para ese `bootId` y si su generación inicial no fue invalidada. Una mutación o revalidación cierra esa aceptación inicial. Llegar después no convierte un seed en más reciente.

Nuevas props RSC del mismo ámbito, incluidas las de `router.refresh`, no reemplazan directamente datos vivos del provider: provocan como máximo una revalidación coordinada por cada `bootId` nuevo, sin reutilizar la instantánea llegada como prueba de frescura. Si cambia el ámbito de esas props, ocultar primero los datos privados anteriores y confirmar la identidad actual con el reporter; no instalar un ámbito nuevo desde un seed posiblemente prefetcheado. No crear una revisión persistida ni comparar relojes de servidores para decidir causalidad.

| Resultado o evento | Transición obligatoria |
| --- | --- |
| Core inicial válido y módulos en streaming | Montar core/Inbox; aplicar módulos solo si su ticket inicial sigue vigente |
| Mutación local confirmada | Avanzar generación antes de aplicar el DTO confirmado; resultados GET/RSC anteriores no lo sobrescriben; una lectura posterior intencional tiene ticket nuevo |
| Reporter `authenticated:false` | Invalidar épocas/promesas y retirar datos de negocio/Inbox; navegación completa a la entrada vigente |
| Reporter `authenticated:true` con `business:null`, `membership:null` o membresía no activa | Retirar negocio, menús y tarjetas aunque userId no cambie; una única navegación completa a `/backoffice` para que el guard aplique su revocación/redirect vigente; el reporter no revoca |
| Cambia sesión, identidad o negocio | Retirar el ámbito anterior e invalidar recursos; una única navegación completa al backoffice para establecer el nuevo documento/contexto |
| Mismo ámbito: cambia rol, permisos efectivos, estado de negocio o `billing.access` | Actualizar contexto e invalidar recursos afectados; reconciliar decisiones servidor con un `router.refresh()` coordinado cuando haga falta, conservando estado cliente no afectado y todavía autorizado; si los gates retiran acceso a la ruta, seguir su salida vigente |
| Misma identidad y estructura, cambia presentación | Actualizar coherentemente nombre, datos públicos de prueba y módulos en consumidores del provider; no conservar props de navegación paralelas como otra fuente de permisos |
| Módulos `restricted` | Sin timer/bucle de retry; un foco posterior, reconexión o evento relevante de sesión/email/acceso permite una única reevaluación coordinada del contexto y, si corresponde, una solicitud al endpoint para decidir el gate completo |
| Error operativo de revalidación | Marcar recuperación; no convertirlo en logout, contexto vacío confirmado ni acceso concedido; un reintento intencional inicia transporte nuevo |

Las navegaciones completas son excepcionales ante cambio/pérdida del ámbito, no por cada actualización de permisos, suscripción, módulos o foco. Cada transición solo puede iniciarlas una vez por época; el guard del documento nuevo decide la ruta final. El refresh del mismo ámbito no cambia keys ni reinicializa formularios todavía autorizados, y su nuevo seed no provoca otro refresh en bucle. Trial→subscribed, días de prueba, nombre o un permiso nuevo no descartan por sí solos la edición. Si el servidor retira acceso, no se mantienen capacidades revocadas para preservar el formulario. El reporter actual no expresa por sí solo todos los gates de GET módulos, incluido PIN: el cliente no infiere acceso completo a partir de sus campos; el endpoint y la construcción autorizada del seed siguen siendo la autoridad.

### 4.2. Propiedad de promesas, mutaciones y abortos (R4)

El provider del documento posee las peticiones compartidas, con clave de recurso+época+generación. Las entradas se eliminan al resolver o rechazar, con comparación del ticket para que el `finally` de una petición vieja no borre una nueva. Compartir una petición no conserva su respuesta como caché de transporte. Cada consumidor registra su suscripción: desmontarse o limpiar un efecto no aborta la petición que todavía usa otro. En el desmontaje real del último consumidor puede cancelarse tras comprobar que no hubo una suscripción de reemplazo del remount de Strict Mode; observar siempre el rechazo. Cancelar fetch no se presenta como prueba de cancelar la operación SQL del servidor.

Una decisión Inbox invalida el ticket anterior antes de aplicar su respuesta, conserva `operationId`/versiones y garantiza que el refresco posterior no se adhiera al GET previo a esa decisión. Mantener como máximo un transporte vigente y un refresco pendiente por recurso; una petición vieja invalidada se cancela o se drena con resultado descartado antes del transporte pendiente, sin iniciar fan-out. No esperar a una promesa de otra identidad para limpiar datos privados. Los temporizadores de vencimiento/recordatorio/preparing y la cola durante mutación se conservan. Checklist usa el mismo régimen de suscripciones: el AbortController de un efecto no cancela una lectura usada por otro.

### 4.3. Vincular peticiones al ámbito visible — contrato aceptado (U1)

Los tickets locales evitan carreras conocidas por el provider, pero no detectan por sí solos una cookie cambiada en otra pestaña. No garantizar aislamiento entre el contexto visible y la operación usando únicamente una generación del navegador.

Contrato aceptado: el seed incluye `scopeKey`, marca opaca estable para sesión Better Auth, usuario y negocio seleccionados. Calcularla en servidor mediante HMAC-SHA256 con el secreto existente de auth, mensaje canónico exacto `JSON.stringify(["backoffice.scope.v1", session.id, user.id, business.id])` y salida hexadecimal minúscula de 64 caracteres. Validar que esas identidades proceden de la sesión/contexto íntegros; no firmar valores ausentes. No serializar sesión/id de sesión, token o secreto; no usar `bootId` como sustituto de esta marca. Renovación ordinaria de una misma sesión no cambia el ámbito; un nuevo login que crea otra sesión sí. No añadir estado persistido ni consulta extra para construirla: todos los datos proceden del contexto autenticado.

Los transportes adoptados por el provider envían `X-Backoffice-Scope` con la marca **capturada al iniciar la intención**. No toman otra marca de una variable global después de un await ni la sustituyen en un reintento. La clave de petición compartida incluye esa marca además de época/generación. El servidor primero valida la cookie y todos los gates existentes; después valida longitud/formato y compara la marca esperada con la del contexto actual en tiempo constante y antes de cualquier lectura de dominio, exposición o escritura. No usa la cabecera para seleccionar usuario/negocio, evitar un guard o conceder permisos. Si no coincide o está mal formada, responder 409 con `{code:'backoffice_context_changed', error:'Tu sesión cambió. Actualiza el panel para continuar.'}` sin revelar el ámbito actual, ejecutar dominio ni reintentar la escritura. El cliente invalida datos y vuelve una sola vez al backoffice; requiere una intención nueva antes de escribir en el nuevo ámbito. Respuestas privadas adoptadas y 409 usan `Cache-Control: private, no-store`; no introducir caché HTTP de contexto privado ni guardar marcas en logs/HAR de entrega.

La cabecera es opt-in por compatibilidad: clientes existentes sin ella mantienen el contrato actual y sus guards, sin garantía nueva de vinculación a una pantalla previa. Los consumidores migrados de Inbox GET/acciones, módulos GET/toggle y checklist GET/acciones de tours deben enviarla siempre tras obtener el seed; no enviar una operación adoptada sin su ámbito listo. Contexto y cabecera no son credenciales adicionales: omitir/forjar la marca nunca evita la autenticación o autorización ordinarias. GET sesión y endpoints de auth quedan exentos para descubrir/cerrar la sesión actual.

El helper servidor se ubica en la ruta común de los guards HTTP afectados, con inventario de consumidores y regresión de los no adoptados; el reporter conserva su comportamiento. Nuevos clientes no suponen que una API soporta la marca sin cobertura de su guard. Respuestas tardías se comparan además con el ticket local original. La protección no promete detectar instantáneamente una cookie cambiada sin interacción/señal; sí impide atribuir una respuesta o escritura del ámbito B a una intención del ámbito A en las superficies adoptadas.

Esta sección amplía explícitamente el contrato HTTP y fue aceptada por el owner después de las revisiones y del ejemplo entre pestañas. El dictamen adversarial sobre20e81dfb no validó este protocolo posterior. El reporter legado no distingue un nuevo login de la misma cuenta/negocio: la siguiente petición adoptada con marca anterior produce409 y recupera el documento; no prometer detección inmediata sin interacción ni añadir campos al reporter.

## 5. Contratos HTTP y ciclo del Inbox

No se agrega endpoint bootstrap. JSON de éxito, autorización y contratos de clientes sin cabecera permanecen iguales. El contrato opt-in de §4.3 añade la cabecera de ámbito y el 409 indicado para peticiones adoptadas; no afirmar que todos los códigos HTTP permanecen idénticos en ese caso.

| Superficie | Compatibilidad requerida |
| --- | --- |
| `GET /api/merchant/session` | Misma forma JSON y reporter 200; no amplía datos privados ni se convierte en guard |
| `GET /api/modules` | Mismos módulos, permisos, estado y códigos vigentes; autorización propia |
| `GET /api/onboarding/checklist` | Misma forma, estados de error y exclusividad owner; contexto de sesión compartido dentro del Request |
| `GET /api/analytics/inbox` | Contrato 2 intacto: ready/preparing, timezone, preparedAt, nextReminderAt, refreshAfterMs y cards; mismos códigos de error |
| `POST /api/analytics/inbox/:id/:decision` | Versiones, operationId, idempotencia, carreras, decisiones, privacidad y límites de recordatorio de 0237 sin cambios |

Como parte de §4.3, añadir al contrato del toggle `PUT /api/modules/:moduleId` y tours `POST /api/onboarding/tours/:tourId` la misma comprobación antes del writer, sin cambiar su dominio. Una denegación de un guard actual sigue precediendo al 409 de ámbito; `operationId` no se reutiliza automáticamente en otro ámbito.

El GET Inbox permanece iniciado por componente visible. SSR/prefetch del shell no llama a `readInbox`, no dispara evaluación diaria ni registra exposición. Deduplicar GET simultáneos no los convierte en un caché persistente: un refresco intencional posterior hace una lectura nueva. Mantener expiración local, recordatorios, fallback de 3 s, try-lock sin espera, decisiones optimistas vigentes y protección frente a respuestas tardías. No trasladar efectos a `useMemo`, render, cálculo de navegación ni un layout prefetcheado.

## 6. Evidencia y aceptación

### Funcional y aislamiento

- Matriz real y focal: sin cookie, forjada, expirada, revocada entre peticiones; owner/staff; pertenencia/permiso ausentes; membresía desactivada; negocio suspendido/cerrado; suscripción ausente/prueba vencida; email y PIN según cada ruta. Mismos resultados/códigos/precedencia y privacidad que la base.
- Dos usuarios/negocios intercalados; usuario con varias membresías y filtros distintos; modo página frente a permiso/owner; ningún dato cruzado ni cambio accidental de negocio.
- Dos peticiones separadas observan una revocación, cambio de permisos/módulos o vencimiento de acceso ocurrido entre ambas. Una página prefetcheada no habilita una acción posterior revocada.
- Seed sin GET auxiliares, un Inbox/un checklist por montaje; focos/eventos simultáneos, errores y reintento, logout y respuesta tardía; compatibilidad con las carreras de `inbox-state` ya cubiertas.
- Inbox real protegido con 0 y con hasta 5 tarjetas: mismo contenido/acciones, exposición una vez por reglas existentes, recordatorio, expiración, contención/preparing y acciones conservadas. Sin skips/retries para declarar PASS.
- Falla exclusiva de la lectura que referencia suscripción: permiso/email/estado denegados conservan precedencia; caller autorizado que necesita billing sigue fallando; PIN no se adelanta; fallback usa misma selección y no mezcla filas. Distinguirla de una caída total de DB.
- Navegación interna con layout persistente, reporter con membresía/negocio nulos, cambio de rol/permisos, restricted→ready con misma identidad y seed/RSC tardío tras mutación. Formularios todavía autorizados conservan su edición tras trial→subscribed, cambio de nombre, módulo y permiso no relacionado; cambios de ámbito sí retiran datos anteriores. Sin bucles de refresh.
- GET Inbox lento→decisión confirmada→remount/foco→respuesta vieja; reintento después de rechazo produce petición real nueva. Desmontaje de un consumidor checklist no aborta al que permanece. Módulos lentos/rechazados no bloquean el Inbox ni dejan rechazo sin observar.
- Protocolo de ámbito aceptado: cookie A→B sin foco entre render/fetch; nuevo login de la misma cuenta; payload tardío y callbacks de intención anterior; actor con membresía staff en A y owner en B; toggle/acción de tours/Inbox con marca A y cookie B. No operaciones de dominio en 409, sin reintento de escritura en B, marca sin autoridad y clientes sin cabecera compatibles.

### Rendimiento del conjunto

La [ficha](../factory/0238-plan-carga-backoffice.md) fija receta y recursos antes de correr. Referencia y candidato: build de entrega, mismo host/runtime/config/dataset, política, observador y red. Nunca PROD ni cookie/sessionstorage del navegador del owner. La referencia comparable se captura **antes del código**, como preparación del experimento; la medición de resultado se hace **después de integrar 1 + 2 + 3**, sin evaluaciones parciales para escoger un resultado favorable.

Por revisión/caso: primera entrada conservada separada y 30 recargas con rutas ya usadas, sin descartes por tiempo ni retries. Separar ready vacío, ready con 5 tarjetas, preparing y contención. La distribución cuantitativa requerida corresponde a los 2 casos ready; preparing/contención requieren recorrido completo y contrato temporal correcto, sin mezclarlos en su percentil. Incluir TTFB/pintura, comienzo/respuesta Inbox, momento de contenido utilizable, número de HTTP/SQL, etapas de acceso/conexión/transacción y tamaño serializado. Medir carga conjunta de auxiliares y efectos, no solo el SQL más rápido.

Aceptar rendimiento solo si: (a) se cumplen conteos/semántica anteriores; (b) mediana y p95 del tiempo hasta Inbox utilizable mejoran en **ambos casos ready**, con trazas que vinculen la reducción al trabajo eliminado; (c) TTFB y primera pintura no empeoran en mediana o p95. Sin margen de regresión inventado ni SLA absoluto nuevo. Si hay ruido o falla, resultado no demostrado/FAIL; conservarlo y corregir causa/método antes de una nueva tanda justificada. No cambiar fixture, sacar red o asumir que falló la DB por duración HTTP. No se exige 30 renders de contención ni 30 generaciones diarias para inflar el experimento.

El FAIL anterior `evaluateBusiness`1817,621042 ms>1000 ms mide otro contrato. Esta spec no lo sustituye, reabre ni acepta. No comparar base en desarrollo con candidato con build de entrega ni el mínimo de una tanda contra el promedio de otra.

**Control del experimento (R1/R2).** M0 congela receta, estimadores y estado temporal; M1 incluye también la base sin optimizar ejecutada en la misma ventana que el candidato, con bloques A/B predeterminados, no solo una comparación contra mediciones de días anteriores. La ficha concreta orden, percentiles, incertidumbre y manifiesto de fixtures. Los percentiles no demuestran por sí solos causalidad; si las condiciones o la incertidumbre no permiten sostener mejora/no regresión, el resultado es no demostrado. Primera exposición, exposición de recarga y cambios de día/vencimiento se distinguen; restauraciones solo fuera del reloj y en datos sintéticos protegidos, sin sacar efectos del tiempo medido.

El observador se instala antes de la navegación y marca Inbox utilizable mientras el stream puede seguir abierto; `load`, DOMContentLoaded, networkidle y EOF son métricas separadas y no condiciones para empezar a observar. La revalidación adversarial de `20e81dfb` cerró B1/B2 y comprobó R1–R4; el [informe](../factory/0238-adversarial-review.md) distingue ese cierre documental de cualquier futura aceptación de producto/rendimiento.

La comparación con prácticas publicadas añade precisiones I1–I4 en la [receta](../factory/0238-plan-carga-backoffice.md): bytes y CPU observables, caché del navegador frente a servidor/DB, recorridos diagnósticos con layout persistente y evidencia focal de proyección/plan del JOIN y cardinalidades. No cambia los gates anteriores ni exige infraestructura, optimización de bundles o nuevas migraciones. El [informe de industria](../factory/0238-industry-review.md) revisa el diseño documental; no certifica implementación, rendimiento PROD ni sustituye la aceptación explícita posterior de §4.3.

## 7. Archivos, dependencias y checks

Servidor: nuevos helpers de contexto y proyección en `apps/merchant/src/server/`; wrappers de `auth-guards`, `api-owner`, `api-permission`, `billing-gate`, contexto de staff y checklist; reporter GET sesión y GET módulos solo si necesitan compartir constructores conservando contratos. Excluir operaciones de escritura de staff y resto de flujos salvo regresiones comprobadas del helper.

Asignar además `apps/merchant/src/modules/activation.ts` únicamente para extraer/reutilizar constructor puro y lectura con categoría precargada; conservar mutaciones, locks y políticas de activación. El límite de módulos no autoriza tocar schema ni código de otros módulos.

Cliente: `app/backoffice/layout.tsx`, `page.tsx`, nuevo provider/hooks, `backoffice-navigation.tsx`, `subscription/trial-notice.tsx`, `settings/module-request.ts`, `analytics/inbox-state.ts` y checklist si requiere el deduplicador. No modificar kit/guardias/CSS para pasar un check. Contrato de contexto es dependencia común con un escritor, definido antes de sus consumidores.

Pruebas focales de guards/reporters/billing/tenant, datos/consultas y browser de provider/Inbox; typecheck/lint/guardia UI para archivos afectados. DB real solo mediante `tools/neon-test.sh`, aislada/reservada y con inventario previo del ledger. Smoke de app con build real indispensable para comprobar cableado y medidas; los browsers con HTTP simulado no lo sustituyen. QA independiente de entrega y combinación según ADR 0144; no afirmar que una revisión del autor es independiente. No ejecutar verify global como trámite de documentación o de cada fix; release conserva pre-push vigente.

## 8. Definition of Done

- [x] Spec y ADR revisados y cerrados/aceptados, incluida aceptación explícita del contrato de ámbito de §4.3; reserva documental local antes del código.
- [ ] Las 3 mejoras integradas con contrato inicial versionado y sin cambios de acceso/ciclo.
- [ ] Matriz de aislamiento/precedencia y negativos reales PASS; guards compartidos revisados en todos sus consumidores afectados.
- [ ] Conteos de página/API/navegador comprobados en app real y Strict Mode sin ocultar duplicación.
- [ ] Comparación de build base/candidato satisface la aceptación o se registra FAIL sin declarar trabajo entregado.
- [ ] QA independiente, combinación y handoff ligados a SHA/entorno, con fallos/skips y límites explícitos.
- [ ] Sin DDL/PROD/push ni incorporación de los diferidos; rollback local documentado y artefactos privados protegidos.

## 9. Reversión y límites

Revertir los commits de producto como conjunto 1 + 2 + 3 en integración local; no hay cambios de esquema/datos que revertir. APIs públicas compatibles permiten volver a los consumidores anteriores. Invalidar el estado de presentación al recargar; no dejar credenciales/filas privadas persistidas. Conservar el informe y las 4 capturas de diagnóstico.

Diferidos conservados: QA manual del owner de 0237, CI histórica, rendimiento frío de evaluación FAIL, ciudades/crons remotos, clima/calendario, ahorro, Marketing/cupón/tarjeta 11 parqueada y Dashboard numérico/realtime. El estado previo de 102 migraciones PROD es el registro anterior, no una nueva verificación. Operaciones PROD y cada push requieren nueva autorización explícita.
