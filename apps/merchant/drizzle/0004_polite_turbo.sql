CREATE TABLE "core"."loyalty_program_transition" (
	"id" uuid PRIMARY KEY NOT NULL,
	"program_id" uuid NOT NULL,
	"from_version_id" uuid NOT NULL,
	"to_version_id" uuid,
	"earning_ends_at" timestamp with time zone NOT NULL,
	"redemption_ends_at" timestamp with time zone NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."loyalty_program_version" (
	"id" uuid PRIMARY KEY NOT NULL,
	"program_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"schema_version" text DEFAULT '1' NOT NULL,
	"configuration" jsonb NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"earning_ends_at" timestamp with time zone,
	"redemption_ends_at" timestamp with time zone,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."loyalty_program" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"status" text DEFAULT 'inactive' NOT NULL,
	"active_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."loyalty_terms_clause" (
	"id" uuid PRIMARY KEY NOT NULL,
	"terms_version_id" uuid NOT NULL,
	"position" text NOT NULL,
	"source_template_id" uuid,
	"source_template_version" text,
	"rendered_clause" text NOT NULL,
	"edited_by_owner" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."loyalty_terms_version" (
	"id" uuid PRIMARY KEY NOT NULL,
	"program_version_id" uuid NOT NULL,
	"rendered_markdown" text NOT NULL,
	"content_hash" text NOT NULL,
	"acceptance_required" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."terms_template" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"jurisdiction_scope" text NOT NULL,
	"locale" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"template_markdown" text NOT NULL,
	"variables_allowlist" jsonb NOT NULL,
	"version" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "core"."loyalty_program_transition" ADD CONSTRAINT "loyalty_program_transition_program_id_loyalty_program_id_fk" FOREIGN KEY ("program_id") REFERENCES "core"."loyalty_program"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."loyalty_program_transition" ADD CONSTRAINT "loyalty_program_transition_from_version_id_loyalty_program_version_id_fk" FOREIGN KEY ("from_version_id") REFERENCES "core"."loyalty_program_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."loyalty_program_transition" ADD CONSTRAINT "loyalty_program_transition_to_version_id_loyalty_program_version_id_fk" FOREIGN KEY ("to_version_id") REFERENCES "core"."loyalty_program_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."loyalty_program_transition" ADD CONSTRAINT "loyalty_program_transition_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "merchant_auth"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."loyalty_program_version" ADD CONSTRAINT "loyalty_program_version_program_id_loyalty_program_id_fk" FOREIGN KEY ("program_id") REFERENCES "core"."loyalty_program"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."loyalty_program_version" ADD CONSTRAINT "loyalty_program_version_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "merchant_auth"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."loyalty_program" ADD CONSTRAINT "loyalty_program_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."loyalty_terms_clause" ADD CONSTRAINT "loyalty_terms_clause_terms_version_id_loyalty_terms_version_id_fk" FOREIGN KEY ("terms_version_id") REFERENCES "core"."loyalty_terms_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."loyalty_terms_clause" ADD CONSTRAINT "loyalty_terms_clause_source_template_id_terms_template_id_fk" FOREIGN KEY ("source_template_id") REFERENCES "core"."terms_template"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."loyalty_terms_version" ADD CONSTRAINT "loyalty_terms_version_program_version_id_loyalty_program_version_id_fk" FOREIGN KEY ("program_version_id") REFERENCES "core"."loyalty_program_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "core_loyalty_program_business_unique" ON "core"."loyalty_program" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "core_loyalty_terms_program_version_unique" ON "core"."loyalty_terms_version" USING btree ("program_version_id");
--> statement-breakpoint
ALTER TABLE "core"."loyalty_program" ADD CONSTRAINT "loyalty_program_active_version_id_loyalty_program_version_id_fk" FOREIGN KEY ("active_version_id") REFERENCES "core"."loyalty_program_version"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "core"."loyalty_program_version" ADD CONSTRAINT "loyalty_program_version_kind_check" CHECK ("kind" IN ('points', 'stamps', 'tiers', 'cashback'));
--> statement-breakpoint
ALTER TABLE "core"."loyalty_program_version" ADD CONSTRAINT "loyalty_program_version_status_check" CHECK ("status" IN ('draft', 'active', 'retiring', 'retired'));
--> statement-breakpoint
ALTER TABLE "core"."loyalty_program" ADD CONSTRAINT "loyalty_program_status_check" CHECK ("status" IN ('active', 'inactive'));
--> statement-breakpoint
ALTER TABLE "core"."loyalty_program_transition" ADD CONSTRAINT "loyalty_program_transition_window_check" CHECK ("earning_ends_at" <= "redemption_ends_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "core_loyalty_program_one_active_version" ON "core"."loyalty_program_version" USING btree ("program_id") WHERE "status" = 'active';
--> statement-breakpoint
CREATE UNIQUE INDEX "core_terms_template_key_version_unique" ON "core"."terms_template" USING btree ("key", "locale", "jurisdiction_scope", "version");
--> statement-breakpoint
INSERT INTO "core"."terms_template" ("id", "key", "jurisdiction_scope", "locale", "category", "title", "template_markdown", "variables_allowlist", "version", "status", "published_at") VALUES
('9d4a3a05-2a87-4d12-8a99-e1a59e3cf101', 'earning', 'global-draft', 'es', 'acumulacion', 'Cómo se acumula', 'Los {{program_name}} se acumulan únicamente conforme a las acciones elegibles comunicadas por {{business_legal_name}}.', '["business_legal_name", "program_name"]'::jsonb, '1', 'published', now()),
('9d4a3a05-2a87-4d12-8a99-e1a59e3cf102', 'redemption', 'global-draft', 'es', 'canje', 'Uso y canje', 'Los beneficios asociados al programa {{program_name}} están sujetos a disponibilidad y a las condiciones comunicadas por {{business_legal_name}}.', '["business_legal_name", "program_name"]'::jsonb, '1', 'published', now()),
('9d4a3a05-2a87-4d12-8a99-e1a59e3cf103', 'transition', 'global-draft', 'es', 'vigencia', 'Cambios y vigencia', 'La acumulación de esta versión finaliza el {{earning_ends_at}}. Los beneficios ya obtenidos podrán utilizarse hasta el {{redemption_ends_at}}, salvo disposición legal aplicable.', '["earning_ends_at", "redemption_ends_at"]'::jsonb, '1', 'published', now())
ON CONFLICT ("key", "locale", "jurisdiction_scope", "version") DO NOTHING;
