# Estado de GPT

> Lo escribe **solo GPT** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno: lo vigente arriba,
> reescrito entero al cerrar cada sesion. El estado de Claude esta en `claude.md`.

## ⇥ ESTADO (2026-10-04) — SPECS 0152 Y 0154 PUBLICADAS; QA PENDIENTE

El owner entregó `motor` `8a635b0` con el servidor 0153. Rebasé `main` sobre
esa rama y resolví el conflicto de `docs/INDEX.md` conservando las specs 0152,
0153 y 0154. La [spec UI 0154](../specs/0154-veredicto-automatico-del-cupon-en-mostrador.md)
está implementada en el commit `eaa03b3`: veredicto verde/rojo literal en Venta detallada y
rápida, sin M2; «Quitar» siempre; M4 manda cupón solo si es válido; producto fijo
agregado una vez por escaneo; y ticket con unidades del cupón separadas. La 0152
y el servidor 0153 se publicaron junto con la UI en `origin/main` `1927742`.

Verificación con Node 24.20.0: typecheck, lint, formato, unitarios, e2e
global (115 pasaron, 5 omitidos), Neon merchant (410 pasaron, 25 omitidos) y
Neon consumer (60 pasaron) en verde. Las 4 pruebas de navegador de la 0154
pasaron y revisé las capturas móviles verde y roja. `pnpm verify` quedó
**ROJO solo en build**: Turbopack falla al abrir un puerto interno al procesar
`business/onboarding/onboarding.css` (`Operation not permitted`), incluso fuera
del sandbox. El build Webpack de Merchant se comprobó aparte.

El owner autorizó explícitamente `--no-verify` para el único push conjunto por
el fallo de Turbopack. Confirmó que el deploy de Vercel de `1927742` ya terminó.
Faltan su QA con pase/cupón reales y PASS independiente de la UI; no se marca
`implementada` mientras el gate completo siga rojo.
[Handoff para retomar después del clear](../handoff-0154-mostrador-cupon-2026-10-04.md).

## ⇥ TRABAJO ANTERIOR (2026-10-04) — SPEC 0152: MOSTRADOR MÓVIL

La [spec 0152](../specs/0152-mostrador-mobile-sin-nav-y-sin-tarjeta.md) quedó
reservada y publicada en `1ea1e5e`; la UI quedó en `d30136f` tras el rebase.
Las etapas activas de Mostrador ocultan la navegación inferior; la X vuelve a la
pantalla inicial y sigue visible al desplazarse; el aviso no la tapa; en móvil
se elimina la tarjeta blanca interior y el footer detallado deja visibles
«Cancelar» y «Acreditar compra». Escritorio conserva la tarjeta.

Verificación con Node 24.20.0: prueba de navegador a 390 px 1/1, captura vista,
typecheck, lint, formato y tests unitarios verdes; e2e global 111 pasaron y 5
omitidos; Neon relacionado de Merchant 9/9; build Webpack de Merchant verde.
`pnpm verify` quedó **ROJO solo en build**: Turbopack falla al abrir un puerto
interno de PostCSS en `business/onboarding/onboarding.css` (`Operation not
permitted`), incluso fuera del sandbox. No se usó `--no-verify`. El owner pidió
dejar la UI local en ese momento. La autorización posterior incluyó la 0152 en
el push `1927742`, con deploy confirmado por el owner. Pendientes: resolver el build,
hacer QA móvil y obtener PASS independiente
antes de marcar la spec `implementada`.

## ⇥ TRABAJO ANTERIOR (2026-10-04) — SPEC 0149: PANTALLAS DEL CUPÓN ELEGIDO PUBLICADAS

La [spec 0149](../specs/0149-pantallas-de-cupon-elegido.md) quedó cerrada en
`b4f7f43` y su UI se publicó en `main` con `3006a2f` (código `9837a5a`),
sobre los commits de Claude de la 0148. La PWA usa P0–P2 con «Acá», coordenadas si ya existe
permiso, grupos por comercio y selección visible. El mostrador muestra M0,
sondea M1 cada 4 s, valida M2, quita M3 y envía M4 con ticket de bruto,
descuento y neto. El historial distingue los cupones y las unidades extra.
`stages.tsx` quedó en 289 líneas.

Verificación local con Node 24.20.0: typecheck, lint, formato, tests unitarios
(incluidos 34 de la consola), e2e y Neon completo pasaron (2968 tests, 277
omitidos). `pnpm verify` quedó **ROJO solo en build**: Turbopack de Merchant
falla al abrir un puerto interno de PostCSS (`driver.css`, `Operation not
permitted`) tanto dentro como fuera del sandbox y aun aislado. Los builds
Webpack de Merchant y Consumer pasaron. El gate reportó: typecheck ok,
lint ok, format:check ok, test ok, build ROJO, test:e2e ok, neon full ok.
`pnpm ci:status` reporta verde para el remoto `24ce0df`, que incluye la 0149.
**Pendiente:** QA del owner según la 0148 §«QA del owner» y PASS independiente
antes de marcar la spec como implementada. La 0150 (login temporal de QA) ya
está en producción y la 0151 está tomada por Claude; la próxima spec libre es
la 0152. Los botones de QA en onboarding deben aparecer solo cuando
`GET /api/merchant/auth/qa-login` responda 200.

## ⇥ TRABAJO ANTERIOR (2026-10-03) — SPEC 0145: VENTA CRUZADA EN MARKETING

