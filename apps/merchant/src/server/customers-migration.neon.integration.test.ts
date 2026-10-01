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
          ORDER BY tablename`),
      ).toEqual(
        [
          ["business_customer_count", "business_customer_count_by_business"],
          ["loyalty_program", "loyalty_program_by_business"],
        ].map(([tablename, policyname]) => ({
          tablename,
          policyname,
          cmd: "SELECT",
          roles: "{customer_reader}",
          qual: "(business_id = (current_setting('app.business_id'::text))::uuid)",
        })),
      );
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
