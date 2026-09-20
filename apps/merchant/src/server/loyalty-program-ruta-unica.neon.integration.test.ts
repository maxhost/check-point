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
  loyaltyProgramEvents,
  loyaltyPrograms,
  loyaltyRewards,
  memberships,
  users,
} from "./schema";
import { openMerchantSession } from "./merchant-session";
import { wizardClauseTemplateIds } from "./onboarding/program-defaults";
import { PUT } from "../app/api/loyalty-program/route";

/**
 * Spec 0079 — LA RUTA ÚNICA DE ESCRITURA, contra la base.
 *
 * `POST /api/onboarding/program` se borró y `PUT /api/loyalty-program` absorbió su cuerpo
 * corto, sus `code` y su guard sin paso 3. Lo que ya existía sigue midiéndose donde estaba
 * (`onboarding-program.neon…` el cuerpo corto de Sellos, `onboarding-program-bypass.neon…`
 * el invariante crear ≠ editar); **acá va lo que la 0079 AGREGA**: la modalidad `points`,
 * el 422 del dinero que el servidor no inventa, la modalidad que no existe, el cuerpo
 * completo de hoy y el cambio de modalidad.
 *
 * Archivo aparte por el hook `file-size`: `onboarding-program.neon…` está en 291 líneas.
 */
