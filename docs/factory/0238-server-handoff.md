# 0238 — Preparación A / servidor

Task `backoffice-0238-server`; base inspeccionada `e93d04871c82a6be38db21251de29dab4233c04d`; worktree `/private/tmp/checkpass-0238/backoffice-0238-server`; rama propia `backoffice-0238-server`.

Estado: **preparación estática, no implementación**. D0/decisión U1 y M0 deben ser satisfechos por el coordinador antes de habilitar A1. No se ejecutaron DB, servidores, builds ni tests; no se leyeron/copiaron archivos de credenciales. No hay cambios de producto, push ni operaciones PROD.

## Inventario para A1

Tipos existentes reutilizables:

| Fuente | Reutilización / límite |
| --- | --- |
| `src/server/session-view.ts` | `SessionView`, `SessionBilling`, `SessionUser`, `SessionBusiness`, `SessionMembership`, `SessionRow` y `toSessionView`. Hoja sin runtime servidor; `SessionBilling` ya es pública/serializable. No rehacer permisos efectivos; `toSessionView` usa `memberPermissions`. Reporter conserva `authenticated:true` con negocio/membresía/billing nulos cuando no hay membresía activa. |
| `src/modules/activation.ts` | `ModuleDTO`: contrato completo actual de GET módulos. Importación **type-only**, nunca runtime desde el DTO compartido/cliente: activation contiene DB/transacciones/server registry. No mover por ceremonia; `BusinessModule` cliente ya es alias type-only de este tipo. |
| `src/modules/contract.ts` | `ModuleNavigationEntry` y `ModulePermission`, tipos puros de manifiesto. |
| `src/server/billing-gate.ts` | `BusinessBilling`: acceso, trialEndsAt Date y fallo. Es servidor; serializar mediante proyección, no enviar Date/fila Stripe por accidente. |
| dominio `server/billing-access.ts` | `AccessRow`, `billingAccess`, `billingAccessFailure`, `trialDaysLeft`; reglas vigentes de acceso. El contexto necesita además plan y customer para la copia de failure y plan interno; nunca exponer esas columnas. |
| `src/server/auth-guards.ts` | `BackofficeSession`, `GuardBusiness`, `GuardMembership`: firmas públicas vigentes a preservar. |
| `src/server/api-owner.ts`, `api-permission.ts` | Results y messages vigentes. No ampliar flag que desactive controles. |

Propuesta mínima **para acordar, todavía no contrato congelado**:

- `BackofficeSelectionMode = 'page' | 'active-member' | 'active-owner'`. Reporter comparte datos de `page`, nunca su revocación/redirect. Opciones como allowBlocked no forman parte de la clave de lectura.
- DTO puro `BackofficeInitialContext` con `version:1`, `bootId`, ámbito público opaco usuario/negocio, negocio mínimo (id/name/status/timezone/currencyCode), membresía con rol/status/permisos efectivos, `SessionBilling`. Acordar si el ámbito usa identificadores públicos existentes o marca opaca única; no inventar otra credencial. `scopeKey` solo si D0 acepta U1, sin raw session id.
- `BackofficeModulesSeed = { bootId, result: {state:'ready',modules:ModuleDTO[]} | {state:'restricted'} | {state:'unavailable'} }`; loading vive localmente. El ticket inicial se liga a bootId/época/generación del provider, no a un reloj servidor. B puede usar fixtures tipadas; nombres finales y shape exacto se congelan en A1.
- Contexto **servidor solamente**, sesión Better Auth íntegra nullable, reloj único por petición y promesas de lecturas por modo; `subscription:null` significa fila ausente confirmada. Fallo de obtención se representa como fallo/promesa rechazada, nunca como suscripción nula.
- Firma propuesta RSC `readBackofficeContext(mode)` export estable envuelto una vez en React.cache y parámetros primitivos; identidad/session compartida en helper cacheado independiente para no repetir auth al cambiar modo. Firma propuesta HTTP `getBackofficeRequestContext(request)` obtiene objeto explícito con `read(mode)`; WeakMap por objeto Request puede preservar firmas existentes y permitir compartir con checklist. No mapa por userId/cookie entre peticiones. La elección exacta debe documentar identidad del Request, ciclo y tests; no confiar React.cache en Route Handlers.
- Contexto entrega datos, wrappers vigentes deciden gates. Constructores `readBackofficeInitialCore` y `readBackofficeInitialModules` consumen contexto ya elegido y validado; el segundo se observa bajo Suspense de B y no bloquea core.

