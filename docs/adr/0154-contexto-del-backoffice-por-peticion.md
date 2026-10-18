---
adr: 0154
fecha: 2026-10-17
estado: aceptada
resumen: Resolver y compartir los datos de acceso dentro de cada petición, entregar un contexto inicial mínimo al navegador y reducir viajes SQL sin cachear autorización entre peticiones ni alterar los guards.
---

# 0154 — Contexto del backoffice por petición

El owner eligió combinar las alternativas 1, 2 y 3 y medir después. El owner autorizó iniciar implementación por checkpoints y aceptó explícitamente el contrato scopeKey (2026-10-18 UTC). ADR aceptado; no declara implementación, QA ni publicación. Implementación: [spec 0238](../specs/0238-carga-inicial-del-backoffice.md). Plan: [ficha operativa](../factory/0238-plan-carga-backoffice.md).

## Contexto

La [medición real de Joyas local](../factory/0237-inbox-measurement.md) encontró 9 lecturas en la página: sesión, usuario, membresía/negocio y acceso de facturación duplicados, más otra proyección de suscripción. Layout y página ya ejecutan sus cadenas en paralelo. Navegación tiene dos efectos que piden módulos y comparte con TrialNotice una consulta de sesión repetida. Strict Mode de desarrollo amplifica los efectos; los conteos no representan PROD.

Cada GET Inbox reconstruye acceso con 4 lecturas secuenciales antes de leer avisos. Tener una sesión iniciada no elimina la validación por petición, pero tampoco exige 4 viajes independientes. Los guards tienen diferencias intencionales: selección de negocio, filtros de membresía/rol, email, estado, facturación, PIN y redirects. La lectura del Inbox tiene efectos sobre exposición, vencimientos y recordatorios.

## Decisión

### 1. Compartir datos dentro de una petición; decidir acceso en cada guard

Crear un resolvedor de datos de acceso, servidor y sin DTO público. En un render RSC, memoizar sus promesas mediante `React.cache`, con funciones estables de módulo y argumentos primitivos estables. En Route Handlers, usar un contexto explícito ligado al objeto Request o una factoría local; no asumir que React.cache deduplica fuera del render. El contexto no sobrevive a la petición.

Los guards conservan nombres y orden de decisiones; los contratos actuales siguen vigentes para clientes anteriores. La revisión posterior del autor propone además un contrato HTTP opt-in para vincular ámbito, pendiente de aceptación y descrito más abajo. Comparten datos, no el resultado de un guard con otro. `allowBlocked` sigue siendo una decisión del wrapper y no una opción que haga más permisivo el dato compartido. El reloj para decidir vigencia/acceso se captura una vez por petición; otra petición obtiene uno nuevo. Ningún resultado de acceso se reutiliza después de una escritura dentro de la misma petición; los writers conservan sus controles transaccionales actuales.

Las claves incluyen el modo de selección, porque los resolvedores existentes no son equivalentes: página/reporter seleccionan el primer negocio con cualquier membresía; permiso exige membresía activa; owner exige activa y rol owner. Conservar exactamente filtros, orden y limit actuales. Unir estas selecciones sin distinguirlas podría cambiar de negocio al usuario.

### 2. Reducir viajes sin reemplazar Better Auth

Mantener validación de cookie, sesión, expiración/renovación y usuario en Better Auth y su adaptador. No consultar directamente un token sin su validación ni habilitar opciones experimentales del adaptador por esta tarea.

Después de resolver identidad, seleccionar membresía/negocio según el modo actual y hacer LEFT JOIN de la suscripción del negocio elegido. `core_subscription_business_unique` garantiza como máximo una suscripción. La unión no debe filtrar negocios sin suscripción ni alterar qué membresía gana el ORDER/LIMIT. Calcular facturación con las funciones puras existentes y compartir la fila para plan/status. Conservar datos ausentes y comportamiento fail-closed actuales.

El dato puede obtenerse antes de aplicar todas las decisiones, pero no se serializa ni cambia la precedencia de errores. Los guards de escritura mantienen controles adicionales en sus transacciones; el nuevo contexto no sustituye entitlements, locks ni comprobaciones de dominio.

Si falla el JOIN, una única recuperación excepcional de membresía/negocio con la misma identidad y selección permite aplicar denegaciones anteriores a billing. Si el wrapper necesita billing y no pudo obtenerse, propaga el error operativo; error no significa suscripción ausente. No reintenta el JOIN ni mezcla filas parciales. En APIs el PIN sigue después de billing; los wrappers que omiten ese gate conservan su comportamiento y separan los consumidores que requieren facturación para presentar la página. Es equivalencia de contrato ante fallos parciales, no un mecanismo para conceder acceso con datos incompletos. Operaciones excepcionales se cuentan y miden aparte del objetivo normal.

