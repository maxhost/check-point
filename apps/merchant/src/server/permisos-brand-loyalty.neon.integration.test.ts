import { businessHttp } from "./business/http";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  dropBusiness,
  integrationEnabled as enabled,
  seedBusiness,
  seedMember,
  type Seed,
} from "./counter-integration-support";
import { conCookie, cookieDe } from "./permissions-integration-support";
import { getDb } from "@mi-pasaporte/db";
import { businesses, memberships, users } from "@mi-pasaporte/db/schema";
import { ownerBusiness, saveBrand } from "@mi-pasaporte/domain/server/brand";
import { GET as BRAND_GET, PUT as BRAND_PUT } from "../app/api/brand/route";
import { POST as LOGO_UPLOAD } from "../app/api/brand/logo-upload/route";
import {
  GET as PROGRAM_GET,
  PUT as PROGRAM_PUT,
} from "../app/api/loyalty-program/route";
import { GET as QR } from "../app/api/loyalty-program/qr/route";

/**
 * Spec 0086 §10 (enmienda 2026-09-21) — **`brand` Y `loyalty` ENTREGADAS DE VERDAD.**
 *
 * Antes de la enmienda, el guard dejaba pasar al integrante y **el resolvedor del dominio lo
 * rechazaba después**: `saveBrand`, `createLogoUpload` y `programForOwner` re-resolvían el
 * negocio por `userId` con `role = 'owner'`, ignorando el `businessId` que el guard ya había
 * resuelto. Medido antes del arreglo: `PUT /api/brand` → `403 «No tienes un negocio como
 * owner»`, `GET /api/loyalty-program` y `…/qr` → `403 not_member`.
 *
 * Y el segundo bloqueo de la misma familia: el dominio volvía a imponer `emailVerified` al
 * editar, justo después de que el paso 4 de la escalera exceptuó al staff a propósito (ADR
 * 0079 §5). Desde la spec 0156 C (ADR 0122) el dominio no tiene regla de email.
 *
 * **Este archivo mide las DOS cosas contra la base**, que es donde se ven: con `getDb`
 * doblado el resolvedor owner-only devolvería la misma fila que el del guard y la distinción
 * entera desaparecería.
 */
const brandBody = (revision: number, name: string) => ({
  name,
  brandPrimaryColor: "#176548",
  brandComplementaryColor: "#2D8B68",
  brandAccentColor: "#E78132",
  revision,
  logoAction: "keep" as const,
});

/** Cuerpo CORTO de Puntos: lo completa el compositor. Es una EDICIÓN —el negocio sembrado ya
 * tiene programa activo—. */
const programBody = {
  kind: "points",
  configuration: { unitSingular: "punto", unitPlural: "puntos" },
  accrual: { mode: "per_amount", grant: 12, blockAmount: "1.00" },
  clauses: [{ text: "Términos del comercio." }],
  rewards: [{ type: "custom", label: "Café gratis", pointsCost: 100 }],
};

