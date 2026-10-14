-- Generic local assignment for legacy POS writers during rollout; no Stock dependency.
CREATE FUNCTION core.assign_legacy_order_location() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE destination uuid; active_count integer;
BEGIN
 IF NEW.location_id IS NULL THEN
   SELECT count(*),min(id::text)::uuid INTO active_count,destination FROM core.location WHERE business_id=NEW.business_id AND status='active';
   IF active_count<>1 THEN RAISE EXCEPTION 'order local backfill requires explicit destination' USING ERRCODE='23514'; END IF;
   NEW.location_id:=destination;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER pos_legacy_location BEFORE INSERT OR UPDATE OF location_id ON pos.pos_order FOR EACH ROW EXECUTE FUNCTION core.assign_legacy_order_location();
