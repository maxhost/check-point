import { describe, expect, it } from "vitest";
import type { ConsumerProgramSummary } from "../../../server/consumer/programs";
import { visiblePrograms } from "./programs-tab";

const base = {
  membershipId: "a",
  programStatus: "active",
} as ConsumerProgramSummary;

describe("programs tab filter", () => {
  const programs = [
    base,
    { ...base, membershipId: "b", programStatus: "closing" },
    { ...base, membershipId: "c", programStatus: "inactive" },
  ] as ConsumerProgramSummary[];
  it("hides closed programs by default", () =>
    expect(visiblePrograms(programs, false).map((p) => p.membershipId)).toEqual(
      ["a"],
    ));
  it("includes them when requested", () =>
    expect(visiblePrograms(programs, true)).toHaveLength(3));
});
