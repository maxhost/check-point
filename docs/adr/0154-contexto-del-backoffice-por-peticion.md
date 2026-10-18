---
adr: 0154
fecha: 2026-10-17
estado: propuesta
resumen: Resolver y compartir los datos de acceso dentro de cada petición, entregar un contexto inicial mínimo al navegador y reducir viajes SQL sin cachear autorización entre peticiones ni alterar los guards.
---

# 0154 — Contexto del backoffice por petición

El owner eligió combinar las alternativas 1, 2 y 3 y medir después. Este ADR concreta el diseño para revisión; no declara aprobación del detalle técnico, implementación ni publicación. Implementación: [spec 0238](../specs/0238-carga-inicial-del-backoffice.md). Plan: [ficha operativa](../factory/0238-plan-carga-backoffice.md).

## Contexto

La [medición real de Joyas local](../factory/0237-inbox-measurement.md) encontró 9 lecturas en la página: sesión, usuario, membresía/negocio y acceso de facturación duplicados, más otra proyección de suscripción. Layout y página ya ejecutan sus cadenas en paralelo. Navegación tiene dos efectos que piden módulos y comparte con TrialNotice una consulta de sesión repetida. Strict Mode de desarrollo amplifica los efectos; los conteos no representan PROD.

Cada GET Inbox reconstruye acceso con 4 lecturas secuenciales antes de leer avisos. Tener una sesión iniciada no elimina la validación por petición, pero tampoco exige 4 viajes independientes. Los guards tienen diferencias intencionales: selección de negocio, filtros de membresía/rol, email, estado, facturación, PIN y redirects. La lectura del Inbox tiene efectos sobre exposición, vencimientos y recordatorios.

## Decisión propuesta

### 1. Compartir datos dentro de una petición; decidir acceso en cada guard

Crear un resolvedor de datos de acceso, servidor y sin DTO público. En un render RSC, memoizar sus promesas mediante `React.cache`, con funciones estables de módulo y argumentos primitivos estables. En Route Handlers, usar un contexto explícito ligado al objeto Request o una factoría local; no asumir que React.cache deduplica fuera del render. El contexto no sobrevive a la petición.

Los guards conservan nombres, contratos y orden de decisiones. Comparten datos, no el resultado de un guard con otro. `allowBlocked` sigue siendo una decisión del wrapper y no una opción que haga más permisivo el dato compartido. El reloj para decidir vigencia/acceso se captura una vez por petición; otra petición obtiene uno nuevo. Ningún resultado de acceso se reutiliza después de una escritura dentro de la misma petición; los writers conservan sus controles transaccionales actuales.

Las claves incluyen el modo de selección, porque los resolvedores existentes no son equivalentes: página/reporter seleccionan el primer negocio con cualquier membresía; permiso exige membresía activa; owner exige activa y rol owner. Conservar exactamente filtros, orden y limit actuales. Unir estas selecciones sin distinguirlas podría cambiar de negocio al usuario.

### 2. Reducir viajes sin reemplazar Better Auth

Mantener validación de cookie, sesión, expiración/renovación y usuario en Better Auth y su adaptador. No consultar directamente un token sin su validación ni habilitar opciones experimentales del adaptador por esta tarea.

Después de resolver identidad, seleccionar membresía/negocio según el modo actual y hacer LEFT JOIN de la suscripción del negocio elegido. `core_subscription_business_unique` garantiza como máximo una suscripción. La unión no debe filtrar negocios sin suscripción ni alterar qué membresía gana el ORDER/LIMIT. Calcular facturación con las funciones puras existentes y compartir la fila para plan/status. Conservar datos ausentes y comportamiento fail-closed actuales.

El dato puede obtenerse antes de aplicar todas las decisiones, pero no se serializa ni cambia la precedencia de errores. Los guards de escritura mantienen controles adicionales en sus transacciones; el nuevo contexto no sustituye entitlements, locks ni comprobaciones de dominio.

### 3. Entregar al navegador el contexto ya disponible

El layout autorizado entrega una proyección mínima para navegación y aviso de prueba: identidad opaca del ámbito, nombre, permisos efectivos, acceso/días de prueba y módulos visibles. Sin tokens, cookies, headers, campos Stripe, claves R 2, datos de otros negocios ni motivo de suspensión de owner al staff. Es un dato de presentación, no una credencial aceptada por APIs.

El seed de módulos respeta las mismas decisiones de acceso que su endpoint: que el layout admita un negocio bloqueado/suspendido para mostrar su estado no autoriza a serializar módulos que la API denegaría. En ese caso el seed es restringido y no dispara una recuperación automática. El contexto combinado incorpora categoría y demás metadatos core necesarios para construir la vista de módulos sin otra consulta al negocio.

Un propietario único en el árbol cliente comparte ese dato y las peticiones en curso. Evitar GET sesión/GET módulos al montar consumidores que ya recibieron su estado. La carga de módulos, posterior a identificar y validar el ámbito, puede solaparse con otras lecturas independientes; no ejecutar comandos paralelos sobre una misma conexión transaccional esperando reducir viajes.

Cada nueva petición protegida autentica y autoriza. El cliente invalida su contexto tras logout, cambio de identidad/comercio, cambios propios de módulos/permisos/acceso y eventos de sesión. Revalidación coordinada al recuperar foco y tras reconexión; no reutilizar contexto entre usuarios. Resultados tardíos de la identidad anterior se descartan. Mientras se refresca, lo visible puede conservarse, pero no constituye autorización para ninguna acción.

### 4. Conservar el recorrido de efectos del Inbox

El contexto servidor no incluye contenido del Inbox. Su GET se mantiene como una petición independiente, iniciada por el componente visible; deduplicar solicitudes simultáneas del mismo ámbito en el cliente. Una nueva lectura intencional tras decisión, vencimiento, recordatorio o foco conserva el comportamiento actual.

No mover `readInbox` a layout, SSR, `generateMetadata`, prefetch ni un caché persistente: eso registraría exposición de avisos que el usuario puede no haber visto. Esta decisión deja parte del recorrido página→montaje→GET y no promete eliminarlo en este encargo. Backend conserva try-lock, ciclo, fallback de 3 s, versiones y las respuestas de 0237.

### 5. Medir el conjunto con referencia comparable

Comparar base y candidato bajo build de entrega, misma configuración no PROD, DB protegida, dataset, navegaciones y observador. Conservar primera entrada y casos de preparación/contención separados de recargas. Las capturas dev 4,185/4,624 s son diagnóstico, no referencia cuantitativa para afirmar mejora en build de entrega. La spec fija criterios estructurales y el protocolo relativo; no se promete un SLA inventado.

## Compatibilidad con decisiones previas

- Se mantienen las decisiones funcionales de 0074/0075,0086,0189,0218,0152/0237 y ADR 0153. No cambia el conjunto de rutas con/sin gate de email ni el carácter reporter 200 de GET sesión.
- Si este ADR se acepta, reemplaza **solo para el refactor descrito** las restricciones históricas de implementación «guards byte por byte iguales» de 0075 y «no modificar auth-guards» de 0074. Permite refactorizar su obtención de datos con evidencia de equivalencia; no habilita nuevos flags públicos, excepciones de acceso ni retirar oráculos.
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
