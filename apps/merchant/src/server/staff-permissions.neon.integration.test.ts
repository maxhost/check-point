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
import { memberships } from "./schema";
import {
  POST as CREATE_STAFF,
  GET as LIST_STAFF,
} from "../app/api/staff/route";
import { PATCH as SET_PERMISSIONS } from "../app/api/staff/[userId]/permissions/route";

/**
 * Spec 0086 §4/§5 — **EL ALTA CON PERMISOS Y `PATCH /api/staff/:userId/permissions` CONTRA
 * LA BASE, con sesiones REALES.**
 *
 * Lo que ningún test con la base doblada puede dar:
 *
 * 1. **R4 y `staff_not_found`**, que se deciden leyendo una fila: el `role` del target y su
 *    `business_id`. Con `getDb` doblado se estaría midiendo el doble.
 * 2. **El aislamiento por negocio**: el `businessId` sale de la sesión, así que un caller de
 *    A no toca —ni confirma que exista— un integrante de B. Cada caso de aislamiento lleva su
 *    **control positivo en el mismo vector**: un rojo sin él no distingue «aislado» de «roto».
 * 3. Que un `PATCH` legítimo devuelva **200 contra la base real** — o sea que el writer y los
 *    tres `CHECK` de la migración 0041 **coinciden** en vez de contradecirse. Un conjunto que
 *    el validador acepta y la base rechaza saldría 503 acá.
 *
 * **LO QUE ESTE ARCHIVO NO MIDE, Y HAY QUE DECIRLO:** que los tres `CHECK` **RECHACEN** sus
 * tres estados inválidos. Los casos de abajo ejercitan los `400` del WRITER, que corta antes
 * de llegar a la base — así que un `CHECK` aflojado no pondría rojo a ninguno. Ese oráculo
 * vive en `membership-permissions-checks.neon.integration.test.ts`, que va por SQL crudo y
 * saltea el writer a propósito.
 */
const patch = (cookie: string, userId: string, body: unknown) =>
  SET_PERMISSIONS(
    conCookie(`/api/staff/${userId}/permissions`, "PATCH", cookie, body),
    { params: Promise.resolve({ userId }) },
  );

const create = (cookie: string, body: unknown) =>
  CREATE_STAFF(conCookie("/api/staff", "POST", cookie, body));

const list = (cookie: string) =>
  LIST_STAFF(conCookie("/api/staff", "GET", cookie));

