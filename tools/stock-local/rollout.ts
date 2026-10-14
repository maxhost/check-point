import { sql } from "drizzle-orm";
import type { DbTransaction } from "../../packages/db/src/client";
type ItemInventory = {
  business_id: string;
  item_id: string;
  unit: string;
  movements: number;
  quantity: string;
  total_cost: string;
  legacy_cost: string | null;
  ledger_fingerprint: string;
};
async function itemInventory(tx: DbTransaction) {
  const rows =
    await tx.execute(sql`select i.business_id,i.id as item_id,i.unit,i.last_unit_cost::text as legacy_cost,
 count(m.id)::int as movements,coalesce(sum(m.quantity),0)::text as quantity,coalesce(sum(m.total_cost),0)::text as total_cost,
 coalesce(md5(string_agg(md5((to_jsonb(m)-'location_id')::text),'|' order by m.id)),'empty') as ledger_fingerprint
 from stock.item i left join stock.movement m on m.item_id=i.id and m.business_id=i.business_id group by i.business_id,i.id,i.unit,i.last_unit_cost order by i.business_id,i.id`);
  return rows.rows as unknown as ItemInventory[];
}
async function legacyCrossed(tx: DbTransaction) {
  const rows = await tx.execute(sql`select
 (select count(*)::int from stock.movement m join stock.item i on i.id=m.item_id where i.business_id<>m.business_id) +
 (select count(*)::int from recipes.line r join stock.item i on i.id=r.item_id join core.product p on p.id=r.product_id where i.business_id<>r.business_id or p.business_id<>r.business_id) +
 (select count(*)::int from pos.pos_order p join core.location l on l.id=p.location_id where l.business_id<>p.business_id) as invalid_references`);
  return Number(rows.rows[0].invalid_references);
}
/** Pre-expand inventory works on baseline81; no new column/table is assumed. */
export async function preflightLegacy(tx: DbTransaction) {
  const rows = await tx.execute(sql`select b.id as business_id,
 (select count(*)::int from core.location l where l.business_id=b.id and l.status='active') as active_locations,
 (select count(*)::int from stock.movement m where m.business_id=b.id) as movements,
 (select count(*)::int from stock.item i where i.business_id=b.id and i.last_unit_cost is not null) as legacy_costs,
 (select count(*)::int from pos.pos_order p where p.business_id=b.id and p.location_id is null) as unassigned_orders,
 (select coalesce(sum(m.quantity),0)::text from stock.movement m where m.business_id=b.id) as quantity,
 (select coalesce(sum(m.total_cost),0)::text from stock.movement m where m.business_id=b.id) as total_cost
 from core.business b where exists(select 1 from stock.item i where i.business_id=b.id) or exists(select 1 from pos.pos_order p where p.business_id=b.id)`);
  return {
    businesses: rows.rows,
    items: await itemInventory(tx),
    invalidReferences: await legacyCrossed(tx),
  };
}
/** Read only inventory. History is detected by rows, never by nonzero SUM. */
export async function preflight(tx: DbTransaction) {
  const report = await tx.execute(sql`select b.id as business_id,
 (select count(*)::int from core.location l where l.business_id=b.id and l.status='active') as active_locations,
 (select count(*)::int from stock.movement m where m.business_id=b.id) as movements,
 (select count(*)::int from stock.movement m where m.business_id=b.id and m.location_id is null) as unassigned_movements,
 (select count(*)::int from stock.item i where i.business_id=b.id and i.last_unit_cost is not null) as legacy_costs,
 (select count(*)::int from pos.pos_order p where p.business_id=b.id and p.location_id is null) as unassigned_orders,
 (select coalesce(sum(m.quantity),0)::text from stock.movement m where m.business_id=b.id) as quantity,
 (select coalesce(sum(m.total_cost),0)::text from stock.movement m where m.business_id=b.id) as total_cost
 from core.business b where exists(select 1 from stock.item i where i.business_id=b.id) or exists(select 1 from pos.pos_order p where p.business_id=b.id)`);
  const crossed = await tx.execute(sql`select
 (select count(*)::int from stock.movement m join stock.item i on i.id=m.item_id where i.business_id<>m.business_id) +
 (select count(*)::int from stock.movement m join core.location l on l.id=m.location_id where l.business_id<>m.business_id) +
 (select count(*)::int from recipes.line r join stock.item i on i.id=r.item_id join core.product p on p.id=r.product_id where i.business_id<>r.business_id or p.business_id<>r.business_id) +
 (select count(*)::int from pos.pos_order p join core.location l on l.id=p.location_id where l.business_id<>p.business_id) as invalid_references`);
  return {
    items: await itemInventory(tx),
    businesses: report.rows as unknown as {
      business_id: string;
      active_locations: number;
      movements: number;
      unassigned_movements: number;
      legacy_costs: number;
      unassigned_orders: number;
      quantity: string;
      total_cost: string;
    }[],
    invalidReferences: (
      crossed.rows[0] as unknown as { invalid_references: number }
    ).invalid_references,
  };
}
/** Execute after expand, inside a protected deployment/test transaction. No sale event backfill. */
export async function backfill(
  tx: DbTransaction,
  mapping: Record<string, string> = {},
) {
  const before = await preflight(tx);
  if (before.invalidReferences)
    throw new Error("Cross-tenant references require repair before backfill");
  for (const business of before.businesses) {
    const needs =
      business.unassigned_movements > 0 ||
      business.legacy_costs > 0 ||
      business.unassigned_orders > 0;
    if (!needs) continue;
    const active = await tx.execute(
      sql`select id from core.location where business_id=${business.business_id}::uuid and status='active' order by created_at,id`,
    );
    const destination =
      mapping[business.business_id] ??
      (active.rows.length === 1 ? String(active.rows[0].id) : null);
    if (!destination) throw new Error("Explicit location mapping required");
    const valid = await tx.execute(
      sql`select id from core.location where business_id=${business.business_id}::uuid and id=${destination}::uuid`,
    );
    if (!valid.rows.length)
      throw new Error("Mapped location does not belong to business");
    // Brief per-business historical locks cover concurrent old/new writers without POS drain locks.
    await tx.execute(
      sql`select id from stock.item where business_id=${business.business_id}::uuid order by id for update`,
    );
    await tx.execute(
      sql`update stock.movement set location_id=${destination}::uuid where business_id=${business.business_id}::uuid and location_id is null`,
    );
    await tx.execute(sql`insert into stock.item_location(business_id,item_id,location_id,last_unit_cost)
 select business_id,id,${destination}::uuid,last_unit_cost from stock.item where business_id=${business.business_id}::uuid
 on conflict(business_id,item_id,location_id) do update set last_unit_cost=coalesce(stock.item_location.last_unit_cost,excluded.last_unit_cost)`);
    await tx.execute(
      sql`update pos.pos_order set location_id=${destination}::uuid where business_id=${business.business_id}::uuid and location_id is null`,
    );
  }
  // Recipe row locks serialize old bridge/new guarded writes while taking initial snapshots.
  const products = await tx.execute(
    sql`select distinct business_id,product_id from recipes.line order by business_id,product_id`,
  );
  for (const product of products.rows) {
    await tx.execute(
      sql`select id from core.product where business_id=${product.business_id}::uuid and id=${product.product_id}::uuid for update`,
    );
    await tx.execute(sql`with revision as (
 insert into recipes.revision(business_id,product_id,lines)
 select ${product.business_id}::uuid,${product.product_id}::uuid,coalesce(jsonb_agg(jsonb_build_object('itemId',r.item_id,'unit',i.unit,'quantity',r.quantity::text) order by r.position,r.id),'[]'::jsonb)
 from recipes.line r join stock.item i on i.id=r.item_id and i.business_id=r.business_id where r.business_id=${product.business_id}::uuid and r.product_id=${product.product_id}::uuid
 returning id,business_id,product_id)
 insert into core.module_resource_version(business_id,resource_type,resource_id,provider_id,slot,version_id)
 select business_id,'product',product_id,'recipes','recipe',id from revision
 on conflict(business_id,resource_type,resource_id,provider_id,slot) do nothing`);
  }
  const after = await preflight(tx);
  for (const b of before.businesses) {
    const a = after.businesses.find((v) => v.business_id === b.business_id)!;
    if (
      a.movements !== b.movements ||
      a.quantity !== b.quantity ||
      a.total_cost !== b.total_cost
    )
      throw new Error("Backfill changed historical ledger");
  }
  for (const item of before.items) {
    const migrated = after.items.find(
      (row) =>
        row.business_id === item.business_id && row.item_id === item.item_id,
    );
    if (
      !migrated ||
      migrated.quantity !== item.quantity ||
      migrated.total_cost !== item.total_cost ||
      migrated.movements !== item.movements ||
      migrated.legacy_cost !== item.legacy_cost ||
      migrated.ledger_fingerprint !== item.ledger_fingerprint
    )
      throw new Error(
        "Backfill changed ingredient ledger, cost or entry history",
      );
  }
  if (
    after.businesses.some((b) => b.unassigned_movements || b.unassigned_orders)
  )
    throw new Error("Unresolved local references");
  return after;
}
export async function contract(
  tx: DbTransaction,
  confirmation: { writersRetired: boolean; deployedSha: string },
) {
  if (
    !confirmation.writersRetired ||
    !/^[a-f0-9]{40}$/.test(confirmation.deployedSha)
  )
    throw new Error("Require verified deployed SHA and retired legacy writers");
  const report = await preflight(tx);
  if (
    report.invalidReferences ||
    report.businesses.some((b) => b.unassigned_movements || b.unassigned_orders)
  )
    throw new Error("Local contract validation failed");
  await tx.execute(
    sql`alter table stock.movement alter column location_id set not null`,
  );
  await tx.execute(
    sql`alter table pos.pos_order alter column location_id set not null`,
  );
  await tx.execute(sql`drop trigger pos_legacy_location on pos.pos_order`);
  await tx.execute(sql`drop function core.assign_legacy_order_location()`);
  await tx.execute(sql`drop trigger stock_legacy_location on stock.movement`);
  await tx.execute(sql`drop trigger stock_bridge_cost on stock.movement`);
  await tx.execute(sql`drop trigger recipes_bridge_revision on recipes.line`);
  await tx.execute(sql`drop function stock.assign_legacy_location()`);
  await tx.execute(sql`drop function stock.bridge_local_cost()`);
  await tx.execute(sql`drop function recipes.bridge_revision()`);
  await tx.execute(sql`alter table stock.item drop column last_unit_cost`);
  return { deployedSha: confirmation.deployedSha, contracted: true };
}