Precisión elevada al coordinador y compartida con B: reporter actual no expone session id ni scopeKey. Por sí solo no distingue nuevo login de la misma cuenta/negocio; con U1 la primera petición adoptada portando la marca anterior recibe 409 y establece documento nuevo. No agregar campos al reporter ni prometer detección instantánea sin señal. `enabledModules` de reporter es señal para revalidación coherente; módulos del provider deben tener una fuente derivada de `ready.modules`, no otro store competidor.

## A2a y matriz de selección/gates

A2a conserva consultas separadas; JOIN corresponde exclusivamente a A2b. Página/reporter usan cualquier membresía del usuario, orden negocio.createdAt ASC y limit1, sin filtrar estado. Active-member filtra status active, cualquier rol; active-owner filtra status active y rol owner. No nuevo desempate. `staff.ts` contiene `ownerContext` y `membershipContext`; sus writers y demás consultas quedan fuera de refactor.

| Caller | Decisiones / precedencia que deben mantenerse |
| --- | --- |
| Página/layout `requireBackofficeSession` | Sesión → fila/no fila y revocación → membresía/revocación → negocio closed → staff suspendido → billing según allowBlocked → PIN. Owner suspendido conserva pantalla propia; motivo solo owner. |
| Reporter GET sesión | 200 de estado; sin sesión false. No revocar. Proyección de membresía no activa oculta negocio/membresía/billing. No trasladar decisiones de página a reporter. |
| API owner | Sesión → owner activo → email (excepto wrapper nombrado sin gate) → estado → billing salvo allowBlocked. |
| API permission/member | Sesión → miembro activo → permiso si aplica → email del owner según wrapper → estado → billing → PIN. No cambiar la selección para satisfacer el header U1. |
| Checklist | Guard owner sin gate de email y facts comparten misma sesión Request; lectura de tours independiente solo después de acceso permitido. |
| Seed módulos | Mismos gates de GET módulos aplicados con hechos del contexto página; categoría ya leída por contexto. No volver a abrir auth/selección HTTP. Restricted no lee módulos. Error módulos produce unavailable sin destruir core. |

A2b usa LEFT JOIN 0..1 con `core_subscription_business_unique`. Fallback exclusivo de fallo JOIN: **un** intento member-only por contexto/mode con sesión ya validada y filtros idénticos, solo para preservar denegaciones previas a billing; caller que alcanzaría billing propaga error original. No usar fallback para conceder acceso, unir filas de intentos distintos ni reintentar por consumidor. Fijar protocolo A1 antes de implementar.

## Paths adicionales que requieren reserva antes del checkpoint correspondiente

Paths relativos a `apps/merchant/` (tres archivos nuevos ya reservados, no creados):

- A2a: `src/server/auth-guards.ts`, `src/server/api-owner.ts`, `src/server/api-permission.ts`, `src/server/onboarding/checklist-facts.ts`; tests focales propios `src/server/backoffice-context.test.ts` y ajustes a `src/server/auth-guards.test.ts`, `src/server/api-permission.test.ts` si los doubles deben migrar.
- A2b: `src/server/billing-gate.ts`, helpers de lectura exclusivamente en `src/server/staff.ts`, `src/server/backoffice-context.neon.integration.test.ts` nuevo. Ampliar tests existentes solo cuando cambie contrato interno/mock, sin ocultar regresiones.
- A2c: `src/app/api/merchant/session/route.ts`, `src/modules/activation.ts`, `src/app/api/modules/route.ts` si reutiliza constructor, y tests focales `src/server/backoffice-initial-context.test.ts` nuevo / `src/modules/activation.test.ts`.
- S condicional U1: nombre sugerido `src/server/backoffice-scope.ts` y su test; `api-owner.ts` / `api-permission.ts` ya asignados para comprobación post-gates. Revisar adapters de analytics/onboarding/dispatcher solo si hacen falta para private,no-store y tipado409, reservar sus paths antes. No habilitar medio protocolo ni cambiar writers/lifecycle.

