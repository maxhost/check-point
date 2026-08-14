---
spec: 0030
fecha: 2026-08-14
estado: borrador
resumen: Consola de staff para acreditar consumo — escanear el QR del consumidor, armar el "carrito" de productos y otorgar puntos/sellos según las reglas del programa; tercera rebanada del camino A.
disjunta: no
archivos: por definir (depende de 0028 y del catálogo económico, specs 0002/0021)
---

# 0030 — Acreditación en mostrador

> **Stub — reserva de alcance.** No cerrada. Tercera rebanada del camino A (ADR 0031).
> Depende de la spec **0028** (QR personal + membresía) y de un **catálogo económico de
> productos** (specs 0002/0021, hoy en borrador).

## Problema

El enrolamiento (0028) crea la membresía pero nadie puede todavía otorgarle valor. El flujo
del owner: el encargado escanea el QR del consumidor, arma un "carrito" con lo que la persona
compró, y el sistema otorga puntos/sellos según las reglas del programa. Sin esta pieza, el
loop de fidelización no cierra.

## Alcance (tentativo)

**Entra:** resolución del QR personal a la identidad+membresía (staff autorizado del negocio,
nunca de otro); UI de carrito con productos del catálogo; cálculo y otorgamiento de
puntos/sellos con las reglas:
- **Puntos:** suma del valor en puntos de cada producto (p.ej. A+B+C = 30).
- **Sellos "1 por compra":** un sello por transacción, sin importar cuántos productos.
- **Sellos "1 por cada $X":** `floor(total / X)` sellos (p.ej. $20 con umbral $10 = 2 sellos).
Idempotencia, atomicidad y auditoría del otorgamiento (es asignación de valor); actualización
del saldo de la membresía.

**No entra:** el catálogo económico en sí (su propia spec); el pase de Wallet (0029); la
notificación al consumidor (0031, aunque este otorgamiento la dispara).

## Dependencias

- **Spec 0028** — QR personal + `program_membership` (los saldos se agregan aquí).
- **Catálogo económico** (specs 0002/0021) — de dónde salen los productos y su valor en
  puntos/sellos. **Prerequisito duro**: sin catálogo, el carrito no tiene valores.
- **ADR 0002/0007** — aislamiento y auditoría por comercio; **ADR 0027/0028** — versiones y
  reglas del programa de sellos.

## Abierto (bloquea el cierre)

- Modelo de saldo de puntos y progreso de sellos por membresía (tablas nuevas en `consumer`
  o `core`), con auditoría por evento (patrón de la spec 0024).
- Reglas de sello configurables por programa (1-por-compra vs 1-por-cada-$X): dónde se
  configuran (extiende el modelo de programa de la 0027) y su validación.
- Autorización del staff sobre el QR de un consumidor (qué ve, qué puede otorgar).
- Definición del catálogo económico como spec previa o concurrente.
