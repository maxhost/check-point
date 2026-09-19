---
spec: 0081
fecha: 2026-09-19
estado: cerrada
resumen: El TOS del programa pasa a nombrar al negocio de verdad — sus locales, su direccion, su moneda y el dinero que hace falta para ganar una unidad — con las OCHO variables que pidio el owner textual. El hallazgo que define la spec: `renderTermsText` tira 422 cuando el valor es VACIO, no solo cuando la variable no esta en el allowlist, asi que una variable «que a veces no aplica» IMPIDE guardar el programa; por eso el monto por unidad no es una variable opcional sino una SEGUNDA plantilla de `earning`, elegida por el `accrual.mode`. El monto ya se puede mandar hoy y se guarda —medido: `validateAccrual` acepta `per_amount` en Sellos y el compositor no lo pisa—, asi que esta spec NO cambia el dominio: documenta el contrato para quien haga la pantalla 3 y lo lleva al texto legal. Archiva ademas las plantillas `global-draft`, que es lo que cierra el hallazgo abierto de la 0078.
disjunta: no
archivos: apps/merchant/drizzle/0039_tos_variables_del_negocio.sql, apps/merchant/src/server/loyalty-program/terms.ts, apps/merchant/src/server/loyalty-program/terms-scope.ts, apps/merchant/src/server/onboarding/program-defaults.ts, apps/merchant/src/app/api/loyalty-terms/templates/route.ts, docs/specs/0081-contratos-de-api.md
---

# 0081 — Las variables del TOS y el monto por sello

> **Nada de codigo empieza sin esta spec en `cerrada`.**
>
> **Plantilla completa (ADR 0071)**: lleva migracion de semillas y toca dos dominios (terminos y
> negocio/locales), asi que no califica para la CHICA.

## Problema

**El TOS que firma el consumidor no puede nombrar al negocio.** El diccionario de variables de
`renderedTerms` (`loyalty-program/terms.ts:34-50`) tiene **cinco** entradas
—`business_legal_name`, `program_name`, `program_unit_plural`, `program_kind`, `country_code`— y
el owner pidio **ocho**. Medido por el orquestador el 2026-09-19 contra el arbol:

| # | Variable que pidio el owner | Estado MEDIDO |
|---|---|---|
| 1 | Nombre de la empresa | ✅ existe, pero lleva `business.name`, el nombre **comercial**: **no hay columna de razon social** en `core.business` |
| 2 | Listado de nombres de locales | ❌ existe `core.location.name`, **no se pasa** |
| 3 | Direccion de la empresa | ❌ **y la empresa NO tiene direccion**: no hay columna. La tienen los **locales** (`location.address_label`) |
| 4 | Pais | ✅ `country_code`, en el allowlist desde la 0078 |
| 5 | Tipo de programa | ✅ pero emite el literal CRUDO `"stamps"`/`"points"`, **en ingles**, dentro del texto legal en castellano |
| 6 | Nombre de los puntos | ✅ el plural. **El singular NO se pasa** |
| 7 | Cada cuanto dinero se otorga un sello | ⚠️ ver abajo: **no es una variable opcional** |
| 8 | Cada cuanto dinero se entregan X puntos | ❌ esta en `accrual` (`grant`/`blockAmount`), **no se pasa** |

**EL HALLAZGO QUE DEFINE EL DISEÑO, medido y no supuesto:** `renderTermsText`
(`loyalty-program/validation.ts:259-270`) tira `422 La variable {{x}} no está permitida.` cuando
**`!allowedVariables.includes(key) || !variables[key]`** — o sea **tambien cuando el valor es
vacio**. Consecuencia: una plantilla con una variable que «a veces no aplica» **impide guardar el
programa**, no deja un hueco en el texto. Por eso el monto por unidad **no puede ser una variable
opcional de la plantilla de siempre**.

