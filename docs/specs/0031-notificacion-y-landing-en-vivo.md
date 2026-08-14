---
spec: 0031
fecha: 2026-08-14
estado: borrador
resumen: Al otorgarse puntos/sellos, el consumidor recibe una notificación en su Wallet ("La Gringa te dio…") si ya agregó el pase; si no, la landing de enrolamiento se actualiza en vivo mostrando el resultado sobre la tarjeta del programa; cuarta rebanada del camino A.
disjunta: no
archivos: por definir (depende de 0028, 0029 y 0030)
---

# 0031 — Notificación y landing en vivo

> **Stub — reserva de alcance.** No cerrada. Cuarta rebanada del camino A (ADR 0031).
> Cierra el loop: depende de **0028** (identidad/landing), **0029** (pase) y **0030** (el
> otorgamiento que dispara el aviso). El **canal de push** se separó a la **spec 0033**; esta
> spec lo consume.
>
> **Alcance heredado del ADR 0033 (2026-08-14):** el enlace **"Ver mis programas"** del pase
> (spec 0029, con `web_view_token` dedicado y revocable) apunta a esta superficie web. Aquí vive
> el **dashboard rico de consumidor**: cada programa con su `CardPreview` (spec 0027), su
> progreso (puntos/sellos) y sus **términos accesibles** (soporta el consentimiento del
> auto-enrolamiento de la 0030). La 0029 solo entrega la ruta mínima que resuelve el token; el
> render rico es de esta spec.

## Problema

Cuando el encargado otorga puntos/sellos (0030), el consumidor debe enterarse en el momento.
Dos caminos según el estado del consumidor:
- **Ya agregó el pase a la Wallet:** recibe una **notificación push** del pase ("La Gringa te
  dio 30 puntos"/"…un sello").
- **Todavía no agregó el pase** (sigue en la landing de 0028): la landing se **actualiza en
  vivo** mostrando los puntos obtenidos o los sellos marcados sobre la tarjeta con el diseño
  del programa (reusa `CardPreview`, spec 0027).

## Alcance (tentativo)

**Entra:** disparo de la notificación push del pase al otorgar (0030 → canal de 0029);
mecanismo de actualización en vivo de la landing (polling o realtime) para el consumidor sin
pase; render del resultado sobre la tarjeta del programa.

**No entra:** el otorgamiento en sí (0030); la emisión del pase (0029); notificaciones de
marketing/campañas (futuro, tier Plus).

## Dependencias

- **Spec 0030** — evento de otorgamiento que dispara el aviso.
- **Spec 0033** — canal de push del pase de Wallet (separado de la 0029).
- **Spec 0029** — pase emitido + enlace "Ver mis programas" (esta superficie).
- **Spec 0028** — landing y sesión de consumer para la actualización en vivo.
- **Spec 0027** — diseño de tarjeta para renderizar el resultado.

## Abierto (bloquea el cierre)

- Mecanismo de "landing en vivo": polling simple vs canal realtime; ventana de tiempo que la
  landing queda escuchando.
- Contenido y formato exacto de la notificación del pase (Apple/Google).
- Qué pasa si el consumidor cierra la landing antes del otorgamiento y aún no tiene pase
  (¿se pierde el aviso hasta que consulte, o hay un fallback?).
