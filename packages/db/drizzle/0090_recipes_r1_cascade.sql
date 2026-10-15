ALTER TABLE "recipes"."recipe_line" DROP CONSTRAINT "recipe_line_business_id_item_id_item_business_id_id_fk";
--> statement-breakpoint
ALTER TABLE "recipes"."recipe_line" ADD CONSTRAINT "recipe_line_business_id_item_id_item_business_id_id_fk" FOREIGN KEY ("business_id","item_id") REFERENCES "stock"."item"("business_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE recipes.recipe_line ALTER CONSTRAINT recipe_line_business_id_item_id_item_business_id_id_fk DEFERRABLE INITIALLY DEFERRED;