### 3. Entregar al navegador el contexto ya disponible

El layout autorizado entrega una proyección mínima para navegación y aviso de prueba: identidad opaca del ámbito, nombre, permisos efectivos, acceso/días de prueba y módulos visibles. Sin tokens, cookies, headers, campos Stripe, claves R 2, datos de otros negocios ni motivo de suspensión de owner al staff. Es un dato de presentación, no una credencial aceptada por APIs.

El seed de módulos respeta las mismas decisiones de acceso que su endpoint: que el layout admita un negocio bloqueado/suspendido para mostrar su estado no autoriza a serializar módulos que la API denegaría. En ese caso el seed es restringido y no dispara una recuperación automática. El contexto combinado incorpora categoría y demás metadatos core necesarios para construir la vista de módulos sin otra consulta al negocio.

Un propietario único en el árbol cliente comparte ese dato y las peticiones en curso. Evitar GET sesión/GET módulos al montar consumidores que ya recibieron su estado. La carga de módulos, posterior a identificar y validar el ámbito, puede solaparse con otras lecturas independientes; no ejecutar comandos paralelos sobre una misma conexión transaccional esperando reducir viajes.

La composición elegida entrega core primero y módulos desde un componente servidor asíncrono con Suspense propio que no suspende el provider ni Inbox. El cliente tiene estado loading mientras llega ese seed. El componente espera y observa su consulta y traduce rechazo a unavailable; no se usa una carrera de timeout que abandone promesas. La latencia y recursos de ese trabajo se registran aunque termine después de que el Inbox sea utilizable.

Cada nueva petición protegida autentica y autoriza. El cliente invalida su contexto tras logout, cambio de identidad/comercio, cambios propios de módulos/permisos/acceso y eventos de sesión. Revalidación coordinada al recuperar foco y tras reconexión; no reutilizar contexto entre usuarios. Resultados tardíos de la identidad anterior se descartan. Mientras se refresca, lo visible puede conservarse, pero no constituye autorización para ninguna acción.

El provider inicializa core una vez por documento y acepta el seed de módulos solo con ticket inicial vigente. Versión de contrato y `bootId` no son una revisión temporal ni credencial. Nuevos seeds RSC no sustituyen datos por el orden en que llegan: invalidan/coordinan una revalidación del reporter y recursos pertinentes. Mutaciones avanzan generaciones locales; resultados previos no pisan el DTO confirmado. Reporter con usuario autenticado pero negocio/membresía nulos también limpia el ámbito, no solo authenticated:false. Cambio/pérdida de sesión, identidad o negocio retira el ámbito y provoca una sola navegación completa para restablecerlo. Dentro del mismo ámbito, cambios de rol/permisos/estado/acceso actualizan el provider y usan un router.refresh coordinado cuando es necesario reevaluar el árbol, preservando estado cliente no afectado y autorizado. No descartar un formulario por trial→subscribed o por ganar un permiso. Si el gate retira acceso a la ruta, prevalece esa salida. Restricted se reevalúa tras señales relevantes sin retry periódico. La tabla de transición y los casos negativos están en spec §4.1.

### 3 bis. Intención y ámbito efectivo de cada petición — contrato adicional aceptado

La [revisión del autor](../factory/0238-author-review.md) detectó que una época local no ve por sí sola una cookie cambiada en otra pestaña. Una petición marcada localmente A puede salir con la sesión B y ser legítimamente autorizada para B. Para los consumidores adoptados se propone `scopeKey` ligado mediante HMAC a sesión/usuario/negocio y enviado en `X-Backoffice-Scope`, capturado al iniciar la intención. Los guards validan primero la sesión y acceso actuales; después comparan la marca antes de operaciones de dominio. No usan la marca para seleccionar negocio o conceder acceso.

Desajuste devuelve409 `backoffice_context_changed`, retira el ámbito cliente y no reintenta escrituras en otro ámbito. Clientes sin cabecera mantienen su contrato; reporter/auth quedan exentos para recuperar/cerrar sesión. Sin consulta nueva, tabla ni credencial de autorización. La spec §4.3 define forma, superficies, compatibilidad y negativos. Este contrato adicional fue **aceptado explícitamente por el owner** tras explicar el caso entre pestañas; el dictamen adversarial sobre20e81dfb no lo certifica. La garantía se limita a consumidores adoptados. Reporter legado no detecta sesión nueva de la misma cuenta; la siguiente API adoptada con marca anterior señala cambio por409, sin añadir campos al reporter ni prometer detección inmediata.

