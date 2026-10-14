-- Temporary bridge for old single-location writers; never emits sale events.
CREATE FUNCTION stock.assign_legacy_location() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE destination uuid; active_count integer;
BEGIN
 IF NEW.location_id IS NULL THEN
   SELECT count(*),min(id::text)::uuid INTO active_count,destination FROM core.location WHERE business_id=NEW.business_id AND status='active';
   IF active_count<>1 THEN RAISE EXCEPTION 'stock local backfill requires explicit destination' USING ERRCODE='23514'; END IF;
   NEW.location_id:=destination;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER stock_legacy_location BEFORE INSERT ON stock.movement FOR EACH ROW EXECUTE FUNCTION stock.assign_legacy_location();
CREATE FUNCTION stock.bridge_local_cost() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE q numeric; c numeric;
BEGIN
 INSERT INTO stock.item_location(business_id,item_id,location_id) VALUES(NEW.business_id,NEW.item_id,NEW.location_id) ON CONFLICT DO NOTHING;
 PERFORM 1 FROM stock.item_location WHERE business_id=NEW.business_id AND item_id=NEW.item_id AND location_id=NEW.location_id FOR UPDATE;
 IF NEW.kind='purchase' AND NEW.total_cost IS NOT NULL THEN
   SELECT quantity,total_cost INTO q,c FROM stock.movement WHERE business_id=NEW.business_id AND item_id=NEW.item_id AND location_id=NEW.location_id AND kind='purchase' AND total_cost IS NOT NULL ORDER BY occurred_at DESC,created_at DESC,id DESC LIMIT 1;
   UPDATE stock.item_location SET last_unit_cost=round(c/q,6),updated_at=now() WHERE business_id=NEW.business_id AND item_id=NEW.item_id AND location_id=NEW.location_id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER stock_bridge_cost AFTER INSERT ON stock.movement FOR EACH ROW EXECUTE FUNCTION stock.bridge_local_cost();
CREATE FUNCTION recipes.bridge_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE bid uuid; pid uuid; rid uuid; snapshot jsonb;
BEGIN
 bid:=coalesce(NEW.business_id,OLD.business_id);pid:=coalesce(NEW.product_id,OLD.product_id);
 -- Cascading business cleanup has no surviving core parent and creates no dangling pointer.
 IF NOT EXISTS(SELECT 1 FROM core.business WHERE id=bid) THEN RETURN NULL; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('itemId',l.item_id,'unit',i.unit,'quantity',l.quantity::text) ORDER BY l.position,l.id),'[]'::jsonb) INTO snapshot FROM recipes.line l JOIN stock.item i ON i.id=l.item_id AND i.business_id=l.business_id WHERE l.business_id=bid AND l.product_id=pid;
 INSERT INTO recipes.revision(business_id,product_id,lines) VALUES(bid,pid,snapshot) RETURNING id INTO rid;
 INSERT INTO core.module_resource_version(business_id,resource_type,resource_id,provider_id,slot,version_id) VALUES(bid,'product',pid,'recipes','recipe',rid) ON CONFLICT(business_id,resource_type,resource_id,provider_id,slot) DO UPDATE SET version_id=excluded.version_id,updated_at=now();
 RETURN NULL;
END $$;
CREATE TRIGGER recipes_bridge_revision AFTER INSERT OR UPDATE OR DELETE ON recipes.line FOR EACH ROW EXECUTE FUNCTION recipes.bridge_revision();
CREATE FUNCTION recipes.reject_revision_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM core.business WHERE id=OLD.business_id) THEN RETURN OLD; END IF; RAISE EXCEPTION 'Recipe revisions are immutable' USING ERRCODE='23514'; END $$;
CREATE TRIGGER recipes_revision_immutable BEFORE UPDATE OR DELETE ON recipes.revision FOR EACH ROW EXECUTE FUNCTION recipes.reject_revision_update();
