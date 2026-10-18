import { describe, expect, it } from "vitest";
import type {
  BackofficeInitialContext,
  ModuleDTO,
} from "../../backoffice-context-contract";
import {
  createBackofficeRefreshState,
  confirmBackofficeCore,
  confirmBackofficeModules,
  confirmBackofficeModuleGate,
  beginBackofficeRefresh,
  acknowledgeBackofficeRefresh,
  failBackofficeRefresh,
} from "./backoffice-context-refresh";
const core: BackofficeInitialContext = {
  version: 1,
  bootId: "initial",
  scopeKey: "a".repeat(64),
  userId: "user",
  emailVerified: true,
  business: {
    id: "business",
    name: "Fixture",
    status: "active",
    timezone: "UTC",
    currencyCode: "USD",
  },
  membership: {
    role: "owner",
    status: "active",
    permissions: ["business", "analytics"],
  },
  billing: { access: "trial", trialDaysLeft: 10, trialEndsAt: null },
};
const module: ModuleDTO = {
  id: "stock",
  name: "Stock",
  description: "Fixture",
  enabled: true,
  suggested: false,
  requires: [],
  navigation: [],
  permissions: [],
};
describe("0238 pure structural refresh demand", () => {
  it("seed baseline and first module observation never request refresh", () => {
    const state = confirmBackofficeModules(createBackofficeRefreshState(core), [
      module,
    ]);
    expect(state.revision).toBe(0);
    expect(beginBackofficeRefresh(state)).toBe(state);
  });
  it("normalizes permission/module ordering and ignores rolling presentation fields", () => {
    let state = confirmBackofficeModules(createBackofficeRefreshState(core), [
      module,
      { ...module, id: "other" },
    ]);
    state = confirmBackofficeCore(state, {
      ...core,
      bootId: "new",
      emailVerified: false,
      business: { ...core.business, name: "Renamed" },
      membership: {
        ...core.membership,
        permissions: ["analytics", "business", "business"],
      },
      billing: { ...core.billing, trialDaysLeft: 9 },
    });
    state = confirmBackofficeModules(state, [
      { ...module, id: "other" },
      { ...module, name: "Renamed", suggested: true },
    ]);
    expect(state.revision).toBe(0);
  });
  it.each(["role", "permissions", "businessStatus", "billing"])(
    "confirmed %s change demands once, never per ordinary read",
    (field) => {
      const initial = createBackofficeRefreshState(core);
      const changed = {
        ...core,
        membership: { ...core.membership },
        business: { ...core.business },
        billing: { ...core.billing },
      };
      if (field === "role") changed.membership.role = "staff";
      if (field === "permissions") changed.membership.permissions = [];
      if (field === "businessStatus") changed.business.status = "suspended";
      if (field === "billing") changed.billing.access = "subscribed";
      const state = confirmBackofficeCore(initial, changed);
      expect(state.revision).toBe(1);
      expect(confirmBackofficeCore(state, changed)).toBe(state);
    },
  );
  it("records issued demand before refresh and coalesces latest revision during flight, including A→B→A", () => {
    let state = confirmBackofficeModules(createBackofficeRefreshState(core), [
      module,
    ]);
    state = confirmBackofficeModules(state, [{ ...module, enabled: false }]);
    state = beginBackofficeRefresh(state);
    expect(state).toMatchObject({
      revision: 1,
      issuedRevision: 1,
      inFlight: true,
    });
    state = confirmBackofficeModules(state, [module]);
    state = confirmBackofficeModules(state, [{ ...module, enabled: false }]);
    expect(state.revision).toBe(3);
    expect(beginBackofficeRefresh(state)).toBe(state);
    state = acknowledgeBackofficeRefresh(state);
    state = beginBackofficeRefresh(state);
    expect(state).toMatchObject({
      issuedRevision: 3,
      acknowledgedRevision: 1,
      inFlight: true,
    });
    state = acknowledgeBackofficeRefresh(state);
    expect(beginBackofficeRefresh(state)).toBe(state);
  });
  it("boot acknowledgement alone creates no structural demand", () => {
    const state = createBackofficeRefreshState(core);
    expect(acknowledgeBackofficeRefresh(state)).toBe(state);
    expect(beginBackofficeRefresh(state)).toBe(state);
  });
  it("only confirmed PIN gate transitions demand refresh; email403 and repeat PIN do not loop", () => {
    let state = createBackofficeRefreshState(core);
    state = confirmBackofficeModuleGate(state, "email_not_verified");
    expect(state.revision).toBe(0);
    state = confirmBackofficeModuleGate(state, "pin_change_required");
    expect(state.revision).toBe(1);
    expect(confirmBackofficeModuleGate(state, "pin_change_required")).toBe(
      state,
    );
    state = confirmBackofficeModules(state, [module]);
    state = confirmBackofficeModuleGate(state, "pin_change_required");
    expect(state.revision).toBe(2);
  });
  it("synchronous router failure leaves demand pending for a later intentional attempt", () => {
    let state = confirmBackofficeCore(createBackofficeRefreshState(core), {
      ...core,
      billing: { ...core.billing, access: "subscribed" },
    });
    state = beginBackofficeRefresh(state);
    state = failBackofficeRefresh(state);
    expect(state.inFlight).toBe(false);
    expect(beginBackofficeRefresh(state)).toMatchObject({
      inFlight: true,
      issuedRevision: 1,
      acknowledgedRevision: 0,
    });
  });
});
