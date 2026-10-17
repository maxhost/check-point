import { describe, expect, it } from "vitest";
import { resolveAction } from "./index";
const manifest = {
  id: "sample",
  name: "Sample",
  description: "",
  requires: [],
  suggestedFor: [],
  permissions: [{ id: "sample_view", label: "View", description: "" }],
  navigation: [
    { path: "", label: "Sample", icon: "Shop", permission: "sample_view" },
  ],
  analyticsActions: [
    {
      key: "record_expense",
      label: "Registrar gasto",
      href: "/backoffice/sample",
    },
  ],
};
describe("AN-1 action contract", () => {
  it("resolves only enabled declarations and the required permission", () => {
    expect(
      resolveAction(
        "record_expense",
        undefined,
        { role: "owner", permissions: [] },
        new Set(["sample"]),
        [manifest],
      ),
    ).toEqual({ label: "Registrar gasto", href: "/backoffice/sample" });
    expect(
      resolveAction(
        "record_expense",
        undefined,
        { role: "staff", permissions: ["analytics"] },
        new Set(["sample"]),
        [manifest],
      ),
    ).toBeNull();
    expect(
      resolveAction(
        "record_expense",
        undefined,
        { role: "staff", permissions: ["sample_view"] },
        new Set(["sample"]),
        [manifest],
      )?.href,
    ).toBe("/backoffice/sample");
    expect(
      resolveAction(
        "record_expense",
        undefined,
        { role: "owner", permissions: [] },
        new Set(),
        [manifest],
      )?.href,
    ).toBe("/backoffice/settings");
  });
  it("core price action respects catalog access", () => {
    expect(
      resolveAction(
        "edit_product_price",
        undefined,
        { role: "staff", permissions: ["analytics"] },
        new Set(),
        [],
      ),
    ).toBeNull();
    expect(
      resolveAction(
        "edit_product_price",
        undefined,
        { role: "staff", permissions: ["catalog"] },
        new Set(),
        [],
      )?.href,
    ).toBe("/backoffice/catalog");
  });
});
