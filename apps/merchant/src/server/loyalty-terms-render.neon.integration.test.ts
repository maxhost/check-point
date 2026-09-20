import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
if (enabled) process.env.DATABASE_URL = url;

import { getDb } from "./db";
import { termsTemplates } from "./schema";
import type { ProgramInput } from "./loyalty-program/core";
import { renderedTerms } from "./loyalty-program/terms";

/**
 * Spec 0078 — LOS BORDES DEL RENDERIZADO, con las plantillas de verdad en la base.
 *
 * Los tres casos de acá son los que el wizard NO ejerce y que igual tienen que seguir
 * valiendo después de la 0078:
 *
 *  - el **control negativo** del allowlist: la misma `{{country_code}}` que ahora
 *    renderiza en las semillas nuevas sigue siendo **422** en una plantilla que no la
 *    permite (si no, el verde del caso positivo no prueba que el allowlist exista);
 *  - **`global-draft` YA NO SE PUEDE USAR** — polaridad DADA VUELTA a propósito por la spec
 *    0081 §3, que la archiva. Hasta la 0080 este caso exigía que siguiera `published` y
 *    renderizara; desde la migración `0039` está `archived`, así que el filtro
 *    `status='published'` de `renderedTerms` la excluye y la cláusula cae al 422 «La
 *    plantilla seleccionada no está disponible.». **No se borró el caso: se invirtió**, y su
 *    aserción es lo que prueba que el archivado cierra el camino al texto deprecado «Los
 *    sello se acumulan…» que el revisor de la 0078 reportó al owner;
 *  - el texto libre —el TOS personalizado del panel— se guarda tal cual y **no admite
 *    variables**, que es el límite declarado en `docs/specs/0078-contratos-de-api.md`.
 */
const SIN_ALLOWLIST = "0078cc00-0000-4000-8000-0000000000ff";
const GLOBAL_DRAFT_EARNING = "9d4a3a05-2a87-4d12-8a99-e1a59e3cf101";

/** Un negocio que NO existe en `core.business`: alcanza porque `renderedTerms` sólo usa su
 * `id` para listar locales (cero filas) y el resto son datos ya resueltos. */
const business = {
  id: "00000081-0000-4000-8000-0000000000aa",
  name: "Bodega Las Peñas",
  countryCode: "EC",
  currencyCode: "USD",
};

const stampsInput = (
  configuration: Record<string, unknown>,
  clauses: ProgramInput["clauses"],
): ProgramInput => ({
  kind: "stamps",
  configuration,
  clauses,
  stampAction: "keep",
  stampCropped: false,
  cardDesign: null,
  accrual: { mode: "per_purchase", grant: 1, blockAmount: null },
  rewards: [],
  redeemAllowInsufficient: false,
});

describe.skipIf(!enabled)("renderedTerms contra Neon (spec 0078)", () => {
  beforeAll(async () => {
    await getDb()
      .insert(termsTemplates)
      .values({
        id: SIN_ALLOWLIST,
        // Clave que el wizard NO pide: esta fila no participa de ninguna resolución.
        key: "control-0078",
        jurisdictionScope: "ZZR",
        locale: "es",
        category: "acumulacion",
        title: "Control sin allowlist",
        templateMarkdown: "Rige en {{country_code}}.",
        variablesAllowlist: ["business_legal_name"],
        version: "1",
        status: "published",
        publishedAt: new Date(),
      });
  }, 120_000);

  afterAll(async () => {
    await getDb()
      .delete(termsTemplates)
      .where(eq(termsTemplates.jurisdictionScope, "ZZR"));
  }, 120_000);

  it("CONTROL NEGATIVO: `{{country_code}}` fuera del allowlist sigue siendo 422", async () => {
    await expect(
      renderedTerms(
        stampsInput({ unitName: "sello", unitPlural: "sellos", target: 6 }, [
          { templateId: SIN_ALLOWLIST },
        ]),
        business,
      ),
    ).rejects.toThrow("no está permitida");
  }, 60_000);

  it("`global-draft` quedó ARCHIVADA y ya no se puede usar (spec 0081)", async () => {
    const [row] = await getDb()
      .select({ status: termsTemplates.status })
      .from(termsTemplates)
      .where(eq(termsTemplates.id, GLOBAL_DRAFT_EARNING));
    expect(row.status).toBe("archived");
    // El oráculo fuerte no es el `status` de la fila, es que el camino esté cerrado: aunque
    // un panel guarde el id viejo, `renderedTerms` filtra por `published` y corta.
    await expect(
      renderedTerms(
        stampsInput({ unitName: "sello", target: 6 }, [
          { templateId: GLOBAL_DRAFT_EARNING },
        ]),
        business,
      ),
    ).rejects.toThrow("La plantilla seleccionada no está disponible.");
  }, 60_000);

  it("texto libre: se guarda tal cual, y con `{{x}}` sigue dando 422", async () => {
    const configuration = {
      unitName: "sello",
      unitPlural: "sellos",
      target: 6,
    };
    const { markdown } = await renderedTerms(
      stampsInput(configuration, [{ text: "Mi TOS propio, sin plantilla." }]),
      business,
    );
    expect(markdown).toBe("Mi TOS propio, sin plantilla.");
    await expect(
      renderedTerms(
        stampsInput(configuration, [{ text: "Hola {{business_legal_name}}." }]),
        business,
      ),
    ).rejects.toThrow("no está permitida");
  }, 60_000);
});
