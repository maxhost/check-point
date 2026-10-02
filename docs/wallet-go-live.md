# Wallet — checklist de go-live (demo → producción)

Runbook operativo del pase de Wallet (spec 0029 / ADR 0033; arte Google en spec 0122).

Estado conocido: Google funcionó en Android real bajo el issuer demo; Apple instaló en iPhone
real. La spec 0122 aporta los assets y el payload de «Trama viva» para Google. Su despliegue,
prueba en Android y actualización de la clase compartida deben verificarse por separado.

## Prerrequisito común: marca + arte final

La marca es CheckPass Club. Google usa el logo y hero de «Trama viva» de
`apps/consumer/public/`; Apple conserva su diseño actual hasta una spec propia. Google
revisa el branding para dar acceso de publicación.

⚠️ **URL del logo estable:** el `programLogo`/imágenes deben servirse desde un **dominio
definitivo**, no un dominio de deploy efímero (`*-pied.vercel.app`), para que no se rompan
al cambiar de deploy.

## Google Wallet — go-live

**Costo: $0.** La Google Wallet API es gratis (sin fee por pase, actualización, ni cuota
anual).

- [ ] **Business Profile completo** en el Google Pay & Wallet Console.
- [ ] **≥1 Passes Class creada** → ✅ hecho (`<issuerId>.mipasaporte_identity`, `approved`;
      se crea/actualiza con `scripts/google-wallet/provision-class.mjs`).
- [ ] **Assets Trama viva desplegados** desde `my.checkpass.club`: comprobar `GET` 200,
      `Content-Type: image/png` y dimensiones de `/wallet-logo-trama-v1.png` (660 × 660)
      y `/wallet-trama-hero-v1.png` (1032 × 812) sin sesión.
- [ ] **Clase de QA aislada:** usar un sufijo propio, como `--class-suffix qa_trama_viva`,
      con cuenta/objeto de prueba. Tras el deploy de los PNG, ejecutar el provisionador
      con `--apply`; inspeccionar con `--inspect` y validar lista, pase abierto, QR y enlace
      en Android. El script no modifica ninguna clase si no se le pasa `--apply`.
- [ ] **Clase real:** guardar antes una salida de `--inspect` sin credenciales; ejecutar
      `--apply` sin `--class-suffix` solo después de aprobar el QA. El script hace `GET`,
      calcula un `PATCH` de presentación que conserva los demás campos y omite la escritura
      si ya coincide. Volver a inspeccionar `reviewStatus` y comprobar un pase ya guardado.
- [ ] **Screenshots del pase** listos para adjuntar.
- [ ] **Secretos en Vercel (Production):** `GOOGLE_WALLET_ISSUER_ID` +
      `GOOGLE_WALLET_SA_JSON` (JSON **crudo**, no base64) → ✅ cargados para el QA demo.
- [ ] **Request publishing access:** Console → **Google Wallet API → Request publishing
      access** → enviar. Revisión de Google **~2 días hábiles**; avisan por email.
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
- [ ] Arte final del pase (logo/icon, colores, opcional `strip`) — tarea futura de diseño.

No hay trabajo de código: `apps/merchant/src/server/wallet/apple.ts` ya construye y firma el
`.pkpass`; solo cambia el firmante según los secretos. El **canal de push/actualización**
del pase (web service PassKit + APNs) es aparte: **spec 0033**.

## Resumen de costos

| Plataforma | Costo | Gate para producción |
|---|---|---|
| Google Wallet | **$0** | Request publishing access (~2 días) |
| Apple Wallet | **$99/año** | Alta Apple Developer + cert Pass Type ID |
