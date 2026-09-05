---
spec: 0050
fecha: 2026-09-05
estado: implementada
resumen: El ícono de inicio instalado desde iOS abre el wallet del consumidor y no el formulario de registro. Tras enrolarse el usuario va a `/wallet` (vía `/c/<token>`, que abre sesión) en lugar de que se le pida instalar en la confirmación del enroll; el instructivo iOS ya vive en `/wallet` y ya se oculta en standalone. Implementa el ADR 0048: el manifest recibe el token por su URL (`?c=`) porque el `<link rel="manifest">` se pide sin cookies.
disjunta: si
archivos: apps/merchant/src/app/(consumer)/wallet/page.tsx (generateMetadata), wallet/manifest.webmanifest/route.ts, enroll/[programId]/enroll-form.tsx, + tests
---

# 0050 — El ícono instalado abre el wallet del consumidor

> Implementa el **ADR 0048** (el manifest recibe el token por su URL). Nace del QA en vivo
> del owner (2026-09-05, tarea 37): instalar "Agregar a inicio" siguiendo el instructivo de
> la confirmación del enroll y tocar el ícono **caía en el formulario de registro**.

## Problema

Dos fallas apiladas, y la de arriba tapaba la de abajo:

1. **La página del enroll no enlaza el manifest.** `(consumer)/enroll/[programId]/page.tsx`
   sólo declara `export const dynamic`; el único lugar que declara `manifest` es
   `(consumer)/wallet/page.tsx`. Sin manifest enlazado, iOS usa **la URL actual** como
   `start_url` del ícono — y el instructivo se renderiza justo ahí
   (`enroll-form.tsx:124`). De ahí el síntoma.

2. **El manifest nunca recibe la sesión.** Un `<link rel="manifest">` se pide sin
   credenciales salvo `crossorigin="use-credentials"`, que producción no tiene. Así que
   `start_url` cae a `/wallet` siempre y el re-bootstrap por `/c/<token>` **nunca
   funcionó** (ADR 0048). Arreglar sólo (1) habría dejado el ícono abriendo `/wallet` sin
   sesión: mejor que el formulario, pero todavía mal.

## Lo que YA está bien y no se toca

Verificado en código antes de especificar:

- **El instructivo iOS ya vive en `/wallet`** y ya es condicional:
  `wallet/qr-tab.tsx` → `PushPrompt` → `isIos && !isStandalone` → `IosInstallHint`.
- **`isIosSafariBrowser()`** (`ios-install-hint.tsx:174`) ya detecta standalone por las dos
  vías: `matchMedia("(display-mode: standalone)")` y `navigator.standalone`.

O sea: **en el navegador ve el instructivo, instalado ve su wallet normal**. Ese
comportamiento ya existe y esta spec no lo reescribe — lo aprovecha.

## Alcance

**Entra:**
- `generateMetadata()` en `/wallet` que resuelve la sesión y emite
  `manifest: "/wallet/manifest.webmanifest?c=<webViewToken>"` (o sin `?c=` si no hay sesión).
- La ruta del manifest lee `?c=`, **valida que el token resuelva** y arma `start_url`.
  Token ausente/inválido/revocado → `/wallet`.
- **Quitar el `IosInstallHint` de la confirmación del enroll** y reemplazarlo por una
  acción que lleve al usuario a su wallet (`/c/<token>` → `/wallet`), donde el instructivo
  ya lo espera.

**No entra:**
- Rediseñar `/wallet`, el `PushPrompt` ni el instructivo en sí.
- Tocar el opt-in de Web Push de Android (spec 0038): ese botón vive en la confirmación y
  **se queda**, porque en Android no hay que instalar nada para que el push funcione.
- `crossorigin="use-credentials"` (descartado en el ADR 0048).
- Rotación de token (spec 0032): sigue funcionando igual; un token muerto degrada a `/wallet`.

## Decisiones cerradas

### 1. El token viaja por la URL del manifest
Del ADR 0048. Determinista, sin depender de que Safari mande cookies. No abre amenaza
nueva: el `web_view_token` ya es at-bearer (ADR 0014) y ya viaja en URLs.

### 2. `id` del manifest se mantiene en `/wallet`
Para que la identidad del PWA no se fragmente por consumidor ni cambie al rotar el token.

### 3. Tras enrolarse, el usuario va a su wallet
La confirmación deja de ser el lugar donde se instala. Es lo que arregla el síntoma de
raíz: si nadie instala desde el enroll, iOS nunca captura esa URL.

## Criterios de aceptación (verificables)

- [ ] `/wallet` con sesión emite `<link rel="manifest" href="/wallet/manifest.webmanifest?c=…">`
  con el token del consumidor. Sin sesión, sin `?c=`. **Test.**
- [ ] `GET /wallet/manifest.webmanifest?c=<token válido>` → `start_url` es `/c/<token>`.
  Con token inválido, revocado o ausente → `start_url` es `/wallet`. **Test por caso.**
- [ ] El manifest **no** confía en la cookie para el token (se puede pedir sin cookies y
  seguir devolviendo el `start_url` correcto). **Test.**
