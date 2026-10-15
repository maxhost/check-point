-- Immutable R1 snapshots; operational backfill/cutover is explicit in tools/recipes-r1.
CREATE FUNCTION recipes.r1_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM core.business WHERE id=OLD.business_id) THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'R1 snapshots are immutable' USING ERRCODE='23514';
END $$;
--> statement-breakpoint
CREATE TRIGGER recipes_recipe_revision_immutable BEFORE UPDATE OR DELETE ON recipes.recipe_revision FOR EACH ROW EXECUTE FUNCTION recipes.r1_immutable();
--> statement-breakpoint
CREATE TRIGGER recipes_composition_revision_immutable BEFORE UPDATE OR DELETE ON recipes.composition_revision FOR EACH ROW EXECUTE FUNCTION recipes.r1_immutable();
--> statement-breakpoint
CREATE TRIGGER recipes_sale_resolution_immutable BEFORE UPDATE OR DELETE ON recipes.sale_resolution FOR EACH ROW EXECUTE FUNCTION recipes.r1_immutable();
--> statement-breakpoint
CREATE TRIGGER recipes_consumption_source_immutable BEFORE UPDATE OR DELETE ON recipes.consumption_source FOR EACH ROW EXECUTE FUNCTION recipes.r1_immutable();
--> statement-breakpoint
CREATE TRIGGER recipes_migration_mapping_immutable BEFORE UPDATE OR DELETE ON recipes.migration_mapping FOR EACH ROW EXECUTE FUNCTION recipes.r1_immutable();
--> statement-breakpoint
ALTER TABLE recipes.recipe ADD CONSTRAINT recipes_recipe_current_revision_fk FOREIGN KEY(business_id,revision_id) REFERENCES recipes.recipe_revision(business_id,id) DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
CREATE FUNCTION recipes.r1_current_revision_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM core.business WHERE id=NEW.business_id) THEN RETURN NEW; END IF;
 IF NOT EXISTS(SELECT 1 FROM recipes.recipe_revision r WHERE r.business_id=NEW.business_id AND r.id=NEW.revision_id AND r.recipe_id=NEW.id) THEN
 RAISE EXCEPTION 'R1 current revision does not belong to recipe' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER recipes_recipe_current_revision_owner AFTER INSERT OR UPDATE ON recipes.recipe DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION recipes.r1_current_revision_owner();
