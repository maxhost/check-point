import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Spec 0086 §2 — **LA ESCALERA DE `requireApiPermission`, PASO POR PASO Y EN SU ORDEN.**
 *
 * `api-permission-surfaces.test.ts` mide la escalera **a través de las once rutas**, que es lo
 * que hace visible el día que una se quede atrás. Este archivo mide **el guard solo**, y su
 * valor es distinto: acá se pueden producir los estados que ninguna ruta real alcanza —un
 * `emailVerified` ausente, un `status` que el guard no conoce, un rol desconocido— y se puede
 * aseverar el ORDEN entre pasos que en una ruta se confunden con el desenlace del dominio.
 *
 * **El ORDEN es contrato, no detalle de implementación** (ADR 0073 §1). Cada caso de acá pone
 * al caller en DOS estados de falla a la vez y exige el `code` del paso MÁS TEMPRANO: así es
 * como se prueba un orden, y no con casos que fallan por un motivo solo.
 *
 * Se doblan la sesión y `membershipContext` —las dos únicas dependencias del guard— y se
 * verifica sobre el objeto que devuelve, sin HTTP: `businessStatusFailure` queda REAL, porque
 * el paso 5 es literalmente esa hoja y un doble mediría el doble.
 */
const world = vi.hoisted(() => ({
  session: null as null | { user: { id: string; emailVerified?: boolean } },
  membership: null as null | Record<string, unknown>,
}));

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({ api: { getSession: async () => world.session } }),
}));

vi.mock("./staff", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./staff")>()),
  membershipContext: async () => world.membership,
}));

import {
  requireApiPermission,
  requireApiPermissionSinGateDeEmail,
} from "./api-permission";

const BUSINESS = "11111111-1111-4111-8111-111111111111";

function fila(overrides: Record<string, unknown> = {}) {
  return {
    id: BUSINESS,
    slug: "la-farmacia",
    countryCode: "EC",
    currencyCode: "USD",
    status: "active",
    suspensionReason: null,
    role: "owner",
    permissions: [] as string[],
    ...overrides,
  };
}

const request = () => new Request("https://merchant.test/api/catalog");

/** El desenlace normalizado: o falló con `{status, code}`, o resolvió el negocio. */
async function resultado(
  fn = requireApiPermission,
): Promise<Record<string, unknown>> {
  const auth = await fn(request(), "catalog");
  if ("failure" in auth) {
    return {
      ok: false,
      status: auth.failure.status,
      code: auth.failure.code,
      reason: auth.failure.reason,
    };
  }
  return {
    ok: true,
    businessId: auth.business.id,
    role: auth.role,
    permissions: auth.permissions,
    userId: auth.userId,
  };
}

beforeEach(() => {
  world.session = null;
  world.membership = null;
});

