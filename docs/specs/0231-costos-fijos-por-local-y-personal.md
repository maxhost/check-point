---
spec: 0231
fecha: 2026-10-14
estado: cerrada
resumen: Costos fijos mensuales por local y sueldos repartidos exactamente entre los locales del integrante, incluyendo personal sin acceso a la app.
disjunta: no; implementación futura comparte Equipo y contratos genéricos core, registros y journal de migraciones
archivos: modules/profitability; schema/modules/profitability; identidad y asignación temporal de Equipo; ADR0147
---

# 0231 — Costos fijos por local y personal

ADR0144; piso L2 por dinero, acceso y aislamiento. **Este encargo entrega solo esta spec y el ADR0147 propuesto. No autoriza código, UI ni migraciones.** Decisiones de producto cerradas; aceptación documental registrada en el [informe de QA](../factory/0230-0231-qa.md). Tablas, nombres y contratos siguientes son solución técnica propuesta, no citas del owner ni implementación existente.

## Problema

El comercio necesita cargar alquiler, servicios y costo total mensual del personal para comparar después sus fijos con la ganancia acumulada. Hoy no existen costos fijos. `core.location` tiene locales activos/archivados; `core.business_membership` representa acceso por comercio, sin locales ni sueldo. El alta actual (`server/staff-create.ts`) siempre crea usuario auth, handle y PIN, y exige al menos un permiso. Los CHECKs de membresía exigen handle/PIN y permisos incluso desactivada: personal sin acceso no se representa enviando permisos vacíos o `status='disabled'` al alta existente.

Evidencia revisada en base `20a6dd6397b9bcbf203b0ca28b51bd5bccd7cada`: esquemas `business.ts`, `membership.ts`, `auth.ts`; `permissions-catalog.ts`; `modules/{contract,registry,route-table}.ts`; `stock/{manifest,local}.ts`; servidor `staff{,-create,-permissions}.ts`, `api-permission.ts` y eventos de módulo. Permisos core: `brand`, `catalog`, `counter`, `locations`, `loyalty`, `marketing`, `staff`; módulos declaran sus propios permisos. Guards exigen sesión y membresía activa; una persona sin membresía no puede acceder. `merchant_auth.user.email` es obligatorio; no se fabrica una fila auth para quien no necesita acceso. El bus existente está especializado en `sale.closed`; no se amplía aquí.

### Preguntas hechas y respuestas del owner

| Pregunta | Respuesta final recibida |
| --- | --- |
| ¿Sueldos ligados al equipo o líneas libres? | Sueldo en ficha del integrante: un importe mensual total, incluyendo salario, seguridad social y otros componentes. Permitir añadir personal en Equipo sin activar ningún permiso. Reemplaza la recomendación inicial de líneas libres en el módulo. |
| ¿Local único o comercio? | Fijos por local, desde Locales como Mesas: alquiler, gas, luz, agua, otros. Al crear/editar integrante permitir seleccionar uno o varios locales. Generales del comercio con varios locales quedan como hallazgo diferido. |
| ¿Cómo repartir el sueldo? | Reparto igual entre los seleccionados. Guardar montos por local, además del total, para manuales futuros sin migrar. Diferencia de redondeo al mismo local determinísticamente; suma exacta y unidad mínima de la moneda. Cambiar locales abre vigencia desde ese mes sin cambiar meses previos. |
| ¿Historial? | Vigencia mensual. Corregir un mes pasado modifica el histórico de ese intervalo. Baja con mes de efecto. Admitir gastos variables por mes; su UI será posterior. |
| ¿Periodicidad? | Importe mensual. |
| ¿Quién ve y edita? | Permiso único «Rentabilidad» para costos fijos, sueldos y, después, márgenes; owner siempre, resto si se lo otorgan. Administrar integrantes/accesos mantiene `staff`. |
| ¿Dónde vive? | Módulo «Rentabilidad», hoy fijos, después SM-datos/Smart Menu/equilibrio; también barberías, salones y spa. Proponer enganche genérico para Equipo mediante ADR. |
| ¿Local archivado? | Conservar históricos y costos hasta baja explícita; bloquear nuevas altas. |

