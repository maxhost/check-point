-- Only after validated backfill, verified deployed SHA and retired legacy writers.
-- Execute as one transaction after a separately authorized PROD operation.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM stock.movement WHERE location_id IS NULL) OR EXISTS(SELECT 1 FROM pos.pos_order WHERE location_id IS NULL) THEN RAISE EXCEPTION 'Unresolved local references'; END IF;
END $$;
ALTER TABLE stock.movement ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE pos.pos_order ALTER COLUMN location_id SET NOT NULL;
DROP TRIGGER pos_legacy_location ON pos.pos_order;
DROP FUNCTION core.assign_legacy_order_location();
DROP TRIGGER stock_legacy_location ON stock.movement;
DROP TRIGGER stock_bridge_cost ON stock.movement;
DROP TRIGGER recipes_bridge_revision ON recipes.line;
DROP FUNCTION stock.assign_legacy_location();
DROP FUNCTION stock.bridge_local_cost();
DROP FUNCTION recipes.bridge_revision();
ALTER TABLE stock.item DROP COLUMN last_unit_cost;