describe("requireApiPermission — la escalera (spec 0086 §2)", () => {
  it("PASO 1: sin sesión → 401 `unauthorized`, y ni siquiera resuelve membresía", async () => {
    world.membership = fila();
    expect(await resultado()).toMatchObject({
      status: 401,
      code: "unauthorized",
    });
  });

  /**
   * PASO 2 ANTES DEL 3 — **es la mutación M2.** El caller no tiene membresía Y tampoco
   * tendría el permiso: recibe `not_member`. Al revés, el servidor le contaría a un tercero
   * qué permiso le habría hecho falta en un negocio que no es suyo.
   */
  it("PASO 2: sin membresía activa → `not_member`, nunca `missing_permission`", async () => {
    world.session = { user: { id: "u-ajeno", emailVerified: true } };
    world.membership = null;
    expect(await resultado()).toMatchObject({
      status: 403,
      code: "not_member",
    });
  });

  /**
   * PASO 2 ANTES DEL 5, y es la otra mitad del mismo orden: el negocio del caller **no
   * existe** para él, así que no puede enterarse de que hay uno suspendido. Un no-miembro
   * recibe `not_member` y **nunca** `business_suspended` (contrato §7).
   */
  it("PASO 2: un no-miembro NO recibe el estado de un negocio ajeno", async () => {
    world.session = { user: { id: "u-ajeno", emailVerified: false } };
    world.membership = null;
    const r = await resultado();
    expect(r.code).toBe("not_member");
    expect(r.code).not.toBe("business_suspended");
    expect(r.code).not.toBe("email_not_verified");
  });

  /**
   * PASO 3 ANTES DEL 4 Y DEL 5 — **es la mutación M1.** El integrante no tiene el permiso, su
   * email no está verificado y el negocio está suspendido: de los tres, el que sale es
   * `missing_permission`.
   */
  it("PASO 3: un integrante sin el scope → `missing_permission`, aunque el negocio esté suspendido", async () => {
    world.session = { user: { id: "u-staff", emailVerified: false } };
    world.membership = fila({
      role: "staff",
      permissions: ["brand"],
      status: "suspended",
      suspensionReason: "Pago rechazado.",
    });
    const r = await resultado();
    expect(r).toMatchObject({ status: 403, code: "missing_permission" });
    // Y el motivo de la suspensión NO viaja: el caller ni llegó al paso 5.
    expect(r.reason).toBeUndefined();
  });

  /**
   * PASO 4 — **EL GATE DE EMAIL NO ALCANZA AL STAFF, y es la mutación M3.** El integrante
   * tiene un email sintético `@staff.invalid` que nunca se entrega y **ninguna acción con la
   * que verificar nada**: un gate que lo alcanzara dejaría sus once superficies muertas para
   * siempre. Los dos casos —clave en `false` y clave AUSENTE— porque el segundo es el
   * fail-closed del dato y sólo se puede producir acá.
   */
  it.each([false, undefined])(
    "PASO 4: un STAFF con `emailVerified: %s` PASA",
    async (emailVerified) => {
      world.session = { user: { id: "u-staff", emailVerified } };
      world.membership = fila({ role: "staff", permissions: ["catalog"] });
      expect(await resultado()).toEqual({
        ok: true,
        businessId: BUSINESS,
        role: "staff",
        permissions: ["catalog"],
        userId: "u-staff",
      });
    },
  );

  it.each([false, undefined])(
    "PASO 4: un OWNER con `emailVerified: %s` NO pasa (fail-closed en el dato)",
    async (emailVerified) => {
      world.session = { user: { id: "u-owner", emailVerified } };
      world.membership = fila();
      expect(await resultado()).toMatchObject({
        status: 403,
        code: "email_not_verified",
      });
    },
  );

  /** PASO 4 ANTES DEL 5, el mismo orden que ya tenían `requireApiOwner` y el mostrador
   * «para que las dos superficies contesten lo mismo ante el mismo caller». */
  it("PASO 4: un owner sin verificar sobre un negocio suspendido recibe `email_not_verified`", async () => {
    world.session = { user: { id: "u-owner", emailVerified: false } };
    world.membership = fila({ status: "suspended", suspensionReason: "X" });
    expect(await resultado()).toMatchObject({ code: "email_not_verified" });
  });

  it("PASO 5: el OWNER recibe `business_suspended` CON el motivo", async () => {
    world.session = { user: { id: "u-owner", emailVerified: true } };
    world.membership = fila({
      status: "suspended",
      suspensionReason: "Pago rechazado tres veces.",
    });
    expect(await resultado()).toMatchObject({
      status: 403,
      code: "business_suspended",
      reason: "Pago rechazado tres veces.",
    });
  });

  /** El `suspensionReason` es una nota interna sobre la CUENTA y se serializa **sólo al
   * owner** (spec 0072 §D4). El integrante recibe el mismo `code` y el 403 mudo — lo mismo
   * que ya hacen `auth-guards.ts` y `session-view.ts` sobre esta misma fila. */
  it("PASO 5: un STAFF con el permiso recibe `business_suspended` SIN el motivo", async () => {
    world.session = { user: { id: "u-staff", emailVerified: false } };
    world.membership = fila({
      role: "staff",
      permissions: ["catalog"],
      status: "suspended",
      suspensionReason: "Nota interna del caso.",
    });
    const r = await resultado();
    expect(r).toMatchObject({ status: 403, code: "business_suspended" });
    expect(r.reason).toBeUndefined();
  });

  it("PASO 5: `closed` frena a los dos roles y nunca lleva motivo", async () => {
    world.session = { user: { id: "u-owner", emailVerified: true } };
    world.membership = fila({
      status: "closed",
      suspensionReason: "Motivo viejo.",
    });
    const r = await resultado();
    expect(r).toMatchObject({ code: "business_closed" });
    expect(r.reason).toBeUndefined();
  });

  /** Fail-CLOSED: un `status` que nadie le enseñó al guard no opera. El `CHECK` de la columna
   * hoy admite tres valores; el día que admita un cuarto, no se pasa de largo. */
  it("PASO 5: un `status` desconocido no opera", async () => {
    world.session = { user: { id: "u-owner", emailVerified: true } };
    world.membership = fila({ status: "frozen" });
    expect(await resultado()).toMatchObject({ code: "business_suspended" });
  });

  it("el camino feliz devuelve `role` y `permissions`, que es lo que necesitan R1 y R3", async () => {
    world.session = { user: { id: "u-owner", emailVerified: true } };
    world.membership = fila();
    expect(await resultado()).toEqual({
      ok: true,
      businessId: BUSINESS,
      role: "owner",
      permissions: [],
      userId: "u-owner",
    });
  });
});

describe("requireApiPermissionSinGateDeEmail — la misma escalera sin el paso 4", () => {
  /** LO ÚNICO que la distingue de su hermana. Un owner sin verificar pasa acá y no allá, con
   * el MISMO estado del mundo: es el par que prueba que la diferencia es el paso 4 y no otra
   * cosa. */
  it.each([false, undefined])(
    "un OWNER con `emailVerified: %s` PASA acá y NO pasa con el gate",
    async (emailVerified) => {
      world.session = { user: { id: "u-owner", emailVerified } };
      world.membership = fila();
      expect(await resultado(requireApiPermissionSinGateDeEmail)).toMatchObject(
        { ok: true, role: "owner" },
      );
      expect(await resultado(requireApiPermission)).toMatchObject({
        code: "email_not_verified",
      });
    },
  );

  /** **Y NO AFLOJA NINGÚN OTRO PASO**: sacar el 4 no es sacar el 2, el 3 ni el 5. Sin estos
   * tres casos, una hermana que devolviera el negocio sin mirar nada pasaría el de arriba. */
  it("sigue exigiendo membresía (paso 2)", async () => {
    world.session = { user: { id: "u-ajeno", emailVerified: true } };
    world.membership = null;
    expect(await resultado(requireApiPermissionSinGateDeEmail)).toMatchObject({
      code: "not_member",
    });
  });

  it("sigue exigiendo el alcance (paso 3)", async () => {
    world.session = { user: { id: "u-staff", emailVerified: false } };
    world.membership = fila({ role: "staff", permissions: ["brand"] });
    expect(await resultado(requireApiPermissionSinGateDeEmail)).toMatchObject({
      code: "missing_permission",
    });
  });

  it("sigue exigiendo que el negocio opere (paso 5)", async () => {
    world.session = { user: { id: "u-owner", emailVerified: false } };
    world.membership = fila({ status: "closed" });
    expect(await resultado(requireApiPermissionSinGateDeEmail)).toMatchObject({
      code: "business_closed",
    });
  });
});
