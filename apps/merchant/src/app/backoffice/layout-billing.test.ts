import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  access: "trial",
  guard: vi.fn(),
  read: vi.fn(),
}));
vi.mock("../../server/auth-guards", () => ({
  requireBackofficeSession: mocks.guard,
}));
vi.mock("../../server/billing-gate", () => ({
  readBusinessBilling: mocks.read,
}));
vi.mock("../../server/backoffice-initial-context", () => ({
  readBackofficeInitialCore: async () => {
    const guarded = await mocks.guard({ allowBlocked: true });
    return {
      version: 1,
      bootId: "fixture-boot",
      scopeKey: "a".repeat(64),
      userId: "fixture-user",
      emailVerified: true,
      business: guarded.business,
      membership: guarded.membership,
      billing: { access: mocks.access, trialEndsAt: null, trialDaysLeft: 10 },
    };
  },
}));
vi.mock("./backoffice-modules-seed", () => ({
  BackofficeModulesSeed: () => null,
}));
vi.mock("./backoffice-navigation", () => ({
  BackofficeNavigation: () => "Navegación del negocio",
}));
vi.mock("./onboarding/onboarding-checklist", () => ({
  OnboardingChecklist: () => "Checklist del negocio",
}));
vi.mock("./subscription/trial-notice", async () => {
  const { useBackofficeContext } = await import("./backoffice-context");
  return {
    TrialNotice: () =>
      useBackofficeContext().state.core?.billing.access === "trial"
        ? "Aviso de prueba"
        : null,
  };
});
import Layout from "./layout";

beforeEach(() => {
  mocks.guard.mockResolvedValue({
    business: { id: "business-1", name: "Café", status: "active" },
    membership: { role: "owner", permissions: [] },
  });
  mocks.read.mockImplementation(async () => ({ access: mocks.access }));
  mocks.guard.mockClear();
  mocks.read.mockClear();
});

for (const access of ["blocked", "trial", "subscribed"]) {
  it(`layout ${access}: respeta el acceso y conserva la puerta de suscripción`, async () => {
    mocks.access = access;
    const html = renderToStaticMarkup(
      await Layout({ children: "Suscripción" }),
    );
    expect(mocks.guard).toHaveBeenCalledWith({ allowBlocked: true });
    // Billing comes from the authorized initial constructor, without another DB reader.
    expect(mocks.read).not.toHaveBeenCalled();
    expect(html).toContain("Suscripción");
    if (access === "blocked") {
      expect(html).not.toContain("Navegación del negocio");
      expect(html).not.toContain("Checklist del negocio");
      expect(html).toContain("Cerrar sesión");
    } else {
      expect(html).toContain("Navegación del negocio");
      expect(html).toContain("Checklist del negocio");
    }
    expect(html.includes("Aviso de prueba")).toBe(access === "trial");
  });
}

it("la suspensión conserva prioridad sobre el bloqueo de cobro", async () => {
  mocks.access = "blocked";
  mocks.guard.mockResolvedValue({
    business: { id: "business-1", name: "Café", status: "suspended" },
    membership: { role: "owner", permissions: [] },
  });
  const html = renderToStaticMarkup(
    await Layout({ children: "Negocio suspendido" }),
  );
  expect(html).toContain("Negocio suspendido");
  expect(html).toContain("Navegación del negocio");
});
