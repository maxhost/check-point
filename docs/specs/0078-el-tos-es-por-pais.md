---
spec: 0078
fecha: 2026-09-18
estado: cerrada
resumen: El TOS del programa pasa a ser POR PAIS —decision del owner, empezando por EC— seleccionado por `business.countryCode` con caida a un scope `default`, en vez del unico `global-draft` hardcodeado que usa el wizard hoy. Sin migracion de ESQUEMA: `core.terms_template` ya tiene `jurisdiction_scope` y `renderedTerms` ya interpola las variables; lo que falta son SEMILLAS y SELECCION. Entran ademas los dos defectos medidos del texto legal que ve el consumidor: el «Los sello se acumulan…» (el singular de `unitName` usado como `program_name`) y que `country_code` se pasa como variable pero no esta en ningun `variables_allowlist`, asi que hoy un TOS por pais no podria nombrar a su pais.
disjunta: no
archivos: apps/merchant/drizzle/<NNNN>_terms_por_pais.sql, apps/merchant/src/server/loyalty-program/terms.ts, apps/merchant/src/server/onboarding/program-defaults.ts, apps/merchant/src/server/loyalty-program/terms-scope.ts, apps/merchant/src/server/loyalty-program/terms-scope.test.ts, apps/merchant/src/server/onboarding-program.neon.integration.test.ts, docs/specs/0078-contratos-de-api.md
---

# 0078 — El TOS es por pais (spec A del ADR 0076)

> **Nada de codigo empieza sin esta spec en `cerrada`.**

## Problema

El owner decidio (ADR 0076 §7) que los terminos del programa sean **por pais**, porque «son
estandar y se repiten de comercio en comercio solo cambiando el nombre del comercio».

**Hoy no lo son.** Medido:

- Existe **un solo** `jurisdiction_scope`: `global-draft`, locale `es`, con **2** plantillas
  publicadas (`earning`, `redemption`; la tercera, `transition`, la archivo la migracion
  `0011`). Sembradas en `drizzle/0004_polite_turbo.sql:97-100`.
- El wizard las pide **hardcodeando ese scope**
  (`onboarding/program-defaults.ts:60-68`: `eq(termsTemplates.jurisdictionScope, "global-draft")`).
- `business.countryCode` **existe y esta poblado** (el wizard lo pide, ADR 0070 §6) pero
  **no participa** en la eleccion de los terminos.

**Y hay dos defectos en el texto legal que ve el consumidor**, los dos vistos al renderizar
contra Neon el 2026-09-18:

1. **«Los sello se acumulan únicamente conforme a…»** — `renderedTerms` llena
   `program_name` con `configuration.unitName`, que para Sellos es **singular**
   (`terms.ts:35-38`).
2. **`country_code` se pasa como variable pero NO esta en el `variables_allowlist`** de
   ninguna semilla (solo `business_legal_name` y `program_name`). Como `renderTermsText`
   tira **422** ante una variable fuera del allowlist (`validation.ts:246-248`), hoy un TOS
   por pais **no podria nombrar a su pais**.

## Alcance

**Entra:**

- Semillas de `core.terms_template` para **EC** y para un scope **`default`**.
- La seleccion del scope por `business.countryCode`, con caida a `default`.
- `country_code` en el `variables_allowlist` de las semillas nuevas.
- El arreglo del plural, via una variable nueva `program_unit_plural`.
- El **contrato escrito** (`0078-contratos-de-api.md`) de como se eligen y se personalizan
  los terminos, que es lo que consume quien hace la UI del panel (ADR 0070 §16).

**No entra** (explicito):

- **Ninguna pantalla.** Ni la del wizard ni la «avanzada» del panel. El owner construye la
  UI por fuera; esta spec entrega el comportamiento del servidor y su contrato.
- **Un editor de plantillas para el operador de la plataforma.** Las semillas se cargan por
  migracion. Un ABM de plantillas no lo pidio nadie.
- **Traducciones.** `locale` sigue siendo `es` en todas las semillas. La columna ya existe
  para el dia que haga falta; sembrar otro locale no es este trabajo.
- **Re-renderizar los terminos de programas ya creados.** Ver §5.
- **Permiso de alta, `kind`, unificar rutas.** Specs 0077 y C.

## Diseño

### Especificación técnica

#### 1. Que NO cambia: el esquema

