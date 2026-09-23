import { createHash } from "node:crypto";
import type {
  CatalogExtractionInput,
  CatalogExtractionProvider,
  ProviderExtraction,
  StartResult,
} from "../types";
import { validateProviderExtraction } from "../validation";

/**
 * Spec 0090 §4 — EL ADAPTADOR `fake`, DETERMINISTA.
 *
 * Con `CATALOG_EXTRACTION_PROVIDER=fake` **todo el arco se desarrolla y se testea sin una
 * clave, sin un webhook y sin gastar un centavo** (§Despliegue). Implementa **solo `start`**
 * y contesta `completed`: la forma diferida es opcional en el contrato justamente para que
 * un adaptador sincronico no tenga que fingir un `jobId`.
 *
 * Determinista **por el contenido**: el mismo archivo da el mismo resultado, que es lo que
 * permite aseverar valores exactos en un test de integracion.
 */
export class FakeCatalogExtractionProvider implements CatalogExtractionProvider {
  readonly id = "fake";
  readonly model = "fake-menu-v1";

  async start(input: CatalogExtractionInput): Promise<StartResult> {
    return { kind: "completed", extraction: fakeExtraction(input) };
  }
}

/**
 * §10 — EL MISMO CONTRATO `v2`, con **los cuatro casos que importan** para que los dos
 * caminos se puedan probar sin gastar un centavo: un precio que parsea, uno con separador de
 * miles, **uno que NO parsea** (que tiene que nacer `unit_price NULL` y nunca `0`) y **un
 * item ilegible**, que no entra al catalogo y se lista en `result.discarded`.
 *
 * Pasa por `validateProviderExtraction` **a proposito**: el fake tiene que recorrer el mismo
 * camino que el adaptador real, incluido el descarte. Un fake que devolviera la extraccion ya
 * normalizada describiria un proveedor que no existe.
 */
export function fakeExtraction(
  input: CatalogExtractionInput,
): ProviderExtraction {
  const seed = createHash("sha256")
    .update(input.sourceKind)
    .update(String(input.pages.length))
    .update(input.pages[0]?.bytes.subarray(0, 64) ?? Buffer.alloc(0))
    .digest("hex")
    .slice(0, 8);
  return validateProviderExtraction({
    categories: [
      {
        sourceId: "c1",
        name: "Bebidas calientes",
        products: [
          {
            sourceId: "p1",
            name: "Cappuccino",
            priceText: "$3,25",
          },
          // No parsea (es un rango): el producto nace SIN precio.
          {
            sourceId: "p2",
            name: "Té de hierbas",
            priceText: "2,5 - 3,5",
          },
          // Ilegible: se DESCARTA y se lista en el resumen.
          {
            sourceId: "p4",
            name: "   ",
            priceText: null,
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
            priceText: "$ 1.250,00",
          },
        ],
      },
    ],
    warnings: [`Extracción simulada (${input.pages.length} página/s).`],
    usage: { inputTokens: 100, outputTokens: 50 },
    providerRequestId: `fake-${seed}`,
  });
}
