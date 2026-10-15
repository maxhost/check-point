import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModuleError } from "../../errors";
import { requireEntryPrices, requirePurchasePrice } from "./purchase-price";
import { routes } from "./routes";

const writers = vi.hoisted(() => ({
  purchase: vi.fn(),
  entry: vi.fn(),
  adjustment: vi.fn(),
}));
vi.mock("../movements", () => ({
  recordPurchase: writers.purchase,
  recordAdjustment: writers.adjustment,
  listMovements: vi.fn(),
}));
vi.mock("../entries", () => ({ recordEntry: writers.entry, listLog: vi.fn() }));
vi.mock("../items", () => ({
  createItem: vi.fn(),
  listItems: vi.fn(),
  updateItem: vi.fn(),
}));
vi.mock("../local", () => ({
  listLocations: vi.fn(),
  resolveLocation: vi.fn(),
}));
vi.mock("../draft", () => ({ buildDraft: vi.fn(), buildPhotoDraft: vi.fn() }));
vi.mock("../../../server/module-events", () => ({
  pendingSummary: vi.fn(),
  retryModuleEvents: vi.fn(),
}));

const context = (body: Record<string, unknown>) => ({
  request: new Request("https://example.test/api/modules/stock/entries", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }),
  business: { id: "business", currencyCode: "MXN", status: "active" },
  userId: "operator",
  params: { itemId: "flour" },
});
const handler = (path: string) =>
  routes.find((route) => route.method === "POST" && route.path === path)!
    .handler;

beforeEach(() => {
  vi.clearAllMocks();
  writers.purchase.mockResolvedValue({});
  writers.entry.mockResolvedValue({});
  writers.adjustment.mockResolvedValue({});
});

describe("presencia de precio en compras públicas", () => {
  it.each([undefined, null, "", " \t\n"])(
    "rechaza precio ausente %j con error422",
    (totalCost) => {
      try {
        requirePurchasePrice({ totalCost });
        expect.fail("Debe exigir un precio explícito");
      } catch (error) {
        expect(error).toBeInstanceOf(ModuleError);
        expect(error).toMatchObject({ status: 422, code: "price_required" });
      }
    },
  );
  it("identifica el índice de la línea sin precio", () => {
    expect(() =>
      requireEntryPrices({ lines: [{ totalCost: "0" }, {}] }),
    ).toThrow(
      expect.objectContaining({
        code: "price_required",
        extra: { line: 1 },
        message: expect.stringContaining("Línea 2"),
      }),
    );
  });
  it.each([0, "0", "0.00", "1.25"])(
    "conserva el precio explícito %j",
    (totalCost) => {
      const body = { totalCost };
      expect(() => requirePurchasePrice(body)).not.toThrow();
      expect(body.totalCost).toBe(totalCost);
      expect(() => requireEntryPrices({ lines: [body] })).not.toThrow();
    },
  );
  it("deja las validaciones de formato y payload al writer existente", () => {
    for (const totalCost of [false, {}, "-1", "abc"]) {
      expect(() => requirePurchasePrice({ totalCost })).not.toThrow();
    }
    expect(() => requireEntryPrices({})).not.toThrow();
    expect(() => requireEntryPrices({ lines: [null, 42, []] })).not.toThrow();
  });
});

describe("rutas rechazan antes de la escritura y del drenaje interno", () => {
  it.each([undefined, null, "", " "])(
    "compra suelta sin precio %j no llama al writer",
    async (totalCost) => {
      await expect(
        handler("items/:itemId/purchases")(
          context({ quantity: "1", totalCost }),
        ),
      ).rejects.toMatchObject({ status: 422, code: "price_required" });
      expect(writers.purchase).not.toHaveBeenCalled();
    },
  );
  it.each([undefined, null, "", " "])(
    "entrada sin precio %j no llama al writer",
    async (totalCost) => {
      await expect(
        handler("entries")(
          context({ lines: [{ totalCost: "5" }, { totalCost }] }),
        ),
      ).rejects.toMatchObject({
        status: 422,
        code: "price_required",
        extra: { line: 1 },
      });
      expect(writers.entry).not.toHaveBeenCalled();
    },
  );
  it("compra suelta con cero explícito reenvía el body y responde201", async () => {
    const body = { quantity: "1000", totalCost: 0, locationId: "local" };
    const response = await handler("items/:itemId/purchases")(context(body));
    expect(response.status).toBe(201);
    expect(writers.purchase).toHaveBeenCalledWith(
      "business",
      "operator",
      "flour",
      body,
    );
  });
  it("entrada con cero explícito reenvía todas las líneas y responde201", async () => {
    const body = {
      locationId: "local",
      lines: [
        { itemId: "flour", quantity: "1000", unit: "g", totalCost: "0.00" },
      ],
    };
    const response = await handler("entries")(context(body));
    expect(response.status).toBe(201);
    expect(writers.entry).toHaveBeenCalledWith("business", "operator", body);
  });
  it("el conteo continúa sin campo de precio", async () => {
    const body = { locationId: "local", countedQuantity: "0.000" };
    const response = await handler("items/:itemId/adjustments")(context(body));
    expect(response.status).toBe(201);
    expect(writers.adjustment).toHaveBeenCalledWith(
      "business",
      "operator",
      "flour",
      body,
    );
  });
});