**Cero cambios de esquema.** Medido: `core.terms_template` ya tiene `jurisdiction_scope`,
`locale`, `category`, `template_markdown`, `variables_allowlist`, `version`, `status`,
`published_at` (`server/schema/loyalty.ts:186-208`), con el unico
`(key, locale, jurisdiction_scope, version)`. La migracion de esta spec es **solo un
`INSERT ... ON CONFLICT DO NOTHING`** de semillas, con la misma forma que la `0004`.

**Y el texto libre por clausula ya se acepta**: cada clausula es `templateId` **o** `text`
(`loyalty-program/validation.ts:129-143`). El TOS personalizado del panel **no necesita
codigo nuevo de escritura** — necesita el contrato de §4.

#### 2. Las semillas

Dos scopes, tres claves cada uno no: **las mismas 2 claves que usa el wizard**
(`earning` y `redemption`; `transition` sigue archivada y fuera).

| `jurisdiction_scope` | `locale` | claves | `version` | `status` |
|---|---|---|---|---|
| `default` | `es` | `earning`, `redemption` | `1` | `published` |
| `EC` | `es` | `earning`, `redemption` | `1` | `published` |

`variables_allowlist` de las cuatro filas nuevas:
`["business_legal_name", "program_name", "program_unit_plural", "country_code"]`.

**Los ids van fijos y escritos en la migracion** (UUID literal, como la `0004`), no
generados: es lo que hace que el `ON CONFLICT DO NOTHING` sea idempotente y que un test
pueda aseverar contra un id conocido.

**El scope `global-draft` NO se borra ni se archiva.** Queda publicado y sin usar: borrarlo
rompería `renderedTerms` para cualquier programa que todavia lo referencie por `templateId`.

#### 3. La seleccion del scope

Modulo hoja nuevo, `loyalty-program/terms-scope.ts`:

```ts
/** El orden de preferencia de scopes para un pais. PURA. */
export function termsScopeCandidates(countryCode: string | null | undefined): string[];
```

Devuelve `[<ISO2 en mayusculas>, "default"]`, o `["default"]` si el pais es nulo, vacio o no
son exactamente dos letras.

`wizardClauseTemplateIds` (en `program-defaults.ts`) pasa a recibir el `countryCode` y a
resolver **por candidato, en orden**: consulta el primer scope; **si le faltan claves, cae
al siguiente**. La caida es **por scope completo, no por clave**: un TOS mezclado mitad EC
mitad `default` es un documento legal que nadie escribio.

Si **ningun** candidato tiene las dos claves publicadas, sigue valiendo el **503**
`"Las plantillas de términos no están disponibles."` que ya existe — nunca se escribe un
programa **sin** terminos.

#### 4. Las dos variables nuevas

En `renderedTerms` (`terms.ts:33-41`), el mapa de variables pasa a:

| Variable | Valor | Nota |
|---|---|---|
| `business_legal_name` | `business.name` | ya existe |
| `program_name` | igual que hoy | **se conserva** por compatibilidad con `global-draft` |
| `program_unit_plural` | `points` → `configuration.unitPlural`; `stamps` → `configuration.unitPlural ?? configuration.unitName` | **nueva** — es el arreglo del «Los sello» |
| `program_kind` | ya existe | |
| `country_code` | `business.countryCode` | ya se pasa; lo nuevo es que el **allowlist** lo permita |

**El plural de Sellos:** `configuration` es `jsonb`, asi que aceptar un `unitPlural`
opcional en Sellos **no es una migracion**. `composeWizardProgramInput` pasa a componer
`{ unitName: "sello", unitPlural: "sellos", target }`. `validateProgramInput` acepta
`unitPlural` opcional para `stamps` (string no vacio si viene) y **lo sigue exigiendo para
`points`**, como hoy. Las plantillas nuevas usan `{{program_unit_plural}}`; las de
`global-draft` siguen con `{{program_name}}` y siguen renderizando igual que hoy.

**Limite declarado:** el texto libre (`clause.text` sin `templateId`) se renderiza con
allowlist **vacia** (`terms.ts:58-62`), asi que **un TOS personalizado no puede contener
`{{variables}}`** — cualquiera tira 422. Es el comportamiento de hoy y esta spec **no lo
cambia**; se declara en el contrato porque quien haga la UI del panel tiene que saberlo.

#### 5. Programas ya creados

`loyalty_program.terms_markdown` guarda el texto **ya renderizado**, asi que los programas
existentes **no cambian** con esta spec. No se re-renderiza ninguno.

