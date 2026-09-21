import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";

import {
  conCookie,
  cookieDe,
  limpiarNegocios,
  permisosIntegrationEnabled,
  seedOwnerDeNegocio,
} from "./permissions-integration-support";
import { getDb } from "./db";
import { memberships, users } from "./schema";
import { POST as CREATE_STAFF } from "../app/api/staff/route";
import { PATCH as RENAME } from "../app/api/staff/[userId]/route";
import { POST as SET_STATUS } from "../app/api/staff/[userId]/status/route";

/**
 * EL MONTAJE COMPARTIDO de los archivos de integracion de la spec 0087, aparte por el hook
 * `file-size`: `staff-rename.neon.integration.test.ts` llego a **285 de 300 lineas** y la
 * enmienda del `status` traia tres casos mas. La regla del repo es **dividir, no extender** —
 * y dividir copiando el seed lo habria duplicado, que es como dos suites terminan midiendo
 * mundos distintos sin que nadie lo vea (leccion de la 0086).
 *
 * **Acá no hay ni un `expect`**: esto es el montaje, los oraculos viven en los tests. Lo unico
 * que este modulo hace ruidoso es el fallo del propio montaje ({@link altaDe} tira si el alta
 * no devuelve 201), porque un montaje que falla en silencio deja al test midiendo nada.
 */

export const renombreIntegrationEnabled = permisosIntegrationEnabled;

/** `PATCH /api/staff/:userId` — el renombre. */
export const patch = (cookie: string, userId: string, body: unknown) =>
  RENAME(conCookie(`/api/staff/${userId}`, "PATCH", cookie, body), {
    params: Promise.resolve({ userId }),
  });

/** `POST /api/staff/:userId/status` — la baja y la reactivacion, que es REVERSIBLE. */
export const setStatus = (cookie: string, userId: string, status: string) =>
  SET_STATUS(
    conCookie(`/api/staff/${userId}/status`, "POST", cookie, { status }),
    { params: Promise.resolve({ userId }) },
  );

export type Montaje = {
  ids: { ownerA: string; ownerB: string };
  businessIds: { a: string; b: string };
  slugs: { a: string; b: string };
  cookieOwnerA: string;
  cookieOwnerB: string;
  /** Los `user.id` de cada integrante creado, para limpiarlos al final. */
  creados: string[];
};

/**
 * DOS negocios con su owner y sus sesiones REALES (`internalAdapter.createSession`, no un
 * doble). Son dos y no uno porque **el aislamiento no se puede medir con un solo negocio**.
 *
 * El `prefijo` separa los ids de cada archivo: dos suites sobre la misma rama de Neon que
 * compartieran slug chocarian contra el unico de `core.business.slug`.
 */
export async function montarDosNegocios(prefijo: string): Promise<Montaje> {
  const ids = {
    ownerA: `${prefijo}-owner-a-${randomUUID()}`,
    ownerB: `${prefijo}-owner-b-${randomUUID()}`,
  };
  const businessIds = { a: randomUUID(), b: randomUUID() };
  const slugs = {
    a: `${prefijo}-a-${businessIds.a.slice(0, 8)}`,
    b: `${prefijo}-b-${businessIds.b.slice(0, 8)}`,
  };
  await seedOwnerDeNegocio(ids.ownerA, businessIds.a, slugs.a);
  await seedOwnerDeNegocio(ids.ownerB, businessIds.b, slugs.b);
  return {
    ids,
    businessIds,
    slugs,
    cookieOwnerA: await cookieDe(ids.ownerA),
    cookieOwnerB: await cookieDe(ids.ownerB),
    creados: [],
  };
}

export async function desmontar(montaje: Montaje): Promise<void> {
  await limpiarNegocios(Object.values(montaje.businessIds), [
    ...Object.values(montaje.ids),
    ...montaje.creados,
  ]);
}

/**
 * Da de alta a un integrante **por la ruta real** y anota su id para la limpieza. El alta es
 * la unica forma de que el integrante nazca como nace en produccion: `emailVerified: false`,
 * email sintetico y sin fila en `account`. **No se siembra a mano.**
 */
export async function altaDe(
  montaje: Montaje,
  cookie: string,
  name: string,
  permissions: string[] = ["counter"],
): Promise<string> {
  const response = await CREATE_STAFF(
    conCookie("/api/staff", "POST", cookie, { name, permissions }),
  );
  if (response.status !== 201) {
    throw new Error(
      `el montaje no pudo dar de alta a «${name}»: ${response.status} ${JSON.stringify(
        await response.json(),
      )}`,
    );
  }
  const { staff } = await response.json();
  montaje.creados.push(staff.userId);
  return staff.userId as string;
}

/** La fila REAL: el handle y el estado de la membresia, y el nombre del `user`. */
export async function filaDe(businessId: string, userId: string) {
  const [row] = await getDb()
    .select({
      handle: memberships.handle,
      permissions: memberships.permissions,
      status: memberships.status,
      name: users.name,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(
      and(
        eq(memberships.businessId, businessId),
        eq(memberships.userId, userId),
      ),
    );
  return row;
}

/** Le escribe los permisos a una membresia sin pasar por `PATCH …/permissions`, que esta spec
 * NO toca. Se usa para fabricar el perfil ADMINISTRADOR del montaje. */
export async function darPermisos(
  businessId: string,
  userId: string,
  permissions: string[],
): Promise<void> {
  await getDb()
    .update(memberships)
    .set({ permissions })
    .where(
      and(
        eq(memberships.businessId, businessId),
        eq(memberships.userId, userId),
      ),
    );
}
