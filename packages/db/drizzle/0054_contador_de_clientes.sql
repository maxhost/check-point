CREATE TABLE "core"."business_customer_count" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"customers" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "business_customer_count_customers_check" CHECK ("core"."business_customer_count"."customers" >= 0)
);
--> statement-breakpoint
ALTER TABLE "core"."business_customer_count" ADD CONSTRAINT "business_customer_count_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Spec 0109 / ADR 0101: el total de la lista sin filtro sale de este contador, no de un
-- `count(*)` del negocio entero en cada pedido. Lo mantiene un TRIGGER y no la app: la proyeccion
-- tambien pierde filas por `on delete cascade` (cuenta o negocio borrados) y el trigger lo ve
-- venga de donde venga. Un upsert que termina en `DO UPDATE` (una compra, una re-alta) NO dispara
-- el `AFTER INSERT`: solo lo mueve un cliente nuevo o uno borrado. Si el contador del negocio ya
-- se fue por su propio cascade, el `UPDATE` afecta 0 filas: correcto.
CREATE FUNCTION core.business_customer_count_sync() RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE core.business_customer_count SET customers = customers - 1
    WHERE business_id = OLD.business_id;
    RETURN OLD;
  END IF;
  INSERT INTO core.business_customer_count AS n (business_id, customers)
  VALUES (NEW.business_id, 1)
  ON CONFLICT (business_id) DO UPDATE SET customers = n.customers + 1;
  RETURN NEW;
END
$fn$;--> statement-breakpoint
CREATE TRIGGER business_customer_count_sync AFTER INSERT OR DELETE ON core.business_customer FOR EACH ROW EXECUTE FUNCTION core.business_customer_count_sync();--> statement-breakpoint
-- Backfill DESPUES del trigger y en la misma transaccion de la migracion: el `CREATE TRIGGER`
-- toma un lock que frena las altas concurrentes hasta el commit, asi que ninguna se pierde ni se
-- cuenta dos veces.
INSERT INTO core.business_customer_count (business_id, customers)
SELECT business_id, count(*)::int FROM core.business_customer GROUP BY 1;--> statement-breakpoint
GRANT SELECT ON core.business_customer_count TO customer_reader;--> statement-breakpoint
ALTER TABLE core.business_customer_count ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY business_customer_count_by_business ON core.business_customer_count FOR SELECT TO customer_reader USING (business_id = current_setting('app.business_id')::uuid);--> statement-breakpoint
-- El programa operativo se resuelve DENTRO de la sentencia de la lectura, como `customer_reader`:
-- solo las columnas que la lectura usa, y RLS por `app.business_id`. ENABLE, no FORCE: el rol de
-- la app es dueño de la tabla y tiene BYPASSRLS, asi que el resto de la app no cambia.
GRANT SELECT (id, business_id, kind, status) ON core.loyalty_program TO customer_reader;--> statement-breakpoint
ALTER TABLE core.loyalty_program ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY loyalty_program_by_business ON core.loyalty_program FOR SELECT TO customer_reader USING (business_id = current_setting('app.business_id')::uuid);--> statement-breakpoint
-- La busqueda (ADR 0101 §2): misma firma, mismo SECURITY DEFINER, mismo `search_path`, mismo
-- escape y la misma salida (siempre la fila del total), pero la pagina y el total son dos
-- subconsultas INDEPENDIENTES, cada una con su plan: la pagina recorre el indice que el planner
-- elija y corta en el LIMIT; el total es su propio `count(*)`. Ninguna lee de un CTE con todas las
-- coincidencias. `CREATE OR REPLACE` conserva el `proacl` (sin PUBLIC, EXECUTE para el rol).
CREATE OR REPLACE FUNCTION core.search_business_customers(term text, page_limit int, page_offset int)
RETURNS TABLE (consumer_id uuid, display_name text, enrolled_at timestamptz, last_visit_at timestamptz, total int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = core, pg_temp
AS $fn$
  SELECT p.consumer_id, p.display_name, p.enrolled_at, p.last_visit_at, c.total
  FROM (
    SELECT count(*)::int AS total
    FROM core.business_customer bc
    WHERE bc.business_id = current_setting('app.business_id')::uuid
      AND bc.search_name LIKE '%' || replace(replace(replace(
            lower(public.unaccent('public.unaccent'::regdictionary, term)),
            '\', '\\'), '%', '\%'), '_', '\_') || '%' ESCAPE '\'
  ) c
  LEFT JOIN LATERAL (
    SELECT bc.consumer_id, bc.display_name, bc.enrolled_at, bc.last_visit_at
    FROM core.business_customer bc
    WHERE bc.business_id = current_setting('app.business_id')::uuid
      AND bc.search_name LIKE '%' || replace(replace(replace(
            lower(public.unaccent('public.unaccent'::regdictionary, term)),
            '\', '\\'), '%', '\%'), '_', '\_') || '%' ESCAPE '\'
    ORDER BY bc.last_visit_at DESC NULLS LAST, bc.consumer_id
    LIMIT page_limit OFFSET page_offset
  ) p ON true
  ORDER BY p.last_visit_at DESC NULLS LAST, p.consumer_id
$fn$;