Siguen firmes: no repartir fijos en costo del producto; sin configurar = cero; nunca bloquear ventas; mes corriente y futuros históricos de 3/6/9/12 meses o mismo periodo del año anterior. Esta pieza no implementa equilibrio ni esa analítica.

## Alcance y diseño

### Módulo, permisos y privacidad

Id/esquema `profitability`, nombre «Rentabilidad», `requires: []`, permiso `profitability` con etiqueta «Rentabilidad». Copy genérico: «Costos fijos y del personal de tus locales». `suggestedFor` amplio: gastronomía, barberías, salones y spa usando los identificadores existentes al implementar; no restringe activación por rubro. No depende de Stock, Recetas, POS o Mesas.

Rentabilidad permite leer/editar importes y totales sin exigir además `staff` o `locations`; esos permisos por sí solos no revelan sueldos. `staff` protege identidad/acceso/locales y no se concede por tener Rentabilidad. Owner tiene ambos implícitamente. No conceder Rentabilidad al staff automáticamente o mediante backfill. Se preservan reglas existentes de otorgamiento, protección del owner, no autoedición y restricciones de administradores; no se redefine quién puede otorgar permisos no-core.

Sueldos/importes solo en API/DTO del módulo. DTO de Equipo y respuestas a cambios de locales sin dinero, totales o revisiones monetarias. Personal sin acceso inicial no recibe usuario auth, membresía, login ni PIN. Desactivar acceso no da de baja sueldo ni identidad. El módulo apagado conserva datos y sus rutas devuelven `403 module_disabled`, sin sustituir acceso por cero.

Integración futura en Locales por `locationAction`/`locationPanel` (ADR0141) y Equipo por `staffAction`/`staffPanel` propuestos en [ADR0147](../adr/0147-punto-de-enganche-de-modulos-en-equipo.md). UI/diseño/cableado fuera de este encargo.

### Identidad y locales: capacidad core genérica

Separar persona de acceso, conservando todos los CHECKs actuales de membresía:

| Tabla core propuesta | Campos e invariantes |
| --- | --- |
| `core.staff_person` | `id uuid PK`, `business_id uuid NOT NULL` FK a comercio, `name text NOT NULL` recortado de 1–80 caracteres, `membership_user_id text NULL`, `revision integer NOT NULL DEFAULT 1`, timestamps. Único `(business_id,id)` y vínculo opcional único `(business_id,membership_user_id)`; FK compuesta a membresía. Writer solo vincula `role='staff'` del mismo comercio. Sin acceso inicial: vínculo nulo y ninguna fila auth/membership. Acceso desactivado: vínculo conservado y membresía `disabled`. |
| `core.staff_location_period` | `id uuid PK`, `business_id`, `person_id`, `from_month date`, `until_month date NULL`; FK compuesta a persona; únicos `(business_id,id)` y `(business_id,person_id,from_month)`. Intervalo mensual `[desde,hasta)`, primer día de mes y fin posterior a inicio; sin solapamientos por persona. |
| `core.staff_location_assignment` | `business_id`, `period_id`, `location_id`; PK `(business_id,period_id,location_id)`; FKs compuestas a periodo y local del mismo comercio. Cada periodo contiene 1..N locales sin duplicados. |

Writer core serializa por persona (`FOR UPDATE`), valida revisión esperada, abre/sustituye intervalo hasta siguiente frontera ya programada o fin abierto, conservando meses anteriores y fronteras posteriores. Selección deduplicada y ordenada por UUID, al menos un local propio; rechaza nuevas selecciones de archivados. Puede conservar un archivado ya asignado o retirarlo; archivar no cambia la historia por sí solo. Estos locales no restringen dónde opera el login ni sustituyen permisos.

Backfill: una persona por membresía staff existente, con nombre/vínculo conservados y sin alterar PIN, sesiones o permisos. No inventar locales: existentes sin asignación quedan `locationsConfigured:false`; acceso vigente sigue funcionando, pero sueldo requiere asignación explícita (`422 staff_locations_required`). Altas por la nueva API `/api/staff/people` requieren 1..N locales y mes de efecto. Como compatibilidad transitoria, el alta legada `POST /api/staff` conserva `{name,permissions}` sin locales: crea la persona vinculada con `locationsConfigured:false`, sin inventar asignaciones; puede operar con su acceso vigente, pero no configurar sueldo hasta seleccionar locales explícitamente. Así no se rompe la UI existente antes del encargo UI. No convertir owner en personal asalariado por inferencia.