La [spec 0145](../specs/0145-venta-cruzada-por-compra-en-marketing.md) quedó
reservada en `92a464c` y publicada en `main` desde `e61e3d5` (handoff
`dfa1646`). El cambio de UI exige `endsAt` al activar una
cruzada y actualiza editor, resumen, detalle y confirmaciones para la entrega
automática del cupón de la 0143. La prueba `cross-ui.test.ts` pasó 4/4; su
mutación M1 falló en la aserción esperada y se restauró. `pnpm verify` con Node
24.20.0 pasó typecheck, lint, formato, tests, e2e y Neon relacionado de
Marketing; el build Turbopack quedó rojo por `Operation not permitted` al abrir
un puerto interno del procesador CSS, incluso fuera del sandbox. El build
Webpack de Merchant pasó. [Tabla y evidencia](../handoff-0145-venta-cruzada-marketing-2026-10-03.md).
El owner autorizó el push excepcional y se publicó con `--no-verify`; el árbol
quedó limpio tras el push. La consulta posterior de CI falló por conexión a
GitHub, así que no se afirmó verde para ese SHA. La spec sigue `cerrada` hasta
resolver el gate de Turbopack y obtener PASS independiente.

**Al retomar:** el `main` local avanzó después con cuatro commits de Claude
de la [spec 0148](../specs/0148-cupon-elegido-y-atado-a-la-venta.md),
hasta `6cc8f47`, todavía sin push (`origin/main` en `afa6e77`). Según el
[estado de Claude](claude.md), la migración 0064 ya está en PROD y el owner
decidió que el próximo push de GPT arrastre también esos commits. La UI del
contrato 0148 está pendiente; este handoff no la implementa. Al iniciar:
`nvm use`, `git pull --ff-only`, `pnpm ci:status` y revisar el estado del árbol.

## ⇥ TRABAJO ANTERIOR (2026-10-03) — SPEC 0142: ICONO DE LA PWA EN WEB PUSH

La [spec 0142](../specs/0142-icono-de-la-pwa-en-web-push.md) quedó reservada
en `6488227` y el cambio de `sw.js` está publicado en `main` desde `0e055a6`.
El Web Push usa ahora `/checkpass-icon-192-v2.png`, el mismo PNG de 192 px del
manifest. El badge monocromo de Android y el comportamiento del click siguen igual.
`pnpm verify` con Node 24.20.0 pasó completo, incluidos 110 e2e (5 omitidos), y
el hook ejecutable repitió el gate en verde. [Handoff y tabla](../handoff-0142-icono-web-push-2026-10-03.md).

Wallet: el `icon.png` del pase Apple se genera en paquetes desde
`wallet-logo-trama-v1.png`; Claude debe revisarlo si se desea usar el icono v2 de
la PWA en los avisos de Apple. Google controla la presentación de sus avisos y
su `programLogo` es global para los pases; no se cambió el diseño aprobado.
Pendientes: QA visual de un push real, decisión sobre el logo global de Google y
PASS independiente antes de marcar la spec `implementada`.

## ⇥ TRABAJO ANTERIOR (2026-10-02) — SPEC 0140: AVISOS DE MOSTRADOR EN ACTIVIDAD

La [spec 0140](../specs/0140-avisos-de-mostrador-en-actividad.md) quedó
reservada en `daf9bac`. El cableado UI está publicado en `main` desde `0e76439`:
`wallet/page.tsx` lee `listConsumerNotices(account.id)` y pasa los avisos por
`WalletShell` a Actividad. La vista los mezcla por fecha con cupones y programas,
muestra comercio, texto y fecha, y abre «Mis programas» al tocarlos. Claude
agregó el mock del test de servidor en `0a66bc8`; GPT no tocó su zona.

`pnpm verify` con Node 24.20.0 terminó verde: typecheck, lint, formato, test,
build, e2e y Neon relacionado del consumidor. Tabla y límites en el
[handoff](../handoff-0140-avisos-de-mostrador-en-actividad-2026-10-02.md).
El hook local `.githooks/pre-push` quedó ejecutable y el push normal repitió el
gate en verde. Pendientes: QA manual con un cliente que haya sumado un sello y PASS
independiente antes de marcar la spec `implementada`.

## ⇥ TRABAJO ANTERIOR (2026-10-02) — SPEC 0137: UI PUBLICADA, GATE VERDE

El owner pidió tarjetas cuadradas para los archivos elegidos en «Importar con IA» del
catálogo, con miniatura y X para quitar cada foto. Confirmó que las nuevas fotos se
agregan a la selección y que el PDF conserva el análisis automático. La
[spec 0137](../specs/0137-vistas-previas-de-archivos-en-importacion-con-ia.md)
quedó cerrada en `489cdf1`; la UI está publicada en `main` desde `873ff6d`
y el gate verde está registrado en `9fbe3d8`.
Verificación: 7/7 e2e de importación con harness móvil, captura a 390 px vista,
2 mutaciones rojas y revertidas, build Webpack de merchant, typecheck, lint, formato,
tests unitarios y Neon related merchant verdes. `pnpm verify` pasó completo:
e2e global 110 passed / 5 skipped y build Turbopack consumer verde. El `EPERM`
anterior no se reprodujo en la última corrida; la prueba de bind local fuera del
sandbox también pasó. Falta PASS independiente. La UI admite `sourceFileName`
opcional, pero el API actual no lo devuelve: `catalog_import_file.original_name`
ya está persistido y Claude debe
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
