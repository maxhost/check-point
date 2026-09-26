import { expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useSelectedLayoutSegment: () => null }));
import { delegatedLinks } from "../backoffice-navigation";
it("navegación publica Marca sólo para staff con brand", () => {
  expect(delegatedLinks(["brand"]).map((link) => link.href)).toEqual([
    "/backoffice/brand",
  ]);
  expect(delegatedLinks(["counter"]).map((link) => link.href)).not.toContain(
    "/backoffice/brand",
  );
});
