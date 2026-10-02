import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { integrationEnabled } from "./customers-integration-support";
import { getDb } from "@mi-pasaporte/db";
import { rowsOf } from "@mi-pasaporte/domain/server/counter/core";

/**
 * Spec 0109 — los objetos de la migracion `0054` leidos por SQL: el contador, su trigger, los
 * grants y las politicas nuevas, y la funcion de busqueda reemplazada SIN perder su `proacl`.
 */
const one = async (query: ReturnType<typeof sql>) =>
  rowsOf(await getDb().execute(query));

/** La politica de la 0054: SELECT por `app.business_id` para `customer_reader`. */
const byBusiness = (tablename: string) => ({
  tablename,
  policyname: `${tablename}_by_business`,
  cmd: "SELECT",
  roles: "{customer_reader}",
  qual: "(business_id = (current_setting('app.business_id'::text))::uuid)",
});

/** Las de la 0060 para `checkpass_consumer`, en orden de `policyname`. */
const consumerApp = (tablename: string, cmds: string[]) =>
  cmds.map((cmd) => ({
    tablename,
    policyname: `consumer_app_${cmd.toLowerCase()}`,
    cmd,
    roles: "{checkpass_consumer}",
    qual: cmd === "INSERT" ? null : "true",
  }));

describe.skipIf(!integrationEnabled)(
  "listado de clientes — migracion 0054 (spec 0109)",
  () => {
    it("trigger AFTER INSERT OR DELETE, por fila, sobre la proyeccion", async () => {
      expect(
        await one(sql`SELECT event_manipulation, action_timing, action_orientation,
            event_object_schema, event_object_table
          FROM information_schema.triggers
          WHERE trigger_name = 'business_customer_count_sync'
          ORDER BY event_manipulation`),
      ).toEqual(
        ["DELETE", "INSERT"].map((event) => ({
          event_manipulation: event,
          action_timing: "AFTER",
          action_orientation: "ROW",
          event_object_schema: "core",
          event_object_table: "business_customer",
        })),
      );
    }, 60_000);

    it("RLS (ENABLE, no FORCE) y politicas por `app.business_id` en el contador y los programas", async () => {
      expect(
        await one(sql`SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
          WHERE oid IN ('core.business_customer_count'::regclass, 'core.loyalty_program'::regclass)
          ORDER BY relname`),
      ).toEqual(
        ["business_customer_count", "loyalty_program"].map((relname) => ({
          relname,
          relrowsecurity: true,
          relforcerowsecurity: false,
        })),
      );
      expect(
        await one(sql`SELECT tablename, policyname, cmd, roles::text AS roles, qual
          FROM pg_policies
          WHERE schemaname = 'core'
            AND tablename IN ('business_customer_count', 'loyalty_program')
          ORDER BY tablename, policyname`),
      ).toEqual([
        byBusiness("business_customer_count"),
        // Migracion 0060 (`packages/db/drizzle/0060_rol_del_cliente.sql`, ADR 0110): el rol
        // `checkpass_consumer` de la app del cliente lleva sus propias politicas `USING (true)`
        // en estas tablas. Un INSERT solo tiene `WITH CHECK`, por eso su `qual` es `null`.
        ...consumerApp("business_customer_count", [
          "INSERT",
          "SELECT",
          "UPDATE",
        ]),
        ...consumerApp("loyalty_program", ["SELECT"]),
        byBusiness("loyalty_program"),
      ]);
    }, 60_000);

    it("grants: el contador entero; de los programas SOLO id, business_id, kind y status", async () => {
      expect(
        await one(sql`SELECT
            has_table_privilege('customer_reader', 'core.business_customer_count', 'SELECT') AS counter,
            has_table_privilege('customer_reader', 'core.loyalty_program', 'SELECT') AS programs`),
      ).toEqual([{ counter: true, programs: false }]);
      expect(
        (
          await one(sql`SELECT column_name FROM information_schema.column_privileges
            WHERE grantee = 'customer_reader' AND table_schema = 'core'
              AND table_name = 'loyalty_program' AND privilege_type = 'SELECT'
            ORDER BY 1`)
        ).map((r) => (r as { column_name: string }).column_name),
      ).toEqual(["business_id", "id", "kind", "status"]);
    }, 60_000);

    it("la funcion de busqueda reemplazada conserva SECURITY DEFINER, search_path y proacl", async () => {
      expect(
        await one(sql`SELECT prosecdef, proconfig::text AS config,
            has_function_privilege('customer_reader', p.oid, 'EXECUTE') AS reader,
            has_function_privilege('public', p.oid, 'EXECUTE') AS anyone,
            p.proacl::text NOT LIKE '%{=X%' AND p.proacl::text NOT LIKE '%,=X%' AS no_public
          FROM pg_proc p WHERE p.proname = 'search_business_customers'`),
      ).toEqual([
        {
          prosecdef: true,
          config: '{"search_path=core, pg_temp"}',
          reader: true,
          anyone: false,
          no_public: true,
        },
      ]);
    }, 60_000);
  },
);