**LO QUE YA FUNCIONA Y NADIE TIENE QUE ESCRIBIR — medido con una sonda ejecutada el 2026-09-19,
que se borro:** el dominio **ya acepta «un sello cada $X»**. `validateAccrual` lo dice literal
(«Puntos only accepts `per_amount`; **Sellos accepts both modes**», `accrual.ts:11`), el CHECK
`loyalty_program_accrual_points_mode_check` solo restringe `points`, las columnas
`accrual_mode`/`accrual_block_amount` ya existen, y el compositor de la 0079 **no pisa un
`accrual` explicito** (`if (partial.accrual === undefined)`, `program-defaults.ts:149`). La sonda
confirmo las dos mitades: `composeProgramInput` conserva
`{mode:"per_amount", grant:1, blockAmount:"5.00"}` en Sellos, y `validateProgramInput` lo
**acepta**. **Conclusion: la decision del owner sobre la #7 no cuesta dominio ni migracion de
esquema. Cuesta documentacion y texto legal.**

**Y el hallazgo abierto de la 0078, que esta spec cierra:** hay TRES copias de cada clausula
(`global-draft` + `default` + `EC`), `renderedTerms` acepta **cualquier** `templateId`
`published` sin validar scope ni pertenencia (`terms.ts:20-31`), y
`GET /api/loyalty-terms/templates` las devuelve **sin `jurisdictionScope`**, con titulos
repetidos. Un panel construido sobre ese contrato puede escribirle a un comercio EC el texto
deprecado «Los sello se acumulan…».

## Alcance

**Entra:**

- Las **ocho** variables en el diccionario de `renderedTerms`, con su allowlist en las semillas.
- Una **segunda plantilla de `earning` para Sellos**, la del monto por compra, elegida por el
  `accrual.mode` del programa (§2).
- **Archivar** las 3 plantillas `global-draft` y sembrar la `transition` que hoy solo existe ahi.
- `GET /api/loyalty-terms/templates` **filtrado por el scope del negocio** y con
  `jurisdictionScope` en el DTO.
- **El contrato HTTP escrito** (`0081-contratos-de-api.md`): que puede mandar quien construya la
  pantalla 3 y como. **Es el entregable que pidio el owner** y es para consumo de quien haga la
  UI por fuera.

**No entra** (explicito):

- **NINGUNA pantalla, ni un `.tsx`.** El arco entrega API y endpoints; la UI la construye el
  owner por fuera (ADR 0070, y CLAUDE.md lo marca como spec mal alcanzada si aparece un archivo
  de pantalla). **Decision textual del owner (2026-09-19): «TU NO TOCAS UI, dejas documentada el
  api para que sepa ChatGPT que puede enviar y como enviarlo para que luego GPT decida si vamos
  a armar una pantalla o no».**
- **Cambiar el dominio del `accrual`.** Ya soporta lo que hace falta: medido arriba. Esta spec
  **no** toca `accrual.ts` ni `validation.ts` en su logica de mecanica.
- **Una columna de razon social** para la variable #1. Hoy `business_legal_name` lleva el nombre
  comercial. Se **declara** como limite del texto legal y **queda como hallazgo a decidir**: es
  una migracion y el owner no la pidio.
- **Validar en `renderedTerms` que el `templateId` pertenezca al scope del negocio** (el arreglo
  «b» que la 0078 subio al owner). **Archivar `global-draft` lo vuelve innecesario para el caso
  reportado** —al dejar de ser `published`, el filtro de `terms.ts:26-31` la excluye— y el owner
  eligio esa salida por ser mas barata. Queda declarado que un panel que mande el `templateId`
  de OTRO pais publicado sigue siendo aceptado.
- **Los `code` de `GET`/`DELETE`/`PATCH` de `/api/loyalty-program`.** Siguen como los declaro la 0079.

## Diseño

### Especificación técnica

#### 1. Las ocho variables

El diccionario de `renderedTerms` pasa de cinco a **once** entradas (las ocho del owner, mas las
dos que ya existian por compatibilidad y la moneda que el dinero necesita). **El regex de
`renderTermsText` es `/{{([a-z_]+)}}/g`**: todo nombre va en minusculas con `_`.