Inventario estático: 68 archivos de servidor, módulos y API mencionan guards API; no implica 68 cambios. Guard de página tiene consumidores TSX en 22 rutas/componentes adicionales al layout según búsqueda, incluido layout y rutas de módulos; conservar firmas reduce superficie. Antes de modificar wrapper repetir inventario al SHA real e incluir `api-member.ts` delegador y rutas API billing con allowBlocked. Tests de superficie son decisivos para consumidores no migrados.

Pruebas existentes pertinentes (no ejecutadas):

- `src/server/auth-guards.test.ts`, `api-owner-surfaces.test.ts`, `api-permission.test.ts`, `api-permission-surfaces.test.ts`.
- `src/server/billing-auth-guards.neon.integration.test.ts`.
- `src/app/api/merchant/session/session.neon.integration.test.ts`, `session-twin.neon.integration.test.ts`.
- `src/server/onboarding-checklist.neon.integration.test.ts`, `src/modules/activation.test.ts`, `src/modules/modules-dispatch.neon.integration.test.ts`.
- `src/server/analytics/http/lifecycle.test.ts`, `fallback.test.ts` para asegurar wire/errors y ciclo Inbox al adoptar contexto.

Nuevos casos focales: Request repetido / dos Requests identidades intercaladas / revocación entre Requests / modos distintos; JOIN ausente y multimiembro; fallo exclusivo de subscription con permiso/email/status denegado vs caller autorizado, segundo fallo fallback; módulos slow/reject y semántica de seed. Negativos tenant y JOIN reales solo wrapper protegido con reserva DB. No volver a certificar catálogo global por cada checkpoint.

## Inventario estático de migraciones y fixture M0

Al SHA base: `packages/db/drizzle/meta/_journal.json` contiene **102 entradas**, idx0..101; **102 archivos SQL**, ninguno ausente ni extra respecto del journal. Últimas entradas: `0097_analytics_an1`, `0098_analytics_stock_gauge`, `0099_analytics_campaign_snapshots`, `0100_analytics_metric_lookup`, `0101_analytics_inbox_lifecycle`. Esto valida repositorio, **no** el ledger de ninguna DB. No se verificó entorno ni se aplicó DDL.

Herramientas existentes y restricciones:

- `tools/neon-test.sh` selecciona env mediante NEON_TEST_ENV_FILE, valida endpoint protegido y requiere CI URLs, luego **ejecuta db:migrate antes de tests**. No invocarlo hasta inventariar ledger real con método protegido autorizado/reservado; 102 archivos locales no demuestra cero pendientes en CI. No puede tratarse como mero runner read-only.
- `src/server/analytics/evaluation/lifecycle.neon.integration.test.ts` ya demuestra creación de businesses propios con UUID, evaluation_run ready y estados/candidatas coherentes con política vigente, más cleanup por IDs. Es patrón de fixture real reutilizable, no script persistente que se pueda ejecutar para dejar fixture del navegador: su teardown destruye sus ámbitos.
- Los `tests/e2e/support/analytics*-fixture.ts` existentes usan HTTP route.fulfill y harness React. Sirven para interacción, **no M0 real, conteos SQL ni rendimiento app**.
- `performance-seed.neon.integration.test.ts` es seed histórico 29.2M protegido por ANALYTICS_PERF_SEED; **no ejecutarlo ni reutilizar DB histórica** para esta tarea.

Receta propuesta a concretar por coordinador con recurso protegido: fixture sintética de owner verificado con sesión por flujo existente, membresía active, suscripción trial vigente suficientemente larga, negocio USD/America/Guayaquil, configuración completa que evite tarjetas nuevas por falta de datos. Empty: run ready del día de negocio y cero candidatas/estados elegibles. Five: cinco candidatas/estados coherentes con política/categoría/capacidades, identidades/acciones/versiones conocidas, vigencias cubriendo campaña, run ready. Manifiesto registra también todos los controles/candidatas leídos, exposición y session renewal. Cinco INSERT no garantiza cinco tarjetas: validar salida real/readInbox y capacidades sin mocks antes de medir, estabilizar exposición simétricamente A/B. Preparación/restauración y cleanup solo IDs propios fuera del reloj; exposición necesaria dentro del reloj. No copiar fechas fijas 2026 de tests si el día real es otro, ni cambiar reloj solo en un lado.

