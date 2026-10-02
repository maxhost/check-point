---
adr: 0105
fecha: 2026-09-29
estado: aceptada
resumen: Horas valle es una plantilla de campaña propia (no una opcion de la cruzada) que reusa la lista, el filtro de rubro + 2 km y el reclamo de la oferta cruzada (ADR 0104); se ve solo mientras la franja de ese local esta abierta, a no clientes y dormidos, una vez por persona y por local, y su cupon vale SOLO hasta que cierra la franja de ese dia. El horario de apertura se carga por local, por dia, con hasta 2 rangos.
---

# 0105 — Horas valle es una plantilla y su cupon vale la franja del dia

## Contexto

El ADR 0103 §5 y §10 definio horas valle como un tipo de beneficio (franja propuesta por la red desde los escaneos,
editable por el comercio; publico no clientes y dormidos; beneficio sellos/puntos extra, producto o texto libre;
deteccion de `docs/red-horas-valle-y-modelo.md` §2.3; tope una vez por persona y por local; horario de apertura en
Marca). El ADR 0104 definio la oferta cruzada y su filtro. Faltaba decidir como encajan.

**Owner (2026-09-29, AskUserQuestion):**
- Forma: **«Plantilla propia»** — una campaña aparte, que reusa por dentro la lista, el reclamo y el canje de la
  cruzada.
- Filtro de rubro distinto + 2 km: **«Igual que la cruzada»**, para todos los que la ven.
- Vigencia del cupon reclamado: **«Solo la franja de ese dia»**.
- Horario de apertura: **«Por local, con cortado»** — cada local, por dia de la semana, hasta 2 rangos o cerrado.

## Decision

1. `template_key = 'valley'` («Horas valle»): premio obligatorio (los tipos del ADR 0098 **mas** «texto libre»,
   ADR 0103 §5), cupo mensual, publico fijo **no clientes + dormidos** (ADR 0103 §5; nunca el miembro activo).
2. Se muestra en «Mis beneficios» **solo mientras una franja de ese local esta abierta**, con el filtro de la
   cruzada (ADR 0104 §4) medido contra ESE local.
3. El cupon reclamado vale desde el reclamo **hasta el fin de la franja de ese dia** (hora local del comercio).
4. **Una vez por persona y por local**, para siempre (ADR 0103 §10).
5. Horario de apertura por local: por dia de la semana, 0 (cerrado), 1 o 2 rangos.
6. Franjas: las propone la red (§2.3) y el comercio puede reemplazarlas por las suyas; las del comercio mandan
   hasta que las borre.

## Consecuencias

- Depende de la spec 0136 (filtro, reclamo, cupon sin membresia): se implementa despues de su PASS.
- Nace un tipo de premio `custom` (texto libre), habilitado solo en esta plantilla.
- Con 0 pedidos en PROD, al principio ningun local tiene datos: todas las franjas las carga el comercio.
