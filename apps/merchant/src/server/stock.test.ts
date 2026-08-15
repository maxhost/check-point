import { afterEach, describe, expect, it, vi } from "vitest";
import { getStockProvider } from "./stock/provider";

const ORIGINAL = {
  provider: process.env.STOCK_PROVIDER,
  key: process.env.PEXELS_API_KEY,
};

afterEach(() => {
  vi.unstubAllGlobals();
  process.env.STOCK_PROVIDER = ORIGINAL.provider;
  process.env.PEXELS_API_KEY = ORIGINAL.key;
});

describe("getStockProvider", () => {
  it("selects the fake provider for dev/test and returns results", async () => {
    process.env.STOCK_PROVIDER = "fake";
    const provider = await getStockProvider();
    expect(provider.id).toBe("fake");
    const photos = await provider.search("café");
    expect(photos.length).toBeGreaterThan(0);
    expect(photos[0]).toHaveProperty("author");
    const resolved = await provider.resolve(photos[0].id);
    expect(resolved.bytes.byteLength).toBeGreaterThan(0);
    expect(resolved.author).toBeTruthy();
  });

  it("throws 503 when the provider name is unknown", async () => {
    process.env.STOCK_PROVIDER = "nope";
    await expect(getStockProvider()).rejects.toMatchObject({ status: 503 });
  });
});

describe("pexels provider (anti-SSRF)", () => {
  it("refuses to download an image from a non-allow-listed host", async () => {
    process.env.PEXELS_API_KEY = "test-key";
    // The Pexels API returns metadata pointing at an attacker-controlled host; the
    // provider must reject it before issuing any download fetch.
    const fetchMock = vi.fn(async (url: unknown) => {
      if (String(url).includes("api.pexels.com")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 1,
            src: { large2x: "https://169.254.169.254/latest/meta-data" },
            photographer: "X",
            photographer_url: "https://pexels.com/@x",
            url: "https://pexels.com/photo/1",
          }),
        };
      }
      throw new Error("must not fetch a non-allow-listed host");
    });
    vi.stubGlobal("fetch", fetchMock);
    const { pexelsProvider } = await import("./stock/pexels");
    await expect(pexelsProvider.resolve("1")).rejects.toMatchObject({
      status: 502,
    });
    // Only the metadata call happened; the download was never attempted.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("requires an API key (503) and a numeric photo id (422)", async () => {
    process.env.PEXELS_API_KEY = "";
    const { pexelsProvider } = await import("./stock/pexels");
    await expect(pexelsProvider.search("x")).rejects.toMatchObject({
      status: 503,
    });
    process.env.PEXELS_API_KEY = "test-key";
    await expect(pexelsProvider.resolve("not-a-number")).rejects.toMatchObject({
      status: 422,
    });
  });
});
