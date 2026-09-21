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
import { getDb } from "./db";
import { businesses, memberships, users } from "./schema";
import { ownerBusiness, saveBrand } from "./brand";
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
 * Y el segundo bloqueo de la misma familia: `programEditDenied` volvía a imponer
 * `emailVerified` **adentro del dominio**, justo después de que el paso 4 de la escalera
 * exceptuó al staff a propósito (ADR 0079 §5).
 *
 * **Este archivo mide las DOS cosas contra la base**, que es donde se ven: con `getDb`
 * doblado el resolvedor owner-only devolvería la misma fila que el del guard y la distinción
 * entera desaparecería.
 */
const brandBody = (revision: number, name: string) => ({
  name,
  timezone: "America/Guayaquil",
  brandPrimaryColor: "#176548",
  brandComplementaryColor: "#2D8B68",
  brandAccentColor: "#E78132",
  revision,
  logoAction: "keep" as const,
});

/** Cuerpo CORTO de Puntos: lo completa el compositor. Es una EDICIÓN —el negocio sembrado ya
 * tiene programa activo—, que es justo el caso que el gate del writer bloqueaba. */
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
     * DoD §10 ítem 2 — **EDITAR, que es el caso que el gate del writer mataba.**
     *
     * El negocio sembrado ya tiene programa activo, así que `isEdit` es `true` y
     * `programEditDenied` exigía `emailVerified || onboardingGrantActive`. Un integrante no
     * tiene ninguno de los dos **por diseño** —su email sintético `@staff.invalid` no se
     * verifica nunca—, así que sin `isStaff` esto devolvía `403 email_not_verified`. Es el
     * oráculo de la mutación M8.
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
  },
);
