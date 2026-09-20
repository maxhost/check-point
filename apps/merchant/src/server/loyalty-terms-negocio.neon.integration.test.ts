import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
if (enabled) process.env.DATABASE_URL = url;

import { getDb } from "./db";
import {
  businesses,
  locations,
  loyaltyProgramEvents,
  loyaltyPrograms,
  loyaltyRewards,
  memberships,
  termsTemplates,
  users,
} from "./schema";
import { openMerchantSession } from "./merchant-session";
import type { ProgramInput } from "./loyalty-program/core";
import { renderedTerms } from "./loyalty-program/terms";
import { PUT } from "../app/api/loyalty-program/route";

/**
 * Spec 0081 — EL TOS NOMBRA AL NEGOCIO, contra la base.
 *
 * Lo que sólo se puede medir con base de verdad (el resto vive en
 * `loyalty-program/terms-variables.test.ts`, que es puro):
 *
 *  - **los locales salen de `core.location` filtrados por `status='active'`** — un local
 *    `archived` no puede aparecer en un documento legal;
 *  - **«un sello cada $X» end-to-end por la ruta única**: la fila guarda la mecánica y el
 *    `terms_markdown` nombra el monto y la moneda;
 *  - **el caso trampa**: un negocio SIN locales `active` guarda su programa igual.
 *
 * El scope `ZL` es de PRUEBA: se siembra y se borra acá, y es la única plantilla del repo que
 * nombra las variables de local (las semillas del wizard **no** las usan a propósito, porque
 * un valor vacío es un 422 y eso impediría guardar).
 */
const ZL_LOCALES = "0081cc00-0000-4000-8000-0000000000aa";

