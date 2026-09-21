import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  permisosIntegrationEnabled as enabled,
  seedOwnerDeNegocio,
} from "./permissions-integration-support";
import { getDb } from "./db";
import { businesses, memberships, users } from "./schema";

/**
 * Spec 0086 §1 — **LOS TRES `CHECK` DE LA MIGRACIÓN 0041, POR SQL CRUDO.**
 *
 * **Por qué existe este archivo y no alcanza con los tests del writer:** el validador
 * (`parsePermissions`) corta ANTES de tocar la base, así que todos los casos de
 * `staff-permissions.neon.integration.test.ts` reciben sus `400` sin que ningún `CHECK`
 * llegue a evaluarse. Un `CHECK` aflojado —o borrado— **no pondría rojo a ninguno de ellos**.
 * Acá se escribe por `db.execute` con SQL crudo, **salteando el writer a propósito**, que es
 * la única forma de preguntarle a la base si de verdad muerde.
 *
 * **Se asevera el `constraint` POR NOMBRE, no sólo el `23514`.** Los seis `CHECK` de la tabla
 * devuelven el mismo `SQLSTATE`: con `expect(code).toBe("23514")` los tres casos de abajo
 * pasarían aunque los rechazara el `staff_identity_check` por una razón que no tiene nada que
 * ver. El nombre es lo que hace que cada caso hable de SU invariante.
 *
 * **Y los tres controles positivos**, porque un `CHECK` que rechaza todo satisface los tres
 * casos negativos sin defender nada.
 */
type Fallo = { code?: string; constraint?: string };

