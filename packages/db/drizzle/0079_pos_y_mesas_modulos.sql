-- Spec 0220 / ADR 0141 §6 — EL POS Y MESAS PASAN A SER MODULOS. Escrita A MANO: para un cambio de
-- esquema drizzle-kit genera DROP + CREATE (perderia las filas). `SET SCHEMA` conserva filas, FKs,
-- indices, constraints y secuencias; los nombres `core_pos_*` / `core_dining_table_*` quedan como
-- estan (renombrarlos es cosmetico, fuera de alcance).
CREATE SCHEMA IF NOT EXISTS "pos";--> statement-breakpoint
ALTER TABLE "core"."dining_table" SET SCHEMA "pos";--> statement-breakpoint
ALTER TABLE "core"."pos_order" SET SCHEMA "pos";--> statement-breakpoint
ALTER TABLE "core"."pos_order_item" SET SCHEMA "pos";--> statement-breakpoint
ALTER TABLE "core"."ticket_settings" SET SCHEMA "pos";--> statement-breakpoint
-- DATOS: todo comercio con el POS encendido queda con los modulos `pos` y `tables` encendidos (hoy
-- las mesas vienen con el POS). Un comercio con el POS apagado no recibe fila (sin fila = apagado).
INSERT INTO "core"."business_module" ("business_id", "module_id", "enabled")
SELECT "core"."business"."id", "m"."module_id", true
FROM "core"."business", (VALUES ('pos'), ('tables')) AS "m"("module_id")
WHERE "core"."business"."pos_enabled" = true
ON CONFLICT ("business_id", "module_id") DO UPDATE SET "enabled" = true, "updated_at" = now();--> statement-breakpoint
ALTER TABLE "core"."business" DROP COLUMN "pos_enabled";
