import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";
import { GET as robots } from "../app/robots.txt/route";

/**
 * Spec 0218 — el CABLEADO de la tercera audiencia: `proxy.ts` (reescritura, 308 y
 * `X-Robots-Tag`) y `robots.txt` por host. La decision pura esta en `hosts-staff.test.ts`.
 */

const ENV = {
  MERCHANT_ORIGIN: "https://business.checkpass.club",
  CONSUMER_ORIGIN: "https://my.checkpass.club",
  STAFF_ORIGIN: "https://staff.checkpass.club",
};
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const [key, value] of Object.entries(ENV)) {
    saved[key] = process.env[key];
    process.env[key] = value;
  }
});
afterEach(() => {
  for (const key of Object.keys(ENV)) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

function request(host: string, path: string) {
  return new NextRequest(new URL(path, `https://${host}`), {
    headers: { host },
  });
}

describe("proxy — host staff.", () => {
  it("`/` se reescribe a /acceso-equipo y lleva noindex", () => {
    const response = proxy(request("staff.checkpass.club", "/?e=x"));
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://staff.checkpass.club/acceso-equipo?e=x",
    );
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("el panel sigue y lleva noindex", () => {
    const response = proxy(
      request("staff.checkpass.club", "/backoffice/counter"),
    );
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("una pagina del dueño → 308 a business., tambien con noindex", () => {
    const response = proxy(
      request("staff.checkpass.club", "/es/business/onboarding"),
    );
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://business.checkpass.club/es/business/onboarding",
    );
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});

describe("proxy — los otros hosts no llevan noindex", () => {
  it("business. /acceso-equipo → 308 a la portada de staff.", () => {
    const response = proxy(
      request("business.checkpass.club", "/acceso-equipo?cambiar-pin=1"),
    );
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://staff.checkpass.club/?cambiar-pin=1",
    );
    expect(response.headers.get("x-robots-tag")).toBeNull();
  });

  it("business. / sigue, sin noindex", () => {
    const response = proxy(request("business.checkpass.club", "/"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-robots-tag")).toBeNull();
  });

  it("sin STAFF_ORIGIN, staff. no lleva noindex ni se reescribe", () => {
    delete process.env.STAFF_ORIGIN;
    const response = proxy(request("staff.checkpass.club", "/"));
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("x-robots-tag")).toBeNull();
  });
});

describe("robots.txt por host", () => {
  const read = async (host: string) => {
    const response = robots(
      new Request(`https://${host}/robots.txt`, { headers: { host } }),
    );
    expect(response.headers.get("content-type")).toContain("text/plain");
    return response.text();
  };

  it("staff. prohibe todo", async () => {
    expect(await read("staff.checkpass.club")).toBe(
      "User-agent: *\nDisallow: /\n",
    );
  });

  it.each(["business.checkpass.club", "my.checkpass.club", "localhost:3000"])(
    "%s permite todo",
    async (host) => {
      expect(await read(host)).toBe("User-agent: *\nAllow: /\n");
    },
  );
});
