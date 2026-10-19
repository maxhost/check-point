import { describe, expect, it } from "vitest";
import { MODULES } from "../modules/registry";
import { moduleNavigation } from "../modules/navigation";

// 0242: the removed Counter gate is superseded by the current editor's location
// tests. The core now offers only the enabled, authorized module surface, keeping
// the compatibility permission for Clientes independent of operational access.
const operation = MODULES.find(
  (module) => module.operation && module.startPage,
)!;
function links(enabled: boolean, permissions: string[], isOwner = false) {
  return moduleNavigation([{ ...operation, enabled }], {
    isOwner,
    permissions,
  });
}
describe("authorized operation surface after Counter retirement", () => {
  it("does not infer operation access from the Clientes permission", () => {
    expect(links(true, ["counter"])).toEqual([]);
  });
  it("does not expose a disabled operation even to its owner", () => {
    expect(links(false, [operation.startPage!.permission])).toEqual([]);
    expect(links(false, [], true)).toEqual([]);
  });
  it("offers the declared operational navigation to authorized staff", () => {
    expect(links(true, [operation.startPage!.permission])).toMatchObject([
      { moduleId: operation.id, permission: operation.startPage!.permission },
    ]);
  });
  it("keeps Clientes compatible without adding operation permission", () => {
    const permissions = ["counter"];
    links(true, permissions);
    expect(permissions).toEqual(["counter"]);
  });
});