No existe en los paths inspeccionados un fixture persistente listo para navegador con todo auth+ready0/5; será necesario ensamblar un setup focal sobre patrones existentes y reservar su path/recurso explícitamente. No inventar endpoint bootstrap ni ejecutar writes libres para salvar ese hueco. No resetear Joyas ni fixtures ajenas.

## Evidencia y próximo paso

Inspección por `rg`/lectura de archivos; Node24.20.0; inventario journal mediante script Node fs sobre archivos públicos. No test PASS de producto. Siguiente paso autorizado únicamente tras mensaje del coordinador: A1, contrato mínimo en commit propio, acordado con B; después otro mensaje para A2a. Ningún proceso propio que detener.

## Cierre del fixture M0 antes de A1

El owner aceptó U1 y el coordinador cerró D0 en `6e45066c` (leído mediante git show, sin cambiar base del worker). Preparación posterior autorizada: tres archivos focales de fixture/soportes, entregados inicialmente en `eabafefef92d9c8faa9970ca590ec798a60f70b2`. **A1 todavía no comenzó**; el coordinador comunicó M0 completo y espera integrar/sincronizar las bases antes de habilitarlo.

El fixture crea dos owners/negocios sintéticos identificados por manifiesto privado, ready0/5, USD/Guayaquil y trial; verifica visibilidad/acciones/versiones/decisiones mediante lifecycle real y restaura exposición inicial fuera del reloj. Login reutiliza REQUEST_CODE/VERIFY y validación BetterAuth, OTP solo en memoria y cookies privadas separadas; sin token fabricado. Cleanup explícito por IDs/ownership. Setup inicial usó vida abreviada: se preservó su evidencia, se limpió explícitamente y setup02 usa exactamente vida de política del writer. Ese primer PASS no certifica fixture M0 válido. La campaña vigente usa setup02, según registro del coordinador.

Corrección posterior de modularidad: el fixture core tenía dos literales de módulo detectables. Ahora setup **exige** `BACKOFFICE_MEASUREMENT_MODULE_IDS` como arreglo JSON explícito; no hay defaults. `manifest.moduleIds` persiste esa configuración, validada contra el registro (conjunto no vacío, strings, sin duplicados, IDs existentes y dependencias incluidas). Setup inserta esa lista y inspect compara el conjunto habilitado real con el manifiesto. Los nombres concretos pertenecen a los datos externos del experimento; no se cambió guard, se ofuscó un string ni se movió código para eludir el barrido.

El coordinador añadió al manifiesto actual la lista equivalente al setup real, preservando `before-module-config.json`; **esta corrección no sembró, reseteó ni alteró datos DB**. El único wrapper ejecutado en este checkpoint fue `node /private/tmp/checkpass-0238/artifacts/run-fixture.cjs inspect`: EXIT0, 1/1 sin skips, 2675ms. Es inspección SQL; no llama readInbox ni expone tarjetas. Log privado `fixture-inspect.log`.

Checks del checkpoint: merchant `tsc --noEmit --pretty false`, ESLint focal, Prettier y diff-check EXIT0. Tres suites de guardias de módulos: **24 PASS / 2 FAIL**, sin skips; no se declara verde global. `modules-boundary.test.ts` pasa 10/10. Los fallos heredados son `policy-simulation.test.ts` (dos literales) y `analytics/lifecycle/index.ts` (uno) en regla2, y dependencia del test expenses/immediate hacia stock/count en regla7. Ningún archivo de fixture aparece en offenders. Los dos tests de guard y los cuatro archivos implicados son idénticos al SHA base `e93d04871c82a6be38db21251de29dab4233c04d` (`git diff --exit-code` EXIT0); no añadimos violaciones. Log `fixture-modules-guards.log`. Se conservan diferidos/fallos históricos y no se modifica su clasificación.

Sin procesos propios ni nuevas operaciones DB pendientes del worker. No factory deliver mientras siga reservada la tarea implementación. Siguiente paso: integración local explícita por coordinador, base sincronizada y mensaje habilitando únicamente A1; no A2a ni push/PROD.

## A1 — contrato común

Entrada sincronizada por coordinador: `f35014e922c66e688b63f663158e86895e33aaf6`, después de D0 cerrado y M0 válido comunicado. Cambio acotado a `src/backoffice-context-contract.ts`, `docs/factory/0238-contract.md` y este handoff. No se crearon helpers runtime/stubs ni se refactorizó producto.

