-- Spec 0108 / ADR 0100: listado de clientes del comercio. Las extensiones van primero porque el
-- indice GIN de trigramas las necesita; el unico IF NOT EXISTS legitimo es el de una extension.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gin WITH SCHEMA public;--> statement-breakpoint
CREATE TABLE "core"."business_customer" (
	"business_id" uuid NOT NULL,
	"consumer_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"search_name" text NOT NULL,
	"phone_e164" text NOT NULL,
	"enrolled_at" timestamp with time zone NOT NULL,
	"last_visit_at" timestamp with time zone,
	CONSTRAINT "business_customer_business_id_consumer_id_pk" PRIMARY KEY("business_id","consumer_id")
);
--> statement-breakpoint
ALTER TABLE "core"."business_customer" ADD CONSTRAINT "business_customer_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."business_customer" ADD CONSTRAINT "business_customer_consumer_id_consumer_account_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "consumer"."consumer_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "core_business_customer_order_idx" ON "core"."business_customer" USING btree ("business_id","last_visit_at" DESC NULLS LAST,"consumer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "core_business_customer_phone_unique" ON "core"."business_customer" USING btree ("business_id","phone_e164");--> statement-breakpoint
CREATE INDEX "core_business_customer_search_idx" ON "core"."business_customer" USING gin ("business_id","search_name" gin_trgm_ops);--> statement-breakpoint
-- Rol de lectura restringido (ADR 0100 §3): sin login, sin BYPASSRLS. Es global al cluster y las
-- ramas de Neon heredan los roles del padre, asi que se crea solo si no existe.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'customer_reader') THEN
    CREATE ROLE customer_reader NOLOGIN NOBYPASSRLS;
  END IF;
END
$$;--> statement-breakpoint
-- Sin `WITH SET TRUE` el `SET LOCAL ROLE` de la lectura falla con `permission denied to set role`.
GRANT customer_reader TO neondb_owner WITH SET TRUE;--> statement-breakpoint
GRANT USAGE ON SCHEMA core TO customer_reader;--> statement-breakpoint
GRANT USAGE ON SCHEMA consumer TO customer_reader;--> statement-breakpoint
GRANT SELECT ON core.business_customer TO customer_reader;--> statement-breakpoint
GRANT SELECT (consumer_id, program_id, business_id, points_balance, stamps_count) ON consumer.program_membership TO customer_reader;--> statement-breakpoint
-- RLS (ENABLE, no FORCE): el dueño de las tablas —el rol de la app— sigue sin cambios. Sin
-- missing_ok: sin `app.business_id` fijado la consulta corta con error (falla cerrado).
ALTER TABLE core.business_customer ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY business_customer_by_business ON core.business_customer FOR SELECT TO customer_reader USING (business_id = current_setting('app.business_id')::uuid);--> statement-breakpoint
ALTER TABLE consumer.program_membership ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY program_membership_by_business ON consumer.program_membership FOR SELECT TO customer_reader USING (business_id = current_setting('app.business_id')::uuid);--> statement-breakpoint
-- Busqueda por nombre (ADR 0100 §4). SECURITY DEFINER para que el indice de trigramas se use (con
-- RLS pura `LIKE` no es leakproof y el indice queda afuera); el negocio sale de la sesion, NUNCA
-- de un parametro. Los comodines del termino se escapan adentro. `unaccent` va calificado con su
-- diccionario: el `search_path` de la funcion no incluye `public`. Devuelve SIEMPRE al menos una
-- fila, la del `total` (con `consumer_id` null si la pagina esta vacia): asi una pagina mas alla
-- de la ultima trae el total real.
CREATE FUNCTION core.search_business_customers(term text, page_limit int, page_offset int)
RETURNS TABLE (consumer_id uuid, display_name text, enrolled_at timestamptz, last_visit_at timestamptz, total int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = core, pg_temp
AS $fn$
  WITH matched AS (
    SELECT bc.consumer_id, bc.display_name, bc.enrolled_at, bc.last_visit_at
    FROM core.business_customer bc
    WHERE bc.business_id = current_setting('app.business_id')::uuid
      AND bc.search_name LIKE '%' || replace(replace(replace(
            lower(public.unaccent('public.unaccent'::regdictionary, term)),
            '\', '\\'), '%', '\%'), '_', '\_') || '%' ESCAPE '\'
  ),
  counted AS (SELECT count(*)::int AS total FROM matched)
  SELECT p.consumer_id, p.display_name, p.enrolled_at, p.last_visit_at, c.total
  FROM counted c
  LEFT JOIN LATERAL (
    SELECT m.consumer_id, m.display_name, m.enrolled_at, m.last_visit_at
    FROM matched m
    ORDER BY m.last_visit_at DESC NULLS LAST, m.consumer_id
    LIMIT page_limit OFFSET page_offset
  ) p ON true
$fn$;--> statement-breakpoint
REVOKE ALL ON FUNCTION core.search_business_customers(text, int, int) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION core.search_business_customers(text, int, int) TO customer_reader;--> statement-breakpoint
-- Backfill: una fila por (negocio, cliente) de las membresias; alta = la mas vieja; ultima visita
-- = la compra o el canje (premio o cupon) mas reciente en ese negocio. Solo negocios que existen.
INSERT INTO core.business_customer
  (business_id, consumer_id, display_name, search_name, phone_e164, enrolled_at, last_visit_at)
SELECT m.business_id, m.consumer_id,
       a.first_name || ' ' || a.last_name,
       lower(public.unaccent('public.unaccent'::regdictionary, a.first_name || ' ' || a.last_name)),
       a.phone_e164,
       min(m.enrolled_at),
       (SELECT max(v.at) FROM (
          SELECT o.created_at FROM core."order" o
          WHERE o.business_id = m.business_id AND o.consumer_id = m.consumer_id
          UNION ALL
          SELECT r.created_at FROM core.reward_redemption r
          WHERE r.business_id = m.business_id AND r.consumer_id = m.consumer_id
          UNION ALL
          SELECT c.created_at FROM core.coupon_redemption c
          WHERE c.business_id = m.business_id AND c.consumer_id = m.consumer_id
        ) v(at))
FROM consumer.program_membership m
JOIN consumer.consumer_account a ON a.id = m.consumer_id
JOIN core.business b ON b.id = m.business_id
GROUP BY m.business_id, m.consumer_id, a.first_name, a.last_name, a.phone_e164;
