CREATE TABLE "core"."location_verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"source" text NOT NULL,
	"provider" text,
	"provider_place_id" text,
	"normalized_address" text NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"country_code" text NOT NULL,
	"provider_snapshot" jsonb NOT NULL,
	"attribution" text,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "core"."location" ALTER COLUMN "longitude" SET DATA TYPE numeric(10, 7) USING "longitude"::numeric(10, 7);--> statement-breakpoint
ALTER TABLE "core"."location" ALTER COLUMN "latitude" SET DATA TYPE numeric(10, 7) USING "latitude"::numeric(10, 7);--> statement-breakpoint
ALTER TABLE "core"."location" ADD COLUMN "country_code" text;--> statement-breakpoint
UPDATE "core"."location" AS location SET "country_code" = business."country_code" FROM "core"."business" AS business WHERE location."business_id" = business."id";--> statement-breakpoint
ALTER TABLE "core"."location" ALTER COLUMN "country_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."location" ADD COLUMN "active_verification_id" uuid;--> statement-breakpoint
ALTER TABLE "core"."location_verification" ADD CONSTRAINT "location_verification_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "core"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
WITH inserted AS (
	INSERT INTO "core"."location_verification" ("id", "location_id", "source", "provider", "provider_place_id", "normalized_address", "longitude", "latitude", "country_code", "provider_snapshot", "attribution")
	SELECT gen_random_uuid(), "id", 'provider_verified', 'mapbox', "mapbox_feature_id", "address_label", "longitude", "latitude", "country_code", "address_snapshot", NULL
	FROM "core"."location"
	RETURNING "id", "location_id"
)
UPDATE "core"."location" AS location SET "active_verification_id" = inserted."id" FROM inserted WHERE location."id" = inserted."location_id";--> statement-breakpoint
ALTER TABLE "core"."location" DROP COLUMN "mapbox_feature_id";
