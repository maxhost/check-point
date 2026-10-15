import { afterEach, expect, it, vi } from "vitest";
import { requestBrand, BrandRequestError, isBrand } from "./brand-api";
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

it("requires the private fiscal DTO, canonical rates and a consistent complete state", () => {
  const brand = {
    id: "brand-1",
    name: "Marca",
    timezone: "America/Guayaquil",
    currencyCode: "USD",
    brandPrimaryColor: "#123ABC",
    brandComplementaryColor: "#BADA55",
    brandAccentColor: "#F0F0F0",
    brandRevision: 1,
    logoVersion: 0,
    logoPath: null,
    chargesVat: false,
    saleVatRate: null,
    recoversPurchaseVat: false,
  };
  expect(isBrand(brand)).toBe(true);
  expect(isBrand({ ...brand, chargesVat: true, saleVatRate: "0.00" })).toBe(
    true,
  );
  expect(isBrand({ ...brand, chargesVat: true, saleVatRate: "100.00" })).toBe(
    true,
  );
  for (const patch of [
    { chargesVat: true },
    { chargesVat: "false" },
    { recoversPurchaseVat: 1 },
    { saleVatRate: undefined },
    { saleVatRate: 15 },
    { saleVatRate: "15" },
    { saleVatRate: "0015.00" },
    { saleVatRate: "100.01" },
  ])
    expect(isBrand({ ...brand, ...patch })).toBe(false);
});
