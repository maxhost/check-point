---
spec: 0162
fecha: 2026-10-05
estado: implementada
resumen: PARQUEADO #76. Los cinco campos del kit con `errorMessage` (`TextField`, `SelectField`, `NumberField`, `TextAreaField`, `ChoiceGroup`) dejan de pasar `isInvalid={false}` cuando no hay mensaje propio, para que los `validationErrors` del `Form` (errores del servidor por `name`) se marquen y se anuncien; oraculo nuevo en el harness del kit, un caso por campo, en Chromium y WebKit.
disjunta: si
archivos: apps/merchant/src/ui/text-field.tsx, apps/merchant/src/ui/select-field.tsx, apps/merchant/src/ui/number-field.tsx, apps/merchant/src/ui/text-area-field.tsx, apps/merchant/src/ui/choice-group.tsx, tests/e2e/support/ui-kit-entry.tsx, tests/e2e/support/ui-kit-checks.ts, docs/PARQUEADO.md
---

# 0162 — Errores del servidor en los campos del kit (#76)

> N1 (componentes de UI + e2e de soporte, sin datos ni auth). Zona Claude (`apps/merchant/src/ui/**`).
> Owner (2026-10-05, PARQUEADO #76): «añade la spec chica N1 antes de 160». Va antes de la 0160 para que
> la Fase 1 (GPT) arme formularios con `validationErrors` que funcionen.

## Problema

- Los cinco campos hacen `isInvalid={props.isInvalid ?? Boolean(errorMessage)}`
  (`text-field.tsx:36`, `select-field.tsx:50`, `number-field.tsx:44`, `text-area-field.tsx:33`,
  `choice-group.tsx:40`). Sin `errorMessage` le pasan `false` a React Aria, que lo toma como estado
  **controlado** y pisa los `validationErrors` del `Form` (`form.tsx:17` promete lo contrario).
- **Medido (2026-10-05, harness temporal, Chromium):** `Form` con `validationErrors` para los cinco
  `name`, sin `errorMessage` → ningun mensaje visible, ningun `[aria-invalid]`, ningun `[data-invalid]`,
  descripcion accesible vacia en los cinco. Con `isInvalid={props.isInvalid ?? (errorMessage ? true :
  undefined)}` → descripcion accesible = el mensaje del servidor en los cinco (`textbox` T, N, A;
  `button` del `Select`; `radiogroup`), `aria-invalid="true"` en `input` (T, N), `textarea`, el `group`
  del stepper y el `radiogroup`.

## Alcance

**Entra:** el cambio de esa expresion en los cinco campos; un caso nuevo del harness del kit
(`?case=server-errors`) y su test en `ui-kit-checks.ts` (corre en `ui-kit.spec.ts` Chromium y
`ui-kit.webkit.spec.ts`); un test que fija que `errorMessage` sigue marcando el campo; cerrar #76 en
`docs/PARQUEADO.md`.

**No entra:** usar `validationErrors` en pantallas (hoy ninguna lo usa: `rg -n validationErrors
apps/merchant/src` → solo el docblock de `form.tsx`); `CheckboxField` (no tiene `errorMessage` ni
`FieldError`); cambiar el `validationBehavior="aria"`; los `isInvalid={...}` explicitos de
`onboarding-wizard.tsx:201` y `business-step.tsx:115,131` (el que llama decide); #77.

## Diseño

- En los cinco campos, exactamente: `isInvalid={props.isInvalid ?? (errorMessage ? true : undefined)}`.
  Precedencia resultante: `isInvalid` del que llama > `errorMessage` > errores del `Form`/`validate`.
  El `FieldError` sin hijos muestra los `validationErrors` (comportamiento de React Aria, medido arriba).
- **Cambio visible en pantallas en uso: ninguno esperado.** Lo unico que `false`→`undefined` destapa
  es `validationErrors` y `validate`, y hoy no se usan en `apps/merchant/src` (`rg -n "validate=|validationErrors"`).
  **Medido** con el fix aplicado: `isRequired` vacio (los cinco) y `type="email"` invalido con
  `validationBehavior="aria"` siguen sin `aria-invalid` ni `data-invalid` y el envio llega a `onSubmit`
  (igual que sin el fix). O sea que la conclusion de la 0159 sobre `aria` se mantiene.
- **Harness:** `ui-kit-entry.tsx` lee `case` del query string. Con `case=server-errors` renderiza, en
  vez de la pagina del kit, un `Form` con `validationErrors={{ name: "Nombre tomado", category:
  "Rubro invalido", stamps: "Minimo 2 sellos", notes: "Notas muy largas", plan: "Plan no disponible" }}`
  y los cinco campos con esos `name` y labels `Nombre`, `Rubro`, `Sellos`, `Notas`, `Plan`, **sin**
  `errorMessage`. Sin `case` la pagina queda identica: las capturas de la 0159 no cambian (no se
  regeneran).
- **Test nuevo** en `registerKitTests` (a 390, claro): para cada campo, el elemento con rol
  (`textbox` Nombre/Sellos/Notas, `button` Rubro, `radiogroup` Plan) tiene
  `toHaveAccessibleDescription(<mensaje>)` y el mensaje es visible; y `aria-invalid="true"` en
  Nombre, Sellos, Notas y Plan (el boton del `Select` no lo lleva; medido).
- **Test que fija la precedencia de `errorMessage`** en la pagina por defecto: el `textbox` «Email»
  tiene `toHaveAccessibleDescription("Ingresa un email valido")` y `aria-invalid="true"`.

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/ui/{text-field,select-field,number-field,text-area-field,choice-group}.tsx` | editar (una linea cada uno) |
| `tests/e2e/support/ui-kit-entry.tsx` | editar (`case=server-errors`) |
| `tests/e2e/support/ui-kit-checks.ts` | editar (dos tests) |
| `docs/PARQUEADO.md` | editar (#76 → resuelto por 0162) |

**Disjunta?** Si. La 0160 todavia no esta escrita; cuando lo este agrega piezas al final de
`ui-kit-entry.tsx` (pagina por defecto), no al caso `server-errors`.

## Definition of Done

- [ ] Rojo primero: los dos tests nuevos escritos ANTES del fix; el de `server-errors` rojo en los
      cinco campos en Chromium (salida transcripta, asercion de descripcion accesible, no de setup);
      el de «Email» verde ya sin fix (fija lo que existe).
- [ ] Con el fix: `npx playwright test tests/e2e/ui-kit.spec.ts tests/e2e/ui-kit.webkit.spec.ts` verde,
      capturas sin regenerar (`git diff --stat -- tests/e2e/*-snapshots` vacio).
- [ ] `rg -n "Boolean\(errorMessage\)" apps/merchant/src/ui` → vacio.
- [ ] e2e de pantallas que usan estos campos verdes: `onboarding-google-places.spec.ts` (wizard) y
      `loyalty-*.spec.ts` (programa), dentro de `pnpm verify`. Staff no tiene e2e (declarado abajo).
- [ ] `pnpm verify` en verde con Node 24, **una sola vez al final** (ADR 0113), con su tabla final
      transcripta en la seccion «Implementacion».
- [ ] `rg -nw MUTATION apps tools tests` → vacio (`-w`: `E2E_LOYALTY_MUTATION_TEST` no cuenta; medido vacio al cerrar).

## Mutaciones — presupuesto: 2. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| 1 | `choice-group.tsx`: volver a `Boolean(errorMessage)` (fix olvidado en un campo) | test `server-errors`: `radiogroup` «Plan» sin descripcion accesible |
| 2 | `text-field.tsx`: `isInvalid={props.isInvalid}` (se pierde `errorMessage` al «simplificar») | test «Email»: sin `aria-invalid` ni descripcion |

**Protocolo:** `shasum` limpio antes de mutar → fila de bitacora **antes** de medir → etiqueta
`MUTATION` → medir y **transcribir la salida ejecutada** → revertir con `diff` contra copia
limpia. De a una. **Leer la asercion del rojo**: un rojo por el setup no prueba nada.

**Condicion de corte:** si dos vueltas seguidas terminan en «el fix abrio la siguiente», se corta
y va al owner. Lo que queda afuera se **declara**.

## Declarado AFUERA (sin oraculo, a proposito)

- Staff (`staff-views.tsx`) no tiene e2e; el cambio no le cambia nada medible (no usa
  `validationErrors` ni `validate`).
- Que un `isInvalid={false}` explicito del que llama siga pisando los errores del servidor: es la
  precedencia elegida, sin test.
- Capturas del caso `server-errors`: el oraculo es de accesibilidad; el aspecto del mensaje ya lo
  cubren las capturas del «Email» de la 0159.

## Handoff

N1: sin subagentes (CLAUDE.md §Niveles). Implementa la sesion principal; push en el dia.

## Abierto

Nada.

## Implementacion

**Rojo primero (Chromium, antes del fix):** «errorMessage marca el campo» verde (fija lo existente);
«validationErrors del servidor llegan a los campos» rojo con `expect.soft` en los cinco: `Received: ""` en
`toHaveAccessibleDescription` de Nombre/Rubro/Sellos/Notas/Plan, mensajes `element(s) not found`,
`aria-invalid` vacio. Con el fix: `ui-kit.spec.ts` + `ui-kit.webkit.spec.ts` → `20 passed`; capturas sin diff.

**Bitacora de mutaciones** (shasum limpio: ver filas; revert con `diff` contra copia limpia en el scratchpad):

| # | Archivo / shasum limpio | Resultado |
|---|---|---|
| 1 | `choice-group.tsx` `b50f2bd6…` → `Boolean(errorMessage)` | **ROJA** solo «Plan»: `toHaveAccessibleDescription` `Expected: "Plan no disponible"` `Received: ""`, mensaje `element(s) not found`, `aria-invalid` `Received: ""`; `1 failed`. Revertida: `diff` vacio, shasum `b50f2bd6…` |
| 2 | `text-field.tsx` `019cbf5e…` → `isInvalid={props.isInvalid}` | **ROJA** «errorMessage marca el campo»: `toHaveAttribute` `Expected: "true"` `Received: ""` en `textbox` Email; `1 failed`. Revertida: `diff` vacio, shasum `019cbf5e…` |

**`pnpm verify` (Node 24.20.0), una vez:**

| gate | corrio/salteado (motivo) | ok/ROJO | segundos |
|---|---|---|---|
| typecheck | corrio | ok | 10.9 |
| lint | corrio | ok | 6.6 |
| format:check | corrio | ok | 26.6 |
| test | corrio | ok | 72.3 |
| build | corrio | ok | 12.0 |
| test:e2e | corrio | **ROJO** | 3.9 |
| neon related merchant | corrio | ok | 25.6 |
| neon related consumer | salteado (nada de consumer) | - | - |

El rojo de `test:e2e` fue de arranque, no de tests: `listen EADDRINUSE :::3002`, ocupado por el `next dev` de
otro proyecto (`sintetica/apps/panel`), que otra sesion relanzaba. Con OK del owner se mato y se corrio
`pnpm run test:e2e` sola: **`139 passed`, `21 skipped`, exit 0** (wizard `onboarding-google-places` 2/2,
`loyalty-*` 58, `ui-kit*` 20; los salteados son las capturas y los «pagina real» opt-in de siempre).
`rg -nw MUTATION apps tools tests` → vacio. `rg -n "Boolean\(errorMessage\)" apps/merchant/src/ui` → vacio.

