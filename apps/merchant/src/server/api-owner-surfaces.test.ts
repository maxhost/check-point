import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Spec 0072 §D3/§D4 — EL GATE DE LAS SUPERFICIES DE API DEL OWNER, las 10, en una matriz.
 *
 * Por qué acá y no repartido por dominio: el agujero que esta spec cierra es justamente que
 * **cada dominio tenía su propio resolvedor** y sólo uno chequeaba el email. Un test por
 * dominio reproduce esa estructura y no vería el día que uno se quede atrás; esta tabla sí,
 * porque agregar una ruta owner sin su fila acá es visible de un vistazo.
 *
 * Lo que NO prueba: el camino feliz de cada dominio (eso lo tienen sus propias suites) ni la
 * resolución real contra Postgres (eso es `ownerContext`, con su integración). Acá se dobla
 * la sesión y `ownerContext`, y se mide **qué status y qué `code`** sale de cada ruta en los
 * cinco estados del caller.
 */
const world = vi.hoisted(() => ({
  session: null as null | { user: { id: string; emailVerified?: boolean } },
  ownerRow: null as null | Record<string, unknown>,
  /** El negocio y el programa del caller. Viven acá —y no en una `const` de módulo— porque
   * los factories de `vi.mock` se hoistean por encima de las declaraciones del archivo. */
  businessId: "11111111-1111-4111-8111-111111111111",
  programId: "99999999-9999-4999-8999-999999999999",
  slug: "la-farmacia",
}));

const CALLER_BUSINESS = world.businessId;

/**
 * La fila de la SESIÓN se dobla en un solo lugar y con el permiso de alta en `null` (spec
 * 0077): los casos de abajo sólo tocan `world.session.user`, que es lo que este archivo
 * mide. El permiso con valor tiene sus propios archivos contra Neon.
 */
vi.mock("./auth", () => ({
  getMerchantAuth: () => ({
    api: {
      getSession: async () =>
        world.session && {
          ...world.session,
          session: { onboardingGrantUntil: null },
        },
    },
  }),
}));

vi.mock("./staff", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./staff")>()),
  ownerContext: async () => world.ownerRow,
}));

/**
 * Spec 0075 — **el QR es la única fila que PASA el gate** en un caso, así que es la única que
 * llega a su dominio. Sus dos dependencias de datos se doblan para que ese 200 sea
 * **determinista**: sin esto daría 403 `not_owner` con `DATABASE_URL` puesta (el usuario
 * doblado no existe en la base) y 503 `qr_unavailable` sin ella, y **ninguno de los dos
 * probaría la polaridad**. El 200 contra la base lo prueba `loyalty-qr.neon.integration`.
 */
vi.mock("./loyalty-program", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./loyalty-program")>()),
  programForOwner: async () => ({
    business: { id: world.businessId },
    program: { id: world.programId },
    rewards: [],
  }),
  /**
   * Spec 0079 — el `PUT` de la ruta única es la segunda fila sin paso 3, y su desenlace
   * positivo es un 201. El writer se dobla **a propósito**: este archivo mide el GUARD, y
   * el invariante crear ≠ editar que `saveProgram` aplica de verdad se mide contra Neon
   * (`onboarding-program-bypass.neon.integration.test.ts`). Sin el doble, el 201 dependería
   * de si hay `DATABASE_URL` y no probaría la polaridad de nada.
   */
  saveProgram: async () => ({ programId: world.programId, created: true }),
}));

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => [{ slug: world.slug }] }),
      }),
    }),
  }),
}));

/**
 * Spec 0075 — **el email es el único de los cuatro pasos que no se aplica parejo**, y la tabla
 * se parte para ASEVERAR las excepciones en vez de perderlas de vista. `SURFACES` sigue entera
 * (14) para los otros cinco casos: las tres sin gate se miden igual que las demás en
 * `unauthorized`, `not_owner`, `business_suspended`, `business_closed` y `status` desconocido.
 * Las dos tablas salen de `SURFACES` por filtro —no son listas paralelas—, así que mover una
 * fila cambia los pisos. La tabla vive en `api-owner-surfaces-support.ts` por el hook
 * `file-size`; los oráculos y los dobles siguen acá.
 */
