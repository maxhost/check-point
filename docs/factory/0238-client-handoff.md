# 0238 — Handoff cliente (B)

## Preparación, 2026-10-18 UTC

- Tarea factory: `backoffice-0238-client`.
- Worktree exclusivo: `/private/tmp/checkpass-0238/backoffice-0238-client`; rama `backoffice-0238-client`.
- Base recibida: `e93d04871c82a6be38db21251de29dab4233c04d`.
- Reserva inicial recibida: este informe y los futuros `apps/merchant/src/app/backoffice/backoffice-context.tsx`, `apps/merchant/src/app/backoffice/backoffice-modules-seed.tsx`.
- Estado: **preparación documental solamente**. D0/decisión de ámbito, M0 y contrato A1 preceden al producto; no comenzó B1a. Sin producto, tests nuevos, servidor, DB, credenciales, push o PROD. No se afirma PASS funcional/rendimiento.
- Lecturas: AGENTS raíz/merchant, protocolos de trabajo/verificación, spec0238, ADR0154, plan0238 y consumidores enumerados abajo. Node24.20.0 comprobado.

## Contrato mínimo pedido al escritor A1

Contrato puro/serializable, versión1; imports runtime de servidor prohibidos en cliente. `bootId` identifica arranque y no frescura. Core mínimo: ámbito opaco de usuario/negocio; negocio con id/nombre/estado/zona/moneda cuando el consumidor lo requiere; membresía con rol/estado/permisos efectivos; billing público `SessionBilling`. Sin sesión cruda/token, email/IP, Stripe, suspensión interna ni plan privado. ScopeKey únicamente si el owner acepta §4.3.

Módulos llegan separados del core: resultado `ready` con el DTO público existente, `unavailable` o `restricted`, ligado a `bootId` y ticket inicial. `loading` es estado local mientras se espera la hoja RSC. Provider se monta con core sin esperar módulos. A entrega constructor autorizado y firmas; B compone hoja RSC/Suspense y aplicación cliente. `SessionView`/`SessionBilling` actuales son hojas puras; `BusinessModule` hoy referencia `ModuleDTO` mediante import type de `modules/activation.ts`. A decide el contrato puro común sin duplicar el DTO ni arrastrar su runtime.

Una sola fuente cliente de módulos: el provider deriva habilitados de `ready.modules`. `business.enabledModules` del reporter sirve para advertir/iniciar invalidación, no como store paralelo que pueda contradecir el DTO de módulos. A y B coinciden en esta dirección; la firma exacta sigue pendiente de A1.

Ticket de transporte: recurso+época+generación (y scopeKey si se adopta); promesas propiedad del provider, sin caché de respuestas. Invalida antes de aplicar mutación confirmada, retira por settle con comparación de entrada y no permite que GET anterior sirva a refresco posterior. Máximo un transporte vigente y un refresco pendiente; cleanup de un suscriptor no aborta otro ni el reemplazo de Strict Mode. La hoja tardía se acepta únicamente si su ticket inicial sigue vigente. No se instala una instantánea RSC como revisión más fresca por llegar última.

## Inventario observable de consumidores

Todos los paths de esta tabla son relativos a `apps/merchant/src/app/backoffice/`.

| Archivo actual | Lectura/evento actual | Cambio previsto, todavía sin ejecutar |
| --- | --- | --- |
| `layout.tsx` | Guard `allowBlocked`, billing; props independientes a navegación y TrialNotice condicional | Consumir helpers A, montar provider sin cambiar gates ni puerta de suscripción; Suspense solo para hoja módulos |
| `page.tsx` | Guard normal, SELECT adicional plan/status, Inbox cliente | Reusar fila servidor de A sin serializar plan privado; conservar guard y redirección de staff sin analytics |
| `backoffice-navigation.tsx` | Dos efectos GET módulos; uno también GET sesión; eventos distintos `business-modules-changed` con DTO y `checkpass:modules-changed` sin DTO; dos estados de módulos | Hooks provider; sin GET inicial con seed ready; reconciliar ambos eventos sin fan-out ni segunda fuente de permisos |
| `subscription/trial-notice.tsx` | GET sesión propio con AbortController, días de trial | Billing público provider; conservar reglas de rutas operativas y suscripción; retirar estado viejo al cambiar acceso |
| `analytics/inbox-state.ts` | GET por montaje/reload, foco, vencimiento, recordatorio, preparing; POST con operationId y versión; 404/409 hoy causan reload genérico | Mantener máquina actual/temporizadores/idempotencia; provider coordina transporte y generaciones; diferenciar `backoffice_context_changed` antes de conflicto genérico |
| `onboarding/onboarding-checklist.tsx` | GET con AbortController de cada efecto; counter no carga; fin de tour recarga; verificación email puede actualizar hecho local | Suscripción compartida y generación; mantener condiciones de counter y UI existente; señal relevante de verificación a revalidación coordinada |
| `settings/module-request.ts` | GET/PUT cookie implícita; error tipado con code/status; validación DTO módulos | Transporte adoptado con captura explícita de intención si U1; sin ámbito global mutable; conservar errores de dependencia/órdenes |
| `panel-request.ts` | Helper compartido por Inbox y otras pantallas; sin signal/ámbito actualmente | Extensión compatible y opt-in para consumidores adoptados; no añadir cabecera a todas las APIs por defecto |
| `onboarding/onboarding-api.ts` | GET checklist y POST tour; errores genéricos pierden code/status | Si U1 se adopta, error tipado/context recovery conservando errores legados; captura explícita de marca en intención |
| `settings/module-settings.tsx` | GET de montaje, toggle PUT, publica DTO confirmado, evento sin payload y router.refresh | Necesita reserva si se conecta mutation al provider/captura de intención; no basta cambiar helper sin caller |
| `settings/module-configuration.tsx` | Reporter independiente al entrar en Configuración | Propuesta de reserva para consumir mismo provider y evitar trabajo desplazado a navegación interna |
| `settings/use-business-modules.ts` | GET independiente más evento con DTO | Propuesta de reserva para consumir fuente/promesas comunes; no ampliar alcance a todos los módulos |
| `onboarding/onboarding-tour.ts` | Función no React; POST desde save de driver.js | Propuesta de reserva si U1 para transportar marca capturada al crear intención del tour; no leer marca global después del await |

El inventario de tours incluye sus callers de pantallas: antes de tocarlo, A1/coordinador debe elegir una conexión acotada con reserva explícita. No modificar todos los callers por extensión automática ni incorporar una marca global que cambie de identidad silenciosamente. Si un callback opcional/argumento explícito requiere otro path, se solicita antes del código.

## Checkpoints B y reservas propuestas

