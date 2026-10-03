---
spec: 0141
fecha: 2026-10-02
estado: implementada
resumen: Spec 3 del ADR 0115 §5. Los limites de notificaciones de hoy (presupuesto de 24 h, separacion de 3 min, horario y espaciado del recordatorio, topes mensuales de Bienvenida y Venta cruzada, topes de la proximidad) pasan a UN modulo, `packages/domain/src/server/notifications/limits.ts`, sin cambiar un solo valor; los modulos de hoy los re-exportan. Mas `docs/notificaciones/README.md`, el mapa para encontrarlos.
disjunta: si
archivos: packages/domain/src/server/notifications/limits.ts (crear) + su test, apps/merchant/src/server/wallet/{push-budget,push}.ts, packages/domain/src/server/wallet/reminder.ts, packages/domain/src/server/marketing/{templates,cross-rules,valley-rules,placement-plan}.ts, docs/notificaciones/README.md (crear)
---

# 0141 — Los limites de notificaciones en un solo lugar

> Plantilla CHICA (ADR 0071): un dominio (notificaciones), sin migraciones, sin decision abierta. Decision del owner
> en el ADR 0115 §5 («dejemos los de hoy, pero […] lo centralizamos en un archivo o funcion que podamos editar
> simplemente luego») y, al arrancarla (2026-10-02): «deja documentado como funciona ese archivo, cual es, etc. para
> saber en el futuro donde buscar el tema de limites de notificaciones en docs/notificaciones/».

## Problema

Medido el 2026-10-02: los limites estan definidos en seis archivos distintos.

- Presupuesto de 24 h: `apps/merchant/src/server/wallet/push-budget.ts:17-19` (`COUNTER_NOTICES_PER_24H = 2`,
  `NOTIFYING_PER_24H = 3`, `BUDGET_WINDOW_MS`).
- Separacion entre avisos: `apps/merchant/src/server/wallet/push.ts:27-30` (`COOLDOWN_MINUTES`, env
  `WALLET_PUSH_COOLDOWN_MINUTES` o 3; `COOLDOWN_MS`).
- Recordatorio: `packages/domain/src/server/wallet/reminder.ts:21-27` (corte 21:00, rango 9:00–20:30, uno cada 20 h).
- Topes mensuales: `packages/domain/src/server/marketing/templates.ts:139` (Bienvenida), `cross-rules.ts:63` (Venta
  cruzada) y `valley-rules.ts:46` (Horas valle, apagada por la 0138), los tres `{ min: 1, max: 10000, default: 50 }`.
- Proximidad: `packages/domain/src/server/marketing/placement-plan.ts:102-112` (`DEFAULT_PLACEMENT_LIMITS`).

## Alcance

**Entra:** el modulo con todos esos valores; que cada archivo de arriba los **importe** en vez de definirlos (y los
re-exporte con el mismo nombre, para no tocar a sus consumidores ni a sus tests); los tests de §Diseño; el doc
`docs/notificaciones/README.md`.

**No entra:**
- **Cambiar un valor.** Ninguno.
- **Limites por comercio** (ADR 0115 §5: «Los valores por comercio NO estan decididos»). Nada de funciones
  `limitsFor(businessId)` ni columnas: seria andamiaje sin tarea. El modulo es la puerta, nada mas.
- **El horario de campañas por comercio** (`core.business.push_window_start_hour`/`_end_hour`, default 9/21 en
  `packages/db/src/schema/business.ts:87-88`, editable por el merchant en `/api/marketing/settings`): ya es por
  comercio y su default vive en la base; moverlo exigiria una migracion. Se **documenta** en el README.
- Lo operativo de la cola (`MAX_PUSH_ATTEMPTS`, `STALE_CLAIM_*`, `push.ts:32-49`), las reglas que DISPARAN el
  recordatorio (`DEFAULT_REMINDER_MINUTE`, `MIN_SCANS_FOR_HABIT`, `REMINDER_LEAD_MINUTES`, `SCAN_QUIET_MS`,
  `COUPON_EXPIRING_MS`, `INACTIVE_MS`), largos de texto y topes del pase (`MAX_NOTICE_BODY`, `MAX_PASS_LOCATIONS`) y el
  rate limit HTTP del pase: no son limites de notificaciones. El README los nombra como «no estan aca».

## Diseño

### 1. El modulo: `packages/domain/src/server/notifications/limits.ts`

