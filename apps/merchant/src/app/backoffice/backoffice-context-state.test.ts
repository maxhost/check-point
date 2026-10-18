import { describe, expect, it } from "vitest";
import type {
  BackofficeInitialContext,
  BackofficeModulesResult,
  BackofficeModulesSeed,
  ModuleDTO,
} from "../../backoffice-context-contract";
import {
  applyBackofficeModulesSeed,
  backofficeResources,
  captureBackofficeTicket,
  createBackofficeContextState,
  invalidateBackofficeResources,
  isBackofficeTicketCurrent,
  observeBackofficeCoreSeed,
  retireBackofficeContext,
} from "./backoffice-context-state";

const core: BackofficeInitialContext = {
  version: 1,
  bootId: "boot-initial",
  scopeKey: "a".repeat(64),
  userId: "synthetic-user",
  emailVerified: true,
  business: {
    id: "synthetic-business",
    name: "Fixture",
    status: "active",
    timezone: "UTC",
    currencyCode: "USD",
  },
  membership: { role: "owner", status: "active", permissions: ["analytics"] },
  billing: { access: "trial", trialEndsAt: null, trialDaysLeft: 10 },
};
const module: ModuleDTO = {
  id: "synthetic-module",
  name: "Fixture module",
  description: "Synthetic",
  requires: [],
  enabled: true,
  suggested: false,
  navigation: [],
  permissions: [],
};
const seed = (result: BackofficeModulesResult): BackofficeModulesSeed => ({
  bootId: core.bootId,
  scopeKey: core.scopeKey,
  result,
});

describe("0238 provider state and causal seed tickets", () => {
  it("exposes core immediately while modules remain loading", () => {
    const state = createBackofficeContextState(core);
    expect(state.core).toEqual(core);
    expect(state.modules).toEqual({ state: "loading" });
    expect(state.revalidationBootId).toBeNull();
    expect(captureBackofficeTicket(state, "inbox")).toMatchObject({
      scopeKey: core.scopeKey,
      epoch: 0,
      generation: 0,
    });
  });

  it.each<BackofficeModulesResult>([
    { state: "ready", modules: [module] },
    { state: "ready", modules: [] },
    { state: "restricted" },
    { state: "unavailable" },
  ])(
    "keeps streamed result $state distinct and closes its seed ticket",
    (result) => {
      const state = applyBackofficeModulesSeed(
        createBackofficeContextState(core),
        seed(result),
      );
      expect(state.modules).toEqual(result);
      expect(state.core).toEqual(core);
      expect(state.initialModulesTicket).toBeNull();
      expect(
        applyBackofficeModulesSeed(state, seed({ state: "restricted" })),
      ).toBe(state);
    },
  );

  it.each([{ bootId: "boot-obsolete" }, { scopeKey: "b".repeat(64) }])(
    "rejects a different boot/scope seed without installing it: %j",
    (changed) => {
      const state = createBackofficeContextState(core);
      expect(
        applyBackofficeModulesSeed(state, {
          ...seed({ state: "ready", modules: [module] }),
          ...changed,
        }),
      ).toBe(state);
      expect(state.modules.state).toBe("loading");
    },
  );

  it("invalidates before mutation and never reuses the earlier generation", () => {
    const initial = createBackofficeContextState(core);
    const ticket = captureBackofficeTicket(initial, "inbox")!;
    const state = invalidateBackofficeResources(initial, ["inbox", "inbox"]);
    expect(initial.generations.inbox).toBe(0);
    expect(state.generations.inbox).toBe(1);
    expect(isBackofficeTicketCurrent(state, ticket)).toBe(false);
    expect(captureBackofficeTicket(state, "inbox")?.generation).toBe(1);
    expect(state.core).toEqual(core);
    expect(
      applyBackofficeModulesSeed(
        state,
        seed({ state: "ready", modules: [module] }),
      ),
    ).toBe(state);
  });

  it("rejects a seed after its modules generation is invalidated", () => {
    const state = invalidateBackofficeResources(
      createBackofficeContextState(core),
      ["modules"],
    );
    expect(
      applyBackofficeModulesSeed(
        state,
        seed({ state: "ready", modules: [module] }),
      ),
    ).toBe(state);
    expect(state.modules.state).toBe("loading");
  });

  it("same-scope RSC signals revalidation once per boot without replacing live core", () => {
    const initial = createBackofficeContextState(core);
    const incoming: BackofficeInitialContext = {
      ...core,
      bootId: "boot-refresh",
      business: { ...core.business, name: "Potentially stale RSC name" },
      membership: { ...core.membership, permissions: [] },
    };
    const state = observeBackofficeCoreSeed(initial, incoming);
    expect(state.core).toBe(core);
    expect(state.revalidationBootId).toBe(incoming.bootId);
    expect(state.initialModulesTicket).toBeNull();
    expect(observeBackofficeCoreSeed(state, incoming)).toBe(state);
    expect(observeBackofficeCoreSeed(state, core)).toBe(state);
    expect(
      applyBackofficeModulesSeed(
        state,
        seed({ state: "ready", modules: [module] }),
      ),
    ).toBe(state);
  });

  it.each([
    { userId: "other-user" },
    { business: { ...core.business, id: "other-business" } },
    { scopeKey: "c".repeat(64) },
  ])(
    "withdraws all private data for an observed different identity/session: %j",
    (changed) => {
      const initial = applyBackofficeModulesSeed(
        createBackofficeContextState(core),
        seed({ state: "ready", modules: [module] }),
      );
      const oldTicket = captureBackofficeTicket(initial, "inbox")!;
      const state = observeBackofficeCoreSeed(initial, { ...core, ...changed });
      expect(state.core).toBeNull();
      expect(state.modules).toEqual({ state: "restricted" });
      expect(state.epoch).toBe(1);
      expect(isBackofficeTicketCurrent(state, oldTicket)).toBe(false);
      for (const resource of backofficeResources)
        expect(captureBackofficeTicket(state, resource)).toBeNull();
      expect(observeBackofficeCoreSeed(state, core)).toBe(state);
      expect(
        applyBackofficeModulesSeed(
          state,
          seed({ state: "ready", modules: [module] }),
        ),
      ).toBe(state);
    },
  );

  it("retires once per epoch and a later seed cannot revive the document", () => {
    const state = retireBackofficeContext(createBackofficeContextState(core));
    expect(retireBackofficeContext(state)).toBe(state);
    expect(
      observeBackofficeCoreSeed(state, { ...core, bootId: "new-boot" }),
    ).toBe(state);
    expect(invalidateBackofficeResources(state, ["inbox"])).toBe(state);
  });
});
