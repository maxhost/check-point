-- Custom SQL migration file, put your code below! --
-- ADR 0027: simplify loyalty to one mutable program cycle per business.
-- Development data is intentionally discarded by product decision; businesses remain.
ALTER TABLE "core"."business" ADD COLUMN "timezone" text;

UPDATE "core"."business"
SET "timezone" = CASE "id"
  WHEN 'be5d3e6e-eccd-4eaa-a591-2e1d207493e4'::uuid THEN 'America/Argentina/Bariloche'
  ELSE 'America/Guayaquil'
END
WHERE "timezone" IS NULL;

ALTER TABLE "core"."business" ALTER COLUMN "timezone" SET NOT NULL;

DELETE FROM "core"."loyalty_program";

ALTER TABLE "core"."loyalty_program"
  DROP CONSTRAINT "loyalty_program_active_version_id_loyalty_program_version_id_fk";
DROP TABLE "core"."loyalty_terms_clause";
DROP TABLE "core"."loyalty_terms_version";
DROP TABLE "core"."loyalty_program_transition";
DROP TABLE "core"."loyalty_program_version";

DROP INDEX "core"."core_loyalty_program_business_unique";
ALTER TABLE "core"."loyalty_program"
  DROP CONSTRAINT "loyalty_program_status_check",
  DROP COLUMN "active_version_id",
  ADD COLUMN "kind" text NOT NULL,
  ADD COLUMN "schema_version" text NOT NULL DEFAULT '1',
  ADD COLUMN "configuration" jsonb NOT NULL,
  ADD COLUMN "activated_at" timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN "earning_ends_at" timestamp with time zone,
  ADD COLUMN "redemption_ends_at" timestamp with time zone,
  ADD COLUMN "terms_markdown" text NOT NULL,
  ADD COLUMN "terms_hash" text NOT NULL,
  ADD COLUMN "terms_updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN "created_by" text NOT NULL REFERENCES "merchant_auth"."user"("id");

ALTER TABLE "core"."loyalty_program"
  ADD CONSTRAINT "loyalty_program_status_check"
    CHECK ("status" IN ('active', 'closing', 'inactive')),
  ADD CONSTRAINT "loyalty_program_kind_check"
    CHECK ("kind" IN ('points', 'stamps', 'tiers', 'cashback')),
  ADD CONSTRAINT "loyalty_program_closing_window_check"
    CHECK (("status" <> 'closing') OR ("earning_ends_at" IS NOT NULL AND "redemption_ends_at" IS NOT NULL AND "earning_ends_at" < "redemption_ends_at"));

CREATE UNIQUE INDEX "core_loyalty_program_one_operational"
  ON "core"."loyalty_program" USING btree ("business_id")
  WHERE "status" IN ('active', 'closing');
CREATE UNIQUE INDEX "core_loyalty_program_business_created_unique"
  ON "core"."loyalty_program" USING btree ("business_id", "created_at");
