---
spec: 0051
fecha: 2026-09-05
estado: implementada
resumen: Restaura el flujo que el owner pidió y la 0050 rompió — la confirmación del enroll vuelve a mostrar la felicitación con el instructivo "Agregar a inicio" y el botón de Apple Wallet, y el ícono instalado AHÍ abre el wallet del consumidor. Implementa el ADR 0049 — el 201 del enroll devuelve `walletManifestPath` y la confirmación lo inyecta como `<link rel="manifest">`. El invariante de seguridad — el path viaja SOLO en el 201, la misma respuesta que ya setea la cookie de sesión.
disjunta: si
archivos: apps/merchant/src/app/api/public/enroll/[programId]/route.ts, server/consumer (helper del path), enroll/[programId]/enroll-form.tsx, server/enroll-install-hint.test.ts (se reescribe, autorizado), + tests
---

# 0051 — Instalar desde la confirmación del enroll

> Implementa el **ADR 0049**. Orden directa del owner tras el QA en vivo de la 0050: el
> flujo de instalar pasando por `/wallet` "está pésimo, MUY MAL". El flujo requerido:
> enrolarse → **una** pantalla con felicitación + instructivo + botón de Apple Wallet →
> agregar a inicio → el ícono abre **mi** wallet.

## Alcance

**Entra:**

1. **API del enroll**: el **201** suma `walletManifestPath:
   "/wallet/manifest.webmanifest?c=<token URL-encodeado>"`. Armado server-side con
   `account.webViewToken` (el de la base). **Ningún otro status lo incluye.**
2. **`enroll-form.tsx`, estado "done"**:
   - Inyecta `<link rel="manifest" href={walletManifestPath}>` en `document.head` (y lo
     remueve al desmontar). Antes del 201 la página sigue sin manifest.
   - **Restaura el bloque pre-0050**: `isIosSafariBrowser() ? <IosInstallHint/> :
     <PushPrompt/>` — el instructivo **directo** (desacoplado de VAPID, como era) para iOS,
     el push prompt para Android/desktop (spec 0038 intacta).
   - Conserva los `WalletButtons` y el link a `/wallet` como acción secundaria (vuelve a
     link de texto; el botón primario de la pantalla es la instalación).
3. **`server/enroll-install-hint.test.ts` se reescribe** — sus pins de "no hay
   `IosInstallHint` en el enroll" quedaron obsoletos por decisión explícita del owner
   (ADR 0049). Autorizado: no es maquillar un rojo, es un cambio de requisito documentado.

**No entra:**
- `/wallet` (su `generateMetadata`, su instructivo condicional): no se toca.
- La ruta del manifest (`?c=` + validación, spec 0050): no se toca — este flujo la consume.
- El plan B del ADR 0049 (confirmación server-renderizada): sólo si el QA muestra que
  Safari ignora el link inyectado.

## Criterios de aceptación (verificables)

- [ ] El **201** del enroll incluye `walletManifestPath` con el token del consumidor,
  URL-encodeado. **Test.**
- [ ] **Ningún camino de error** (body inválido, rate-limit, ya-miembro 409, programa
  inexistente) incluye `walletManifestPath`. **Test por caso** — es el invariante del
  ADR 0049: path solo donde ya hay sesión.
- [ ] La confirmación "done" inyecta el `<link rel="manifest">` con ese path, y la página
  del enroll **no** tiene manifest antes del 201. **Test** (estático o del componente).
- [ ] La confirmación vuelve a mostrar `IosInstallHint` **directo** en iOS Safari (sin
  depender de `vapidPublicKey`) y `PushPrompt` en el resto. **Test.**
- [ ] `GET /wallet/manifest.webmanifest?c=<ese token>` → `start_url = /c/<token>` (ya
  probado en la 0050; no romperlo).
- [ ] Los 5 gates verdes; el conteo de tests **no baja** de 325 descontando los que esta
  spec reescribe con autorización (declarar el neto en el handoff).
- [ ] **QA en vivo en iPhone real (owner):** enrolarse → en la MISMA pantalla ver
  felicitación + instructivo + Apple Wallet → agregar a inicio → abrir el ícono → **mi**
  wallet con sesión. Si el ícono abre el formulario, el link inyectado no fue honrado →
  se activa el plan B del ADR 0049.

## Pruebas

- **Unidad:** el helper que arma `walletManifestPath` (encoding, forma); el 201 lo incluye
  y los errores no; el barrido estático del enroll (invertido: el hint DEBE estar, y el
  manifest link también, condicionado al done).
- **Manual:** el QA de arriba. Es el único oráculo del link inyectado.

## Notas

- La tarea 38 (acoplamiento instructivo↔VAPID en `push-prompt.tsx`) queda **parcialmente
  resuelta** para el enroll (el hint vuelve directo); sigue abierta para `/wallet`.
- Sin migración, sin secreto nuevo, sin dependencia nueva.

## Resultado de la implementación (2026-09-05)

**PASS de revisor independiente a la primera.** Tests **325 → 340** (−6 autorizados por §3,
+21). Los 5 gates verdes. Sin migración, secreto ni dependencia nueva.

- **El invariante del ADR 0049 está blindado por mutación, no por lectura:** mutar la ruta
  para incluir el path en la rama `ConsumerError` pone **5 tests rojos**. Cada camino de
  error (400×2, 409, 404, 429, 503) asevera además que `issueSession` no fue llamado y que
  "manifest" no aparece en ningún campo del body.
- **El argumento "mismo destinatario, mismo poder" se sostiene concretamente:** el revisor
  verificó que la sesión del 201 es preexistente (el diff sólo suma el campo) y que esa
  sesión **ya podía leer el token** vía el HTML de `/wallet` (el `generateMetadata` de la
  0050). El 201 no amplía a quién se le entrega nada. El 409 de ya-miembro lanza en
  `enrollment.ts:163` antes de la sesión.
- **Encoding round-trip probado** con `+`, `=`, espacios, `&`, `#`, unicode; y la ruta del
  manifest hace eco del token ALMACENADO, nunca del query crudo.
- El barrido del enroll caza las **dos** ortografías JSX (mutación por cada una — lección
  de la 0040) y tiene pisos anti-barrido-vacío.
- Split por file-size: `enroll-form.tsx` 276 + `enroll-confirmation.tsx` 88.

**Criterio NO cerrado — QA en vivo en iPhone real (owner):** enrolarse → UNA pantalla con
felicitación + instructivo + Apple Wallet → agregar a inicio → el ícono abre MI wallet.
Único oráculo del `<link rel="manifest">` inyectado dinámicamente; si Safari lo ignora,
plan B del ADR 0049 (confirmación server-renderizada).
