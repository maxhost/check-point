-- Spec 0148 / ADR 0119: el cupon se elige en la PWA y se ata a la venta.
-- consumer_account.selected_coupon_id/coupon_selected_at: UNA eleccion global por cliente (no vence). El
-- check es de UNA via (eleccion => fecha): `on delete set null` anula solo `selected_coupon_id`, y un
-- «los dos o ninguno» volveria 23514 todo borrado de un cupon elegido (medido en Neon).
-- business_customer.last_scan_at: «el comercio donde lo escanearon» (la «aca» sin GPS).
-- coupon_redemption.order_id/discount_amount: el canje atado a la venta y cuanto bonifico; el indice
-- (business_id, consumer_id, created_at) lee el limite de un cupon por cliente + comercio + dia.
-- Grants: ninguno nuevo. `checkpass_consumer` ya tiene UPDATE en consumer.consumer_account y SELECT en
-- core.business_customer, core.location y core.coupon_redemption (`0060_rol_del_cliente.sql`).
ALTER TABLE "consumer"."consumer_account" ADD COLUMN "selected_coupon_id" uuid;--> statement-breakpoint
ALTER TABLE "consumer"."consumer_account" ADD COLUMN "coupon_selected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "core"."coupon_redemption" ADD COLUMN "order_id" uuid;--> statement-breakpoint
ALTER TABLE "core"."coupon_redemption" ADD COLUMN "discount_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "core"."business_customer" ADD COLUMN "last_scan_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "consumer"."consumer_account" ADD CONSTRAINT "consumer_account_selected_coupon_id_campaign_coupon_id_fk" FOREIGN KEY ("selected_coupon_id") REFERENCES "core"."campaign_coupon"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."coupon_redemption" ADD CONSTRAINT "coupon_redemption_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "core"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "core_coupon_redemption_order_unique" ON "core"."coupon_redemption" USING btree ("order_id") WHERE "core"."coupon_redemption"."order_id" is not null;--> statement-breakpoint
CREATE INDEX "core_coupon_redemption_daily_idx" ON "core"."coupon_redemption" USING btree ("business_id","consumer_id","created_at");--> statement-breakpoint
ALTER TABLE "consumer"."consumer_account" ADD CONSTRAINT "consumer_account_coupon_selection_check" CHECK ("consumer"."consumer_account"."selected_coupon_id" is null or "consumer"."consumer_account"."coupon_selected_at" is not null);--> statement-breakpoint
ALTER TABLE "core"."coupon_redemption" ADD CONSTRAINT "core_coupon_redemption_discount_check" CHECK ("core"."coupon_redemption"."discount_amount" is null or "core"."coupon_redemption"."discount_amount" >= 0);--> statement-breakpoint
ALTER TABLE "core"."coupon_redemption" ADD CONSTRAINT "core_coupon_redemption_discount_order_check" CHECK ("core"."coupon_redemption"."discount_amount" is null or "core"."coupon_redemption"."order_id" is not null);