B confirmó por mensaje antes del commit el DTO: version1, bootId/scopeKey obligatorios, userId/emailVerified booleano, business mínimo, membresía efectiva y SessionBilling pública. Módulos separados con resultado ready/restricted/unavailable y sobre bootId/scopeKey; loading solo local. IDs no duplicados ni sesión cruda. ModuleDTO/SessionBilling importados/exportados únicamente como tipos. Contrato documental fija firmas RSC/Request, selección y precedencia, fallback único, tickets/transiciones y superficies HTTP adoptadas obligatorias; reporter conserva JSON y nueva sesión misma cuenta se detecta por409 de siguiente API adoptada, no reporter por sí solo.

Evidencia A1: merchant `tsc --noEmit --pretty false` EXIT0; ESLint/Prettier focales y diff-check EXIT0. Artefactos `/private/tmp/checkpass-0238/artifacts/a1-contract/{client.tsx,server.ts,check.cjs,result.log}`: TypeScript consume contrato desde cliente y servidor, asignabilidad JSON, rechazo tipado de loading servidor y core sin scopeKey, y compilación de contrato emite únicamente `export {};` (sin imports runtime). No pruebas DB, server ni benchmark en A1. Esta evidencia valida contrato/serialización, no producto ni rendimiento.

Siguiente reserva propuesta para **A2a únicamente tras mensaje coordinador**: `server/backoffice-context.ts`, `server/auth-guards.ts`, `server/api-owner.ts`, `server/api-permission.ts`, `server/onboarding/checklist-facts.ts`; nuevo `server/backoffice-context.test.ts` y ajustes focales de `auth-guards.test.ts` / `api-permission.test.ts` si cambian doubles internos. No editar aún JOIN/staff/constructores/reporter; A2a mantiene consultas separadas y debe demostrar identidad Request/RSC, no repetición interna y revocación entre peticiones. Coordinador integra A1 y habilita checkpoint siguiente; worker no factory deliver ni avanza por su cuenta.

## A2a — promesas de datos por petición, sin JOIN

Base sincronizada por coordinador `77dc18aaea1d0b66fbc0043e06d07ec5f5d2b511`, con A1 integrado/QA y autorización únicamente A2a. Nuevo `server/backoffice-context.ts`: promesa de sesión BetterAuth nativa, promesas de membresía por modo y una única promesa de `readBusinessBilling` por negocio; reloj y bootId por contexto. RSC usa React.cache estable sin argumentos, HTTP usa WeakMap por identidad del objeto Request. No cache por cookie/userId ni entre Requests. Rechazos quedan memorizados dentro de la petición; no se transforman en ausencia.

Guard de página consume la consulta original extraída, con misma proyección/filtro/orden/límite. Modos API delegan todavía `ownerContext`/`membershipContext` existentes, para mantener selección y dobles de consumidores; tipos internos conservan proyecciones por modo en este checkpoint, sin inventar campos faltantes. A2b podrá unificar la proyección al introducir JOIN; DTO/firma pública A1 no cambió. Wrappers conservan decisiones, nombres, firmas, códigos, redirects y revocación. Billing permanece lazy después de denegaciones anteriores; PIN sigue después de billing. Checklist comparte la sesión del guard dentro del mismo Request y conserva consulta de tours independiente.

Inventario de consumidores/dobles: las dos matrices API siguen usando sus mocks owner/member, no fueron ignorados por resolver DB directo. Ocho archivos adicionales autorizados por coordinador adaptan únicamente forma del mock `billing-gate` a `readBusinessBilling` completo, además de `api-permission.test.ts` ya reservado. Se mantienen mocks `businessBillingFailure` para otros consumidores y las mismas aserciones. En PIN se corrigió el acceso ficticio `active` del stub a `subscribed` con failure null, equivalente a negocio con acceso. No se añadieron fallbacks de producción para tests.