| Variable | Valor | Fuente medida |
|---|---|---|
| `business_legal_name` | `business.name` | **sin cambio**. Es el nombre COMERCIAL: ver «No entra» |
| `business_locations` | los `name` de los locales `active`, `", "` | `core.location`, `status='active'` |
| `business_address` | los `address_label` de los locales `active`, `", "` | `core.location.address_label` |
| `country_code` | `business.countryCode` | sin cambio |
| `currency_code` | `business.currencyCode` | `core.business.currency_code` (ISO 4217, `NOT NULL`) |
| `program_kind_label` | **`"Sellos"` / `"Puntos"`** en castellano | derivado de `input.kind` |
| `program_kind` | el literal `stamps`/`points` | **se CONSERVA**: lo usan las semillas de hoy |
| `program_name` | sin cambio | idem, compatibilidad |
| `program_unit_singular` | Sellos: `unitName`; Puntos: `unitSingular` | el singular que hoy falta |
| `program_unit_plural` | sin cambio | |
| `program_accrual_grant` | `accrual.grant` | cuantas unidades se otorgan |
| `program_accrual_block_amount` | `accrual.blockAmount` | el **monto de dinero**: las #7 y #8 |

**Las variables de dinero solo tienen valor cuando `accrual.mode === "per_amount"`** — en
`per_purchase` el `blockAmount` es `null` por CHECK de la base. Y por el hallazgo del 422 con
valor vacio, **eso obliga a que las plantillas que las usan sean plantillas aparte** (§2), no la
de siempre con un hueco.

**`business_locations` y `business_address` con CERO locales:** un negocio sin locales `active`
daria string vacio → `renderTermsText` tiraria **422 y no se podria guardar el programa**. Por
eso: **si no hay locales `active`, las dos variables NO se emiten** y las plantillas del wizard
**no las usan** (§2). Quedan disponibles para las plantillas personalizadas del panel, que es
donde el owner pidio texto libre. **Esto tiene test propio**: es la trampa mas probable de toda
la spec.

**UNA sola consulta nueva, y NO se toca el resolvedor del negocio — medido:** `ownerBusiness`
(`loyalty-program/owner.ts:16-38`) **ya selecciona `id`, `name`, `countryCode` y `currencyCode`**,
y `saveProgram` ya le pasa ese objeto entero a `renderedTerms` (`loyalty-program.ts:116`). Lo
unico que los esconde es el tipo local `OwnerBusiness` de `terms.ts:9-12`, que declara
`{name, countryCode}` y recorta el resto. **Entonces:**

- `currency_code` y el `business.id` **no cuestan una consulta**: alcanza con ampliar ese tipo.
  **`ownerBusiness` NO se toca** — es el resolvedor que la 0072 §D3 y la 0077 dejaron sensible.
- **Los locales SI son una consulta nueva** a `core.location` (`business_id` + `status='active'`),
  y es **una sola por escritura de programa**. Se declara como costo, en la linea del hallazgo de
  los round-trips que dejo abierto la 0079.

#### 2. La segunda plantilla de `earning`, elegida por el modo

`WIZARD_CLAUSE_KEYS` es hoy `["earning", "redemption"]`. La clave `earning` pasa a resolverse
segun el `accrual.mode` del programa que se esta guardando:

| `accrual.mode` | Clave de la clausula | Texto (Sellos, scope `default`) |
|---|---|---|
| `per_purchase` | `earning` | «Los {{program_unit_plural}} se acumulan … por compra …» (**el de hoy, sin tocar**) |
| `per_amount` | **`earning_per_amount`** | «Se otorgan {{program_accrual_grant}} {{program_unit_plural}} por cada {{program_accrual_block_amount}} {{currency_code}} de compra …» |

**Por que una clave nueva y no una variable opcional:** por el 422 con valor vacio. Un `earning`
unico que nombre `{{program_accrual_block_amount}}` **rompe todo programa `per_purchase`** — que
es el que crea el wizard hoy. Medido, no supuesto.

