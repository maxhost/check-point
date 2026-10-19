import { describe, it, expect, vi } from "vitest";
import {
  MeasuredEditorSession,
  measuredEditorAmounts,
} from "./measured-editor-model";
import { PosCache } from "./pos-cache";
import { createPosClient } from "./pos-context";
import {
  editorCatalog,
  editorOrder,
} from "../../../../../../tests/e2e/support/pos-measured-editor-fixture";
import { existingCartLine, newCartLine } from "./measured-cart-model";
import { PosError } from "./pos-types";
const context = {
  identity: "a",
  locations: [{ id: "north", name: "North" }],
  currencyCode: "USD",
  saleTypes: ["counter", "pickup"] as ("counter" | "pickup")[],
  tablesEnabled: false,
};
function setup(order: typeof editorOrder | null = null) {
  const client = createPosClient(() => ({ identity: "a" }), {
    contractVersion: 2,
  });
  const session = new MeasuredEditorSession(
    context,
    new PosCache(undefined, client.request),
    client,
    order,
  );
  session.catalog = editorCatalog;
  return session;
}
describe("measured editor owner", () => {
  it("inicializa los datos elegidos en el modal sin ensuciar el borrador ni sobrescribir un pedido existente", () => {
    const configured = {
      ...context,
      initialSaleType: "pickup" as const,
      initialIdentification: { tableId: null, orderLabel: "Ana" },
    };
    const { client, cache } = setup();
    const fresh = new MeasuredEditorSession(configured, cache, client);
    expect(fresh.draft).toMatchObject({
      saleType: "pickup",
      orderLabel: "Ana",
      tableId: null,
      locationId: "north",
    });
    expect(fresh.dirty).toBe(false);
    const existing = new MeasuredEditorSession(
      configured,
      cache,
      client,
      editorOrder,
    );
    expect(existing.draft.saleType).toBe(editorOrder.saleType);
    expect(existing.draft.orderLabel).toBe(editorOrder.orderLabel);
    expect(existing.draft.tableId).toBe(editorOrder.tableId);
    expect(existing.dirty).toBe(false);
  });

  it("distribuye dos líneas COP0.49 con el mismo kernel del total global", () => {
    const lines = ["a", "b"].map((key) =>
      newCartLine(
        { ...editorCatalog.products[0], unitPrice: "0.49" },
        key,
        { source: null, unit: "unit", buffer: "1", edited: true },
        ["kg", "lb"],
      ),
    );
    expect(measuredEditorAmounts(lines, ["kg", "lb"], "COP")).toEqual({
      total: "1",
      lineAmounts: { a: "1", b: "0" },
    });
  });

  it("conserva el manager e impide abandonar una creación incierta", async () => {
    const session = setup();
    vi.spyOn(session.client, "capture").mockReturnValue(async () => {
      throw new Error("lost");
    });
    session.change({
      lines: [
        newCartLine(
          editorCatalog.products[0],
          "new",
          { source: null, unit: "unit", buffer: "1", edited: true },
          ["kg", "lb"],
        ),
      ],
    });
    await session.save(true);
    const manager = session.commands;
    const intent = manager.getSnapshot();
    expect(intent.status).toBe("uncertain");
    expect(session.requestExit(true)).toBe(false);
    session.change({ note: "cannot edit frozen intent" });
    expect(session.draft.note).toBe("");
    expect(session.commands).toBe(manager);
    expect(session.commands.getSnapshot()).toBe(intent);
  });
  it("revisión de versión conserva borrador, IDs y snapshots sin retry", async () => {
    const session = setup(editorOrder);
    session.change({ note: "my note" });
    const capture = vi
      .spyOn(session.client, "capture")
      .mockReturnValue(async () => {
        throw new PosError(
          "conflict",
          "version_conflict",
          undefined,
          undefined,
          409,
          { order: { ...editorOrder, version: 2, note: "other" } },
        );
      });
    await session.save();
    expect(session.conflict).not.toBeNull();
    session.reviewVersion();
    expect(capture).toHaveBeenCalledTimes(1);
    expect(session.draft.note).toBe("my note");
    expect(session.order?.version).toBe(2);
    expect(session.draft.lines[0]).toEqual(
      existingCartLine(editorOrder.items[0]),
    );
  });
  it("el cambio real de identidad retira permanentemente", () => {
    const session = setup();
    session.retireIdentity();
    expect(session.requestExit(true)).toBe(false);
    expect(session.commands.getSnapshot().status).toBe("retired");
  });
});
