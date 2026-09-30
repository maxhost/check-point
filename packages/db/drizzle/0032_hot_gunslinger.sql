CREATE TABLE "core"."staff_pin_lockout" (
	"business_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"stage" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	CONSTRAINT "staff_pin_lockout_business_id_user_id_pk" PRIMARY KEY("business_id","user_id"),
	CONSTRAINT "staff_pin_lockout_stage_check" CHECK ("core"."staff_pin_lockout"."stage" between 0 and 3),
	CONSTRAINT "staff_pin_lockout_failed_count_check" CHECK ("core"."staff_pin_lockout"."failed_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "core"."business" ADD COLUMN "slug" text DEFAULT 'b-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 20) NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."business_membership" ADD COLUMN "handle" text;--> statement-breakpoint
ALTER TABLE "core"."business_membership" ADD COLUMN "pin_hash" text;--> statement-breakpoint
ALTER TABLE "core"."business_membership" ADD COLUMN "pin_must_change" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."business_membership" ADD COLUMN "pin_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "core"."staff_pin_lockout" ADD CONSTRAINT "staff_pin_lockout_membership_fk" FOREIGN KEY ("business_id","user_id") REFERENCES "core"."business_membership"("business_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "core_business_slug_unique" ON "core"."business" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "core_business_membership_handle_unique" ON "core"."business_membership" USING btree ("business_id","handle");--> statement-breakpoint
-- BACKFILL A MANO (spec 0067, paso 1). No lo genera drizzle-kit: el CHECK de abajo
-- rechaza toda membresia `role='staff'` sin `handle`/`pin_hash`, y MEDIDO contra la rama
-- de integracion (83 negocios, 8 filas staff) la migracion moria ahi con
-- `23514 ... is violated by some row`. En el camino previsto —la base se BORRA antes
-- (spec §6, `tools/wipe-database.sql`)— estas dos lineas no tocan ninguna fila.
-- El `pin_hash` sentinela NO es un hash: ningun PIN verifica contra el, y
-- `pin_must_change` queda en true, asi que un staff heredado tiene que recibir un PIN
-- nuevo del owner. El handle sale del `user_id` (unico por negocio por construccion) y
-- respeta la forma `^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])$`.
UPDATE "core"."business_membership"
SET "handle" = coalesce("handle", 'staff-' || substr(md5("user_id"), 1, 12)),
    "pin_hash" = coalesce("pin_hash", 'legacy-sin-pin'),
    "pin_must_change" = true
WHERE "role" = 'staff' AND ("handle" IS NULL OR "pin_hash" IS NULL);--> statement-breakpoint
ALTER TABLE "core"."business_membership" ADD CONSTRAINT "business_membership_staff_identity_check" CHECK ("core"."business_membership"."role" <> 'staff' or ("core"."business_membership"."handle" is not null and "core"."business_membership"."pin_hash" is not null));