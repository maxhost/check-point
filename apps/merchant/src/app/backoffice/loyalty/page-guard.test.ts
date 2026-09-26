import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  permissions: ["loyalty", "catalog"],
  role: "staff",
}));
vi.mock("../../../server/auth-guards", () => ({
  requireBackofficeSession: async () => ({ membership: state }),
}));
vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    throw new Error(`redirect:${href}`);
  },
}));
vi.mock("./loyalty-page", () => ({ default: () => null }));
import Page from "./page";
import { delegatedLinks } from "../backoffice-navigation";
describe("Loyalty permission adapter", () => {
  beforeEach(() => {
    state.permissions = ["loyalty", "catalog"];
    state.role = "staff";
  });
  it("staff autorizado recibe capacidades sin email", async () => {
    const result = await Page();
    expect(result.props).toEqual({ isOwner: false, canReadCatalog: true });
  });
  it("owner conserva capacidades", async () => {
    state.role = "owner";
    expect((await Page()).props.isOwner).toBe(true);
  });
  it("sin loyalty rebota y no publica destino", async () => {
    state.permissions = ["catalog"];
    await expect(Page()).rejects.toThrow("redirect:/backoffice");
    expect(
      delegatedLinks(state.permissions).some(
        (item) => item.segment === "loyalty",
      ),
    ).toBe(false);
  });
  it("loyalty no implica catalog", async () => {
    state.permissions = ["loyalty"];
    expect((await Page()).props.canReadCatalog).toBe(false);
    expect(
      delegatedLinks(state.permissions).map((item) => item.segment),
    ).toEqual(["loyalty"]);
  });
});
