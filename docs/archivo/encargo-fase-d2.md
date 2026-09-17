# Encargo — spec 0063, FASE D2 (UI + D8 + salida de D10 + render del HTML)

**Rol: IMPLEMENTADOR.** No marcás la spec como implementada; entrega con handoff y va a un
revisor independiente (`docs/AGENT-WORKFLOW.md`).

Este archivo lo escribió el ORQUESTADOR antes de despachar. Todo número de acá está MEDIDO con el
comando que se indica, no recordado. Si algo no reproduce, **eso es un hallazgo y va al handoff.**

## Estado del árbol al despachar (medido, 2026-09-12)

- `git status --short` → **vacío**. `grep -rn MUTATION apps/merchant/src` → **vacío**.
- Baseline de los archivos que esta fase EDITA (tracked y commiteados, así que `git checkout` sí
  sirve sobre ellos):

  ```
  e7630cc82b51e1b19f1aa29697317101c36f78de  apps/merchant/src/app/backoffice/page.tsx
  8119361ec9d90584d22aae582a70556c8cf7e50c  apps/merchant/src/app/onboarding/page.tsx
  971711dc4983a0f7576c98ec0d74f52121a58ae4  apps/merchant/src/server/billing/view.ts
  b03c8335e2b7dc3c93886b7bd3483ac374a2da97  apps/merchant/src/server/billing/index.ts
  ec73641c4ff8629ecbd4c9fc0e0c297e47f438ed  apps/merchant/src/server/billing-view.test.ts
  4d3afe95d6803ed9782b1ec821de6456e3433ccb  apps/merchant/src/app/backoffice/locations/page.tsx
  ```

- **Baseline de la suite: 121 archivos / 872 tests / 0 failed / 0 skipped** (con
  `.env.integration.local`). No se pierde ningún test preexistente.

## Lo que YA ESTÁ y no se toca (verificalo con `grep`, no me creas)

La lista «LO QUE FALTA DE LA D2» de `docs/TASKS.md` tenía **un ítem ya saldado** y lo corregí al
despachar — es la regla de `CLAUDE.md` sobre residuales heredados, y **por eso sus hermanos también
son sospechosos: chequeá los cinco antes de escribir una línea.**

- **`app/backoffice/locations/page.tsx` YA usa `effectiveLocationLimit(row?.plan, row?.pendingPlan)`**
  — entró en la fase A (`git log -1 -- app/backoffice/locations/page.tsx` → `6921c94`). **NO lo
  toques.** `docs/TASKS.md` lo listaba como pendiente y era falso.
- `server/billing/view.ts` ya tiene `toSubscriptionView`, `planLabel` y `statusLabel`, y el barrel
  los exporta. `server/billing-view.test.ts` (235 líneas) ya pinnea el conjunto exacto de claves,
  el string ISO y las dos allow-lists. **Lo que NO existe es el render del HTML.**
- `reconcileFromStripe` ya existe en `server/billing/store.ts` con `ReconcileOutcome` de 4 motivos,
  y tiene oráculo de unidad/integración a nivel store (M16). **Lo que falta de D8 es el CABLEADO:
  que la página lo llame y que el owner vea el aviso cuando Stripe no contesta.**
- Las 5 rutas de `app/api/billing/**` están cerradas con PASS (fase D1). El `checkout` ya acepta
  `from: "subscription"` y ya ignora el `businessId` del body.

## Alcance — archivos permitidos (whitelist; nada fuera de acá)

| Archivo | Acción |
|---|---|
| `app/backoffice/subscription/page.tsx` | crear — server, `requireOwner()`, D7 + D8 |
| `app/backoffice/subscription/subscription-console.tsx` | crear — cliente |
| `app/backoffice/subscription/cancel-dialog.tsx` | crear — el modal de condiciones (ver §Modal) |
| `app/backoffice/page.tsx` | editar — tarjeta «Suscripción» + `"subscription"` en `realModules` + la presentación con `planLabel`/`statusLabel` |
| `app/onboarding/page.tsx` | editar — **[R2-I8]** saca `businessId` del body, manda `from: "onboarding"` (ver §onboarding) |
| `server/billing-pages.neon.integration.test.ts` | crear — render del HTML + fuga + D8 (ver §Corte) |
| `server/billing-reconcile-page.neon.integration.test.ts` | crear **sólo si dispara el corte** (ver §Corte) |
| `server/billing-pages-support.ts` | crear **sólo si dispara el corte** |
| `server/billing/view.ts`, `server/billing/index.ts` | editar **sólo si la UI necesita un helper nuevo de presentación**; si lo agregás, va con su oráculo en `billing-view.test.ts` |
| `server/billing-store.neon.integration.test.ts` | editar — **residual R2**, sólo los literales (ver §Residuales) |
| `server/billing.neon.integration.test.ts` | editar — **residual R1**, sólo el título del `it` (ver §Residuales) |

