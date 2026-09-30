import { expect, it, vi } from "vitest";

const { requireBackofficeSession, redirect, getDb } = vi.hoisted(() => ({
  requireBackofficeSession: vi.fn(),
  redirect: vi.fn((destination: string) => {
    throw new Error(`REDIRECT:${destination}`);
  }),
  getDb: vi.fn(),
}));
vi.mock("../../../server/auth-guards", () => ({ requireBackofficeSession }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@mi-pasaporte/db", () => ({ getDb }));
vi.mock("./customers-page", () => ({ CustomersPage: () => null }));

const { default: Page } = await import("./page");

it("rechaza al personal sin counter antes de consultar el negocio", async () => {
  requireBackofficeSession.mockResolvedValue({
    business: { id: "business-1" },
    membership: { role: "staff", permissions: ["marketing"] },
  });
  await expect(Page()).rejects.toThrow("REDIRECT:/backoffice");
  expect(getDb).not.toHaveBeenCalled();
});

it("abre el listado al personal con counter", async () => {
  requireBackofficeSession.mockResolvedValue({
    business: { id: "business-1" },
    membership: { role: "staff", permissions: ["counter"] },
  });
  const limit = vi.fn().mockResolvedValue([{ countryCode: "EC" }]);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  getDb.mockReturnValue({ select: () => ({ from }) });
  await expect(Page()).resolves.toBeDefined();
  expect(where).toHaveBeenCalled();
});
