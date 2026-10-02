# Handoff — Apple Wallet → diseño del pase en la PWA

Fecha: 2026-10-02. Documento de retorno después de `/clear`.

## Pedido actual del owner

El owner quiere diseñar **una versión de Trama viva para el pase que ve el consumidor
dentro de `my.checkpass.club`**, en su propia cuenta/PWA. Le gustó el pase de Google
Wallet ya aprobado en Android y quiere llevar ese lenguaje a la vista que incluye
el QR. En la PWA podemos controlar composición, movimiento, texto y estados con
CSS/HTML, pero el QR debe seguir siendo fácil de escanear. **Primero explorar y
acordar el diseño; después cerrar una spec y pasar a implementación.** No hay
decisión de aspecto de PWA aprobada todavía.

La frase del owner: «me gustaría que el pase que está dentro de my.checkpass.club,
es decir el “pase” que ve el consumidor dentro de su propia cuenta de CheckPass,
tenga una versión del diseño que aplicamos para Google Wallet Pase, porque es
hermoso… Si incluye el QR, lo podemos mostrar como pase dentro de nuestra PWA
porque allí podemos manejar como queramos el estilo del pase».

## Estado de Wallet al cerrar este contexto

- **Google:** spec 0122 Trama viva aprobada; PNG públicos, clase real actualizada y
  `reviewStatus=approved`; owner aprobó el aspecto en Android. Siguen pendientes
  acceso de publicación general, QA funcional de pase viejo/nuevo y PASS
  independiente. [Spec](specs/0122-pase-google-wallet-trama-viva.md),
  [guía](wallet/google-wallet-design-and-release.md).
- **Apple:** spec 0123 cerrada y diseño «iPhone · strip visible» aprobado. Código,
  PNG embebidos y revisión PassKit en el commit `0790956`, pusheado a `main`.
  Pruebas locales Wallet 7/7, typecheck 6/6, lint y build pasaron. La
  [investigación y runbook](wallet/apple-wallet-update-existing-passes.md) están
  en el commit `5777c59`, también pusheado a `main`. **No se ha verificado el
  despliegue ni el render en iPhone; no se ha enviado un `pass_refresh` de diseño**
  a los pases instalados. [Handoff técnico](handoff-0123-apple-wallet-trama-viva-2026-10-02.md),
  [reglas de diseño](wallet/apple-wallet-design-rules.md).
- **Pases Apple viejos:** el flujo normal requiere dispositivo registrado, APNs
  configurado en el worker de `apps/merchant`, aviso vacío y descarga del nuevo
  `.pkpass` desde `apps/consumer`. Las filas históricas que guardan solo
  `auth_token_hash` se excluyen del lote automático porque el token original no
  puede regenerarse. Todo está explicado con consultas y QA en la guía Apple.

## Punto de partida en `my.checkpass.club`

- Ruta de cuenta: `apps/consumer/src/app/(consumer)/wallet/page.tsx`. Resuelve sesión,
  genera `qrSvg` con `renderQrSvg(account.qrToken)` en servidor y pasa el resultado
  a `WalletShell`. La pestaña inicial actual es `benefits`.
- Shell y pestañas: `apps/consumer/src/app/(consumer)/wallet/wallet-shell.tsx`.
  `QrTab` se monta cuando `activeTab === "qr"`.
- Cara actual del pase: `apps/consumer/src/app/(consumer)/wallet/qr-tab.tsx`.
  Muestra «Tu pase», una tarjeta blanca `.cp-pass-card`, marca «CheckPass ✦», QR,
  la indicación «Mostrá este código en caja», botones para añadir a Apple/Google
  Wallet y permiso de notificaciones.
- Estilos: `apps/consumer/src/app/wallet.css`, especialmente `.cp-pass-card`,
  `.cp-pass-mark` y `.consumer-qr` alrededor de la línea 629.
- Arte aprobado de Google: `apps/consumer/public/wallet-logo-trama-v1.png`,
  `apps/consumer/public/wallet-trama-hero-v1.png` y vector fuente
  `docs/design-explorations/trama-viva-hero-reference.svg`. Usar esa paleta y
  el gesto de dos trazos como referencia, adaptando la composición al QR y a
  distintos anchos de pantalla.

## Invariantes para el próximo diseño

1. Mantener el **mismo token QR y el flujo de escaneo** del mostrador. No exponer
   el token como texto decorativo, en logs ni en capturas de diseño. El QR ya se
   genera en servidor; revisar contraste, margen silencioso y tamaño real en móvil.
2. La credencial sigue siendo **una por consumidor para toda la red**. No mezclarla
   con tarjetas o niveles de cada comercio, ni inventar un estatus exclusivo de
   lujo. La pertenencia se expresa con la trama, el nombre y el tono de CheckPass
   Club.
3. Mantener accesibles los CTA de Apple/Google Wallet y la invitación a avisos;
   decidir su jerarquía al rediseñar la pestaña. El pase de PWA debe ser valioso
   por sí mismo incluso si el usuario no añade nada al Wallet del teléfono.
4. Diseñar para PWA instalada y navegador móvil, pantallas angostas, texto grande,
   modo claro/oscuro y lectura del QR en mostrador. La maqueta debe distinguir
   ilustración de área escaneable, sin colocar trazos bajo los módulos del QR.
5. Acordar una maqueta visual y spec propia para PWA antes de cambiar código;
   seguir `docs/AGENT-WORKFLOW.md` y registrar QA en un teléfono real.

## Primera acción tras `/clear`

Leer este handoff, [spec 0122](specs/0122-pase-google-wallet-trama-viva.md),
el [arte de Google](design-explorations/trama-viva-hero-reference.svg) y los cuatro
archivos de la PWA indicados arriba. Preparar una propuesta visual concreta para
el pase de la pestaña «Tu pase», con el QR real representado solo por un valor de
prueba en maquetas. Revisar con el owner antes de cerrar la spec e implementar.
