---
fecha: 2026-08-11
resumen: Analíticas parte de eventos universales verificables y habilita lentes por rubro sólo cuando sus datos existen; no infiere ingresos ni causalidad.
estado: aceptada
---

# ADR 0021 — Analíticas universales y lentes por rubro

## Contexto

Mi Pasaporte inicia con bares y panaderías, pero debe servir a hoteles, retail y otros
negocios locales. Un tablero diseñado alrededor de bebidas o de un POS no es portable.
Mostrar revenue, ROI o atribución sin ventas acreditadas produciría números ficticios.

Talon.One relaciona campañas con sesiones, efectos, redenciones, costes y presupuesto;
Foursquare mostró el valor de visitas únicas, nuevos/recurrentes y distribución temporal
para locales físicos. Captain Up prioriza engagement y retención en hospitality.

## Decisión

### Núcleo universal

Las analíticas parten de hechos inmutables e idempotentes, con hora UTC y zona horaria
efectiva del local. Se filtra por periodo, negocio, local, campaña y programa.

Las métricas comunes son: clientes únicos/nuevos/recurrentes, frecuencia y retorno 7/30
días; interacciones validadas; beneficios emitidos/canjeados/vencidos/rechazados; progreso
de fidelidad; embudo `elegible → interacción validada → beneficio emitido → canje`; y
distribución por local, día y franja, incluidos rechazos por razón.

Cada métrica expone su calidad: **observada** (evento validado), **estimado configurado**
(coste/valor declarado), **transaccional** (venta acreditada) o **no disponible**. La UI no
estima ni sustituye una fuente no disponible.

### Lentes por rubro

El núcleo no cambia por categoría. Un lente sólo añade nombres y dimensiones cuando su
operación produce el evento correspondiente:

| Rubro | Interacción principal | Lente inicial |
|---|---|---|
| Bar/restaurante | visita/check-in o compra acreditada | día/franja, retorno y demanda |
| Hotel | estadía/servicio acreditado | huéspedes recurrentes, estadías y servicios |
| Retail | compra acreditada | recompra, categoría/producto y temporada |

Un lente no habilita por sí solo datos económicos: Retail sólo muestra ticket/ventas con
`purchase_credited`; Hotel no muestra ocupación sin inventario confiable.

### Hechos y límites

El backend futuro persiste un log append-only: `event_id`, hora, negocio/local/zona,
campaña y versión opcionales, programa y versión opcionales, consumidor pseudónimo,
correlación, origen, resultado y rechazo. Efectos incluyen tipo, cantidad y coste/valor;
ventas acreditadas añaden transacción, moneda, bruto/neto, descuento, coste/margen e
ítems. Eventos base: check-in iniciado/válido/rechazado, elegibilidad, beneficio/cupón,
progreso/canje de fidelidad y cambios de campaña/presupuesto. Compras, estadías y
servicios se incorporan sin cambiar los hechos existentes.

No se afirman revenue influenciado, ROI, uplift, A/B, LTV, predicción, demografía o
atribución causal hasta contar con fuente, consentimiento, baseline y volumen suficientes.

## Consecuencias

- El wizard solicita objetivo medible, locales, horario/zona, elegibilidad, recompensa,
  límites y coste cuando aplica.
- Analíticas se compone de resumen universal, detalle de campaña y lentes opcionales.
- La UI mock usa fixtures Bar/Restaurante, Hotel y Retail. Su selector flotante sólo
  cambia la vista, no la configuración persistida del negocio.

## Referencias

- [Talon.One Application Dashboard](https://docs.talon.one/docs/product/campaigns/analytics/application-dashboard)
- [Talon.One Campaign Insights](https://docs.talon.one/docs/product/campaigns/analytics/campaign-insights)
- [Captain Up Loyalty](https://captainup.com/es/loyalty/)
- [Foursquare Venue Stats](https://docs.foursquare.com/developer/reference/get-daily-venue-stats-over-time)