describe.skipIf(!enabled)(
  "los tres CHECK de `business_membership.permissions` (spec 0086 §1)",
  () => {
    const ownerId = `chk-owner-${randomUUID()}`;
    const staffId = `chk-staff-${randomUUID()}`;
    const businessId = randomUUID();
    const slug = `chktest-${businessId.slice(0, 8)}`;

    /** `sql.raw` no interpola: se arman los statements con los ids ya embebidos, que son
     * UUID/strings generados acá y nunca entrada externa. */
    const ejecutar = async (statement: string): Promise<Fallo | null> => {
      try {
        await getDb().execute(sql.raw(statement));
        return null;
      } catch (error) {
        let actual: unknown = error;
        for (let i = 0; actual && i < 5; i += 1) {
          const c = actual as Fallo;
          if (c.code || c.constraint)
            return { code: c.code, constraint: c.constraint };
          actual = (actual as { cause?: unknown }).cause;
        }
        return {};
      }
    };

    const insertarStaff = (permissions: string | null) =>
      ejecutar(
        `insert into core.business_membership
           (business_id, user_id, role, status, handle, pin_hash${permissions === null ? "" : ", permissions"})
         values ('${businessId}', '${staffId}', 'staff', 'active', 'chk-${randomUUID().slice(0, 8)}', 'no-sirve'${permissions === null ? "" : `, ${permissions}`})`,
      );

    const limpiarStaff = () =>
      getDb().delete(memberships).where(eq(memberships.userId, staffId));

    beforeAll(async () => {
      await seedOwnerDeNegocio(ownerId, businessId, slug);
      await getDb()
        .insert(users)
        .values({
          id: staffId,
          name: "Staff CHK",
          email: `${staffId}@example.test`,
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
    }, 180_000);

    afterAll(async () => {
      const db = getDb();
      await db
        .delete(memberships)
        .where(eq(memberships.businessId, businessId));
      await db.delete(businesses).where(eq(businesses.id, businessId));
      for (const id of [ownerId, staffId]) {
        await db.delete(users).where(eq(users.id, id));
      }
    }, 120_000);

    /** CHECK 1 — contención de conjuntos. `<@` contra el catálogo de los siete. */
    it("CHECK 1: un permiso fuera del catálogo se RECHAZA", async () => {
      const fallo = await insertarStaff(`array['billing']::text[]`);
      expect(fallo?.code).toBe("23514");
      expect(fallo?.constraint).toBe("business_membership_permissions_check");
      await limpiarStaff();
    }, 120_000);

    /** CHECK 2 — el owner NO tiene permisos. Se ataca por `UPDATE` sobre la fila del owner,
     * que es el camino real: la fila ya existe y alguien intenta escribirle un alcance. */
    it("CHECK 2: escribirle permisos al OWNER se RECHAZA", async () => {
      const fallo = await ejecutar(
        `update core.business_membership set permissions = array['catalog']::text[]
           where business_id = '${businessId}' and user_id = '${ownerId}'`,
      );
      expect(fallo?.code).toBe("23514");
      expect(fallo?.constraint).toBe(
        "business_membership_owner_no_permissions_check",
      );
    }, 120_000);

    /**
     * CHECK 3 — un staff SIEMPRE tiene al menos uno, **y el `coalesce` es load-bearing**:
     * `array_length('{}', 1)` devuelve **NULL**, no 0, y un `CHECK` que evalúa a NULL
     * **PASA**. Sin el `coalesce`, este caso —el único que existe para cazar— pasaría en
     * silencio. Los DOS caminos: la lista vacía explícita y **el DEFAULT de la columna**, que
     * es el que toma una inserción que ni nombra el campo.
     */
    it.each([
      ["lista vacía explícita", `'{}'::text[]` as string | null],
      ["el DEFAULT de la columna (no se nombra el campo)", null],
    ])(
      "CHECK 3: un staff con %s se RECHAZA",
      async (_label, permissions) => {
        const fallo = await insertarStaff(permissions);
        expect(fallo?.code).toBe("23514");
        expect(fallo?.constraint).toBe(
          "business_membership_staff_has_permission_check",
        );
        await limpiarStaff();
      },
      120_000,
    );

    /** El `coalesce` medido en la BASE, no razonado: es la diferencia exacta entre un `CHECK`
     * que muerde y uno que evalúa NULL y deja pasar. */
    it("`array_length('{}', 1)` es NULL, y por eso el `coalesce` no es decorativo", async () => {
      const filas = await getDb().execute(
        sql.raw(
          `select (array_length('{}'::text[], 1) >= 1) as sin_coalesce,
                  (coalesce(array_length('{}'::text[], 1), 0) >= 1) as con_coalesce`,
        ),
      );
      const fila = (
        Array.isArray(filas) ? filas[0] : (filas as { rows: unknown[] }).rows[0]
      ) as { sin_coalesce: boolean | null; con_coalesce: boolean };
      // Sin `coalesce` el predicado es NULL → el CHECK **pasa**. Con él es `false` → muerde.
      expect(fila.sin_coalesce).toBeNull();
      expect(fila.con_coalesce).toBe(false);
    }, 120_000);

    /** LOS CONTROLES POSITIVOS, en el mismo vector que los tres rechazos: sin ellos, un
     * `CHECK` que rechazara TODO pasaría los casos de arriba sin defender nada. */
    it("los estados VÁLIDOS entran: staff con permisos, owner con `'{}'`", async () => {
      expect(
        await insertarStaff(`array['catalog','counter']::text[]`),
      ).toBeNull();
      // Y el duplicado ENTRA: `<@` es contención y no impide repetidos — la normalización es
      // del writer y tiene su propio caso. Queda escrito para que nadie lo lea como un bug.
      expect(
        await ejecutar(
          `update core.business_membership set permissions = array['catalog','catalog']::text[]
             where business_id = '${businessId}' and user_id = '${staffId}'`,
        ),
      ).toBeNull();
      expect(
        await ejecutar(
          `update core.business_membership set permissions = '{}'::text[]
             where business_id = '${businessId}' and user_id = '${ownerId}'`,
        ),
      ).toBeNull();
      await limpiarStaff();
    }, 120_000);
  },
);
