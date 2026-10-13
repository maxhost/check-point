# Investigacion: POS sin conexion (2026-10-12)

> Investigacion, sin codigo. Parqueada (PARQUEADO #95). Al retomar: spec **L3** (servidor + modelo + UI; ADR por
> la sincronizacion). Las decisiones del owner de abajo NO se vuelven a preguntar.

## Pedido del owner

«como podemos hacer que la parte de POS es decir ventas no requieran de internet, que pueda guardar las cosas en
local y cada x horas llame a la DB para intentar sincronizarse? de esta manera si no hay internet pueden seguir
operando, mas alla de que no podran indetificar al cliente o aplicar cupones por ejemplo. pero eso es un mal
aceptable a cambio de que puedan continuar tomando los pedidos»

## Como esta hoy (leido en el codigo, 2026-10-12)

- `apps/merchant/src/app/backoffice/pos/page.tsx` es `force-dynamic`: valida la sesion y lee los locales en el
  servidor en cada carga. La PWA tiene manifest (`app/manifest.ts`) pero **no hay service worker**: sin red no abre.
- Todo pasa por la API: `GET /api/pos/catalog`, `/tables`, `/orders`, `/ticket`; `POST/PUT /api/pos/orders`,
  `POST …/close`, `POST /api/pos/resolve`.
- `pos-cache.ts` es cache en memoria por consola montada («No timers, persistence or shared module state»).
- Ya ayuda: el cierre es idempotente por `clientRequestId` (`server/pos/close.ts`); `version` como lock optimista;
  los precios ya son snapshot por linea; cerrar sin pase solo marca `closed` (no crea `core.order`); la impresion
  por Web Bluetooth es local.
- El `id` de `core.pos_order` lo genera la base (`defaultRandom()`, `packages/db/src/schema/pos.ts`); hay un
  unico parcial de una orden abierta por mesa (`core_pos_order_open_table_unique`).
- El QR del pase es un token FIJO de la cuenta (`consumerAccounts.qrToken`, `server/counter/resolve.ts`): no rota
  con el tiempo, asi que se puede guardar sin conexion y resolver al sincronizar.
- `server/auth.ts` no configura la duracion de la sesion: queda el default de better-auth (por su documentacion,
  7 dias renovables; **no medido**).

## Decisiones del owner (2026-10-12, en sus palabras cuando importan)

1. **Alcance:** sin conexion se permiten ventas, mesas y ordenes abiertas — incluidas las abiertas por otro
   telefono antes del corte — **solo en un telefono**. Catalogo, locales, staff y ajustes: no. «Lo que no
   permitirmos es catalogo, locales, staff, nada de eso, solo POS.»
2. **Un solo telefono:** banner que avisa que no hay conexion y que se siga con un solo telefono, con un boton
   «Seguir con el POS sin conexion». Los demas telefonos quedan bloqueados con el aviso.
3. **Sin choques:** «si venia todo sincronizado cuando se acabo la conexion se usa un solo dispositivo, la conexion
   vuelve, se sincroniza todo, todos los dispositivos vuelven a estar sincronizados.» No hay lista de conflictos.
   (Regla tecnica de Claude para no rechazar una venta si la `version` difiere: gana lo del telefono offline.)
4. **Precios:** los del telefono. El caso «cambian un precio desde otra compu mientras tanto» no es un caso de uso.
5. **POS apagado / plan vencido mientras tanto:** «otro caso de uso que no va a suceder».
6. **Limite:** 48 h sin conexion. (Interpretacion de Claude, **sin confirmar**: pasadas 48 h el telefono deja de
   vender offline hasta sincronizar; lo ya vendido queda guardado.)
7. **Cliente:** se escanea el QR sin conexion y se guarda; al sincronizar se acreditan los puntos **con la fecha
   real de la venta**. Si el QR no corresponde a nadie, se descarta el codigo y la venta queda sin cliente. Los
   avisos al cliente llegan tarde: aceptable.
8. **Cupon:** sin conexion no se valida; si al sincronizar se acreditan puntos, el cupon **no se aplica ni se
   consume** (el cliente lo conserva). El owner lo explica al cliente.

## Diseño propuesto

1. **Service worker** (p. ej. Serwist) que cachea la consola y sus assets; sin red sirve el shell en vez del
   render del servidor.
2. **IndexedDB** con catalogo por local, mesas, locales, ajuste del ticket, ordenes abiertas (refrescadas seguido
   mientras hay conexion, para que el telefono tenga las del otro mesero) y la ultima sesion conocida.
   `navigator.storage.persist()`. Cerrar sesion **no** borra ventas pendientes.
3. **Cola de operaciones** (crear / editar / cerrar / escaneo guardado): `id` de orden generado en el telefono y
   `clientRequestId` por operacion.
4. **`POST /api/pos/sync`** (nombre tentativo): aplica la cola en orden e idempotente, con los precios del telefono
   y las fechas reales; acredita el QR guardado si resuelve, si no lo descarta.
5. **Cuando sincroniza:** al abrir la app, al volver la red (confirmado con un ping, `navigator.onLine` miente) y
   cada pocos minutos con la app abierta. Android puede sumar Background Sync; **iOS no tiene sync en segundo
   plano**: con la app cerrada sincroniza la proxima vez que se abra.
6. **UI (zona GPT):** banner + boton, estado «N ventas por subir», escaneo y cupon con su motivo cuando no aplican.

## A medir antes de la spec (Claude, no son decisiones del owner)

- Acreditar con fecha pasada: efecto sobre vencimiento de saldo (`balance-expiry`), bienvenida y venta cruzada.
- Como la app elige y bloquea «el telefono offline» (los demas tambien estan sin red: el bloqueo es local).
- Que pasa con la sesion vencida al volver (las ventas esperan al login).
- Probar en iPhone real que la PWA instalada abre sin red y conserva IndexedDB.

## Etapas sugeridas

1. Shell sin red + datos guardados + banner (sin vender): valida iOS.
2. Ventas y mesas offline con la cola y el endpoint de sync.
3. Escaneo guardado y acreditacion al sincronizar.
