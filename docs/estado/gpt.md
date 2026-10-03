# Estado de GPT

> Lo escribe **solo GPT** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno: lo vigente arriba,
> reescrito entero al cerrar cada sesion. El estado de Claude esta en `claude.md`.

## ⇥ ESTADO (2026-10-02) — SPEC 0137: UI IMPLEMENTADA LOCAL, PUSH PENDIENTE

El owner pidió tarjetas cuadradas para los archivos elegidos en «Importar con IA» del
catálogo, con miniatura y X para quitar cada foto. Confirmó que las nuevas fotos se
agregan a la selección y que el PDF conserva el análisis automático. La
[spec 0137](../specs/0137-vistas-previas-de-archivos-en-importacion-con-ia.md)
quedó cerrada en `489cdf1`; la UI está implementada localmente en `c198198`.
Verificación: 7/7 e2e de importación con harness móvil, captura a 390 px vista,
2 mutaciones rojas y revertidas, build Webpack de merchant, typecheck, lint, formato,
tests unitarios y Neon related merchant verdes. `pnpm verify` fue rojo por Turbopack
consumer (`EPERM` al abrir puerto interno) y el e2e global (`:3000` ocupado por otro
checkout). El push queda pendiente de resolución o autorización explícita del owner;
falta PASS independiente. La UI admite `sourceFileName` opcional, pero el API actual no
lo devuelve: `catalog_import_file.original_name` ya está persistido y Claude debe
exponerlo en el DTO de `GET /api/catalog/imports` y `GET /api/catalog/imports/{id}`.

## ⇥ TRABAJO ANTERIOR DEL OWNER (2026-10-02) — TRAMA VIVA EN EL PASE DE LA PWA

Después de `/clear`, leer el
[handoff Apple → pase PWA](../handoff-2026-10-02-wallet-apple-a-pase-pwa.md).
El owner quiere diseñar una versión de Trama viva para «Tu pase» dentro de
`my.checkpass.club`, con el QR en la tarjeta. La vista actual está en
`apps/consumer/src/app/(consumer)/wallet/qr-tab.tsx` y `apps/consumer/src/app/wallet.css`.
El owner aprobó la [maqueta Trama viva del pase PWA](../design-explorations/pwa-pase-trama-viva.html)
y aclaró que debe mostrarse un solo botón de Wallet según el SO, con su marca.
[Spec 0130](../specs/0130-pase-pwa-trama-viva.md) cerrada el 02/10/2026. Código local
aplicado; tests afectados 8/8, typecheck, lint y build Webpack del consumidor verdes.
Turbopack no pudo abrir un puerto interno en este entorno. Faltan QA en teléfono real,
escaneo de mostrador y PASS independiente antes de marcarla implementada.
[Handoff](../handoff-0130-pase-pwa-trama-viva-2026-10-02.md).

## ⇥ ESTADO (2026-10-02) — APPLE WALLET 0123: «IPHONE · STRIP VISIBLE» APROBADO; ARTE IMPLEMENTADO LOCALMENTE

El owner eligió la vista «iPhone · strip visible» de Trama viva. La spec 0123 está
cerrada. `0790956` está pusheado en `origin/main`. El constructor `.pkpass` incluye icono, logo y `strip` a 1x/2x/3x,
contacto público y revisión de marca nueva; preserva el QR y las referencias del
pase. Prueba Wallet, typecheck, lint y build pasan. **Live sin verificar:** faltan QA en
iPhone para confirmar que `strip` aparece en la versión objetivo, comprobar despliegue,
refresco de un pase existente con APNs, y PASS independiente antes de marcar
`implementada`. [Handoff](../handoff-0123-apple-wallet-trama-viva-2026-10-02.md) y
[guías de diseño](../wallet/apple-wallet-design-rules.md) y de
[actualización de pases viejos](../wallet/apple-wallet-update-existing-passes.md).

## ⇥ ESTADO (2026-10-01) — GOOGLE WALLET 0122: CLASE REAL TRAMA VIVA ACTUALIZADA Y APPROVED; PUBLICACIÓN GENERAL POR CONFIRMAR

Spec 0122 «Trama viva» aprobada por el owner. `f595842` está pusheado en `main`; ambos PNG
responden HTTP 200 desde `my.checkpass.club` y su SHA-256 coincide con el commit. La clase
`qa_trama_viva_0122` fue creada y Google devolvió `reviewStatus=approved`. El owner guardó
el pase QA en Android y aprobó el diseño: «perfecto, funcionó, quedó hermoso». Las
verificaciones de build, typecheck, lint, provisionador y regresión de Wallet pasan. La
clase real recibió `PATCH` autorizado y la lectura posterior confirmó logo/hero Trama viva,
emisor «CheckPass Club», plantilla y `reviewStatus=approved`. Siguiente secuencia:
verificación de pase viejo/nuevo y QR/enlace reales, confirmar acceso de publicación del
emisor en Console y PASS independiente. [Handoff](../handoff-0122-google-wallet-trama-viva-2026-10-01.md)
y [guía de diseño/publicación](../wallet/google-wallet-design-and-release.md).
