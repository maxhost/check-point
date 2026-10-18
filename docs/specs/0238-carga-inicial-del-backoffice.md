---
spec: 0238
fecha: 2026-10-17
estado: borrador
resumen: Reducir lecturas y peticiones repetidas del backoffice compartiendo datos por petición, entregando contexto inicial al navegador y uniendo la lectura de membresía/negocio con facturación; medir el resultado combinado sin cambiar acceso ni ciclo del Inbox.
disjunta: no; contrato servidor/cliente y guards compartidos requieren integración serial y QA de combinación.
archivos: apps/merchant/src/server/auth-guards.ts; server/api-owner.ts; server/api-permission.ts; server/billing-gate.ts; server/session-view.ts y nuevos helpers de contexto; server/onboarding/checklist-facts.ts; app/backoffice/layout.tsx y page.tsx; navegación, trial-notice, contexto cliente e inbox-state; rutas auxiliares afectadas y tests focales. Sin cambios al kit, esquema o migraciones.
---

# 0238 — Carga inicial del backoffice

Piso L2 por autenticación/tenant; alcance transversal acotado según ADR 0144 y `VERIFICACION.md`. Implementa la propuesta [ADR 0154](../adr/0154-contexto-del-backoffice-por-peticion.md). El owner eligió las mejoras 1, 2 y 3 juntas y medición posterior. **Entrega actual documental**: borrador completo para revisión, no autorización nueva de implementación, push ni PROD. No se declara cerrada antes de revisar el ADR y este contrato.

## 1. Problema y comportamiento esperado

La [medición de Joyas](../factory/0237-inbox-measurement.md) encontró 9 consultas de página, 4 parejas exactas duplicadas, efectos repetidos de módulos/sesión y 4 lecturas secuenciales de acceso por GET Inbox. Las dos recargas dev mostraron el Inbox vacío listo en 4185/4624 ms. No comparar esos tiempos con un build de entrega ni extrapolar Strict Mode a PROD.

Al entrar, los consumidores comparten contexto inicial de negocio, navegación y prueba. El servidor resuelve cada dato común una vez por petición compatible y reduce viajes SQL de acceso. Inbox sigue siendo legible/accionable con la misma semántica. El cambio debe disminuir trabajo y mejorar el tiempo hasta avisos utilizables en medición comparable.

## 2. Alcance cerrado de la propuesta

Incluye las tres mejoras:

1. Contexto de datos por petición para página/layout, guards y consumidores auxiliares afectados. Reutilización de promesas y filas, con decisiones de acceso separadas.
2. Contexto inicial mínimo enviado a navegación/TrialNotice y propietario cliente único de módulos/sesión. Deduplicación de peticiones en curso y refrescos del Inbox.
3. Lectura combinada de membresía/negocio y suscripción con filtros/selección equivalentes; reuso de la fila de facturación para acceso y plan. Better Auth mantiene su obtención de sesión/usuario. Paralelismo solo entre cargas independientes.

No incluye caché de autorización entre peticiones, caché de cookie/JWT/Redis/CDN privado, nuevas tablas/índices/migraciones, servicios de realtime, actualización por venta, fórmulas o tarjetas nuevas, equilibrio mensual/diario ni avance del Dashboard, cambios de UI visual, schema de módulos, filtros de permisos nuevos, refactor de todos los guards del sistema, corrección de CI histórica o nuevos crons. Los números del Dashboard son un encargo futuro, no criterio de esta spec.

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

## 5. Contratos HTTP y ciclo del Inbox

No se agrega endpoint bootstrap ni cambia el contrato público de GET sesión, GET módulos, GET checklist o acciones del Inbox.

| Superficie | Compatibilidad requerida |
| --- | --- |
| `GET /api/merchant/session` | Misma forma JSON y reporter 200; no amplía datos privados ni se convierte en guard |
| `GET /api/modules` | Mismos módulos, permisos, estado y códigos vigentes; autorización propia |
| `GET /api/onboarding/checklist` | Misma forma, estados de error y exclusividad owner; contexto de sesión compartido dentro del Request |
| `GET /api/analytics/inbox` | Contrato 2 intacto: ready/preparing, timezone, preparedAt, nextReminderAt, refreshAfterMs y cards; mismos códigos de error |
| `POST /api/analytics/inbox/:id/:decision` | Versiones, operationId, idempotencia, carreras, decisiones, privacidad y límites de recordatorio de 0237 sin cambios |

El GET Inbox permanece iniciado por componente visible. SSR/prefetch del shell no llama a `readInbox`, no dispara evaluación diaria ni registra exposición. Deduplicar GET simultáneos no los convierte en un caché persistente: un refresco intencional posterior hace una lectura nueva. Mantener expiración local, recordatorios, fallback de 3 s, try-lock sin espera, decisiones optimistas vigentes y protección frente a respuestas tardías. No trasladar efectos a `useMemo`, render, cálculo de navegación ni un layout prefetcheado.

## 6. Evidencia y aceptación

### Funcional y aislamiento

- Matriz real y focal: sin cookie, forjada, expirada, revocada entre peticiones; owner/staff; pertenencia/permiso ausentes; membresía desactivada; negocio suspendido/cerrado; suscripción ausente/prueba vencida; email y PIN según cada ruta. Mismos resultados/códigos/precedencia y privacidad que la base.
- Dos usuarios/negocios intercalados; usuario con varias membresías y filtros distintos; modo página frente a permiso/owner; ningún dato cruzado ni cambio accidental de negocio.
- Dos peticiones separadas observan una revocación, cambio de permisos/módulos o vencimiento de acceso ocurrido entre ambas. Una página prefetcheada no habilita una acción posterior revocada.
- Seed sin GET auxiliares, un Inbox/un checklist por montaje; focos/eventos simultáneos, errores y reintento, logout y respuesta tardía; compatibilidad con las carreras de `inbox-state` ya cubiertas.
- Inbox real protegido con 0 y con hasta 5 tarjetas: mismo contenido/acciones, exposición una vez por reglas existentes, recordatorio, expiración, contención/preparing y acciones conservadas. Sin skips/retries para declarar PASS.

