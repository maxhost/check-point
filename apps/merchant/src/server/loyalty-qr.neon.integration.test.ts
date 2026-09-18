import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
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
import { programForOwner, saveProgram } from "./loyalty-program";
import { openMerchantSession } from "./merchant-session";
import { GET } from "../app/api/loyalty-program/qr/route";

/**
 * Spec 0069 §D6 — `GET /api/loyalty-program/qr` CONTRA LA BASE.
 *
 * **ORÁCULO DE LA MUTACIÓN #5**: el `programId` sale de la SESIÓN, nunca del query. El
 * caso decisivo es el owner del negocio A pidiendo el QR con `?programId=<el de B>`: el
 * SVG que vuelve tiene que codificar el programa de A. Si la ruta leyera el query,
 * cualquier owner podría fabricar y repartir el código de enrolamiento ajeno.
 */
const PNG_MAGIC = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

describe.skipIf(!enabled)(
  "el QR del programa contra Neon (spec 0069 §D6)",
  () => {
    const ownerA = `qr-a-${randomUUID()}`;
    const ownerB = `qr-b-${randomUUID()}`;
    const ownerSinPrograma = `qr-c-${randomUUID()}`;
    /** Spec 0075: el owner del wizard, con `email_verified` como NACE la cuenta: `false`. */
    const ownerSinVerificar = `qr-d-${randomUUID()}`;
    const businessA = randomUUID();
    const businessB = randomUUID();
    const businessC = randomUUID();
    const businessD = randomUUID();
    const slugA = `qrtest-a-${businessA.slice(0, 10)}`;
    let programA = "";
    let programB = "";
    let programD = "";
    let cookieA = "";
    let cookieC = "";
    let cookieD = "";

    const get = (cookie: string | null, query = "") =>
      GET(
        new Request(`http://localhost:3001/api/loyalty-program/qr${query}`, {
          headers: cookie ? { cookie } : {},
        }),
      );

    const seed = async (
      userId: string,
      businessId: string,
      name: string,
      slug: string,
      emailVerified = true,
    ) => {
      const db = getDb();
      await db.insert(users).values({
        id: userId,
        name,
        email: `${userId}@example.test`,
        emailVerified,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await db.insert(businesses).values({
        id: businessId,
        name,
        slug,
        categoryGcid: "gcid:bakery",
        countryCode: "EC",
        timezone: "America/Guayaquil",
      });
      await db
        .insert(memberships)
        .values({ businessId, userId, role: "owner" });
    };

    const createProgram = async (userId: string) => {
      await saveProgram(userId, {
        kind: "stamps",
        configuration: { unitName: "sello", target: 8 },
        clauses: [{ text: "Términos." }],
        accrual: { mode: "per_purchase", grant: 1, blockAmount: null },
        rewards: [{ type: "custom", label: "Pan gratis" }],
      });
      return (await programForOwner(userId))!.program!.id;
    };

    beforeAll(async () => {
      await seed(ownerA, businessA, "Panadería A", slugA);
      await seed(
        ownerB,
        businessB,
        "Panadería B",
        `qrtest-b-${businessB.slice(0, 10)}`,
      );
      await seed(
        ownerSinPrograma,
        businessC,
        "Panadería C",
        `qrtest-c-${businessC.slice(0, 10)}`,
      );
      await seed(
        ownerSinVerificar,
        businessD,
        "Panadería D",
        `qrtest-d-${businessD.slice(0, 10)}`,
        false,
      );
      programA = await createProgram(ownerA);
      programB = await createProgram(ownerB);
      programD = await createProgram(ownerSinVerificar);
      cookieA = (await openMerchantSession(ownerA)).split(";")[0];
      cookieC = (await openMerchantSession(ownerSinPrograma)).split(";")[0];
      cookieD = (await openMerchantSession(ownerSinVerificar)).split(";")[0];
    }, 60_000);

    afterAll(async () => {
      const db = getDb();
      const ids = [businessA, businessB, businessC, businessD];
      await db
        .delete(loyaltyProgramEvents)
        .where(inArray(loyaltyProgramEvents.businessId, ids));
      await db
        .delete(loyaltyRewards)
        .where(inArray(loyaltyRewards.businessId, ids));
      await db
        .delete(loyaltyPrograms)
        .where(inArray(loyaltyPrograms.businessId, ids));
      await db.delete(memberships).where(inArray(memberships.businessId, ids));
      await db.delete(businesses).where(inArray(businesses.id, ids));
      await db
        .delete(users)
        .where(
          inArray(users.id, [
            ownerA,
            ownerB,
            ownerSinPrograma,
            ownerSinVerificar,
          ]),
        );
    }, 60_000);

    it("sin sesión responde 401 unauthorized", async () => {
      const response = await get(null);
      expect(response.status).toBe(401);
      expect((await response.json()).code).toBe("unauthorized");
    }, 30_000);

    it("con sesión y sin programa responde 404 no_program", async () => {
      const response = await get(cookieC);
      expect(response.status).toBe(404);
      expect((await response.json()).code).toBe("no_program");
    }, 30_000);

    it("por defecto devuelve image/svg+xml y NO adjunta", async () => {
      const response = await get(cookieA);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/svg+xml");
      expect(response.headers.get("content-disposition")).toBeNull();
      const svg = await response.text();
      expect(svg.startsWith("<?xml") || svg.startsWith("<svg")).toBe(true);
      expect(svg).toContain("<svg");
    }, 30_000);

    it("?format=png devuelve un PNG de 1024×1024", async () => {
      const response = await get(cookieA, "?format=png");
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/png");
      const bytes = Buffer.from(await response.arrayBuffer());
      expect(bytes.subarray(0, 8)).toEqual(PNG_MAGIC);
      const sharp = (await import("sharp")).default;
      const metadata = await sharp(bytes).metadata();
      expect(metadata.width).toBe(1024);
      expect(metadata.height).toBe(1024);
    }, 60_000);

    it("?download=1 adjunta con el slug del negocio y la extensión correcta", async () => {
      const svg = await get(cookieA, "?download=1");
      expect(svg.headers.get("content-disposition")).toBe(
        `attachment; filename="qr-${slugA}.svg"`,
      );
      const png = await get(cookieA, "?format=png&download=1");
      expect(png.headers.get("content-disposition")).toBe(
        `attachment; filename="qr-${slugA}.png"`,
      );
    }, 60_000);

    it("el QR codifica la URL de enrolamiento de SU programa", async () => {
      const svg = await (await get(cookieA)).text();
      expect(await decodeQr(svg)).toBe(
        `http://localhost:3001/enroll/${programA}`,
      );
    }, 60_000);

    /**
     * SPEC 0075 — **el QR no lleva el gate de email, y este es su oráculo contra la base.**
     *
     * La pantalla del QR es la CUARTA del wizard (ADR 0070 §1) y la verificación bloquea
     * «todo lo que venga DESPUÉS del wizard» (§11). Una cuenta recién creada llega acá con
     * `email_verified: false` **por construcción**, así que con el paso 3 puesto la ruta
     * devolvía 403 `email_not_verified` y el alta terminaba en una pantalla inalcanzable.
     *
     * Es el oráculo de la mutación M1: volver a poner `requireApiOwner` pone esto en rojo.
     */
    it("el owner con el email SIN verificar descarga su QR igual (200 svg)", async () => {
      const [fila] = await getDb()
        .select({ emailVerified: users.emailVerified })
        .from(users)
        .where(eq(users.id, ownerSinVerificar));
      // Sin esta lectura el caso sería VACUO: un seed que dejara `email_verified: true`
      // pasaría en verde sin ejercitar una sola línea de lo que la 0075 cambia.
      expect(fila?.emailVerified).toBe(false);

      const response = await get(cookieD);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/svg+xml");
      const svg = await response.text();
      expect(svg).not.toContain("email_not_verified");
      expect(await decodeQr(svg)).toBe(
        `http://localhost:3001/enroll/${programD}`,
      );
    }, 60_000);

    it("...y en PNG también, sin verificar el email", async () => {
      const response = await get(cookieD, "?format=png");
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/png");
      const bytes = Buffer.from(await response.arrayBuffer());
      expect(bytes.subarray(0, 8)).toEqual(PNG_MAGIC);
    }, 60_000);

    // === MUTACIÓN #5 ===
    it("el programId del QUERY se ignora: A no alcanza el programa de B", async () => {
      expect(programA).not.toBe(programB);
      const svg = await (await get(cookieA, `?programId=${programB}`)).text();
      const decoded = await decodeQr(svg);
      expect(decoded).toBe(`http://localhost:3001/enroll/${programA}`);
      expect(decoded).not.toContain(programB);
    }, 60_000);
  },
);

/**
 * Lee de verdad el QR que devolvió la ruta: se rasteriza el SVG con `sharp` y se decodifica
 * con `jsqr` (los dos ya son dependencias). Sin esto el test sólo miraría que vino «un
 * SVG», que es un proxy: la mutación #5 cambia QUÉ codifica, no si es un SVG.
 */
async function decodeQr(svg: string): Promise<string> {
  const sharp = (await import("sharp")).default;
  const jsQR = (await import("jsqr")).default;
  const { data, info } = await sharp(Buffer.from(svg), { density: 600 })
    .resize({ width: 512, height: 512, fit: "contain", background: "#FFFFFF" })
    .flatten({ background: "#FFFFFF" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  if (!decoded) throw new Error("el QR no se pudo decodificar");
  return decoded.data;
}