Solo el siguiente checkpoint habilitado se ejecutará por instrucción del coordinador. Las pruebas nuevas aquí son **propuestas de paths**, no archivos creados ni una dependencia nueva.

| Checkpoint | Producto propuesto | Verificación decisiva y evidencia existente |
| --- | --- | --- |
| B1a, tras A1/M0 | Nuevos `backoffice-context.tsx` y, si conviene extraer estado puro, `backoffice-context-state.ts` | Nuevo `backoffice-context-state.test.ts`: tickets/épocas, loading/ready/restricted/unavailable, core sin espera, seed tardío tras invalidación. Un test de estado puro no certifica montaje React; posterior browser necesario |
| B1b, tras B1a/A2c | `layout.tsx`, `page.tsx`, `backoffice-navigation.tsx`, `subscription/trial-notice.tsx`, nuevo `backoffice-modules-seed.tsx` | Existing `layout-guard.test.ts`, `layout-billing.test.ts`; nuevo browser focal `e2e/backoffice-context.spec.ts` propuesto a coordenador tras confirmar harness existente. Smoke real módulos lento/rechazo: Inbox utilizable antes de EOF; cero GET sesión/módulos ready y un GET Inbox. No cambiar guard estático para ocultar una página sin guard |
| B2a, tras B1b | Provider más `analytics/inbox-state.ts`, `onboarding/onboarding-checklist.tsx`; helper puro `backoffice-requests.ts` si hace falta extraer | Nuevo `backoffice-requests.test.ts` para subscribe/settle/colas; browser: dos consumidores, Strict Mode/remount, aborto de uno, rechazo/reintento, GET anterior a decisión no se reutiliza. Timers y operationId existentes conservados |
| B2b, tras B2a | Provider/navegación y paths de módulos que coordinador apruebe | Browser: foco/reconexión coalescen; reporter false o autenticado sin membresía retira datos; permisos/billing mismo ámbito actualizan sin descartar formulario autorizado; seed RSC no genera bucle refresh ni pisa mutación |
| S condicional y separado | `panel-request.ts`, `settings/module-request.ts`, `onboarding/onboarding-api.ts` y callers explícitos aprobados | Existing `onboarding/onboarding-api.test.ts`, `onboarding/onboarding-tour.test.ts`; nuevas aserciones focales 409 tipado, cookie A→B sin foco, sesión nueva misma cuenta, captura antes de await y cero replay de escritura. Solo activar consumidores cuando servidor ya implemente contrato |

El harness browser real se inventariará con el coordinador antes de reservar el path propuesto; no añadir Playwright/Vitest browser/dependencias por inercia. Vitest merchant actual tiene environment node e include `src/**/*.test.ts`: un `.test.tsx` nuevo no se ejecutaría por esa configuración. No cambiar tooling para resolverlo sin asignación expresa. Typecheck/lint/guardia UI focales después del producto; preparación documental solo diff estático.

## Compatibilidad y decisiones para A1/D0

1. GET sesión actual reporta200 incluso authenticated sin negocio/membresía; no convertirlo en401/403 ni en logout operativo. Reporter por sí solo no distingue sesión nueva de la misma cuenta/negocio. A confirmó que el primer request adoptado detectaría cambio vía scopeKey/409; precisar este límite, sin agregar sessionId o campos al JSON legado unilateralmente.
2. `PanelRequestError` expone code/status. Inbox hoy trata todo409 como conflicto de tarjeta y recarga: ante cambio de ámbito esa ruta debe limpiar/recuperar una vez, sin nuevo GET de negocio anterior ni replay de POST.
3. `ModuleRequestError` preserva409 de órdenes abiertas (`openCount`) y códigos de dependencias. No confundirlos con409 de ámbito ni retirar sus mensajes.
4. Onboarding API actualmente borra los códigos del servidor. Si se adopta U1, su error debe permitir recovery tipado y conservar los rechazos legacy; el tour no reenvía una acción fallida con otra marca.
5. Helper `panelRequest` tiene consumidores fuera de adopción (por ejemplo consola Analytics). Hacer opciones opt-in y mantener firma/callers anteriores compatibles; no prometer protección para APIs no inventariadas.
6. Eventos con/sin DTO más `router.refresh()` actuales pueden disparar tres fuentes de revalidación. Provider debe aplicar DTO confirmado antes de una relectura posterior, coalescer señales y no usar el nuevo seed como confirmación causal de frescura.

## Entrega de esta preparación

Solo este informe cambia. No servidor/proceso/DB ni fixtures/sesiones abiertos. El siguiente paso permitido es esperar cierre D0, referencia M0, commit A1 transmitido por el coordinador, reservas ampliadas del checkpoint y orden explícita de B1a. La preparación no constituye entrega factory de producto ni autorización para avanzar de checkpoint.

## Encargo adicional: harness M0, sin producto

El coordinador informó aceptación explícita de scopeKey y cierre D0 `6e45066c`; leído mediante `git show`, sin cambiar esta base. Autorizó y reservó `tests/e2e/support/backoffice-measurement.cjs` exclusivamente como medición previa a optimizar. No habilita B1a ni sustituye M0.

Harness opt-in, Playwright existente resuelto con createRequire del package raíz, sin dependencias/config nuevas. Exige `BASE_URL` origen localhost, `COOKIE_FILE` array cookies Playwright privado600 (dominios locales), `MANIFEST` sintético, `OUT` privado y `RUN_TAG` inocuo. Opcionales `RELOADS=5`, `TIMEOUT_MS=30000`, `SETTLE_TIMEOUT_MS=5000`, `CPU_TRACE=0`. Cada ejecución crea contexto nuevo1280x900/caché HTTP Chromium normal/serviceworkers bloqueados; registra primera entrada separada y cinco recargas reales en ese contexto. Las recargas no representan DB fría.

Manifest requerido: `{case:'ready-empty'|'ready-five',cards:[{id,title,decisions:[{key,label}],action?:{label,href}}]}`. Cinco tarjetas necesitan ids/títulos únicos. IDs propios se validan contra response Inbox contractVersion2/state ready; DOM actual no expone ids, así que observador comprueba artículos/títulos/decisiones habilitadas y acción esperados. Solo ids sintéticos de whitelist, versiones numéricas y resultados booleanos salen al JSON; no títulos/body/respuestas crudas/cookies/cabeceras/scopeKey. Archivo incluye hash del harness/manifest. Correlación servidor por `x-inbox-measurement` distinto por intento.

