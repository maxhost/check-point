---
adr: 0153
fecha: 2026-10-17
estado: aceptada
resumen: Todo dato que alimenta Analíticas nace como evento guardado en la transacción de su origen, igual que sale.closed; los traductores a métricas son funciones puras sobre el evento y Analíticas no lee tablas de origen.
---

# 0153 — Analíticas se alimenta solo de eventos

**Estado: aceptada** por el owner el 2026-10-17. Precisa el ADR 0152 §4 (resúmenes diarios con vocabulario del core
que los módulos alimentan por eventos). Diseño documental: no autoriza implementación ni migración.

## Contexto

El primer borrador de la spec 0237 tomaba dos atajos: Recetas leía sus tablas para dar el costo de una venta y
respondía «todavía no» hasta aplicar el consumo, y el core sumaba visitas y canjes directo a los resúmenes, sin
evento. El owner: «lo correcto es hacer que cada módulo guarde los datos como venta cerrada del POS para seguir un
patrón consistente».

## Decisión

1. **Todo dato que alimenta Analíticas se guarda como `module_event` en la misma transacción que su origen**, como
   `sale.closed` en el cierre del POS. Vale para módulos y para core (comisión congelada, visitas, canjes).
2. **Un traductor a métricas es una función pura sobre el evento**: sin transacción, sin lecturas de base, sin
   reloj. Lo declara el dueño del tipo de evento (módulo en `SERVER_MODULES`, core en su registro).
3. **Analíticas no lee tablas de origen.** Si a una métrica le falta un dato (un nombre, un costo), el evento suma
   ese dato en una versión nueva; no se compensa con una lectura.
4. Un dato derivado de otro módulo (el costo de lo vendido, que sale del consumo de Recetas sobre Stock) se publica
   como evento propio de quien lo calcula, en la transacción en que lo calcula (`recipes.consumption.applied`).

## Consecuencias

- La spec 0237 suma `sale.closed` v3 (nombre del producto), `sale.commission.frozen`, `recipes.consumption.applied`,
  `recipes.product_cost.changed`, `visit.recorded` y `coupon.redeemed`.
- Los resúmenes se pueden recalcular desde el log de eventos, sin depender del estado actual de las tablas.
- Ventas guardadas antes de estos eventos no tienen costo ni comisión en Analíticas; no se reconstruyen.

## Referencias

- ADR 0152, 0151, 0138/0139. Spec 0237 §2.2.
