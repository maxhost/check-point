---
spec: 0003
fecha: 2026-08-10
estado: borrador
resumen: El owner compone campañas con reglas, efectos, límites y simulación mediante un Incentive Engine determinista.
disjunta: no
archivos: packages/domain/src/incentives/**, packages/db/src/schema/incentives.ts, apps/merchant/src/app/**/campaigns/**, packages/contracts/src/incentives/**
---

# 0003 — Wizard de campañas e Incentive Engine

## Problema

El owner necesita convertir una intención comercial —por ejemplo, atraer gente a un
evento, promover comida después de una cerveza o premiar una compra— en una campaña
operable sin programar. La misma definición debe producir resultados iguales para el
wizard, el teléfono del staff, la wallet y las métricas. Una lógica especial por juego o
por pantalla causaría beneficios duplicados, campañas a pérdida o imposibles de auditar.

## Alcance

**Entra:**

- Campañas a nivel de negocio, asignables a uno, varios o todos sus locales activos.
- Tipos de campaña `promotion` y `event`; un evento es una campaña, no otra entidad.
- Estados `draft`, `scheduled`, `active`, `paused`, `ended` y `archived`.
- Un wizard con plantillas, bloques cerrados, estimación económica, simulación y
  publicación de versiones.
- Un Incentive Engine que evalúa reglas sobre eventos confiables y emite puntos,
  créditos de juego o cupones de forma atómica e idempotente.
- Disparadores V1: `checkin_completed`, `purchase_credited` y `game_completed`.
- Condiciones V1: locales asignados/activos, calendario y horario, mínimo de compra,
  producto o categoría acreditada, primera compra/check-in dentro de la campaña y
  límites por consumidor, compra o campaña.
- Efectos V1: `grant_points`, `grant_stamp`, `grant_game_credit`, `issue_coupon` y
  `record_campaign_outcome` para la trazabilidad que no entrega valor.
- Límites/presupuestos por campaña, local, consumidor, compra, cupón o crédito de
  juego; guardrails de coste y margen para efectos con beneficio económico.
- Políticas de acumulación `stackable`, `exclusive_per_event` y `one_per_purchase`.

**No entra:**

- DSL libre, expresiones anidadas, atributos arbitrarios de clientes o automatizaciones
  genéricas tipo Zapier.
- Carro de ecommerce, bundles, descuentos prorrateados, precio tachado, referrals,
  publicidad de terceros, webhooks o experimentos A/B.
- Reservas de mesa como efecto ejecutable. Puede describirse como objetivo de una
  campaña, pero su operación se incorpora sólo con una spec posterior.
- IA que configure o optimice campañas, segmentación individual e inventario.
- Mecánicas no implementadas: raspadita, bingo y AR aparecen sólo como próximas, sin
  poder activarse ni generar efectos.

## Diseño

El owner no escribe reglas desde cero. Elige un objetivo de negocio medible y el wizard
genera una o más reglas legibles conforme a ADR 0022. Check-in, puntos, sellos, cupones,
juegos y distribución son mecánicas/efectos, no objetivos. Cada objetivo declara evento
verificable y métrica primaria antes de seleccionar el incentivo; sólo se habilita si el
negocio posee los datos mínimos necesarios.
Ejemplos iniciales:

- **Compra y juega:** compra acreditada de al menos X → crédito de ruleta.
- **Fidelización:** compra acreditada de al menos X → puntos del negocio.
- **Activa tu visita:** check-in válido → crédito o cupón, con límite por consumidor.
- **Evento:** campaña con fecha/locales; una compra previa puede emitir un cupón válido
  durante el evento.

Una campaña puede tener varias reglas porque un mismo evento, como un aniversario, puede
requerir compra → puntos o sellos del programa activo, compra → crédito de ruleta y
check-in → cupón. Cada regla tiene
un único disparador y condiciones unidas por `AND`; una alternativa `OR` se representa con
otra regla. Esto mantiene el resultado explicable y comprobable.

El wizard sigue este recorrido: constructor guiado de regla (el objetivo se elige dentro
de la frase y recomienda, pero no bloquea, la configuración; selectores cerrados para
disparador, condiciones, distribución, efecto y límite) → fechas/horarios/locales →
revisión, simulación y publicación. Siempre muestra el alcance efectivo y qué bloques no
están disponibles en V1; no expone un DSL o texto libre.

Una campaña no se borra físicamente desde el flujo normal. `archived` la oculta de la
operación futura y conserva su historia. Si pierde todos sus locales activos, pasa a
`paused` con razón `no_active_locations`; beneficios existentes se validan después con
las reglas de elegibilidad de ADR 0009.

### Especificación técnica

#### Límites de responsabilidad

- **Merchant app:** captura la configuración y muestra simulación, versiones y estado.
  No decide elegibilidad ni escribe saldos directamente.
- **Incentive Engine (`packages/domain`):** valida una definición, evalúa reglas y
  devuelve una decisión explicable; no conoce componentes de interfaz ni proveedores.
- **Servicio transaccional (`packages/db` + servidor):** carga el contexto autorizado,
  adquiere límites necesarios, aplica una única decisión idempotente y persiste activos,
  presupuesto, auditoría y métricas.
- **Consola de staff, check-in y juegos:** sólo producen eventos de dominio confiables
  tras su propia autorización. Nunca pueden declarar un premio desde el cliente.

#### Modelo de datos e invariantes

`campaign` pertenece a un `business_id`, contiene `type`, `objective`, estado, rango de
fechas/horario, locales asignados y el número de versión publicada. Un efecto de programa
debe ser compatible con la modalidad activa/versionada definida en ADR 0020.
`campaign_location`
relaciona la campaña con N locales. Sólo locales `active` son operativos.

`campaign_version` guarda una definición completa e inmutable con su número de revisión,
fecha de publicación y snapshot del autor. Un borrador se puede editar; activar o
programar publica una versión. Toda modificación de una campaña ya publicada crea otra
revisión para eventos futuros. `campaign_rule`, `rule_condition`, `rule_effect` y
`rule_limit` pertenecen a una versión, no a la campaña mutable.

Una `campaign_rule` tiene `trigger_type`, `priority` y `accumulation_policy`. Sus
condiciones se evalúan todas como `AND`. Una condición sólo puede ser uno de los tipos
cerrados del alcance. Un efecto sólo puede ser uno de los tipos cerrados del alcance,
incluye su configuración y, cuando entrega valor, el coste declarado, valor comercial,
vigencia, cupo y alcance de canje. Los puntos sólo se emiten en el wallet del mismo
`business_id`; ningún efecto transfiere activos a otro negocio.

Los presupuestos son contadores con ámbito explícito: `campaign`, `location`, `consumer`,
`purchase`, `coupon` o `game_credit`. Cada contador posee un máximo de emisiones y/o de
coste, periodo de recurrencia si aplica y consumo reservado/confirmado. No puede quedar
negativo ni superarse por concurrencia.

Cada evaluación persiste `incentive_evaluation` con `idempotency_key`, evento fuente,
campaña/versión/reglas consideradas, decisión, motivos de descarte y snapshots de los
valores económicos. Los activos emitidos y los movimientos de wallet guardan esta
referencia y sus propios snapshots. El índice único de la clave de idempotencia evita una
segunda emisión por el mismo evento.

#### Evaluación, conflictos y economía

El servidor acepta un evento tipado con identificador estable, negocio, local, consumidor
si existe y datos ya verificados. Evalúa sólo versiones `active` cuya campaña esté en
fecha, horario y local elegibles. Luego verifica disparador, condiciones, presupuesto y
guardrail económico.

Las reglas elegibles se ordenan por prioridad ascendente. `stackable` permite aplicar la
regla junto con las demás; `exclusive_per_event` impide continuar con reglas posteriores
del mismo evento; `one_per_purchase` impide otra emisión de esa regla para el identificador
de compra. La validación de cupón en 0006 define la incompatibilidad final entre cupones;
esta spec no implementa comparación de “mejor descuento”.

La decisión se aplica en una transacción PostgreSQL: verifica de nuevo límites y estado,
registra evaluación, crea todos los activos/movimientos, consume presupuesto y genera
auditoría/métrica. Si cualquier comprobación o inserción falla, se revierte todo. Una
repetición devuelve el resultado original idempotente, sin una nueva emisión.

El coste/margen se calcula con los datos del catálogo de 0002. No se puede publicar una
regla con información económica incompleta para un efecto económico ni con margen bruto
proyectado negativo. V1 exige margen mínimo de 0%; el owner puede ser advertido de un
margen bajo, pero no configurarlo por debajo de cero.

#### Simulación y publicación

La simulación recibe un caso sintético del wizard (local, fecha/hora, importe y, cuando
aplique, producto/categoría). Ejecuta exactamente el evaluador de reglas, pero no crea
activos, no consume presupuesto ni escribe auditoría. Devuelve reglas consideradas,
motivos de aceptación/rechazo, efectos proyectados, coste máximo/esperado conocido y
conflictos. Nunca se presenta como una emisión real.

Publicar exige al menos un local asignado y activo, calendario válido, una regla válida,
efectos disponibles, límites consistentes y guardrails aprobados. Una campaña `scheduled`
se vuelve `active` al inicio y una `active` se vuelve `ended` al finalizar mediante trabajo
idempotente; el owner puede pausar o finalizar antes. `archived` sólo es posible después
de finalizar o pausar y nunca altera la versión histórica.

#### Autorización, interfaz y observabilidad

Sólo un owner con acceso al negocio puede crear, editar, publicar, pausar, finalizar o
archivar campañas. Merchant staff no cambia campañas en V1: consume la versión activa
desde su superficie operativa según su pertenencia a locales. Todo acceso y operación se
filtra por `business_id`; un owner no puede leer ni simular campañas de otro negocio.

La interfaz móvil de merchant conserva el borrador ante error de red, muestra errores por
campo y deja inequívoco si está en borrador, simulación o publicado. Las operaciones de
publicar y cambiar estado requieren confirmación y respuesta del servidor; no hay éxito
optimista.

Se registran logs estructurados para evaluación fallida, bloqueo económico, presupuesto
agotado, conflicto, publicación y transición de estado. Las métricas técnicas incluyen
latencia/error de evaluación; las métricas de producto consumen la evaluación y efectos
persistidos, no eventos del navegador.

### Arquitectura de referencia

- ADR 0002 — guardrail económico y activos aislados por negocio.
- ADR 0006 — programas/campañas a nivel negocio y operación por local.
- ADR 0007 — permisos, operación local y snapshots de auditoría.
- ADR 0009 — elegibilidad dinámica al cerrar un local.
- ADR 0017 — estándar production grade.
- ADR 0018 — Incentive Engine de campañas compuestas.
- `docs/ARCHITECTURE.md` — monorepo, servidor, Neon/Drizzle y transacciones.

## Archivos

| Archivo | Acción |
|---|---|
| `packages/contracts/src/incentives/**` | crear contratos tipados de evento, regla, efecto, simulación y decisión |
| `packages/domain/src/incentives/**` | crear validador, evaluador determinista y cálculo económico |
| `packages/db/src/schema/incentives.ts` | crear esquema y migraciones de campaña, versión, reglas, límites y evaluaciones |
| `packages/db/src/services/incentives/**` | crear aplicación transaccional e idempotente de decisiones |
| `apps/merchant/src/app/**/campaigns/**` | crear listado, wizard, simulación y gestión de estados de campaña |
| `apps/merchant/src/app/**/campaigns/**/*.test.*` | crear pruebas de interfaz/acciones del wizard |
| `packages/domain/src/incentives/**/*.test.*` | crear pruebas unitarias del motor |
| `packages/db/src/services/incentives/**/*.test.*` | crear pruebas de integración transaccional |

### Disjunta?

No. Colisiona con 0002 por catálogo/economía, con 0005 porque produce los eventos de
compra acreditada, con 0006 porque concede créditos/cupones y con 0007 porque consume sus
evaluaciones para métricas. Se implementa después de 0001 y 0002, y antes de las partes
operativas de 0005–0007.

### Archivos compartidos

| Qué | Quién lo deja listo | Cuándo |
|---|---|---|
| Identidades, negocio/locales y autorización merchant | 0001–0002 | Antes de implementar 0003 |
| Catálogo, coste, precio y categorías | 0002 | Antes de validar efectos económicos |
| Contrato de activos de wallet y de canje | orquestador, alineado con 0004 y 0006 | Antes de despachar implementación |

## Definition of Done

- [ ] Un owner puede crear un borrador de `promotion` o `event`, asignarlo a N locales
  activos y configurar una o más reglas mediante una plantilla y bloques permitidos.
- [ ] El wizard no permite publicar disparadores, condiciones, efectos o juegos fuera de
  V1, ni una campaña sin locales activos, calendario, regla válida o economía completa.
- [ ] Cada regla publicada pertenece a una versión inmutable; editar una publicada crea
  una revisión y activos/evaluaciones históricos conservan su snapshot.
- [ ] El motor evalúa exclusivamente eventos confiables, aplica condiciones `AND`,
  prioridad y política de acumulación de manera determinista y explicable.
- [ ] Una evaluación que entrega valor es atómica, autorizada, aislada por negocio y
  exactamente una vez para su clave de idempotencia.
- [ ] Presupuestos, cupos, horarios, locales inactivos, guardrails y conflictos bloquean
  la emisión antes de crear cualquier activo o movimiento.
- [ ] La simulación usa el mismo evaluador y muestra la decisión, sin persistir ni gastar
  presupuesto.
- [ ] Owner puede pausar/finalizar/archivar y las transiciones programadas son
  idempotentes; merchant staff sólo opera campañas elegibles, sin modificar definición.
- [ ] Auditoría, logs y métricas persistidas permiten rastrear cada efecto hasta evento,
  regla, versión y actor.
- [ ] Revisor independiente ejecuta el plan de pruebas y emite PASS conforme a
  `docs/AGENT-WORKFLOW.md`.

## Plan de pruebas y verificación

- [ ] Prueba unitaria: una regla `purchase_credited` con mínimo de compra concede puntos;
  importe inferior, horario fuera de rango, producto distinto o local no asignado no
  concede ningún efecto.
- [ ] Prueba unitaria: dos reglas con `AND`, prioridad y cada política de acumulación
  producen exactamente los efectos esperados; `exclusive_per_event` detiene las
  posteriores.
- [ ] Prueba unitaria: definición con efecto económico incompleto, margen negativo,
  cupo inválido o bloque no soportado es inválida para publicación.
- [ ] Prueba de integración: dos solicitudes concurrentes del mismo evento sólo crean una
  evaluación, un movimiento y los activos del resultado original.
- [ ] Prueba de integración: presupuesto/cupo agotado o fallo al crear un efecto revierte
  toda la transacción y no deja activos, saldo, consumo ni auditoría parcial.
- [ ] Prueba de integración: la simulación devuelve la misma decisión proyectada que una
  evaluación posterior elegible, pero no modifica tablas ni contadores.
- [ ] Prueba de integración: al editar una campaña activa se crea versión nueva y una
  evaluación/activo previo mantiene los snapshots de la versión anterior.
- [ ] Prueba de autorización: owner de negocio A no puede listar, simular ni modificar
  campaña de B; merchant staff no puede publicar ni editar campañas.
- [ ] Prueba E2E móvil: owner crea campaña de plantilla, recibe advertencia/bloqueo
  económico, simula y publica una válida; el estado visible coincide con la respuesta de
  servidor.
- [ ] Prueba de regresión: una campaña sin locales activos queda pausada con razón
  `no_active_locations` y no concede nuevos efectos.
- [ ] Comandos exactos: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm test:e2e` y `pnpm build`.
- [ ] Verificación manual: en navegador móvil, recorrer el wizard con una campaña de
  aniversario de dos locales; confirmar que el resumen identifica límites, coste,
  efectos y versión publicada sin emitir beneficios reales.

## Handoff requerido

El implementador y el revisor usan el formato de `docs/AGENT-WORKFLOW.md`. El revisor
debe producir un PASS independiente antes de marcar la spec como `implementada`.

## Abierto

- Definir en specs posteriores el contrato exacto de reservas y cuándo puede convertirse
  en un efecto disponible.
- Definir, con 0006, los parámetros económicos específicos de cada tipo de cupón y la
  regla final de incompatibilidad entre cupones durante un canje.
