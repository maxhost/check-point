-- Approved metadata only: no rates, no Peigo and no inference from historical sales.
INSERT INTO core.payment_method_catalog(key,country_code,name,charge_shape,is_cash,initially_suggested,sort_order) VALUES
('base_cash',NULL,'Efectivo','none',true,true,0),
('base_debit',NULL,'Tarjeta de débito','percent',false,true,1),
('base_credit',NULL,'Tarjeta de crédito','percent',false,true,2),
('base_transfer',NULL,'Transferencia','none',false,true,3),
('base_qr',NULL,'QR','percent',false,true,4),
('ec_cash','EC','Efectivo','none',true,true,0),
('ec_debit','EC','Tarjeta de débito','percent',false,true,1),
('ec_credit','EC','Tarjeta de crédito','percent',false,true,2),
('ec_transfer','EC','Transferencia','none',false,true,3),
('ec_deuna','EC','DeUna','percent',false,true,4),
('ec_payphone','EC','Payphone','percent',false,true,5),
('ec_datalink','EC','Datalink','fixed',false,false,6)
ON CONFLICT(key) DO NOTHING;
--> statement-breakpoint
-- Only businesses already enabled. OFF businesses initialize through the transactional hook.
WITH initialized AS (
 INSERT INTO pos.payment_method_initialization(business_id,country_code,source)
 SELECT b.id,b.country_code,CASE WHEN EXISTS(SELECT 1 FROM core.payment_method_catalog c WHERE c.country_code=b.country_code) THEN 'country' ELSE 'base' END
 FROM core.business b JOIN core.business_module m ON m.business_id=b.id AND m.module_id='pos' AND m.enabled
 ON CONFLICT(business_id) DO NOTHING RETURNING business_id,country_code,source
)
INSERT INTO pos.payment_method(business_id,catalog_id,name,charge_shape,is_cash)
 SELECT i.business_id,c.id,c.name,c.charge_shape,c.is_cash FROM initialized i JOIN core.payment_method_catalog c ON (i.source='country' AND c.country_code=i.country_code OR i.source='base' AND c.country_code IS NULL) AND c.initially_suggested;
--> statement-breakpoint
CREATE FUNCTION profitability.p1_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM core.business WHERE id=OLD.business_id) THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'P1 snapshots are immutable' USING ERRCODE='23514';
END $$;
--> statement-breakpoint
CREATE TRIGGER commission_revision_immutable BEFORE UPDATE OR DELETE ON profitability.commission_revision FOR EACH ROW EXECUTE FUNCTION profitability.p1_immutable();
--> statement-breakpoint
CREATE TRIGGER payment_commission_immutable BEFORE UPDATE OR DELETE ON profitability.payment_commission FOR EACH ROW EXECUTE FUNCTION profitability.p1_immutable();
--> statement-breakpoint
CREATE FUNCTION pos.p1_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM core.business WHERE id=OLD.business_id) THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'P1 payments are immutable' USING ERRCODE='23514';
END $$;
--> statement-breakpoint
CREATE TRIGGER order_payment_immutable BEFORE UPDATE OR DELETE ON pos.order_payment FOR EACH ROW EXECUTE FUNCTION pos.p1_immutable();
--> statement-breakpoint
CREATE FUNCTION pos.p1_order_financial_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.settlement IS NOT NULL AND NEW.settlement IS DISTINCT FROM OLD.settlement THEN
 RAISE EXCEPTION 'P1 settlement is immutable' USING ERRCODE='23514'; END IF;
 IF OLD.settlement IS NULL AND NEW.settlement IS NOT NULL AND OLD.status<>'open' THEN
 RAISE EXCEPTION 'P1 never backfills historical settlement' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER pos_order_financial_immutable BEFORE UPDATE ON pos.pos_order FOR EACH ROW EXECUTE FUNCTION pos.p1_order_financial_immutable();
--> statement-breakpoint
CREATE FUNCTION pos.p1_line_financial_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.financial_snapshot IS NOT NULL AND NEW.financial_snapshot IS DISTINCT FROM OLD.financial_snapshot THEN
 RAISE EXCEPTION 'P1 line settlement is immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER pos_line_financial_immutable BEFORE UPDATE ON pos.pos_order_item FOR EACH ROW EXECUTE FUNCTION pos.p1_line_financial_immutable();
--> statement-breakpoint
CREATE FUNCTION pos.p1_method_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.business_id<>OLD.business_id OR NEW.is_cash<>OLD.is_cash OR NEW.charge_shape<>OLD.charge_shape OR NEW.catalog_id IS DISTINCT FROM OLD.catalog_id THEN
 RAISE EXCEPTION 'P1 method identity and shape are immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER payment_method_identity BEFORE UPDATE ON pos.payment_method FOR EACH ROW EXECUTE FUNCTION pos.p1_method_identity();