Observador MutationObserver y PerformanceObservers instalados antes de navegar; goto/reload espera commit y ready usa performance.now al cumplir DOM. DCL/load/responseEnd y fin recursos se recogen después, con timeout declarado conservando muestra. CDP conserva solicitudes, fallos/abortos, status, rutas sin query, tiempos y bytes por documento/RSC/JS/CSS; ResourceTiming acompaña caché/tamaños y GET Inbox. RSC embebido ya pertenece al documento: no se suma otra vez. CPU_TRACE solo habilita contador de muestreo diagnóstico separado, sin fuente JS/heap/trace privado.

Límites: solo checks estáticos, **no ejecutado en navegador/servidor/DB por instrucción expresa**. Bytes hasta ready agregan recursos completados; streams abiertos y bytes aún en curso se identifican por waterfall, no se presentan como cero costo. Tamaño exacto de seed requiere evidencia servidor/build adicional. No inventa hito de hidratación ni tiempo interno SQL/CPU; longtasks y muestreo son diagnóstico. Fixtures/estado temporal/restauración, SHA de fuente, orden seis bloques A/B, incertidumbre e inventario de entorno son responsabilidad del coordinador; el harness no crea sesiones/fixtures/login ni afirma performance PASS.

Verificación local Node24.20.0: `node --check` PASS; ESLint focal PASS; prettier write aplicado; `git diff --check` PASS. Primer lint detectó imports require prohibidos: se sustituyeron por import dinámico manteniendo extensión CommonJS/createRequire de Playwright, sin desactivar regla. Sin browser lanzado, procesos ni DB.

### Delta I1 previo a congelar M0

Por encargo explícito del coordinador se añaden solo tres marcadores al mismo harness: `sectionFirstSeenAt` (primera observación DOM de sección Inbox, incluido skeleton), `inboxFetchInvocationAt` (lista de inicios de llamada fetch del pathname Inbox con reloj performance.now) y `clockProbeDurationMs` (duración total del sondeo de10.000 lecturas, sin descontarla). Wrapper fetch conserva this/argumentos y devuelve exactamente la promesa original; no lee body/headers/cookies ni modifica respuestas. Los marcadores distinguen sección observada → invocación fetch → Network/ResourceTiming → DOM utilizable; no prueban mount React ni hidratación completa. El nuevo SHA/hash de harness debe usarse idéntico en ambas fuentes. No se ejecutó browser/DB; M0 sigue pendiente. Sintaxis, lint focal y diff-check se vuelven a comprobar en este delta.

### Corrección de versión posterior a M0, para método M1 A/B

Coordinador informó M0 de62/62 observaciones válidas según el harness congelado `16ec1154b266c8222a17b4828e6495a924ea30c0`, con un límite detectado por QA: versiones de tarjetas son hashes string y ese harness solo retenía números, por tanto guardó null y no verificó versiones. No se recalculan ni atribuyen esos datos al harness corregido; tampoco se declara aceptación nueva.

Corrección acotada autorizada: cada tarjeta del manifiesto necesita `version` string hexadecimal minúscula64; manifestos antiguos sin versión se rechazan. Response se valida por identidad y versión exacta esperada, además de los checks anteriores; `versionsValidated` y `versionError` conservan resultado explícito. `cardVersions` registra como máximo cinco hashes de versión con formato válido y solo para IDs sintéticos de whitelist. No son credenciales; ningún body/header/cookie/scopeKey se agrega al informe. Manifest vacío mantiene cards[] sin versiones.

El nuevo commit/hash es método **M1 para ambas fuentes, controlA y candidatoB**. M0 queda conservado con16ec1154 y su limitación; comparación temporal causal depende de control contemporáneo usando exactamente la misma corrección que candidato. Solo syntax/lint/diff-check; sin ejecutar browser/DB ni avanzar B1a. La descripción histórica anterior «versiones numéricas» corresponde al comportamiento defectuoso de M0, no al nuevo contrato.

## B1a — Provider y tickets iniciales aislados

Habilitado explícitamente por coordinador tras M0 y QA de A1 `4fb07d33`. `factory continue` sincronizó este worktree a base `77dc18aaea1d0b66fbc0043e06d07ec5f5d2b511`; no se cambió base manualmente. Solo tres archivos de producto nuevos, reservados: `backoffice-context.tsx`, `backoffice-context-state.ts`, `backoffice-context-state.test.ts` bajo `apps/merchant/src/app/backoffice/`. Hoja RSC reservada permanece sin crear. Harness M1 permanece en0c0f9a44, sin delta ni nuevas mediciones.

Estado puro: core disponible con módulos loading; resultados ready/lista vacía/restricted/unavailable diferenciados. Seed inicial exige bootId/scopeKey/época/generación vigentes y se cierra al aplicarlo; una invalidación lo cierra antes de resultado tardío. Tickets incluyen recurso/ámbito/época/generación. Retirar el ámbito elimina core/módulos privados, avanza época e invalida todos los recursos; no emite tickets ni puede revivir por seed RSC. Nuevo core RSC mismo ámbito solo señala revalidación por bootId no observado, nunca instala permisos/nombre de una instantánea como frescura. Cambio de usuario/negocio/scopeKey retira datos sin aceptar nuevo contexto prefetcheado.

Provider React usa solo componentes/context/hooks, sin nativos/CSS ni import runtime servidor. Reconciliación de prop con ámbito distinto sucede durante render antes de descendientes, evitando conservar privados hasta un efecto. `useOptionalBackofficeContext()` retorna null únicamente si no existe provider; provider retirado sigue presente con state.core null. `useBackofficeContext()` exige provider, no presupone core disponible; `captureTicket` devuelve null para estado retirado. No fallback a props privadas ni operaciones de red. La captura expuesta es del snapshot React actual: no presupone que setState sea síncrono ni sirve para capturar después de await/invalidate y despachar transporte; B2 implementará propiedad y orden atómico de intenciones/transportes dentro del provider. Esto no es transporte parcialmente activo: ningún consumidor existente lo usa todavía.

Comprobaciones sobre base77dc18aa más este delta, Node24.20.0:

- `pnpm exec vitest run src/app/backoffice/backoffice-context-state.test.ts` desde merchant: **14/14 PASS**, sin skips/retries; prueba estado/transiciones, no montaje React.
- `pnpm typecheck` desde merchant: PASS (tsc --noEmit, exit0).
- ESLint focal de los tres archivos: PASS; prettier aplicado.
- `node tools/ui-guard.ts --base 77dc18aaea1d0b66fbc0043e06d07ec5f5d2b511`: PASS, dos archivos de producto sin aumentos; warning de Node sobre módulo de tooling preexistente, sin modificarlo.
- `git diff --check`: PASS.