Verificación: 13 suites focales inicialmente **347/347 PASS**, sin skips (`a2a-focal-02.log`); después se añadió caso de revocación de membresía entre Requests del mismo usuario y la suite contexto final pasó **10/10**, sin cambiar producto (`a2a-context-final.log`). Esa suite prueba promesas compartidas/clock, Requests idénticos separados, identidades intercaladas fuera de orden, modos distintos, revocación de sesión y membresía, rechazos auth/member/billing, billing no eager, precedencia billing antes de PIN y sesión compartida guard/checklist. Unit usa React.cache real fuera de árbol RSC; **no demuestra deduplicación RSC real**: smoke app/conteos en M1 todavía pendiente. No se ejecutó DB, server ni benchmark.

Merchant typecheck final, ESLint focal, Prettier y diff-check EXIT0 (`a2a-types-final.log`). Primer typecheck falló TS2345 por inferencia de `.then` sobre tres proyecciones; se corrigió explicitando la unión de resultado del callback, sin cambiar decisiones/auth. Primer focal de cinco suites pasó188/188 (`a2a-focal-01.log`); no se borra ni se declara el primer typecheck verde. Las matrices API emiten dos `staff_route_unavailable TypeError` en controles positivos que solo excluyen401/403; esos checks no prueban camino feliz de dominio y no se presentan como tal.

Guardias de módulos:24 PASS/2 FAIL heredados (`a2a-modules.log`), cero offenders del contexto nuevo. Mismos tres literales heredados y dependencia entre tests de módulos del checkpoint anterior; tests de guard y archivos implicados idénticos a base77dc18aa (`git diff --exit-code` EXIT0). No se cambia guard ni se corrigen diferidos ajenos.

Conteos conceptuales, **no nueva medición**: por un Request API normal sigue auth nativa (adaptador actual2 SELECT)+membresía1+billing1; A2a no reclama reducción4→3 del JOIN. Dos consumidores compatibles de ese Request comparten las mismas promesas y checklist evita la segunda resolución nativa de sesión/usuario, además de su lectura de tours. RSC podrá compartir auth/membresía entre página/layout; layout/plan/módulos aún tienen consumidores heredados que conectarán A2c/B1b. No reclamar aún el máximo4 de página ni el rendimiento final.

Sin procesos propios. Próximo checkpoint propuesto A2b requiere autorización nueva: consulta LEFT JOIN/proyección nullable, fallback único y pruebas negativas reales protegidas con recurso reservado; nombres exactos de nuevos archivos a reservar antes de escribir. No A2b/A2c/S/constructores/writers iniciados. Coordinador integra y habilita; worker no factory deliver ni push/PROD.

## A2b — JOIN nullable y recuperación por modo

Base asignada `4e3b0a562ee0a0591bfeead759b2cc19a3bab644`. El coordinador cerró la precisión interna en `ba16155416e9c3eea309447fdb730e076f91e464` (leída, sin mover checkout durante trabajo): `readBilling(businessId, mode)` **obligatorio**, sin inferir último modo ni mezclar resultados cuando dos modos eligen el mismo negocio. DTO público A1 no cambió.

Nuevo `server/backoffice-membership.ts` reúne filtros exactos page/active-member/active-owner, ASC createdAt y limit1 para JOIN y recuperación. LEFT JOIN subscription0..1 incluye categoría y fila privada plan/status/Stripe exclusivamente servidor. Una fila ausente es null confirmado y deriva blocked mediante `billingFromSubscription`, extraída de la decisión existente de billing-gate. No existe un SELECT de billing adicional en el contexto ni fallback SQL legado para mocks.

Contexto conserva `readSelection(mode)` server-only: joined con member/subscription/billing, o recovered con fila member-only y error original. Promesas auth/selección/proyección y billing se comparten dentro del Request; una recuperación máxima por modo. Wrapper sigue aplicando gates anteriores a billing sobre la fila recuperada. Billing desconocido arroja error original, nunca null/permitido; segundo fallo de recuperación permanece operativo. Los dos modos con mismo negocio conservan fuentes/errores independientes. `requireApiOwner` retorna proyección exacta de seis campos, no fila interna ni plan/Stripe/permisos/PIN. No cambios de writes, esquema, S/HMAC o constructores iniciales.

