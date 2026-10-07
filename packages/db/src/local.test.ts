import { createHash } from "node:crypto";
import { neonConfig } from "@neondatabase/serverless";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertNotProdOutsideProduction,
  configureNeonForLocal,
  isLocalDbHost,
  neonEndpointId,
  PROD_DB_ENDPOINT_SHA12,
} from "./local";

// Host ficticio con la forma de los de Neon: nunca el host real de PROD (spec 0167).
const FAKE = "ep-x-y-123.c-1.region.aws.neon.tech";
const variants = [
  FAKE,
  "ep-x-y-123-pooler.c-1.region.aws.neon.tech",
  "ep-x-y-123-rvr.c-1.region.aws.neon.tech",
  "ep-x-y-123-rvr-pooler.c-1.region.aws.neon.tech",
];
const url = (host: string) => `postgresql://u:p@${host}/neondb?sslmode=require`;
const fakeSha12 = createHash("sha256")
  .update("ep-x-y-123")
  .digest("hex")
  .slice(0, 12);
const LOCAL_URLS = [
  "db.localtest.me:5432",
  "localhost:5432",
  "127.0.0.1:55432",
].map(url);

describe("isLocalDbHost", () => {
  it("es verdadero solo para los tres hosts locales", () => {
    for (const u of LOCAL_URLS) expect(isLocalDbHost(u), u).toBe(true);
    for (const h of variants) expect(isLocalDbHost(url(h)), h).toBe(false);
    expect(isLocalDbHost(url("localhost.evil.example"))).toBe(false);
    expect(isLocalDbHost(url("db.localtest.me.neon.tech"))).toBe(false);
  });
});

describe("configureNeonForLocal", () => {
  const fields = [
    "fetchEndpoint",
    "wsProxy",
    "useSecureWebSocket",
    "pipelineTLS",
    "pipelineConnect",
  ] as const;
  let saved: Record<string, unknown>;
  beforeEach(() => {
    saved = Object.fromEntries(fields.map((f) => [f, neonConfig[f]]));
  });
  afterEach(() => {
    for (const f of fields)
      (neonConfig as unknown as Record<string, unknown>)[f] = saved[f];
  });

  it("con un host de Neon no toca neonConfig", () => {
    for (const h of variants) configureNeonForLocal(url(h));
    for (const f of fields) expect(neonConfig[f], f).toBe(saved[f]);
  });

  it("con un host local fija los cinco campos para el proxy", () => {
    configureNeonForLocal(url("db.localtest.me:5432"));
    expect(neonConfig.fetchEndpoint).toBe("http://db.localtest.me:4444/sql");
    expect(neonConfig.wsProxy).toBe("db.localtest.me:4444/v2");
    expect(neonConfig.useSecureWebSocket).toBe(false);
    expect(neonConfig.pipelineTLS).toBe(false);
    expect(neonConfig.pipelineConnect).toBe(false);
  });
});

describe("neonEndpointId", () => {
  it("las cuatro variantes de host de un endpoint dan el mismo id", () => {
    for (const h of variants)
      expect(neonEndpointId(url(h)), h).toBe("ep-x-y-123");
    expect(
      neonEndpointId(url("ep-x-y-123-pooler-rvr.c-1.region.aws.neon.tech")),
    ).toBe("ep-x-y-123");
  });
});

describe("assertNotProdOutsideProduction", () => {
  it("tira con las cuatro variantes del endpoint de PROD fuera de produccion", () => {
    for (const NODE_ENV of ["development", "test", undefined])
      for (const h of variants)
        expect(
          () => assertNotProdOutsideProduction(url(h), { NODE_ENV }, fakeSha12),
          `${h} ${NODE_ENV}`,
        ).toThrow("DATABASE_URL apunta a PROD fuera de produccion");
  });

  it("no tira en produccion, con un host local ni con otro endpoint de Neon", () => {
    for (const h of variants)
      expect(() =>
        assertNotProdOutsideProduction(
          url(h),
          { NODE_ENV: "production" },
          fakeSha12,
        ),
      ).not.toThrow();
    for (const u of LOCAL_URLS)
      expect(() =>
        assertNotProdOutsideProduction(
          u,
          { NODE_ENV: "development" },
          fakeSha12,
        ),
      ).not.toThrow();
    const other = url("ep-otro-456-pooler.c-1.region.aws.neon.tech");
    expect(() =>
      assertNotProdOutsideProduction(
        other,
        { NODE_ENV: "development" },
        fakeSha12,
      ),
    ).not.toThrow();
  });

  it("una URL invalida no vuelca la entrada en el error", () => {
    expect(() =>
      assertNotProdOutsideProduction("postgresql://u:secreto@", {}),
    ).toThrow(/^DATABASE_URL no es una URL valida\.$/);
  });

  it("la huella de PROD no cambia sin querer", () => {
    expect(PROD_DB_ENDPOINT_SHA12).toBe("bf545fdce7a0");
  });
});

describe("getDb / withDbTransaction", () => {
  const prev = { url: process.env.DATABASE_URL, env: process.env.NODE_ENV };
  afterEach(() => {
    // Asignar `undefined` a process.env deja la cadena "undefined": se borra.
    for (const [k, v] of [
      ["DATABASE_URL", prev.url],
      ["NODE_ENV", prev.env],
    ] as const)
      if (v === undefined) delete process.env[k];
      else (process.env as Record<string, string>)[k] = v;
    vi.doUnmock("./local");
    vi.doUnmock("@neondatabase/serverless");
    vi.resetModules();
  });

  // El cableado: con la huella del host ficticio inyectada (el host real no se commitea), los dos
  // puntos de entrada tiran ANTES de crear el cliente HTTP o el Pool. `neon`/`Pool` son espias.
  async function loadClient() {
    vi.resetModules();
    const neon = vi.fn(() => {
      throw new Error("neon() llamado");
    });
    const Pool = vi.fn(() => {
      throw new Error("Pool llamado");
    });
    vi.doMock("@neondatabase/serverless", async (orig) => ({
      ...(await orig<typeof import("@neondatabase/serverless")>()),
      neon,
      Pool,
    }));
    vi.doMock("./local", async (orig) => {
      const real = await orig<typeof import("./local")>();
      return {
        ...real,
        assertNotProdOutsideProduction: (
          u: string,
          e?: { NODE_ENV?: string },
        ) => real.assertNotProdOutsideProduction(u, e, fakeSha12),
      };
    });
    return { ...(await import("./client")), neon, Pool };
  }

  it("con NODE_ENV=development y el endpoint de PROD tiran sin abrir conexion", async () => {
    const { getDb, withDbTransaction, neon, Pool } = await loadClient();
    (process.env as Record<string, string | undefined>).NODE_ENV =
      "development";
    for (const h of variants) {
      process.env.DATABASE_URL = url(h);
      expect(() => getDb(), h).toThrow(
        "DATABASE_URL apunta a PROD fuera de produccion",
      );
      await expect(
        withDbTransaction(async () => 1),
        h,
      ).rejects.toThrow("DATABASE_URL apunta a PROD fuera de produccion");
    }
    expect(neon).not.toHaveBeenCalled();
    expect(Pool).not.toHaveBeenCalled();
  });

  it("con NODE_ENV=production el mismo endpoint pasa (el deploy sigue llegando a PROD)", async () => {
    const { getDb, neon } = await loadClient();
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.DATABASE_URL = url(FAKE);
    expect(() => getDb()).toThrow("neon() llamado");
    expect(neon).toHaveBeenCalledTimes(1);
  });
});
