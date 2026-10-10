---
name: extender-prueba
description: TEMPORAL (hasta el panel de plataforma, spec propia del ADR 0134 §3). Extiende —o lleva al pasado, para el QA— la prueba gratis de UN comercio moviendo `core.subscription.trial_ends_at`. Uso `/extender-prueba <slug|nombre> <+N dias | AAAA-MM-DD> [local]` (sin `local` = PROD por MCP de Neon). Se niega si el comercio tiene una suscripcion de Stripe VIVA. Nunca imprime secretos.
---

# Extender la prueba de un comercio

ADR 0134 §3 (owner, 2026-10-10): la fecha de fin de la prueba **se guarda** para poder extenderla a mano mientras crece
la red. Hasta que exista el panel de plataforma (`admin.checkpass.club`), la extiende Claude con esta skill. **Temporal:**
se borra cuando el panel lo haga.

## Alcance fijo — no se amplia sin el owner

- Toca **una sola columna** (`trial_ends_at`) de **una sola fila** (`core.subscription` de UN `business_id`), verificada
  por `SELECT` antes y despues. Nada mas: ni `plan`, ni `status`, ni Stripe, ni campañas.
- **PROD:** proyecto Neon `red-violet-38772073`, rama `br-curly-silence-ax8acywm` (pasar los dos siempre), por
  `mcp__neon__run_sql` / `mcp__neon__run_sql_transaction`. **Local** (`local`): la base de Docker del ambiente local
  (`docker compose -f tools/local-db/compose.yaml exec -T pg psql -U postgres -d neondb -c "…"`), nunca PROD.
- **Se niega** si el comercio tiene una suscripcion de Stripe VIVA (`stripe_subscription_id` puesto y `status` fuera de
  `canceled`/`incomplete_expired`): ese comercio ya paga o esta en el `trialing` de Stripe, y extenderle la prueba
  exige mover el `trial_end` EN STRIPE (fuera de alcance de la spec 0189). Se lo dice al owner con esas palabras.

## Pasos

**1. Encontrar el comercio.** `<Q>` = lo que dio el owner (slug o nombre):

```sql
select b.id, b.name, b.slug, b.status, s.plan, s.status as sub_status, s.stripe_subscription_id is not null as tiene_stripe,
  s.trial_ends_at
from core.business b
left join core.subscription s on s.business_id = b.id
where lower(b.slug) = lower('<Q>') or lower(b.name) like '%' || lower('<Q>') || '%';
```

Exactamente uno → seguir. Ninguno o varios → mostrar la lista y preguntar. Nunca adivinar. Sin fila de suscripcion → no
se crea una: avisar al owner (todo negocio tiene la suya desde el alta; si falta, es otro problema).

**2. Negarse si hay suscripcion viva** (`tiene_stripe` y `sub_status` no es `canceled` ni `incomplete_expired`).

**3. La fecha nueva.** `+N dias` = **desde el fin actual si la prueba sigue vigente, desde ahora si ya vencio**
(`greatest(trial_ends_at, now()) + interval 'N days'`), para que extender siempre deje dias de verdad. Una fecha
`AAAA-MM-DD` = esa fecha a las 23:59:59 de Guayaquil (`'AAAA-MM-DD 23:59:59 America/Guayaquil'::timestamptz`); en
`local` se acepta una fecha pasada (es como se prueba el bloqueo). En PROD, una fecha pasada BLOQUEA al comercio: se le
pide confirmacion explicita al owner antes.

**4. Escribir, una fila** (`<ID>` = el id del paso 1):

```sql
update core.subscription set trial_ends_at = <FECHA>, updated_at = now()
where business_id = '<ID>'
returning business_id, plan, trial_ends_at;
```

Si `returning` no devuelve exactamente una fila, parar y avisar.

**5. Releer** con el `SELECT` del paso 1 y mostrar antes/despues (fecha y dias que quedan).

**6. Las campañas.** Si el comercio estaba BLOQUEADO, sus campañas quedaron pausadas con `billing_blocked`; vuelven en
el proximo barrido diario (`/api/internal/billing-sweep`, cron `35 5 * * *` UTC). Si el entorno tiene `CRON_SECRET`, se
puede correr ya — **sin imprimir el secreto** y siempre contra `www.` (el apex hace 308):

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://www.checkpass.club/api/internal/billing-sweep \
  -H "authorization: Bearer $CRON_SECRET"
```

En `local`, el mismo `POST` contra `http://localhost:3201/api/internal/billing-sweep` con el `CRON_SECRET` del merchant
local. El panel, el mostrador y el POS vuelven en el acto (los guards leen la fecha en cada request).