**Fuera de alcance:** el bloqueo de acceso de `none` (tarea 54, ADR 0059), anual→mensual (tarea 55),
mover la escritura del customer de `checkout` al dominio (hallazgo declarado de la D1), partir
`onboarding/page.tsx`, y cualquier cambio a las 5 rutas o al webhook. Si creés que algo del núcleo
no se puede hacer sin salir de la whitelist, **paralo y reportalo** — no amplíes.

## ORDEN DE TRABAJO (no es sugerencia: el primer ítem te desbloquea a vos)

**0. PRIMERO el residual R2 de los literales fijos.** `server/billing-store.neon.integration.test.ts`
tiene **24 líneas** con `cus_…`/`sub_…` escritos a mano y el unique de `stripe_customer_id` es
**GLOBAL**. Es el modo de falla que ya envenenó la rama efímera dos veces y dejó la suite muriendo
**en el seed**, indistinguible de un bug de producto. Vas a correr integración todo el rato: cerralo
antes. Derivá los literales del tag del test (patrón ya aplicado en `locations-races`:
`cus_${tag}`/`sub_${tag}`). **Ninguna propiedad aseverada cambia — sólo los literales.** Verificalo
corriendo ese archivo y después la suite completa.

1. `subscription/page.tsx` + consola + modal (D7 completo, las 12 filas de la tabla).
2. D8 cableado en la página + el aviso de «no pudimos confirmar con Stripe».
3. `backoffice/page.tsx` (tarjeta, `realModules`, presentación de `none`/`canceled`).
4. `onboarding/page.tsx`.
5. Tests: render del HTML, fuga, home, D8, y **el oráculo de que la D1 no rompió el alta**.
6. **El barrido de docblocks** (§Barrido) — y esto NO va al final: ver §Barrido.
7. Residual R1 (el título del `it`).

## §Corte de archivos — DECIDIDO POR EL ORQUESTADOR, no por vos a mitad de la tarea

El plan de pruebas de la spec pone el render del HTML dentro de `billing-view.test.ts`. **Lo muevo,
y el motivo principal NO es el tamaño: es la naturaleza.** `billing-view.test.ts` es funciones puras
sin un solo mock; el render exige `vi.mock("./auth-guards")`, una fila sembrada y base real. (El
tamaño también: 235 líneas medidas al hook, `EXIT=0`, y el preámbulo + 4-6 tests lo pasa de 300.)

- **Va en `server/billing-pages.neon.integration.test.ts`.** Precedente exacto en el repo:
  `server/locations-backoffice-pages.neon.integration.test.ts` — `vi.hoisted` para la sesión,
  `vi.mock("./auth-guards")` con `requireOwner`, y `renderToStaticMarkup(await BackofficePage())`
  en la línea 113. Copiá ese esqueleto.
- **La spec dice que el render corre bajo `environment: "node"` sin instalar nada, y es cierto** —
  `react-dom/server` ya está. No lo declares como límite: está demostrado en ese archivo.
- **Umbral del corte, fijado por adelantado:** si `billing-pages.neon.integration.test.ts` pasa de
  **260 líneas medidas AL HOOK** (no a `wc`), los 3 casos de D8 salen a
  `server/billing-reconcile-page.neon.integration.test.ts` y el preámbulo compartido a
  `server/billing-pages-support.ts`. **El `vi.mock` NO puede vivir en el support** — misma lección
  que `billing-webhook-support.ts`: va en cada `.test.ts`.
- **Cómo se mide un tamaño** (`CLAUDE.md`, y en esta spec ya costó un bloqueante): se pregunta AL
  HOOK, **post-prettier**, en el momento de escribir el número:
  ```
  echo '{"tool_input":{"file_path":"<abs>"}}' | .claude/hooks/file-size.sh; echo "EXIT=$?"
  ```
  con un control sobre un archivo sano para probar que discrimina. `file-size` es **PostToolUse, no
  Stop**: los 5 gates NO cazan una violación.

