---
name: qa-cupon-valido
description: TEMPORAL (QA del owner, desde 2026-10-04). Deja usables DESDE HOY todos los cupones (bienvenida «desde mañana» incluida) de los comercios de prueba Panaderia, Barberia y Gym en PROD, por MCP de Neon. Uso `/qa-cupon-valido`. Nunca toca otro comercio ni revive cupones vencidos.
---

# Cupones de prueba validos desde hoy

Atajo de `/qa-cupones-prueba habilitar` (misma regla, mismo alcance). Pedido del owner (2026-10-04): probar la
bienvenida hoy y no mañana. Temporal: se borra con los datos de prueba.

- PROD: proyecto `red-violet-38772073`, rama `br-curly-silence-ax8acywm`.
- `<IDS>` = `array['f3f74630-b583-4ab7-9bc3-4d47bd2f3fb0','c512bbd2-b203-43f6-8fe5-24778387a331','02e37e89-66a4-4d1e-9f92-d83e6f4856af']::uuid[]`
  (Panaderia, Barberia, Gym). Ningun otro.

**1. Habilitar** (`mcp__neon__run_sql`):

```sql
update core.campaign_coupon set valid_from = now()
where business_id = any(<IDS>) and valid_from > now() and valid_until > now()
returning id, label_snapshot, valid_from, valid_until;
```

**2. Mostrar el estado** (`mcp__neon__run_sql`) y darle al owner la tabla (comercio, cupon, cliente, desde, hasta):

```sql
select b.name comercio, cc.label_snapshot cupon, a.first_name cliente, cc.valid_from, cc.valid_until,
  cc.valid_from <= now() and cc.valid_until > now() usable_hoy
from core.campaign_coupon cc
join core.business b on b.id = cc.business_id
join consumer.consumer_account a on a.id = cc.consumer_id
where cc.business_id = any(<IDS>)
order by b.name, cc.created_at;
```

Cero filas en el paso 1 no es error: no habia cupones «desde mañana». Los vencidos no se reviven (es otra decision).