Contratos core nuevos por `personId` preservan endpoints y DTOs legados por `userId` para personas con acceso; nunca enviar `personId` como si fuera `userId`. Lookup `(businessId,personId)` obtiene vínculo solo si existe. Rutas de PIN/permisos/sesiones continúan usando usuario y sus guards; no operan sobre persona sin acceso. Futura UI de Equipo consumirá las rutas de personas:

| Método y ruta | Contrato bajo guard `staff` |
| --- | --- |
| `POST /api/staff/people` | `{name,access:{enabled:false},locationIds,fromMonth}` o `access:{enabled:true,permissions:[...]}`. `201 {person}`; solo con acceso habilitado incluye `pin` una vez. Identidad, locales y eventual acceso se crean en transacción reutilizando validación/alta vigente, sin huérfanos. |
| `GET /api/staff/people?month=YYYY-MM` | `200 {people}`. Persona: `id,name,revision,access:{state:'none'|'active'|'disabled',userId:null|string,identifier:null|string,permissions:[]|string[]},locationsConfigured,locationIds`. `none`: permisos vacíos e identificador nulo. Sin dinero. |
| `PATCH /api/staff/people/:personId` | `{expectedRevision,name}` → `200 {person}`. Sincroniza perfil auth si existe vínculo; no crea acceso. |
| `PUT /api/staff/people/:personId/access` | `{expectedRevision,enabled:true,permissions:[...]}` crea/vincula primer acceso o reactiva el existente con permisos válidos no vacíos y PIN temporal por flujo vigente; `200 {person,pin}`. `{expectedRevision,enabled:false}` revoca sesiones y desactiva membresía, devuelve `{person}`; si nunca tuvo acceso, no crea filas. |
| `PUT /api/staff/people/:personId/locations` | `{expectedRevision,fromMonth,locationIds}` → `200 {person}` sin importes. Abre vigencia desde mes elegido hasta siguiente frontera existente o fin abierto; mismo conjunto idempotente; revisión obsoleta →`409 revision_conflict`. Callback genérico en misma transacción, explicado abajo. |

Quitar todos los permisos efectivos se representa explícitamente como `enabled:false`. Si había membresía conserva sus permisos almacenados no vacíos por CHECK, pero quedan sin efecto por `status='disabled'`; DTO distingue estado de acceso, no afirma que haya acceso por esa lista. `enabled:true,permissions:[]` continúa inválido. No debilitar `parsePermissions` ni CHECKs; las reglas actuales de otorgamiento/autoedición/administradores se aplican al grant/revocación. Writers legados de alta/renombre/estado sincronizan o crean la persona vinculada en la misma transacción; contratos `userId`/PIN legados no cambian de significado. No hay autenticación por `personId`.

### Persistencia de costos y reparto

| Tabla de módulo propuesta | Campos e invariantes |
| --- | --- |
| `profitability.fixed_cost` | `id uuid PK`, `business_id uuid NOT NULL`, `kind text NOT NULL`, `person_id uuid NULL`, `end_month date NULL`, `revision integer DEFAULT 1 NOT NULL`, timestamps. `kind IN ('rent','gas','electricity','water','other','personnel')`; persona obligatoria exactamente para personal, FK compuesta a persona core; único `(business_id,id)` y único parcial por persona. Un sueldo total por persona, con o sin acceso. |
| `profitability.fixed_cost_period` | `id uuid PK`, `business_id`, `cost_id`, `from_month`, `until_month NULL`, `label text` 1–120 caracteres, `monthly_total numeric(18,2) NOT NULL`, `currency_code text NOT NULL`, `minor_unit integer NOT NULL`, `distribution text NOT NULL`, `staff_location_period_id uuid NULL` para personal, timestamps. FKs compuestas a costo y periodo core; únicos `(business_id,id)` y `(business_id,cost_id,from_month)`. `distribution IN ('single','equal','manual')`: API actual solo escribe single para fijo no personal y equal para sueldo; manual queda representable sin migrar el modelo, sin habilitarlo como funcionalidad. |
| `profitability.fixed_cost_allocation` | `business_id`, `period_id`, `location_id`, `monthly_amount numeric(18,2) NOT NULL`; PK `(business_id,period_id,location_id)`; FKs compuestas a periodo y local core. Guarda cada importe por local, además del total del periodo. |

