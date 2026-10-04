---
name: delete-user
description: TEMPORAL (QA del owner, desde 2026-10-04). Saca a un CLIENTE de prueba de los comercios de prueba (Panaderia, Barberia, Gym) en PROD por MCP de Neon, borrando su tarjeta y todo lo que cuelga de ella para que pueda volver a inscribirse desde cero. Uso `/delete-user <telefono|email|nombre> [panaderia] [barberia] [gym]` (sin comercios = los tres). Nunca toca otro comercio ni borra la cuenta del cliente.
---

# Sacar a un cliente de los comercios de prueba

Pedido del owner (2026-10-04): limpiar rapido a un usuario de prueba de esos comercios para repetir la inscripcion, la
bienvenida y la venta cruzada. **Temporal:** se borra junto con `qa-cupones-prueba` y los datos de prueba.

## Alcance fijo — no se amplia sin el owner

- PROD: proyecto Neon `red-violet-38772073`, rama `br-curly-silence-ax8acywm` (pasar los dos siempre).
- Comercios (UNICOS que se tocan): `panaderia` = `f3f74630-b583-4ab7-9bc3-4d47bd2f3fb0`, `barberia` =
  `c512bbd2-b203-43f6-8fe5-24778387a331`, `gym` = `02e37e89-66a4-4d1e-9f92-d83e6f4856af`. `<IDS>` = el
  `array['…','…']::uuid[]` con los pedidos (sin argumento: los tres). Otro comercio nombrado → se pregunta, no se hace.
- **No borra la cuenta del cliente** (`consumer.consumer_account`), ni su pase de Wallet, ni sus suscripciones push, ni
  nada de otros comercios: solo su relacion con los comercios pedidos.

## Pasos

**1. Encontrar al cliente** (`mcp__neon__run_sql`). `<Q>` = lo que dio el owner (telefono en cualquier formato, email o
nombre):

```sql
select a.id, a.first_name, a.last_name, a.phone_e164, a.email,
  array_agg(distinct b.name) filter (where b.id = any(<IDS>)) comercios_de_prueba
from consumer.consumer_account a
left join core.business_customer bc on bc.consumer_id = a.id
left join core.business b on b.id = bc.business_id
where a.phone_e164 like '%' || regexp_replace('<Q>', '\D', '', 'g') || '%' and regexp_replace('<Q>', '\D', '', 'g') <> ''
   or lower(a.email) = lower('<Q>')
   or lower(a.first_name || ' ' || coalesce(a.last_name, '')) like '%' || lower('<Q>') || '%'
group by a.id;
```

Un solo resultado con algun comercio de prueba → seguir. Ninguno, varios, o sin comercios de prueba → mostrar la lista y
preguntar. Nunca adivinar.

**2. Contar antes** (para mostrar el antes/despues):

```sql
select (select count(*) from consumer.program_membership where consumer_id = '<C>' and business_id = any(<IDS>)) tarjetas,
  (select count(*) from core.campaign_coupon where consumer_id = '<C>' and business_id = any(<IDS>)) cupones,
  (select count(*) from core.coupon_redemption where consumer_id = '<C>' and business_id = any(<IDS>)) canjes,
  (select count(*) from core."order" where consumer_id = '<C>' and business_id = any(<IDS>)) ventas,
  (select count(*) from core.reward_redemption where consumer_id = '<C>' and business_id = any(<IDS>)) premios,
  (select count(*) from core.business_customer where consumer_id = '<C>' and business_id = any(<IDS>)) cliente_de;
```

**3. Borrar** (`mcp__neon__run_sql_transaction`, en ESTE orden: respeta las FKs medidas el 2026-10-04):

```sql
update consumer.consumer_account set selected_coupon_id = null, coupon_selected_at = null
  where id = '<C>' and selected_coupon_id in (select id from core.campaign_coupon where business_id = any(<IDS>));
update core.campaign_turn set outcome = null, outcome_at = null, outcome_redemption_id = null
  where outcome_redemption_id in (select id from core.coupon_redemption where consumer_id = '<C>' and business_id = any(<IDS>));
update core.campaign_turn set outcome_order_id = null
  where outcome_order_id in (select id from core."order" where consumer_id = '<C>' and business_id = any(<IDS>));
delete from core.welcome_device
  where coupon_id in (select id from core.campaign_coupon where consumer_id = '<C>' and business_id = any(<IDS>));
delete from core.coupon_redemption where consumer_id = '<C>' and business_id = any(<IDS>);
delete from core.cross_decision where consumer_id = '<C>' and business_id = any(<IDS>);
delete from consumer.pass_placement where consumer_id = '<C>' and business_id = any(<IDS>);
delete from core.campaign_coupon where consumer_id = '<C>' and business_id = any(<IDS>);
delete from core.campaign_turn where consumer_id = '<C>' and business_id = any(<IDS>);
delete from core.campaign_push where consumer_id = '<C>' and business_id = any(<IDS>);
delete from core.reward_redemption where consumer_id = '<C>' and business_id = any(<IDS>);
delete from core."order" where consumer_id = '<C>' and business_id = any(<IDS>);
delete from consumer.program_membership where consumer_id = '<C>' and business_id = any(<IDS>);
delete from core.business_customer where consumer_id = '<C>' and business_id = any(<IDS>);
```

Lo que cascadea solo: `order_item` (por la venta), `cross_candidate` (por la decision), el contador
`business_customer_count` (trigger). `welcome_device` se borra para que el mismo telefono pueda volver a recibir la
bienvenida.

**4. Contar despues** (el mismo SQL del paso 2) y mostrarle al owner la tabla antes → despues. Todo en 0 = listo.

## Si falla

La transaccion es atomica: si una FK nueva corta, no se borro nada. Leer el error, buscar la tabla que referencia
(`pg_constraint` con `confrelid`), agregar su paso en el orden correcto aca y volver a correr.
