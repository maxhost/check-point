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
vi.mock("./brand-page", () => ({ default: () => null }));
import Page from "./page";
beforeEach(() => vi.clearAllMocks());
it("rechaza a staff sin brand", async () => {
  mocks.session.mockResolvedValue({
    membership: { role: "staff", permissions: ["counter"] },
  });
  await expect(Page()).rejects.toThrow("/backoffice");
});
it("staff con brand recibe ayudas sin onboarding ni afiche", async () => {
  mocks.session.mockResolvedValue({
    membership: { role: "staff", permissions: ["brand"] },
  });
  expect((await Page()).props).toEqual({ isOwner: false });
});
it("owner conserva orientación y afiche", async () => {
  mocks.session.mockResolvedValue({
    membership: { role: "owner", permissions: ["brand"] },
  });
  expect((await Page()).props).toEqual({ isOwner: true });
});