### Rendimiento del conjunto

La [ficha](../factory/0238-plan-carga-backoffice.md) fija receta y recursos antes de correr. Referencia y candidato: build de entrega, mismo host/runtime/config/dataset, política, observador y red. Nunca PROD ni cookie/sessionstorage del navegador del owner. La referencia comparable se captura **antes del código**, como preparación del experimento; la medición de resultado se hace **después de integrar 1 + 2 + 3**, sin evaluaciones parciales para escoger un resultado favorable.

Por revisión/caso: primera entrada conservada separada y 30 recargas con rutas ya usadas, sin descartes por tiempo ni retries. Separar ready vacío, ready con 5 tarjetas, preparing ycontención. La distribución cuantitativa requerida corresponde a los 2 casos ready; preparing/contención requieren recorrido completo y contrato temporal correcto, sin mezclarlos en su percentil. Incluir TTFB/pintura, comienzo/respuestaInbox, momento de contenido utilizable, número de HTTP/SQL, etapas de acceso/conexión/transacción y tamaño serializado. Medir carga conjunta de auxiliares y efectos, no solo el SQL más rápido.

Aceptar rendimiento solo si: (a) se cumplen conteos/semántica anteriores; (b) mediana y p95 del tiempo hasta Inbox utilizable mejoran en **ambos casos ready**, con trazas que vinculen la reducción al trabajo eliminado; (c) TTFB y primera pintura no empeoran en mediana o p95. Sin margen de regresión inventado ni SLA absoluto nuevo. Si hay ruido o falla, resultado no demostrado/FAIL; conservarlo y corregir causa/método antes de una nueva tanda justificada. No cambiar fixture, sacar red o asumir que falló la DB por duración HTTP. No se exige 30 renders de contención ni 30 generaciones diarias para inflar el experimento.

El FAIL anterior `evaluateBusiness`1817,621042 ms>1000 ms mide otro contrato. Esta spec no lo sustituye, reabre ni acepta. No comparar base en desarrollo con candidato con build de entrega ni el mínimo de una tanda contra el promedio de otra.

## 7. Archivos, dependencias y checks

Servidor: nuevos helpers de contexto y proyección en `apps/merchant/src/server/`; wrappers de `auth-guards`, `api-owner`, `api-permission`, `billing-gate`, contexto de staff y checklist; reporter GET sesión y GET módulos solo si necesitan compartir constructores conservando contratos. Excluir operaciones de escritura de staff y resto de flujos salvo regresiones comprobadas del helper.

Cliente: `app/backoffice/layout.tsx`, `page.tsx`, nuevo provider/hooks, `backoffice-navigation.tsx`, `subscription/trial-notice.tsx`, `settings/module-request.ts`, `analytics/inbox-state.ts` y checklist si requiere el deduplicador. No modificar kit/guardias/CSS para pasar un check. Contrato de contexto es dependencia común con un escritor, definido antes de sus consumidores.

Pruebas focales de guards/reporters/billing/tenant, datos/consultas y browser de provider/Inbox; typecheck/lint/guardia UI para archivos afectados. DB real solo mediante `tools/neon-test.sh`, aislada/reservada y con inventario previo del ledger. Smoke de app con build real indispensable para comprobar cableado y medidas; los browsers con HTTP simulado no lo sustituyen. QA independiente de entrega y combinación según ADR 0144; no afirmar que una revisión del autor es independiente. No ejecutar verify global como trámite de documentación o de cada fix; release conserva pre-push vigente.

## 8. Definition of Done

- [ ] Spec y ADR revisados y cerrados/aceptados; reserva documental local antes del código.
- [ ] Las 3 mejoras integradas con contrato inicial versionado y sin cambios de acceso/ciclo.
- [ ] Matriz de aislamiento/precedencia y negativos reales PASS; guards compartidos revisados en todos sus consumidores afectados.
- [ ] Conteos de página/API/navegador comprobados en app real y Strict Mode sin ocultar duplicación.
- [ ] Comparación de build base/candidato satisface la aceptación o se registra FAIL sin declarar trabajo entregado.
- [ ] QA independiente, combinación y handoff ligados a SHA/entorno, con fallos/skips y límites explícitos.
- [ ] Sin DDL/PROD/push ni incorporación de los diferidos; rollback local documentado y artefactos privados protegidos.

## 9. Reversión y límites

Revertir los commits de producto como conjunto 1 + 2 + 3 en integración local; no hay cambios de esquema/datos que revertir. APIs públicas compatibles permiten volver a los consumidores anteriores. Invalidar el estado de presentación al recargar; no dejar credenciales/filas privadas persistidas. Conservar el informe y las 4 capturas de diagnóstico.

Diferidos conservados: QA manual del owner de 0237, CI histórica, rendimiento frío de evaluación FAIL, ciudades/crons remotos, clima/calendario, ahorro, Marketing/cupón/tarjeta 11 parqueada y Dashboard numérico/realtime. El estado previo de 102 migraciones PROD es el registro anterior, no una nueva verificación. Operaciones PROD y cada push requieren nueva autorización explícita.
