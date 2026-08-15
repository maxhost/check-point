---
fecha: 2026-08-14
resumen: El catálogo es de productos (no de beneficios), vive en `core`, es global por negocio con visibilidad opt-out por local; precio y coste son opcionales, la conversión a puntos vive en el programa (equivalencia `$X = Y puntos`, no por producto), y la acreditación snapshotea el producto para que editar/borrar el catálogo nunca altere el wallet ya otorgado.
estado: aceptada; reencuadra el catálogo de 0002 y difiere el catálogo de beneficios de 0021
---

# ADR 0034 — Catálogo de productos por negocio

## Contexto

El pivote merchant-first (ADR 0031/0033) dejó a la acreditación en mostrador (spec 0030)
como la próxima rebanada: el staff escanea el QR del consumidor, arma un "carrito" y el
sistema otorga puntos/sellos. Ese carrito necesita **productos con valor económico** que
hoy no existen: no hay ninguna tabla de producto en el esquema (verificado en `schema/*`).

Las dos specs que definían "catálogo" son **anteriores al pivote** y no encajan tal cual:

- **Spec 0002** es un grab-bag de backoffice (perfil, marca, staff, programa, catálogo) que
  ya está **implementado por otras specs** —marca→0025, staff→0016, programa→0024,
  negocio/local→0022—. Lo único vivo y sin implementar es el **catálogo de productos**. Dejó
  además una decisión explícitamente abierta: *"la pertenencia exacta de catálogo/producto
  (negocio con variantes por local, o solo local) se cerrará al profundizar esta spec."*
- **Spec 0021** es un **catálogo de *beneficios*** (cupones/premios para campañas, juegos,
  ruleta), un motor distinto cuyos consumidores —el wizard de campañas y el Incentive
  Engine— están **todos diferidos** con la fase de campañas. Cerrarla hoy sería andamiaje
  sin tarea que lo consuma.

Hechos del código: el esquema `core` ya aloja `business`, `location`, `loyalty_program` y
el pipeline de imágenes R2 con borrado diferido (`server/assets/image.ts`, patrón marca/
sello). El backoffice real vive en `apps/merchant/src/app/backoffice` (`brand`, `loyalty`
reales; `demo/*` es el mock viejo). El negocio tiene `country_code` pero **no** moneda.

## Decisión

1. **Catálogo de *productos*, no de beneficios.** Un producto tiene nombre, categoría
   opcional, **precio de venta opcional**, **coste unitario opcional** e imagen opcional.
   No lleva vigencia, cupo, audiencia ni reglas de distribución (eso es del beneficio/
   campaña, diferido). El **catálogo de beneficios de la spec 0021 se difiere** con las
   campañas.

2. **Vive en `core`, es del negocio.** Tablas nuevas en el esquema `core`
   (`product`, `product_category`, `product_location`), FK a `core.business`. Es data del
   comercio, no del consumidor: no toca `consumer` ni `merchant_auth`. Migración aditiva.

3. **Global por negocio, visibilidad opt-out por local.** El owner arma el catálogo **una
   vez** a nivel negocio. Cada producto está por defecto **disponible en todos los locales**
   (`available_all_locations = true`); si el owner lo restringe, se listan los locales
   habilitados en `product_location`. En el mostrador (0030) el staff de un local solo ve lo
   visible a *su* local. Esto realiza la decisión que 0002 dejó abierta: **catálogo por
   negocio con acceso por local**, no catálogo por local.

4. **Precio y coste opcionales; el programa es la fuente de verdad del valor.** El "valor en
   puntos" **no** es un campo del producto: el programa de puntos define la **equivalencia
   `$X = Y puntos`** (extensión del modelo de 0024/0027, implementada en 0030, no acá). Así
   el catálogo queda desacoplado del tipo de programa y no hay que reconfigurar puntos
   producto por producto. Con precio, el total del carrito sale del catálogo; **sin precio,
   el staff tipea el monto** al escanear. El coste es opcional —solo alimenta analítica y el
   guardrail futuro de campañas—: exigirlo hoy sería andamiaje sin su consumidor (el
   guardrail de margen del ADR 0002 pertenece al wizard de campañas, diferido). La UI
   **recomienda** cargar el precio para habilitar puntos por consumo y analítica.

5. **Snapshot en la acreditación.** La asignación de valor (0030) guarda un **snapshot** del
   producto (nombre, precio, categoría) y de la conversión aplicada. Editar, re-precificar o
   **borrar** un producto del catálogo **nunca** reescribe el wallet ya otorgado. Por eso el
   catálogo **no necesita estados** (`draft`/`archived`): es una superficie de trabajo del
   staff; el historial vive en el ledger de 0030, no en el producto. Se puede borrar directo.

6. **Categorías gestionadas y libres.** El owner **crea** sus categorías (entidad
   `product_category` por negocio) y asigna productos a ellas; la asignación es opcional. Son
   libres para servir a cualquier rubro (no la lista fija de bar de 0002). Borrar una
   categoría no borra sus productos (quedan sin categoría).

7. **Moneda por negocio.** El precio necesita moneda para que "monto → puntos" sea coherente.
   Se agrega `currency_code` (ISO 4217) a `core.business`, default derivado del país,
   editable por el owner. Una moneda por negocio, no por producto (no hay caso multi-moneda).

8. **Imágenes a R2, reusando el pipeline existente** (`server/assets/image.ts`, upload
   firmado + borrado diferido, patrón marca/sello). El DTO al cliente **nunca** serializa
   `image_object_key` (regla anti-fuga de CLAUDE.md): expone solo `imagePath`. Test por
   entidad.

## Consecuencias

- **Reencuadra la spec 0002** (como se hizo con 0004): su catálogo migra a la **spec 0034**;
  el resto de 0002 ya está implementado. **Difiere la spec 0021** (beneficios) hasta que
  existan las campañas/Incentive Engine que la consuman.
- **Desbloquea la spec 0030**: el carrito ya tiene de dónde sacar productos y precio. Crea un
  ítem de trabajo sobre el **modelo del programa de puntos** (tasa `$→puntos`), que se
  implementa en 0030/enmienda de loyalty, no en 0034.
- **Migración aditiva**: `product`/`product_category`/`product_location` + `currency_code` en
  `business` (backfill derivado del país). No toca `consumer` ni `merchant_auth`.
- **Nueva superficie real** en `/backoffice/catalog` con su tarjeta de navegación en el home;
  reusa `ModuleHeader`, `ConfirmDialog`, toast y el pipeline de imagen. No usa el árbol
  `demo/*`.
- El guardrail de margen (ADR 0002) y el snapshot de reglas de distribución (0021) siguen
  **válidos pero diferidos**: reviven cuando se implementen las campañas.

## Referencias

- ADR 0002 — coste/guardrail económico por local (guardrail diferido con campañas).
- ADR 0021 — analíticas universales (el precio alimenta la lente de venta/ticket).
- ADR 0031/0033 — merchant-first; acreditación por escaneo del QR global.
- Spec 0030 — acreditación en mostrador (consumidor del catálogo).
- Spec 0024/0027 — programa de fidelización (aloja la equivalencia `$→puntos`).