- [ ] La confirmación del enroll **ya no renderiza `IosInstallHint`** y ofrece la acción que
  lleva al wallet. **Test** de que el componente no aparece en ese camino.
- [ ] El botón de push de Android en la confirmación **sigue estando** (no romper 0038). **Test.**
- [ ] `id` del manifest sigue siendo `/wallet` en todos los casos. **Test.**
- [ ] Los 5 gates verdes y el conteo de tests **no baja**.
- [ ] **QA en vivo en iPhone real:** enrolarse, llegar al wallet, agregar a inicio desde ahí,
  abrir el ícono → **ver el wallet con sesión**, no el formulario ni una pantalla anónima.
  Y en standalone **no** debe aparecer el instructivo.

## Pruebas

- **Unidad:** el `start_url` por cada caso de token (válido / inválido / revocado / ausente);
  `id` estable; que la ruta no lea la cookie para el token.
- **Integración:** `/wallet` con sesión real emite el link con `?c=`; sin sesión no.
- **Manual (la que decide):** el QA en iPhone real de arriba. Ningún test local prueba que
  Safari honre `start_url` al agregar a inicio.

## Notas

- Si el QA muestra que Safari **ignora** `start_url` y usa la URL actual, el ícono abrirá
  `/wallet` — correcto igual, sólo sin re-bootstrap de sesión. Es degradación aceptable
  (ADR 0048), no motivo de FAIL de esta spec.
- Sin migración, sin secreto nuevo, sin dependencia nueva.

## Resultado de la implementación (2026-09-05)

**PASS de revisor independiente a la primera.** Tests **310 → 325**, los 5 gates verdes,
sin migración ni secreto ni dependencia nueva.

### Lo verificado que más importa

- **El corazón del ADR 0048 está probado, no leído:** el test construye un `NextRequest`
  real, asevera `headers.get("cookie") === null`, y el mock de `next/headers` **tira** si
  alguien llama `cookies()`. Contra el código viejo explota con
  `Error: next/headers cookies() must not be read here` — es un oráculo, no una lectura.
- **Sin inyección ni open-redirect:** `start_url` se arma con `account.webViewToken` (el de
  la base), nunca con el crudo de la query. El revisor lo probó con 12 payloads hostiles
  (`https://evil.tld`, `//evil.tld`, `%00`, `../../`, `javascript:`, `?c=` repetido, 20 KB):
  14/14 → `start_url === "/wallet"`, cero reflejo. Refuerzo estructural: los tokens se
  generan con `randomBytes(32).toString("base64url")`, así que el alfabeto guardado no puede
  contener `"`, `\`, `/`, `.` ni `%`.
- **La premisa del ADR 0048 confirmada en el fuente de Next 16.3.0**
  (`lib/metadata/metadata.js:291-297`): `crossOrigin: "use-credentials"` se agrega **sólo**
  con `VERCEL_ENV === 'preview'`; en producción es `undefined`.
- **11 de los 15 tests nuevos se ponen rojos contra `HEAD`** (los 9 del manifest, 2 del
  enroll). Los otros 4 son guards de comportamiento preexistente y están declarados como
  tales, no como cobertura del cambio.

### La trampa que cazó el implementador

Dejar el `PushPrompt` renderizándose en iOS habría **reintroducido el instructivo por la
puerta de atrás**: `push-prompt.tsx:121` devuelve `<IosInstallHint/>` cuando
`isIos && !isStandalone`. Se cortocircuitó (`isIosSafariBrowser() ? null : <PushPrompt/>`)
y quedó pinneado. No rompe iOS standalone: ahí `isIosSafariBrowser()` es `false`, así que el
`PushPrompt` sí se renderiza y ofrece el permiso.

### Por qué el CTA va a `/wallet` a secas

`consumerAccountResponse` es un allow-list explícito sin `webViewToken`. Devolverlo para
armar `/c/<token>` habría cambiado el contrato de la API **y** metido un token at-bearer en
un JSON de respuesta, contra la regla de DTOs de `CLAUDE.md`. El link directo funciona
porque el POST del enroll ya setea `SESSION_COOKIE`.

### Criterio NO cerrado

- **QA en vivo en iPhone real** — del owner. Ningún test local prueba que Safari honre
  `start_url` al "Agregar a inicio". Si lo ignorara, degrada a `/wallet`: aceptable por el
  ADR 0048, no un fallo.

### Seguimiento abierto (tarea 38, no entra acá)

- **El instructivo iOS quedó acoplado a que VAPID esté configurado.** `push-prompt.tsx:82`
  hace `if (!vapidPublicKey) return null` **antes** del check de iOS. El código borrado del
  enroll lo renderizaba directo y su comentario declaraba ese desacople a propósito. Hoy no
  muerde (VAPID está en prod desde la 0037), pero es una dependencia nueva no declarada.
- **Falta un guard de que la página del enroll siga sin enlazar el manifest** — el ADR 0048
  dice que no debe hacerlo, y hoy nada lo pinnea.
