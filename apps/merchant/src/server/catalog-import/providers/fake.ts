import { createHash } from "node:crypto";
import type {
  CatalogExtractionInput,
  CatalogExtractionProvider,
  ProviderExtraction,
  StartResult,
} from "../types";

/**
 * Spec 0090 §4 — EL ADAPTADOR `fake`, DETERMINISTA.
 *
 * Con `CATALOG_EXTRACTION_PROVIDER=fake` **todo el arco se desarrolla y se testea sin una
 * clave, sin un webhook y sin gastar un centavo** (§Despliegue). Implementa **solo `start`**
 * y contesta `completed`: la forma diferida es opcional en el contrato justamente para que
 * un adaptador sincronico no tenga que fingir un `jobId`.
 *
 * Determinista **por el contenido**: el mismo archivo da el mismo borrador, que es lo que
 * permite aseverar valores exactos en un test de integracion.
 */
export class FakeCatalogExtractionProvider implements CatalogExtractionProvider {
  readonly id = "fake";
  readonly model = "fake-menu-v1";

  async start(input: CatalogExtractionInput): Promise<StartResult> {
    return { kind: "completed", extraction: fakeExtraction(input) };
  }
}

/** Un borrador con los tres casos que importan: precio leido, precio **ambiguo** (que nace
 * `null` y no `0`) y un producto sin precio en el menu. */
export function fakeExtraction(
  input: CatalogExtractionInput,
): ProviderExtraction {
  const seed = createHash("sha256")
    .update(input.sourceKind)
    .update(String(input.pages.length))
    .update(input.pages[0]?.bytes.subarray(0, 64) ?? Buffer.alloc(0))
    .digest("hex")
    .slice(0, 8);
  return {
    categories: [
      {
        sourceId: "c1",
        name: "Bebidas calientes",
        products: [
          {
            sourceId: "p1",
            name: "Cappuccino",
            unitPrice: "3.25",
            priceStatus: "detected",
            sourceText: "Cappuccino $3,25",
          },
          {
            sourceId: "p2",
            name: "Té de hierbas",
            unitPrice: null,
            priceStatus: "ambiguous",
            sourceText: "Té de hierbas $2,5?",
          },
        ],
      },
      {
        sourceId: "c2",
        name: "Para picar",
        products: [
          {
            sourceId: "p3",
            name: `Tabla de quesos ${seed}`,
            unitPrice: "12.00",
            priceStatus: "detected",
            sourceText: "Tabla de quesos 12",
          },
        ],
      },
    ],
    warnings: [`Extracción simulada (${input.pages.length} página/s).`],
    usage: { inputTokens: 100, outputTokens: 50 },
    providerRequestId: `fake-${seed}`,
  };
}
