import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { eq, inArray, sql } from "drizzle-orm";
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
  loyaltyProgramEvents,
  loyaltyPrograms,
  loyaltyRewards,
  memberships,
  termsTemplates,
  users,
} from "./schema";
import { openMerchantSession } from "./merchant-session";
import {
  wizardClauseTemplateIds,
  wizardProgramInput,
} from "./onboarding/program-defaults";
import { POST } from "../app/api/onboarding/program/route";

/**
 * Spec 0078 (ADR 0076 §7) — EL TOS SALE DEL PAIS DEL NEGOCIO, contra la base.
 *
 * Lo que sólo se puede medir con base de verdad: que las semillas de la `0038` estén, que
 * la selección traiga las del scope correcto **por id** (no por texto, que se parece entre
 * scopes) y que el markdown que termina en `loyalty_program.terms_markdown` diga «Los
 * sellos» y nombre al país.
 *
 * El scope `ZZ` es un scope de PRUEBA que se siembra y se borra acá: monta el caso «al
 * scope del país le falta una clave» sin tocar las semillas compartidas (`default` las lee
 * cualquier otro archivo de test que corra en paralelo).
 *
 * Lo que renderiza sin pasar por el wizard —el control del 422, `global-draft` y el texto
 * libre— vive en `loyalty-terms-render.neon.integration.test.ts`.
 */
const EC_EARNING = "0078ec00-0000-4000-8000-000000000001";
const EC_REDEMPTION = "0078ec00-0000-4000-8000-000000000002";
const DEFAULT_EARNING = "0078a1b2-0000-4000-8000-000000000001";
const DEFAULT_REDEMPTION = "0078a1b2-0000-4000-8000-000000000002";
const ZZ_EARNING = "0078cc00-0000-4000-8000-000000000001";
const ZZ_REDEMPTION = "0078cc00-0000-4000-8000-000000000002";

const MIGRATION = fileURLToPath(
  new URL("../../drizzle/0038_terms_por_pais.sql", import.meta.url),
);

