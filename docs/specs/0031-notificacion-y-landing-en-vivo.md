---
spec: 0031
fecha: 2026-08-14
estado: cerrada
resumen: Micro-portal instalable del consumidor (único acceso hoy = agregar a inicio, ADR 0039), estilo iOS, con nav inferior de 2 pestañas — "Programas" (una tarjeta brandeada por membresía, ordenadas por última actividad, filtro para ver cerrados/inactivos; Sellos reusa CardPreview 0027, Puntos usa colores+logo de marca; ícono info → popup de T&C) y "Mi QR" (código + alta a Wallet + PushPrompt). "Mi QR" es la pestaña inicial hasta confirmar notificaciones, luego "Programas". Reemplaza el alcance original de notificación/landing en vivo, ya cubierto de punta a punta por el canal de push (0030/0033/0037/0038/0040).
disjunta: sí
archivos: ver sección Archivos
---

# 0031 — Micro-portal del consumidor: Programas y Mi QR

> **Reencuadre 2026-08-16.** Esta spec nació (2026-08-14) como "notificación + landing en
> vivo": avisar al consumidor cuando el encargado le otorga puntos/sellos, por push si ya
> tiene el pase, o actualizando en vivo la landing de enrolamiento si todavía no. Ese
> mecanismo **ya está construido e implementado** por otras specs (ver "Qué ya no es
> problema de esta spec" abajo). Lo que queda — y es lo que el owner pidió cerrar ahora — es
> el **contenido del micro-portal** que el ADR 0039 dejó reservado para esta spec: la
> superficie instalable en la pantalla de inicio (`(consumer)/wallet`, ya construida como
> shell mínimo por la 0037) pasa de "QR + botones" a una experiencia de dos pestañas con
> navegación inferior, al estilo de una app.

## Qué ya no es problema de esta spec

Verificado contra el código real, no asumido:

- **El disparo de la notificación al otorgar ya existe.** `counter/orders.ts` (spec 0030)
  encola una fila `transactional` en `consumer.wallet_push_queue` **dentro de la misma
  transacción SQL** que acredita el orden (CTE `pushq`, líneas ~125-136). El worker
  (`wallet/push-worker.ts`, spec 0033) la drena con prioridad y la entrega por el
  transporte que corresponda: pase de Wallet si es alcanzable, si no Web Push como fallback
  (ruteo por clase, ADR 0040 / spec 0038). Nada de esto lo toca la 0031.
- **La "landing en vivo" pre-pase (polling durante el otorgamiento) se cae del alcance,
  sin reemplazo.** El borrador original la proponía para el consumidor que todavía no
  agregó el pase y sigue mirando la landing de `/enroll/[programId]`. Hoy ese caso ya no es
  el camino principal: el push cubre "en vivo" en ambas plataformas (pase o Web Push), y la
  landing de enrolamiento (spec 0028/0039) no vuelve a abrirse después del alta. Si el
  owner more adelante quiere un resultado en vivo sobre esa landing puntual, es una spec
  nueva — **no entra acá** (ver Abierto #4 para confirmar el corte).
- **El pase y el enlace "Ver mis programas" ya existen** (spec 0029: `web_view_token`,
  `/c/[webViewToken]`) y **el shell instalable del portal ya existe** (spec 0037: manifest
  dinámico por-consumidor, `sw.js`, `apple-mobile-web-app-capable`, el flujo de dos
  contextos de iOS del ADR 0039). Esta spec no toca nada de eso — construye **encima**.

## Problema

El micro-portal (`(consumer)/wallet`) hoy es una sola pantalla: QR + botón de alta a
Wallet + prompt de notificaciones. No tiene la forma de una app instalada — no hay manera
de ver, de un vistazo, en qué programas está el consumidor y cómo va cada uno. Un
consumidor que pertenece a 2+ negocios (ej. un local de café y una peluquería) no tiene
dónde ver ambos programas a la vez; solo ve el QR, que es igual para todos.

## Alcance

**Entra:**
- Nav inferior fija de **2 pestañas**: **"Programas"** y **"Mi QR"**. Sin cambio de ruta
  (misma URL `/wallet`; estado de pestaña en el cliente) — no hay necesidad de deep-link a
  una pestaña específica y evita tocar el `start_url` per-consumidor del manifest (spec
  0037/ADR 0039 §5). **Ambas pestañas son siempre alcanzables desde la nav**; el gate del
  párrafo siguiente decide solo cuál se ve *primero*, no bloquea ninguna.
- **Pestaña inicial gateada por el opt-in de notificaciones** (decisión del owner): la
  primera pantalla que ve el consumidor es **"Mi QR"** — donde vive el prompt de
  notificaciones — **hasta que confirma las notificaciones**; una vez confirmadas, la
  pestaña inicial pasa a ser **"Programas"**. Detalle de la señal en el Diseño (se lee de la
  suscripción Web Push, no es un flag nuevo).
- **Pestaña "Programas":** una tarjeta por cada `program_membership` del consumidor,
  ordenadas por **última actividad, la usada más recientemente arriba** (ver Diseño para la
  señal), brandeada con los datos del negocio/programa:
  - **Sellos** (`kind = 'stamps'`): reusa el diseño ya existente de la spec 0027
    (`CardPreview`, fondo sólido o degradé + grilla de sellos con `stampImagePath`),
    ahora con `filled = stampsCount` real (no la mitad simulada del wizard).
  - **Puntos** (`kind = 'points'`): la 0027 nunca le dio diseño propio (columnas
    `card*` de `loyalty_program` son Sellos-only). La tarjeta de Puntos usa **los colores
    de marca** del negocio (`brandPrimaryColor`/`brandComplementaryColor` como degradé,
    `brandAccentColor` como acento) **y el logo del negocio** — es una tarjeta **más
    grande y compuesta** (logo prominente + nombre del negocio + balance de puntos en
    grande con `unitName`), **no** un `div` con sub-divs de sellos. Sin migración ni paso
    de diseño nuevo.
  - Cada tarjeta muestra nombre del negocio + logo (ruta pública existente, sin exponer
    la clave R2) + progreso (sellos rellenos/objetivo, o puntos).
  - **Ícono "info"** en cada tarjeta: al tocarlo abre un **popup (modal)** con los
    **términos y condiciones** del programa (`termsMarkdown`, ya en `loyalty_program`). El
    popup es el contenedor extensible que el owner llenará con más cosas a futuro; en esta
    spec **solo** muestra los T&C. Renderizado como **texto plano** (no se agrega parser de
    markdown — el repo no tiene ninguno y el CLAUDE.md desaconseja sumar dependencias;
    mismo tratamiento que `program-view.tsx` hoy: `<p>{termsMarkdown}</p>` con
    `white-space: pre-wrap`).
  - Fuera del ícono info, **sin drill-down**: la cara de la tarjeta no navega a otra
    pantalla.
  - **Filtro de estado:** por defecto se ven solo las membresías de programas **activos**
    (`status = 'active'`). Un **filtro/toggle** ("Ver programas cerrados") revela también
    las de programas `closing`/`inactive` en los que el consumidor estuvo enrolado — con un
    distintivo visual de "cerrado/inactivo" en la tarjeta (atenuada + etiqueta). El filtro
    es estado de cliente; el query trae todas las membresías con su `programStatus`.
  - Estado vacío: no debería poder ocurrir hoy (el alta a un programa crea la primera
    membresía en el mismo flujo, spec 0028), pero se contempla por si una membresía queda
    huérfana a futuro.
- **Pestaña "Mi QR":** el contenido actual de `/wallet` sin cambios de comportamiento —
  QR (`renderQrSvg`), `WalletButtons` (Apple/Google según plataforma) y `PushPrompt`
  (opt-in de notificaciones, spec 0037) — solo reubicado bajo la pestaña. `PushPrompt`
  vive **solo acá** (no se duplica en el shell).
- Nuevo query de servidor `listConsumerPrograms(consumerId)` que junta
  `program_membership` + `loyalty_program` + `business` (+ última actividad de
  `core.order`), con DTO que **nunca** serializa `stampImageObjectKey`/`logoObjectKey`
  (reusa `toClientProgram`, ya existente y testeado en `loyalty-program/client-view.ts`,
  más un `logoPath` construido igual que en `enroll/[programId]/page.tsx`) — test por
  entidad, como exige el CLAUDE.md.
- Reubicar `card-preview.tsx` (hoy en `app/backoffice/loyalty/`) a una carpeta compartida:
  ya lo anticipa su propio comentario ("later, the consumer wallet") y esta spec es ese
  "later". Sin cambio de comportamiento, solo de ubicación + imports. Los estilos
  (`.card-preview*`, `.card-slot`) viven en `app/globals.css`, importado por el layout raíz
  → aplican en la ruta del consumidor sin tocar nada.

**No entra:**
- El disparo de la notificación (ya implementado, ver arriba).
- Landing en vivo pre-pase (no existe como pantalla; se confirma su corte, ver Abierto).
- Historial de movimientos por programa, o cualquier contenido del popup info más allá de
  los T&C — el popup queda como contenedor, pero esta spec solo mete los T&C.
- Diseño de tarjeta propio para Puntos (paso de diseño análogo al wizard de Sellos,
  spec 0027) — por ahora alcanza con los colores + logo de marca.
- Cupones, premios o cualquier 3ra pestaña — la nav queda fija en 2 pestañas, sin
  placeholder para futuras (YAGNI).
- Cambios al manifest, service worker o flujo de instalación (specs 0037/0039), ni a la
  cola/worker de push (0033), ni al ruteo por clase (0038/0040).

## Diseño

**Lenguaje visual: estilo iOS.** El portal se instala y se usa como una app; la superficie
adopta convenciones iOS — tab bar inferior tipo iOS (íconos SF-like dibujados inline en
SVG, sin librería nueva; label chico bajo el ícono; ítem activo en color de acento), tarjetas
con esquinas redondeadas grandes y sombra suave, modal de T&C como hoja/sheet, tipografía
`-apple-system`/system-ui, respeto de `env(safe-area-inset-*)`. Es el default estético; el
detalle fino lo resuelve el implementador. No se agregan dependencias de UI.

### Especificación técnica

**Server — `apps/merchant/src/server/consumer/programs.ts` (nuevo)**

```
listConsumerPrograms(consumerId: string): Promise<ConsumerProgramSummary[]>
```

Un `SELECT` con join `program_membership` → `loyalty_program` → `business`, más un
`LEFT JOIN` lateral a `core.order` para la última actividad, filtrado por `consumerId`
(aislamiento: el consumidor solo puede ver sus propias membresías — la sesión ya resuelve
el `consumerId`, no llega por input del cliente). Para cada fila arma:

```ts
type ConsumerProgramSummary = {
  membershipId: string;
  businessId: string;
  businessName: string;
  logoPath: string | null;        // /api/public/brands/{businessId}/logo?v=… o null
  brandPrimaryColor: string;
  brandComplementaryColor: string;
  brandAccentColor: string;
  programId: string;
  programStatus: "active" | "closing" | "inactive"; // para el filtro y el distintivo
  kind: "points" | "stamps";      // tiers/cashback no tienen membresía real hoy
  unitName: string;               // de configuration.unitName
  target: number | null;          // de configuration.target, solo stamps
  cardDesign: CardDesignColors | null; // solo stamps, null → CardPreview usa fallback de marca
  stampImagePath: string | null;  // reusa toClientProgram
  termsMarkdown: string;          // T&C del programa para el popup info (campo core, no secreto)
  pointsBalance: number;
  stampsCount: number;
  enrolledAt: string;             // ISO
  lastActivityAt: string;         // ISO — MAX(order.created_at) o, si no hubo grants, enrolledAt
};
```

**Orden — "la usada más recientemente arriba":** `ORDER BY lastActivityAt DESC`, donde
`lastActivityAt = COALESCE(MAX(core.order.created_at) por membership, enrolledAt)`. El
grant en mostrador (spec 0030) escribe una fila `core.order` por otorgamiento con
`membership_id` + `created_at`; su `MAX` es la última vez que el consumidor **usó** ese
programa. Un programa recién enrolado sin grants cae a `enrolledAt`. **Sin migración**: se
deriva por join (`core_order_membership_idx` ya cubre el acceso por `membership_id`).

**DTO discipline:** ninguna clave `*ObjectKey` sale del server. `logoPath` y
`stampImagePath` se arman con las mismas rutas públicas ya existentes
(`/api/public/brands/[businessId]/logo`, `/api/public/loyalty/[businessId]/[programId]/stamp`).
`termsMarkdown` es un campo `core` ya expuesto al backoffice (`program-view.tsx`) y a la
landing de enrolamiento — no es secreto. Test unitario dedicado (`programs.test.ts`) que
pinnee la ausencia de `*ObjectKey` en la salida, siguiendo el patrón que el CLAUDE.md ya
exige para `toClientProgram`/`brandResponse`.

**Pestaña inicial (gate del opt-in) — cómo se decide, sin flag nuevo:**

- **SSR (sin flash en el caso común):** `page.tsx` (server) llama a un helper
  `hasWebPushSubscription(consumerId)` — reutiliza `listConsumerSubscriptions` de
  `server/push/subscriptions.ts` (spec 0037), `≥1 fila ⇒ true`. `true` → pestaña inicial
  `"programs"`; `false` → `"qr"`. Así el consumidor ya suscripto que abre la PWA aterriza
  directo en Programas sin parpadeo.
- **Cliente (promueve, nunca degrada):** al montar, `WalletShell` no fuerza volver a QR.
  Cuando `PushPrompt` reporta una suscripción exitosa recién hecha (nuevo callback
  `onSubscribed`), el shell cambia la pestaña activa a `"programs"`. Es la transición
  "recién confirmó → ahora ve sus programas" que pidió el owner.
- **Consecuencia deliberada:** la señal es la **suscripción Web Push** (per-consumidor).
  Un consumidor iOS que tomó el escape hatch (solo pase, sin instalar) o que **denegó** el
  permiso no tiene suscripción → su pestaña inicial sigue siendo "Mi QR", pero **puede
  tocar "Programas" en la nav** en cualquier momento (el gate elige el default, no
  bloquea). Esto es exactamente "hasta que confirme" sin convertirse en una trampa.

**Cliente — árbol de componentes bajo `(consumer)/wallet/`:**

- `page.tsx` (server component, existente): agrega `listConsumerPrograms(account.id)` y
  `hasWebPushSubscription(account.id)` al `Promise.all` ya presente; pasa `programs`,
  `initialTab`, el `qrSvg`, `isIos` y `vapidPublicKey` a `<WalletShell>`.
- `wallet-shell.tsx` (nuevo, `"use client"`): estado `activeTab` inicializado con
  `initialTab`; renderiza header + la pestaña activa + `<BottomNav>`; pasa
  `onSubscribed={() => setActiveTab("programs")}` hacia `<QrTab>` → `<PushPrompt>`.
- `bottom-nav.tsx` (nuevo): nav fija `position: fixed; bottom: 0`, con
  `padding-bottom: env(safe-area-inset-bottom)` (necesario en iOS PWA standalone), 2
  ítems con ícono + label.
- `programs-tab.tsx` (nuevo, `"use client"`): estado `showClosed` (default `false`);
  filtra la lista a `programStatus === 'active'` salvo que `showClosed` esté activo;
  toggle "Ver programas cerrados"; lista de `<ProgramCard>`; estado vacío.
- `program-card.tsx` (nuevo, `"use client"` — tiene el botón info + estado del modal):
  despacha por `kind` — `stamps` → `CardPreview` (reubicado) con `filled = stampsCount`;
  `points` → `<PointsCard>`; en ambos casos renderiza el ícono info + `<TermsModal>`. Si
  `programStatus !== 'active'`, la tarjeta va atenuada (opacidad) + etiqueta
  "Cerrado"/"Inactivo".
- `points-card.tsx` (nuevo): tarjeta grande y compuesta — degradé
  `brandPrimaryColor → brandComplementaryColor`, borde `brandAccentColor`, **logo del
  negocio** (`logoPath`, `<img>` con fallback al nombre si es null, mismo criterio que la
  landing 0039) + nombre + número de puntos grande con `unitName`; el texto usa
  `readableTextColor` (`lib/brand-color.ts`, ya existente) para el contraste sobre el
  degradé.
- `terms-modal.tsx` (nuevo, `"use client"`): popup accesible (rol `dialog`, cierre por
  backdrop/Escape/botón) que muestra `termsMarkdown` como texto plano
  (`white-space: pre-wrap`), sin parser de markdown.
- `qr-tab.tsx` (nuevo): el contenido que hoy vive inline en `page.tsx` (bloque QR +
  `<WalletButtons>` + `<PushPrompt>`), sin cambios de comportamiento; recibe y pasa
  `onSubscribed` a `<PushPrompt>`.

**Cambio a `PushPrompt` (spec 0037):** sumar prop opcional `onSubscribed?: () => void`,
invocada cuando `status` pasa a `"subscribed"` por una suscripción recién creada (en la
rama de éxito de `enable()`). Sin prop → comportamiento idéntico al actual (lo sigue
usando `/wallet`… que ahora es esta misma superficie, así que en la práctica siempre
llega la prop, pero se deja opcional por seguridad de tipos y para no romper otros usos).

**Reubicación de `card-preview.tsx`:** a un nivel compartido fuera de ambas rutas:
`apps/merchant/src/components/loyalty/card-preview.tsx`. Actualiza los imports existentes
(`step-card-design.tsx`, `step-review.tsx`, y cualquier otro que lo importe) más el nuevo
en `program-card.tsx`. Sin cambios de comportamiento — es mover + re-apuntar imports, el
componente ya es pure-props; sus estilos viven en `app/globals.css` (no se mueven).

### Arquitectura de referencia

- **ADR 0039** — el micro-portal es la pieza load-bearing de iOS; esta spec es
  explícitamente el "contenido rico" que el ADR 0039 §4 reservó para la 0031.
- **ADR 0037/0038/0040** — canal de push y ruteo por clase; esta spec los consume, no los
  modifica.
- **Spec 0027** — diseño de tarjeta de Sellos (`CardPreview`, `cardBackground`,
  `filledCount`), reusado sin cambios de comportamiento.
- **Spec 0028** — sesión de consumidor (`resolveSession`) que ya resuelve el `consumerId`
  usado para aislar el query nuevo.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/server/consumer/programs.ts` | crear |
| `apps/merchant/src/server/consumer/programs.test.ts` | crear |
| `apps/merchant/src/server/consumer/programs.neon.integration.test.ts` | crear |
| `apps/merchant/src/server/push/subscriptions.ts` | editar (agregar `hasWebPushSubscription`) |
| `apps/merchant/src/components/loyalty/card-preview.tsx` | crear (mover desde `app/backoffice/loyalty/card-preview.tsx`) |
| `apps/merchant/src/app/backoffice/loyalty/card-preview.tsx` | borrar (movido) |
| `apps/merchant/src/app/backoffice/loyalty/steps/step-card-design.tsx` | editar (import) |
| `apps/merchant/src/app/backoffice/loyalty/steps/step-review.tsx` | editar (import) |
| `apps/merchant/src/app/backoffice/loyalty/use-card-design.ts` | editar (import, si aplica) |
| `apps/merchant/src/app/(consumer)/wallet/page.tsx` | editar |
| `apps/merchant/src/app/(consumer)/wallet/wallet-shell.tsx` | crear |
| `apps/merchant/src/app/(consumer)/wallet/bottom-nav.tsx` | crear |
| `apps/merchant/src/app/(consumer)/wallet/programs-tab.tsx` | crear |
| `apps/merchant/src/app/(consumer)/wallet/program-card.tsx` | crear |
| `apps/merchant/src/app/(consumer)/wallet/points-card.tsx` | crear |
| `apps/merchant/src/app/(consumer)/wallet/terms-modal.tsx` | crear |
| `apps/merchant/src/app/(consumer)/wallet/qr-tab.tsx` | crear (extraído de `page.tsx`) |
| `apps/merchant/src/app/(consumer)/push-prompt.tsx` | editar (prop `onSubscribed`) |
| `apps/merchant/src/app/(consumer)/wallet-cta.tsx` | sin cambios (lo consume `qr-tab.tsx`, igual que hoy) |

### Disjunta?

**Sí**, frente a las specs abiertas del INDEX (0032 recuperación por OTP, 0040 cropper de
imagen, backlog 0001-0009/0021): ninguna toca `(consumer)/wallet/*`,
`server/consumer/programs.ts`, `push-prompt.tsx` ni `backoffice/loyalty/card-preview.tsx`.
La 0032 toca `wallet/rotate.ts` (purga de push subscriptions) y *consume*
`server/push/subscriptions.ts`, pero esta spec solo **agrega** una función a ese archivo
(`hasWebPushSubscription`), sin tocar las que usa la 0032 — sin overlap de líneas. Si
ambas corren a la vez, `subscriptions.ts` es el único punto de contacto y es aditivo.

### Archivos compartidos

| Qué | Quien lo deja listo | Cuándo |
|---|---|---|
| `toClientProgram` (`loyalty-program/client-view.ts`) | ya existe | reusar tal cual |
| `readableTextColor`/`tint`/`shade` (`lib/brand-color.ts`) | ya existe | reusar tal cual |
| `/api/public/brands/[businessId]/logo` | ya existe | reusar tal cual |

## Definition of Done

- [ ] `/wallet` muestra nav inferior con 2 pestañas, ambas alcanzables desde la nav.
- [ ] La pestaña inicial es "Mi QR" para un consumidor **sin** suscripción Web Push, y
      "Programas" para uno **con** suscripción; al confirmar el permiso desde el prompt, la
      vista cambia a "Programas" sin recargar.
- [ ] Un consumidor con membresías en 2+ negocios ve una tarjeta por membresía, cada una
      con el branding de su propio negocio (logo + colores), no el del último visto.
- [ ] Las tarjetas se ordenan por última actividad (la usada más recientemente arriba);
      un programa sin grants ordena por `enrolledAt`.
- [ ] Una membresía `stamps` muestra la grilla real de sellos (`filled = stampsCount`,
      no la mitad simulada) con el mismo diseño configurado en el wizard (spec 0027).
- [ ] Una membresía `points` muestra una tarjeta compuesta con logo + nombre + balance
      real sobre degradé de marca, sin depender de columnas `card*` (que son Sellos-only).
- [ ] El ícono info de una tarjeta abre un popup con los T&C del programa y se cierra por
      backdrop, Escape y botón.
- [ ] Por defecto se ven solo programas activos; el toggle "Ver programas cerrados" suma
      las membresías `closing`/`inactive`, atenuadas + etiqueta.
- [ ] "Mi QR" conserva el comportamiento actual: QR, botón de Wallet por plataforma,
      prompt de notificaciones — sin regresión.
- [ ] Ningún DTO de `listConsumerPrograms` serializa `stampImageObjectKey` ni
      `logoObjectKey` — test por entidad en verde.
- [ ] Un consumidor no puede ver membresías de otro (`consumerId` viene de la sesión, no
      del cliente) — test de aislamiento en verde.
- [ ] Gates: typecheck 3/3, lint, unit, build 3/3.

## Plan de pruebas y verificación

- [ ] Unitaria: `programs.test.ts` — DTO sin `*ObjectKey`; incluye `termsMarkdown` y
      `programStatus`; `kind = 'points'` no incluye `cardDesign`.
- [ ] Unitaria: `programs-tab` — con `showClosed=false` oculta membresías no-activas; con
      `showClosed=true` las incluye.
- [ ] Unitaria: `card-preview` (reubicado) sigue pasando sus tests existentes tal cual,
      solo con el import nuevo.
- [ ] Integración (Neon efímera): consumidor con membresías en 2 negocios distintos →
      `listConsumerPrograms` devuelve 2 filas con branding correcto por fila; consumidor
      sin membresías → `[]`.
- [ ] Integración: orden por última actividad — dos membresías, un grant reciente en la
      más vieja por `enrolledAt` la manda arriba (`MAX(order.created_at)` manda sobre
      `enrolledAt`).
- [ ] Integración: `hasWebPushSubscription` → `false` sin filas, `true` con ≥1
      suscripción del consumidor.
- [ ] Aislamiento: consumidor A no puede obtener membresías de consumidor B (query
      filtrado por `consumerId` de sesión).
- [ ] Comandos: `pnpm --filter @mi-pasaporte/merchant exec vitest run src/server/consumer/programs.test.ts`,
      `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`, `pnpm run build`.
- [ ] Manual: abrir `/wallet` instalado desde el home (iOS y Android) con un consumidor
      con 2 membresías reales (una Puntos, una Sellos) — arranca en "Mi QR", activar
      notificaciones → salta a "Programas", ver las 2 tarjetas con su branding, abrir el
      popup de T&C de una, tocar "Mi QR" y confirmar que el QR y el botón de Wallet siguen
      igual.

## Handoff requerido

Implementador → revisor independiente (`AGENT-WORKFLOW.md`); PASS antes de `implementada`.

## Decidido con el owner (2026-08-16)

- **Orden:** por última actividad, la usada más recientemente arriba (no `enrolledAt`).
- **Tarjeta de Puntos:** colores de marca **+ logo del negocio**, tarjeta grande y
  compuesta (no un `div` con sub-divs). Sin paso de diseño propio en esta spec.
- **Ícono info → popup de T&C:** cada tarjeta lo tiene; el popup es el contenedor
  extensible a futuro, hoy solo muestra los términos y condiciones.
- **Landing en vivo:** no existe como pantalla; el push ya cubre ese caso. Corte
  confirmado, sin reemplazo.
- **`PushPrompt`:** solo en "Mi QR". "Mi QR" es la pestaña inicial hasta que el consumidor
  confirma las notificaciones; confirmada, la inicial pasa a "Programas".
- **Programas cerrados/inactivos:** se muestran detrás de un filtro/toggle ("Ver programas
  cerrados"), atenuados + etiqueta; por defecto solo se ven los activos.
- **Estética:** estilo iOS (ver Diseño), el detalle fino lo resuelve el implementador.

## Abierto

Nada bloqueante — la spec está cerrada.
