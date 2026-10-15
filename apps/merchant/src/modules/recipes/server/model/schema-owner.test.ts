import { expect, it } from "vitest";
import { schemaExportOwners } from "../../../modules-boundary-support";

it("the canonical recipes schema owns all eight R1 tables", () => {
  const owners = schemaExportOwners();
  for (const name of [
    "recipeEntities",
    "independentRecipeLines",
    "independentRecipeRevisions",
    "productCompositions",
    "compositionRevisions",
    "recipeSaleResolutions",
    "recipeConsumptionSources",
    "recipeMigrationMappings",
  ])
    expect(owners.get(name), name).toBe("recipes");
});
