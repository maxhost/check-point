-- Spec 0086 §1 (ADR 0079 §1 y §4) — LOS PERMISOS DEL STAFF DEJAN DE SER EL ROL.
--
-- `business_membership` gana `permissions text[]` y TRES `CHECK` que vuelven imposibles los
-- tres estados invalidos: un permiso fuera del catalogo, un owner con permisos, y un staff
-- con cero.
--
-- **NO HAY BACKFILL. Las membresias de staff existentes se BORRAN.** Decision textual del
-- owner del 2026-09-20: *«no necesitamos backflip, olvidate de hacer que los usuarios
-- existentes puedan seguir operando porque estamos en prueba, simplemente los eliminamos de
-- la db y vuelvo a crearlos»*.
--
-- **Por que el DELETE vive ACA y no en un paso manual previo:** `ADD CONSTRAINT ... CHECK`
-- **valida las filas existentes**, asi que el CHECK 3 haria fallar esta migracion contra
-- cualquier rama que tenga un staff con `'{}'` — y las ramas de Neon de CI e integracion SI
-- tienen filas, aunque produccion tenga cero negocios. Un paso manual previo a una migracion
-- es un paso que se olvida; en un entorno limpio este `delete` es un **no-op**.
--
-- **Se borra la MEMBRESIA, no el `user`.** `order.created_by_user_id` y
-- `reward_redemption.created_by_user_id` referencian `users.id` **sin `onDelete`** (o sea
-- `NO ACTION`): borrar un `user` con historial falla con violacion de FK, y ese es el diseño
-- correcto (ADR 0007: la auditoria sobrevive al actor). Sin membresia ese `user` queda
-- **inerte**: no resuelve negocio, no entra por `handle@slug` y no lo enumera `listStaff`.
--
-- **Costo declarado, no escondido:** quedan filas huerfanas en `merchant_auth.user` con su
-- email sintetico. No colisionan al recrear (el sintetico lleva un `uuid` nuevo por
-- integrante) y limpiar las que tengan historial es imposible por la FK de arriba.
ALTER TABLE "core"."business_membership" ADD COLUMN "permissions" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
-- EL BORRADO, y va ANTES de los CHECK 2 y 3 (ver el docblock de arriba). En una rama sin
-- staff esto afecta 0 filas y la migracion sigue.
DELETE FROM "core"."business_membership" WHERE "role" = 'staff';--> statement-breakpoint
-- CHECK 1 — contencion de conjuntos: ningun valor fuera del catalogo de los siete. `<@` NO
-- impide duplicados (`{catalog,catalog}` lo satisface): eso lo normaliza el writer.
ALTER TABLE "core"."business_membership" ADD CONSTRAINT "business_membership_permissions_check" CHECK ("core"."business_membership"."permissions" <@ array['brand', 'catalog', 'counter', 'locations', 'loyalty', 'marketing', 'staff']::text[]);--> statement-breakpoint
-- CHECK 2 — el owner NO tiene permisos: los ignora por definicion. Sin esto existe el estado
-- «owner con permisos» y alguien va a terminar decidiendo por el. `role <> 'owner'` y no
-- `role = 'staff'`: un tercer valor de `role` fallaria CERRADO en vez de pasar sin invariante.
ALTER TABLE "core"."business_membership" ADD CONSTRAINT "business_membership_owner_no_permissions_check" CHECK ("core"."business_membership"."role" <> 'owner' or "core"."business_membership"."permissions" = '{}');--> statement-breakpoint
-- CHECK 3 — un staff SIEMPRE tiene al menos uno. El `coalesce` es LOAD-BEARING:
-- `array_length('{}', 1)` devuelve **NULL**, no 0, y un CHECK que evalua a NULL **pasa** —
-- sin el, este constraint no muerde el unico caso que existe para cazar.
ALTER TABLE "core"."business_membership" ADD CONSTRAINT "business_membership_staff_has_permission_check" CHECK ("core"."business_membership"."role" <> 'staff' or coalesce(array_length("core"."business_membership"."permissions", 1), 0) >= 1);
