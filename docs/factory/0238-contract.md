# 0238 — Contrato A1 servidor/cliente

Base A1: `f35014e922c66e688b63f663158e86895e33aaf6`. Spec0238 cerrada, ADR0154 aceptado y M0 válido comunicado por coordinador antes del checkpoint. A1 fija tipos y contratos; no introduce resolvedores, stubs, guards modificados ni comportamiento de producto.

Writer A del contrato común. B confirmó por mensaje el DTO y las firmas antes del commit: userId/emailVerified, negocio mínimo, membresía/billing públicos y módulos separados. Cambiar este contrato requiere avisar al coordinador/B y congelar otra revisión antes de continuar la parte dependiente.

## DTO público y límites

Fuente única: `apps/merchant/src/backoffice-context-contract.ts`, únicamente imports/exports de tipos; cero runtime servidor al compilar. Reutiliza `SessionBilling`, `SessionBusiness` y `SessionMembership` de la hoja session-view; `ModuleDTO` solo type-only desde activation, cuyo runtime no cruza al navegador. No mover tipos existentes por ceremonia.

`BackofficeInitialContext` contiene `version:1`, `bootId`, `scopeKey` obligatoria, `userId`, `emailVerified` booleano, `business:{id,name,status,timezone,currencyCode}`, `membership:{role,status,permissions}` efectivos y `billing:SessionBilling`. Los IDs públicos que identifican el ámbito son `userId` y `business.id`; `BackofficeScope` es un alias útil para tickets locales, no otro objeto redundante dentro del DTO. No contiene email/nombre de usuario, token, sessionId, headers, IP, Stripe, plan/status privado de suscripción ni motivo interno de staff. No hay DTO sin sesión: los guards existentes resuelven salida antes del seed.

`BackofficeModulesResult` es exactamente ready con `modules:ModuleDTO[]`, restricted o unavailable. Loading es estado cliente. `BackofficeModulesSeed={bootId,scopeKey,result}` se entrega separado bajo Suspense propio. Ready vacío es lectura correcta; unavailable es error operativo y restricted es denegación de gates, nunca una forma de ocultar ese error.

`bootId` opaco se crea una vez por contexto de render y lo comparten core/hoja; no concede permiso ni ordena frescura. `scopeKey` identifica sesión autenticada/usuario/negocio seleccionado; no cambia por renovación ordinaria de la misma sesión. No persistir estos datos en almacenamiento del navegador; no convertir sus permisos en credenciales para APIs.

## Firmas servidor a implementar después de A1

Estas firmas fijan interfaz y propiedad; no son archivos runtime parcialmente implementados. Tipos internos viven en `server/backoffice-context.ts`, nunca en el contrato serializable:

```ts
type NativeSession = Awaited<ReturnType<ReturnType<typeof getMerchantAuth>["api"]["getSession"]>>;
type BackofficeDataContext = {
  readonly now: Date;
  readonly bootId: string;
  readSession(): Promise<NativeSession>;
  readMembership(mode: BackofficeSelectionMode): Promise<ContextMembership | null>;
  readBilling(businessId: string, mode: BackofficeSelectionMode): Promise<BusinessBilling>;
};
function getBackofficeRenderContext(): Promise<BackofficeDataContext>;
function getBackofficeRequestContext(request: Request): BackofficeDataContext;
function readBackofficeInitialCore(): Promise<BackofficeInitialContext>;
function readBackofficeInitialModules(bootId: string, scopeKey: string): Promise<BackofficeModulesSeed>;
function readBackofficePagePlan(): Promise<{ plan: string; status: string }>;
```

`ContextMembership` es una proyección interna única de membresía/negocio suficiente para consumidores actuales: IDs, name/slug/country/currency/timezone/category, ambos status, motivo, rol/permisos crudos y pinMustChange. A2b añade facturación nullable por LEFT JOIN; el ajuste interno de procedencia se precisa a continuación. Internamente diferencia fila ausente de lectura fallida; la forma concreta debe ser una unión tipada que no permita tratar error como ausencia. `readBilling` recibe businessId y modo explícito obligatorio de esa selección del mismo contexto, nunca de cliente/query. Ajuste A2b aprobado por coordinador: si dos modos seleccionan el mismo negocio y solo uno falla en JOIN, su error original no se oculta con el éxito del otro. No inferir último modo, combinar fuentes ni añadir lectura legacy ambigua. Guards pasan page/active-member/active-owner según su selección; DTO público y constructores iniciales no cambian. Reutiliza la misma fila y reloj; no garantiza snapshot transaccional entre lecturas previas separadas.

