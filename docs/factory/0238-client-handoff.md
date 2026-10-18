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
