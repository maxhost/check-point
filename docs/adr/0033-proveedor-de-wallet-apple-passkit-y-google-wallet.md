---
fecha: 2026-08-14
resumen: Mi Pasaporte emite UN pase de identidad por consumidor (branded Mi Pasaporte, no por negocio) en Apple Wallet (iOS, PassKit) y Google Wallet (Android), como emisor único; el barcode lleva el `qr_token` global de la 0028 y el comercio resuelve la ambigüedad al escanear; el pase es casi estático (sin progreso por-programa) y enlaza a un dashboard web "Ver mis programas" vía un token dedicado revocable; se desarrolla y verifica sin pagar Apple usando un `WalletProvider` intercambiable con firma self-signed en tests y el issuer gratuito de Google; el canal de actualización/push se separa a su propia spec.
estado: aceptada; consume 0014 (QR opaco al portador) y 0024 (secretos en entorno); habilita specs 0029/0033 y reencuadra el push de 0031
---

# ADR 0033 — Proveedor de Wallet: Apple PassKit + Google Wallet, pase de identidad único

## Contexto

El ADR 0031 fijó la **Wallet nativa como superficie de consumidor** del modelo
merchant-first. La spec 0028 ya emite el `qr_token` personal (opaco, al portador, revocable,
sin PII — ADR 0014) pero no lo renderiza ni lo hace portable. La spec 0029 tiene que
generar el pase, ofrecer "Añadir a Apple/Google Wallet" según el dispositivo y dejar abierto
el canal de actualización. Falta decidir el **proveedor y la forma del pase**: es una
decisión de infra transversal, previa a cerrar la 0029.

Hechos del entorno (relevantes a la decisión):
- Los dos ecosistemas son **asimétricos**. Apple entrega un `.pkpass` (zip firmado con
  PKCS#7) que requiere un **Pass Type ID + certificado** de una membresía **Apple Developer
  de pago ($99/año)**, más el cert intermedio WWDR y el Team ID; sus actualizaciones van por
  un **web service REST propio + APNs**. Google define una *Loyalty Class/Object* vía REST y
  "Añadir a Google Wallet" es un **JWT firmado**; requiere un Google Cloud project + service
  account + issuer en la Wallet Business Console, todo **gratuito** (arranca en modo demo), y
  se actualiza con un `PATCH` al objeto, **sin registro de dispositivos**.
- Toda la infra (Neon, Drizzle, R2, crons, rutas) vive en `apps/merchant` (ADR 0032). Los
  secretos van en entorno (ADR 0024); Vercel corre Node (no solo Edge), donde la firma
  PKCS#7 es viable.
- Decisión de producto del owner (2026-08-14): Marcos ve **una sola tarjeta "Mi Pasaporte"**
  en su Wallet, no una por comercio. El comercio resuelve a qué programa aplica **al
  escanear**. Esto habilita un efecto de red: un comercio nuevo puede dar de alta a Marcos
  escaneando su credencial existente, sin re-registro (auto-enrolamiento; se implementa en la
  spec 0030).

## Decisión

1. **Ambos proveedores, seleccionados por dispositivo, con Mi Pasaporte como emisor único.**
   iOS → Apple Wallet (PassKit); Android → Google Wallet. Un solo Pass Type ID de Apple y un
   solo issuer de Google, propiedad de Mi Pasaporte. Los comercios **no** tienen cuenta
   Apple/Google; su identidad no participa de la firma. La landing muestra ambos botones con
   detección por user-agent y **fallback a mostrar los dos** (nunca ocultar por detección
   fallida).

2. **UN pase de identidad por consumidor, branded "Mi Pasaporte", no por negocio.** El
   **barcode lleva el `qr_token` global** de la 0028 (una identidad para siempre, en todos los
   programas). La desambiguación —a qué programa/comercio aplica un escaneo— la da **el negocio
   que escanea**, no el token (se implementa en la spec 0030). Consecuencia buscada: el
   auto-enrolamiento entre comercios (escanear = alta + consentimiento a notificar, en un solo
   gesto) y cero fricción para el consumidor.

3. **El pase es casi estático: no muestra progreso por-programa.** En vez de campos de
   puntos/sellos (que en un pase único y compartido no tienen dónde caber sin mezclar
   comercios), el pase lleva un **enlace "Ver mis programas"** hacia un **dashboard web de
   consumidor** donde cada programa se ve por separado (con su `CardPreview` de la 0027, su
   progreso y sus términos). El branding por-negocio, entonces, vive en la web, no en la
   Wallet.
   - El enlace se autoriza con un **token dedicado, opaco y revocable** (`web_view_token`,
     nuevo en `consumer_account`), **distinto del `qr_token`**: así se puede revocar "ver mis
     programas" y "que me escaneen" por separado. Funciona como magic-link (abre sesión de
     consumidor al visitarlo). El pase es al portador, coherente con ADR 0014: quien tiene el
     teléfono desbloqueado de Marcos ya es Marcos.