import {
  SURFACES,
  SURFACES_CON_GATE_DE_EMAIL,
  SURFACES_SIN_GATE_DE_EMAIL,
} from "./api-owner-surfaces-support";

/**
 * EL DESENLACE POSITIVO DE CADA EXCEPCIÓN, por fila. Un `not.toBe(403)` diría lo mismo si la
 * ruta se rompiera de cualquier otra forma: acá se exige el desenlace COMPLETO del camino
 * feliz. Es el oráculo de la mutación M1 de la 0079 (y de la M1 de la 0075).
 */
const DESENLACE_SIN_GATE: Record<
  string,
  (response: Response) => Promise<void>
> = {
  "loyalty-program/qr": async (response) => {
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    const body = await response.text();
    expect(body).toContain("<svg");
    expect(body).not.toContain("email_not_verified");
  },
  "loyalty-program (PUT)": async (response) => {
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      programId: world.programId,
      created: true,
    });
  },
  /** Spec 0083 §D5 — la TERCERA, y su desenlace es EL caso central de esa spec. */
  "onboarding/checklist": async (response) => {
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.locale).toBe("es");
    expect(body.items[0].id).toBe("verify-email");
    expect(body.items[0].done).toBe(false);
  },
};

function ownerRow(status: string, suspensionReason: string | null = null) {
  return {
    id: CALLER_BUSINESS,
    slug: world.slug,
    currencyCode: "USD",
    status,
    suspensionReason,
  };
}

beforeEach(() => {
  world.session = null;
  world.ownerRow = null;
});

