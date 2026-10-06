import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Spec 0072 §D3/§D4 — EL GATE DE LAS SUPERFICIES DE API DEL OWNER, las 15, en una matriz.
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
 *
 * **LA TABLA, EL MUNDO Y LOS DOBLES VIVEN EN `api-owner-surfaces-support.ts`** (spec 0079 y
 * spec 0085), por el hook `file-size`: acá quedan los ORÁCULOS, que es lo único que este
 * archivo tiene que dejar ver de un vistazo. Cada fábrica de `vi.mock` llama a su doble
 * **dentro de una función** y nunca al construir el objeto: las fábricas corren mientras el
 * módulo de soporte todavía se evalúa (él importa las rutas), y una lectura eager sería un TDZ.
 *
 * **Spec 0075 — el email es el único de los cuatro pasos que no se aplica parejo**, y la tabla
 * se parte para ASEVERAR las excepciones en vez de perderlas de vista. `SURFACES` sigue entera
 * (15) para los otros cinco casos. Las dos tablas salen de `SURFACES` por filtro —no son listas
 * paralelas—, así que mover una fila cambia los pisos.
 */
import {
  SURFACES,
  SURFACES_CON_GATE_DE_EMAIL,
  SURFACES_SIN_GATE_DE_EMAIL,
  SURFACES_SOLO_OWNER,
  dobleDeGetDb,
  dobleDeMembershipContext,
  dobleDeOwnerContext,
  dobleDeProgramForOwner,
  dobleDeSaveProgram,
  dobleDeSesion,
  filaDeOwner,
  world,
} from "./api-owner-surfaces-support";
import { DESENLACE_SIN_GATE } from "./api-owner-surfaces-desenlaces";

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({ api: { getSession: () => dobleDeSesion() } }),
}));

vi.mock("./staff", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./staff")>()),
  ownerContext: () => dobleDeOwnerContext(),
  // Spec 0086: el resolvedor de las once entradas DELEGABLES. Los dos se doblan porque la
  // tabla mezcla las dos escaleras a propósito — es lo que hace visible cuál es cuál.
  membershipContext: () => dobleDeMembershipContext(),
}));

vi.mock(
  "@mi-pasaporte/domain/server/loyalty-program",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@mi-pasaporte/domain/server/loyalty-program")
    >()),
    programForOwner: () => dobleDeProgramForOwner(),
    saveProgram: () => dobleDeSaveProgram(),
  }),
);

vi.mock("@mi-pasaporte/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mi-pasaporte/db")>()),
  getDb: () => dobleDeGetDb(),
}));

beforeEach(() => {
  world.session = null;
  world.ownerRow = null;
  world.membershipRow = null;
});

describe("las superficies de API del owner — el gate unificado (spec 0072 §D3)", () => {
  it("son 15 entradas HTTP y ninguna se cayó de la tabla", () => {
    // Piso del barrido: sin esto, una tabla que quedara vacía dejaría cada `it.each` de
    // abajo sin correr NI UNA vez y el archivo entero pasaría en verde sin medir nada.
    expect(SURFACES.length).toBe(15);
  });

  /**
   * **EL CONJUNTO EXACTO, criterio del DoD** — no «al menos una». El valor del oráculo es que
   * sea CERRADO: con un `toContain` o un `length >= 1`, otra ruta que se sacara el gate de email
   * entraría sin que nadie lo vea. La 0075 exigía UNA, la 0079 DOS, la 0083 TRES, la 0156 C
   * (ADR 0122) SEIS y la 0165 (ADR 0125) SIETE, **cada vez a propósito y con el motivo escrito
   * en `api-owner-surfaces-support.ts`**.
   */
  it("las rutas SIN gate de email son EXACTAMENTE siete: el catálogo, las cinco del programa y el checklist", () => {
    expect(SURFACES_SIN_GATE_DE_EMAIL.map(([name]) => name)).toEqual([
      "catalog",
      "loyalty-program",
      "loyalty-program (PUT)",
      "loyalty-program/stamp-upload",
      "loyalty-program/qr",
      "loyalty-terms/templates",
      "onboarding/checklist",
    ]);
  });

  it("las dos tablas del email parten las 15 sin perder ni duplicar ninguna", () => {
    // Spec 0075 §D3. Sin estos pisos, mover una fila de una tabla a la otra —o vaciar la de
    // las excepciones— dejaría su `it.each` sin correr NI UNA vez, en verde.
    expect(SURFACES_CON_GATE_DE_EMAIL.length).toBe(8);
    expect(SURFACES_SIN_GATE_DE_EMAIL.length).toBe(7);
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
  /** Las CUATRO de la CUENTA (ADR 0079 §8) conservan `requireApiOwner` y su `not_owner`,
   * que ahí sigue siendo literal. El reparto completo y la escalera de PERMISOS de las once
   * delegables viven en `api-permission-surfaces.test.ts`, que comparte este mismo soporte. */
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

  it.each(SURFACES_CON_GATE_DE_EMAIL)(
    "%s: owner con `emailVerified: false` → 403 `email_not_verified`",
    async (_name, call) => {
      world.session = { user: { id: "user-owner", emailVerified: false } };
      world.ownerRow = filaDeOwner("active");
      const response = await call();
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("email_not_verified");
    },
  );

  it.each(SURFACES_CON_GATE_DE_EMAIL)(
    "%s: owner SIN la clave `emailVerified` → 403 igual (fail-closed)",
    async (_name, call) => {
      world.session = { user: { id: "user-owner" } };
      world.ownerRow = filaDeOwner("active");
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
      world.ownerRow = filaDeOwner("active");
      await DESENLACE_SIN_GATE[name](await call());
    },
  );

  /** El doble del fail-closed: sin la clave `emailVerified` el paso 3 cierra en las otras 8
   * (test de arriba), y acá tampoco frena — porque el paso 3 no corre, no porque «pase». */
  it.each(SURFACES_SIN_GATE_DE_EMAIL)(
    "%s: owner SIN la clave `emailVerified` → pasa igual (el paso 3 no corre)",
    async (name, call) => {
      world.session = { user: { id: "user-owner" } };
      world.ownerRow = filaDeOwner("active");
      await DESENLACE_SIN_GATE[name](await call());
    },
  );

  it.each(SURFACES)(
    "%s: negocio `suspended` → 403 `business_suspended` CON el motivo",
    async (_name, call) => {
      world.session = { user: { id: "user-owner", emailVerified: true } };
      world.ownerRow = filaDeOwner("suspended", "Pago rechazado tres veces.");
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
      world.ownerRow = filaDeOwner(
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
      world.ownerRow = filaDeOwner("frozen");
      const response = await call();
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("business_suspended");
    },
  );
});
