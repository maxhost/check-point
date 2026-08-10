---
fecha: 2026-08-10
resumen: Las campañas se evalúan como reglas tipadas, presupuestadas e idempotentes sobre eventos confiables, no como flujos ad-hoc.
estado: aceptada
---

# ADR 0018 — Incentive Engine de campañas compuestas

## Contexto

Una campaña de Mi Pasaporte puede combinar objetivos, locales, horarios, compras,
juegos, puntos, cupones y límites. Implementar cada caso como lógica particular del
wizard produciría reglas inconsistentes, canjes duplicados y métricas imposibles de
explicar. El patrón de *rules + effects + budgets* de motores de incentivos como
Talon.One es útil, pero su DSL empresarial, carros, bundles y configuración libre no
son necesarios para el piloto.

## Decisión

Se construye un **Incentive Engine interno**, limitado y determinista. Recibe un evento
de dominio ya autorizado y confiable, evalúa las versiones activas de campaña del
negocio/local y emite efectos tipados dentro de una única transacción.

Una campaña tiene una o más reglas. Cada regla contiene exactamente un disparador,
condiciones que se combinan con `AND`, efectos tipados, límites/presupuesto y una
política de acumulación. Cuando haga falta un `OR`, el wizard crea reglas separadas;
no se expone un editor de expresiones arbitrarias.

La ejecución sigue este contrato:

```text
evento confiable e idempotente
→ campañas activas y locales elegibles
→ regla con disparador coincidente
→ condiciones, horarios, límites y economía
→ política de conflictos
→ efectos atómicos + activos en wallet + auditoría + métrica
```

Los efectos iniciales son: otorgar puntos, emitir cupón, otorgar crédito de juego y
registrar un resultado de campaña. Check-in, compra acreditada y finalización de juego
son los disparadores iniciales. Reservas, promociones de terceros, referencias,
descuentos de carro, bundles, atributos arbitrarios y webhooks quedan fuera de V1.

Cada activación publica una versión inmutable. Un beneficio, crédito o decisión de
canje conserva el snapshot de la campaña/regla/efecto que lo originó, además de sus
referencias. Editar una campaña activa crea una revisión posterior; no reinterpreta la
historia ni activos ya emitidos.

Los límites se declaran por campaña, local, consumidor, compra, cupón o juego según
corresponda. Antes de emitir efectos, el servidor los verifica y aplica el guardrail de
economía definido en ADR 0002. Una repetición del mismo evento no vuelve a otorgar
valor. Si falla una condición, límite, conflicto o efecto, no se persiste ningún efecto
parcial de esa evaluación.

El wizard ofrece plantillas de objetivos y bloques cerrados; no un creador genérico de
automatizaciones. Debe incluir una simulación sin persistencia que explique reglas
elegibles/no elegibles, efectos proyectados, consumo de presupuesto y guardrails.

## Consecuencias

- Wizard, consola de staff, ruleta, wallet y métricas consumen un contrato común y
  auditable.
- La configuración conserva flexibilidad comercial sin permitir reglas imposibles de
  probar o de explicar a un bar.
- El MVP puede empezar con pocas plantillas (compra → puntos/crédito, check-in →
  beneficio y evento → cupón) y ampliar tipos sin reescribir las campañas existentes.
- No se compra ni replica Talon.One: su modelo inspira la composición, pero el producto
  conserva sus reglas, costes y UX propios.
