---
spec: 0038
fecha: 2026-08-16
estado: cerrada
resumen: El aviso transaccional se entrega SOLO por wallet (Apple/Google) y cae a Web Push por fallback si el consumidor no tiene un pase alcanzable — elimina las notificaciones duplicadas del QA iOS (pase + Web Push). Web Push deja de ser transporte por defecto del transaccional. Además, la confirmación del enroll ofrece el opt-in de notificación por plataforma: iOS mantiene el instructivo "añadir a inicio"; Android suma un botón de permiso de notificación (única vía para que el fallback de Android sea real). Sin migración ni secreto nuevo.
disjunta: si
archivos: apps/merchant/src/server/wallet/push.ts, apps/merchant/src/server/wallet/push-transports.ts, apps/merchant/src/app/(consumer)/enroll/[programId]/page.tsx, apps/merchant/src/app/(consumer)/enroll/[programId]/enroll-form.tsx, apps/merchant/src/server/push.test.ts, apps/merchant/src/server/wallet-push-worker.neon.integration.test.ts
---

# 0038 — Ruteo de notificación por clase de aviso + opt-in de Android

> Implementa el **ADR 0040** (ruteo por clase; supersede el fan-out del ADR 0038 §3).

## Problema

El QA real (2026-08-16, iPhone + Android del owner) mostró **notificaciones duplicadas**: en iOS
con el pase en Wallet **y** la PWA instalada, una acreditación dispara **dos** avisos por el mismo
evento (la del pase de Apple y la de Web Push). En Android, el banner genérico de Google y el Web
Push rico llegan a la vez.

La causa es el fan-out del transaccional del ADR 0038 §3: el aviso sale por **todos** los
transportes que el consumidor tenga, sin decidir cuál corresponde. Deduplicar inspeccionando
plataforma/PWA/pases por consumidor es frágil (matriz iOS 1-4 × Android 1-2, casos borde
multi-dispositivo).

Además, si el transaccional pasa a "solo wallet", un usuario que **no agregó el pase** quedaría
mudo — y en Android hoy no hay ningún punto del flujo que le ofrezca activar notificaciones del
navegador para cubrir ese caso.

## Alcance

**Entra:**
- Ruteo del aviso **transaccional** por su `class`: **solo wallet** (Apple APNs + Google
  `addMessage`), con **fallback a Web Push** cuando el consumidor **no tiene un pase alcanzable**.
- Señal "wallet alcanzable" por consumidor (device APNs de un pase Apple, o pase Google).
- Threading de `class` desde la fila de cola (`claimRow`) hasta `deliverTransports`.
- Opt-in de notificación **por plataforma** en la confirmación del enroll (`screen: done`):
  iOS Safari → instructivo "añadir a inicio" (como hoy); Android/desktop → botón "Activar
  notificaciones" (reusa `PushPrompt`). Threading del `vapidPublicKey` a `EnrollForm`.

**No entra:**
- El **productor de campañas** ni el ruteo definitivo de la clase `campaign` (lo define su propia
  spec; hoy no hay filas `campaign` en circulación). Para `campaign`, `deliverTransports` conserva
  el fan-out actual como marcador provisional, sin efecto en prod.
- Cualquier migración de esquema (la columna `class` y las tablas ya existen).
- Cambios en la cola, el worker, el cooldown o la rotación.
- La dedup por plataforma/PWA (descartada por el ADR 0040 a favor de la regla por clase).

## Diseño

### Especificación técnica

**1. Ruteo por clase en `deliverTransports` (`wallet/push-transports.ts`).**

La firma pasa a recibir la clase del aviso:

```ts
deliverTransports(
  consumerId: string,
  message: PushMessage,
  noticeClass: string,            // 'transactional' | 'campaign'
  opts: { channel: PushChannel; webPushChannel: WebPushChannel | null },
): Promise<string[]>
```

Comportamiento:

- `noticeClass === 'transactional'`:
  1. `reachable = await consumerHasReachableWallet(consumerId)`.
  2. Si `reachable` → `sendApple` + `sendGoogle` (wallet). **No** Web Push.
  3. Si `!reachable` → **fallback**: `deliverWebPush` únicamente. (No hay wallet que enviar.)
