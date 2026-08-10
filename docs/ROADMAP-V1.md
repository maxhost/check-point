# Roadmap V1 — Mi Pasaporte

## Meta de la V1

En dos bares aliados, demostrar que el dueño puede configurar su propio programa de marketing, que el personal puede asignar y validar beneficios durante servicio y que el consumidor entiende un wallet común y descubre la red. La decisión final del piloto es si cada bar renovaría USD 20/mes.

## Alcance V1

1. Cuenta de consumidor, wallet único y QR personal opaco/revocable, visible en web y Apple/Google Wallet; los beneficios se separan por negocio.
2. Backoffice del negocio: perfil, personal, catálogo de productos, programa de marketing y campañas.
3. Wizard de campaña: objetivo, juego/mecánica, reglas, premios, cupones, cupos, horario y, cuando aplique, coste/precio/margen.
4. Check-in QR por local.
5. App web operativa para dueño/personal: escanear el QR del consumidor, asignar puntos, oportunidades, premios o cupones y validar un cupón.
6. Catálogo de mecánicas de juego; ruleta implementada. Raspadita definida como siguiente mecánica, sin construir aún.
7. Métricas de valor para el negocio: clientes identificados, visitas/check-ins, beneficios asignados, partidas, premios/cupones emitidos y canjeados, retorno y coste/margen cuando el local cargue esos datos.
8. Administrador de Mi Pasaporte: alta de negocios, categorías, rutas y eventos curados; exploración pública de esa red.

## Fuera de V1

- Raspadita y otros juegos, AR, NFC, beacons, tablet o dispensador.
- Premios, puntos u oportunidades transferibles entre locales.
- Integración POS, lectura de factura, pago, inventario real o contabilidad.
- Automatización por WhatsApp, notificaciones, geofencing o publicidad de marcas.
- Marketplace abierto, onboarding autoservicio masivo y campañas multi-sucursal.

## Secuencia

| Fase | Resultado demostrable | Specs | Criterio de salida |
|---|---|---|---|
| 0. Contrato de producto | Alcance, reglas y arquitectura antes de código | ADR 0001–0005; specs 0001–0009 | Specs cerradas y aprobadas; arquitectura transversal decidida |
| 1. Base y configuración | Cuentas, roles, negocio, catálogo y programa | 0001–0003 | Un bar puede configurar su primera campaña |
| 2. Consumidor y operación | Wallet, check-in, escáner y asignación/canje | 0004–0006, 0009 | Flujo completo en dos teléfonos en menos de 30 s sin fallas |
| 3. Juego | Ruleta conectada a oportunidades y cupones | 0006 | Un premio se emite y canjea una sola vez |
| 4. Red y medición | Tablero del dueño, administrador, rutas/eventos | 0007–0008 | Métricas coinciden con eventos y ruta se explora |
| 5. Piloto | Dos bares operan una campaña real | Operación, no nuevas features | Decisión de renovar o iterar según datos |

## Orden de implementación

1. 0001 — Fundación, roles y aislamiento por local.
2. 0002 — Backoffice del negocio y catálogo.
3. 0003 — Programa y wizard de campaña.
4. 0004 — Cuenta de consumidor y wallet.
5. 0009 — Check-in QR.
6. 0005 — App operativa de personal: asignación y validación.
7. 0006 — Catálogo de juegos, ruleta y cupón atómico.
8. 0007 — Métricas del negocio.
9. 0008 — Administrador de plataforma, rutas y eventos.

Las specs son intencionalmente seriales: comparten modelo de dominio, autenticación y eventos. La paralelización se reconsidera solo cuando el repositorio y esos contratos existan.
