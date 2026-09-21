import { eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { businesses, users } from "./schema";
import type { GrantSeed } from "./onboarding-grant-support";
import { POST } from "../app/api/onboarding/tours/[tourId]/route";

/**
 * Soporte de `onboarding-tours.neon.integration.test.ts` (spec 0084). Existe **por el hook
 * `file-size`**: con el montaje adentro, ese archivo medía 333 líneas y el límite es 300 — la
 * regla del repo es dividir, no extender, y no se borra una aserción para hacer lugar. Mismo
 * motivo y misma forma que `onboarding-grant-support.ts`.
 *
 * **Acá no hay ni un `expect`**: los oráculos siguen en el test. Esto es sólo el montaje, y
 * todo lo de acá escribe o lee la base REAL — no dobla nada.
 */

/** Pega contra la ruta con el `tourId` en la URL **y** en `params`, que es como lo arma Next
 * en producción. `body === null` manda un `POST` sin cuerpo. */
export const postTour = (
  cookie: string | null,
  tourId: string,
  body: string | null = JSON.stringify({ status: "skipped" }),
) =>
  POST(
    new Request(`http://localhost:3001/api/onboarding/tours/${tourId}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      ...(body === null ? {} : { body }),
    }),
    { params: Promise.resolve({ tourId }) },
  );

/** Las filas del negocio, leídas por SQL crudo: es el ÚNICO oráculo del no-degradado, que por
 * HTTP no se ve (los dos estados proyectan `done: true`). */
export const toursOf = async (businessId: string) =>
  (
    await getDb().execute<{ tour_id: string; status: string }>(
      sql`select tour_id, status from core.business_onboarding_tour
           where business_id = ${businessId} order by tour_id`,
    )
  ).rows;

/** `count(*)::int` y no `count(*)` pelado: el driver devuelve `bigint` como STRING, así que
 * un `toBe(1)` contra `count(*)` fallaría con `"1"` y un `toBe(0)` con `"0"`. */
export const countOf = async (businessId: string) =>
  (
    await getDb().execute<{ n: number }>(
      sql`select count(*)::int as n from core.business_onboarding_tour
           where business_id = ${businessId}`,
    )
  ).rows[0].n;

export const wipeTours = (businessId: string) =>
  getDb().execute(
    sql`delete from core.business_onboarding_tour where business_id = ${businessId}`,
  );

/**
 * Un `INSERT` CRUDO, saltándose el handler y sus validadores: es la única forma de probar que
 * el `CHECK` de la BASE muerde y no la constante de TypeScript.
 *
 * Devuelve el `code` y la `constraint` de PG, **no el mensaje del error de drizzle**: drizzle
 * envuelve la excepción y su `.message` es sólo `Failed query: …` + los params, donde el
 * nombre de la constraint NO aparece. Un `toThrow(/…_status_check/)` sobre ese mensaje da
 * rojo SIEMPRE, con el CHECK puesto y sin él — medido. Lo que distingue está en `.cause`.
 *
 * `null` significa que el `INSERT` NO falló, que es el modo en que este oráculo tiene que
 * ponerse rojo si la migración no se aplicó o el `CHECK` se cayó.
 */
export const rawInsertViolation = async (
  businessId: string,
  tourId: string,
  status: string,
): Promise<{ code?: string; constraint?: string } | null> => {
  try {
    await getDb().execute(
      sql`insert into core.business_onboarding_tour (business_id, tour_id, status)
           values (${businessId}, ${tourId}, ${status})`,
    );
    return null;
  } catch (error) {
    const cause = (error as { cause?: { code?: string; constraint?: string } })
      .cause;
    return { code: cause?.code, constraint: cause?.constraint };
  }
};

/** Las columnas de la tabla según `information_schema` — la tabla REAL de la base, no el
 * `.sql` del árbol (un archivo de migración no prueba que se haya aplicado). */
export const tourTableColumns = async () =>
  (
    await getDb().execute<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      sql`select column_name, data_type, is_nullable from information_schema.columns
           where table_schema = 'core' and table_name = 'business_onboarding_tour'
           order by ordinal_position`,
    )
  ).rows;

export const tourTablePrimaryKey = async () =>
  (
    await getDb().execute<{ column_name: string }>(
      sql`select k.column_name
            from information_schema.table_constraints c
            join information_schema.key_column_usage k
              on k.constraint_name = c.constraint_name
             and k.constraint_schema = c.constraint_schema
           where c.table_schema = 'core'
             and c.table_name = 'business_onboarding_tour'
             and c.constraint_type = 'PRIMARY KEY'
           order by k.ordinal_position`,
    )
  ).rows.map((row) => row.column_name);

export const tourTableUserColumns = async () =>
  (
    await getDb().execute<{ column_name: string }>(
      sql`select column_name from information_schema.columns
           where table_schema = 'core' and table_name = 'business_onboarding_tour'
             and column_name like '%user%'`,
    )
  ).rows;

export const setVerified = (seed: GrantSeed, emailVerified: boolean) =>
  getDb()
    .update(users)
    .set({ emailVerified })
    .where(eq(users.id, seed.ownerId));

export const setBusinessStatus = (
  seed: GrantSeed,
  status: string,
  suspensionReason: string | null,
) =>
  getDb()
    .update(businesses)
    .set({ status, suspensionReason })
    .where(eq(businesses.id, seed.businessId));