describe.skipIf(!enabled)("el TOS y el negocio de verdad (spec 0081)", () => {
  // Negocio CON locales: dos `active` y uno `archived`.
  const ownerId = `tos-neg-${randomUUID()}`;
  const businessId = randomUUID();
  // Negocio SIN locales: el caso trampa.
  const soloOwnerId = `tos-solo-${randomUUID()}`;
  const soloBusinessId = randomUUID();
  let soloCookie = "";

  const conLocales = {
    id: businessId,
    name: "Bodega Las Peñas",
    countryCode: "EC",
    currencyCode: "USD",
  };

  const seedOwner = async (userId: string, id: string, name: string) => {
    const db = getDb();
    await db.insert(users).values({
      id: userId,
      name: `Owner ${name}`,
      email: `${userId}@example.test`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(businesses).values({
      id,
      name,
      slug: `tos-${id.slice(0, 12)}`,
      categoryGcid: "gcid:store",
      countryCode: "EC",
      timezone: "America/Guayaquil",
    });
    await db
      .insert(memberships)
      .values({ businessId: id, userId, role: "owner" });
  };

  const seedLocation = async (
    name: string,
    addressLabel: string,
    status: string,
    createdAt: Date,
  ) =>
    await getDb().insert(locations).values({
      businessId,
      name,
      addressLabel,
      countryCode: "EC",
      status,
      addressSnapshot: {},
      createdAt,
    });

  const wipeBusiness = async (id: string, userId: string) => {
    const db = getDb();
    await db
      .delete(loyaltyProgramEvents)
      .where(eq(loyaltyProgramEvents.businessId, id));
    await db.delete(loyaltyRewards).where(eq(loyaltyRewards.businessId, id));
    await db.delete(loyaltyPrograms).where(eq(loyaltyPrograms.businessId, id));
    await db.delete(locations).where(eq(locations.businessId, id));
    await db.delete(memberships).where(eq(memberships.businessId, id));
    await db.delete(businesses).where(eq(businesses.id, id));
    await db.delete(users).where(eq(users.id, userId));
  };

  const stampsInput = (
    accrual: ProgramInput["accrual"],
    clauses: ProgramInput["clauses"],
  ): ProgramInput => ({
    kind: "stamps",
    configuration: { unitName: "sello", unitPlural: "sellos", target: 6 },
    clauses,
    stampAction: "keep",
    stampCropped: false,
    cardDesign: null,
    accrual,
    rewards: [],
    redeemAllowInsufficient: false,
  });

  const put = (cookie: string, body: unknown) =>
    PUT(
      new Request("http://localhost:3001/api/loyalty-program", {
        method: "PUT",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify(body),
      }),
    );

  const programRow = async (id: string) => {
    const [row] = await getDb()
      .select()
      .from(loyaltyPrograms)
      .where(eq(loyaltyPrograms.businessId, id))
      .limit(1);
    return row ?? null;
  };

  beforeAll(async () => {
    await seedOwner(ownerId, businessId, "Bodega Las Peñas");
    await seedOwner(soloOwnerId, soloBusinessId, "Kiosco Sin Sucursales");
    soloCookie = (await openMerchantSession(soloOwnerId)).split(";")[0];
    const t0 = new Date("2026-01-01T00:00:00Z");
    await seedLocation("Sucursal Centro", "Av. 9 de Octubre 123", "active", t0);
    await seedLocation(
      "Sucursal Norte",
      "Av. Orellana 45",
      "active",
      new Date(t0.getTime() + 60_000),
    );
    await seedLocation(
      "Sucursal Cerrada",
      "Calle Vieja 1",
      "archived",
      new Date(t0.getTime() + 120_000),
    );
    await getDb()
      .insert(termsTemplates)
      .values({
        id: ZL_LOCALES,
        key: "control-0081",
        jurisdictionScope: "ZL",
        locale: "es",
        category: "acumulacion",
        title: "Control de locales",
        templateMarkdown:
          "Locales: {{business_locations}}. Direcciones: {{business_address}}.",
        variablesAllowlist: ["business_locations", "business_address"],
        version: "1",
        status: "published",
        publishedAt: new Date(),
      });
  }, 120_000);

  afterAll(async () => {
    await wipeBusiness(businessId, ownerId);
    await wipeBusiness(soloBusinessId, soloOwnerId);
    await getDb()
      .delete(termsTemplates)
      .where(eq(termsTemplates.jurisdictionScope, "ZL"));
  }, 120_000);

  /**
   * **UN LOCAL `archived` NO APARECE EN EL TEXTO LEGAL (mutación M2).** El oráculo tiene las
   * dos mitades: los dos `active` SÍ están (control positivo, si no el `not.toContain`
   * pasaría también con una consulta que no devuelve nada) y el `archived` NO.
   */
  it("lista los locales `active` separados por `, ` y excluye el `archived`", async () => {
    const { markdown } = await renderedTerms(
      stampsInput({ mode: "per_purchase", grant: 1, blockAmount: null }, [
        { templateId: ZL_LOCALES },
      ]),
      conLocales,
    );
    expect(markdown).toBe(
      "Locales: Sucursal Centro, Sucursal Norte. " +
        "Direcciones: Av. 9 de Octubre 123, Av. Orellana 45.",
    );
    expect(markdown).not.toContain("Sucursal Cerrada");
    expect(markdown).not.toContain("Calle Vieja 1");
  }, 90_000);

  /**
   * **EL CASO TRAMPA DE LA SPEC: un negocio SIN locales `active` guarda igual.** Con las
   * variables de local emitidas vacías esto sería un 422 y el comercio no podría crear su
   * programa; con las variables ausentes también lo sería si alguna plantilla del wizard las
   * nombrara. La segunda mitad —que ninguna las nombre— la asevera
   * `loyalty-terms-semillas.neon.integration.test.ts`.
   */
  it("un negocio SIN locales `active` crea su programa: 201, y el TOS sale entero", async () => {
    expect(
      await getDb()
        .select({ id: locations.id })
        .from(locations)
        .where(eq(locations.businessId, soloBusinessId)),
    ).toHaveLength(0);
    const response = await put(soloCookie, {
      kind: "stamps",
      configuration: { target: 6 },
      rewards: [{ type: "custom", label: "Empanada" }],
    });
    expect(response.status).toBe(201);
    const row = await programRow(soloBusinessId);
    expect(row?.termsMarkdown).not.toContain("{{");
    expect(row?.termsMarkdown).toContain("Kiosco Sin Sucursales");
  }, 120_000);

  /**
   * **«UN SELLO CADA $X» END-TO-END (mutación M3 y M5).** Tres oráculos en uno, y hacen
   * falta los tres: el status, la FILA (el dinero quedó guardado) y el TEXTO LEGAL (el TOS
   * eligió `earning_per_amount` y nombró el monto y la moneda). Sin el tercero, la mutación
   * que ignora el `accrual.mode` al elegir la cláusula quedaría verde.
   */
  it("`per_amount` guarda la mecánica y el TOS nombra el monto y la moneda", async () => {
    const response = await put(soloCookie, {
      kind: "stamps",
      configuration: { target: 10 },
      rewards: [{ type: "custom", label: "Café gratis" }],
      accrual: { mode: "per_amount", grant: 1, blockAmount: "5.00" },
    });
    expect(response.status).toBe(200);
    const row = await programRow(soloBusinessId);
    expect(row?.accrualMode).toBe("per_amount");
    expect(row?.accrualGrant).toBe(1);
    expect(row?.accrualBlockAmount).toBe("5.00");
    expect(row?.termsMarkdown).toContain(
      "Se otorgan 1 sellos por cada 5.00 USD",
    );
    expect(row?.termsMarkdown).not.toContain("{{");
  }, 120_000);

  /**
   * **OMITIR `accrual` SIGUE DANDO «UN SELLO POR COMPRA», y su TOS es el de hoy.** Es la
   * compatibilidad hacia atrás de la 0079: la pantalla puede no preguntar nada y nada se
   * rompe. El `not.toContain` del monto es lo que prueba que la cláusula que se eligió es la
   * de siempre y no la nueva.
   */
  it("omitir `accrual` deja `per_purchase` y un TOS sin monto", async () => {
    const response = await put(soloCookie, {
      kind: "stamps",
      configuration: { target: 6 },
      rewards: [{ type: "custom", label: "Empanada" }],
    });
    expect(response.status).toBe(200);
    const row = await programRow(soloBusinessId);
    expect(row?.accrualMode).toBe("per_purchase");
    expect(row?.accrualBlockAmount).toBeNull();
    expect(row?.termsMarkdown).toContain("Los sellos se acumulan");
    expect(row?.termsMarkdown).not.toContain("Se otorgan");
    expect(row?.termsMarkdown).not.toContain("USD");
  }, 120_000);
});
