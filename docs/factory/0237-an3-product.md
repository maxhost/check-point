# 0237 — AN-3 producto (B)

Task `analytics-an2-product`, worktree `/private/tmp/checkpass-an2/analytics-an2-product`, rama homónima continuada. Base AN-3 `bebf26c99b42754f7915b392487162b408a51833`; fundamento A integrado por ff-only y factory refresh `6cecd378ab7a2926fc98df2206d1ce08a58058de`. **Fuente B congelada `421ef60c`** (implementación inicial `24da3203`, corrección11 `f30ed877`, reconciliación12 posterior), checkpoint revisable, sin atribuir QA PASS. Spec/contrato con aclaración owner `f7c81e5b`: hábito por cuatro fechas locales distintas.

## Implementación y contratos

Tarjetas 10/11/12 agregadas sin cambiar las tarjetas AN-1/2. Histórico aditivo `customers: { count, visits, returning }` y `promos: [{ id, label, discountMinor, salesMinor, costMinor }]` en el HTTP existente de histórico, conservando períodos/local/tenant y bloques anteriores. Clientes cuenta personas distintas del período; visits conserva todas las operaciones; returning identifica clientes con visita anterior al inicio del período en el mismo alcance de local. Promos muestra descuentos y ventas de los mismos tickets, sin atribución causal. `costMinor` es null sin costo de premio capturado; cero explícito sigue siendo cero. No FX.

- **10:** mínimo28 días desde la primera venta del local; últimos7 días completos contra ocho ventanas previas disjuntas de7 días, incluidos ceros. Cuenta estrictamente mayor que `max(3, media+2*desvío poblacional)`; importe exacto cargado en anulados del local. Acción genérica `view_voided_orders` declarada por A, sin nombres/imports de módulos en core.
- **11:** ≥4 fechas locales distintas por cliente del comercio, uniendo todos sus locales. Múltiples operaciones del mismo día, incluso en locales distintos, conservan sus cantidades y dinero, pero forman un solo día para hábito e intervalos. La última visita se toma de cualquier local; tarjeta11 tiene locationId null y sujeto único del cliente. Última fecha hasta90 días inclusive; ausencia estrictamente mayor a2 medianas y ≥mediana+7. Impacto estimado = suma exacta de importes / días visitados × días esperados perdidos del mes actual. Los días esperados se cuentan sobre la cadencia desde la última fecha, dentro del mes y hasta hoy; el redondeo monetario ocurre solo al final. Si falta algún importe, no se promete monto. La pausa por mediana0 quedó resuelta por owner mediante el mínimo de cuatro fechas distintas; no hay división por0.
- **12:** snapshot vigente versionado por capturedAt/eventId, evaluado al día siguiente del menor endsAt/endedAt. Las tres fechas de campaña se convierten en SQL a día local del negocio antes de entrar al dominio. Draft no produce resultados. Solo métricas de campaña desde su inicio hasta el fin local inclusive. Descuentos cero son datos válidos. El texto separa asociación de causalidad.

Coeficientes que §7 no fija: urgencia10=0,8,11=0,7,12=0,6. Usan p monetario común; cuando11 no puede estimar importe y cuando12 tiene descuento cero se usa p fijo1. Fingerprints/materialidad/novedad, aceptación/descarte, tope5 y umbral0,05 comunes permanecen vigentes.

Acuerdo A: visitas `money_count` con count por operación y quantity por monto conocido; pseudónimo UUIDv5 namespace Analytics fijo. `promo_discount` y `promo_sales` de POS/canje comparten `coupon:<couponId>` con prioridad/revisión2 POS frente a1 core, independiente del orden de delivery; costo de premio en fuente aparte. `promo_sales` contiene neto completo del ticket asociado. La deduplicación de ingesta pertenece a A, no se vuelve a sumar desde origen en B. Campañas se leen solo de `analytics.campaign_snapshot`; cálculos leen únicamente resúmenes analytics, además de configuración/nombres/pertenencia normales.