describe("las superficies de API del owner — el gate unificado (spec 0072 §D3)", () => {
  it("son 14 entradas HTTP y ninguna se cayó de la tabla", () => {
    // Piso del barrido: sin esto, una tabla que quedara vacía dejaría cada `it.each` de
    // abajo sin correr NI UNA vez y el archivo entero pasaría en verde sin medir nada.
    expect(SURFACES.length).toBe(14);
  });

  /**
   * **EL CONJUNTO EXACTO DE TRES, criterio del DoD de la 0079 y de la 0083** — no «al menos
   * una». El valor del oráculo es que sea CERRADO: con un `toContain` o un `length >= 1`, una
   * cuarta ruta que se sacara el paso 3 entraría sin que nadie lo vea. La 0075 exigía UNA, la
   * 0079 lo pasó a DOS y la 0083 a TRES, **cada vez a propósito y con el motivo escrito en
   * `api-owner-surfaces-support.ts`**: el de la tercera es el auto-gateo.
   */
  it("las rutas SIN paso 3 son EXACTAMENTE tres: el QR, la escritura del programa y el checklist", () => {
    expect(SURFACES_SIN_GATE_DE_EMAIL.map(([name]) => name)).toEqual([
      "loyalty-program (PUT)",
      "loyalty-program/qr",
      "onboarding/checklist",
    ]);
  });

  it("las dos tablas del email parten las 14 sin perder ni duplicar ninguna", () => {
    // Spec 0075 §D3. Sin estos pisos, mover una fila de una tabla a la otra —o vaciar la de
    // las excepciones— dejaría su `it.each` sin correr NI UNA vez, en verde.
    expect(SURFACES_CON_GATE_DE_EMAIL.length).toBe(11);
    expect(SURFACES_SIN_GATE_DE_EMAIL.length).toBe(3);
    expect(
      SURFACES_CON_GATE_DE_EMAIL.length + SURFACES_SIN_GATE_DE_EMAIL.length,
    ).toBe(SURFACES.length);
    // Y cada excepción tiene su desenlace positivo declarado: una fila nueva sin oráculo
    // reventaría acá en vez de pasar con un `undefined` silencioso.
    for (const [name] of SURFACES_SIN_GATE_DE_EMAIL) {
      expect(typeof DESENLACE_SIN_GATE[name]).toBe("function");
    }
  });

  it.each(SURFACES)(
    "%s: sin sesión → 401 `unauthorized`",
    async (_name, call) => {
      const response = await call();
      expect(response.status).toBe(401);
      expect((await response.json()).code).toBe("unauthorized");
    },
  );

  /**
   * EL ORDEN DE §D1, y es la mutación M3. El caller tiene el email SIN verificar **y** no es
   * owner: tiene que recibir `not_owner`, no `email_not_verified`. Puesto al revés, un
   * INTEGRANTE —cuyo email es sintético y no se verifica NUNCA— recibiría un código que le
   * pide hacer algo que no puede hacer, y un tercero podría sondear el estado de un negocio
   * ajeno. Ya lo cazó un test de la spec 0067 en `api/staff`; ahora vale para las 10.
   */
  it.each(SURFACES)(
    "%s: un INTEGRANTE (sin email verificado) → 403 `not_owner`, nunca `email_not_verified`",
    async (_name, call) => {
      world.session = { user: { id: "user-staff", emailVerified: false } };
      world.ownerRow = null;
      const response = await call();
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("not_owner");
    },
  );

  it.each(SURFACES_CON_GATE_DE_EMAIL)(
    "%s: owner con `emailVerified: false` → 403 `email_not_verified`",
    async (_name, call) => {
      world.session = { user: { id: "user-owner", emailVerified: false } };
      world.ownerRow = ownerRow("active");
      const response = await call();
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("email_not_verified");
    },
  );

  it.each(SURFACES_CON_GATE_DE_EMAIL)(
    "%s: owner SIN la clave `emailVerified` → 403 igual (fail-closed)",
    async (_name, call) => {
      world.session = { user: { id: "user-owner" } };
      world.ownerRow = ownerRow("active");
      const response = await call();
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("email_not_verified");
    },
  );

  /** LAS EXCEPCIONES, ASEVERADAS EN POSITIVO (spec 0075 §D3, spec 0079 §1): el desenlace
   * COMPLETO del camino feliz de cada una, no un `not.toBe(403)`. Ver `DESENLACE_SIN_GATE`. */
  it.each(SURFACES_SIN_GATE_DE_EMAIL)(
    "%s: owner con `emailVerified: false` sobre un negocio `active` → pasa, NUNCA `email_not_verified`",
    async (name, call) => {
      world.session = { user: { id: "user-owner", emailVerified: false } };
      world.ownerRow = ownerRow("active");
      await DESENLACE_SIN_GATE[name](await call());
    },
  );

  /** El doble del fail-closed: sin la clave `emailVerified` el paso 3 cierra en las otras 11
   * (test de arriba), y acá tampoco frena — porque el paso 3 no corre, no porque «pase». */
  it.each(SURFACES_SIN_GATE_DE_EMAIL)(
    "%s: owner SIN la clave `emailVerified` → pasa igual (el paso 3 no corre)",
    async (name, call) => {
      world.session = { user: { id: "user-owner" } };
      world.ownerRow = ownerRow("active");
      await DESENLACE_SIN_GATE[name](await call());
    },
  );

  it.each(SURFACES)(
    "%s: negocio `suspended` → 403 `business_suspended` CON el motivo",
    async (_name, call) => {
      world.session = { user: { id: "user-owner", emailVerified: true } };
      world.ownerRow = ownerRow("suspended", "Pago rechazado tres veces.");
      const response = await call();
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.code).toBe("business_suspended");
      // El motivo se serializa SOLO al owner (§D4) y es lo que la pantalla de suspensión
      // necesita mostrar: sin él, el owner ve un 403 mudo y no sabe a qué reclamar.
      expect(body.suspensionReason).toBe("Pago rechazado tres veces.");
    },
  );

  it.each(SURFACES)(
    "%s: negocio `closed` → 403 `business_closed` y SIN motivo",
    async (_name, call) => {
      world.session = { user: { id: "user-owner", emailVerified: true } };
      world.ownerRow = ownerRow(
        "closed",
        "Motivo viejo de una suspensión anterior.",
      );
      const response = await call();
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.code).toBe("business_closed");
      expect(body.suspensionReason).toBeUndefined();
    },
  );

  /** Fail-CLOSED sobre un estado que nadie enseñó al guard. El `CHECK` de la columna hoy
   * sólo admite tres valores; el día que admita un cuarto, no se pasa de largo. */
  it.each(SURFACES)(
    "%s: un `status` desconocido no opera",
    async (_name, call) => {
      world.session = { user: { id: "user-owner", emailVerified: true } };
      world.ownerRow = ownerRow("frozen");
      const response = await call();
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("business_suspended");
    },
  );
});