- `noticeClass === 'campaign'` (provisional, sin filas en prod) → conserva el fan-out actual
  (`sendApple` + `sendGoogle` + `deliverWebPush`). Se refina en la spec de campañas.

**Señal "wallet alcanzable"** (`consumerHasReachableWallet(consumerId): Promise<boolean>`), nueva
función en `push-transports.ts`. `true` si existe **al menos uno** de:
- un `wallet_push_device` (token APNs) ligado a un `wallet_pass` provider=`apple` del consumidor, **o**
- un `wallet_pass` provider=`google` del consumidor.

Se resuelve con **una** query (dos `EXISTS`/`UNION`/`OR`), sin traer filas. Es la señal correcta
de "el wallet realmente puede notificar" (un pase Apple sin device registrado no es alcanzable).

**2. Threading de `class` (`wallet/push.ts`).**

- `type Claim` suma `class: string`.
- `claimRow` agrega `class` al `RETURNING` (`RETURNING consumer_id, title, body, class`) y al
  objeto devuelto.
- `deliverClaimed` pasa `claim.class` como `noticeClass` a `deliverTransports`.

Sin cambios en `dispatchGranted`/`dispatchInline`/`deliverRow` más allá de propagar el `class` que
ya viaja en el `Claim`.

**3. Opt-in de Android en la confirmación del enroll.**

- `enroll/[programId]/page.tsx` (server): importa `vapidFromEnv` y pasa
  `vapidPublicKey={vapidFromEnv()?.publicKey ?? null}` a `EnrollForm`.
- `EnrollForm` recibe `vapidPublicKey: string | null` y, en `screen: done`, reemplaza el bloque
  actual `{isIosSafariBrowser() ? <IosInstallHint/> : null}` por:

  ```tsx
  {isIosSafariBrowser()
    ? <IosInstallHint />
    : <PushPrompt vapidPublicKey={vapidPublicKey} />}
  ```

  - **iOS Safari** → `IosInstallHint` (igual que hoy; **decoplado** de que el Web Push esté
    configurado — el instructivo vale por el portal/pase aunque `vapidPublicKey` sea null).
  - **Android/desktop** → `PushPrompt`, cuya rama no-iOS registra el SW, pide permiso tras el
    gesto, se suscribe y hace `POST /api/public/push/subscribe`. La cookie de sesión ya quedó
    seteada por el `POST` de registro (201), así que el subscribe queda autorizado.
  - `vapidPublicKey === null` (Web Push deshabilitado) → `PushPrompt` no renderiza nada. Sin botón.

  En Android el Web Push funciona en la **pestaña normal** (no requiere PWA, a diferencia de iOS),
  por eso el permiso se puede pedir en la confirmación y deja creada la suscripción que el
  **fallback** del ruteo usará.

- Se quita el import de `isIosSafariBrowser` solo si deja de usarse; `PushPrompt` se importa desde
  `../../push-prompt`. `WalletButtons` y el resto del `done` no cambian.

### Arquitectura de referencia

