import { expect, test } from "@playwright/test";
import { consumerURL, merchantURL, platformURL } from "./support/ports";

const services = [
  { name: "consumer", url: `${consumerURL}/api/health` },
  { name: "merchant", url: `${merchantURL}/api/health` },
  { name: "platform", url: `${platformURL}/api/health` },
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
