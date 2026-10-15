import { beforeEach, describe, expect, it, vi } from "vitest";
import { routes } from "./routes";

const reads = vi.hoisted(() => ({
  location: vi.fn(),
  retry: vi.fn(),
  pending: vi.fn(),
  items: vi.fn(),
  movements: vi.fn(),
  log: vi.fn(),
}));
vi.mock("../local", () => ({
  listLocations: vi.fn(),
  resolveLocation: reads.location,
}));
vi.mock("../../../server/module-events", () => ({
  pendingSummary: reads.pending,
  retryModuleEvents: reads.retry,
}));
vi.mock("../items", () => ({
  createItem: vi.fn(),
  updateItem: vi.fn(),
  listItems: reads.items,
}));
vi.mock("../movements", () => ({
  recordPurchase: vi.fn(),
  recordAdjustment: vi.fn(),
  listMovements: reads.movements,
}));
vi.mock("../entries", () => ({
  recordEntry: vi.fn(),
  listLog: reads.log,
}));
vi.mock("../draft", () => ({
  buildDraft: vi.fn(),
  buildPhotoDraft: vi.fn(),
}));

const pending = { count: 3, failed: 1 };
const cases = [
  {
    path: "items",
    key: "items",
    reader: reads.items,
    data: [{ id: "flour", name: "Harina" }],
    args: ["business", "all", "local"],
  },
  {
    path: "items/:itemId/movements",
    key: "movements",
    reader: reads.movements,
    data: [{ id: "purchase", quantity: "7.500" }],
    args: ["business", "flour", "17", "local"],
  },
  {
    path: "movements",
    key: "movements",
    reader: reads.log,
    data: [{ id: "log", quantity: "7.500" }],
    args: ["business", "17", "local"],
  },
] as const;
const call = (path: string) =>
  routes
    .find((route) => route.method === "GET" && route.path === path)!
    .handler({
      request: new Request(
        "https://example.test/api/modules/stock?locationId=local&status=all&limit=17",
      ),
      business: { id: "business", currencyCode: "MXN", status: "active" },
      userId: "operator",
      params: { itemId: "flour" },
    });

beforeEach(() => {
  vi.clearAllMocks();
  reads.location.mockResolvedValue({ id: "local" });
  reads.retry.mockResolvedValue({
    claimed: 0,
    applied: 0,
    pending: 0,
    failed: 0,
  });
  reads.pending.mockResolvedValue(pending);
  for (const { reader, data } of cases) reader.mockResolvedValue(data);
});

describe.each(cases)("Stock GET $path", ({ path, key, reader, args, data }) => {
  it("conserva datos y pendientes reales cuando falla el intento de acelerar consumos", async () => {
    reads.retry.mockRejectedValue(new Error("Retry budget exhausted"));
    const response = await call(path);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      locationId: "local",
      pending,
      [key]: data,
    });
    expect(reader).toHaveBeenCalledExactlyOnceWith(...args);
    expect(reads.location).toHaveBeenCalledExactlyOnceWith("business", "local");
    expect(reads.retry).toHaveBeenCalledExactlyOnceWith({
      businessId: "business",
      locationId: "local",
      budgetMs: 1000,
    });
    expect(reads.pending).toHaveBeenCalledExactlyOnceWith("business", "local");
  });

  it("propaga el fallo de leer pendientes sin convertirlo en cero ni llamar al lector", async () => {
    const error = new Error("Pending reader unavailable");
    reads.pending.mockRejectedValue(error);
    await expect(call(path)).rejects.toBe(error);
    expect(reader).not.toHaveBeenCalled();
  });

  it("propaga el fallo del lector de datos", async () => {
    const error = new Error("Data reader unavailable");
    reader.mockRejectedValue(error);
    await expect(call(path)).rejects.toBe(error);
  });
});

it("no oculta errores al resolver el local ni intenta acelerar otro local", async () => {
  const error = new Error("Location reader unavailable");
  reads.location.mockRejectedValue(error);
  await expect(call("items")).rejects.toBe(error);
  expect(reads.retry).not.toHaveBeenCalled();
  expect(reads.pending).not.toHaveBeenCalled();
});
