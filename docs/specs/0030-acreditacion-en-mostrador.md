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
> Depende de la spec **0028** (QR personal + membresía) y del **catálogo de productos**
> (**spec 0034, cerrada** el 2026-08-14; reencuadra el catálogo de 0002 y difiere el de
> beneficios de 0021).
>
> **Decisiones heredadas del ADR 0033 (2026-08-14), a incorporar al cerrar:**
> - **Resolución del QR desambiguada por el negocio que escanea.** El barcode del pase lleva el
>   `qr_token` **global** del consumidor (una sola credencial "Mi Pasaporte" para todos los
>   programas). El staff resuelve `qr_token` → consumidor, y la membresía se resuelve por el
>   **negocio en el que se escanea** (`(consumidor, programa del negocio)`), no por el token.
> - **Auto-enrolamiento por escaneo.** Si el consumidor ya existe (se enroló en otro comercio)
>   pero **no** es miembro del programa de este negocio, escanear su credencial lo **da de alta
>   on-the-fly** (crea la membresía) sin re-registro — efecto de red, cero fricción. Matiz de
>   consentimiento: el escaneo es un gesto físico consentido y los **términos del programa quedan
>   siempre accesibles** en "Ver mis programas" (spec 0031).

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
- **Catálogo de productos** (**spec 0034, cerrada**) — de dónde salen los productos y su
  precio. **Prerequisito duro**: sin catálogo, el carrito no tiene valores. El **valor en
  puntos NO viene del producto**: se deriva de la equivalencia `$X = Y puntos` que esta spec
  agrega al programa.
- **ADR 0002/0007** — aislamiento y auditoría por comercio; **ADR 0027/0028** — versiones y
  reglas del programa de sellos.

> **RESUELTO por la spec 0036 (implementada 2026-08-14), a consumir al cerrar:** la
> «equivalencia `$X = Y puntos`» ya existe como la **mecánica de acumulación** del programa
> (`accrual_grant`/`accrual_block_amount`), y las «reglas de sello `1-por-compra` /
> `1-por-cada-$X`» son `accrual_mode` (`per_purchase`/`per_amount`). El **cálculo del
> otorgamiento** está fijado en `computeAccrual` (`server/loyalty-program/accrual.ts`:
> `per_amount = floor(total/Y)×X` sin arrastre; `per_purchase = X`) y los **premios canjeables**
> viven en `core.loyalty_reward` (con `points_cost`). 0030 los **consume**, no los redefine.

## Abierto (bloquea el cierre)

- Modelo de **saldo de puntos y progreso de sellos por membresía** (tablas nuevas en `consumer`,
  con auditoría por evento — patrón de la spec 0024). **Es el núcleo nuevo de 0030.**
- **Ejecución del canje**: descontar puntos / resetear la tarjeta de sellos (atómico + auditoría),
  usando las definiciones de `core.loyalty_reward` (0036). 0036 define; 0030 ejecuta.
- **Resolución del `qr_token` → consumidor** desambiguada por el negocio que escanea +
  **auto-enrolamiento por escaneo** (ADR 0033).
- **Autorización del staff** sobre el QR de un consumidor (qué ve, qué puede otorgar; ADR 0002/0007).
- **UI de carrito** con productos del catálogo (0034) → `total` → `computeAccrual` (0036).