describe.skipIf(!enabled)(
  "los permisos del staff contra Neon (spec 0086)",
  () => {
    const ids = {
      ownerA: `perm-owner-a-${randomUUID()}`,
      ownerB: `perm-owner-b-${randomUUID()}`,
    };
    const businessIds = { a: randomUUID(), b: randomUUID() };
    const slugs = {
      a: `permtest-a-${businessIds.a.slice(0, 8)}`,
      b: `permtest-b-${businessIds.b.slice(0, 8)}`,
    };
    /** Los `user.id` de cada integrante creado, para limpiarlos al final. */
    const creados: string[] = [];
    let cookieOwnerA = "";
    let cookieOwnerB = "";
    /** El perfil ADMINISTRADOR de A: tiene `staff`, y es quien prueba R1 y R3. */
    let adminA = "";
    let cookieAdminA = "";
    /** Un integrante común de A: el target de casi todo. */
    let peonA = "";
    /** Un integrante de B: el vector del aislamiento. */
    let peonB = "";

    const altaDe = async (
      cookie: string,
      name: string,
      permissions: string[],
    ) => {
      const response = await create(cookie, { name, permissions });
      expect(response.status).toBe(201);
      const { staff } = await response.json();
      creados.push(staff.userId);
      return staff.userId as string;
    };

    const filaDe = async (businessId: string, userId: string) => {
      const [row] = await getDb()
        .select({ permissions: memberships.permissions })
        .from(memberships)
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
      adminA = await altaDe(cookieOwnerA, "Admin A", ["staff", "catalog"]);
      peonA = await altaDe(cookieOwnerA, "Peon A", ["counter"]);
      peonB = await altaDe(cookieOwnerB, "Peon B", ["counter"]);
      cookieAdminA = await cookieDe(adminA);
    }, 180_000);

    afterAll(async () => {
      await limpiarNegocios(Object.values(businessIds), [
        ...Object.values(ids),
        ...creados,
      ]);
    }, 120_000);

    it("el alta escribe los permisos NORMALIZADOS en la fila y los devuelve", async () => {
      const response = await create(cookieOwnerA, {
        name: `Normalizado ${randomUUID().slice(0, 6)}`,
        permissions: ["counter", "brand", "counter"],
      });
      expect(response.status).toBe(201);
      const body = await response.json();
      creados.push(body.staff.userId);
      expect(body.staff.permissions).toEqual(["brand", "counter"]);
      expect(
        (await filaDe(businessIds.a, body.staff.userId))?.permissions,
      ).toEqual(["brand", "counter"]);
      // El PIN viaja UNA sola vez y el email sintético NUNCA (spec 0068 §2). El `StaffDTO`
      // cambió de forma en esta spec, así que la regla se RE-VERIFICA sobre el texto del DTO.
      expect(body.pin).toMatch(/^[0-9]{6}$/);
      const texto = JSON.stringify(body.staff);
      expect(texto).not.toContain("staff.invalid");
      expect(texto).not.toContain("pin");
      expect(texto).not.toContain("hash");
    }, 120_000);

    it("`PATCH` es un REEMPLAZO TOTAL: lo que no viaja, se quita", async () => {
      const target = await altaDe(
        cookieOwnerA,
        `Reemplazo ${randomUUID().slice(0, 6)}`,
        ["catalog", "counter", "brand"],
      );
      const response = await patch(cookieOwnerA, target, {
        permissions: ["locations"],
      });
      expect(response.status).toBe(200);
      expect((await response.json()).staff.permissions).toEqual(["locations"]);
      // Contra la FILA y no contra el DTO: la pregunta es qué quedó GUARDADO.
      expect((await filaDe(businessIds.a, target))?.permissions).toEqual([
        "locations",
      ]);
    }, 120_000);

    it.each([
      ["lista vacía", [] as string[], "permissions_required"],
      ["un valor fuera del catálogo", ["billing"], "unknown_permission"],
    ])(
      "%s → 400 `%s`, y la fila no se mueve",
      async (_label, permissions, code) => {
        const response = await patch(cookieOwnerA, peonA, { permissions });
        expect(response.status).toBe(400);
        expect((await response.json()).code).toBe(code);
        expect((await filaDe(businessIds.a, peonA))?.permissions).toEqual([
          "counter",
        ]);
      },
      120_000,
    );

    /** R1 — **un administrador no fabrica otro administrador**, ni editando ni dando de alta:
     * son dos superficies que escriben el mismo conjunto y las dos tienen el mismo techo. */
    it("R1: el ADMIN no otorga `staff` — ni editando ni dando de alta", async () => {
      const editar = await patch(cookieAdminA, peonA, {
        permissions: ["counter", "staff"],
      });
      expect(editar.status).toBe(403);
      expect((await editar.json()).code).toBe("permission_not_grantable");

      const alta = await create(cookieAdminA, {
        name: "Clon",
        permissions: ["staff"],
      });
      expect(alta.status).toBe(403);
      expect((await alta.json()).code).toBe("permission_not_grantable");

      // CONTROL POSITIVO en el mismo vector: el mismo admin SÍ otorga los otros seis, que es
      // la decisión textual del owner (ADR 0079 §3.2) — y encima uno que él no tiene. Sin
      // esto, un R1 que rechazara TODO pasaría los dos casos de arriba.
      const ok = await patch(cookieAdminA, peonA, {
        permissions: ["marketing"],
      });
      expect(ok.status).toBe(200);
      expect((await ok.json()).staff.permissions).toEqual(["marketing"]);
      await patch(cookieOwnerA, peonA, { permissions: ["counter"] });
    }, 180_000);

    /** R3 — **nadie edita sus propios permisos, tampoco el owner.** Sin ella el admin se
     * auto-otorga `staff` y R1 deja de significar algo. */
    it("R3: el ADMIN y el OWNER se apuntan a sí mismos → 403 `self_permission_edit`", async () => {
      // ADMIN PROPIO DE ESTE CASO y no el compartido, a propósito: si R3 se rompe, el
      // self-edit TIENE ÉXITO y le cambia los permisos al caller. Con el admin compartido eso
      // le sacaba `staff` y **contaminaba los casos siguientes con 403 colaterales** — medido
      // bajo la mutación M5. Un archivo cuyos casos se ensucian bajo mutación arruina la
      // lectura justo cuando más limpia hace falta.
      const propio = await altaDe(
        cookieOwnerA,
        `Admin R3 ${randomUUID().slice(0, 6)}`,
        ["staff", "catalog"],
      );
      const cookiePropio = await cookieDe(propio);
      // El cuerpo lleva SOLO permisos que este caller SÍ puede otorgar: así el rojo habla de
      // R3 y no de R1. Con `staff` adentro el `code` sería `permission_not_grantable` —R1 se
      // evalúa antes porque mira el CUERPO, y R3 mira el TARGET— y este caso estaría midiendo
      // la otra regla sin que se note. **Medido: da exactamente eso**, y por eso el orden
      // queda aseverado en positivo unas líneas más abajo en vez de supuesto.
      const admin = await patch(cookiePropio, propio, {
        permissions: ["catalog", "brand"],
      });
      expect(admin.status).toBe(403);
      expect((await admin.json()).code).toBe("self_permission_edit");

      const conStaff = await patch(cookiePropio, propio, {
        permissions: ["staff"],
      });
      expect((await conStaff.json()).code).toBe("permission_not_grantable");

      // El owner recibe `self_permission_edit` y NO `target_is_owner`: R3 va antes que R4 a
      // propósito, porque es la regla específica del caso.
      const owner = await patch(cookieOwnerA, ids.ownerA, {
        permissions: ["catalog"],
      });
      expect(owner.status).toBe(403);
      expect((await owner.json()).code).toBe("self_permission_edit");

      expect((await filaDe(businessIds.a, propio))?.permissions).toEqual([
        "catalog",
        "staff",
      ]);
    }, 120_000);

    /** R4 — **ninguna superficie de staff toca la membresía del owner.** Mismo `code` y mismo
     * status que `setStaffStatus`, no uno nuevo. El `CHECK 2` de la 0041 es la red de atrás. */
    it("R4: apuntar al OWNER del negocio → 409 `target_is_owner`", async () => {
      const response = await patch(cookieAdminA, ids.ownerA, {
        permissions: ["catalog"],
      });
      expect(response.status).toBe(409);
      expect((await response.json()).code).toBe("target_is_owner");
      expect((await filaDe(businessIds.a, ids.ownerA))?.permissions).toEqual(
        [],
      );
    }, 120_000);

    /** AISLAMIENTO, con su control positivo en el MISMO vector: el integrante de B recibe la
     * MISMA respuesta que un id inexistente —404 `staff_not_found`, a propósito: no se
     * confirma que un id exista— y el de A sigue respondiendo 200 a la misma llamada. */
    it("aislamiento: el integrante de OTRO negocio es un 404, igual que un id fantasma", async () => {
      const ajeno = await patch(cookieOwnerA, peonB, {
        permissions: ["brand"],
      });
      expect(ajeno.status).toBe(404);
      expect((await ajeno.json()).code).toBe("staff_not_found");

      const fantasma = await patch(cookieOwnerA, `no-existe-${randomUUID()}`, {
        permissions: ["brand"],
      });
      expect(fantasma.status).toBe(404);
      expect((await fantasma.json()).code).toBe("staff_not_found");

      // La fila de B NO se movió…
      expect((await filaDe(businessIds.b, peonB))?.permissions).toEqual([
        "counter",
      ]);
      // …y el CONTROL POSITIVO: el integrante propio sí se edita con la misma llamada.
      const propio = await patch(cookieOwnerA, peonA, {
        permissions: ["brand"],
      });
      expect(propio.status).toBe(200);
      await patch(cookieOwnerA, peonA, { permissions: ["counter"] });
    }, 180_000);

    /** `GET /api/staff` es la otra superficie delegable de esta familia: el ADMIN la abre —su
     * email sintético nunca se verifica y el paso 4 no lo alcanza— y el listado no cruza
     * negocios en ninguna de las dos direcciones. */
    it("el ADMIN lista a su equipo con los permisos, y el listado no cruza negocios", async () => {
      const response = await list(cookieAdminA);
      expect(response.status).toBe(200);
      const { staff } = await response.json();
      const mio = staff.find((row: { userId: string }) => row.userId === peonA);
      expect(mio.permissions).toEqual(["counter"]);
      expect(
        staff.some((row: { userId: string }) => row.userId === peonB),
      ).toBe(false);

      const cuerpoB = await (await list(cookieOwnerB)).json();
      expect(
        cuerpoB.staff.some((row: { userId: string }) => row.userId === peonA),
      ).toBe(false);
    }, 120_000);
  },
);
