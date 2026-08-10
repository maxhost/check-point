---
fecha: 2026-08-09
resumen: La V1 se limita a bares y prueba campañas autoconfigurables, con compra acreditada y control de margen.
---

# ADR 0001 — V1: campañas rentables para bares

## Contexto

Los QR, las cartillas digitales y el wallet sin app ya son ofertas disponibles en Ecuador. La hipótesis distintiva de Mi Pasaporte es que un local puede crear y operar una promoción jugable que persigue un comportamiento de consumo rentable, sin intervención del equipo de Mi Pasaporte.

## Decisión

La V1 atiende exclusivamente a bares aliados. Incluye una sola mecánica, la ruleta, después de una compra acreditada por un miembro del personal. El local configura productos, costes, precios, premios, probabilidades, vigencia y franja horaria mediante un wizard que muestra el coste promocional y bloquea premios que produzcan margen bruto negativo.

La señal de éxito es que un dueño configura una campaña, su personal la opera y el tablero muestra oportunidades emitidas, partidas, cupones canjeados, coste de premios y margen bruto atribuible. La renovación de USD 20/mes es la validación comercial.

## Consecuencias

- No se construyen juegos distintos de la ruleta, realidad aumentada, puntos globales, campañas de marcas, POS, beacons ni hardware.
- El wallet del consumidor es único, pero los saldos y cupones pertenecen a un local y no pueden canjearse en otro.
- La ruta inicial puede listar los dos bares, pero no intercambia valor entre ellos.
- La acreditación de compra mediante consola de personal es la fuente de verdad de la campaña durante el piloto.
