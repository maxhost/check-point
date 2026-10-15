import type { DbTransaction } from "@mi-pasaporte/db";
import { sql } from "drizzle-orm";

type Fingerprint = { count: number; fingerprint: string };
export type PreservedR1 = Record<
  | "legacyLines"
  | "legacyRevisions"
  | "saleEvents"
  | "deliveries"
  | "ledger"
  | "itemLocations",
  Fingerprint
>;

/** Database-side exact row hashes include NULL/zero and all stored monetary snapshot fields. */
export async function preservedR1(tx: DbTransaction): Promise<PreservedR1> {
  const tables = [
    ["legacyLines", "recipes.line", "r.id"],
    ["legacyRevisions", "recipes.revision", "r.id"],
    ["saleEvents", "core.module_event", "r.id"],
    ["deliveries", "core.module_event_delivery", "r.id"],
    ["ledger", "stock.movement", "r.id"],
    [
      "itemLocations",
      "stock.item_location",
      "r.business_id,r.item_id,r.location_id",
    ],
  ];
  const fields = tables.map(
    ([key, table, order]) =>
      sql`(select jsonb_build_object('count',count(*)::int,'fingerprint',md5(coalesce(string_agg(md5(to_jsonb(r)::text),'' order by ${sql.raw(order)}),''))) from ${sql.raw(table)} r) as ${sql.raw('"' + key + '"')}`,
  );
  const result = await tx.execute(sql`select ${sql.join(fields, sql`,`)}`);
  return result.rows[0] as unknown as PreservedR1;
}
export function comparePreservedR1(before: PreservedR1, after: PreservedR1) {
  const changed = (Object.keys(before) as (keyof PreservedR1)[]).filter(
    (key) =>
      before[key].count !== after[key].count ||
      before[key].fingerprint !== after[key].fingerprint,
  );
  return { unchanged: changed.length === 0, changed };
}
export async function inventoryR1(tx: DbTransaction) {
  const result =
    await tx.execute(sql`with configured_names as (select p.business_id,p.name,c.name as category_name,row_number() over(partition by p.business_id,lower(btrim(p.name)) order by p.id) as ordinal from core.product p left join core.product_category c on c.business_id=p.business_id and c.id=p.category_id where exists(select 1 from recipes.line l where l.business_id=p.business_id and l.product_id=p.id)), candidates as (select business_id,lower(btrim(left(btrim(name),120-length(case when category_name is not null then ' ('||category_name||')' else ' (2)' end))||case when category_name is not null then ' ('||category_name||')' else ' (2)' end)) as name from configured_names where ordinal>1) select jsonb_build_object(
  'schema',(select jsonb_build_object('migrations',count(*)::int,'fingerprint',md5(coalesce(string_agg(hash,'' order by id),''))) from drizzle.__drizzle_migrations),
  'manifest',(select jsonb_build_object('mappedProducts',count(*)::int,'renamedProducts',count(*) filter(where reason<>'original')::int,'fingerprint',md5(coalesce(string_agg(md5(to_jsonb(m)::text),'' order by business_id,product_id),''))) from recipes.migration_mapping m),
  'nameCandidates',jsonb_build_object('renamedCandidates',(select count(*)::int from candidates),'collisionsWithOriginals',(select count(*)::int from candidates c where exists(select 1 from core.product p where p.business_id=c.business_id and lower(btrim(p.name))=c.name)),'sharedCandidateGroups',(select count(*)::int from (select business_id,name from candidates group by business_id,name having count(*)>1) c)),
  'legacy',jsonb_build_object(
   'revisions',(select count(*)::int from recipes.revision),
   'emptyRevisions',(select count(*)::int from recipes.revision r where jsonb_array_length(r.lines)=0),
   'pointers',(select count(*)::int from core.module_resource_version p where p.provider_id='recipes' and p.slot='recipe' and p.resource_type='product'),
   'emptyPointers',(select count(*)::int from core.module_resource_version p join recipes.revision r on r.business_id=p.business_id and r.id=p.version_id and r.product_id=p.resource_id where p.provider_id='recipes' and p.slot='recipe' and p.resource_type='product' and jsonb_array_length(r.lines)=0),
   'invalidPointers',(select count(*)::int from core.module_resource_version p left join recipes.revision r on r.business_id=p.business_id and r.id=p.version_id and r.product_id=p.resource_id where p.provider_id='recipes' and p.slot='recipe' and p.resource_type='product' and r.id is null),
   'dualPointers',(select count(*)::int from core.module_resource_version p join core.module_resource_version c on c.business_id=p.business_id and c.resource_id=p.resource_id and c.resource_type=p.resource_type and c.provider_id=p.provider_id and c.slot='composition' where p.provider_id='recipes' and p.slot='recipe' and p.resource_type='product')
  ),
  'events',jsonb_build_object(
   'closed',(select count(*)::int from core.module_event e where e.event_type='sale.closed'),
   'pending',(select count(*)::int from core.module_event_delivery d join core.module_event e on e.id=d.event_id where e.event_type='sale.closed' and d.subscriber_id='recipes' and d.state='pending'),
   'processing',(select count(*)::int from core.module_event_delivery d join core.module_event e on e.id=d.event_id where e.event_type='sale.closed' and d.subscriber_id='recipes' and d.state='processing'),
   'applied',(select count(*)::int from core.module_event_delivery d join core.module_event e on e.id=d.event_id where e.event_type='sale.closed' and d.subscriber_id='recipes' and d.state='applied'),
   'skipped',(select count(*)::int from core.module_event_delivery d join core.module_event e on e.id=d.event_id where e.event_type='sale.closed' and d.subscriber_id='recipes' and d.state='skipped')
  ),
  'stock',jsonb_build_object(
   'movements',(select count(*)::int from stock.movement),
   'consumptions',(select count(*)::int from stock.movement m where m.kind='consumption'),
   'legacySnapshots',(select count(*)::int from stock.movement m where m.kind='consumption' and m.consumption_loss_factor is null),
   'unknownCosts',(select count(*)::int from stock.movement m where m.kind='consumption' and m.consumption_loss_factor is not null and m.consumption_unit_cost is null),
   'knownCosts',(select count(*)::int from stock.movement m where m.kind='consumption' and m.consumption_loss_factor is not null and m.consumption_unit_cost is not null),
   'knownZeroCosts',(select count(*)::int from stock.movement m where m.kind='consumption' and m.consumption_loss_factor is not null and m.consumption_unit_cost=0),
   'quantitiesByLocal',(select jsonb_build_object('groups',count(*)::int,'fingerprint',md5(coalesce(string_agg(md5(to_jsonb(q)::text),'' order by q.business_id,q.item_id,q.location_id),''))) from (select business_id,item_id,location_id,sum(quantity)::text as quantity from stock.movement group by business_id,item_id,location_id) q)
  )) as inventory`);
  return result.rows[0].inventory as {
    schema: { migrations: number; fingerprint: string };
    manifest: {
      mappedProducts: number;
      renamedProducts: number;
      fingerprint: string;
    };
    nameCandidates: {
      renamedCandidates: number;
      collisionsWithOriginals: number;
      sharedCandidateGroups: number;
    };
    legacy: {
      revisions: number;
      emptyRevisions: number;
      pointers: number;
      emptyPointers: number;
      invalidPointers: number;
      dualPointers: number;
    };
    events: {
      closed: number;
      pending: number;
      processing: number;
      applied: number;
      skipped: number;
    };
    stock: {
      movements: number;
      consumptions: number;
      legacySnapshots: number;
      unknownCosts: number;
      knownCosts: number;
      knownZeroCosts: number;
      quantitiesByLocal: { groups: number; fingerprint: string };
    };
  };
}