describe.skipIf(!enabled)("la ruta única de escritura (spec 0079)", () => {
  const ownerId = `unica-${randomUUID()}`;
  const businessId = randomUUID();
  const businessName = "El Comercio de la Ruta Única";
  let cookie = "";
  let templateIds: string[] = [];

  const put = (body: unknown) =>
    PUT(
      new Request("http://localhost:3001/api/loyalty-program", {
        method: "PUT",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify(body),
      }),
    );

  const wipePrograms = async () => {
    const db = getDb();
    await db
      .delete(loyaltyProgramEvents)
      .where(eq(loyaltyProgramEvents.businessId, businessId));
    await db
      .delete(loyaltyRewards)
      .where(eq(loyaltyRewards.businessId, businessId));
    await db
      .delete(loyaltyPrograms)
      .where(eq(loyaltyPrograms.businessId, businessId));
  };

  const programRow = async () => {
    const [row] = await getDb()
      .select()
      .from(loyaltyPrograms)
      .where(eq(loyaltyPrograms.businessId, businessId))
      .limit(1);
    return row ?? null;
  };

  /** Los campos de Puntos que el servidor NO puede completar (spec 0079 §2). */
  const PUNTOS = {
    kind: "points",
    configuration: { unitSingular: "punto", unitPlural: "puntos" },
    accrual: { mode: "per_amount", grant: 10, blockAmount: 5 },
    rewards: [{ type: "custom", label: "Café gratis", pointsCost: 100 }],
  };

  beforeAll(async () => {
    const db = getDb();
    await db.insert(users).values({
      id: ownerId,
      name: "Owner Ruta Única",
      email: `${ownerId}@example.test`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(businesses).values({
      id: businessId,
      name: businessName,
      slug: `unica-${businessId.slice(0, 12)}`,
      categoryGcid: "gcid:pharmacy",
      countryCode: "EC",
      timezone: "America/Guayaquil",
    });
    await db
      .insert(memberships)
      .values({ businessId, userId: ownerId, role: "owner" });
    cookie = (await openMerchantSession(ownerId)).split(";")[0];
    templateIds = await wizardClauseTemplateIds("EC", "per_purchase");
  }, 60_000);

  afterAll(async () => {
    const db = getDb();
    await wipePrograms();
    await db.delete(memberships).where(eq(memberships.businessId, businessId));
    await db.delete(businesses).where(eq(businesses.id, businessId));
    await db.delete(users).where(eq(users.id, ownerId));
  }, 60_000);

  /**
   * **PUNTOS POR LA API, que es el §6 del ADR 0076**: la API no niega una modalidad que el
   * dominio soporta porque la pantalla todavía no exista. El oráculo es la FILA, no el
   * status: un 201 con `kind='stamps'` en la base sería un falso verde.
   */
  it("un cuerpo de Puntos crea el programa y la fila queda `kind='points'`", async () => {
    await wipePrograms();
    const response = await put(PUNTOS);
    expect(response.status).toBe(201);
    const { programId } = await response.json();

    const row = await programRow();
    expect(row?.id).toBe(programId);
    expect(row?.kind).toBe("points");
    expect(row?.configuration).toEqual({
      unitSingular: "punto",
      unitPlural: "puntos",
    });
    expect(row?.accrualMode).toBe("per_amount");
    expect(row?.accrualGrant).toBe(10);
    expect(row?.accrualBlockAmount).toBe("5.00");
    // Las cláusulas del país también se completan en Puntos: el TOS no es de Sellos.
    expect(row?.termsMarkdown).not.toContain("{{");

    const rewards = await getDb()
      .select()
      .from(loyaltyRewards)
      .where(eq(loyaltyRewards.programId, programId));
    expect(rewards).toHaveLength(1);
    expect(rewards[0].pointsCost).toBe(100);
    await wipePrograms();
  }, 120_000);

  /**
   * **EL 422 DEL DINERO (mutación M2).** `validateAccrual` fuerza `per_amount` para Puntos,
   * que exige un `blockAmount > 0`. «Un sello por compra» es la única lectura posible de la
   * pregunta del alta; «X puntos por cada $Y» no la tiene, y el servidor no la inventa.
   *
   * La segunda aserción es la que importa: **no se escribió nada**. Un default silencioso
   * daría 201 y dejaría al comercio con una mecánica que nadie eligió.
   */
  it("Puntos SIN `accrual` → 422 `invalid_program` y CERO filas", async () => {
    await wipePrograms();
    const sinAccrual: Record<string, unknown> = { ...PUNTOS };
    delete sinAccrual.accrual;
    const response = await put(sinAccrual);
    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("invalid_program");
    expect(await programRow()).toBeNull();
  }, 90_000);

  /**
   * **LA MODALIDAD QUE NO EXISTE (mutación M4).** El oráculo es **el mensaje** y no el
   * status: con `cashback` habilitado en `enabledKinds` este cuerpo seguiría dando 422 —le
   * falta el `accrual`— y un test que sólo mirara el número quedaría verde.
   */
  it("`cashback` → 422 con el mensaje de modalidad no disponible", async () => {
    await wipePrograms();
    const response = await put({ ...PUNTOS, kind: "cashback" });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe("invalid_program");
    expect(body.error).toBe("Esta modalidad todavía no está disponible.");
    expect(await programRow()).toBeNull();
  }, 90_000);

  /**
   * **EL CUERPO COMPLETO DE HOY SIGUE DANDO LO MISMO (mutación M3).** Trae todo puesto, así
   * que el compositor no tiene un solo hueco que rellenar: si pisara algo con su default
   * —el `accrual` `per_amount` volviéndose `per_purchase`, o el `unitName` propio pasando a
   * «sello»— se vería acá y en ningún otro lado.
   *
   * **Y CIERRA EL HUECO F1 DEL CONTRATO 0079 (spec 0081, mutación M6).** Hasta la 0080 este
   * caso mandaba `clauses` construidas con `wizardClauseTemplateIds("EC")`, o sea **las
   * semillas mismas**: sembrar encima era un **no-op observable** y ninguna aserción miraba
   * el resultado, así que «un `clauses` NO VACÍO del cuerpo sobrevive al compositor» no tenía
   * oráculo en todo el repo. La tercera cláusula es de **texto libre distinguible** y el
   * `termsMarkdown` se asevera contra ella: si el compositor sembrara SIEMPRE, ese párrafo
   * desaparecería del documento legal y este caso se pone rojo.
   */
  it("un cuerpo COMPLETO de hoy conserva cada campo que mandó, cláusulas incluidas", async () => {
    await wipePrograms();
    const MIA = "Cláusula propia del comercio, escrita a mano.";
    const completo = {
      kind: "stamps",
      configuration: { unitName: "visita", unitPlural: "visitas", target: 12 },
      clauses: [
        ...templateIds.map((templateId) => ({ templateId })),
        { text: MIA },
      ],
      accrual: { mode: "per_amount", grant: 3, blockAmount: 20 },
      rewards: [{ type: "custom", label: "Postre" }],
      stampAction: "keep",
      redeemAllowInsufficient: true,
    };
    expect((await put(completo)).status).toBe(201);
    const row = await programRow();
    expect(row?.configuration).toEqual({
      unitName: "visita",
      unitPlural: "visitas",
      target: 12,
    });
    expect(row?.accrualMode).toBe("per_amount");
    expect(row?.accrualGrant).toBe(3);
    expect(row?.accrualBlockAmount).toBe("20.00");
    expect(row?.redeemAllowInsufficient).toBe(true);
    // Las 3 cláusulas del cuerpo, en su orden, y la propia AL FINAL: las semillas no la
    // pisaron ni la reordenaron. `endsWith` es lo que hace que el oráculo vea la M6.
    expect(row?.termsMarkdown).toContain(MIA);
    expect(row?.termsMarkdown.endsWith(MIA)).toBe(true);
    expect(row?.termsMarkdown.split("\n\n")).toHaveLength(3);
    await wipePrograms();
  }, 120_000);

  /** El cambio de modalidad sigue siendo un 409 con `code`, ahora por la ruta única. */
  it('con Sellos activo, mandar `kind:"points"` → 409 `program_exists`', async () => {
    await wipePrograms();
    expect(
      (
        await put({
          kind: "stamps",
          configuration: { target: 8 },
          rewards: [{ type: "custom", label: "Café" }],
        })
      ).status,
    ).toBe(201);
    const response = await put(PUNTOS);
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.code).toBe("program_exists");
    expect(body.error).toBe(
      "Cierra el programa actual antes de cambiar su modalidad.",
    );
    // La fila NO se movió de modalidad.
    expect((await programRow())?.kind).toBe("stamps");
    await wipePrograms();
  }, 120_000);

  /**
   * **`business_suspended` por la ruta nueva.** Completa la tabla de `code` del §4 sobre la
   * única escritura.
   *
   * **Y ACLARA UNA COSA QUE LA SPEC DA POR SENTADA Y NO ES CIERTA DESPUÉS DE LA 0079:** este
   * caso NO es el oráculo del `error.code ??` de la ruta. El eje `status` lo corta el PASO 4
   * del guard (`requireApiOwnerSinGateDeEmail` → `apiOwnerFailureResponse`), que emite su
   * `code` sin pasar por `codeForStatus`; el chequeo gemelo de `saveProgram` ya no se
   * alcanza por HTTP. El único 403 que sí viaja como `LoyaltyError` con `code` propio es el
   * `email_not_verified` del writer, y su oráculo vive en
   * `onboarding-program-bypass.neon.integration.test.ts`.
   */
  it("negocio `suspended` → 403 `business_suspended`, no `not_owner`", async () => {
    await wipePrograms();
    const setStatus = (status: string) =>
      getDb()
        .update(businesses)
        .set({ status })
        .where(eq(businesses.id, businessId));
    await setStatus("suspended");
    try {
      const response = await put({
        kind: "stamps",
        configuration: { target: 8 },
        rewards: [{ type: "custom", label: "Café" }],
      });
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("business_suspended");
      expect(await programRow()).toBeNull();
    } finally {
      await setStatus("active");
    }
  }, 120_000);
});