Un archivo **sin logica**, solo constantes con un docblock cada una: que limita, a quien, y que archivo lo lee. El
docblock de cabecera dice: es el UNICO lugar donde se cambia un limite de notificaciones; ADR 0115 §5; es la puerta
de los limites por comercio, que no estan decididos; ver `docs/notificaciones/README.md`.

| Constante | Valor (= hoy) | Lo lee |
|---|---|---|
| `COUNTER_NOTICES_PER_24H` | `2` | `decideBudget` |
| `NOTIFYING_PER_24H` | `3` | `decideBudget` |
| `BUDGET_WINDOW_MS` | `24 h` | `decideBudget`, `loadBudget` |
| `COOLDOWN_MINUTES` | `Number(process.env.WALLET_PUSH_COOLDOWN_MINUTES ?? 3)` | `push.ts` |
| `COOLDOWN_MS` | `COOLDOWN_MINUTES * 60 000` | `push.ts`, `push-worker.ts` |
| `REMINDER_CUTOFF_MINUTE` | `21 * 60` | `decideReminder` |
| `REMINDER_EARLIEST_MINUTE` | `9 * 60` | `reminderTargetMinute` |
| `REMINDER_LATEST_MINUTE` | `REMINDER_CUTOFF_MINUTE - 30` | `reminderTargetMinute` |
| `REMINDER_SPACING_MS` | `20 h` | `decideReminder`, `reminder-store.ts` |
| `WELCOME_MONTHLY_CAP` | `{ min: 1, max: 10000, default: 50 }` | `TEMPLATES` (Bienvenida) |
| `CROSS_MONTHLY_CAP` | `{ min: 1, max: 10000, default: 50 }` | definicion de la cruzada (`cross-rules.ts`) |
| `VALLEY_MONTHLY_CAP` | `{ min: 1, max: 10000, default: 50 }` | definicion de valle (`valley-rules.ts`; apagada) |
| `DEFAULT_PLACEMENT_LIMITS` | el objeto de hoy, campo por campo | `placement-plan.ts`, `tick.ts`, `audience-preview.ts`, `composer-summary.ts` |

`DEFAULT_PLACEMENT_LIMITS` se mueve con su tipo `PlacementLimits`; `textCap` sigue siendo `RELEVANT_TEXT_CAP`
(importado de `relevant-text.ts`, que no importa nada de vuelta). El modulo **no importa** ninguno de los archivos que
lo leen (sin ciclos).

### 2. Los archivos de hoy

Cada uno borra su definicion, importa de `limits.ts` y **re-exporta con el mismo nombre** lo que hoy exporta
(`export { NOTIFYING_PER_24H, … } from "…/notifications/limits"`). Asi ningun import de afuera cambia. **Ninguno
conserva un literal numerico de esos limites.** Los docblocks que explican el «por que» de un valor (p. ej. el de
`push-budget.ts:4-15`, que ademas debe decir que el 3 se conserva por decision del owner, ADR 0115 §5, y ya no se
deriva del tope de Google) se mudan al modulo.

### 3. Los tests: `apps/merchant/src/server/notifications/limits.test.ts` + `limits-wiring.test.ts` (corregido: ningun proyecto de vitest corre tests bajo `packages/`, `vitest.config.ts:5-11`)

- **Valores (oraculo de «los de hoy»):** cada constante contra su **literal** (`toBe(2)`, `toBe(24 * 60 * 60 * 1000)`,
  `toEqual({ min: 1, max: 10000, default: 50 })`, el objeto de proximidad campo por campo). Nunca contra otra
  constante: un test que importa la constante que verifica no ve un cambio de valor.
- **Cableado (oraculo de «el consumidor lee el modulo»):** con `vi.mock` del modulo devolviendo valores CENTINELA
  distintos de los de hoy, cada lector tiene que reflejarlos:
  - `decideBudget` con `COUNTER_NOTICES_PER_24H = 1` y `NOTIFYING_PER_24H = 2` (corregido: con 1/1 los dos topes no se distinguen) suprime el 2.º mostrador y el 3.º aviso con sonido, un caso por tope;
  - `COOLDOWN_MS` exportado por `push.ts` es el centinela;
  - `decideReminder` con un `REMINDER_CUTOFF_MINUTE` centinela corta en esa hora;
  - `TEMPLATES` (Bienvenida) y la definicion de la cruzada exponen el `monthlyCap` centinela;
  - `DEFAULT_PLACEMENT_LIMITS` re-exportado por `placement-plan.ts` es el centinela.
  El test de cableado vive al lado de cada lector o en uno solo, a criterio del implementador, con un caso por lector.