describe.skipIf(!enabled)("el TOS por país contra Neon (spec 0078)", () => {
  const ownerId = `onb-terms-${randomUUID()}`;
  const businessId = randomUUID();
  const businessName = "Bodega Las Peñas";
  // El segundo negocio es MX: es el que prueba que el país NO puede venir del cuerpo.
  const mxOwnerId = `onb-terms-mx-${randomUUID()}`;
  const mxBusinessId = randomUUID();
  let cookie = "";

  const seedOwner = async (
    userId: string,
    id: string,
    name: string,
    countryCode: string,
    timezone: string,
  ) => {
    const db = getDb();
    await db.insert(users).values({
      id: userId,
      name: `Owner ${countryCode}`,
      email: `${userId}@example.test`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(businesses).values({
      id,
      name,
      slug: `terms-${id.slice(0, 12)}`,
      categoryGcid: "gcid:store",
      countryCode,
      timezone,
    });
    await db
      .insert(memberships)
      .values({ businessId: id, userId, role: "owner" });
  };

  const wipeBusiness = async (id: string, userId: string) => {
    const db = getDb();
    await db
      .delete(loyaltyProgramEvents)
      .where(eq(loyaltyProgramEvents.businessId, id));
    await db.delete(loyaltyRewards).where(eq(loyaltyRewards.businessId, id));
    await db.delete(loyaltyPrograms).where(eq(loyaltyPrograms.businessId, id));
    await db.delete(memberships).where(eq(memberships.businessId, id));
    await db.delete(businesses).where(eq(businesses.id, id));
    await db.delete(users).where(eq(users.id, userId));
  };

  beforeAll(async () => {
    const db = getDb();
    await seedOwner(
      ownerId,
      businessId,
      businessName,
      "EC",
      "America/Guayaquil",
    );
    await seedOwner(
      mxOwnerId,
      mxBusinessId,
      "Taquería del Wizard",
      "MX",
      "America/Mexico_City",
    );
    cookie = (await openMerchantSession(ownerId)).split(";")[0];
    // El scope de prueba nace INCOMPLETO (sólo `earning`): es el caso de no-mezcla.
    await db.insert(termsTemplates).values({
      id: ZZ_EARNING,
      key: "earning",
      jurisdictionScope: "ZZ",
      locale: "es",
      category: "acumulacion",
      title: "ZZ acumulación",
      templateMarkdown: "ZZ acumula {{program_unit_plural}}.",
      variablesAllowlist: ["program_unit_plural"],
      version: "1",
      status: "published",
      publishedAt: new Date(),
    });
  }, 120_000);

  afterAll(async () => {
    await wipeBusiness(businessId, ownerId);
    await wipeBusiness(mxBusinessId, mxOwnerId);
    await getDb()
      .delete(termsTemplates)
      .where(eq(termsTemplates.jurisdictionScope, "ZZ"));
  }, 120_000);

  it("la migración 0038 dejó 4 semillas publicadas con `country_code` en el allowlist", async () => {
    const rows = await getDb()
      .select()
      .from(termsTemplates)
      .where(inArray(termsTemplates.jurisdictionScope, ["default", "EC"]));
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.status).toBe("published");
      expect(row.locale).toBe("es");
      expect(row.variablesAllowlist).toEqual(
        expect.arrayContaining([
          "business_legal_name",
          "program_name",
          "program_unit_plural",
          "country_code",
        ]),
      );
    }
  }, 60_000);

  it("la migración es IDEMPOTENTE: correr su SQL otra vez deja 4 filas, no 8", async () => {
    await getDb().execute(sql.raw(readFileSync(MIGRATION, "utf8")));
    const rows = await getDb()
      .select({ id: termsTemplates.id })
      .from(termsTemplates)
      .where(inArray(termsTemplates.jurisdictionScope, ["default", "EC"]));
    expect(rows).toHaveLength(4);
  }, 60_000);

  it("un negocio EC resuelve los templates de EC, y uno de MX cae a `default`", async () => {
    expect(await wizardClauseTemplateIds("EC")).toEqual([
      EC_EARNING,
      EC_REDEMPTION,
    ]);
    expect(await wizardClauseTemplateIds("MX")).toEqual([
      DEFAULT_EARNING,
      DEFAULT_REDEMPTION,
    ]);
    expect(await wizardClauseTemplateIds(null)).toEqual([
      DEFAULT_EARNING,
      DEFAULT_REDEMPTION,
    ]);
  }, 60_000);

  it("scope del país A MEDIAS → las DOS de `default`; completo → las DOS de él", async () => {
    // `ZZ` tiene `earning` y le falta `redemption`: ni una de las dos puede salir de ZZ.
    expect(await wizardClauseTemplateIds("ZZ")).toEqual([
      DEFAULT_EARNING,
      DEFAULT_REDEMPTION,
    ]);
    // CONTROL POSITIVO: completado el scope, gana sobre `default`. Sin esto, el caso de
    // arriba también pasaría con una selección que ignore `ZZ` por completo.
    await getDb()
      .insert(termsTemplates)
      .values({
        id: ZZ_REDEMPTION,
        key: "redemption",
        jurisdictionScope: "ZZ",
        locale: "es",
        category: "canje",
        title: "ZZ canje",
        templateMarkdown: "ZZ canjea {{program_unit_plural}}.",
        variablesAllowlist: ["program_unit_plural"],
        version: "1",
        status: "published",
        publishedAt: new Date(),
      });
    expect(await wizardClauseTemplateIds("ZZ")).toEqual([
      ZZ_EARNING,
      ZZ_REDEMPTION,
    ]);
    await getDb()
      .delete(termsTemplates)
      .where(eq(termsTemplates.id, ZZ_REDEMPTION));
  }, 90_000);

  it("el programa del wizard queda con «Los sellos» y con el país nombrado", async () => {
    const response = await POST(
      new Request("http://localhost:3001/api/onboarding/program", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          target: 6,
          reward: { type: "custom", label: "Empanada" },
        }),
      }),
    );
    expect(response.status).toBe(201);
    const { programId } = await response.json();
    const [program] = await getDb()
      .select()
      .from(loyaltyPrograms)
      .where(eq(loyaltyPrograms.id, programId));
    // El defecto medido del ADR 0076 §7: antes decía «Los sello se acumulan…».
    expect(program.termsMarkdown).toContain("Los sellos se acumulan");
    expect(program.termsMarkdown).not.toContain("Los sello ");
    // `{{country_code}}` RENDERIZA: hasta la 0078 no estaba en ningún allowlist.
    expect(program.termsMarkdown).toContain("vigente en EC");
    expect(program.termsMarkdown).not.toContain("{{");
    expect(program.termsMarkdown).toContain(businessName);
  }, 120_000);
  /**
   * HALLAZGO 2 DEL REVISOR — «el país no puede venir del cuerpo» era una CONVENCIÓN sin
   * oráculo: con `raw.countryCode` ganando sobre la sesión los 65 tests quedaban VERDES y
   * un negocio MX se llevaba el TOS de EC. Se asevera **por `templateId`** en el punto
   * exacto donde el cuerpo y la sesión se encuentran, y además end-to-end por la ruta.
   */
  it("el `countryCode` del CUERPO no mueve el scope: un negocio MX se queda en `default`", async () => {
    const body = {
      target: 4,
      reward: { type: "custom", label: "Taco" },
      // Las tres ortografías con las que un cliente intentaría forzarlo.
      countryCode: "EC",
      country_code: "EC",
      business: { countryCode: "EC" },
    };
    const input = await wizardProgramInput(body, mxOwnerId);
    expect(input.clauses).toEqual([
      { templateId: DEFAULT_EARNING },
      { templateId: DEFAULT_REDEMPTION },
    ]);

    const mxCookie = (await openMerchantSession(mxOwnerId)).split(";")[0];
    const response = await POST(
      new Request("http://localhost:3001/api/onboarding/program", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: mxCookie },
        body: JSON.stringify(body),
      }),
    );
    expect(response.status).toBe(201);
    const { programId } = await response.json();
    const [program] = await getDb()
      .select()
      .from(loyaltyPrograms)
      .where(eq(loyaltyPrograms.id, programId));
    // «vigente en EC» sólo existe en las semillas de EC: si aparece, el cuerpo ganó.
    expect(program.termsMarkdown).not.toContain("vigente en EC");
    expect(program.termsMarkdown).toContain("Los sellos se acumulan");
  }, 120_000);
});