Campos de tablas core/módulo obligatorios salvo los marcados NULL; comercio/local/costo/persona/periodo usan UUID y los importes son decimales exactos. CHECKs: fechas primer día de mes; fin nulo o posterior a inicio; revisiones positivas; importes finitos no negativos, excluido `NaN`; moneda con forma `[A-Z]{3}`; `minor_unit IN (0,2)` para oferta actual; total múltiplo de `10^-minor_unit`. Writer comprueba misma granularidad en asignaciones, 1..N asignaciones, suma exacta igual al total, exactamente un local para no personal y conjunto igual al core vigente para sueldo. Reglas entre tablas/no solapamiento se verifican en writer transaccional bajo locks, no en CHECK con subconsulta. Índices por comercio/costo/mes y comercio/local/periodo; único por inicio no evita todos los solapamientos.

Moneda/unidad mínima capturadas por vigencia: COP, CLP, JPY y PYG usan 0; demás monedas actualmente ofrecidas usan 2. COP/CLP es criterio de producto del owner, no inferencia ISO. BD escala 2; moneda sin fracciones termina `.00`. API/cálculos exactos por texto decimal/enteros, sin float ni redondeo silencioso de entrada: USD `0.25` válido, COP `0.25` →`422 invalid_amount`. Cero explícito permitido; sin línea suma cero sin fabricar filas. Sin conversiones, cálculo fiscal o nómina.

Reparto determinista: convertir total a entero T de unidades mínimas; deduplicar y ordenar UUID de locales ascendentemente con orden binario estable. Con n locales, `q=T div n`, `r=T mod n`; asignar q a cada uno y **todo r al primero**. No negativos, suma exacta incluso si T<n; no redondear cada parte al más cercano. Persistir resultados; lectura suma asignaciones guardadas, nunca reparte según locales actuales. Modelo ya permite importes individuales futuros, pero API actual rechaza manuales.

Ejemplos A<B<C<D por UUID: USD `100.00`/3=`33.34+33.33+33.33`; USD `0.02`/4=`0.02+0.00+0.00+0.00`; COP `100`/3=`34+33+33`. Sueldo es el costo total ingresado, incluidas cargas, sin calcular componentes.

### Cambio de locales: callback genérico transaccional

ADR0147 propone `staffLocationsChanged(tx, {businessId,personId,fromMonth,untilMonth,locationIds})` opcional en `ModuleServer`. Core llama aportes registrados por mecanismo genérico, sin nombrar módulos ni permisos concretos. Se ejecuta también con el módulo apagado si conserva datos previos: mantenimiento interno de datos derivados, no acceso a API ni permiso de leer/cambiar importes.

El gestor necesita `staff` y revisión core esperada, no Rentabilidad. Solo envía locales/mes y recibe identidad/asignaciones sin dinero. El handler del módulo **solo redistribuye salarios ya existentes**: no crea sueldo ni cambia total, moneda, baja o concepto. Si no hay sueldo, no escribe costos. Cambiar locales tiene como consecuencia automática autorizada dividir el mismo total entre el nuevo conjunto.

Asignaciones core, periodos salariales y montos por local se guardan en la misma transacción. Orden en todos los writers, incluido alta/edición salarial y callback: personas por UUID → costos por UUID; lectura de asignación bajo el mismo lock. Validación de locales toma sus locks en orden consistente. No usar locks costo→persona. El callback divide el tramo afectado desde M hasta la siguiente frontera core; conserva el tramo anterior a M y **todas las variaciones salariales futuras ya programadas**, repartiendo el total propio de cada tramo. Intersecta fronteras core/salario; no aplana una subida futura al valor actual. Si una edición core divide un periodo referenciado, reasigna referencias conservando tramos históricos en esa misma transacción.