H5 confirmado en APIs: Marketing ofrece campañas y audiencias, sin envío manual individual. Acción core `view_customer` → `/backoffice/customers/analytics/:uuidv5`, permiso existente `counter`. Acción core `view_campaign_results` → detalle específico existente, permiso `marketing`; ambas validan UUID y destino exactos. No se expone consumerId.

Nuevo contrato `GET /api/customers/analytics/:id`: sesión/membresía y permiso `counter`; negocio exclusivamente del guard. 200 `{ name, enrolledAt, lastVisitAt }`; 404 para pseudónimo inválido/ajeno/inexistente; 401/403 existentes. El destino de Clientes usa el mismo guard. **Fuera de cálculos Analíticas**, el reader normal `customer_reader`/RLS resuelve el UUIDv5 con `public.digest(bytes,'sha1')` usando namespace/name canónicos exportados por A; la proyección solo devuelve tres campos permitidos. No columna ni backfill de business_customer. El filtro requiere recorrer los clientes del tenant para calcular el UUID; no se abrió optimización general.

## Evidencia focal antes de DB

Node24.20.0. Fuente funcionalf30ed877 sobre6cecd378. Sin push/deploy/PROD, verify global, benchmark, mutaciones, kit/guardias/CSS ni cambios en índices/estados comunes.

- **34 unit PASS**:9AN-3 y25 previas (22dominio+3acciones), `/private/tmp/an3-product-unit-business.log`; incluye4fechas repartidas en locales, importes de varias operaciones/mismo día, ausencia25d y visita ayer en otro local sin aviso. El checkpoint inicial tuvo33PASS, supersedido por esta cobertura.
- **Typecheck merchant PASS**, `/private/tmp/an3-product-types-business.log`.
- **ESLint focal PASS**, `/private/tmp/an3-product-lint2.log`; corrección11 PASS en `/private/tmp/an3-product-lint-business.log`.
- **UIguard PASS**,2archivos sin aumentos contra6cecd378, `/private/tmp/an3-product-uiguard.log`.
- Detector Impeccable `[]`; skill aplicada como extensión de interfaz existente. Inspección visual proporcional móvil390/escritorio1280 de histórico e inbox.
- **Browser histórico2/2 PASS** (`/private/tmp/an3-product-browser.log`; posteriormente ambos volvieron a pasar en browser2) e **inbox2/2 PASS** (`/private/tmp/an3-product-browser-business.log`, posterior al fix11 y copy aprobado), sin retries. Histórico cambia período/local, cuenta todas operaciones y muestra vacíos honestos; inbox muestra10/11/12, descarta10 y acepta11 navegando al pseudónimo específico. Harness de componentes con kit/nav/CSS reales y HTTP simulado; **no smoke de app real**. Últimas capturas conservadas `test-results/analytics-an3/inbox-{390,1280}.png`; la selección posterior de inbox limpia capturas históricas del outputDir.

Fallos reales preservados: arranque Chromium en sandbox falló por MachPort; escalación autorizada resolvió el entorno. La primera ejecución añadida de inbox falló por import dinámico Playwright/CommonJS (`exports is not defined`); se cambió a import estático del mismo dominio y se ejecutaron únicamente los dos casos afectados,2PASS sin retries. Typecheck detectó inicialmente dimensionKind ausente en fixture Neon; corregido sin cambiar producto. Un intento de lectura de captura histórica tras la selección inbox no la encontró porque Playwright limpia outputDir; no se presenta como evidencia nueva.

Comandos focales desde raíz, con Node24:

```
pnpm --filter @mi-pasaporte/merchant exec vitest run src/server/analytics/evaluation/customer-promo.test.ts src/server/analytics/evaluation/domain.test.ts src/server/analytics/actions/actions.test.ts
pnpm --filter @mi-pasaporte/merchant typecheck
pnpm exec playwright test --config tests/e2e/support/analytics-an3-fixture.ts
pnpm exec playwright test --config tests/e2e/support/analytics-an3-fixture.ts --grep 'inbox cards'
node tools/ui-guard.ts --base 6cecd378
```

## Pendiente de DB y QA

La DB sigue exclusiva de A; B no ha ejecutado DB. Preparados cuatro casos en `customer-promo.neon.integration.test.ts`: conservación local/count/dinero y hábito por fechas; snapshot23:30Guayaquil (UTC día siguiente), ediciones y draft sin duplicados; histórico período/local/tenant; UUIDv5 Node↔SQL bajo customer_reader con dos homónimos, otro comercio y guardias401/403/404. Ejecutar solo tras GO del coordinador:

```
NEON_TEST_ENV_FILE=/private/tmp/checkpass-0237/migration.env tools/neon-test.sh src/server/analytics/evaluation/customer-promo.neon.integration.test.ts --no-file-parallelism
```

Revisión coordinador detectó el defecto de agrupación11 por local en24da3203: podía avisar ausencia aunque el cliente había visitado otro local. Corregido enf30ed877, con copia «Juan solía venir cada12 días. Su última visita fue hace25 días.»; historial mantiene filtros/locales. QA avisado de la nueva fuente.

No se declara PASS de esos cuatro casos ni QA independiente. No procesos B activos al congelar. Siguiente paso: revisión QA por blobs y turno DB; corregir defectos propios si aparecen y congelar revisión final antes de entrega factory.

## Reconciliación de resultados tardíos — fuente421ef60c

QA encontró que un snapshot llegado tras la corrida `ready` podía perder la tarjeta12 del día siguiente; también una edición del fin podía dejar una candidata previa obsoleta. Corrección fuente **`421ef60c`**: export `reconcileCampaignCandidates(tx,businessId,now?)`, llamado en la misma tx de ingesta después de nuevos snapshots o aportes promo. Adquiere el lock de evaluación negocio/día, lee `inputStatement` mediante esa misma tx y recalcula exclusivamente12 para hoy. Upsert mantiene IDs de elegibles; borra solo12 de hoy que ya no califican. No reabre evaluation_run ni toca10/11, otros días o card_state. Conserva novedad/materialidad comunes.

Cableado ingesta de A todavía pendiente al escribir esta revisión: una sola reconciliación al final de grupos aplicados en orden sourceKey, únicamente si hubo un snapshot nuevo o métrica promo_* nueva. A/coordinador integrarán el checkpoint limpio antes de escribir ese cableado; no se afirma probado el cableado antes de existir.

DB aislada asignada a B por coordinador, wrapper único migration.env, esquema0099 de A. **4/4Neon PASS0skip EXIT0** sobref30,13,40s (`/private/tmp/an3-product-neon.log`). Después **5/5Neon PASS0skip EXIT0** con hook,16,80s (`an3-product-neon-reconcile.log`); se fortaleció el quinto caso para escribir snapshot/aporte dentro de la misma tx antes de llamar al hook y verificar visibilidad antes de commit: **5/5PASS0skip EXIT0,16,19s** (`/private/tmp/an3-product-neon-reconcile-tx.log`), fuente421ef60c. Prueba late snapshot tras runready, mismoID, descarte conserva peso0, nuevo escalón de monto recupera novedad sin borrar state, edición que retira12 y10 intacta. Typecheck y lint afectados PASS (`an3-product-types-reconcile.log`, `an3-product-lint-reconcile.log`).

Todas las corridas terminaron con teardown, sin procesos B activos. No más DB hasta coordinación de recurso para cableado/combinación. Dominio/UI no cambian con este hook:34unit ybrowser evidencias f30 siguen compatibles. La evidencia de fuenteB no sustituye QA ni la prueba combinada del cableado A.