Sin DB/browser/servidor, sin fetch/event listeners/loops, sin tocar layout/page/navegación/TrialNotice/Inbox/checklist ni helper de A. Pruebas usan DTOs tipados sintéticos del contrato A1. QA independiente y montaje/streaming real pertenecen a siguientes entregas: B1b espera A2c y nueva instrucción del coordinador. Estado de esta entrega no certifica conteos/performance ni implementación total de0238.

## S1-client — Transporte HTTP opt-in sin adopción

Encargo explícito para avanzar una pieza independiente mientras B1b espera A2c. `factory continue` sincronizó a base `70a02f798db164ac9d2989ccb3f5bae3e6f85bfe`, que incluye B1a aceptado. Paths reservados: `panel-request.ts` y test nuevo, `backoffice-scope-request.ts` y test nuevo, `settings/module-request.ts` y test nuevo, `onboarding/onboarding-api.ts` y test existente, más este informe. Sin cambios al contrato A1 ni helper servidor.

Helper puro pequeño: `backofficeScopeHeaders(scopeKey)` produce header nuevo para64hex minúscula; undefined conserva caller legado sin header y marca malformada lanza error local sin operación HTTP. `isBackofficeContextChanged` compara únicamente code exacto, sin confundir cualquier409 de tarjeta/dependencia/órdenes. No autoriza, navega, limpia provider o reintenta; no almacén global/getter de marca. La marca se lee y convierte en header local síncronamente al entrar al wrapper, antes de primer await y antes de serializar body; cambiar opciones externas después no cambia la intención enviada.

Firmas ampliadas con último argumento opcional, llamadas anteriores compatibles:

- `panelRequest(url, method?, body?, options?:{scopeKey?,signal?})`.
- `moduleRequest(url, body?, options?:{scopeKey?,signal?})` y `readModules(options?)`.
- `getOnboardingChecklist(signal?, options?:{scopeKey?})`, manteniendo su signal posicional previo.
- `recordOnboardingTour(id,status,options?:{scopeKey?,signal?})`.

Preservados métodos/cache/no-store existentes, credenciales same-origin de onboarding, JSON y frontera FormData del navegador. Error panel/module mantiene clase/código/status/payload/missing/dependents/openCount; onboarding añade `OnboardingRequestError extends Error` con code/status, conservando mensajes legacy (`onboarding-checklist-failed`, `onboarding-tour-update-failed`) y error operativo cuando body fallido no es JSON. Errores de aborto se propagan; ningún wrapper hace replay.

Verificación Node24.20.0 sobre esta base/delta: cinco suites focales, **36/36 PASS sin skips/retries**: scope helper8, panel7, módulos5, onboarding-api9, onboarding-tour existente7. Incluye captura A aunque caller cambie opciones aB durante await; malformed nofetch; señales, JSON/FormData, compat exacta caller legado; códigos409 separados y POST no reintentado. `pnpm typecheck` merchant PASS; ESLint focal ocho archivos PASS; prettier aplicado; UI guard contra70a02f79 PASS cuatro archivos sin aumentos; diff-check PASS. Warning Node de tipo módulo en tooling preexistente conserva condición anterior, sin cambios de tooling.

**Ningún caller actual pasó a enviar la marca.** No se modificaron provider/layout/navegación/Inbox/TrialNotice/tour/ModuleSettings ni su dominio/UI. No browser/DB/servidor ni nuevas dependencias. El protocolo queda disponible opt-in, sin adoptar medio contrato en producción; falta servidor S y posterior adopción controlada en B1b/B2, con prueba integrada de cambio de cookie y recuperación. La prueba fetch simulada no certifica esos guards reales. B1b permanece pendiente de A2c/QA/nueva instrucción.

## B2a-owner — Propietario de solicitudes aislado antes de B1b

Pieza adelantada por autorización explícita del coordinador para cerrar carreras sin esperar A2c. `factory continue` sincronizó a base `514b33bd88867fcfe8b4a11f9fd1c449214e1990` y reservó únicamente `backoffice-request-owner.ts`, `backoffice-request-owner.test.ts` y este informe. Sin wiring de provider ni consumidores, sin módulo de query/framework/cache nuevo.

Factoría por documento `createBackofficeRequestOwner(stamp)` con API `reconcile(stamp)`, `acquire(ticket,load(signal,capturedTicket)) → {promise,release}`, `dispose()`. Recursos cerrados a los cuatro nombres B1a: session/modules/inbox/checklist; exclusivamente lecturas. Stamp/tabla de generaciones/ticket se copian y congelan síncronamente. Reconcile recibe proyección **autoritativa del estado local** del provider, nunca props RSC ni un stamp viejo como prueba de frescura; un rollback del caller podría volver vigentes tickets anteriores. B2 debe realizar transición de estado/ref atómica y retirada irreversible antes de llamar al owner. No se inventa un reloj de frescura dentro del owner; esa integración es checkpoint posterior. Loaders/response type de cada recurso deben acordarse en ese propietario, no cambiar arbitrariamente entre consumidores de la misma clave.

Mismo ticket comparte una promesa solo mientras está en curso; settle éxito/rechazo retira por identidad, sin caché de respuesta. Invalida/rechaza/aborta entrada anterior al avanzar generación y mantiene un único pendiente; generación pendiente supersedida se descarta sin ejecutar loader. No inicia pendiente del mismo recurso hasta que termine realmente la promesa del loader anterior, independientemente de que la promesa pública ya se rechazó al invalidar. Scope/época distintos retiran trabajo viejo inmediatamente; finalizador tardío compara identidad y no borra entrada nueva. Esto no demuestra cancelación de SQL: AbortSignal/settle solo conocen el transporte/loader del cliente. Un loader que ignora abort y nunca termina mantiene bloqueado su pendiente del mismo recurso; límites operativos del transporte corresponden a wiring posterior, sin timeouts inventados aquí.

Cada lease tiene suscripción y release idempotente. Desmontaje de uno conserva otro; último release difiere cancelación una microtarea y comprueba reemplazo StrictMode. Campo started evita ejecutar otra vez un loader ya iniciado al reemplazar suscriptor. Rechazos compartidos quedan observados internamente incluso si consumidores desaparecen; loader tardío también tiene handlers. Error local `BackofficeRequestInvalidatedError` con reason generation/scope/released/disposed no usa code409 HTTP ni dispara navegación/replay.

Verificación Node24.20.0, diez casos decisivos y **10/10 PASS sin skips/retries**: dedup simultánea/no caché tras settle; release de un suscriptor; reemplazo StrictMode; último release/aborto/rechazo tardío; fallo/reintento; generación predecisión drenada sin fan-out; único pendiente reemplazable; cambio de ámbito/finally viejo; copia externa del stamp/generaciones/ticket; dispose definitivo sin confundir409. Comando `pnpm exec vitest run src/app/backoffice/backoffice-request-owner.test.ts` desde merchant. Typecheck merchant PASS; ESLint de ambos paths PASS; prettier aplicado; UI guard contra514b33bd PASS un archivo sin aumentos; diff-check PASS. Ninguna prueba declara montaje real ni recuentos HTTP.

