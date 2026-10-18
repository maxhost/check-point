import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ModuleRequestError,
  moduleRequest,
  readModules,
} from "./module-request";
import {
  BackofficeScopeRequestError,
  isBackofficeContextChanged,
} from "../backoffice-scope-request";

afterEach(() => vi.unstubAllGlobals());
const reply = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status });

describe("0238 module transport opt-in", () => {
  it("preserves legacy GET, PUT JSON and readModules without marks", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => reply({ modules: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await readModules();
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/modules", {
      method: "GET",
      cache: "no-store",
    });
    await moduleRequest("/api/modules/fixture", { enabled: true });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/modules/fixture", {
      method: "PUT",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: '{"enabled":true}',
    });
  });

  it("captures scope before waiting and forwards abort signal through readModules", async () => {
    let resolve!: (response: Response) => void;
    const fetchMock = vi.fn().mockReturnValue(
      new Promise<Response>((done) => {
        resolve = done;
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const options = {
      scopeKey: "a".repeat(64),
      signal: new AbortController().signal,
    };
    const request = readModules(options);
    options.scopeKey = "b".repeat(64);
    resolve(reply({ modules: [] }));
    await request;
    expect(fetchMock.mock.calls[0][1]).toEqual({
      method: "GET",
      cache: "no-store",
      headers: { "X-Backoffice-Scope": "a".repeat(64) },
      signal: options.signal,
    });
  });

  it("keeps dependency/open-order409 fields and distinguishes scope409 without retries", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () =>
        reply(
          {
            code: "module_requires",
            error: "Fixture dependency",
            missing: ["required"],
            dependents: ["dependent"],
            openCount: 3,
          },
          409,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const error = await moduleRequest(
      "/api/modules/fixture",
      { enabled: false },
      { scopeKey: "a".repeat(64) },
    ).catch((failure) => failure);
    expect(error).toBeInstanceOf(ModuleRequestError);
    expect(error).toMatchObject({
      status: 409,
      code: "module_requires",
      missing: ["required"],
      dependents: ["dependent"],
      openCount: 3,
      message: "Fixture dependency",
    });
    expect(isBackofficeContextChanged(error)).toBe(false);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1].headers).toEqual({
      "content-type": "application/json",
      "X-Backoffice-Scope": "a".repeat(64),
    });
  });

  it("classifies context409 as a typed error with no replay", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        reply(
          { code: "backoffice_context_changed", error: "Fixture scope" },
          409,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const error = await moduleRequest("/api/modules/fixture", {
      enabled: true,
    }).catch((failure) => failure);
    expect(error).toBeInstanceOf(ModuleRequestError);
    expect(isBackofficeContextChanged(error)).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects malformed scope before sending PUT", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      moduleRequest(
        "/api/modules/fixture",
        { enabled: true },
        { scopeKey: "" },
      ),
    ).rejects.toBeInstanceOf(BackofficeScopeRequestError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
