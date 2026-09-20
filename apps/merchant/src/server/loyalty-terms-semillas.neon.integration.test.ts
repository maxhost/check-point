import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { inArray, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
if (enabled) process.env.DATABASE_URL = url;

import { getDb } from "./db";
import { termsTemplates } from "./schema";

/**
 * LAS SEMILLAS DEL TOS, aseveradas contra la base y sin ningún negocio de por medio
 * (specs 0078 y 0081 §3).
 *
 * Archivo aparte por el hook `file-size`: estos casos vivían en
 * `onboarding-program-terms.neon.integration.test.ts`, que con ellos quedaba en **327**
 * líneas sobre un límite de 300 — «dividir, no extender». El corte no es arbitrario: allá
 * queda lo que necesita un negocio, una sesión y la ruta; acá queda lo que sólo mira las
 * filas de `core.terms_template`, que es data de migración.
 *
 * Las tres propiedades:
 *
 *  - los **conteos y allowlists** de los dos scopes por país;
 *  - las dos migraciones de semillas son **idempotentes** (las ramas de Neon de CI y de
 *    integración ya tienen las filas, así que el `ON CONFLICT DO NOTHING` no es un detalle);
 *  - **ninguna semilla nombra las variables de local**, que es lo único que impide el 422
 *    del caso trampa de la 0081.
 */
const MIGRATION_0038 = fileURLToPath(
  new URL("../../drizzle/0038_terms_por_pais.sql", import.meta.url),
);
const MIGRATION_0039 = fileURLToPath(
  new URL("../../drizzle/0039_tos_variables_del_negocio.sql", import.meta.url),
);

const PAIS_SCOPES = ["default", "EC"];

describe.skipIf(!enabled)("las semillas del TOS (specs 0078 y 0081)", () => {
  it("las 8 semillas por país están publicadas con `country_code` en el allowlist", async () => {
    const rows = await getDb()
      .select()
      .from(termsTemplates)
      .where(inArray(termsTemplates.jurisdictionScope, PAIS_SCOPES));
    // 4 de la `0038` (`earning` + `redemption` × 2 scopes) + 4 de la `0039`
    // (`earning_per_amount` + `transition` × 2 scopes).
    expect(rows).toHaveLength(8);
    expect(rows.filter((row) => row.key === "earning_per_amount")).toHaveLength(
      2,
    );
    expect(rows.filter((row) => row.key === "transition")).toHaveLength(2);
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

  /**
   * **`transition` EXISTE EN LOS DOS SCOPES POR PAÍS, y su texto NO nombra las variables del
   * cierre.** La fila de `transition` de `global-draft` está `archived` desde la migración
   * `0011` justamente porque usa `{{earning_ends_at}}` / `{{redemption_ends_at}}`, que el
   * renderer de hoy **no provee**: dejarla publicada la hacía seleccionable y reventaba el
   * guardado con un 422. Copiar su texto a los scopes nuevos habría reintroducido ese bug,
   * así que este caso es el que impide que vuelva.
   */
  it("`transition` está en `default` y en `EC`, sin las variables del cierre", async () => {
    const rows = await getDb()
      .select({
        jurisdictionScope: termsTemplates.jurisdictionScope,
        status: termsTemplates.status,
        templateMarkdown: termsTemplates.templateMarkdown,
      })
      .from(termsTemplates)
      .where(inArray(termsTemplates.jurisdictionScope, PAIS_SCOPES));
    const transition = rows.filter((row) =>
      row.templateMarkdown.includes("dar por terminado este programa"),
    );
    expect(transition.map((row) => row.jurisdictionScope).sort()).toEqual([
      "EC",
      "default",
    ]);
    for (const row of transition) {
      expect(row.status).toBe("published");
      expect(row.templateMarkdown).not.toContain("{{earning_ends_at}}");
      expect(row.templateMarkdown).not.toContain("{{redemption_ends_at}}");
    }
  }, 60_000);

  /**
   * **LAS 3 FILAS DE `global-draft` QUEDARON `archived`** (spec 0081 §3). Que el camino esté
   * cerrado de verdad —que `renderedTerms` ya no las pueda usar— lo mide
   * `loyalty-terms-render.neon.integration.test.ts`; acá se mide el dato.
   */
  it("las 3 filas de `global-draft` están `archived`, y ninguna `published`", async () => {
    const rows = await getDb()
      .select({
        key: termsTemplates.key,
        status: termsTemplates.status,
        publishedAt: termsTemplates.publishedAt,
      })
      .from(termsTemplates)
      .where(inArray(termsTemplates.jurisdictionScope, ["global-draft"]));
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.key).sort()).toEqual([
      "earning",
      "redemption",
      "transition",
    ]);
    for (const row of rows) {
      expect(row.status).toBe("archived");
      expect(row.publishedAt).toBeNull();
    }
  }, 60_000);

  /**
   * **EL CASO TRAMPA DE LA SPEC 0081, del lado de las SEMILLAS.** `renderTermsText` tira 422
   * cuando el valor de la variable es vacío, y un negocio sin locales `active` no tiene qué
   * poner en `{{business_locations}}` / `{{business_address}}`. Lo único que impide ese 422
   * es que **ninguna plantilla del wizard las nombre**: no emitir la variable y emitirla
   * vacía dan EXACTAMENTE el mismo 422, así que el diccionario no puede proteger este caso.
   * Este es el oráculo que sí lo protege.
   */
  it("ninguna semilla por país nombra las variables de local", async () => {
    const rows = await getDb()
      .select({
        key: termsTemplates.key,
        templateMarkdown: termsTemplates.templateMarkdown,
      })
      .from(termsTemplates)
      .where(inArray(termsTemplates.jurisdictionScope, PAIS_SCOPES));
    expect(rows.length).toBeGreaterThanOrEqual(8);
    for (const row of rows) {
      expect(row.templateMarkdown).not.toContain("{{business_locations}}");
      expect(row.templateMarkdown).not.toContain("{{business_address}}");
    }
  }, 60_000);

  /**
   * **LAS DOS MIGRACIONES DE SEMILLAS SON IDEMPOTENTES.** Va al final del archivo a
   * propósito: es el único caso que ESCRIBE, y los de arriba leen las mismas filas.
   *
   * Cada `statement` va suelto: el driver HTTP de Neon no acepta varios en un `execute`, y
   * el `--> statement-breakpoint` de drizzle es exactamente donde corta el migrador.
   */
  it("las migraciones 0038 y 0039 son IDEMPOTENTES: siguen siendo 8 filas, no 16", async () => {
    const db = getDb();
    const statements = [MIGRATION_0038, MIGRATION_0039].flatMap((file) =>
      readFileSync(file, "utf8")
        .split("--> statement-breakpoint")
        .map((chunk) => chunk.trim())
        .filter((chunk) => chunk.length > 0),
    );
    // Piso de statements: si el split se rompiera, el caso no puede quedar verde por vacío.
    expect(statements.length).toBeGreaterThanOrEqual(3);
    for (const statement of statements) await db.execute(sql.raw(statement));
    const rows = await db
      .select({ id: termsTemplates.id })
      .from(termsTemplates)
      .where(inArray(termsTemplates.jurisdictionScope, PAIS_SCOPES));
    expect(rows).toHaveLength(8);
  }, 90_000);
});