Entrega limitada a helper/test/handoff. No provider/layout/Suspense/nav/Inbox/checklist ni llamadas reales, eventos, servidores, browser o DB. El candidato aún necesita QA de este owner y wiring B1b/B2 tras A2c antes de certificar funcionalidades/performance combinadas. No se hace push/PROD.

## B1b — Shell y semilla de módulos, candidato interno NO ACEPTADO

Base efectiva `a40a3be608830e0a4e7c837accfbd1896047f681` por factory continue, tras constructores A2c `7072dd6a` aceptados. Skill impeccable aplicado al alcance performance/estados: leído SKILL, optimize y craft-floor desde la instalación del checkout principal; context ya ejecutado una vez por coordinador, sin repetirlo ni iniciar diseño/docs/dependencias. Se conserva kit/estilo/copy existente.

Cambios reservados:

- Layout mantiene guard `allowBlocked` y recibe core autorizado; ambas ramas (normal y billing blocked) quedan dentro del provider. Suspense propio/fallback null contiene solo `BackofficeModulesSeed`, hoja servidor que espera constructor de A y pasa seed a consumidor cliente. Layout/provider/Inbox no esperan módulos ni leen Inbox por SSR/prefetch.
- Provider suprime todos sus children cuando core es null, conservando el provider presente: retira también nombre del shell bloqueado, contenido RSC, Inbox/checklist y navegación; ningún fallback privado. El consumidor de módulos aplica mediante ticket inicial comprobado, nunca instala datos por orden de llegada.
- Navegación y TrialNotice requieren provider; se retiraron props paralelas y GETs de montaje de sesión/módulos. Módulos salen únicamente del result ready y sus enabled; loading/restricted/unavailable conservan enlaces core. TrialNotice lee billing/rol en vivo y se monta sin condicional SSR de trial; conserva reglas de suscripción/rutas operativas.
- Página conserva guard y redirect staff sin analytics; `readBackofficePagePlan()` reutiliza fila privada servidor para eliminar SELECT adicional, sin ampliar DTO público.
- Tests de layout conservan oráculos de redirect/suscripción/suspensión y adaptan seam anterior al JOIN. Billing se dobla ahora en constructor autorizado, no lectura extra; guard real del control sigue ejecutándose.

Se reservaron/adaptaron siete fixtures que montaban nav/TrialNotice fuera del provider: modules-ui-harness, tables-harness, loyalty-entry, pos-counter-harness, counter-harness, analytics-fixture y billing-harness. Helper nuevo `backoffice-seed-fixture.tsx` convierte SUS respuestas HTTP simuladas previas en seed tipado para bootstrap; no añade ruta legacy al producto ni aplica eventos/DTOs posteriores como store falso. Reconcilia enabledModules del doble con su lista para construir un seed coherente; roles/permisos/nombres siguen opciones de cada fixture. En fixture POS, modo trial usa owner como la sesión simulada existente, evitando un seed staff con aviso exclusivo de owner. **Esos GETs son setup de fixture, nunca conteo inicial comparable con M0.**

Fixture nuevo directo `backoffice-context-fixture.tsx` monta componentes reales con core tipado sin bootstrap HTTP y promesa de semilla bajo Suspense controlado; spec nuevo `backoffice-context.spec.ts` usa Inbox vacío con DTO público completo tipado. Verifica0GET sesión/módulos y1GET Inbox al montar ready, desktop1280/mobile390, no overflow, módulos pendientes sin bloquear core/Inbox, unavailable/restricted/rechazo y retirada de ámbito con seed tardío. La promesa controlada certifica React/browser; **no** certifica RSC/Next streaming real, DB/guards/efectos Inbox reales ni tiempos M0/M1.

Evidencia focal Node24.20.0 / Playwright1.63.0 / Google Chrome for Testing153.0.8010.12:

- Unit `backoffice-context-state.test.ts`, `layout-guard.test.ts`, `layout-billing.test.ts`: **23/23 PASS**, sin skips/retries.
- Merchant `pnpm typecheck`: PASS; ESLint focal de archivos afectados PASS; prettier aplicado; UI guard contraa40a3be6: PASS seis archivos sin aumentos; diff-check PASS. Tras completar campos faltantes del mock Inbox según su tipo público, se volvió a comprobar únicamente spec focal (lint/browser) afectado.
- Browser directo: **8/8 PASS**, retries0, config propia `/private/tmp/checkpass-0238/client-b1b/playwright.config.mjs`, artefactos `results/`.
- Browser legado focal: **6 PASS / 2 FAIL, exit1**, sin retries. Billing390/1440 y cuatro reglas de trial de POS pasan. Fallan ambos `modules-ui.spec.ts` menús390/1280 en línea103, después del evento `business-modules-changed`: Stock esperado0, observado1. Los checks previos de permisos/manifiestos/montaje pasan. Config `legacy.config.mjs`, contextos conservados en `legacy-results/`.
- Adicional Analytics: los dos recorridos existentes Dashboard/Inbox1280/390 pasan (**2/2**) con fixture adaptado, conservando ignorar/reemplazar tarjetas/navegar sin cerrar. Config `analytics.config.mjs`, artefactos `analytics-results/`; snapshots sintéticos heredados quedan en test-results/analytics del worktree. No son benchmark ni aserción visual por sí solos.
- Runtime y hashes de configs guardados en `/private/tmp/checkpass-0238/client-b1b/metadata.json`. Harness `startCatalogHarness` usa puerto127.0.0.1 efímero propio; todos los runners terminaron y afterAll cerró servidores/browser. Sin app real, DB, sesiones/credenciales ni procesos pendientes propios.

**Límite/regresión conservada, candidato NO ACEPTADO para dev/main/publicación:** B1b retiró listeners/GETs dispersos y aún no conecta coordinación B2. No existen recuperación unavailable, foco/reconexión, mutación, refresh del mismo ámbito ni adopción de headers HTTP. Los dos FAIL se mantienen visibles. Además el test legado deja GET módulos estático enabled=true y publica DTO raw false; bajo0238 ese detalle sin ticket ya no es autoridad. B2 deberá revalidar scoped; previa reserva el stub podrá reflejar estado servidor false antes del evento, manteniendo intactas las aserciones de ausencia de Stock/Turnos. No instalar event.detail para fabricar verde ni atribuir el fallo únicamente al fixture: el flujo coordinado de producto sigue pendiente.