Una operación repetida con mismo conjunto no cambia importes/revisiones. El handler mantiene revisión monetaria cuando cambia una distribución, para evitar que un formulario monetario obsoleto sobrescriba selección concurrente. Error revierte cambio de Equipo completo y devuelve error genérico sanitizado (`409 assignment_update_conflict` o `503 assignment_update_failed`), sin importes ni detalles internos; no implica bloqueo de ventas. No admitir un conjunto vacío con sueldo configurado; selección vacía se rechaza como `422 locations_required` sin revelar si cobra. Lecturas puras: no callbacks, reconciliación diferida, jobs, cron ni escrituras al consultar totales. Apagado/reactivación no requiere reconstrucción tardía porque el mantenimiento se ejecutó en el cambio.

### Vigencias, correcciones y archivo

Mes HTTP `YYYY-MM`, fecha primer día en BD; mes corriente en `core.business.timezone`. Intervalos `[from,until)`, fin nulo abierto. Importe mensual completo, sin prorratear días. Variable de un mes `[M,M+1)`. Edición monetaria exige intervalo completo explícito; divide/conserva exteriores y admite corrección pasada deliberada. Para marzo solo, fin abril; no perpetúa el cambio por omisión.

Crear/editar sueldo interseca las vigencias del total con conjuntos core, materializa cada asignación y conserva las fronteras de locales; no cambia core. Cambiar locales desde marzo no altera febrero; corregir explícitamente sueldo de febrero sí cambia su histórico. Cambio core retroactivo preserva meses anteriores al elegido y posteriores a su siguiente frontera.

Baja `endMonth=M` excluye M y posteriores, conserva identidad/periodos, admite efecto pasado; sin DELETE físico. Corregir tras baja solo meses anteriores al efecto; reactivar costo finalizado queda fuera del contrato inicial. Desactivar login no da de baja sueldo.

Archivado conserva costos y locales históricos hasta baja expresa. Rechaza costo nuevo, nueva asignación personal o traslado nuevo hacia ese local; permite corregir importe/etiqueta, dar de baja y retirar su selección. Fronteras derivadas que conservan un archivado ya asignado no son altas nuevas. Validación/alta y archivo deben serializarse por local; probar carrera real. Nunca filtrar históricos por estado actual.

### API del módulo y totales

Prefijo `/api/modules/profitability`; guard permiso efectivo `profitability` y módulo encendido, sin exigir `staff`/`locations`. Comercio desde sesión, UUID ajeno como inexistente. Lookup de personal bajo Rentabilidad solo identidad/locales para configurar costos, sin abrir administración de Equipo.

| Método y ruta | Entrada/salida |
| --- | --- |
| `GET /locations` | `200 {locations:[{id,name,status}]}` propios, incluidos archivados. |
| `GET /people?month=YYYY-MM` | `200 {people:[{id,name,accessState,locationsConfigured,locationIds}]}` con o sin acceso; sin permisos, handle o credenciales; no permite editar identidad/locales. |
| `POST /costs` | No personal: `{kind,label,locationId,monthlyTotal,fromMonth,untilMonth}`. Personal: `{kind:'personnel',personId,label,monthlyTotal,fromMonth,untilMonth}`, sin locales/montos manuales. Fin obligatorio, admite null. `201 {cost}` con revisión, vigencias, moneda/unidad y asignaciones. Personal exige conjunto core en todo el intervalo solicitado. |
| `PUT /costs/:costId/period` | `{expectedRevision,fromMonth,untilMonth,label,monthlyTotal,locationId?}`; local obligatorio solo no personal. `200 {cost}`; conserva exteriores, no acepta asignación manual ni cambiar persona. |
| `POST /costs/:costId/stop` | `{expectedRevision,endMonth}` →`200 {cost}` con baja/revisión. Baja idéntica con revisión actual idempotente; revisión obsoleta conflicto. |
| `GET /costs?locationId=:id&month=YYYY-MM` | Ambos obligatorios; `200 {location,month,costs}`. Cada fila expone costo/periodo/moneda/unidad y **solo monto asignado a ese local**; sueldo total/otros locales en detalle, sin confundir con costo local. Sin datos `costs:[]`. |
| `GET /costs/:costId?month=YYYY-MM` | `200 {cost}` con total, asignaciones, moneda/unidad y revisión efectiva; permite editar sueldo total sin sumar DTOs locales. |
| `GET /totals?month=YYYY-MM&locationId=:id` | Con local: `200 {month,locationId,totals:[{currencyCode,minorUnit,total}]}`. Sin local: `200 {month,totals,locations:[{locationId,status,totals}]}`. Suma asignaciones, no duplica sueldo total. Monedas capturadas distintas en buckets separados, sin conversión. Sin filas bucket cero en moneda/unidad actual. |

