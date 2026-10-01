-- Spec 0118 / ADR 0110: el rol del cliente (`apps/consumer`) con privilegio minimo. Cada GRANT de
-- abajo sale de una fila del inventario de la spec 0118 (funcion por funcion desde las 22 rutas y
-- las paginas del cliente); una tabla que no aparece aca el cliente no la lee ni la escribe.
-- Global al cluster y heredado por las ramas: el rol se crea solo si no existe, sin LOGIN (la
-- contraseña la pone el owner por rama).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'checkpass_consumer') THEN
    CREATE ROLE checkpass_consumer NOLOGIN NOBYPASSRLS;
  END IF;
END
$$;--> statement-breakpoint
-- Sin bypass: en las 4 tablas con RLS valen las politicas `consumer_app_*` de abajo y nada mas.
ALTER ROLE checkpass_consumer NOBYPASSRLS;--> statement-breakpoint
-- Se parte de cero: lo que el rol tenia (DML en las 52 tablas tras la 0117) se revoca entero.
REVOKE ALL ON ALL TABLES IN SCHEMA core, consumer, merchant_auth, drizzle FROM checkpass_consumer;--> statement-breakpoint
REVOKE ALL ON ALL SEQUENCES IN SCHEMA core, consumer, merchant_auth, drizzle FROM checkpass_consumer;--> statement-breakpoint
REVOKE ALL ON SCHEMA merchant_auth, drizzle FROM checkpass_consumer;--> statement-breakpoint
-- Las tablas NUEVAS nacen cerradas para el cliente: la spec que haga que lo lea o escriba trae su GRANT.
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA core, consumer REVOKE ALL ON TABLES FROM checkpass_consumer;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA core, consumer REVOKE ALL ON SEQUENCES FROM checkpass_consumer;--> statement-breakpoint
GRANT USAGE ON SCHEMA core, consumer TO checkpass_consumer;--> statement-breakpoint
-- consumer: lo que el cliente escribe.
GRANT SELECT, INSERT, UPDATE ON consumer.consumer_account TO checkpass_consumer;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON consumer.consumer_session TO checkpass_consumer;--> statement-breakpoint
GRANT SELECT, INSERT ON consumer.enroll_attempt TO checkpass_consumer;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON consumer.otp_challenge TO checkpass_consumer;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON consumer.otp_delivery TO checkpass_consumer;--> statement-breakpoint
GRANT SELECT ON consumer.pass_placement TO checkpass_consumer;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON consumer.program_membership TO checkpass_consumer;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON consumer.wallet_pass TO checkpass_consumer;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON consumer.wallet_push_device TO checkpass_consumer;--> statement-breakpoint
GRANT INSERT ON consumer.wallet_push_queue TO checkpass_consumer;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON consumer.web_push_subscription TO checkpass_consumer;--> statement-breakpoint
-- core: lectura del comercio, y solo las escrituras del alta, los cupones y el clic del push.
GRANT SELECT ON core.business TO checkpass_consumer;--> statement-breakpoint
-- El alta escribe la proyeccion (upsert) y su trigger SECURITY INVOKER el contador.
GRANT SELECT, INSERT, UPDATE ON core.business_customer TO checkpass_consumer;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON core.business_customer_count TO checkpass_consumer;--> statement-breakpoint
-- `SELECT … FOR UPDATE` (el lock de la campaña al emitir un cupon) exige UPDATE en al menos una
-- columna: la mas inocua, nunca la tabla entera.
GRANT SELECT ON core.campaign TO checkpass_consumer;--> statement-breakpoint
GRANT UPDATE (updated_at) ON core.campaign TO checkpass_consumer;--> statement-breakpoint
GRANT SELECT, INSERT ON core.campaign_coupon TO checkpass_consumer;--> statement-breakpoint
-- El clic del Web Push: solo `clicked_at`, y solo las columnas que lee su `UPDATE`.
GRANT SELECT (id, sent_at, clicked_at) ON core.campaign_push TO checkpass_consumer;--> statement-breakpoint
GRANT UPDATE (clicked_at) ON core.campaign_push TO checkpass_consumer;--> statement-breakpoint
GRANT SELECT ON core.campaign_turn TO checkpass_consumer;--> statement-breakpoint
GRANT SELECT ON core.coupon_redemption TO checkpass_consumer;--> statement-breakpoint
GRANT SELECT ON core.location TO checkpass_consumer;--> statement-breakpoint
GRANT SELECT ON core.loyalty_program TO checkpass_consumer;--> statement-breakpoint
GRANT SELECT ON core.loyalty_reward TO checkpass_consumer;--> statement-breakpoint
GRANT SELECT ON core."order" TO checkpass_consumer;--> statement-breakpoint
GRANT SELECT ON core.product TO checkpass_consumer;--> statement-breakpoint
GRANT SELECT ON core.reward_redemption TO checkpass_consumer;--> statement-breakpoint
GRANT SELECT ON core.subscription TO checkpass_consumer;--> statement-breakpoint
GRANT SELECT ON core.valley_window TO checkpass_consumer;--> statement-breakpoint
GRANT SELECT, INSERT ON core.welcome_device TO checkpass_consumer;--> statement-breakpoint
-- RLS (ADR 0110 §2): una politica por operacion concedida, `USING (true)`. El aislamiento por
-- cliente lo hace el `WHERE consumer_id` del codigo (ADR 0110 §3: sin RLS por cliente).
CREATE POLICY consumer_app_select ON consumer.program_membership FOR SELECT TO checkpass_consumer USING (true);--> statement-breakpoint
CREATE POLICY consumer_app_insert ON consumer.program_membership FOR INSERT TO checkpass_consumer WITH CHECK (true);--> statement-breakpoint
CREATE POLICY consumer_app_update ON consumer.program_membership FOR UPDATE TO checkpass_consumer USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY consumer_app_select ON core.business_customer FOR SELECT TO checkpass_consumer USING (true);--> statement-breakpoint
CREATE POLICY consumer_app_insert ON core.business_customer FOR INSERT TO checkpass_consumer WITH CHECK (true);--> statement-breakpoint
CREATE POLICY consumer_app_update ON core.business_customer FOR UPDATE TO checkpass_consumer USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY consumer_app_select ON core.business_customer_count FOR SELECT TO checkpass_consumer USING (true);--> statement-breakpoint
CREATE POLICY consumer_app_insert ON core.business_customer_count FOR INSERT TO checkpass_consumer WITH CHECK (true);--> statement-breakpoint
CREATE POLICY consumer_app_update ON core.business_customer_count FOR UPDATE TO checkpass_consumer USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY consumer_app_select ON core.loyalty_program FOR SELECT TO checkpass_consumer USING (true);--> statement-breakpoint
-- Para las sondas de los tests (`SET LOCAL ROLE checkpass_consumer`), como la 0053 con customer_reader.
GRANT checkpass_consumer TO neondb_owner WITH SET TRUE;
