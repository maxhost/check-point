import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  conCookie,
  cookieDe,
  limpiarNegocios,
  permisosIntegrationEnabled as enabled,
  seedOwnerDeNegocio,
} from "./permissions-integration-support";
import { getDb } from "./db";
import { memberships, users } from "./schema";
import { POST as CREATE_STAFF } from "../app/api/staff/route";
import { PATCH as RENAME } from "../app/api/staff/[userId]/route";

/**
 * Spec 0087 — **`PATCH /api/staff/:userId` CONTRA LA BASE, con sesiones REALES.**
 *
 * Lo que ningun test con la base doblada puede dar:
 *
 * 1. **Que lo GUARDADO sea el handle nuevo**: el `identifier` se lee de `business_membership`
 *    y el nombre de `merchant_auth.user`, no del cuerpo de la respuesta.
 * 2. **Que la re-derivacion excluya al propio target**: con el doble, `taken` es lo que el
 *    test quiera; acá el handle de la fila es el que esta de verdad.
 * 3. **El aislamiento por negocio**, que lo da el `business_id` del `UPDATE`. Cada caso lleva
 *    su **control positivo en el mismo vector**: un rojo sin el no distingue «aislado» de
 *    «roto».
 * 4. Que el rechazo de `permissions` **no mueva la fila**.
 */
const patch = (cookie: string, userId: string, body: unknown) =>
  RENAME(conCookie(`/api/staff/${userId}`, "PATCH", cookie, body), {
    params: Promise.resolve({ userId }),
  });

const create = (cookie: string, body: unknown) =>
  CREATE_STAFF(conCookie("/api/staff", "POST", cookie, body));

