# Wallet — checklist de go-live (demo → producción)

Runbook operativo del pase de Wallet (spec 0029 / ADR 0033; arte Google en spec 0122 y
arte Apple en spec 0123). Guías de diseño y publicación: [Google](wallet/google-wallet-design-and-release.md)
y [Apple](wallet/apple-wallet-design-and-release.md).

Estado conocido: Google funcionó en Android real bajo el issuer demo; Apple instaló en iPhone
real. La spec 0122 aporta los assets y el payload de «Trama viva» para Google. Los PNG,
el QA visual en Android y el `PATCH` de la clase real están verificados. Falta comprobar
acceso de publicación del emisor y QR/enlace reales en un pase viejo y otro nuevo.

## Prerrequisito común: marca + arte final

La marca es CheckPass Club. Google usa el logo y hero de «Trama viva» de
`apps/consumer/public/`. El arte Apple de la [spec 0123](specs/0123-pase-apple-wallet-trama-viva.md)
está implementado localmente; producción conserva el diseño anterior hasta el QA
de iPhone y el despliegue. Google revisa el branding para dar acceso de publicación.

⚠️ **URL del logo estable:** el `programLogo`/imágenes deben servirse desde un **dominio
definitivo**, no un dominio de deploy efímero (`*-pied.vercel.app`), para que no se rompan
al cambiar de deploy.

## Google Wallet — go-live

**Costo: $0.** La Google Wallet API es gratis (sin fee por pase, actualización, ni cuota
anual).

- [ ] **Business Profile completo** en el Google Pay & Wallet Console; confirmar estado allí.
- [x] **≥1 Passes Class creada** (`<issuerId>.mipasaporte_identity`, `approved`;
      se crea/actualiza con `scripts/google-wallet/provision-class.mjs`).
- [x] **Assets Trama viva desplegados** desde `my.checkpass.club`: `GET` 200,
      `Content-Type: image/png` y dimensiones de `/wallet-logo-trama-v1.png` (660 × 660)
      y `/wallet-trama-hero-v1.png` (1032 × 812) sin sesión; SHA-256 remoto coincide con el commit.
- [x] **Clase de QA aislada y diseño visual aprobado:** `qa_trama_viva_0122` creada; el
      owner guardó el pase ficticio en Android y aprobó su aspecto. Su QR no acredita y
      no verifica el funcionamiento del mostrador.
- [x] **Clase real actualizada:** `--inspect` previo, `--apply` sin `--class-suffix` y
      `--inspect` posterior el 2026-10-01. Google devolvió `reviewStatus=approved` y
      la lectura confirmó logo/hero Trama viva, emisor, color, etiqueta y plantilla.
      La propagación al teléfono de un miembro real aún debe verificarse.
- [ ] **Screenshots del pase** disponibles si Google los solicita; la documentación
      actual de Google ya no los exige para enviar la solicitud de acceso de publicación.
- [ ] **Secretos en Vercel (Production):** `GOOGLE_WALLET_ISSUER_ID` +
      `GOOGLE_WALLET_SA_JSON` (JSON **crudo**, no base64) → ✅ cargados para el QA demo.
- [ ] **Acceso de publicación para cualquier usuario:** confirmar en Console si ya fue
      concedido. Si sigue en modo demo: Console → **Google Wallet API → Request publishing
      access** y esperar la revisión de Google. Una clase `approved` no prueba este acceso.
- [ ] Post-aprobación: cualquier usuario (no solo test accounts) puede guardar el pase.

Ejemplo de comandos (las credenciales se pasan por variables de entorno o archivo local
fuera del repositorio; no se imprimen ni se incluyen en capturas):

```sh
node scripts/google-wallet/provision-class.mjs --inspect
node scripts/google-wallet/provision-class.mjs --class-suffix qa_trama_viva --apply
node scripts/google-wallet/provision-class.mjs --class-suffix qa_trama_viva --inspect
node scripts/google-wallet/provision-class.mjs --apply
node scripts/google-wallet/provision-class.mjs --inspect
```

Si el render o la revisión de Google falla, restaurar por `PATCH` los campos de presentación
de la salida anterior, sin reemplazar callbacks, objetos o ubicaciones. No cambiar el ID
`mipasaporte_identity`: los pases existentes lo usan. Un cambio de clase puede requerir
`UNDER_REVIEW`; comprobar el estado final antes de dar por terminada la publicación.

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
- [x] Arte final del pase (logo/icon, colores, `strip`) — [spec 0123](specs/0123-pase-apple-wallet-trama-viva.md) aprobada e implementada localmente.
- [ ] Validar la presencia del `strip` en iOS reciente antes de publicar; después probar un pase nuevo y el refresco de uno instalado.
- [ ] Verificar en iPhone que el cambio de nombre «Mi CheckPass» → «CheckPass Club»
      llega a un pase ya instalado tras el despliegue y un push PassKit vacío.

El constructor en `packages/domain/src/server/wallet/apple.ts` arma y firma el
`.pkpass` con el arte de la spec 0123 en el código local. Seguir la
[guía Apple de diseño y publicación](wallet/apple-wallet-design-and-release.md): el
QA del `strip` en iPhone y el refresco de pases existentes siguen pendientes. El
**canal de push/actualización** del pase (web service PassKit + APNs) se definió en
la **spec 0033**.

## Resumen de costos

| Plataforma | Costo | Gate para producción |
|---|---|---|
| Google Wallet | **$0** | Request publishing access (~2 días) |
| Apple Wallet | **$99/año** | Alta Apple Developer + cert Pass Type ID |
