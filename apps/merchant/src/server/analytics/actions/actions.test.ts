import { describe, expect, it } from "vitest";
import { resolveAction } from "./index";
import {
  ANALYTICS_POLICY,
  createAnalyticsPolicy,
} from "@mi-pasaporte/domain/analytics/policy/index";
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

it("uses injected policy labels without changing action destinations or permissions", () => {
  const policy = createAnalyticsPolicy({
    ...structuredClone(ANALYTICS_POLICY),
    texts: {
      ...ANALYTICS_POLICY.texts,
      action_view_day: "Consultar ventas",
      action_edit_product_price: "Revisar margen",
      action_view_modules: "Completar herramientas",
      action_record_expense: "Revisar gastos",
    },
  });
  const owner = { role: "owner", permissions: [] };
  expect(
    resolveAction(
      "view_day",
      "/backoffice/analytics?date=2026-10-19",
      owner,
      new Set(),
      [],
      policy,
    ),
  ).toEqual({
    label: "Consultar ventas",
    href: "/backoffice/analytics?date=2026-10-19",
  });
  expect(
    resolveAction(
      "edit_product_price",
      undefined,
      { role: "staff", permissions: ["analytics"] },
      new Set(),
      [],
      policy,
    ),
  ).toBeNull();
  expect(
    resolveAction(
      "edit_product_price",
      undefined,
      owner,
      new Set(),
      [],
      policy,
    ),
  ).toEqual({ label: "Revisar margen", href: "/backoffice/catalog" });
  expect(
    resolveAction(
      "record_expense",
      undefined,
      owner,
      new Set(["sample"]),
      [manifest],
      policy,
    ),
  ).toEqual({ label: "Revisar gastos", href: "/backoffice/sample" });
  expect(
    resolveAction(
      "record_expense",
      undefined,
      owner,
      new Set(),
      [manifest],
      policy,
    ),
  ).toEqual({ label: "Completar herramientas", href: "/backoffice/settings" });
  expect(
    resolveAction(null, "/backoffice/analytics", owner, new Set(), [], policy),
  ).toBeNull();
});

it("preserves declared action destinations with a captured detail query and rejects foreign paths", () => {
  const manifests = [
    {
      ...manifest,
      analyticsActions: [
        {
          key: "view_count_detail",
          label: "Ver detalle",
          href: "/backoffice/sample",
        },
      ],
    },
  ];
  const viewer = { role: "staff", permissions: ["sample_view"] };
  expect(
    resolveAction(
      "view_count_detail",
      "/backoffice/sample?movementId=count",
      viewer,
      new Set(["sample"]),
      manifests,
    )?.href,
  ).toBe("/backoffice/sample?movementId=count");
  for (const href of [
    "https://evil.invalid/backoffice/sample",
    "//evil.invalid/backoffice/sample",
    "/backoffice/sample-other?movementId=count",
    "/backoffice/sample/../catalog",
  ]) {
    expect(
      resolveAction(
        "view_count_detail",
        href,
        viewer,
        new Set(["sample"]),
        manifests,
      )?.href,
    ).toBe("/backoffice/sample");
  }
  expect(
    resolveAction(
      "view_count_detail",
      "/backoffice/sample?movementId=count",
      { role: "staff", permissions: ["analytics"] },
      new Set(["sample"]),
      manifests,
    ),
  ).toBeNull();
});
