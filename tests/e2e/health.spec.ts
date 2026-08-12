import { expect, test } from "@playwright/test";

const services = [
  { name: "consumer", url: "http://127.0.0.1:3000/api/health" },
  { name: "merchant", url: "http://127.0.0.1:3001/api/health" },
  { name: "platform", url: "http://127.0.0.1:3002/api/health" },
] as const;

for (const service of services) {
  test(`${service.name} exposes its health contract`, async ({ request }) => {
    const response = await request.get(service.url);

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      service: service.name,
      status: "ok",
    });
  });
}
