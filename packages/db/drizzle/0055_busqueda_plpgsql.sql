-- Spec 0109 / ADR 0101 §Enmienda: la busqueda por nombre pasa a `plpgsql` con `RETURN QUERY EXECUTE`.
-- La version `LANGUAGE sql` de la 0054 no se inlinea (es SECURITY DEFINER) y se planifica SIN el valor
-- del termino: el planner no puede elegir entre el indice de orden y el de trigramas y, medido con 3M
-- filas, la busqueda EMPEORO (31-79 ms). Armando la consulta en cada llamada, el plan usa el termino
-- real: 9-15,5 ms. Misma firma, misma salida (siempre la fila del total), mismo SECURITY DEFINER, mismo
-- `search_path`, mismo escape; `CREATE OR REPLACE` conserva el `proacl` (sin PUBLIC).
-- Sin inyeccion: el negocio y el patron entran con `%L` (literal citado) y los enteros ya vienen tipados.
CREATE OR REPLACE FUNCTION core.search_business_customers(term text, page_limit int, page_offset int)
RETURNS TABLE (consumer_id uuid, display_name text, enrolled_at timestamptz, last_visit_at timestamptz, total int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = core, pg_temp
AS $fn$
DECLARE
  -- Sin `missing_ok`: sin `app.business_id` fijado, la funcion corta con error (falla cerrado).
  biz uuid := current_setting('app.business_id')::uuid;
  pattern text := '%' || replace(replace(replace(
    lower(public.unaccent('public.unaccent'::regdictionary, term)),
    '\', '\\'), '%', '\%'), '_', '\_') || '%';
BEGIN
  RETURN QUERY EXECUTE format($q$
    SELECT p.consumer_id, p.display_name, p.enrolled_at, p.last_visit_at, c.total
    FROM (
      SELECT count(*)::int AS total
      FROM core.business_customer bc
      WHERE bc.business_id = %1$L::uuid AND bc.search_name LIKE %2$L ESCAPE '\'
    ) c
    LEFT JOIN LATERAL (
      SELECT bc.consumer_id, bc.display_name, bc.enrolled_at, bc.last_visit_at
      FROM core.business_customer bc
      WHERE bc.business_id = %1$L::uuid AND bc.search_name LIKE %2$L ESCAPE '\'
      ORDER BY bc.last_visit_at DESC NULLS LAST, bc.consumer_id
      LIMIT %3$s OFFSET %4$s
    ) p ON true
    ORDER BY p.last_visit_at DESC NULLS LAST, p.consumer_id
  $q$, biz, pattern, page_limit, page_offset);
END
$fn$;
