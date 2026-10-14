import { describe, expect, it } from "vitest";
import { reserve, assertScope, assertRetirable, type Task } from "./factory";

const task: Task = {
  id: "stock",
  worktree: "/tmp/pilot-stock",
  base: "base",
  paths: ["apps/merchant/src/modules/stock/ui"],
  resources: ["port:43100"],
  state: "reserved",
};
describe("factory reservations and release", () => {
  it("rejects overlapping parent paths and resource collisions", () => {
    expect(() =>
      reserve([task], {
        ...task,
        id: "other",
        worktree: "/tmp/other",
        paths: ["apps/merchant/src/modules/stock"],
      }),
    ).toThrow("Paths overlap");
    expect(() =>
      reserve([task], {
        ...task,
        id: "recipes",
        worktree: "/tmp/recipes",
        paths: ["apps/merchant/src/modules/recipes/ui"],
      }),
    ).toThrow("Resources overlap");
    expect(
      reserve([task], {
        ...task,
        id: "recipes",
        worktree: "/tmp/recipes",
        paths: ["apps/merchant/src/modules/recipes/ui"],
        resources: ["port:43101"],
      }),
    ).toHaveLength(2);
  });
  it("rejects escaping scope and delivery outside its module", () => {
    expect(() => reserve([], { ...task, paths: ["../server"] })).toThrow(
      "explicit relative",
    );
    expect(() =>
      assertScope(task, ["apps/merchant/src/modules/stock/ui/photo.tsx"]),
    ).not.toThrow();
    expect(() =>
      assertScope(task, ["apps/merchant/src/modules/stock/ui-other/photo.tsx"]),
    ).toThrow("Outside task scope");
  });
  it("cannot retire pending, dirty or unintegrated work", () => {
    expect(() => assertRetirable(task, true, true)).toThrow("Cleanup requires");
    const integrated: Task = { ...task, state: "integrated", sha: "accepted" };
    expect(() => assertRetirable(integrated, false, true)).toThrow();
    expect(() => assertRetirable(integrated, true, false)).toThrow();
    expect(() =>
      assertRetirable(integrated, true, true, "later-commit"),
    ).toThrow();
    expect(() => assertRetirable(integrated, true, true)).not.toThrow();
  });
});