## §Modal (`cancel-dialog.tsx`)

D7, fila `plus`/`none` con N>1 activos: **el botón NO se deshabilita** (ADR 0058 §8, respuesta
literal del owner: «el usuario no sabría qué debe hacer»). Se aprieta, y el modal dice **qué hacer**
—«Para volver a Free necesitas 1 local activo; hoy tenés N. Archivá N-1»— **con link a
`/backoffice/locations`**, y «Confirmar» **no está disponible**. El 409 del servidor es el que manda.

**Dato medido, para que no decidas a ciegas:** `app/components/confirm-dialog.tsx` (97 líneas, **7
consumidores**) tiene `description: string` y siempre renderiza el botón de confirmar, así que tal
cual no cubre «link adentro» ni «Confirmar no disponible». **Verificá esto vos antes de escribir uno
nuevo**: si se puede extender con props OPCIONALES sin tocar los 7 consumidores, es mejor que una
segunda copia de la lógica de foco/Escape. Elijas lo que elijas, **decí por qué en el handoff** y no
pierdas el comportamiento de accesibilidad (trampa de foco, Escape, `aria-*`).

## §onboarding

Hoy (`app/onboarding/page.tsx:158-164`) manda `{ businessId, interval }` y **no** manda `from`. El
`checkout` de la D1 ignora el `businessId` y **defaultea `from` a `"onboarding"`**, así que el alta
*debería* seguir andando — **pero eso es un razonamiento, no una medición, y va con oráculo.** El
ítem 3 de §Lo que no se negocia.

**El archivo está en 469 líneas: el hook `file-size` sale `EXIT=2`** (medido, con control en
`EXIT=0`). Es una violación **preexistente** y **partir ese archivo NO está en el alcance de esta
spec.** Tu edición es de suma cero (saca una clave, pone otra). **Esperá el `EXIT=2`, no refactorices
para calmarlo, y declaralo en el handoff con el conteo RE-MEDIDO antes y después.**

## §Barrido de docblocks — VA DESDE EL INICIO, no al final

En la D1, cuatro rondas de revisión encontraron **un** bloqueante cada una —los cuatro de la misma
familia, «un invariante declarado que ningún test pinnea»— y después **un barrido sistemático
encontró NUEVE en una pasada**. Ya es regla en `CLAUDE.md`.

- **Cada comentario que escribas afirmando un invariante** («esto es lo que hace que X», «sin esto
  pasaría Y», «es normativo») **necesita un oráculo o una declaración explícita de que no lo tiene.**
- **La tabla de mutaciones se escribe DESPUÉS de escribir el código, no desde el diseño** — es
  sistemáticamente ciega a lo que el código terminó afirmando. Al cerrar, **listá los docblocks del
  código nuevo y mutá cada uno.** Los que queden verdes son el trabajo que falta.
- **Ninguna fila se predice: se EJECUTA y se transcribe el resultado literal** (la aserción del
  rojo, textual, o **VERDE**). Un par mutación↔test escrito de memoria regala cobertura que no
  existe.
- **Una mutación se corre contra TODOS los archivos que pueden verla**, y el alcance se escribe en
  la fila. En la D1 dos filas se transcribieron con el número equivocado por correr contra un solo
  archivo.
- **Un rojo también puede ser por el motivo equivocado.** Verificar que un guard muerde no es ver un
  rojo: es **LEER la aserción del rojo** y confirmar que habla de la propiedad y no del setup (en la
  D1, 5 de 8 rojos de M6 morían en `DATABASE_URL no está configurada`).

## §Protocolo de mutaciones — es lo que más caro salió en esta spec (5 muertes)

1. **`shasum` ANTES de mutar**, y va al handoff. Es el único punto de retorno que existe.
2. **`git status --short` antes de mutar.** Casi todo lo tuyo va a ser **`??` (untracked)**: ahí
   `git checkout` **no revierte NADA** (no hay blob). **Sacá copia a `/tmp` primero** — en la D1 esa
   copia salvó dos mutaciones abandonadas, y una reconstrucción a mano no convergió contra el hash.
