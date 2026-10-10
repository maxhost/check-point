-- Spec 0189 / ADR 0134: muere el plan `free`. Todo comercio nace en una prueba de 90 dias
-- (`plan='trial'` + `trial_ends_at`, que SE GUARDA para poder extenderla a mano), y el que no
-- tiene suscripcion viva con la prueba vencida queda bloqueado. Aditiva salvo el UPDATE de
-- datos (ADR 0134 §12: los comercios `free` pasan a `trial` con fin a 90 dias de la migracion).
-- El codigo viejo lee `plan='trial'` como plan desconocido → `fallback` (1 local, sin campañas):
-- inofensivo, pero se aplica inmediatamente antes del push que trae el codigo nuevo.
ALTER TABLE "core"."campaign" DROP CONSTRAINT "core_campaign_pause_reason_check";--> statement-breakpoint
ALTER TABLE "core"."subscription" ALTER COLUMN "plan" SET DEFAULT 'trial';--> statement-breakpoint
ALTER TABLE "core"."subscription" ADD COLUMN "trial_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "core"."campaign" ADD CONSTRAINT "core_campaign_pause_reason_check" CHECK ("core"."campaign"."pause_reason" is null or "core"."campaign"."pause_reason" in ('owner', 'plan_downgraded', 'no_active_locations', 'billing_blocked'));--> statement-breakpoint
UPDATE "core"."subscription" SET "plan" = 'trial', "trial_ends_at" = now() + interval '90 days', "updated_at" = now() WHERE "plan" = 'free';--> statement-breakpoint
-- La inscripcion corre en el cliente con el rol `checkpass_consumer` (migracion 0060) y tiene que
-- leer el acceso del comercio. La 0060 ya le da `SELECT` de TABLA (que cubre la columna nueva);
-- el grant por columna lo deja escrito como dependencia explicita de esta spec.
GRANT SELECT ("business_id", "status", "stripe_subscription_id", "trial_ends_at") ON "core"."subscription" TO checkpass_consumer;