### 4. El doc: `docs/notificaciones/README.md`

Para alguien que vuelve en seis meses y no sabe donde mirar. Secciones:
1. **Que avisos hay**: `transactional`, `campaign`, `reminder`, `pass_refresh`, en una linea cada uno, y **por donde
   salen** (la tabla de la spec 0139 / ADR 0115 §2 y ADR 0116).
2. **Donde estan los limites**: la ruta del modulo, la tabla de §1 con valor, que limita y quien lo lee.
3. **Como cambiar uno**: editar el modulo; actualizar el literal en `limits.test.ts` (si no se actualiza, el test se
   pone rojo: es a proposito); que gates correr.
4. **Lo que no esta en el modulo y donde esta**: el horario de campañas por comercio (columna de `core.business`,
   ruta `/api/marketing/settings`) y la lista de «no entra» de esta spec.
5. **Limites por comercio**: no estan decididos (ADR 0115 §5); el modulo es la puerta.
6. Enlaces: ADR 0115, 0116, specs 0111, 0139, 0140 (Actividad), 0141.

Cada ruta y cada `archivo:linea` del README se **verifica contra el arbol** al escribirlo.

## Archivos

| Archivo | Accion |
|---|---|
| `packages/domain/src/server/notifications/limits.ts` | crear |
| `apps/merchant/src/server/notifications/limits.test.ts` y `limits-wiring.test.ts` | crear |
| test(s) de cableado (§3) | crear |
| `apps/merchant/src/server/wallet/push-budget.ts`, `push.ts` | editar (importa y re-exporta) |
| `packages/domain/src/server/wallet/reminder.ts` | editar (idem) |
| `packages/domain/src/server/marketing/templates.ts`, `cross-rules.ts`, `valley-rules.ts`, `placement-plan.ts` | editar (idem) |
| `docs/notificaciones/README.md` | crear |

**Disjunta?** Si. Nada abierto en el INDEX toca estos archivos; GPT no toca servidor ni paquetes (ADR 0114).

## Definition of Done

- [ ] `limits.test.ts` verde y pinnea cada valor contra su literal.
- [ ] Los tests de cableado verdes, uno por lector de §3.
- [ ] Barrido: los literales se fueron de los lectores —
      `rg -n 'COUNTER_NOTICES_PER_24H = |NOTIFYING_PER_24H = |BUDGET_WINDOW_MS = |COOLDOWN_MINUTES = |REMINDER_CUTOFF_MINUTE = |REMINDER_SPACING_MS = |DEFAULT_PLACEMENT_LIMITS: ' apps packages`
      → solo `packages/domain/src/server/notifications/limits.ts`; y
      `rg -n 'monthlyCap: \{ min: 1' packages/domain/src/server` → solo `limits.ts` (medido hoy: `templates.ts:139`,
      `cross-rules.ts:63`, `valley-rules.ts:46`; los tests y los tipos de `apps/` que repiten el objeto NO se tocan).
- [ ] Los tests existentes que leen estos limites (`wallet-push-budget.test.ts`, los de `reminder`, `templates`,
      `cross-rules`, `placement-plan`) pasan **sin editarlos**.
- [ ] `docs/notificaciones/README.md` existe, con las 6 secciones de §4 y rutas verificadas.
- [ ] `pnpm verify` en verde con Node 24, una sola vez al final (ADR 0113), con su tabla final transcripta.
- [ ] `rg -n MUTATION apps packages tools` → vacio.

## Mutaciones — presupuesto: 6. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| 1 | `limits.ts`: `REMINDER_SPACING_MS = 21 h` | `limits.test.ts` (valor). Elegida porque ningun test unitario de hoy fija ese literal (los de presupuesto SI: `wallet-push-budget.test.ts:35-37` pinnea 2/3/24 h, y sigue pasando sin editarse). |
| 2 | `push-budget.ts`: `decideBudget` compara contra un `3` local en vez del importado (`:45`) | cableado de `decideBudget` (centinela 1) |
| 3 | `push.ts`: `COOLDOWN_MINUTES` vuelve a definirse local (`:27-30`) | cableado de `COOLDOWN_MS` |
| 4 | `reminder.ts`: `decideReminder` usa `21 * 60` local (`:120`) | cableado de `decideReminder` |
| 5 | `templates.ts`: el `monthlyCap` de Bienvenida vuelve a ser el objeto literal (`:139`) | cableado de `TEMPLATES` |
| 6 | `placement-plan.ts`: vuelve a definir `DEFAULT_PLACEMENT_LIMITS` local (`:102`) | cableado de proximidad |

