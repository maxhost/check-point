---
spec: 0121
fecha: 2026-10-01
estado: cerrada
resumen: Rediseñar Mostrador para registrar compras detalladas con categorías, accesos basados en el historial del cliente y un carrito móvil compacto; comparar tiempo y exactitud contra el flujo actual en un piloto con Café Plátano.
disjunta: no
archivos: apps/merchant/src/app/backoffice/counter/*, apps/merchant/src/app/backoffice/onboarding/onboarding-checklist.tsx, apps/merchant/src/app/globals.css, apps/merchant/src/app/api/counter/resolve/route.ts, apps/merchant/src/server/counter/resolve.ts, apps/merchant/src/server/counter/grant.ts, apps/merchant/src/server/counter/*test.ts, docs/specs/0121-mostrador-rapido-con-catalogo.md, docs/INDEX.md
---

# 0121 — Mostrador rápido con el catálogo actual

## Problema

En Café Plátano se registra el pedido en Loyverse para cocina y cobro. Para atribuir ese consumo al cliente, el personal debe volver a cargar los productos en CheckPass después de escanear su pase. El tiempo de esa segunda carga compite con cobrar, dar cambio y atender la siguiente mesa. El objetivo del rediseño es **registrar los artículos de la compra**, además de acreditar sellos o puntos; la venta rápida por importe no produce ese historial.

El flujo actual (`counter-console.tsx`, `sale-forms.tsx`, `stages.tsx`) ya permite escanear, sumar productos tocándolos y ajustar cantidades, pero muestra una lista alfabética completa con búsqueda como principal forma de encontrar un artículo. El carrito aparece encima del catálogo y crece con cada línea. Las categorías ya llegan en `POST /api/counter/resolve`, pero la pantalla no las usa. Para el owner, `backoffice/layout.tsx` inserta un checklist de onboarding expandido por defecto antes del contenido de Mostrador; en teléfono ocupa espacio de trabajo.

No hay medición actual del tiempo ni de los errores de este flujo. No se fija una meta de segundos fingiendo que ya existe una línea base.

## Evidencia para el diseño

- [Square](https://squareup.com/help/us/en/article/8334-set-up-item-grid) usa mosaicos de artículos y categorías para agregar artículos con un toque.
- [Loyverse en teléfonos](https://help.loyverse.com/help/favorites-on-smartphones) ofrece favoritos para agregar productos al ticket sin recorrer todas las categorías. Es un patrón relevante para el equipo que Café Plátano ya usa.
- La investigación de [Baymard sobre controles de cantidad](https://baymard.com/research-articles/grocery-add-to-cart-buttons) respalda mostrar `− cantidad +` junto al artículo agregado. Su investigación sobre [compras anteriores](https://baymard.com/research-articles/grocery-food-delivery-orders) respalda ofrecer productos ya comprados como acceso directo. Son patrones transferibles, no una prueba de que este mostrador será más rápido: eso lo medirá el piloto.

## Alcance

**Entra:**

1. Rediseñar la pantalla móvil de venta detallada de `/backoffice/counter` con categorías, artículos habituales del cliente, búsqueda secundaria, controles de cantidad junto al producto y resumen de compra fijo al pie.
2. Evitar que el checklist de onboarding ocupe la pantalla de Mostrador, sin cambiar los pasos ni su estado.
3. Leer el historial detallado existente para construir los accesos habituales y la última compra, siempre dentro del negocio y local seleccionados.
4. Comparar el flujo actual y el nuevo con un protocolo de tiempo, exactitud y esfuerzo de operación en Café Plátano; repetir pruebas de interfaz con catálogos de distintos tamaños y estructuras.

**No entra:** integración con Loyverse o su impresora, reemplazo del POS, órdenes abiertas/mesas, facturación, cambio de precio, descuentos, modificadores, sincronización del catálogo, una nueva tabla de analítica, ni cambios en las reglas de acreditación/canje. La venta rápida y el canje siguen disponibles. La compra detallada sigue siendo una acreditación cerrada, no una orden editable.

## Diseño de la experiencia

### Flujo móvil

1. **Inicio:** acción «Escanear pase» visible sin desplazar la página. Historial del día detrás de una sección plegada; el local se elige antes de escanear si hay más de uno y no está preseleccionado. Al terminar, «Escanear siguiente» conserva el local.
2. **Pase resuelto:** una línea compacta con nombre, saldo y una acción clara para cancelar o volver a escanear. El modo inicial es venta detallada cuando hay productos; con catálogo vacío se conserva la venta rápida. Los controles de «Venta rápida» y «Canjear» siguen disponibles sin desplazar el catálogo fuera de la vista inicial.
3. **Atajos personales:** hasta seis productos de «Habituales de este cliente» si figuran en dos compras detalladas previas en ese local. Cada toque añade **una** unidad. No se precarga nada: el pedido de hoy debe observarse. La grilla completa mantiene un orden estable para que el personal aprenda dónde está cada artículo.
4. **Categorías:** chips de «Todos», cada categoría con productos visibles y «Otros» para artículos sin categoría. Orden alfabético estable por nombre de categoría y producto; dentro de cada categoría, el orden no cambia según el cliente. Si no hay categorías, «Todos» muestra el catálogo. Categorías vacías no se muestran. Al cambiar categoría se conserva el carrito y se limpia la búsqueda.
5. **Producto:** una tarjeta táctil con nombre, precio o indicación «Sin precio». Un toque agrega una unidad; al estar en carrito, la misma tarjeta expone `− cantidad +`. El botón `−` en uno elimina la línea. La búsqueda, visible como acción secundaria, filtra por nombre en **todo** el catálogo y permite volver a la categoría anterior al cerrarla. No es necesario escribir para encontrar un producto con categoría.
6. **Última compra:** si existe una compra detallada reciente del cliente en ese local, «Cargar última compra» muestra un resumen previo. Al confirmar, agrega sus cantidades al carrito actual; nunca acredita automáticamente. El personal puede quitar o ajustar líneas antes de acreditar. Si falta un producto actual, el atajo se oculta; los snapshots antiguos nunca se envían como productos nuevos. Usa el precio actual del catálogo y lo comunica en el resumen.
7. **Pie fijo:** muestra número de unidades, total, unidades de fidelidad previstas y «Acreditar compra». La acción acredita con **un toque** cuando el carrito es válido, igual que «Confirmar» hoy. El resumen se puede expandir para revisar líneas, cantidades y precios sin convertir esa revisión en un paso obligatorio. Un artículo sin precio obliga a ingresar un importe válido antes de acreditar. Durante la petición el botón queda deshabilitado; ante error conserva carrito y `clientRequestId` para reintentar. Tras éxito se mantiene la confirmación y el botón «Escanear siguiente».

El pie respeta el área segura del teléfono, no cubre el último producto, y el teclado no tapa los controles de precio o búsqueda. Cada acción táctil principal mide al menos 44 × 44 CSS px y tiene nombre accesible; las categorías admiten desplazamiento horizontal sin bloquear el vertical. La pantalla debe funcionar a 320, 375 y 430 CSS px de ancho con fuente ampliada al 200 %, además de escritorio. La navegación por teclado y el lector de pantalla anuncian cantidad, total y errores sin cambios de foco inesperados.

### Reglas para historial y catálogos

- El cliente envía `{ qrToken, locationId }` a `POST /api/counter/resolve` usando el local seleccionado; el servidor valida que pertenezca al negocio y esté activo. `resolveScan` acepta el local como argumento opcional para conservar las llamadas internas existentes. Con `locationId` ausente, devuelve solo productos disponibles en todos los locales y atajos vacíos; la pantalla operativa siempre lo envía cuando hay un local. La respuesta extiende `catalog` con `habitualProductIds: string[]` y `lastPurchase: { items: { productId: string; quantity: number }[] } | null`. Los IDs siempre remiten a `catalog.products` de esa respuesta. No se envían otras compras, nombres de terceros, tickets ni tokens QR. La ruta ya exige autorización de operador y resuelve al cliente por su pase; la consulta de historial filtra **businessId, consumerId y locationId** explícitos.
- Para hábitos: últimas 20 órdenes `detailed` del cliente en el local, dentro de los 90 días anteriores; contar en cuántas órdenes aparece cada producto, ordenar por ese conteo descendente, última fecha descendente y nombre ascendente. Solo mostrar productos que siguen en el catálogo y aparecen en al menos dos órdenes distintas. Si no hay historial suficiente, el bloque desaparece y el catálogo se muestra primero.
- «Última compra» usa la orden `detailed` más reciente dentro de esos 90 días. Aparece solo si tiene entre 1 y 8 líneas, todos los `productId` siguen vigentes y las cantidades son válidas. La operación de cargar suma cantidades si ya hay artículos en el carrito. No usa precios del snapshot para crear una venta nueva.
- `catalog.products` debe respetar la disponibilidad por local ya modelada en `product.availableAllLocations` y `product_location`: mostrar productos globales o asignados al local actual. El servidor de acreditación debe verificar la misma disponibilidad al guardar para impedir que una respuesta vieja o manipulada registre un artículo de otro local. Sin `locationId`, solo se admiten productos globales. Si el producto deja de estar disponible entre escaneo y confirmación, se informa cuál falló y se conserva el carrito para corregirlo.
- El catálogo puede tener 0 productos, productos sin categoría, productos sin precio y nombres largos. No se introducen favoritos configurados por comercio en esta entrega. Para un cliente nuevo, el primer bloque es «Todos» y categorías; para un comercio sin categorías, todos los artículos siguen accesibles.

### Precio y exactitud

El servidor actual usa el precio guardado en CheckPass para un producto con precio configurado; solo acepta un precio manual si el catálogo no tiene uno. Este rediseño **no** iguala descuentos, cargos o cambios de precio que Loyverse pueda aplicar. El resumen se rotula «Total registrado en CheckPass» para no presentarlo como el importe fiscal. Si no coincide con el ticket, el operador puede corregir el catálogo después o usar el flujo actual de venta rápida cuando sea indispensable, sabiendo que esta última pierde el desglose. El piloto registra cada discrepancia: si es frecuente, el siguiente trabajo deberá resolver precios/ajustes antes de prometer estadísticas monetarias precisas.

## Medición y decisión del piloto

**Antes de cambiar la UI**, medir la versión actual con el mismo teléfono, red y catálogo que se usarán después. Conservar una instalación de prueba de ambas versiones para alternarlas durante la comparación. Dos operadores realizan al menos 20 compras simuladas por versión, alternando versión y guion: cliente nuevo/recurrente, 1/3/6 líneas, repetición de unidades, artículos de varias categorías y producto sin precio. Usar pedidos y cuentas de prueba preparados; no crear acreditaciones reales en la cuenta de un cliente. Luego, si Café Plátano acepta, observar una jornada real de operación para comprobar si el resultado controlado se sostiene bajo carga.

| Medida | Inicio → fin / registro |
|---|---|
| Tiempo total | Toque «Escanear pase» → confirmación de acreditación en pantalla; separar espera de cámara/red y tiempo posterior al QR. |
| Tiempo de carga | Cliente identificado → toque de acreditar: «Confirmar» en la versión actual y «Acreditar compra» en la nueva; excluye espera de red. |
| Esfuerzo | Número de toques, veces que se abre búsqueda, caracteres escritos, cambios de categoría, correcciones y uso de atajos. |
| Exactitud de artículos | Comparar producto y cantidad línea por línea con el pedido de referencia; contar faltantes, extras y cantidades incorrectas. |
| Exactitud monetaria | Diferencia entre total CheckPass y ticket Loyverse; clasificar causa: precio de catálogo, descuento, modificador, impuesto/cargo u otra. |
| Cobertura de atajos | Porcentaje de compras en que se usó un habitual o la última compra y porcentaje de líneas añadidas desde ellos. |

Un observador registra datos en una hoja de piloto con **código de guion**, versión, operador y medidas; sin nombre, pase, QR ni identificador del cliente. Reportar mediana y percentil 90 por versión y por tamaño de pedido, junto con errores y discrepancias; 20 observaciones dan una señal de producto, no significación estadística. La condición para mantener el rediseño es: mediana de tiempo de carga al menos 30 % menor, percentil 90 no mayor que el actual y exactitud de artículos igual o superior. Si falla, revisar las notas del observador, ajustar el flujo y repetir la misma batería. El tiempo de cobro/factura se anota como contexto, pero no se atribuye a CheckPass.

## Archivos y compatibilidad

| Archivo | Acción |
|---|---|
| `apps/merchant/src/app/backoffice/counter/counter-home.tsx`, `counter-console.tsx`, `stages.tsx`, `sale-forms.tsx`, `types.ts`, `cart.ts` | Editar flujo y componentes; separar componentes si alguno supera el límite de tamaño del repositorio. |
| `apps/merchant/src/app/backoffice/onboarding/onboarding-checklist.tsx` | Ocultar en ruta exacta `/backoffice/counter`. |
| `apps/merchant/src/app/globals.css` | Estilos móviles, pie fijo y área segura. |
| `apps/merchant/src/app/api/counter/resolve/route.ts` | Pasar y validar el local enviado en el escaneo. |
| `apps/merchant/src/server/counter/resolve.ts` | Filtrar catálogo por local y leer historial personal dentro del negocio. |
| `apps/merchant/src/server/counter/grant.ts` y validación de productos asociada | Rechazar productos que no estén disponibles en el local de la venta. |
| Tests existentes de carrito, resolve, grant y una prueba E2E de Mostrador | Ampliar casos que cubran las reglas nuevas. |
| `docs/INDEX.md` | Indexar esta spec. |

La implementación conserva las rutas y el esquema existentes; añade campos a una respuesta interna. No hay migración. La persistencia sigue siendo una orden detallada con `order_item` por línea y otorgamiento idempotente (`0030`). El canje (`0055`) y los cupones conservan sus controles. Este diseño deja piezas reutilizables para una eventual toma de pedidos, pero abrir mesas, imprimir y cerrar órdenes requiere una spec separada.

**Disjunta:** no; comparte Mostrador y CSS global con cualquier trabajo abierto de esas superficies. Antes de implementar, revisar el INDEX vigente y serializar colisiones.

## Definition of Done y verificación

- [ ] Con el catálogo real de Café Plátano, un operador agrega y corrige 1, 3 y 6 líneas desde un teléfono sin depender de escribir para encontrar productos categorizados; el resultado persistido contiene exactamente los `order_item` esperados.
- [ ] Cliente recurrente: los atajos provienen solo de compras detalladas del mismo negocio y local; cliente nuevo: el catálogo completo sigue disponible. Una última compra con producto eliminado no ofrece carga masiva.
- [ ] Catálogo sin categorías, sin productos y con producto sin precio: cada estado muestra salida válida y no permite acreditar un importe inválido.
- [ ] Un producto restringido a otro local no se muestra y el servidor lo rechaza aunque se envíe por API. Una falla de red no pierde el carrito ni duplica puntos/sellos al reintentar.
- [ ] En 320/375/430 px y texto al 200 %, se puede alcanzar el último artículo, editar cantidad y acreditar con un toque; el resumen se puede abrir para revisar y el checklist o pie no tapan acciones.
- [ ] Baseline y rediseño tienen hoja de medición completa; se publica tabla de mediana, p90, exactitud y discrepancias de precio, con decisión de mantener o iterar. No se afirma una mejora antes de medirla.
- [ ] Tests de los selectores puros de categoría/hábito/carrito y pruebas de integración de aislamiento/validación; gates del repositorio y revisión independiente antes de marcar `implementada`.

## Abierto

Nada que bloquee la implementación. El piloto registra el momento exacto de la segunda carga y verifica con el catálogo real la proporción de artículos categorizados, sin precio y con diferencias respecto al ticket Loyverse.