### 4. Conservar el recorrido de efectos del Inbox

El contexto servidor no incluye contenido del Inbox. Su GET se mantiene como una petición independiente, iniciada por el componente visible; deduplicar solicitudes simultáneas del mismo ámbito en el cliente. Una nueva lectura intencional tras decisión, vencimiento, recordatorio o foco conserva el comportamiento actual.

No mover `readInbox` a layout, SSR, `generateMetadata`, prefetch ni un caché persistente: eso registraría exposición de avisos que el usuario puede no haber visto. Esta decisión deja parte del recorrido página→montaje→GET y no promete eliminarlo en este encargo. Backend conserva try-lock, ciclo, fallback de 3 s, versiones y las respuestas de 0237.

Promesas compartidas pertenecen al provider y a recurso/época/generación. Se retiran al terminar y no se reutilizan después de una decisión, invalidación o rechazo. Un consumidor que se desmonta no cancela a otro suscrito; un ticket viejo nunca elimina o actualiza el nuevo en su finally. Conservar una sola lectura vigente y una pendiente, con descarte/cancelación o drenaje de las anteriores. No añadir una caché persistente ni librería para conseguirlo.

### 5. Medir el conjunto con referencia comparable

Comparar base y candidato bajo build de entrega, misma configuración no PROD, DB protegida, dataset, navegaciones y observador. Conservar primera entrada y casos de preparación/contención separados de recargas. Las capturas dev 4,185/4,624 s son diagnóstico, no referencia cuantitativa para afirmar mejora en build de entrega. La spec fija criterios estructurales y el protocolo relativo; no se promete un SLA inventado.

Conservar M0 y ejecutar en M1 un control de la base congelada junto al candidato, por bloques de orden predeterminado. Fijar antes de medir estimador de p95, definición de contenido utilizable, resolución e incertidumbre. El manifiesto también cubre día/zona, runs, política, vigencias, exposición, recordatorios y sesión; no basta el hash de filas estáticas. Muestras con cambio de caso o condiciones no se borran ni se usan para afirmar un ready equivalente.

## Compatibilidad con decisiones previas

- Se mantienen las decisiones funcionales de 0074/0075,0086,0189,0218,0152/0237 y ADR 0153. No cambia el conjunto de rutas con/sin gate de email ni el carácter reporter 200 de GET sesión. La cabecera/409 de ámbito es aditiva y aceptada explícitamente; no se oculta como equivalencia exacta de todos los errores.
- Este ADR reemplaza **solo para el refactor descrito** las restricciones históricas de implementación «guards byte por byte iguales» de 0075 y «no modificar auth-guards» de 0074. Permite refactorizar su obtención de datos con evidencia de equivalencia; no habilita nuevos flags públicos, excepciones de acceso ni retirar oráculos.
- No es una migración global de autenticación. Si un helper compartido alcanza otras rutas, su compatibilidad debe verificarse; no cambiar sus flujos por extensión automática.

## Alternativas consideradas

- Solo paralelizar: ya hay concurrencia y seguiría repitiendo trabajo. Se conserva paralelismo donde existe independencia real.
- Solo deduplicar en cliente: reduce peticiones auxiliares, pero deja las duplicaciones RSC y los viajes de acceso de cada API.
- Caché de cookie de Better Auth/JWT o Redis: pueden reducir lecturas entre peticiones, pero requieren decidir revocación, obsolescencia e infraestructura. Se difieren expresamente; no son dependencia de esta propuesta.
- Endpoint bootstrap gigante: introduciría otra superficie y acoplaría el Inbox a datos accesorios. Se usan props de servidor y endpoints existentes.
- SSR del Inbox con lectura actual: adelanta efectos a renders/prefetch. Se difiere; un snapshot sin efectos exigiría otro contrato y tratamiento explícito de exposición.

## Consecuencias

Menos viajes y fuentes de estado duplicadas, a cambio de un contrato interno explícito y pruebas de aislamiento/orden de guards. La serialización inicial puede crecer y la lectura de módulos puede demorar el shell: el presupuesto medido debe incluir ese costo y evitar bloquear la página innecesariamente. Reutilizar datos por petición no promete instantaneidad ante una revocación concurrente; preserva los controles de las operaciones protegidas y vuelve a consultar en la siguiente petición.

Sin DDL, nuevos servicios, caché compartida entre peticiones ni cambio de fórmulas/tarjetas. El FAIL de evaluación fría de 0237 y todos los diferidos siguen vigentes. Ninguna parte autoriza push u operaciones PROD.