4. **Ciclo de vida = identidad, no programa.** Como el pase representa la **identidad** (no un
   programa), **no expira** por cierre/cambio de programa; persiste mientras exista la cuenta.
   La única invalidación es por **pérdida de dispositivo** (rotar `qr_token`/`web_view_token` +
   empujar la actualización del pase), que es un concern del **canal de push (spec 0033)**. Esto
   disuelve la pregunta original de "actualizar/eliminar el pase cuando cambia el programa": con
   un pase único de identidad, no aplica.

5. **Notificaciones scopeadas por destinatario, no por pase.** Un push de "promo para
   miembros de Bar B" se dirige al **conjunto de consumidores miembros de Bar B**, calculado
   server-side desde `program_membership`; el pase compartido no filtra la promo a
   no-miembros. Un consumidor que no es miembro de un negocio **no** es alcanzable por ese
   negocio hasta que lo escanean (auto-enrolamiento). El aislamiento del ADR 0031 (membresías
   aisladas) se hereda en las notificaciones. La mecánica concreta (Apple: campo + APNs pull;
   Google: `addMessage`) la resuelve la spec 0033.

6. **`WalletProvider` intercambiable + desarrollo sin pagar Apple.** Se define una interfaz
   agnóstica de proveedor (misma filosofía que `OtpChannel` de la 0032): `apple` (construye y
   firma el `.pkpass`), `google` (arma el JWT/URL de guardado) y `console`/`fake` para
   dev/test. Consecuencia clave: **la 0029 se implementa y verifica hoy sin la membresía
   Apple** — el builder del `.pkpass` se testea con un **certificado self-signed** (valida
   estructura, `manifest`, hashes y zip; solo el install en un iPhone real necesita el cert de
   pago) y el issuer de Google es **gratuito** (modo demo, verificable end-to-end en Android).
   El único residual queda el install en iOS real, que difiere el $99 hasta el QA en iPhone.

7. **Secretos en entorno (ADR 0024), como base64.** Apple: certificado del Pass Type ID
   (`.p12`/clave), cert WWDR, Team ID, Pass Type ID. Google: service-account JSON, Issuer ID.
   Las credenciales de **APNs** (auth key `.p8`) se suman con el **canal de push (spec 0033)**,
   no en la 0029. Todos se cargan en Vercel; la firma corre en el runtime Node (no Edge).

8. **El canal de actualización/push se separa a su propia spec (0033).** El web service REST
   de PassKit (registro de dispositivos, tokens APNs, servir el pase actualizado) y el `PATCH`
   de Google son suficiente trabajo production-grade para una spec dedicada. La **0029 emite el
   pase ya con los ganchos** (`webServiceURL` + `authenticationToken` provisionados) para no
   re-emitir después; el servicio que responde a esos ganchos es la 0033. La 0031 consume el
   canal.

## Consecuencias

- **La spec 0029** implementa este ADR: emitir el pase de identidad único (Apple self-signed /
  Google real), render del QR, botones "Añadir a Wallet", el `web_view_token` + una ruta
  mínima "Ver mis programas", y el registro `wallet_pass`. No implementa push (0033) ni el
  dashboard rico (0031).
- **La spec 0030** (acreditación en mostrador) recibe dos decisiones derivadas: la
  **resolución del `qr_token` → identidad, desambiguada por el negocio que escanea**, y el
  **auto-enrolamiento por escaneo** (crear la membresía on-the-fly para un consumidor que ya
  existe pero no es miembro de ese negocio). Matiz de consentimiento: los términos del programa
  quedan siempre accesibles en "Ver mis programas".
- **La spec 0031** (notificación + landing en vivo) hereda el dashboard "Ver mis programas"
  como su superficie web rica, y la mecánica de push scopeada por destinatario.
- **La spec 0033** (nueva) es el canal de actualización/push: web service PassKit + APNs +
  registro de dispositivos + `PATCH`/`addMessage` de Google + rotación/revocación del pase.
- **Cuentas a dar de alta (bloqueo externo, del owner):** Apple Developer ($99/año, solo para
  el install en iOS real) y Google Cloud + Wallet API + issuer (gratis). El desarrollo no se
  bloquea a la espera de ninguna.
- **Migración aditiva** (0016): tabla `consumer.wallet_pass` + columna `web_view_token` en
  `consumer_account`; no toca `core` ni `merchant_auth`.
- **Dependencia de paquete nuevo** (render del QR y/o firma PKCS#7): re-warmear el store de
  pnpm (`pnpm fetch`) en una terminal con red antes de la sesión de implementación bajo codex
  (ver CLAUDE.md / gotcha del store offline).
