# Wallet — checklist de go-live (demo → producción)

Runbook operativo del pase de Wallet (spec 0029 / ADR 0033). El **código ya está
implementado y no cambia entre demo y producción**: ir a prod es puramente trámite de
cuenta + secretos + arte final. Nada acá bloquea el código; son pasos del owner.

Estado al 2026-08-14: **Google en demo, funcionando end-to-end** (QA en Android real OK).
Apple: builder verificado con firma self-signed; **sin integrar en iPhone real** (falta el
alta de pago).

## Prerrequisito común: marca + arte final

Antes de publicar cualquiera de los dos, definir el **rebrand** (¿"Mi Pasaporte" o
**CheckPass**?) y generar el **arte final**: logo definitivo, colores de marca y —opcional—
banner (`heroImage` en Google / `strip` en Apple). Google **revisa el branding** al dar
publishing access, así que conviene tener el arte listo para no repetir el trámite. Ver la
constante `WALLET_BRAND` en `apps/merchant/src/server/wallet/core.ts` y el logo en
`apps/merchant/public/wallet-logo.png` (hoy placeholder).

⚠️ **URL del logo estable:** el `programLogo`/imágenes deben servirse desde un **dominio
definitivo**, no un dominio de deploy efímero (`*-pied.vercel.app`), para que no se rompan
al cambiar de deploy.

## Google Wallet — go-live

**Costo: $0.** La Google Wallet API es gratis (sin fee por pase, actualización, ni cuota
anual).

- [ ] **Business Profile completo** en el Google Pay & Wallet Console.
- [ ] **≥1 Passes Class creada** → ✅ hecho (`<issuerId>.mipasaporte_identity`, `approved`;
      se crea/actualiza con `scripts/google-wallet/provision-class.mjs`).
- [ ] **Arte final** cargado (logo + colores; opcional hero banner) y servido desde dominio
      estable.
- [ ] **Screenshots del pase** listos para adjuntar.
- [ ] **Secretos en Vercel (Production):** `GOOGLE_WALLET_ISSUER_ID` +
      `GOOGLE_WALLET_SA_JSON` (JSON **crudo**, no base64) → ✅ cargados para el QA demo.
- [ ] **Request publishing access:** Console → **Google Wallet API → Request publishing
      access** → enviar. Revisión de Google **~2 días hábiles**; avisan por email.
- [ ] Post-aprobación: cualquier usuario (no solo test accounts) puede guardar el pase.

Notas de infra ya resueltas: la SA **no puede** tener key descargable bajo la org GCP
(`iam.disableServiceAccountKeyCreation`); se usó un proyecto bajo **cuenta Gmail personal
sin org**. Para prod "enterprise" sin key estática, el camino es **Workload Identity
Federation + `signJwt`** (cambio de código → ADR+spec). Ver memoria del proyecto.

## Apple Wallet — go-live

**Costo: $99/año** (Apple Developer Program). Es el único gate; no hay "review" de branding
como en Google — con el certificado, el `.pkpass` instala en cualquier iPhone.

- [ ] **Alta Apple Developer Program** ($99/año).
- [ ] Crear un **Pass Type ID** en el portal de Apple Developer.
- [ ] Generar el **certificado** del Pass Type ID → exportar como **`.p12`**.
- [ ] Descargar el **cert intermedio WWDR** de Apple.
- [ ] Anotar **Team ID** y **Pass Type ID**.
- [ ] **Secretos en Vercel (Production):** `APPLE_PASS_CERT_P12` (base64 del `.p12`),
      `APPLE_WWDR_CERT` (base64), `APPLE_TEAM_ID`, `APPLE_PASS_TYPE_ID`, y
      `APPLE_PASS_CERT_PASSWORD` si el `.p12` tiene clave.
- [ ] Con esos secretos presentes en prod, el provider usa `certSigner` (firma real) en vez
      de `selfSignedSigner` → el pase deja de dar 503 y se instala en iPhone real.
- [ ] Arte final del pase (logo/icon, colores, opcional `strip`).

No hay trabajo de código: `apps/merchant/src/server/wallet/apple.ts` ya construye y firma el
`.pkpass`; solo cambia el firmante según los secretos. El **canal de push/actualización**
del pase (web service PassKit + APNs) es aparte: **spec 0033**.

## Resumen de costos

| Plataforma | Costo | Gate para producción |
|---|---|---|
| Google Wallet | **$0** | Request publishing access (~2 días) |
| Apple Wallet | **$99/año** | Alta Apple Developer + cert Pass Type ID |