3. Si el archivo sale **` M` (tracked y modificado)**, el `git checkout` de emergencia es **peor**:
   se lleva también el trabajo no commiteado, y **se ve como si hubiera funcionado**.
4. **Etiquetá la mutación mientras está puesta:** `// MUTATION <id> (implementador)`. El hook
   `no-mutations-left.sh` (Stop) **sólo ve mutaciones ETIQUETADAS**. Sin la etiqueta, tu rojo es
   indistinguible de un bug real del producto para quien herede el árbol.
5. **Al restaurar, `diff` contra la copia limpia** y mirá que lo único que se va sea la mutación.
   Después `shasum` y que coincida. «Casi igual» degrada un archivo en silencio: en la D1 un
   candidato estructuralmente correcto perdía un comentario y **el hash lo cazó**.
6. **Ninguna mutación sobrevive a tu turno.** `grep -rn MUTATION apps/merchant/src` vacío al
   entregar.

## §Si te caés: escribí a disco mientras trabajás

Esta spec lleva **5 muertes de agente**. Lo que tiene que sobrevivir va a un archivo, no a tu
contexto.

- **Escribí cada fila del barrido a `/tmp/barrido-d2.md` apenas la terminás**, no al final.
- Registrá ahí también los `shasum` limpios y las copias de `/tmp` de cada archivo que mutes.

## §Lo que no se negocia (los tres que se ganaron caro, más el DoD)

1. **El barrido desde el inicio** (§Barrido).
2. **LAS DOS SALIDAS del estado «`plus` con la suscripción muerta».** La spec dice que ese estado
   sale por «**D8 o el botón de D10**». **D10 quedó en la D1 y D8 va en la D2, así que ningún
   revisor las vio juntas.** Escribí un test que las ponga juntas sobre el mismo estado: que D8
   reconcilie desde Stripe **y** que el botón «Ajustarme y bajar a Free» (`settle-free`) siga siendo
   salida cuando Stripe no tiene nada que contar.
3. **Que la D1 no rompió el alta**, con oráculo (§onboarding). El ítem del DoD «ninguna ruta actúa
   sobre un negocio nombrado en el body» ya está cerrado del lado del servidor; lo que falta es que
   el ALTA siga llegando a Checkout.
4. **Los ítems del DoD que esta fase cierra:**
   - Ni las respuestas ni el **HTML** de `/backoffice/subscription` contienen `stripe_customer_id`,
     `stripe_subscription_id` ni `downgrade_requested_at`. (`CLAUDE.md`: una ruta que devuelve una
     entidad al navegador nunca serializa claves internas; un revisor ya cazó esa fuga en marca.)
   - La **home** muestra «Sin plan» para `none` y **no** dice «confirmando pago» para un `free` con
     `status='canceled'`.
   - D8: fila divergente → reconcilia antes de renderizar; lista vacía → **no escribe nada**; Stripe
     caído → renderiza **con el aviso**, sin bloquear la sección.
   - Un negocio `free` llega a `plus` sin pasar por el onboarding, desde la tarjeta «Suscripción».
   - `past_due`/`unpaid`: se avisa el cobro pendiente y **no** se ofrece cambio de plan ni de
     intervalo. `status` desconocido → texto genérico por allow-list, **nunca el string crudo**.
   - `pendingPlanAt` viaja como **string ISO**, no `Date`.
   - `canCancel === false` **NO** deshabilita el botón (§Modal).

## §Gates y entorno

- **Node:** `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use` (**sin argumento**, hay
  `.nvmrc`) antes de cualquier gate. El shell del agente arranca en Node 22 y el repo pide 24.20.0.
- **Los scripts son de ROOT:** `pnpm run typecheck|lint|test|format:check|build`. Un
  `pnpm --filter @mi-pasaporte/merchant lint` no existe. Para un archivo suelto:
  `pnpm --filter @mi-pasaporte/merchant exec vitest run <path>`.
- Integración: `.env.integration.local`. El DoD exige **0 skipped**.
- **NO uses worktrees** para correr `pnpm run`/`pnpm exec`: dispara `runDepsStatusCheck` → intenta
  purgar el `node_modules` symlinkeado, que son las dependencias posta. Pasó dos veces en la 0053.
- **NO corras `pnpm fetch`** — purga `node_modules`.
- **Si borrás una ruta API**, `typecheck` puede fallar por `.next/types/validator.ts` viejo (tipo
  generado, no un error del código).

