import { afterEach, describe, expect, it, vi } from "vitest";
import { panelRequest, PanelRequestError } from "./panel-request";
import {
  BackofficeScopeRequestError,
  isBackofficeContextChanged,
} from "./backoffice-scope-request";

afterEach(() => vi.unstubAllGlobals());
const reply = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status });

describe("0238 panel transport opt-in", () => {
  it("preserves legacy GET and JSON POST without a scope header", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => reply({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await panelRequest("/api/example");
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/example", {
      method: "GET",
      cache: "no-store",
    });
    await panelRequest("/api/example", "POST", { value: 1 });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/example", {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: '{"value":1}',
    });
  });

  it("captures scopeA before awaiting even when the caller changes its options to B", async () => {
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
    const request = panelRequest(
      "/api/analytics/inbox",
      "GET",
      undefined,
      options,
    );
    options.scopeKey = "b".repeat(64);
    resolve(reply({ cards: [] }));
    await request;
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1]).toEqual({
      method: "GET",
      cache: "no-store",
      headers: { "X-Backoffice-Scope": "a".repeat(64) },
      signal: options.signal,
    });
  });

  it("keeps FormData boundaries browser-owned while attaching the scope", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const body = new FormData();
    body.set("fixture", "value");
    await panelRequest("/api/example", "POST", body, {
      scopeKey: "a".repeat(64),
    });
    expect(fetchMock.mock.calls[0][1]).toEqual({
      method: "POST",
      cache: "no-store",
      body,
      headers: { "X-Backoffice-Scope": "a".repeat(64) },
    });
  });

  it("rejects malformed scope before sending a POST", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      panelRequest("/api/example", "POST", {}, { scopeKey: "invalid" }),
    ).rejects.toBeInstanceOf(BackofficeScopeRequestError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["backoffice_context_changed", "version_conflict"])(
    "preserves typed409 %s and never retries a POST",
    async (code) => {
      const payload = { code, error: "Fixture rejection" };
      const fetchMock = vi.fn().mockResolvedValue(reply(payload, 409));
      vi.stubGlobal("fetch", fetchMock);
      const error = await panelRequest(
        "/api/example",
        "POST",
        {},
        { scopeKey: "a".repeat(64) },
      ).catch((failure) => failure);
      expect(error).toBeInstanceOf(PanelRequestError);
      expect(error).toMatchObject({
        message: payload.error,
        status: 409,
        code,
        payload,
      });
      expect(isBackofficeContextChanged(error)).toBe(
        code === "backoffice_context_changed",
      );
      expect(fetchMock).toHaveBeenCalledOnce();
    },
  );

  it("preserves abort rejection without replay or changing its identity", async () => {
    const failure = new DOMException("Fixture abort", "AbortError");
    const fetchMock = vi.fn().mockRejectedValue(failure);
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      panelRequest("/api/example", "GET", undefined, {
        signal: new AbortController().signal,
      }),
    ).rejects.toBe(failure);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