RSC: función cacheada estable, definida una vez con React.cache; el contexto de render posee promesa auth y promesas por modo, más billing por modo/negocio. Opciones de decisión como allowBlocked no crean claves nuevas. Route Handlers: contexto explícito asociado a la identidad del objeto Request; un WeakMap por Request puede conservar firmas vigentes y permitir que guard/checklist compartan ese mismo objeto. No keys por usuario/cookie, Map global de resultados auth ni suposición de React.cache en handlers. Otro Request/render resuelve sesión y datos de nuevo. Promesas rechazadas se comparten dentro de esa petición; no hay reintentos implícitos por consumidor. Tras mutación no usar una lectura vieja para autorizar otra escritura: writers conservan controles transaccionales.

`readBackofficePagePlan` es solo servidor y lo consume la página tras su guard normal vigente. Reutiliza readSelection("page"): JOIN correcto devuelve plan/status ya leídos; suscripción ausente usa exactamente none/active como la página anterior; recovered propaga su error original. No SELECT adicional ni campo privado en seed. Contrato A2c acordado con A por coordinador antes del código y comunicado a B.

Constructores iniciales usan ese mismo contexto RSC. Core aplica guard de layout vigente (allowBlocked) y proyección pública; módulos evalúa gates equivalentes a GET módulos sobre la misma fila ya elegida, sin invocar otra escalera HTTP que reabra auth. Los argumentos bootId/scopeKey son correlación del seed del mismo contexto y se verifican contra él; jamás seleccionan negocio o autorizan. La hoja no altera el ámbito si recibe datos incongruentes. Consulta de módulos reutiliza categoría del contexto y solo lee tabla core de módulos, sin servicios de cada módulo. Denegación no consulta módulos; error observado entrega unavailable. No Promise.race que abandone trabajo/rechazos. B monta core/Inbox antes de que esa hoja resuelva.

## Modos, wrappers y precedencia

| Modo de datos | Filtros | Orden/límite |
| --- | --- | --- |
| page | usuario, cualquier rol/estado de membresía | negocio.createdAt ASC, limit1 |
| active-member | usuario, membresía active, cualquier rol | mismos orden/límite |
| active-owner | usuario, membresía active, rol owner | mismos orden/límite |

Reporter y página comparten selección page, no decisiones. No filtrar negocio ni introducir desempates. Una membresía page activa que pasó guard corresponde a la primera active-member del mismo ámbito; esto no autoriza reemplazar la selección por active-owner.

Firmas públicas vigentes quedan iguales: requireBackofficeSession(options?), requireOwner(options?), requireApiOwner(request,messages?,options?), requireApiOwnerSinGateDeEmail(request,messages?), requireApiPermission(request,scope,messages?), requireApiPermissionSinGateDeEmail(request,scope,messages?), requireApiMember(request,messages?). Los nombres que omiten email siguen cerrados/inventariados; no flag público para desactivar un control. Los results HTTP siguen con su forma pública actual. `checklistFacts(request,businessId)` reutiliza readSession de ese Request y conserva tours aparte. Reporter GET sesión conserva 200/JSON/revocación ausente; no serializa scopeKey/sessionId.

| Wrapper | Orden de decisiones |
| --- | --- |
| Página/layout | sesión → fila/no fila y revocación → membresía activa/revocación → closed → staff suspendido → billing según estado/allowBlocked → PIN; mantener redirects y pantalla owner suspendido |
| API owner | sesión → owner activo → email salvo hermana sin gate → estado → billing salvo allowBlocked; no agregar gate PIN distinto del contrato vigente |
| API permiso/member | sesión → active-member → permiso cuando aplica → email del owner salvo hermana sin gate → estado → billing → PIN |
| Reporter | reportar sin sesión false; membresía no activa/sin fila produce negocio/membresía/billing nulos, sin revocar; no aplicar guard de módulos |