Adaptaciones de tests explícitamente reservadas: helper `backoffice-membership-fixture.test-support.ts` alimenta el nuevo seam desde los mismos worlds/ownerContext/membershipContext/billing doubles de las suites de guard/domain existentes; ningún fake antiguo queda ignorado silenciosamente. Los tests de contexto/SQL nuevos no usan ese adaptador. Doce suites DB heredadas adaptan el seam pero **no se ejecutaron por inercia** en este checkpoint; mantuvieron aserciones originales. Un mock trial se completó con trialEndsAt futuro y el fixture owner usa permisos crudos vacíos; no se relajó oráculo. Test factories y soportes son adaptación de aislamiento, no evidencia de consultas nativas.

Evidencia final:

- Unit focal:17 suites, **420/420 PASS sin skips** (`a2b-unit-final.log`), incluidos13 casos contexto y4 SQL/proyección. Cubren fallo JOIN/predeny, autorizado/PIN con error original, fallback único y segundo fallo, omisión legítima de billing, dos modos/mismo negocio con una fuente fallida, identidad intercalada/revocación, proyección privada excluida y SQL normal/filtros.
- Wrapper aislado `tools/neon-test.sh src/server/backoffice-context.neon.integration.test.ts --no-file-parallelism`: **5/5 PASS sin skips**,7.10s (`a2b-neon-02.log`; primera corrida válida conservada en01). BetterAuth nativo y cookies creadas por helper de sesión existente; sin mock auth/respuesta. Tres usuarios y cuatro negocios propios, cinco membresías y tres suscripciones (cardinalidades de fixture, no totales globales CI). Page elige primera disabled, member primer staff activo sin suscripción, owner primera owner activa; ausencia no pierde negocio ni cambia selector. Cookies forjada/vencida/revocada entre Requests rechazadas antes de JOIN. Teardown por IDs propios completo.
- Falla PostgreSQL **inyectada explícitamente en la consulta del test**, mediante campo SQL1/0 solo en proyección JOIN del facade getDb de esa suite:22012 real, sin DDL/trigger ni fallas Neon inventadas. Flag restaurado en finally. Prueba predenials, error original memorizado, una recuperación y selector page distinto preservado; no se presenta como error espontáneo de infraestructura.
- Lectura normal repetida:1 JOIN y0 SELECT separados de suscripción contados por facade; SQL/proyección exactos y `EXPLAIN (FORMAT JSON)` sin ANALYZE adjuntos al log. Plan estimado con LEFT nested loop, inner unique y `core_subscription_business_unique`; SeqScan de membresías sobre este conjunto pequeño es válido, no exige índice nuevo. No se infiere latencia PostgreSQL interna ni capacidad PROD.
- Focales de auth nativa compartida autorizados por riesgo: `billing-guards.neon.integration.test.ts` y `billing-routes-auth.neon.integration.test.ts`, **9/9 PASS sin skips**,33.18s (`a2b-native-guards.log`). Teardowns completos. No suite DB global.
- ESLint/Prettier en todos los TS cambiados, merchant typecheck final y diff-check EXIT0 (`a2b-types-final.log`). Una pasada de lint detectó contador no usado en nuevo test; se conectó a su aserción y se repitió el check. No hubo tests DB fallidos ni se borró corrida. Guardias módulos24 PASS/2 FAIL heredados, mismos offenders/archivos idénticos a base4e3b (`a2b-modules.log`); cero offenders nuevos. Dos warnings staff de matrices ya fueron confirmados heredados por QA A2a; no certifican camino feliz de ese dominio.

Preflight del coordinador `ci-preflight-a2b.json`: endpoint protegidoCI hash4e09cdfbd634,102 entradas,0DDL pendiente,111 columnas coincidentes y drift histórico59/60/64/97 preservado. El wrapper ejecutó migrador idempotente, sin migración nueva; no se repararon hashes. Recurso exclusivo durante suites/teardown y liberado por coordinador al terminar. Sin procesos propios ni sesiones/cookies privadas exportadas por estas suites.

La mejora de viajes de acceso proviene ahora del JOIN (auth nativa+una selección con billing); aceptación de conteos globales/tiempos exige M1 de combinación. Página/layout todavía tienen consumidores heredados pendientes de A2c/B1b: no declarar máximo4 ni rendimiento final. `readSelection('page').data.subscription` conserva plan/status privado para próximo getter A2c sin otra lectura. Propuesta A2c: `readBackofficePagePlan()` encapsula defaults heredados none/active y propaga recovered, más core/módulos/signer HMAC; **no implementados**. Esperar QA/continue y reserva explícita antes de empezar.