## §La suite de integración es FLAKY, y eso cambia cómo leés un rojo

Medido en la D1: tres corridas seguidas fallando en **tres conjuntos DISTINTOS** de archivos
—incluidos dos de la spec 0055, que esta fase no toca— con **`NeonDbError: fetch failed`**, no una
aserción, y todos verdes aislados.

- **Regla operativa: un rojo de integración se re-corre AISLADO antes de creerle.**
- **Un verde de una sola corrida tampoco prueba mucho**: si reportás verde, decí cuántas corridas.
- **La causa raíz NO está cerrada, y el orquestador ya se equivocó acá:** escribió que unos
  `fetch failed` dentro de corridas verdes eran «reintentos absorbidos», y un revisor lo falsificó
  con dos `grep` — **no hay ninguna capa de retry en `db.ts`** y esos `fetch failed` salen de un test
  que setea a propósito un `DATABASE_URL` de localhost. **No repitas el error: antes de escribir
  «esto pasa PORQUE X», buscá X en el árbol.**
- La rama efímera acumula ~32 negocios huérfanos de corridas abortadas. **No bloquean y no los
  borres**: borrar filas de una base es decisión del owner.

## §Límites y costos — se verifican antes de escribirlos

Esta spec tuvo **tres** bloqueantes por esto, y es lo que más se cuela porque suena a prudencia.

- «Esto no se puede testear» → **intentá testearlo primero**; y si el límite es real, acotalo a la
  parte exacta que lo es.
- **Un COSTO declarado es un límite declarado.** «Costaría una migración / una columna / un
  refactor grande» se verifica igual: **intentándolo.** En la D1 un costo inventado estuvo a punto
  de torcer una decisión del owner.
- **Al corregir un límite sobredimensionado, el límite nuevo tampoco vale sin intentarlo.**
- Y si escribís un proxy (un barrido estático), **etiquetalo como proxy**, decí qué parte hace el
  trabajo, **escribí vos 3 evasiones** antes de darlo por bueno, y aseverá un piso de archivos
  escaneados para que un barrido vacío no quede verde. Para una propiedad de **comportamiento**
  ningún barrido sirve: por eso esta fase renderiza el HTML de verdad.

## §Residuales de la D1 (menores del revisor; van en este encargo, no inventes más)

- **R2 — los literales fijos.** Ítem 0 del orden de trabajo, arriba.
- **R1 — un `it` que carga CUATRO oráculos y cuyo título nombra uno**, en
  `server/billing.neon.integration.test.ts` (S11 el orden, S12 la clave, B4 el `cancel_at`, S13 las
  tres columnas). Las cuatro **están pinneadas** y cada aserción lleva su comentario con su
  mutación: lo que engaña es el **TÍTULO, que es lo único que se ve en CI**. Se cierra partiéndolo en
  cuatro `it` o renombrándolo. **No aflojes ninguna aserción.**

## §Handoff que tenés que entregar

El bloque de `docs/AGENT-WORKFLOW.md`, y ADEMÁS:

1. **La tabla del barrido completa**, con el resultado **ejecutado** de cada fila (aserción literal
   del rojo, o VERDE) y **el alcance de archivos** contra el que se corrió cada mutación.
2. **El `shasum` LIMPIO de cada archivo que mutaste** y dónde dejaste su copia de `/tmp`.
3. **Los tamaños preguntados AL HOOK**, post-prettier, con un control que discrimine.
4. **Los 5 gates** con el conteo de la suite (`N archivos / M tests / 0 failed / 0 skipped`) y
   **cuántas corridas** hiciste, dado el flaky.
5. **Una sección «Decisiones del IMPLEMENTADOR de la fase D2, NO del owner ni del orquestador»** en
   `docs/specs/0063-…md`. **Lo que el owner no dijo explícitamente NO se escribe como decisión
   suya**: si aparece un efecto lateral que nadie acordó, va como **hallazgo a decidir**. En la spec
   0053 deducir un acuerdo del código obligó a revertir una spec entera.
6. Los límites que declares, **cada uno con el intento que lo respalda**.

**No marques la spec `implementada` y no actualices `docs/TASKS.md`**: eso lo hace el orquestador
después del PASS de un revisor independiente.