`docs/TASKS.md` registra que produccion tiene **0 negocios** (medido en la sesion anterior,
2026-09-18), con lo cual hoy el conjunto afectado esta vacio — **pero el diseño no depende
de eso**: la caida a `default` y la conservacion de `global-draft` hacen que un programa
viejo siga renderizando aunque ese dato cambie.

### Arquitectura de referencia

- **ADR 0076 §7** — la decision del owner: TOS por pais desde EC, personalizado libre en el
  panel, y los dos defectos entran con este trabajo.
- **ADR 0070 §6** — el pais es obligatorio y editable en el wizard; §16 — la UI va por fuera
  y el contrato escrito es el entregable.
- **Skill `gotchas-del-repo`** — `ON CONFLICT` contra un unico PARCIAL exige repetir el
  `WHERE`. **Aca el unico NO es parcial**, asi que el `ON CONFLICT (key, locale, jurisdiction_scope, version)` pelado es correcto; se nombra para que nadie lo "arregle".

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/drizzle/<NNNN>_terms_por_pais.sql` | crear — semillas `default` + `EC` |
| `apps/merchant/src/server/loyalty-program/terms-scope.ts` | **crear** — seleccion pura |
| `apps/merchant/src/server/loyalty-program/terms-scope.test.ts` | **crear** — tabla de casos |
| `apps/merchant/src/server/loyalty-program/terms.ts` | editar — las dos variables |
| `apps/merchant/src/server/loyalty-program/validation.ts` | editar — `unitPlural` opcional en Sellos |
| `apps/merchant/src/server/onboarding/program-defaults.ts` | editar — scope por pais + `unitPlural` |
| `apps/merchant/src/server/onboarding-program.neon.integration.test.ts` | editar — casos nuevos |
| `docs/specs/0078-contratos-de-api.md` | **crear** — el contrato de terminos |

### Disjunta?

**NO — y el motivo NO es el codigo fuente.** En fuente si es disjunta: la 0077 toca
`server/loyalty-program.ts`, `auth.ts`, `merchant-session.ts`, `schema/auth.ts` y rutas;
esta toca `loyalty-program/terms.ts`, `loyalty-program/validation.ts` y
`onboarding/program-defaults.ts`. **Cero archivos de codigo en comun.**

**Pero las dos llevan MIGRACION, y el directorio de migraciones es ESTADO COMPARTIDO:**
`drizzle-kit generate` numera secuencialmente y escribe
`apps/merchant/drizzle/meta/_journal.json` (hoy en `idx: 36`). Dos implementadores
generando a la vez producen **el mismo prefijo** y un journal corrupto. Y ademas las dos
corren `db:migrate` y la suite completa contra **la misma rama Neon de integracion**, que
ya arrastra un flake conocido de colision de seed.

**Resolucion: serializar.** Esta spec arranca **despues del PASS de la 0077**. Es decision
del orquestador, no del implementador. *(Este analisis se corrigio el 2026-09-18: la spec
nacio marcada `disjunta: si` mirando solo el codigo fuente.)*

**Tercer archivo compartido, menor:** `onboarding-program.neon.integration.test.ts`. Lo
resuelve el mismo serializado; si igual conviene, los casos de esta spec van a un archivo
hermano (`onboarding-program-terms.neon.integration.test.ts`).

**Contra la spec C** (una ruta + `kind`): C toca `program-defaults.ts` tambien →
**COLISIONA**. C va despues de esta.

### Archivos compartidos

| Que | Quien lo deja listo | Cuando |
|---|---|---|
| `drizzle/meta/_journal.json` y el numero de migracion | el **orquestador**, serializando: no despacha esta spec hasta el PASS de la 0077 | antes de despachar |

## Definition of Done

- [ ] `pnpm typecheck` · `lint` · `format:check` · `build` · `test` **con el env Neon
      cargado**, los cinco verdes, 0 failed y 0 skipped en los archivos Neon.
- [ ] `pnpm test:e2e` **NO aplica** (cero `.tsx`): se declara, no se corre.
- [ ] Migracion aplicada a integracion y **verificada por SQL**: 4 filas nuevas,
      `status='published'`, y el `variables_allowlist` de las cuatro contiene las 4 claves.
- [ ] La migracion es **idempotente**: correrla dos veces no duplica ni falla.
- [ ] Un negocio **EC** obtiene los templates de `EC`; un negocio de un pais **sin** semillas
      (p.ej. `MX`) obtiene los de `default`. Aseverado **por el `templateId` resuelto**, no
      por el texto.
- [ ] **El texto renderizado dice «Los sellos…», no «Los sello…»** — aseverado sobre
      `terms_markdown` en la base.
- [ ] Un template que usa `{{country_code}}` **renderiza** en vez de tirar 422.
- [ ] **Sin semillas para ningun candidato → 503**, y **ningun programa escrito sin
      terminos**.
- [ ] `global-draft` sigue `published` y un programa que lo referencia sigue renderizando.
- [ ] `docs/specs/0078-contratos-de-api.md` existe y declara: scopes y orden de caida, las 5
      variables con su allowlist, la forma de una clausula (`templateId` **o** `text`), y
      **el limite de que el texto libre no admite variables**.

## Plan de pruebas y verificación

### Presupuesto y condición de corte (ADR 0062)

**4 mutaciones.** La clase de error a cazar: **que el TOS salga de un scope que no
corresponde, o que salga incompleto/mezclado.** Si dos vueltas seguidas terminan en «el fix
abrio la siguiente», se corta y se reporta.

| # | Mutacion | Oraculo que DEBE ponerse rojo |
|---|---|---|
| M1 | `termsScopeCandidates` devuelve siempre `["default"]` | el caso del negocio EC (por `templateId`) |
| M2 | La caida es por CLAVE y no por scope (mezcla EC + default) | el test de no-mezcla |
| M3 | `program_unit_plural` cae a `unitName` tambien cuando hay `unitPlural` | el «Los sellos» |
| M4 | Sacar `country_code` del allowlist de las semillas | el test del 422 que ya no debe pasar |

Protocolo por mutacion: `shasum` limpio ANTES, etiqueta `MUTATION`, revertir con `diff`,
cero `MUTATION` en el arbol. Skill `protocolo-de-verificacion`.

### Pruebas

- [ ] **Unitaria pura** (`terms-scope.test.ts`): `"EC"` → `["EC","default"]`; `"ec"` →
      `["EC","default"]`; `null`/`""`/`"ECU"`/`"E"` → `["default"]`.
- [ ] **Integracion Neon — EC**: negocio `countryCode:"EC"` → el programa queda con los
      `templateId` de **EC**. Aseverar el id, no el texto.
- [ ] **Integracion Neon — caida**: negocio `countryCode:"MX"` (sin semillas) → los de
      `default`.
- [ ] **Integracion Neon — no se mezcla**: con un scope al que le falta **una** clave, el
      resultado son **las dos** del siguiente candidato, nunca una de cada uno.
- [ ] **Integracion Neon — el plural**: `terms_markdown` contiene `"Los sellos"` y **no**
      contiene `"Los sello "`.
- [ ] **Integracion Neon — `country_code`**: una plantilla con `{{country_code}}` renderiza
      `EC`. (Control negativo: con la variable fuera del allowlist, 422.)
- [ ] **Integracion Neon — 503 sin semillas**: ningun candidato publicado → 503 y **cero
      filas** nuevas en `core.loyalty_program`.
- [ ] **Regresion — texto libre**: una clausula con `text` y sin `templateId` se guarda tal
      cual; y una con `text` que contenga `{{x}}` sigue dando **422**.
- [ ] **Idempotencia de la migracion**: aplicarla dos veces deja 4 filas, no 8.
- [ ] Comandos exactos: los mismos de la 0077, mas
      `pnpm --filter @mi-pasaporte/merchant db:migrate`.
- [ ] **Verificacion manual**: NO la hace el implementador. Va al QA del owner junto con la
      0077 y la C.

## Handoff requerido

Formato de `docs/AGENT-WORKFLOW.md`. UN implementador, UN revisor independiente con `PASS`
antes de pasar a `implementada`.

## Abierto

Nada que bloquee.

**Consecuencia declarada por el ADR 0076 §7, repetida aca para que no se pierda:** en cuanto
un comercio guarda su TOS personalizado, ese programa **deja de heredar** las
actualizaciones futuras del TOS de su pais. Un cambio legal no alcanza a los que editaron.
Es lo que «personalizado» significa, pero es una consecuencia de negocio que el owner
acepto explicitamente.

**Segunda consecuencia, del mismo tipo:** el TOS personalizado se guarda **ya renderizado**,
asi que si el comercio se renombra, su TOS conserva el nombre viejo. Los que usan plantilla
se re-renderizan al guardar; los personalizados no.