DTO edición: `id,kind,personId,endMonth,revision,periods`; periodo: `fromMonth,untilMonth,label,monthlyTotal,currencyCode,minorUnit,distribution,allocations:[{locationId,monthlyAmount}]`. Importes textuales canónicos: 2 decimales o enteros según unidad. Validar revisión bajo lock; un cambio de locales que redistribuyó genera conflicto a la edición monetaria obsoleta, no se sobrescribe.

Errores propios: `400 invalid_body`; `422 invalid_month`, `invalid_period`, `invalid_amount`, `invalid_label`, `location_required`, `staff_locations_required`, `manual_allocation_not_supported`; `404 cost_not_found`, `location_not_found`, `person_not_found`; `409 location_archived`, `salary_already_exists`, `revision_conflict`, `cost_ended`; `503 costs_unavailable`. Forma `ModuleError`; guards conservan errores existentes. Nuevos core: `422 locations_required`, conflicto/404 de revisión/identidad y errores sanitizados del callback, sin revelar sueldos.

Ejemplo USD: A alquiler `1000.00` hasta marzo exclusivo y `1200.00` desde marzo, luz `100.00`; B alquiler `600.00`. Sueldo `900.00`, solo A en febrero y A+B desde marzo. Febrero A=`2000.00`, B=`600.00`, comercio=`2600.00`; marzo A=`1750.00`, B=`1050.00`, comercio=`2800.00`. Cambiar locales desde marzo conserva febrero. Corregir luz solo febrero a `130.00` deja febrero A=`2030.00`, comercio=`2630.00`, marzo igual. Baja salarial desde abril: A=`1300.00`, B=`600.00`, comercio=`1900.00`. Archivar B conserva importes hasta baja expresa. Comercio sin configurar: cero.

Total mensual por local = suma exacta de sus asignaciones vigentes anteriores a baja, por moneda/unidad. Comercio = suma de todos sus locales, incluidos archivados, una vez cada asignación. Sin ganancia/equilibrio. Moneda guardada evita reetiquetar historia, pero no autoriza conversiones o cambiar moneda.

Fuera: UI/diseño/cableado; Smart Menu, SM-datos, Dashboard/equilibrio; costo del producto/vendido; generales del comercio; reparto manual; comisiones, IVA, nómina, horas/pagos. Sueldo es el total ingresado por el comercio.

## Archivos y paralelismo

Entrega exclusiva: esta spec y `docs/adr/0147-punto-de-enganche-de-modulos-en-equipo.md`; sin INDEX, TASKS, estados, código o migraciones.

Implementación futura con encargo/reservas explícitas: `modules/profitability/{manifest.ts,server/}`, esquema/pruebas, exports/config, registros; identidad/asignación core, endpoints/writers de Equipo y adaptación de contratos/consumidores afectados; contrato genérico de callback y dispatcher. Solo módulo importa core, nunca al revés. Backend puede registrar UI `{screens:{}}`; enganches visuales con encargo UI posterior. ADR0147 se revisa como parte del diseño técnico y QA documental.

Migración necesaria: tres tablas core y tres de costos, índices/FKs, backfill 1:1 de identidad staff, **sin costos/locales inventados**. CHECKs de membresía permanecen; no backfill de permiso Rentabilidad. Número SQL se asignará al implementar coordinadamente con0230; no generar/reservar aquí. Journal/snapshots/exports y contratos genéricos con writer único y orden serial, sin merge textual de migraciones.

## Definition of Done

