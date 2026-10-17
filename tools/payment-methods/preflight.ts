import type { DbTransaction } from "@mi-pasaporte/db";
import { sql } from "drizzle-orm";
/** Counts and exact stored-row checksums only. Never log customer fields or connection URLs. */
export async function preflightPaymentMethods(tx: DbTransaction) {
  const result = await tx.execute(sql`select jsonb_build_object(
  'schema',(select jsonb_build_object('migrations',count(*)::int,'fingerprint',md5(coalesce(string_agg(hash,'' order by id),''))) from drizzle.__drizzle_migrations),
  'businesses',jsonb_build_object(
   'enabled',(select count(*)::int from core.business_module where module_id='pos' and enabled),
   'initialized',(select count(*)::int from pos.payment_method_initialization),
   'enabledUninitialized',(select count(*)::int from core.business_module b where module_id='pos' and enabled and not exists(select 1 from pos.payment_method_initialization i where i.business_id=b.business_id)),
   'missingCash',(select count(*)::int from pos.payment_method_initialization i where not exists(select 1 from pos.payment_method m where m.business_id=i.business_id and m.is_cash and m.status='active')),
   'countries',(select coalesce(jsonb_agg(jsonb_build_object('countryCode',q.country_code,'source',q.source,'count',q.count) order by q.country_code,q.source),'[]'::jsonb) from (select country_code,source,count(*)::int as count from pos.payment_method_initialization group by country_code,source) q)
  ),
  'catalog',jsonb_build_object('entries',(select count(*)::int from core.payment_method_catalog),'suggestions',(select count(*)::int from core.payment_method_catalog where initially_suggested),'unexpectedPeigo',(select count(*)::int from core.payment_method_catalog where lower(name) like '%peigo%')),
  'orders',jsonb_build_object('legacyClosed',(select count(*)::int from pos.pos_order where status='closed' and settlement is null),'financialClosed',(select count(*)::int from pos.pos_order where status='closed' and settlement is not null),'open',(select count(*)::int from pos.pos_order where status='open'),'payments',(select count(*)::int from pos.order_payment)),
  'commissions',jsonb_build_object('revisions',(select count(*)::int from profitability.commission_revision),'snapshots',(select count(*)::int from profitability.payment_commission),'pending',(select count(*)::int from core.module_event_delivery where subscriber_id='profitability' and state in ('pending','processing'))),
  'preserved',jsonb_build_object(
   'stock',(select jsonb_build_object('count',count(*)::int,'fingerprint',md5(coalesce(string_agg(md5(to_jsonb(m)::text),'' order by id),''))) from stock.movement m),
   'r1Mappings',(select jsonb_build_object('count',count(*)::int,'fingerprint',md5(coalesce(string_agg(md5(to_jsonb(m)::text),'' order by business_id,product_id),''))) from recipes.migration_mapping m),
   'legacyEvents',(select jsonb_build_object('count',count(*)::int,'fingerprint',md5(coalesce(string_agg(md5(to_jsonb(e)::text),'' order by id),''))) from core.module_event e where event_version=1),
   'legacyClosed',(select jsonb_build_object('count',count(*)::int,'fingerprint',md5(coalesce(string_agg(md5((to_jsonb(o)-'settlement')::text),'' order by id),''))) from pos.pos_order o where status='closed' and settlement is null)
  )
 ) as report`);
  return result.rows[0].report;
}
