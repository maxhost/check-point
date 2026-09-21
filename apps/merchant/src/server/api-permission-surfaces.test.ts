import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Spec 0086 §2/§3 — **LA ESCALERA DE PERMISOS SOBRE LAS ONCE ENTRADAS DELEGABLES**, en una
 * matriz, y con el reparto contra las CUATRO de la CUENTA aseverado como CERRADO.
 *
 * Por qué es un archivo aparte de `api-owner-surfaces.test.ts` y no un `describe` más:
 * **el hook `file-size` corta en 300 líneas** y ese archivo ya estaba cerca. La regla del
 * repo es dividir, no extender, y no se borra una aserción para hacer lugar. **La tabla, el
 * mundo y los dobles son LOS MISMOS** (`api-owner-surfaces-support.ts`), así que las dos
 * baterías no pueden hablar de conjuntos distintos: `SURFACES_DELEGABLES` y
 * `SURFACES_SOLO_OWNER` salen de `SURFACES` por filtro y su suma se asevera abajo.
 *
 * Lo que este archivo mide es **qué status y qué `code`** sale de cada entrada delegable en
 * los cuatro estados que la 0086 agrega: sin membresía, con el permiso equivocado, con el
 * propio, y con el email sin verificar siendo staff.
 */
import {
  SCOPE_POR_SUPERFICIE,
  SURFACES,
  SURFACES_DELEGABLES,
  SURFACES_SOLO_OWNER,
  dobleDeGetDb,
  dobleDeMembershipContext,
  dobleDeOwnerContext,
  dobleDeProgramForOwner,
  dobleDeSaveProgram,
  dobleDeSesion,
  filaDeStaff,
  world,
} from "./api-owner-surfaces-support";

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({ api: { getSession: () => dobleDeSesion() } }),
}));

vi.mock("./staff", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./staff")>()),
  ownerContext: () => dobleDeOwnerContext(),
  membershipContext: () => dobleDeMembershipContext(),
}));

vi.mock("./loyalty-program", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./loyalty-program")>()),
  programForOwner: () => dobleDeProgramForOwner(),
  saveProgram: () => dobleDeSaveProgram(),
}));

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  getDb: () => dobleDeGetDb(),
}));

beforeEach(() => {
  world.session = null;
  world.ownerRow = null;
  world.membershipRow = null;
});

describe("las once superficies DELEGABLES — la escalera de permisos (spec 0086 §2)", () => {
  /**
   * **EL REPARTO DE LA SPEC 0086, y es la mitad del valor de esa spec:** las CUATRO
   * superficies de la CUENTA (ADR 0079 §8) conservan `requireApiOwner` y su `not_owner`,
   * que ahí sigue siendo literal; las ONCE delegables migraron y ya no lo emiten.
   *
   * Los dos pisos, como en el resto del archivo: sin ellos, mover una fila de un lado
   * dejaría su `it.each` sin correr NI UNA vez, en verde.
   */
  it("las 15 se parten en 4 de la CUENTA y 11 delegables, sin perder ni duplicar", () => {
    expect(SURFACES_SOLO_OWNER.map(([name]) => name)).toEqual([
      "billing/checkout",
      "merchant/business/slug",
      "onboarding/checklist",
      "onboarding/tours/{tourId}",
    ]);
    expect(SURFACES_DELEGABLES.length).toBe(11);
    expect(SURFACES_SOLO_OWNER.length + SURFACES_DELEGABLES.length).toBe(
      SURFACES.length,
    );
  });

  it.each(SURFACES_SOLO_OWNER)(
    "%s: un INTEGRANTE (sin email verificado) → 403 `not_owner`, nunca `email_not_verified`",
    async (_name, call) => {
      world.session = { user: { id: "user-staff", emailVerified: false } };
      world.ownerRow = null;
      const response = await call();
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("not_owner");
    },
  );

  /**
   * EL ORDEN DE LA ESCALERA NUEVA, y es la mutación M2: un caller **sin membresía activa**
   * recibe `not_member` (paso 2) aunque su email no esté verificado (paso 4) y aunque le
   * faltara el permiso (paso 3). Puesto al revés, se le contaría a un tercero qué permiso le
   * habría hecho falta en un negocio que no es suyo.
   */
  it.each(SURFACES_DELEGABLES)(
    "%s: SIN membresía activa → 403 `not_member`, nunca `missing_permission` ni `email_not_verified`",
    async (_name, call) => {
      world.session = { user: { id: "user-ajeno", emailVerified: false } };
      world.ownerRow = null;
      world.membershipRow = null;
      const response = await call();
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("not_member");
    },
  );

  /** El paso 3: un integrante ACTIVO con un permiso que no es el de esta superficie. El
   * scope que trae es el de OTRA familia a propósito — el error plausible del QA no es sólo
   * «no muerde», es «muerde el equivocado». Es la mutación M1. */
  it.each(SURFACES_DELEGABLES)(
    "%s: un INTEGRANTE con el permiso EQUIVOCADO → 403 `missing_permission`",
    async (name, call) => {
      const mio = SCOPE_POR_SUPERFICIE[name];
      const ajeno = mio === "catalog" ? "brand" : "catalog";
      world.session = { user: { id: "user-staff", emailVerified: false } };
      world.ownerRow = null;
      world.membershipRow = filaDeStaff([ajeno]);
      const response = await call();
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("missing_permission");
    },
  );

  /** EL CONTROL POSITIVO EN EL MISMO VECTOR: con SU permiso, la misma llamada deja de
   * frenarse por autorización. Sin él, un guard que contestara 403 a todo pasaría el caso de
   * arriba sin distinguir «acotado» de «muerto».
   *
   * **`not 401/403`, y no `toBe(200)`**: algunas de las once llegan a su dominio doblado y
   * otras a uno real; lo que este archivo mide es el GUARD. El desenlace COMPLETO de las que
   * pasan vive en `DESENLACE_SIN_GATE` y en las suites de cada dominio. */
  it.each(SURFACES_DELEGABLES)(
    "%s: un INTEGRANTE con SU permiso no recibe 401/403 (control positivo)",
    async (name, call) => {
      world.session = { user: { id: "user-staff", emailVerified: false } };
      world.ownerRow = null;
      world.membershipRow = filaDeStaff([SCOPE_POR_SUPERFICIE[name]]);
      const response = await call();
      expect([401, 403]).not.toContain(response.status);
    },
  );

  /** LA MUTACIÓN M3: el paso 4 **no alcanza al staff**. Los integrantes de los dos casos de
   * arriba van con `emailVerified: false` a propósito — su email es sintético y no se
   * verifica NUNCA—, así que un gate que los alcanzara dejaría las once superficies muertas
   * para siempre. Acá se asevera explícito, con la clave AUSENTE (el fail-closed del dato). */
  it.each(SURFACES_DELEGABLES)(
    "%s: un INTEGRANTE SIN la clave `emailVerified` tampoco recibe `email_not_verified`",
    async (name, call) => {
      world.session = { user: { id: "user-staff" } };
      world.ownerRow = null;
      world.membershipRow = filaDeStaff([SCOPE_POR_SUPERFICIE[name]]);
      const response = await call();
      expect([401, 403]).not.toContain(response.status);
    },
  );
});
