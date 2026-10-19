import { describe, expect, it, vi } from "vitest";
vi.mock("../modules/activation", () => ({ enabledModuleIds: vi.fn() }));
vi.mock("../modules/start-page", () => ({
  moduleDestinationFor: (
    enabled: ReadonlySet<string>,
    viewer: { permissions: string[] },
  ) =>
    enabled.has("sample") && viewer.permissions.includes("sample_access")
      ? "/backoffice/sample"
      : null,
}));
import {
  backofficeDestination,
  destinationWithLocation,
} from "./backoffice-destination";

const staff = (permissions: string[]) => ({ isOwner: false, permissions });
describe("authorized backoffice fallback", () => {
  it("prefers the module registry destination for authorized viewers", () => {
    expect(
      backofficeDestination(
        new Set(["sample"]),
        staff(["sample_access", "counter"]),
      ),
    ).toBe("/backoffice/sample");
  });
  it("disabled and revoked modules cannot become destinations", () => {
    expect(
      backofficeDestination(new Set(), staff(["sample_access", "counter"])),
    ).toBe("/backoffice/customers");
    expect(backofficeDestination(new Set(["sample"]), staff(["counter"]))).toBe(
      "/backoffice/customers",
    );
  });
  it("core permissions lead to authorized pages; no effective permission yields no redirect", () => {
    expect(backofficeDestination(new Set(), staff(["analytics"]))).toBe(
      "/backoffice",
    );
    expect(backofficeDestination(new Set(), staff(["catalog"]))).toBe(
      "/backoffice/catalog",
    );
    expect(backofficeDestination(new Set(), staff([]))).toBeNull();
    expect(
      backofficeDestination(new Set(), { isOwner: true, permissions: [] }),
    ).toBe("/backoffice");
  });
  it("preserves only an active location of this business, encoding it as query data", () => {
    expect(
      destinationWithLocation("/backoffice/sample", "local", ["local"]),
    ).toBe("/backoffice/sample?location=local");
    for (const invalid of [
      "foreign",
      "archived",
      ["local"],
      undefined,
      "local&x=1",
    ])
      expect(
        destinationWithLocation("/backoffice/sample", invalid, ["local"]),
      ).toBe("/backoffice/sample");
  });
});