A2a mantiene consultas separadas y demuestra compartir datos por petición. A2b reemplaza únicamente obtención con LEFT JOIN de subscription0..1 (`core_subscription_business_unique`): fila sin suscripción no elimina negocio. La fila privada alimenta gates y plan de página sin serializarlo al reporter. Objetivo final normal: página/layout con módulos **máximo4 SELECT de datos comunes**; guard Inbox **máximo3** con BetterAuth nativo. A2a no declara haber alcanzado la reducción del JOIN.

Si JOIN falla tras sesión validada: contexto memoriza error original y permite **una** lectura member-only con misma identidad/modo/filtros/orden/límite; comparte éxito o rechazo de ese intento, nunca reintenta JOIN por consumidor. Solo preserva denegaciones que el wrapper decide antes de billing. Si llega a un gate que necesita billing, propaga error original; no combina filas de intentos, cambia negocio, concede acceso con billing desconocido ni lo convierte en null. Segundo fallo sigue operativo. PIN no se adelanta a billing. Un caller que legítimamente omite billing puede completar esas decisiones sin él; cualquier consumidor posterior que sí lo necesite recibe error. Costos/errores excepcionales se miden aparte, sin descontarlos del tiempo real.

## Tickets y transiciones cliente

Provider del documento posee estado y transportes. Ticket local: recurso + scopeKey capturada + época de ámbito + generación de recurso; identidad de entrada separada para comparación al finalizar. No es caché persistente de transporte. Un máximo de una solicitud vigente y un refresco pendiente por recurso; al resolver/rechazar elimina entrada solo si coincide su identidad. Toda promesa/rechazo queda observado.

Core inicial se instala una vez por documento. Ticket inicial de módulos incluye bootId/scopeKey y generación inicial de ese recurso. Se acepta solo si coincide el arranque vigente y no hubo invalidación; una mutación/revalidación cierra ese ticket, aunque el stream antiguo llegue después. En nueva identidad no esperar a transporte anterior para ocultar datos; descartarlo/cancelarlo sin que su finally borre otro ticket.

| Evento | Acción obligatoria |
| --- | --- |
| Core válido, módulos pendientes | montar core/Inbox y ocultar solo enlaces de módulos |
| Mutación confirmada | avanzar generación antes de aplicar DTO; GET anterior no sirve al refresco posterior; conservar operationId/versiones de Inbox |
| Reporter false | invalidar recursos, retirar datos privados y navegar una vez a entrada vigente |
| Reporter true con negocio/membresía nulos o no activa | retirar datos incluso si userId coincide; una navegación completa a backoffice para que guard decida revocación/redirect |
| Cambio observado de sesión/usuario/negocio, incluido409 de ámbito | retirar ámbito/invalidate y una navegación completa por época; intención nueva antes de escribir |
| Mismo ámbito con rol/permisos/status/acceso distintos | actualizar capacidades, invalidar afectados y router.refresh coordinado cuando haga falta; conservar formulario aún autorizado; gate que retira acceso aplica salida vigente |
| Cambios de presentación/email/módulos | actualizar fuente única y reevaluar recursos afectados; reporter.enabledModules es señal, no segundo store de módulos |
| Módulos restricted | sin bucle/timer; foco posterior/reconexión/evento relevante permite reevaluación coordinada y endpoint decide gates completos |
| Error operativo | recuperación/reintento intencional nuevo; no convertirlo en logout, ready vacío o permiso concedido |
| Nuevo seed RSC mismo ámbito | como máximo una revalidación por bootId nuevo, no sobrescribir estado vivo con snapshot ni crear refresh-loop |
| Nuevo seed RSC distinto ámbito | ocultar privados y confirmar reporter antes de establecer ámbito; no confiar seed prefetcheado como frescura |

Reporter por sí solo no distingue un login nuevo de la misma cuenta/negocio: no se amplía JSON. El siguiente request adoptado con marca anterior obtiene409 y aporta esa señal. No prometer detección instantánea sin interacción/señal.