Caso de integración obligatorio para B2: módulos RSC lentos + Inbox usable + decisión antes del seed. Invalidar Inbox cierra initialModulesTicket; semilla vieja debe descartarse y módulos no pueden quedar loading indefinidamente. Recuperación corresponde al provider/owner y ticket nuevo, permitida después de mutación; no GET ad hoc de navegación ni cero-montaje aparente. B1b aislado no certifica este caso, API scope409, transporte atómico o preservación completa de formularios tras revalidación.

Se congela este delta con FAIL identificable por instrucción del coordinador; no se integra ni acepta hasta pequeño checkpoint B2 que cierre session/modules y QA del conjunto. Sin implementar ese arreglo, sin push/PROD ni cambios de diferidos. Próximo paso: entrega/rechazo del candidato y reserva explícita para la corrección; no avanzar por iniciativa propia.

## Corrección B1b + B2a session/modules — revisión para QA

El candidato anterior `4916ab386fbeb5afb4b5d2da201dee5906d0f642` fue entregado/rechazado por el coordinador, **sin merge a dev**. Su commit y los dos FAIL históricos permanecen intactos. Corrección autorizada en la misma rama/basea40, sin reset/continue ni incorporar refs mientras había trabajo. Nuevos paths reservados: `backoffice-context-controller.ts`, su test, `backoffice-session-context.ts`; ampliación a `tests/e2e/modules-ui.spec.ts` y paths previos del cliente. Comparación HTTP servidorS estaba QA/aceptada en dev `15a8772a`; esta rama no la incorporó por detrás: la integración HTTP real sigue pendiente del candidato combinado.

Un controlador local por documento reemplaza los snapshots setState de B1a como propietario de estado/tickets: constructor sin I/O, getSnapshot/subscribe para useSyncExternalStore, getServerSnapshot estable mientras el ámbito es válido y redactado tras retirada (nunca reexpone core inicial). `commit` asigna snapshot y ejecuta owner.reconcile síncronamente **antes** de notificar o capturar una intención nueva. Solo ese estado local confirmado proporciona stamp al owner; RSC no revierte generaciones. Attach/cleanup diferido una microtarea tolera reemplazo StrictMode; retirada/dispose son irreversibles. No nuevo framework/store global/caché persistente.

Provider deriva ocultación ante props de otro ámbito durante render; confirma la transición en layoutEffect tras commit para no cancelar transportes por un render concurrente abandonado. Usa la misma factory con adaptadores HTTP S1 reales por defecto; composición opcional de una instancia del mismo controller permite a fixtures usar esos mismos loaders/parser/owner y espiar navegación, sin flags que cambien auth ni store alternativo. Un controller ya retirado tampoco puede entregar privados desde getServerSnapshot. IDs/negocio/marca de props incongruentes nunca habilitan fallback.

Sesión y módulos se coordinan desde el provider: ambos eventos existentes son señales coalescidas por microtarea, **sin leer event.detail**. Invalida antes de capturar tickets, usa owner aceptado de un vigente/un pendiente y GET módulos con scopeKey por valor; reporter queda exento de cabecera. Resultado viejo no aplica ni retira una entrada posterior. Nuevos bootRSC solo disparan revalidación una vez; snapshot prefetcheado no pisa confirmación. Seed ready mantiene0GET auxiliares de montaje; unavailable permite una recuperación módulos (sin reporter inicial), restricted no tiene timer/retry. Error operativo mantiene core y estado de recuperación; 402/403 de módulos entrega restricted, 409 genérico es operativo, scope409 retira y navega una vez sin replay.

Parser puro valida el mínimo realmente consumido del reporter: ausencia de authenticated/campos/identidad/permisos/billing no fabrica defaults ni logout. Reporter false, business/membership explícitamente nulos o membresía válida no activa retiran; nuevo user/business no instala otro ámbito. Dentro del mismo ámbito actualiza rol/permisos/billing/nombre sin navegación completa ni reiniciar época/boot. ScopeKey/boot se conservan solo tras validar mismo ámbito, no se obtienen del reporter. La salida por gates de rutas/refresh y UX de recuperación completa siguen B2b.

Caso de módulos lentos cerrado en esta capa: invalidar Inbox mientras su seed de módulos sigue loading cierra el ticket inicial, avanza también generación de módulos y programa GET scoped único; seed tardío se descarta y módulos dejan loading al resolver. La prueba usa invalidación explícita del controller, **no** una decisión Inbox real: su integración de mutación aún no se hizo.

Adaptación autorizada del contrato de tests de módulos, conservando assertions:

- Dos menús390/1280 mantienen Stock/Turnos esperados0. Antes GET seguía true y solo detalle raw decía false; ahora el doble servidor cambia a false antes de la señal y UI se confirma por GET scoped.
- Control nuevo mantiene GET true y envía raw false; respuesta scoped se retiene y Stock/Turnos deben seguir visibles **antes** de resolverla. Dos señales simultáneas producen un GET con header capturado, sin confiar transitoriamente en payload.
- Último test legado de GET preevento, también autorizado específicamente: primero se monta seed; evento inicia generación vieja true retenida, servidor cambia false y nuevo evento invalida/encola generación posterior. Respuestas se retienen para comprobar que raw/reporter.enabledModules no sustituyen la lista; tras confirmación GET nueva se conserva assert Stock0. Exactamente dos headers scoped, sin tercera lectura. Abort del transporte viejo no se presenta como cancelación SQL.
- Doble de sesión de esa spec ahora expresa authenticated/user/business/rol/permisos/billing coherentes con su seed; no se agregaron defaults productivos para arreglar mocks parciales. Otros oráculos heredados no se relajaron.

Verificación Node24.20.0 / Playwright1.63.0 / Chromium153.0.8010.12:

- Suites estado14 + owner10 + layout9 reutilizan revisión compatible PASS; controller **25/25 PASS** (se agregó negativo de409 genérico y comprobación de server snapshot retirado). Total focal compatible **58 PASS**, sin skips/retries. Hubo corrida conjunta57/57 antes de ese último caso; controller25 volvió a pasar después del delta.
- Typecheck merchant, ESLint focal, prettier, UI guard contraa40 (ocho archivos sin aumentos) y diff-check PASS. Confirmación final de tipos/lint después de último cambio del getter queda registrada en esta entrega.
- Browser corrección inicial **19/19 PASS**: context10, menús/control3, billing2, POS4. Luego se fortaleció control raw con respuesta retenida (1/1 PASS) y se adaptó test GET preevento; **spec módulos COMPLETA6/6 PASS** sin retries (incluye dos recorridos Stock conservados). Evidencia única compatible: context10 + módulos6 + billing2 + POS4 = **22 casos PASS**. No se afirma suite E2E global.
- Configs propias `correction.config.mjs`, `modules-correction.config.mjs` y resultados separados bajo `/private/tmp/checkpass-0238/client-b1b/`; metadata incluye runtime y hashes. `legacy-results/` y FAIL de4916 no se sobrescribieron. Fixtures usan puerto efímero127.0.0.1, cierran afterAll; sin app real/DB/sesiones ni procesos propios pendientes.

