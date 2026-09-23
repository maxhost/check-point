import { describe, expect, it } from "vitest";
import { CatalogImportError } from "./catalog-import/types";
import { buildDraft, validateDraft } from "./catalog-import/draft";
import type { ProviderExtraction } from "./catalog-import/types";

/**
 * Spec 0090 §5 — EL BORRADOR: duplicados con la normalizacion del **indice real**,
 * resoluciones de categoria y revalidacion del `PUT`.
 *
 * `duplicateCandidate` es un **aviso**: nada se fusiona solo, y una categoria detectada
 * siempre nace en `create` aunque haya candidato.
 */
const extraccion = (
  categories: ProviderExtraction["categories"],
): ProviderExtraction => ({
  categories,
  warnings: ["La página 2 estaba borrosa."],
  usage: { inputTokens: 1, outputTokens: 2 },
  providerRequestId: "req_1",
});

const CAT_EXISTENTE = "11111111-1111-4111-8111-111111111111";
const PROD_EXISTENTE = "22222222-2222-4222-8222-222222222222";

const snapshot = {
  categories: [{ id: CAT_EXISTENTE, name: "  Bebidas Calientes  " }],
  products: [{ id: PROD_EXISTENTE, name: "Cappuccino" }],
};

describe("construcción del borrador (spec 0090 §5)", () => {
  it("marca el duplicado de categoría con lower(trim(name)) — la del índice", () => {
    const draft = buildDraft(
      extraccion([{ sourceId: "c1", name: "bebidas calientes", products: [] }]),
      snapshot,
    );
    expect(draft.categories[0].duplicateCandidate).toEqual({
      categoryId: CAT_EXISTENTE,
      name: "  Bebidas Calientes  ",
    });
    // Y sigue en `create`: el candidato AVISA, no resuelve.
    expect(draft.categories[0].resolution).toEqual({ kind: "create" });
  });

  it("marca el duplicado de producto, y aun así `include` nace en true", () => {
    const draft = buildDraft(
      extraccion([
        {
          sourceId: "c1",
          name: "Otra",
          products: [
            {
              sourceId: "p1",
              name: "CAPPUCCINO",
              unitPrice: "3.25",
              priceStatus: "detected",
              sourceText: null,
            },
          ],
        },
      ]),
      snapshot,
    );
    expect(draft.categories[0].products[0]).toMatchObject({
      include: true,
      duplicateCandidate: { productId: PROD_EXISTENTE, name: "Cappuccino" },
    });
  });

  it("sin coincidencia, no hay candidato — y no hay fuzzy merge", () => {
    const draft = buildDraft(
      extraccion([{ sourceId: "c1", name: "Bebidas calient", products: [] }]),
      snapshot,
    );
    expect(draft.categories[0].duplicateCandidate).toBeNull();
  });

  it("el borrador nace en versión 1 y conserva los warnings", () => {
    const draft = buildDraft(extraccion([]), snapshot);
    expect(draft).toEqual({
      version: 1,
      categories: [],
      warnings: ["La página 2 estaba borrosa."],
    });
  });
});

function codigoDe(fn: () => unknown): { status: number; code: string } {
  try {
    fn();
  } catch (error) {
    if (error instanceof CatalogImportError) {
      return { status: error.status, code: error.code };
    }
    throw error;
  }
  throw new Error("no tiró");
}

const ctx = { categoryIds: new Set([CAT_EXISTENTE]) };
const categoria = (overrides: Record<string, unknown> = {}) => ({
  draftId: "c1",
  name: "Bebidas",
  resolution: { kind: "create" },
  duplicateCandidate: null,
  products: [],
  ...overrides,
});
const producto = (overrides: Record<string, unknown> = {}) => ({
  draftId: "p1",
  name: "Café",
  unitPrice: "3.50",
  priceStatus: "detected",
  sourceText: null,
  include: true,
  duplicateCandidate: null,
  ...overrides,
});