Cada consumidor se suscribe a transporte compartido; su cleanup no aborta a otro. Último consumidor puede cancelar solo tras comprobar reemplazo por remount StrictMode, observando rechazo. GET invalidado por decisión se cancela o drena descartando resultado antes de ejecutar único pendiente; no se adhiere al GET previo ni abre fan-out. Cancelar fetch no significa cancelar SQL. Foco/reconexión/timers vencimiento/recordatorio/preparing y cola durante mutación conservan semántica de Inbox. Navegación completa no se usa para trial→subscribed/nombre/módulo/permiso no relacionado; no cambiar keys ni perder formulario autorizado por esos cambios.

## Ámbito HTTP adoptado — obligatorio

`scopeKey = HMAC-SHA256(BETTER_AUTH_SECRET, JSON.stringify(["backoffice.scope.v1",session.id,user.id,business.id]))`, hexadecimal minúscula64. IDs completos provienen de contexto validado, nunca cuerpos/headers. No consulta extra ni secreto/token/sessionId serializados. La marca no concede acceso ni reemplaza CSRF/auth.

Cada transporte adoptado captura marca **al iniciar intención, antes de await**, y envía `X-Backoffice-Scope`; clave de transporte incluye esa marca. No getter global tardío, retagging ni escritura reintentada automáticamente con otra marca. Servidor primero ejecuta auth nativa y gates completos; después valida formato/longitud/compara en tiempo constante contra contexto actual, antes de leer/exponer/escribir dominio. La cabecera nunca selecciona negocio, cambia modo o evita gate.

Marca malformada/distinta:409 exactamente `BackofficeContextChanged`, sin eco del ámbito actual y sin dominio. Cliente distingue su code del conflicto de tarjeta, retira datos y navega una sola vez por época; operación en ámbito nuevo requiere intención nueva. Respuestas privadas adoptadas y409: `Cache-Control: private, no-store`. No logs/HAR con marcas, tokens o cookies.

| Superficie adoptada | Guard / lugar de comprobación antes de dominio |
| --- | --- |
| GET Inbox y POST id/decision | guard analytics sin gate email → scope → lifecycle/fallback/decisión |
| GET módulos | guard member → scope → listado |
| PUT módulos/id | guard del dispatcher vigente → scope → toggle; preservar selección actual |
| GET checklist | owner sin gate email → scope → facts/tours |
| POST tours/id | guard vigente → scope → recordTourProgress |

Adaptación operativa S autorizada: en Inbox/módulos adoptados, auth/DB que arroja fuera del try anterior pasa del framework500 al503 codificado por el mapper de disponibilidad existente, ahora privado/no-store. No cambia denegaciones401/403/402 ni su precedencia, y no convierte ese fallo en409 o logout. Se prueba explícitamente.

Clientes sin cabecera conservan comportamiento/JSON/guards actuales salvo esa disponibilidad operativa precisada; no adquieren garantía de vinculación con una pantalla previa. Reporter/auth exentos para descubrir/cerrar sesión. El protocolo se aplica en helpers comunes y adapters mínimos que necesiten headers/tipado, sin cambiar writers. No afirmar garantía para APIs no inventariadas. POST Inbox mantiene contrato2/operationId/versiones/idempotencia; SSR/prefetch/core no llama readInbox ni genera exposición/evaluación.

## Próximos checkpoints y evidencia A1

A2a requiere reserva previa de `server/auth-guards.ts`, `api-owner.ts`, `api-permission.ts`, `server/onboarding/checklist-facts.ts` y tests focales existentes/nuevo `server/backoffice-context.test.ts`, además de helpers ya reservados. Revisar alcance exacto con coordinador antes de editar; no JOIN ni constructores runtime en A1. B1a usa este DTO con fixtures tipadas/componentes aislados tras integración del commit A1.

A1 solo se comprueba con tipos, lint, formato y consumo del contrato desde módulo cliente y servidor; sin DB, servidor ni benchmark. QA de A1 no certifica aún guards, conteos, streaming, protocolo HTTP ni rendimiento final.
