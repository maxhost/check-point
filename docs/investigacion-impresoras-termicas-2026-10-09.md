# Investigacion: impresoras termicas Bluetooth desde el panel (2026-10-09)

Pedido del owner: imprimir tickets a termicas Bluetooth baratas (caso real: «Mini thermal printer
WD-58P1», 58 mm) con un clic, sin `window.print()`. Investigacion con 6 agentes; lo marcado **[V]**
lo re-verifico el orquestador contra la fuente; **[I]** es inferencia o dato de agente sin reproducir.

## Decision del owner

«La opcion corta es para Android de momento». Prueba en campo con la pagina publica
`/prueba-impresora` (PARQUEADO #84). iOS y app en tiendas: sin decidir.

## Resultado de la prueba de campo (2026-10-09) — MEDIDO

La duena del comercio la hizo sola, desde su Android, con la bitacora `[PRUEBA-IMPRESORA]` del
servidor local (sesion `ft9ch8`, Android 10, Chrome 154):

- **Web Serial (metodo 1): lista vacia** («No se encontraron dispositivos compatibles»). Causa, leida
  en Chromium: la lista sale de los equipos VINCULADOS en Android (`getBondedDevices()`) y crea un
  puerto por cada UUID que Android ya tiene (`device->GetUUIDs()`, `bluetooth_serial_device_enumerator.cc`);
  el selector solo muestra SPP (`serial_chooser_controller.cc`). Una impresora BLE nunca aparece.
- **Web Bluetooth (metodo 2): IMPRIMIO.** La impresora se anuncia como **«BlueTooth Printer»** y
  expone el servicio BLE **`18f0`** con una caracteristica escribible con y sin respuesta. Bitacora:
  `metodo2_elegido` → `metodo2_servicios ["000018f0: ro,wwnr"]` → `metodo2_ok` en 2 s. El owner
  confirmo el papel con foto («SI LEES ESTO, FUNCIONO», «Metodo: 2 (BLE)»).
- Conclusion: **la WD-58P1 es BLE** (perfil generico `18f0`/`2af1` de `@point-of-sale`). Lo que no
  se midio: si TAMBIEN tiene Bluetooth clasico, los acentos (el ticket de prueba no los usa) y si
  varios tickets seguidos salen sin volver a elegir (el owner decidio no probar mas).
- Leccion: la investigacion supuso Bluetooth clasico por ser «lo mas comun» en estas impresoras y la
  primera prueba solo cubria ese transporte. **Una prueba de campo cubre todos los transportes
  posibles a la vez**: la segunda vuelta (con BLE y bitacora remota) resolvio en un intento.

Consecuencias: en Android imprime desde la web hoy (Web Bluetooth, con la lista una vez por sesion
porque `getDevices()` sigue detras de flag); en iPhone esta misma impresora es alcanzable por una app
nativa o Bluefy (BLE sin MFi); un puente ESP32 puede ser cualquier modelo (C3/S3 tienen BLE).

## Android (camino elegido)

- **[V]** Chrome Android 138 lanzo Web Serial sobre Bluetooth RFCOMM (release notes de Chrome 138:
  «Chrome on Android now supports Web Serial API over Bluetooth RFCOMM»). chromestatus todavia dice
  «In development»: las notas de version mandan.
- **[V]** El permiso queda guardado: en `chrome/browser/serial/serial_chooser_context.cc`,
  `CanStorePersistentEntry()` devuelve `true` para puertos Bluetooth con nombre y path (la MAC), y
  `GrantPortPermission` los guarda como permiso de objeto del origen. Solo `requestPort()` exige gesto
  (`serial.cc`, «Must be handling a user gesture…»); `open()` no.
- Flujo: emparejar en Ajustes de Android → primer «Imprimir»: permiso «Dispositivos cercanos» + elegir
  la impresora en la lista de Chrome → despues, `getPorts()` + `open()` sin preguntar.
- Peor caso si no persistiera: un toque extra por sesion (la lista), no un emparejamiento.
- **[I]** Sin reporte publico probado con una termica ESC/POS en Android: lo confirma la prueba.
- **[I]** Chrome Android no emite `connect`/`disconnect` ni `port.connected` (Intent to Ship): hay
  que intentar `open()` y explicar el error.
- **[I]** SPP admite una conexion a la vez: si otra app POS tiene la impresora, Chrome no entra.
- Web Bluetooth (BLE): **[V]** `getDevices()`/permisos persistentes siguen detras de flag
  (chromestatus 4797798639730688, milestone 169). Hoy pide la impresora en cada carga.
- Plan B sin codigo nativo **[I]**: app RawBT por intent `rawbt:` (un clic; la version gratis pone
  un aviso en el ticket). `window.print()` + servicio de impresion de Android: siempre muestra dialogo.
- Libreria para el ticket real **[V]** (npm, MIT): `@point-of-sale/receipt-printer-encoder` 4.0.1
  (2026-09-18), con perfiles `pos-5890`/`pos-8360` para genericas de 58/80 mm y `codepage('auto')`.

## iOS

- **[V]** La lista oficial de perfiles Bluetooth de iOS (support.apple.com/102842) no incluye SPP;
  el unico canal de una app a Bluetooth clasico es MFi (WiAP / External Accessory). Los audifonos
  andan porque iOS implementa HFP/A2DP.
- **[V]** WebKit tiene posicion «oppose» sobre Web Bluetooth y Web Serial (standards-positions). Todo
  navegador en iOS usa WebKit.
- Bluefy: app nativa que inyecta `navigator.bluetooth` y lo traduce a CoreBluetooth (solo BLE) **[I]**.
- Opciones **[I]**: impresora en la nube (Star CloudPRNT: la impresora consulta nuestro servidor; el
  servidor es poco trabajo, pero exige impresora Star de red), app nativa propia con impresora BLE
  (lo que hace Kyte), Bluefy. Con una termica solo-SPP no hay camino sin hardware intermedio.

## App en tiendas (Capacitor) y offline

- **[V]** El WebView de Android no tiene Web Serial ni Web Bluetooth (MDN browser-compat-data:
  `webview_android: false`). En una app empaquetada se imprime con plugin nativo.
- **[V]** La doc de Capacitor dice de `server.url`: «This is not intended for use in production».
  El panel es server-rendered (20 paginas, 88 rutas de API **[I]**): exportarlo estatico es reescribir.
- Riesgo de rechazo de Apple por guideline 4.2 si la ven como web envuelta **[I]**.
- Offline **[I]**: posible (PowerSync soporta Neon), pero solo para tomar pedido e imprimir; cupones,
  sellos y cobros siempre online (doble canje). Seria L3.

## Estado del codigo (2026-10-09)

Todo se imprime con `window.print()` a ancho de pagina (`pos-ticket.tsx`, sin `@page` de 58/80 mm);
el boton «Imprimir» nuevo de `pos-editor.tsx` no tiene accion; el panel no es PWA (sin manifest).

## Puente para iPhone: hardware (conversacion del owner, 2026-10-09)

- **No existe a la venta** una cajita nube/BLE → Bluetooth clasico (busquedas web; Expedy y
  LOYALTY-SECU hablan USB del lado de la impresora; Feie/Xprinter venden impresoras con nube).
- Disenio: el aparato es **cliente** de nuestro servidor (consulta una cola cada pocos segundos), no
  servidor local: una pagina HTTPS no puede hablar con `http://192.168.x.x` (mixed content / Local
  Network Access).
- Opciones **[I, precios de memoria salvo lo marcado]**: ESP32 (~USD 6–9 armado; Arduino
  `BluetoothSerial` en modo master con PIN, o BLE), Raspberry Pi Zero 2 W (**[V]** USD 15 oficial;
  ~USD 30 armada), Milk-V Duo S Wi-Fi (~USD 12, Bluetooth en Linux sin confirmar), Android viejo con
  la pagina abierta. Descartados: TV box chinos (**[V]** malware de fabrica BADBOX 2.0, aviso del FBI
  2025; Armbian no garantiza Wi-Fi/Bluetooth), telefonos desarmados (bateria). Referencia: Star
  SM-S230i (MFi) **[V]** USD 297–373.
- El owner compra un ESP32 WROOM-32 (~USD 7 en Cuenca) para probar.

