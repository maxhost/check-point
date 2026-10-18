import { describe, expect, it } from "vitest";
import { coherentRevisions, reconcileDraft } from "./settings-drafts";
describe("authoritative settings reconciliation", () => {
  it("adopts untouched remote fields, preserves edits, identifies overlapping changes", () => {
    const base = {
      timezone: "Quito",
      currency: "USD",
      rate: "15",
      revision: 1,
    };
    const result = reconcileDraft(
      base,
      { ...base, timezone: "Lima", rate: "19" },
      { timezone: "Bogotá", currency: "EUR", rate: "19", revision: 5 },
    );
    expect(result.draft).toEqual({
      timezone: "Lima",
      currency: "EUR",
      rate: "19",
      revision: 5,
    });
    expect(result.overlaps).toEqual(["timezone"]);
  });
  it("compares array content and advances baseline without overwriting local selection", () => {
    const base = { salesMassUnits: ["kg"], revision: 1 };
    const remote = { salesMassUnits: ["g"], revision: 3 };
    expect(
      reconcileDraft(base, { ...base, salesMassUnits: ["kg"] }, remote).draft,
    ).toEqual(remote);
    const local = reconcileDraft(
      base,
      { ...base, salesMassUnits: ["kg", "lb"] },
      remote,
    );
    expect(local.overlaps).toEqual(["salesMassUnits"]);
    expect(
      reconcileDraft(remote, local.draft, { ...remote, revision: 4 }).draft
        .salesMassUnits,
    ).toEqual(["kg", "lb"]);
  });
  it("rejects mixed authoritative revisions rather than taking a maximum", () => {
    expect(
      coherentRevisions({ revision: 2 }, { revision: 3 }, { revision: 3 }),
    ).toBe(false);
    expect(
      coherentRevisions({ revision: 3 }, { revision: 3 }, { revision: 3 }),
    ).toBe(true);
  });
});