describe.skipIf(!enabled)("el renombre del integrante (spec 0087)", () => {
  const ids = {
    ownerA: `ren-owner-a-${randomUUID()}`,
    ownerB: `ren-owner-b-${randomUUID()}`,
  };
  const businessIds = { a: randomUUID(), b: randomUUID() };
  const slugs = {
    a: `rentest-a-${businessIds.a.slice(0, 8)}`,
    b: `rentest-b-${businessIds.b.slice(0, 8)}`,
  };
  const creados: string[] = [];
  let cookieOwnerA = "";
  let cookieOwnerB = "";
  /** El perfil ADMINISTRADOR de A: tiene `staff` y es quien prueba el auto-renombre. */
  let adminA = "";
  let cookieAdminA = "";
  /** Un integrante de B: el vector del aislamiento. */
  let peonB = "";

  const altaDe = async (cookie: string, name: string) => {
    const response = await create(cookie, { name, permissions: ["counter"] });
    expect(response.status).toBe(201);
    const { staff } = await response.json();
    creados.push(staff.userId);
    return staff.userId as string;
  };

  /** La fila REAL: el handle de la membresia y el nombre del `user`. */
  const filaDe = async (businessId: string, userId: string) => {
    const [row] = await getDb()
      .select({
        handle: memberships.handle,
        permissions: memberships.permissions,
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
  };

  beforeAll(async () => {
    await seedOwnerDeNegocio(ids.ownerA, businessIds.a, slugs.a);
    await seedOwnerDeNegocio(ids.ownerB, businessIds.b, slugs.b);
    cookieOwnerA = await cookieDe(ids.ownerA);
    cookieOwnerB = await cookieDe(ids.ownerB);
    adminA = await altaDe(cookieOwnerA, "Admin A");
    await getDb()
      .update(memberships)
      .set({ permissions: ["staff", "catalog"] })
      .where(
        and(
          eq(memberships.businessId, businessIds.a),
          eq(memberships.userId, adminA),
        ),
      );
    cookieAdminA = await cookieDe(adminA);
    peonB = await altaDe(cookieOwnerB, "Peon B");
  }, 180_000);

  afterAll(async () => {
    await limpiarNegocios(Object.values(businessIds), [
      ...Object.values(ids),
      ...creados,
    ]);
  }, 120_000);

  it("re-deriva el identificador, y lo GUARDADO es el handle nuevo", async () => {
    const carla = await altaDe(cookieOwnerA, "Carla");
    const response = await patch(cookieOwnerA, carla, { name: "Carla Gómez" });
    expect(response.status).toBe(200);
    const { staff } = await response.json();
    expect(staff.identifier).toBe(`carla-gomez@${slugs.a}`);
    expect(staff.name).toBe("Carla Gómez");

    // Contra la FILA y no contra la respuesta: la pregunta es con qué string entra ahora.
    const fila = await filaDe(businessIds.a, carla);
    expect(fila?.handle).toBe("carla-gomez");
    expect(fila?.name).toBe("Carla Gómez");

    // Ni el email sintético ni nada del PIN salen por acá (regla de `CLAUDE.md`).
    const texto = JSON.stringify(staff);
    expect(texto).not.toContain("staff.invalid");
    expect(texto.toLowerCase()).not.toContain("pin");
    expect(texto.toLowerCase()).not.toContain("hash");
  }, 180_000);

  /** El handle que el target tiene HOY no cuenta como ocupado: sin esa exclusión, «Carla» →
   * «Carla» devolvería `carla-2` y el sufijo se bumpearía en CADA renombre. */
  it("renombrar a un nombre que slugifica IGUAL no bumpea el sufijo, dos veces seguidas", async () => {
    const carla = await altaDe(cookieOwnerA, "Carla Sola");
    expect((await filaDe(businessIds.a, carla))?.handle).toBe("carla-sola");

    const renombrarIgual = async () => {
      const response = await patch(cookieOwnerA, carla, {
        name: "Carla Sola",
      });
      expect(response.status).toBe(200);
      expect((await response.json()).staff.identifier).toBe(
        `carla-sola@${slugs.a}`,
      );
      expect((await filaDe(businessIds.a, carla))?.handle).toBe("carla-sola");
    };

    // DOS veces seguidas: un sufijo que se bumpea al renombrar deja `carla-sola-2` en la
    // primera vuelta, y la segunda es la que muestra que no se sigue acumulando.
    await renombrarIgual();
    await renombrarIgual();
  }, 180_000);

  it("el handle tomado por OTRO sufija, y una palabra reservada tampoco se toma", async () => {
    await altaDe(cookieOwnerA, "Marcos");
    const target = await altaDe(cookieOwnerA, "Sin Nombre");

    const colision = await patch(cookieOwnerA, target, { name: "Marcos" });
    expect(colision.status).toBe(200);
    expect((await colision.json()).staff.identifier).toBe(
      `marcos-2@${slugs.a}`,
    );
    expect((await filaDe(businessIds.a, target))?.handle).toBe("marcos-2");

    const reservada = await patch(cookieOwnerA, target, { name: "Admin" });
    expect(reservada.status).toBe(200);
    expect((await reservada.json()).staff.identifier).toBe(
      `admin-2@${slugs.a}`,
    );
  }, 180_000);

  /** El punto de la spec: se mira la PRESENCIA de la clave, no su valor — también con los
   * permisos que el integrante YA tiene, que es el bypass «es un no-op». */
  it.each([
    ["una lista", ["staff"]],
    ["los permisos ACTUALES", ["counter"]],
    ["null", null],
    ["lista vacía", []],
  ])(
    "`permissions` presente como %s → 400 `permissions_not_here`, y la fila no se mueve",
    async (_label, permissions) => {
      const target = await altaDe(
        cookieOwnerA,
        `Intacto ${randomUUID().slice(0, 6)}`,
      );
      const antes = await filaDe(businessIds.a, target);
      const response = await patch(cookieOwnerA, target, {
        name: "Nombre Nuevo",
        permissions,
      });
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe("permissions_not_here");
      // Ni el nombre, ni el handle, ni los permisos.
      expect(await filaDe(businessIds.a, target)).toEqual(antes);
    },
    180_000,
  );

  /** R3 **no** se extiende al nombre (ADR 0080 §3): uno mismo SÍ se renombra — y con eso se
   * cambia su propio login, que es lo que la UI tiene que avisar. */
  it("un integrante se renombra a SÍ MISMO → 200 con su identificador nuevo", async () => {
    const response = await patch(cookieAdminA, adminA, { name: "Admin Nuevo" });
    expect(response.status).toBe(200);
    expect((await response.json()).staff.identifier).toBe(
      `admin-nuevo@${slugs.a}`,
    );
    expect((await filaDe(businessIds.a, adminA))?.handle).toBe("admin-nuevo");
  }, 180_000);

  it("el userId del OWNER → 409 `target_is_owner`, y su fila no se mueve", async () => {
    const antes = await filaDe(businessIds.a, ids.ownerA);
    const response = await patch(cookieAdminA, ids.ownerA, {
      name: "Owner Renombrado",
    });
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("target_is_owner");
    expect(await filaDe(businessIds.a, ids.ownerA)).toEqual(antes);
  }, 180_000);

  /** AISLAMIENTO con su CONTROL POSITIVO en el mismo vector: el integrante de B recibe la
   * misma respuesta que un id fantasma —404, a propósito: no se confirma que exista— y el
   * propio sigue devolviendo 200 a la misma llamada. */
  it("el integrante de OTRO negocio es un 404, igual que un id fantasma", async () => {
    const antesB = await filaDe(businessIds.b, peonB);
    const ajeno = await patch(cookieOwnerA, peonB, { name: "Robado" });
    expect(ajeno.status).toBe(404);
    expect((await ajeno.json()).code).toBe("staff_not_found");
    expect(await filaDe(businessIds.b, peonB)).toEqual(antesB);

    /**
     * EL OWNER DE OTRO NEGOCIO, que es el vector que distingue el `business_id` de la LECTURA
     * DE DESEMPATE y no el del `UPDATE`: un integrante ajeno da 404 con el scope puesto **y
     * también sin él** (nunca es `owner`), así que este es el único caso que lo muerde. Sin
     * ese scope, la respuesta sería **409 `target_is_owner`**, que confirma que ese id existe
     * y además dice quién es — exactamente lo que el 404 uniforme existe para no decir.
     */
    const antesOwnerB = await filaDe(businessIds.b, ids.ownerB);
    const ownerAjeno = await patch(cookieOwnerA, ids.ownerB, {
      name: "Owner Robado",
    });
    expect(ownerAjeno.status).toBe(404);
    expect((await ownerAjeno.json()).code).toBe("staff_not_found");
    expect(await filaDe(businessIds.b, ids.ownerB)).toEqual(antesOwnerB);

    const fantasma = await patch(cookieOwnerA, `no-existe-${randomUUID()}`, {
      name: "Robado",
    });
    expect(fantasma.status).toBe(404);
    expect((await fantasma.json()).code).toBe("staff_not_found");

    const propio = await altaDe(cookieOwnerA, "Control Positivo");
    const ok = await patch(cookieOwnerA, propio, { name: "Control Movido" });
    expect(ok.status).toBe(200);
    expect((await filaDe(businessIds.a, propio))?.handle).toBe(
      "control-movido",
    );
  }, 180_000);

  // El `code` va SEGUNDO en la tupla porque es el segundo `%s` del titulo: con el `name` en
  // el medio, el titulo de estos casos imprimia los 81 caracteres en vez del `code`.
  it.each([
    ["vacío", "name_required", ""],
    ["solo espacios", "name_required", "   "],
    ["de 81 caracteres", "name_too_long", "a".repeat(81)],
  ])(
    "`name` %s → 400 `%s`, con los `code` del alta",
    async (_label, code, name) => {
      const target = await altaDe(
        cookieOwnerA,
        `Limite ${randomUUID().slice(0, 6)}`,
      );
      const antes = await filaDe(businessIds.a, target);
      const response = await patch(cookieOwnerA, target, { name });
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe(code);
      expect(await filaDe(businessIds.a, target)).toEqual(antes);

      // 80 caracteres SÍ pasan: el límite es el del alta y no uno nuevo.
      const ok = await patch(cookieOwnerA, target, { name: "b".repeat(80) });
      expect(ok.status).toBe(200);
      expect((await filaDe(businessIds.a, target))?.name).toBe("b".repeat(80));
    },
    180_000,
  );
});
