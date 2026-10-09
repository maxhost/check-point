# Investigacion: hardware barato (ESP32) y marketing de cercania para comercios chicos (2026-10-09)

Pedido del owner: «que mas podemos hacer con esta plaquita […] que se hace en el mundo del marketing de comercios de
cercania […] me obsesiona ayudar a comercios pequeños a vender mas y mejor». Tres agentes en paralelo (aparatos en
tienda, marketing sin app nativa, el ESP32 como producto). Marcas: **[R]** = re-verificado por el orquestador contra
la fuente; **[A]** = dato del agente con fuente citada, sin re-verificar; **[I]** = inferencia. Ideas relacionadas:
PARQUEADO #87 (puente POS) y #88 (Wi-Fi de invitados).

## Hallazgos que cambian decisiones

1. **Nuestros pases YA llevan ubicaciones** (spec 0065: Apple `locations` + `relevantText`, Google
   `merchantLocations`), pero el paso que las coloca esta apagado (`PROXIMITY_PLACEMENT_ENABLED = false`,
   `packages/domain/src/server/marketing/enabled-campaigns.ts:26`; PARQUEADO #67 / ADR 0115). [R]
   - Google Wallet volvio a avisar por cercania: «Nearby Passes Geofence Notifications are now available for all
     regular pass types», hasta 10 ubicaciones por clase y por objeto (release notes, 2025-10-14). [R]
   - Apple sigue documentando `locations` y `beacons` para la pantalla de bloqueo; `relevantDate` deprecada desde
     iOS 18; reporte de usuarios de beacons rotos en iOS 26.0–26.0.1 y arreglados en 26.4. [A]
   - Consecuencia: un aviso «estas cerca, te faltan 2 sellos» ya tiene el codigo de base; es una decision de
     reencender, no de construir. Google pide al usuario ubicacion «siempre» y notificaciones. [A]
2. **Reseñas: Google prohibe premiarlas y pedirlas solo a los contentos.** Texto de la politica: no se permite
   «Offer incentives – such as payment, discounts, free goods and/or services – in exchange for posting any review»
   ni «selectively solicit positive reviews from customers». [R] Un stand «si estas contento, reseñanos» que filtra
   a los descontentos queda prohibido; el QR/NFC a la reseña va para todos y sin premio. Evidencia de valor: +1
   estrella en Yelp ≈ +5–9 % de ingresos en restaurantes independientes, sin efecto en cadenas (Luca, HBS). [A]
3. **Portal cautivo (#88): Google bloquea su login en webviews embebidos desde 2021-09-30** y su propio post nombra
   el caso del «captive network assistant», recomendando iniciar sesion en el navegador del sistema. [R] El portal
   sirve de puerta (QR, enlace, telefono), no para crear la cuenta con Google.
4. **Coexistencia en el ESP32 original:** SoftAP conectado + BLE o Bluetooth clasico = **C1, «supported, but the
   performance is unstable»**; STA conectado + Bluetooth = **Y, estable** (docs de ESP-IDF). [R] Juntar Wi-Fi de
   invitados e impresion Bluetooth en una placa es justo el caso inestable: dos placas, o el puente por red.
5. **Cupon impreso en caja** (precedente del puente #87): Catalina reporto que sus cupones a color en caja
   canjeaban **30 % mas** que los de blanco y negro (Supermarket News, 2006-12-13). [R] Las tasas absolutas que dio
   el agente (6,3 %, 0,68 % de insertos) **no estan en esa fuente**: descartadas.
6. **Sello por visita sin cajero con NFC, sin ESP32:** tags NXP NTAG 424 DNA generan un mensaje unico por toque
   («secure unique tap messages», SUN) que valida el servidor; ~EUR 0,50–0,90 por tag. [R parcial: el mensaje unico
   por toque; el precio es A] Mas barato y sin mantenimiento que una pantallita con QR rotativo. [I]

## Aparatos en tienda: que existe y que se puede replicar

| Aparato | Evidencia | Con ESP32 |
|---|---|---|
| Terminal de satisfaccion (HappyOrNot) | solo del proveedor [A] | si, botones + Wi-Fi; el valor esta en el tablero [I] |
| Pantalla de inscripcion en caja (Square, Fivestars) | del proveedor, sin control causal [A] | si, e-ink/TFT ~USD 16 con QR + «esta compra te da X puntos» [A] |
| Cupon impreso en caja (Catalina) | color +30 % vs B/N [R] | si, es el puente #87 |
| Stand NFC/QR a reseñas | Luca +5–9 % independientes [A] | sin ESP32: sticker NFC + QR |
| Contador de entradas | sin cifras de ventas [A] | si, sensor IR/ToF ~USD 10; util cruzado con ventas [I] |
| Señalizacion de video, kioscos, tablets de mesa | +2–5 % reportados por la industria [A] | no: tablet o TV con la PWA [I] |
| Etiquetas e-ink de estante | efecto mixto (estudio Delhaize) [A] | no conviene para estantes |

## Marketing sin app nativa

- **Funciona:** Wallet por ubicacion (punto 1); web push en iOS solo con la PWA en inicio (tasa de aceptacion sin
  medir publicamente: medirla en CheckPass) [A]; programas de sellos con avance regalado (Kivetz 2006: una tarjeta
  de 12 con 2 marcados se completa antes que una de 10 vacia) [A]; referidos (+16–25 % de valor del cliente
  referido, estudio de banco aleman) [A].
- **Murio:** Google Nearby Notifications/Eddystone (cortado 2018-12-06 por spam) [A]; beacons como canal de ofertas
  sin app [A].
- **WhatsApp:** cobro por plantilla entregada desde 2025-07-01, precio por pais [A]. Canal pago opcional, despues de
  push y Wallet que son gratis [I].
- **Datos personales:** Ecuador LOPDP (2021, reglamento 2023; multas 0,1–1 % del volumen de negocio; usar datos para
  otro fin o cederlos sin consentimiento es grave) — toca la venta cruzada entre comercios [A]; Mexico nueva
  LFPDPPP vigente desde 2025-03-21 [A].

## El ESP32 como producto

- Por uso: QR dinamico, botones y pantalla e-ink → viables y simples; puente por red (puerto 9100) → viable, hay
  que escribirlo (no hay proyecto maduro); puente Bluetooth clasico → solo ESP32 original (C3/C6/S3 son solo BLE);
  puente USB → ninguna placa sola; Wi-Fi de invitados → viable como puerta, inestable junto a Bluetooth. [A]
- NAT por la placa: ~15–16 Mbit/s y 8–15 clientes; alcanza para registrarse, no como Wi-Fi del local. [A]
- Para producto: provisioning de Wi-Fi (por BLE no sirve desde iPhone por web: Safari no tiene Web Bluetooth), OTA
  firmada con rollback, Secure Boot v2 (exige revision de chip ≥ v3.0; la placa del owner es v1.0, medido), monitoreo,
  y **homologacion**: Mexico IFT (sello obligatorio desde 2025-07-01) y Ecuador ARCOTEL; no confirmado si el
  certificado del modulo alcanza para el producto final, ni si el comodato exime. [A]
- El WROOM-32 original figura NRND en su datasheet segun el agente; no se pudo re-verificar (PDF ilegible). Para
  comprar 10, preguntar por WROOM-32E o C3/S3 segun el uso. [A]
- Carcasa: PLA se ablanda a 55–65 °C; cerca de la impresora termica o al sol, PETG o ASA. [A]

## Fuentes

Las URLs de cada dato estan en los informes de los agentes; las re-verificadas: Google Wallet release notes
(developers.google.com/pay-wallet/products/wallet/docs/release-notes), politica de contenido de Google
(support.google.com/contributionpolicy/answer/7400114), post de OAuth de Google
(developers.googleblog.com/2021/06/upcoming-security-changes-to-googles-oauth-2.0-authorization-endpoint.html),
coexistencia ESP-IDF (docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/coexist.html), Catalina
(supermarketnews.com/center-store/catalina-s-color-coupons-yield-30-higher-redemption-rate), NTAG 424
(store.gototags.com/nfc-tags/nfc-tags-by-use/nxp-ntag-424-dna-nfc-tags/).
