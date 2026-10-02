---
adr: 0112
fecha: 2026-10-02
estado: aceptada
resumen: La plantilla «Bienvenida» queda fuera del freno de plan de las campañas: la activa y la entrega cualquier negocio (free, plus o sin plan), con el mismo tope mensual que elige el comercio, y una baja de plan no la pausa ni bloquea. Vive en su propia entrada del catalogo de entitlements (`campaigns.welcome`); el resto de las campañas sigue exigiendo `plus` con suscripcion viva. Refina el «Freno por plan» de la spec 0065 / ADR 0099.
---

# 0112 — La Bienvenida está incluida en todos los planes

## Contexto

Desde la spec 0065 toda campaña exige `campaigns.enabled`: plan `plus` **y** suscripción de Stripe viva
(`packages/domain/src/server/entitlements/catalog.ts:90`). La Bienvenida (spec 0107 / ADR 0099) heredó ese freno en
los cuatro lugares donde se aplica: activarla (`template-store.ts:164`), reanudarla (`campaign-actions.ts:72`),
entregar el regalo (`welcome-store.ts:80`) y la facturación, que al bajar de plan pausa todas las campañas activas
(`plan-brake.ts`) y bloquea la baja si hay alguna (`plan-change.ts`, `downgrade_blocked_campaigns`).

Medido en PROD el 2026-10-02: 7 de 8 negocios en `free`, el `plus` restante sin suscripción viva, **0 campañas**.

El owner (2026-10-02): «la campaña de bienvenida debería estar incluida en el plan free hoy. Porque es una campaña
útil para mí más que para el comercio» — es lo que trae clientes a la red y hace que instalen el pase.

## Decisión

1. **Planes (owner):** la Bienvenida la pueden activar y entregar **free, plus y sin plan** (`none`, o sin fila de
   suscripción). No exige suscripción viva. Un negocio suspendido o impago se sigue frenando por su propio camino
   (`requireApiOwner` → `business_suspended`, ADR 0059/0073), no por el plan.
2. **Tope (owner):** el mismo para todos los planes: el comercio elige su tope mensual como hoy (default 50,
   1..10.000). Ninguna regla distinta por plan.
3. **Baja de plan (owner):** la Bienvenida activa **sigue activa**. El freno defensivo pausa solo las demás
   campañas, y el bloqueo de la baja cuenta solo las demás.
4. **Mecanismo:** una entrada propia del catálogo, `campaigns.welcome` (`flag`, `byPlan` en `true` para los tres
   planes, `fallback: true`, `requiresLiveSubscription: false`). El freno de plan pasa a decidir **por plantilla**:
   `welcome` consulta `campaigns.welcome`; todo lo demás (plantillas y campañas propias) sigue con `campaigns.enabled`.
   Así, cambiar qué planes incluyen la Bienvenida es una línea del catálogo, no una búsqueda por el código.

## Consecuencias

- Los negocios free (p. ej. Plátano Garden) pueden activar la Bienvenida desde hoy; el resto de las plantillas sigue
  devolviendo 402 `plan_not_allowed`.
- El costo del regalo lo pone el comercio (es su producto). La red no paga nada nuevo.
- Un `plus` que baja a `free` conserva su Bienvenida corriendo; el modal de la baja ya no la cuenta.
- El texto de la pantalla de planes que diga «campañas solo en Plus» queda impreciso; la UI la hace el owner
  (ADR 0070), así que se le informa.
