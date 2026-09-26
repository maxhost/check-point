import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(path);
  }),
}));
vi.mock("../../../server/auth-guards", () => ({
  requireBackofficeSession: mocks.session,
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("./catalog-page", () => ({ default: () => null }));
import Page from "./page";
beforeEach(() => vi.clearAllMocks());
it("rechaza a un integrante sin catalog", async () => {
  mocks.session.mockResolvedValue({
    membership: { role: "staff", permissions: ["counter"] },
  });
  await expect(Page()).rejects.toThrow("/backoffice");
});
it("staff autorizado recibe ayuda pero no borrado ni onboarding persistido", async () => {
  mocks.session.mockResolvedValue({
    membership: { role: "staff", permissions: ["catalog"] },
  });
  const page = await Page();
  expect(page.props).toEqual({ canDelete: false, isOwner: false });
});
it("owner recibe el onboarding y borrado", async () => {
  mocks.session.mockResolvedValue({
    membership: { role: "owner", permissions: ["catalog"] },
  });
  const page = await Page();
  expect(page.props).toEqual({ canDelete: true, isOwner: true });
});