- [ ] Personal con/sin acceso es identidad core única; sin acceso inicial no hay auth/membership/PIN/permisos falsos; grant/revocación mantienen protecciones y compatibilidad legada.
- [ ] Selección 1..N mensual; cambios desde M preservan anteriores, total salarial y subidas futuras; guardado core+montos en misma transacción, incluso módulo apagado, sin filtrar dinero.
- [ ] Total, moneda/unidad y montos individuales persistidos; reparto exacto/determinista, lecturas puras.
- [ ] Alta, corrección pasada, gasto variable, baja y ejemplo funcionan sin intervalos ajenos afectados ni doble suma de sueldo.
- [ ] Rentabilidad protege dinero; `staff` identidad/acceso/locales; archivo, locks, errores y aislamiento comprobados, ventas independientes.
- [ ] QA independiente de entrega/combinación ligado al candidato; spec cerrada no equivale a implementación ni migración aplicada.

## Pruebas pertinentes

Futura implementación: Node24, pruebas focales servidor/contrato y DB aislada solo `tools/neon-test.sh`. Este encargo valida formato/whitespace/números, sin fingir pruebas funcionales futuras.

- Persona sin acceso sin auth/membership/PIN, visible en Equipo y con sueldo; grant vincula una sola identidad, permisos válidos, revocación corta sesiones conservando persona/sueldo. CHECKs/guards negativos actuales siguen pasando; fallo transaccional sin huérfanos. Alta legada `{name,permissions}` funciona sin locales, crea persona vinculada sin asignar y rechaza sueldo hasta selección explícita; API nueva exige 1..N. Rutas legadas y lookup persona/usuario no aceptan identidad sin acceso como login.
- Solo `staff`: identidad/locales sin dinero ni cambio de total. Solo Rentabilidad: costos sin administrar identidad/acceso/locales. Proteger otorgamiento, owner, administradores y autoedición; DTO core sin importes.
- Locales vacíos/duplicados/ajenos/archivados, mes/revisión inválidos; backfill sin local conserva login pero sueldo sin asignación →422. Nunca fabricar local único por inferencia.
- USD100/3, USD0.02/4, COP100/3, cero, CLP/JPY/PYG enteros y otra moneda ofrecida 2 decimales; rechazar COP0.25/exceso precisión/manuales. Persistencia exacta, T<n y orden de entrada distinto produce mismo residuo/local.
- Locales nuevos desde marzo conservan febrero y subidas salariales futuras; total salarial no cambia por callback. Corrección pasada afecta solo intervalo, gasto un mes y baja desde M. Callback idempotente, módulo apagado actualiza igual, reactivar sin reconstrucción lazy. Lecturas no escriben.
- Concurrencia persona→costos en todos los writers; edición salarial frente a cambio locales produce instantánea/conflicto, nunca solapamientos, pérdida de subida futura o asignaciones parciales. Fallo callback revierte Equipo con error sin dinero, ventas no afectadas.
- Aislamiento real: no vincular/leer/mutar persona/costo/local de B desde A; FKtenant; sueldo único; local A no incluye monto de B, comercio suma cada asignación una vez.
- Archivado conserva historia/total; corregir/baja/retirar asignación permitido, alta/selección nueva rechazadas; carrera archivo/alta bajo lock. Captura moneda/unidad y buckets preservan historia sin sumar monedas distintas.
- Enganche futuro: `staffPanel` usa persona con/sin usuario, solo acción autorizada/encendida y servidor valida tenant/revocación; fronteras genéricas intactas sin relajar guardias/tests.

## Handoff y abierto

Preguntas/respuestas incorporadas; personal sin acceso y reparto multilocal decididos. ADR0147 es propuesta técnica revisable en documentación/QA; backend sin UI no depende de cableado visual. Solo documentación, sin implementación/migración aplicada.

Hallazgos owner diferidos, sin resolver ni bloquear: generales de comercio multilocal; Dashboard core sin enganche de equilibrio; servicios con sueldo fijo+comisión, aquí solo fijo. SM-datos/SM definirán equilibrio e históricos agregados. Manuales por local requieren autorización futura, importes ya persistidos para admitirlos sin cambiar ese modelo.

Hallazgo externo de moneda, como0230: captura de moneda/unidad y buckets no resuelven la política general de cambio de moneda del comercio ni conversión de otros datos. No atribuir una política al owner ni ampliar este alcance por ello.