**La caida por scope COMPLETO de la 0078 se conserva** (`scopedTemplateIds`): si a `EC` le falta
`earning_per_amount`, el resultado son **todas** las de `default`, nunca una mezcla. Por eso
`earning_per_amount` se siembra en **los dos** scopes (`default` y `EC`), igual que las otras.

#### 3. Las semillas y el archivado (migracion `0039`)

**SOLO DATOS.** No toca tablas, tipos ni columnas: `terms_template` ya tiene todo (la 0078 lo
midio). La migracion:

1. **`INSERT`** de `earning_per_amount` en `default` y `EC`, y de **`transition`** en los dos
   scopes (hoy `transition` existe **solo** en `global-draft`, medido — y al archivarlo el
   proyecto se quedaria sin clausula de vigencia por pais).
2. **`UPDATE`** de las 3 filas `global-draft` a `status = 'archived'`.
3. **`UPDATE`** del `variables_allowlist` de las semillas `default`/`EC` con las variables nuevas
   que cada texto usa. **Sin esto no se puede ni guardar**: la 0078 midio que una variable fuera
   del allowlist es un 422.

**`ON CONFLICT (key, locale, jurisdiction_scope, version) DO NOTHING`** en los `INSERT`, que es
el unico indice unico de la tabla (medido en `schema/loyalty.ts:192-199`) — la migracion tiene
que ser idempotente porque las ramas de Neon de CI e integracion ya tienen filas.

**⚠️ EL RIESGO DEL ARCHIVADO, y como se acota:** `renderedTerms` filtra por
`status = 'published'`, asi que **un `PUT` sobre un programa viejo que referencie un
`templateId` de `global-draft` pasaria a dar 422**. El `terms_markdown` ya renderizado **no se
toca** (es una columna del programa, no un join), asi que **ningun TOS ya emitido cambia**. Antes
de aplicar a produccion: **contar los programas que referencian esas 3 plantillas**. Al
2026-09-18 prod tenia **0 negocios**, pero eso **se re-mide**, no se hereda.

#### 4. `GET /api/loyalty-terms/templates`

Pasa a devolver **solo** las plantillas de los scopes candidatos del negocio de la sesion
(`termsScopeCandidates(business.countryCode)`, spec 0078) y **con `jurisdictionScope` en el
DTO**. Con `global-draft` archivado y el filtro por scope, las seis filas con titulos repetidos
pasan a ser las del pais del negocio.

Su guard **no cambia**. Sus `code` **no cambian** (queda declarado afuera, igual que la 0079 hizo
con `GET`/`DELETE`/`PATCH`).

#### 5. El contrato para quien haga la pantalla 3

`docs/specs/0081-contratos-de-api.md`, con la forma de `0079-contratos-de-api.md`. **Es el
entregable que pidio el owner** y su publico es quien construya la UI por fuera. Tiene que decir,
sin que el lector abra una sola linea de codigo:

- Que **la ruta es la unica que ya existe**, `PUT /api/loyalty-program` (spec 0079): **el monto
  por sello NO estrena endpoint**.
- El cuerpo exacto de «un sello cada $X»:
  `{"kind":"stamps","configuration":{"target":10},"rewards":[{"type":"custom","label":"…"}],`
  `"accrual":{"mode":"per_amount","grant":1,"blockAmount":"5.00"}}`, y que **omitir `accrual`
  sigue dando «un sello por compra»** — o sea que la pantalla puede no preguntar nada y nada se
  rompe.
- Que `blockAmount` es **`numeric(12,2)`**: string o numero, `> 0`, maximo `9999999999.99`,
  normalizado a dos decimales (`accrual.ts`), y que **la moneda NO viaja en el cuerpo** — sale de
  `business.currency_code`.
- Que `grant` es **entero `> 0`**.
- Que el `code` de todo rechazo de mecanica es **`invalid_program`** (limite declarado por la
  0079), con los mensajes exactos de `validateAccrual`.