describe.skipIf(!enabled)(
  "brand y loyalty delegados de verdad (spec 0086 §10)",
  () => {
    let a: Seed;
    let b: Seed;
    const extras: string[] = [];
    let staffBrandA = "";
    let cookieBrandA = "";
    let cookieLoyaltyA = "";

    beforeAll(async () => {
      const semilla = (name: string) =>
        seedBusiness({
          name,
          kind: "points",
          mode: "per_amount",
          grant: 10,
          blockAmount: "1.00",
        });
      a = await semilla("Brand Perm A");
      b = await semilla("Brand Perm B");
      staffBrandA = await seedMember({
        businessId: a.business.id,
        permissions: ["brand"],
      });
      const staffLoyaltyA = await seedMember({
        businessId: a.business.id,
        permissions: ["loyalty"],
      });
      extras.push(staffBrandA, staffLoyaltyA);
      /**
       * **EL `emailVerified: false` YA NO SE PARCHEA ACÁ: es el DEFAULT del seed**
       * (`counter-integration-support.ts`), porque es la forma de PRODUCCIÓN —un integrante
       * nace con el sintético `@staff.invalid` sin verificar (`staff-create.ts:132`)—.
       *
       * Se ASEVERA en vez de escribirse: si alguien vuelve a poner `true` en el seed, este
       * caso se pone rojo **acá**, en el archivo que depende de ello, en vez de dejar que la
       * suite entera pase midiendo un caller que no existe. Medido: con `true`, la mutación
       * que le saca la excepción al staff sobrevive en VERDE 7/7.
       */
      const verificados = await getDb()
        .select({ id: users.id, emailVerified: users.emailVerified })
        .from(users)
        .where(inArray(users.id, [staffBrandA, staffLoyaltyA]));
      expect(verificados).toHaveLength(2);
      expect(verificados.every((row) => row.emailVerified === false)).toBe(
        true,
      );

      cookieBrandA = await cookieDe(staffBrandA);
      cookieLoyaltyA = await cookieDe(staffLoyaltyA);
    }, 240_000);

    afterAll(async () => {
      for (const seed of [a, b]) if (seed) await dropBusiness(seed.business.id);
      for (const userId of [...extras, a?.userId, b?.userId].filter(Boolean)) {
        await getDb()
          .delete(memberships)
          .where(eq(memberships.userId, userId as string));
        await getDb()
          .delete(users)
          .where(eq(users.id, userId as string));
      }
    }, 180_000);

    /** DoD §10 ítem 1. El 200 es la prueba de que el integrante llegó al WRITER: antes de la
     * enmienda esto era `403 «No tienes un negocio como owner»`. */
    it("un STAFF con `brand` ESCRIBE la marca, y escribe la de SU negocio", async () => {
      const nombre = `Marca Staff ${randomUUID().slice(0, 6)}`;
      const response = await BRAND_PUT(
        conCookie("/api/brand", "PUT", cookieBrandA, brandBody(1, nombre)),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      // La fila que se movió es la de A, no una que el resolvedor eligiera por su cuenta.
      expect(body.id).toBe(a.business.id);
      expect(body.name).toBe(nombre);
      // Contra la BASE, no contra el DTO, y en los DOS negocios: el de B no se tocó.
      const fila = async (id: string) => {
        const [row] = await getDb()
          .select({ name: businesses.name })
          .from(businesses)
          .where(eq(businesses.id, id));
        return row.name;
      };
      expect(await fila(a.business.id)).toBe(nombre);
      expect(await fila(b.business.id)).toBe("Brand Perm B");
      // Y la lectura sigue abierta con el mismo permiso (control positivo del par).
      const lectura = await BRAND_GET(
        conCookie("/api/brand", "GET", cookieBrandA),
      );
      expect(lectura.status).toBe(200);
    }, 240_000);

    /** DoD §10 ítem 1, la segunda ruta de `brand`. **Se mide el DESENLACE que la enmienda
     * cambia, no el 201 entero**: `createLogoUpload` presigna contra R2 después de resolver el
     * negocio, y esa parte necesita credenciales que esta rama de integración no tiene. Lo que
     * este caso asevera es que el 403 `«No tienes un negocio como owner»` —el del resolvedor
     * owner-only, que era el bloqueo— **ya no aparece**. El 201 completo lo prueba el QA del
     * owner contra prod. */
    it("un STAFF con `brand` pasa el resolvedor de `logo-upload`", async () => {
      const response = await LOGO_UPLOAD(
        conCookie("/api/brand/logo-upload", "POST", cookieBrandA, {
          contentType: "image/png",
          byteSize: 2048,
        }),
      );
      const texto = await response.text();
      expect(texto).not.toContain("No tienes un negocio como owner");
      expect(response.status).not.toBe(403);
    }, 240_000);

    /**
     * EL CONTROL POSITIVO EN EL MISMO VECTOR, y ataca **la rama nueva** de `ownerBusiness`:
     * con `businessId` presente el resolvedor **deja de filtrar por rol**, así que lo único
     * que impide escribir sobre un negocio ajeno es que siga exigiendo MEMBRESÍA. Se llama al
     * dominio directo —no por HTTP— porque por HTTP el `businessId` sale de la sesión y este
     * camino sería inalcanzable: es exactamente la preimagen que una ruta futura podría abrir.
     */
    it("el `businessId` NO alcanza sin membresía: el staff de A no escribe la marca de B", async () => {
      await expect(
        saveBrand(staffBrandA, brandBody(1, "Secuestrada"), b.business.id),
      ).rejects.toMatchObject({ status: 403 });
      // …y el MISMO caller con el `businessId` de SU negocio sí resuelve.
      expect(await ownerBusiness(staffBrandA, a.business.id)).not.toBeNull();
      expect(await ownerBusiness(staffBrandA, b.business.id)).toBeNull();
    }, 180_000);

    /** DoD §10 ítem 3, el que importa: **sin `businessId` el resolvedor no cambia**. Un
     * integrante que lo llame como lo llamaban las puertas viejas sigue sin resolver nada, y
     * el OWNER sigue resolviendo su negocio igual que siempre. */
    it("SIN `businessId` el resolvedor se comporta como antes de la enmienda", async () => {
      expect(await ownerBusiness(staffBrandA)).toBeNull();
      const delOwner = await ownerBusiness(a.userId);
      expect(delOwner?.id).toBe(a.business.id);
    }, 180_000);

    /** DoD §10 ítem 2 — LEER. */
    it.each([
      [
        "GET /api/loyalty-program",
        () =>
          PROGRAM_GET(conCookie("/api/loyalty-program", "GET", cookieLoyaltyA)),
      ],
      [
        "GET /api/loyalty-program/qr",
        () => QR(conCookie("/api/loyalty-program/qr", "GET", cookieLoyaltyA)),
      ],
    ])(
      "un STAFF con `loyalty` lee %s con 200",
      async (_name, call) => {
        const response = await call();
        expect(response.status).toBe(200);
      },
      240_000,
    );

    /**
     * DoD §10 ítem 2 y spec 0156 C — **un integrante con `loyalty` EDITA.** Su email sintético
     * `@staff.invalid` no se verifica nunca; el programa no exige email (ADR 0122).
     */
    it("un STAFF con `loyalty` EDITA el programa: 200, no `email_not_verified`", async () => {
      const response = await PROGRAM_PUT(
        conCookie("/api/loyalty-program", "PUT", cookieLoyaltyA, programBody),
      );
      const body = await response.json();
      expect(body.code).not.toBe("email_not_verified");
      expect(response.status).toBe(200);
      expect(body.created).toBe(false);
    }, 240_000);

    /** Spec 0156 C — el paso 3 sigue mordiendo: un integrante SIN `loyalty` (tiene `brand`)
     * no escribe el programa aunque el email ya no se exija. */
    it("un STAFF SIN `loyalty` no EDITA el programa: 403 `missing_permission`", async () => {
      const response = await PROGRAM_PUT(
        conCookie("/api/loyalty-program", "PUT", cookieBrandA, programBody),
      );
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("missing_permission");
    }, 240_000);
  },
);

describe.skipIf(!enabled)(
  "private fiscal business API0235 with real sessions",
  () => {
    let a: Seed, b: Seed;
    const extraUsers: string[] = [];
    let team = "",
      brandOnly = "",
      noBusiness = "",
      ownerA = "",
      ownerB = "",
      brandUser = "";
    const business = (
      cookie: string,
      method = "GET",
      body?: unknown,
      path = "fiscal",
    ) =>
      businessHttp(conCookie(`/api/business/${path}`, method, cookie, body), [
        path,
      ]);
    const read = async (cookie: string) => {
      const response = await business(cookie);
      expect(response.status).toBe(200);
      return response.json();
    };
    const put = (cookie: string, body: unknown) =>
      business(cookie, "PUT", body);
    const readBrand = async () => {
      const response = await BRAND_GET(
        conCookie("/api/brand", "GET", brandOnly),
      );
      expect(response.status).toBe(200);
      return response.json();
    };
    beforeAll(async () => {
      const seed = (name: string) =>
        seedBusiness({
          name,
          kind: "points",
          mode: "per_amount",
          grant: 10,
          blockAmount: "1.00",
        });
      a = await seed("Fiscal A");
      b = await seed("Fiscal B");
      brandUser = await seedMember({
        businessId: a.business.id,
        permissions: ["brand"],
      });
      const delegated = await seedMember({
        businessId: a.business.id,
        permissions: ["business"],
      });
      const without = await seedMember({
        businessId: a.business.id,
        permissions: ["loyalty"],
      });
      extraUsers.push(brandUser, delegated, without);
      brandOnly = await cookieDe(brandUser);
      team = await cookieDe(delegated);
      noBusiness = await cookieDe(without);
      ownerA = await cookieDe(a.userId);
      ownerB = await cookieDe(b.userId);
    }, 180_000);
    afterAll(async () => {
      for (const seed of [a, b]) if (seed) await dropBusiness(seed.business.id);
      for (const id of [...extraUsers, a?.userId, b?.userId].filter(Boolean))
        await getDb().delete(users).where(eq(users.id, id));
    }, 180_000);
    it("delegated business writes exactly the guarded business, ignoring a forged body id", async () => {
      const beforeB = await read(ownerB),
        beforeA = await read(team);
      expect(beforeB).toMatchObject({
        chargesVat: false,
        saleVatRate: null,
        recoversPurchaseVat: false,
      });
      const response = await put(team, {
        ...beforeA,
        businessId: b.business.id,
        chargesVat: true,
        saleVatRate: "17.25",
        recoversPurchaseVat: true,
      });
      expect(response.status).toBe(200);
      const saved = await response.json();
      expect(saved).toMatchObject({
        chargesVat: true,
        saleVatRate: "17.25",
        recoversPurchaseVat: true,
      });
      expect(saved).not.toHaveProperty("logoObjectKey");
      expect(await read(ownerA)).toEqual(saved);
      expect(await read(ownerB)).toEqual(beforeB);
      const [stored] = await getDb()
        .select({
          id: businesses.id,
          chargesVat: businesses.chargesVat,
          saleVatRate: businesses.saleVatRate,
          recoversPurchaseVat: businesses.recoversPurchaseVat,
        })
        .from(businesses)
        .where(eq(businesses.id, a.business.id));
      expect(stored).toEqual({
        id: a.business.id,
        chargesVat: true,
        saleVatRate: "17.25",
        recoversPurchaseVat: true,
      });
    }, 60_000);
    it("branding-only payload preserves Fiscal, hides Regional/Fiscal, and malformed JSON returns400 without writes", async () => {
      const before = await read(team),
        branding = await readBrand();
      for (const key of [
        "timezone",
        "currencyCode",
        "chargesVat",
        "saleVatRate",
        "recoversPurchaseVat",
      ])
        expect(branding).not.toHaveProperty(key);
      const response = await BRAND_PUT(
        conCookie(
          "/api/brand",
          "PUT",
          brandOnly,
          brandBody(branding.brandRevision, "Fiscal Legacy"),
        ),
      );
      expect(response.status).toBe(200);
      const savedBrand = await response.json();
      expect(await read(team)).toEqual(before);
      expect(before).toMatchObject({
        chargesVat: true,
        saleVatRate: "17.25",
        recoversPurchaseVat: true,
      });
      const malformed = (cookie: string, path: string) =>
        new Request(`http://localhost:3001/api/${path}`, {
          method: "PUT",
          headers: { cookie, "content-type": "application/json" },
          body: "{",
        });
      expect(
        (await businessHttp(malformed(team, "business/fiscal"), ["fiscal"]))
          .status,
      ).toBe(400);
      expect((await BRAND_PUT(malformed(brandOnly, "brand"))).status).toBe(400);
      expect(await read(team)).toEqual(before);
      expect(await readBrand()).toEqual(savedBrand);
    }, 60_000);
    it("validates complete fiscal state and strict field types with422, preserving DB revision", async () => {
      const before = await read(team);
      for (const patch of [
        { chargesVat: true, saleVatRate: null },
        { saleVatRate: "100.01" },
        { saleVatRate: "10.001" },
        { saleVatRate: 15 },
        { chargesVat: "false" },
        { recoversPurchaseVat: null },
      ])
        expect((await put(team, { ...before, ...patch })).status).toBe(422);
      expect(await read(team)).toEqual(before);
    }, 120_000);
    it("brand alone receives no business permission or Regional/Fiscal access", async () => {
      const before = await read(team),
        branding = await readBrand();
      const [member] = await getDb()
        .select({ permissions: memberships.permissions })
        .from(memberships)
        .where(eq(memberships.userId, brandUser));
      expect(member.permissions).toEqual(["brand"]);
      for (const cookie of [brandOnly, noBusiness])
        for (const path of ["fiscal", "regional"]) {
          const deniedRead = await business(cookie, "GET", undefined, path);
          const deniedWrite = await business(
            cookie,
            "PUT",
            path === "fiscal"
              ? { ...before, chargesVat: false, saleVatRate: null }
              : {
                  revision: before.revision,
                  timezone: "America/Guayaquil",
                  currencyCode: "USD",
                },
            path,
          );
          for (const response of [deniedRead, deniedWrite]) {
            expect(response.status).toBe(403);
            expect((await response.json()).code).toBe("missing_permission");
          }
        }
      const forbidden = await BRAND_PUT(
        conCookie("/api/brand", "PUT", brandOnly, {
          ...brandBody(branding.brandRevision, "Denied"),
          chargesVat: false,
          saleVatRate: null,
        }),
      );
      expect(forbidden.status).toBe(422);
      expect(await read(team)).toEqual(before);
      expect(await readBrand()).toEqual(branding);
    }, 60_000);
    it("same-revision fiscal sessions yield one complete save and one409 without merging values or branding", async () => {
      const before = await read(team),
        branding = await readBrand();
      const candidates = [
        {
          ...before,
          chargesVat: true,
          saleVatRate: "0",
          recoversPurchaseVat: false,
        },
        {
          ...before,
          chargesVat: false,
          saleVatRate: null,
          recoversPurchaseVat: true,
        },
      ];
      const responses = await Promise.all([
        put(team, candidates[0]),
        put(ownerA, candidates[1]),
      ]);
      expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
      const winner = responses.findIndex((r) => r.status === 200),
        saved = await responses[winner].json();
      expect(saved).toMatchObject({
        chargesVat: candidates[winner].chargesVat,
        recoversPurchaseVat: candidates[winner].recoversPurchaseVat,
        saleVatRate: winner === 0 ? "0.00" : null,
        revision: before.revision + 1,
      });
      expect(await read(team)).toEqual(saved);
      expect(await readBrand()).toEqual(branding);
      expect(await responses[1 - winner].json()).toMatchObject({
        code: "business_revision_conflict",
      });
    }, 60_000);
  },
);
