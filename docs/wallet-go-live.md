# Wallet — checklist de go-live (demo → producción)

Runbook operativo del pase de Wallet (spec 0029 / ADR 0033). El **código ya está
implementado y no cambia entre demo y producción**: ir a prod es puramente trámite de
cuenta + secretos + arte final. Nada acá bloquea el código; son pasos del owner.

Estado al 2026-08-14: **ambos pases funcionando en producción sobre el deploy.** Google en
**demo** (QA en Android real OK; falta publishing access para salir de demo). Apple **integrado
con cert real** y verificado en **iPhone real** (cuenta Developer personal; pendiente el pasaje
a organización). Falta el diseño/arte final de los dos y el canal de push (spec 0033).

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

**Hecho 2026-08-14** (cuenta personal, verificado en iPhone real):
- [x] **Alta Apple Developer Program** ($99/año) — cuenta personal (pasaje a org solicitado).
- [x] **Pass Type ID** creado: `pass.com.checkpass.identity`.
- [x] **Certificado** generado (CSR con openssl) → `.p12` (con `-legacy` para node-forge).
- [x] **WWDR G4** descargado (emisor del cert).
- [x] **Team ID** `SN489AVGUD` + **Pass Type ID** anotados.
- [x] **Secretos en Vercel (Production):** `APPLE_PASS_CERT_P12`, `APPLE_WWDR_CERT`,
      `APPLE_TEAM_ID`, `APPLE_PASS_TYPE_ID`, `APPLE_PASS_CERT_PASSWORD` cargados.
- [x] Provider usando `certSigner` (firma real) → `.pkpass` **instala en iPhone real**.

Pendiente:
- [ ] **Pasaje cuenta personal → organización:** al aprobarse, **regenerar** Pass Type ID +
      cert bajo el nuevo Team ID y actualizar los 5 secretos (mismo proceso). Material de firma
      local vive en `.secrets-apple/` (gitignoreado + pre-commit hook).
- [ ] Arte final del pase (logo/icon, colores, opcional `strip`) — tarea futura de diseño.

No hay trabajo de código: `apps/merchant/src/server/wallet/apple.ts` ya construye y firma el
`.pkpass`; solo cambia el firmante según los secretos. El **canal de push/actualización**
del pase (web service PassKit + APNs) es aparte: **spec 0033**.

## Resumen de costos

| Plataforma | Costo | Gate para producción |
|---|---|---|
| Google Wallet | **$0** | Request publishing access (~2 días) |
| Apple Wallet | **$99/año** | Alta Apple Developer + cert Pass Type ID |