- **Que el valor se GUARDA** en `accrual_mode` / `accrual_grant` / `accrual_block_amount`, y que
  el TOS lo usa via `earning_per_amount`.
- El efecto en el TOS de **cada** modo, para que quien haga la pantalla sepa que el texto legal
  cambia con lo que elija el comerciante.

### Arquitectura de referencia

- **ADR 0070** — el arco entrega API, no interfaz. **ADR 0070 §17** — la UI vieja de lo que se
  refactoriza se borra (no aplica aca: no hay pantalla).
- **Spec 0078** — el scope por pais, `termsScopeCandidates` y la caida por scope completo.
- **Spec 0079** — la ruta unica, el compositor que no pisa lo explicito, y los `code`.
- **ADR 0076 §7** — el TOS por pais con personalizacion libre en el panel.

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/drizzle/0039_tos_variables_del_negocio.sql` | **crear** — semillas, allowlists y archivado |
| `apps/merchant/drizzle/meta/_journal.json` + `0039_snapshot.json` | **crear/editar** — como la 0038 |
| `apps/merchant/src/server/loyalty-program/terms.ts` | editar — las once variables |
| `apps/merchant/src/server/loyalty-program/terms-scope.ts` | editar — la clave de `earning` por modo |
| `apps/merchant/src/server/onboarding/program-defaults.ts` | editar — `WIZARD_CLAUSE_KEYS` por modo |
| `apps/merchant/src/server/loyalty-program.ts` | editar **solo si hace falta** — `business` ya viaja entero a `renderedTerms`; lo que se amplia es el tipo de `terms.ts` |
| `apps/merchant/src/app/api/loyalty-terms/templates/route.ts` | editar — filtro por scope + `jurisdictionScope` |
| `docs/specs/0081-contratos-de-api.md` | **crear** |
| tests | crear/editar los del plan de pruebas |

### Disjunta?

**No.**

| Con | Archivos en comun | Resolucion |
|---|---|---|
| **0080** | `onboarding/program-defaults.test.ts` | **serializar: la 0080 va PRIMERO** (es chica y deja el archivo estable) |

Con la 0079 no colisiona: esa ya esta `implementada` y commiteada (`07a06c0`).

### Archivos compartidos

`program-defaults.ts` y su test los toco la 0079 y los toca la 0080. **El implementador de esta
spec arranca con el arbol de la 0080 ya commiteado**, no en paralelo.

## Definition of Done

- [ ] **Las once variables se emiten**, cada una con su caso: un test que renderiza una plantilla
      que las nombra a todas y asevera el markdown resultante.
- [ ] **Un negocio SIN locales `active` puede guardar su programa** — las dos variables de local
      no se emiten y las plantillas del wizard no las usan. **Este es el caso trampa de la spec.**
- [ ] **Un negocio con 2+ locales `active` los lista a todos**, separados por `", "`, y **un
      local `archived` NO aparece**.
- [ ] **«Un sello cada $X» end-to-end contra Neon**: `PUT` con
      `accrual:{mode:"per_amount",grant:1,blockAmount:"5.00"}` → **201**, la fila queda con
      `accrual_mode='per_amount'` y `accrual_block_amount='5.00'` **leido por SQL**, y el
      `terms_markdown` guardado **contiene el monto y la moneda**.
- [ ] **Omitir `accrual` sigue dando «un sello por compra»** y su TOS es el texto de hoy, sin
      monto: es la compatibilidad hacia atras de la 0079, que no se rompe.
- [ ] **`global-draft` no se ofrece ni se puede usar**: las 3 filas quedan `archived` (leido por
      SQL), y `GET /api/loyalty-terms/templates` **no** las devuelve.
- [ ] **`GET /api/loyalty-terms/templates` devuelve `jurisdictionScope`** y solo los scopes
      candidatos del negocio de la sesion.
- [ ] **`transition` existe en `default` y en `EC`** (leido por SQL): archivar `global-draft` no
      deja al proyecto sin clausula de vigencia.
- [ ] **La migracion es idempotente**: aplicarla dos veces no duplica filas ni falla.
- [ ] **Se conto, contra la base de integracion, cuantos programas referencian las 3 plantillas
      `global-draft`**, y el numero esta en el handoff. Si es `> 0`, **es un bloqueo que se
      reporta al owner**, no algo que el implementador resuelve.
- [ ] El contrato `0081-contratos-de-api.md` existe y cubre los 7 puntos del §5.
- [ ] Gates de root con Node 24, una vez al final: `typecheck`, `lint`, `test`, `format:check`,
      `build`. **`test:e2e` NO hace falta: no se toca ni un `.tsx`** — y si el implementador cree
      que si, es un bloqueo, porque significaria que se metio en la UI.
- [ ] `rg -n MUTATION apps tools` → vacio.

## Plan de pruebas y verificación

### Presupuesto y condición de corte (ADR 0062)

**5 mutaciones.** Clase de error a cazar: **que el TOS quede mudo o mentiroso sin que nada se
ponga rojo** — una variable que no se emite, un local archivado que se cuela, un monto que no
llega al texto legal, o el 422 del valor vacio.

| # | Mutacion | Oraculo que DEBE ponerse ROJO |
|---|---|---|
| M1 | `terms.ts`: emitir las variables de local **siempre**, tambien con la lista vacia | el caso «un negocio SIN locales puede guardar» (tiene que dar el 422 de `renderTermsText`) |
| M2 | `terms.ts`: no filtrar por `status='active'` al listar locales | el caso «un local `archived` no aparece» |
| M3 | `terms-scope.ts`: elegir siempre `earning`, ignorando el `accrual.mode` | el caso del monto en el `terms_markdown` |
| M4 | `terms.ts`: `program_unit_plural` cae al singular | el «Los sello se acumulan…» que cazo la 0078 |
| M5 | la migracion: no actualizar el `variables_allowlist` | el 201 del monto (tiene que caer a 422) |

Protocolo por mutacion: `shasum` limpio ANTES, fila de bitacora antes de medir, etiqueta
`MUTATION`, revertir con `diff` contra la copia limpia. De a una, **leyendo la asercion del
rojo**: un rojo por el setup no prueba nada.

**Condicion de corte:** si dos vueltas terminan en «el fix abrio la siguiente», se corta y va al
owner.

### Pruebas

- [ ] **Unitaria** — el diccionario de variables: tabla de casos por modalidad y por modo de
      `accrual`, incluida la lista de locales vacia, con uno, con dos, y con uno `archived`.
- [ ] **Unitaria** — la eleccion de la clave de `earning` por `accrual.mode`.
- [ ] **Integracion Neon** — los cuatro casos de TOS del DoD (monto end-to-end, `per_purchase`
      sin monto, sin locales, con locales).
- [ ] **Integracion Neon** — `GET /api/loyalty-terms/templates`: trae `jurisdictionScope`, filtra
      por scope, y **no** trae `global-draft`.
- [ ] **SQL directo** — las 3 filas `global-draft` en `archived`; `transition` presente en
      `default` y `EC`; el conteo de programas que referencian `global-draft`.
- [ ] **Verificacion manual:** NO la hace el implementador. Es el QA del owner.

## Handoff requerido

Formato de `docs/AGENT-WORKFLOW.md`. UN implementador, UN revisor independiente con `PASS`.
**El orquestador NO despacha esta spec hasta que la 0080 este commiteada.**

## Abierto

Nada que bloquee. **Dos hallazgos a decidir por el owner, ninguno bloqueante:**

1. **`business_legal_name` lleva el nombre COMERCIAL, no la razon social.** Para un TOS eso puede
   no alcanzar. Agregar la columna es una migracion que el owner no pidio.
2. **Un panel puede seguir mandando el `templateId` de una plantilla publicada de OTRO pais.**
   Archivar `global-draft` cierra el caso reportado por la 0078, no la clase entera. El arreglo
   «b» (validar el scope en el writer) sigue disponible como spec chica.
