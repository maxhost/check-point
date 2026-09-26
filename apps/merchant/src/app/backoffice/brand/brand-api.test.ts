import { afterEach, expect, it, vi } from "vitest";
import { requestBrand, BrandRequestError } from "./brand-api";
afterEach(() => vi.unstubAllGlobals());
it("rechazo conserva status y mensaje sin inventar code", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ error: "Conflicto" }, { status: 409 })),
  );
  await expect(requestBrand({ method: "PUT" })).rejects.toMatchObject({
    status: 409,
    message: "Conflicto",
    uncertain: false,
  });
});
it("una respuesta perdida al PUT es resultado desconocido", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("network");
    }),
  );
  await expect(requestBrand({ method: "PUT" })).rejects.toMatchObject({
    uncertain: true,
    status: 0,
  });
});
it("éxito sin DTO no confirma guardado", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ id: "incompleto" })),
  );
  await expect(requestBrand({ method: "PUT" })).rejects.toBeInstanceOf(
    BrandRequestError,
  );
});
it("GET no JSON permite presentar error de lectura", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("error", { status: 500 })),
  );
  await expect(requestBrand()).rejects.toMatchObject({
    status: 500,
    uncertain: false,
  });
});