Límites conservados: Inbox/checklist aún no usan owner ni envían marca; escritores módulos/tours aún no adoptados. Foco/reconexión, router.refresh coordinado, preservación de formularios en app real y demás B2b siguen pendientes. No medición M1/RSCNext real/SQL nativo ni certificación del conjunto1+2+3. Esta revisión busca aceptar B1b+corrección juntos tras QA independiente, no declarar spec implementada/main/publicación. Sin push/PROD ni cambios de diferidos.

## B2b-I — Inbox con propietario único (base496296f4)

Encargo acotado sobre `496296f4870a4bd70eb517dbfd40606e834cc89e`: Inbox GET/decisiones, controller/provider, helper específico y pruebas/fixture propios. Checklist/tours/PUT módulos/foco global/reconnect/router.refresh/forms permanecen piezaII, sin cambios. No se avanzaron refs ajenos ni se reescribieron entregas/evidencias anteriores.

`analytics/inbox-context-resource.ts` coordina únicamente suscripciones, transporte en curso/pendiente y clave idempotente de decisión. Datos/error/pending residen **solo** en snapshot del controller, con su owner GET ya aceptado. Constructor y attach del provider no hacen Inbox GET: `acquireInbox` lo inicia desde el efecto del componente visible. Dos lectores comparten GET; último release diferido cancela lease sin invalidar seed de módulos ajeno. Respuestas/finally viejos se identifican por request y ticket, sin borrar transporte posterior. Cada remount/refresco intencional posterior vuelve a leer; no hay caché de respuestas de transporte ni store global adicional.

La API específica expuesta por provider/controller es `acquireInbox`, `refreshInbox`, `decideInbox`. Hook conserva inputs/diálogo, validación de recordatorio, temporizadores de vencimiento/recordatorio/preparing y foco visible existentes; ya no mantiene otro payload/GET/POST/revision. El helper coordina como máximo un GET vigente y un refresco pendiente mediante el mismo owner; durante POST no inicia GET nuevo. Cancelación de fetch no certifica cancelación SQL: el owner espera asentamiento del loader antes del siguiente transporte. Un GET iniciado antes de decidir nunca confirma datos después de la decisión o su remount.

Decidir invalida sincrónicamente antes de capturar ticket/cuerpo primitivo clonado y `scopeKey` por valor. Tanto GET como POST envían siempre `X-Backoffice-Scope`; no hay operación sin core/ticket. `expectedVersion` y `operationId` conservan semántica: fallo ambiguo mantiene misma clave para reintento explícito dentro del mismo ámbito/época; otra intención/versión/recordatorio o confirmación genera otra. No se reintenta POST automáticamente. Scope409 retira privados antes de cualquier rama404/409 de tarjeta, navega una vez y no reproduce la operación. 401 también retira; 402/403 limpian tarjetas/muestran denegación sin bucle de navegación ni retry automático, manteniendo core autorizado como módulos restricted. GET explícito posterior puede recuperarse. Salida coordinada de gates de rutas sigue piezaII.

Caso real conectado: decisión mientras módulos iniciales siguen en stream invalida su ticket, dispara recuperación GET módulos scoped y descarta seed RSC tardío. Desmontar simplemente un lector Inbox **no** invalida ese seed; prueba negativa específica. Cambio de ámbito/retirada/dispose limpia Inbox del snapshot y también del serverSnapshot retirado; respuestas tardías no lo repueblan.

Verificación causal focal:

- Unit Inbox24 + controller25 + state14 + owner10: **73/73 PASS**, sin skips/retries. Pruebas con controller y owner reales, sólo adaptadores diferidos: StrictMode release/reattach, dos lectores, drenaje real del loader antes de pendiente, POST+foco+remount, body/ticket capturados, resultado GET viejo, claves ambiguas, conflicto tarjeta vs scope409,403 sin reload-loop, expiry/reminder, rechazo/dispose y stream de módulos.
- Browser contexto final **15/15 PASS** en `/private/tmp/checkpass-0238/client-inbox/context-final.log` (incluye cuatro flujos nuevos y403); los fixtures usan adaptadores HTTP S1 reales + navegación observada del mismo controller. El harness compila React en production: wrapper StrictMode no prueba replay de efectos development; el ciclo release/reattach se prueba decisivamente en unidad. No afirmar SSR/streamNext real por esta fixture.
- Primera corrida browser sin escalación: Chromium no pudo lanzar por MachPortRendezvous/Permission denied1100;27 setup FAIL antes de cuerpo de test, conservados `sandbox-launch-results/`. Se resolvió con escalación técnica autorizada, sin permisos de producto/DB ni modificar sandbox/guardias.
- Corrida browser escalada inicial: **26PASS/1FAIL** conservados `browser-run.log` y `results/`. El único FAIL legado `analytics-lifecycle.spec.ts:267` espera response de GET predecisión ahora abortado; cuenta correctamente GET3 antes de colgar. No se presenta como PASS ni se elimina: requiere adaptar únicamente observación de terminal transportado, manteniendo oráculos de coalescing/tarjetas/POST. Reserva pedida al coordinador antes de editar esa spec.

Evidencia final de esa adaptación, estáticos y cierre de recursos se agrega al completar revisión. No app real/DB/M1/SQL, no push/PROD ni cambios de diferidos. Rendimiento de la spec completa y piezaII no están certificados por este checkpoint.

Cierre de esta revisión: coordinador amplió reserva EXACTA a `tests/e2e/analytics-lifecycle.spec.ts` antes de editar. Se adaptó únicamente el test de GET obsoleto: captura identidad y listeners requestfinished/requestfailed **antes** de decidir; acepta cancelación/fin sin esperar response inexistente. Conserva conteos GET3→4, dos tarjetas, un POST y coalescing de dos focos, sin retries ni modificar otros oráculos. El FAIL inicial queda en artefactos anteriores; no se ocultó ni se cambió por skips.