- **ADR 0040** — ruteo por clase (esta spec lo implementa; supersede ADR 0038 §3).
- **ADR 0038** — dos transportes wallet/webpush (vigente salvo §3).
- **ADR 0037** — cola/outbox, prioridad, cooldown, worker (sin cambios).
- **ADR 0039** — Web Push en iOS vía PWA; escape hatch (sin cambios; el instructivo se mantiene).
- Spec **0037** — maquinaria Web Push (canal, suscripciones, VAPID, SW, manifest) que esta spec
  reencuadra en su uso.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/server/wallet/push-transports.ts` | editar — `deliverTransports(noticeClass)` + `consumerHasReachableWallet()` |
| `apps/merchant/src/server/wallet/push.ts` | editar — `Claim.class`, `claimRow` RETURNING, `deliverClaimed` pasa la clase |
| `apps/merchant/src/app/(consumer)/enroll/[programId]/page.tsx` | editar — pasa `vapidPublicKey` a `EnrollForm` |
| `apps/merchant/src/app/(consumer)/enroll/[programId]/enroll-form.tsx` | editar — `PushPrompt` para Android / `IosInstallHint` para iOS |
| `apps/merchant/src/server/push.test.ts` | editar — unit del ruteo por clase (con canales `fake`) |
| `apps/merchant/src/server/wallet-push-worker.neon.integration.test.ts` | editar — integración: transaccional con/ sin pase alcanzable |

### Disjunta?

**Sí.** No hay otra spec abierta en el INDEX (0037 quedó `implementada`). Sin colisión de archivos.

### Archivos compartidos

Ninguno que el orquestador deba dejar listo: `class`, `PushPrompt`, `IosInstallHint`,
`vapidFromEnv`, `walletPasses`, `walletPushDevices` y `web_push_subscription` ya existen.

## Definition of Done

- [ ] Una acreditación (`class='transactional'`) a un consumidor **con pase alcanzable** entrega
      **solo wallet** — cero llamadas al canal Web Push.
- [ ] Una acreditación a un consumidor **sin pase alcanzable** entrega **solo Web Push** (fallback)
      — cero llamadas al canal wallet.
- [ ] `consumerHasReachableWallet` devuelve `true` con device APNs de pase Apple **o** con pase
      Google; `false` cuando no hay ninguno.
- [ ] Nunca coexisten wallet y Web Push para un mismo aviso transaccional (no hay duplicado).
- [ ] El cooldown sigue contando **un** aviso por fila de cola (sin regresión del ADR 0038 §5).
- [ ] La confirmación del enroll en **iOS Safari** muestra el instructivo "añadir a inicio"
      (incluso con `vapidPublicKey` presente o null).
- [ ] La confirmación del enroll en **Android** muestra el botón "Activar notificaciones", que al
      tocarse pide permiso y crea la suscripción (`POST /api/public/push/subscribe` autorizado por
      la sesión del registro).
- [ ] `pnpm run typecheck` (3/3), `pnpm run lint`, `pnpm run test`, `pnpm run build` (3/3) verdes.

## Plan de pruebas y verificación

- [ ] **Unit** (`push.test.ts`, canales `fake`): con `noticeClass='transactional'` y wallet
      alcanzable → el `FakeWebPushChannel` no registra llamadas y el `FakePushChannel` sí; con
      wallet no alcanzable → al revés. Verifica también que `campaign` conserva el fan-out.
- [ ] **Unit**: `consumerHasReachableWallet` para los tres casos (device Apple / pase Google /
      ninguno).
- [ ] **Integración (Neon)** (`wallet-push-worker.neon.integration.test.ts`): sembrar un consumidor
      con pase+device Apple y otro sin ningún pase pero con `web_push_subscription`; encolar un
      transaccional a cada uno; drenar con el worker (canales `fake`); afirmar que el primero cerró
      con envío wallet y sin webpush, y el segundo con webpush y sin wallet. La fila cierra `sent`
      con un solo cooldown.
- [ ] **Regresión**: la suite Web Push existente (spec 0037) y la de wallet-push siguen verdes.
- [ ] **Comandos:** `pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run build`;
      integración Neon en rama efímera.
- [ ] **Verificación manual (owner):** en un iPhone con el pase agregado, acreditar → llega **una**
      sola notificación (la del pase), **no** dos. En un Android sin agregar el pase pero con el
      botón "Activar notificaciones" tocado en la confirmación, acreditar → llega la notificación
      de Web Push. En un Android con el pase agregado, acreditar → llega la del pase (banner de
      Google), sin Web Push.

## Handoff requerido

Implementador + revisor independiente con el formato de `docs/AGENT-WORKFLOW.md`. Foco del revisor:
que ningún aviso transaccional emita por dos transportes a la vez (el duplicado que originó la
spec), que la señal "wallet alcanzable" sea correcta (device APNs, no solo pase generado), que el
fallback dispare **solo** sin wallet, que el cooldown siga contando uno, y que la confirmación del
enroll muestre lo correcto por plataforma. Rama Neon efímera para la integración.

## Abierto

Nada bloqueante. (El ruteo definitivo de `campaign` es trabajo de la spec de campañas, fuera de
alcance por decisión del ADR 0040.)