describe("revalidación del borrador (spec 0090 §6)", () => {
  it("acepta las cuatro resoluciones", () => {
    for (const resolution of [
      { kind: "create" },
      { kind: "uncategorized" },
      { kind: "discard" },
      { kind: "use_existing", categoryId: CAT_EXISTENTE },
    ]) {
      const draft = validateDraft(
        { version: 1, categories: [categoria({ resolution })], warnings: [] },
        ctx,
      );
      expect(draft.categories[0].resolution).toMatchObject({
        kind: resolution.kind,
      });
    }
  });

  it("`use_existing` con una categoría de OTRO negocio es 422 y no 500", () => {
    expect(
      codigoDe(() =>
        validateDraft(
          {
            version: 1,
            categories: [
              categoria({
                resolution: {
                  kind: "use_existing",
                  categoryId: "33333333-3333-4333-8333-333333333333",
                },
              }),
            ],
            warnings: [],
          },
          ctx,
        ),
      ),
    ).toEqual({ status: 422, code: "invalid_catalog_draft" });
  });

  it("una resolución desconocida no cuela", () => {
    expect(
      codigoDe(() =>
        validateDraft(
          {
            version: 1,
            categories: [categoria({ resolution: { kind: "merge" } })],
            warnings: [],
          },
          ctx,
        ),
      ),
    ).toEqual({ status: 422, code: "invalid_catalog_draft" });
  });

  it("EL PRECIO ES UN STRING: mandarlo como número es 422", () => {
    expect(
      codigoDe(() =>
        validateDraft(
          {
            version: 1,
            categories: [
              categoria({ products: [producto({ unitPrice: 3.5 })] }),
            ],
            warnings: [],
          },
          ctx,
        ),
      ),
    ).toEqual({ status: 422, code: "invalid_catalog_draft" });
  });

  it("un precio negativo o mal formado es 422", () => {
    for (const precio of ["-1", "abc"]) {
      expect(
        codigoDe(() =>
          validateDraft(
            {
              version: 1,
              categories: [
                categoria({ products: [producto({ unitPrice: precio })] }),
              ],
              warnings: [],
            },
            ctx,
          ),
        ),
      ).toEqual({ status: 422, code: "invalid_catalog_draft" });
    }
  });

  /** ORACULO DE M5, en la capa del borrador: un `ambiguous` **jamás** conserva un número. */
  it("un `ambiguous` queda en null aunque el cuerpo mande un precio", () => {
    const draft = validateDraft(
      {
        version: 1,
        categories: [
          categoria({
            products: [
              producto({ priceStatus: "ambiguous", unitPrice: "3.50" }),
            ],
          }),
        ],
        warnings: [],
      },
      ctx,
    );
    expect(draft.categories[0].products[0]).toMatchObject({
      priceStatus: "ambiguous",
      unitPrice: null,
    });
  });

  it("un nombre vacío o repetido de draftId no pasa", () => {
    expect(
      codigoDe(() =>
        validateDraft(
          { version: 1, categories: [categoria({ name: "  " })], warnings: [] },
          ctx,
        ),
      ),
    ).toEqual({ status: 422, code: "invalid_catalog_draft" });
    expect(
      codigoDe(() =>
        validateDraft(
          {
            version: 1,
            categories: [categoria(), categoria()],
            warnings: [],
          },
          ctx,
        ),
      ),
    ).toEqual({ status: 422, code: "invalid_catalog_draft" });
  });

  it("más de 250 productos es 422", () => {
    const muchos = Array.from({ length: 251 }, (_, i) =>
      producto({ draftId: `p${i}`, name: `P${i}` }),
    );
    expect(
      codigoDe(() =>
        validateDraft(
          {
            version: 1,
            categories: [categoria({ products: muchos })],
            warnings: [],
          },
          ctx,
        ),
      ),
    ).toEqual({ status: 422, code: "invalid_catalog_draft" });
  });

  it("un candidato que ya no existe se descarta en silencio: es un aviso", () => {
    const draft = validateDraft(
      {
        version: 1,
        categories: [
          categoria({
            duplicateCandidate: {
              categoryId: "44444444-4444-4444-8444-444444444444",
              name: "Vieja",
            },
          }),
        ],
        warnings: [],
      },
      ctx,
    );
    expect(draft.categories[0].duplicateCandidate).toBeNull();
  });
});
