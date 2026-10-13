ALTER TABLE "core"."business_membership" DROP CONSTRAINT "business_membership_permissions_check";--> statement-breakpoint
ALTER TABLE "core"."business_membership" ADD CONSTRAINT "business_membership_permissions_check" CHECK (cardinality("core"."business_membership"."permissions") = 0 or (array_to_string("core"."business_membership"."permissions", ',', '*') ~ '^[a-z][a-z_]{0,39}(,[a-z][a-z_]{0,39})*$' and length(array_to_string("core"."business_membership"."permissions", ',', '*')) - length(replace(array_to_string("core"."business_membership"."permissions", ',', '*'), ',', '')) = cardinality("core"."business_membership"."permissions") - 1));--> statement-breakpoint
-- Spec 0216 / ADR 0139 §5 — DATOS: todo integrante con `catalog` recibe `stock` y `recipes` (nadie
-- pierde acceso cuando Stock y Recetas dejan de usar `catalog`). Sin duplicar: se agrega solo el que
-- falta, al final y en el orden del catalogo valido (core, stock, recipes). El owner no tiene
-- permisos (CHECK 2), asi que no entra. Va DESPUES del CHECK nuevo: el viejo rechazaba `stock`.
UPDATE "core"."business_membership"
SET "permissions" = "permissions"
  || CASE WHEN 'stock' = ANY("permissions") THEN '{}'::text[] ELSE ARRAY['stock']::text[] END
  || CASE WHEN 'recipes' = ANY("permissions") THEN '{}'::text[] ELSE ARRAY['recipes']::text[] END
WHERE "role" <> 'owner'
  AND 'catalog' = ANY("permissions")
  AND NOT ("permissions" @> ARRAY['stock', 'recipes']::text[]);