Corrida final sobre fuente estable: **28/28 browser PASS**, context15 + lifecycle13, retries0/skips0, `browser-final.log`, config `final.config.mjs`, `final-results/`. Unit final **73/73 PASS**: Inbox24/controller25/state14/owner10. Typecheck merchant, ESLint de todos los sources/tests modificados, prettier y diff-check PASS. UI guard contra496296f4 PASS sin aumentos (solo código reservado; prueba final incluye archivos nuevos al stage). Metadata de Node24.20.0/Playwright1.63.0/Chromium153.0.8010.12 y hashes de configs: `/private/tmp/checkpass-0238/client-inbox/metadata.json`.

Runners terminados exit0 y harness/browser cerrados por afterAll; recurso propio `harness:0238-client-inbox`, artefactos exclusivos en `/private/tmp/checkpass-0238/client-inbox/`. Sin procesos propios activos, servidores Next/apps reales, DB, credenciales, push/PROD. El siguiente paso es factory/QA independiente del coordinador; no se empezó piezaII. Propuesta paralela de tours enviada solo por mensaje: callback persist con intención capturada antes RAF, sin dueño/store/GET alternativo ni cambios de controller/provider. No se certifica rendimiento, cancelación SQL, auth real, RSCNext real ni preservación de forms de piezaII con estas pruebas mock.

## Checklist owner + API aditiva de confirmación módulos — base6173451c

Encargo sobre `6173451cbcb3fe2861f7c4573769046073470ac6`, sin mover refs ni modificar tours/settings de A. Paths reservados: controller/test/provider, checklist UI y nuevo `onboarding/checklist-context-resource.ts`/test, spec/único fixture browser y handoff. Ampliación explícita del coordinador a `analytics/inbox-context-resource.test.ts`: se añaden solo dos adaptadores obligatorios al setup; sus24 oráculos no se relajan. No adaptadores productivos opcionales/fallback de mocks.

El helper coordina únicamente suscripciones/cola checklist, usando owner existente y el **único** payload/status del snapshot del controller. `acquireChecklist` se llama en efecto del componente no-counter; constructor, seed y attach del provider no hacen GET. Último release diferido libera solo su lease, sin cancelar otro lector ni invalidar el seed inicial de módulos. Nuevo montaje/refresco intencional hace HTTP nueva. Todos los GET capturan ticket/scope por valor, comparten transporte, drenan loader obsoleto antes de pendiente y descartan resultados/finally tardíos. Retirement/dispose limpian también checklist del snapshot y del serverSnapshot retirado.

`refreshChecklist` invalida sincrónicamente antes de capturar nueva lectura, incluso con componente montado/GET en curso. Provider escucha END una vez; componente conserva solo hide/show, closed/expanded y feedback email locales. Señales síncronas se coalescen por microtarea; un END de cierre y otro tras confirmar POST pueden requerir dos lecturas. No se promete una HTTP total entre eventos separados por await. La invalidación previa del tour ya aceptada dispara lectura visible; END final invalida esa generación para que una respuesta preconfirmación no gane. No payload raw ni polling/global cache.

`verifyChecklistEmail` mantiene endpoint auth exento de scope header. Captura ticket/scope/epoch antes del await, descarta éxito/error de intención retirada y no cancela una intención solo por generación nueva del mismo ámbito. `sent:true` da feedback vigente; `verified:true` programa checklist scoped y revalidación sesión/módulos, **sin parchear items/emailVerified desde JSON auth**. GET scoped/reporter confirman datos. Error operativo conserva reintento manual. GET checklist401/scope409 retira privados y navega una vez;402/403 restringe solo checklist, sin navegación/retry-loop. UI/copy/CSS/kit y controles de visibilidad existentes se conservan.

API aditiva módulos expresamente encargada por coordinador para A:

- `applyConfirmedModule(ticket:BackofficeResourceTicket,module:ModuleDTO):boolean`: exige recurso modules, ticket completo vigente, shape completo y ID presente en lista ready actual. Copia campos públicos/arrays, invalida modules/inbox/checklist **antes** de mezclar un solo DTO confirmado en lista actual; stale/malformed/base ausente retorna false sin aplicar. Resultado GET previo no puede sobrescribir confirmación; aliases del caller no mutan snapshot.
- `revalidateModules():void`: invalida y encola solo módulos mediante owner existente/scoped, sin GET reporter automático. Ambas firmas están en provider/controller, sin writer de dominio/HTTP/store genérico. A fue avisado por mensaje para consumirlas desde su helper/settings en otra entrega.

Verificación local de esta revisión, Node24.20.0 / Playwright1.63.0 / Chromium153.0.8010.12:

- Unit focal: checklist23, controller29 (25 anteriores+4 confirmación módulos), Inbox24, state14, owner10. **100/100 PASS**, corrida final completa registrada en `/private/tmp/checkpass-0238/client-checklist/unit-final.log`, sin skips/retries.
- Browser **35/35 PASS**, retries0/skips0: contexto22 (15 previos+7 checklist) + lifecycleInbox13. Incluye dos lectores/soltar uno, counter0GET, END duplicados, fallo/retry, POSTtour con intención real de A+END final mientras GET anterior sigue retenido, auth exento/scoped confirmación retenida y éxito/error email tardíos tras retirada. Fixture único hace puente de callback persistente+eventos del tour; no certifica Driver/Next/auth/DB reales. Wrapper StrictMode del harness compila React production; replay de cleanup/reattach se prueba en unit.
- Merchant typecheck, ESLint focal, prettier/diff-check y UI guard contra6173451c: PASS sin aumentos. No nuevos nativos/handlers/styles productivos ni cambios de kit/guardias.
- Config propia y logs/resultados/metadata bajo `/private/tmp/checkpass-0238/client-checklist/`; server127.0.0.1 efímero/mockHTTP, escalación técnica de Chromium autorizada por MachPort del sandbox. Runner35 termina exit0 y afterAll cierra server/browser; no procesos propios activos, app real/DB ni secretos.

Límites: módulos UI/escritores son pieza independiente de A; foco global/reconnect/router.refresh/salida coordinada de gates y preservación de forms reales siguen posteriores. La API ya permite conectar futuras señales al mismo propietario sin añadir transportes alternativos. No medición M1/RSCNext/SQL real/rendimiento ni certificación completa de spec por esta entrega. Diferidos intactos, sin push/PROD; siguiente paso factory/QA independiente del candidato combinado.

Confirmación final de los dos casos email tardío: se reforzó la espera para observar response.finished y dos frames antes de afirmar ausencia de feedback/lecturas, evitando aserción prematura. Solo esos dos casos modificados se repitieron: **2/2 PASS**, retries0/skips0, `verify-terminal.log`/`verify-terminal-results/`; los33 casos compatibles anteriores no se repitieron. Cobertura browser única compatible35, no37. Metadata guarda runtimes y hashes de ambas configs privadas; no se sustituyeron logs anteriores.