Guard hermano a puentear: en 2–6 el valor local es IGUAL al de hoy, asi que **solo** el centinela del `vi.mock` lo
distingue; un test de cableado que use los valores de hoy da verde con la mutacion puesta (eso es lo que la fila
mide). En 1, el revisor confirma con `rg` que ningun otro test unitario fija el espaciado de 20 h.

**Protocolo:** `shasum` limpio antes de mutar → fila de bitacora **antes** de medir → etiqueta `MUTATION` → medir y
**transcribir la salida ejecutada** → revertir con `diff` contra copia limpia. De a una. **Leer la asercion del
rojo.** **Condicion de corte:** dos vueltas seguidas de «el fix abrio la siguiente» → se corta y va al owner.

## Declarado AFUERA (sin oraculo, a proposito)

- El cableado de `BUDGET_WINDOW_MS` en `loadBudget` (SQL; lo cubre `wallet-push-budget.neon` «the window is `sent_at >
  now − 24 h`», con el valor de hoy) y de `REMINDER_SPACING_MS` en `reminder-store.ts` (SQL).
- Los lectores de `DEFAULT_PLACEMENT_LIMITS` en `tick.ts`/`audience-preview.ts`/`composer-summary.ts` mas alla de la
  re-exportacion: la proximidad esta apagada (spec 0138) y lo apagado no se prueba (owner).
- El cableado de `VALLEY_MONTHLY_CAP` en `valley-rules.ts`: valle esta apagada (spec 0138). Su valor si lo fija
  `limits.test.ts`.
- El env `WALLET_PUSH_COOLDOWN_MINUTES` se conserva igual que hoy (ningun archivo del repo lo setea, medido).

## Handoff

**UN implementador para toda la spec, UN revisor independiente al final** (ADR 0071). PASS con evidencia ejecutada
antes de marcar `implementada`.

## Abierto

Nada.

## Cierre (2026-10-02)

Codigo `0e9baad`. **PASS del revisor independiente**: valores comparados campo por campo contra `60acf14`, sin
diferencias; R-M1, R-M2, R-M4, R-M6 y una propia (R-M7, el tope de mostrador contra un `2` local) ROJAS, cada una solo en
su caso; M3 y M5 del implementador confiadas (mismas aserciones y shasums). Tests existentes sin editar.

**Declarado despues del revisor:** sin test de cableado (un literal local con el valor de hoy quedaria verde):
`BUDGET_WINDOW_MS` en `decideBudget` (el `defer` de campaña), `REMINDER_SPACING_MS` en `decideReminder` y
`REMINDER_EARLIEST/LATEST_MINUTE` en `reminderTargetMinute`. Y la pantalla de proximidad repite a mano la cuota y el
holdout (`custom-fields.tsx:188-189`): anotado en el README §3. Las lineas de la tabla de mutaciones eran
`push-budget.ts:41/43` y `reminder.ts:126` (la spec decia 45 y 120).

## Correcciones de la implementacion (2026-10-02, aceptadas por el orquestador)

- **Ruta de los tests:** `apps/merchant/src/server/notifications/`. La de §3 original (`packages/…`) no la corre ningun
  proyecto de vitest (`vitest.config.ts:5-11` lista `apps/*` y `tools`; 0 tests bajo `packages/`). Error de la spec.
- **Centinelas del presupuesto:** contador 1, total 2. Con 1/1 el cableado de `COUNTER_NOTICES_PER_24H` no tenia
  oraculo. Error de la spec.
- **Barridos:** el primero tambien lista la clave del mock en `limits-wiring.test.ts:46` (no es una definicion); el de
  `monthlyCap: { min: 1` da vacio porque `limits.ts` usa `WELCOME_MONTHLY_CAP = {…}`. En los dos la propiedad (los
  literales se fueron de los lectores) se cumple.
