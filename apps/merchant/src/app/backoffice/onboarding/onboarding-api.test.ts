import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getOnboardingChecklist,
  parseChecklist,
  recordOnboardingTour,
  OnboardingRequestError,
} from "./onboarding-api";
import {
  BackofficeScopeRequestError,
  isBackofficeContextChanged,
} from "../backoffice-scope-request";

const checklist = {
  locale: "es",
  items: [
    {
      id: "verify-email",
      anchor: "verify-email",
      position: 1,
      required: true,
      done: false,
      title: "Verifica tu email",
      body: "Confirma que la dirección es tuya.",
    },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe("cliente del onboarding", () => {
  it("acepta el contrato del checklist y rechaza items incompletos", () => {
    expect(parseChecklist(checklist)).toEqual(checklist);
    expect(
      parseChecklist({
        ...checklist,
        items: [{ ...checklist.items[0], required: undefined }],
      }),
    ).toBeNull();
  });

  it("lee el checklist con la sesión actual", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(checklist), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getOnboardingChecklist()).resolves.toEqual(checklist);
    expect(fetchMock).toHaveBeenCalledWith("/api/onboarding/checklist", {
      credentials: "same-origin",
      signal: undefined,
    });
  });

  it("persiste completed y skipped con el contrato exacto del tour", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    await recordOnboardingTour("catalog", "skipped");

    expect(fetchMock).toHaveBeenCalledWith("/api/onboarding/tours/catalog", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "skipped" }),
    });
  });

  it("no interpreta una respuesta fallida como progreso guardado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 403 })),
    );

    await expect(recordOnboardingTour("brand", "completed")).rejects.toThrow(
      "onboarding-tour-update-failed",
    );
  });

  it("captures checklist scope by value and preserves its existing abort signal", async () => {
    let resolve!: (response: Response) => void;
    const fetchMock = vi.fn().mockReturnValue(
      new Promise<Response>((done) => {
        resolve = done;
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const signal = new AbortController().signal;
    const options = { scopeKey: "a".repeat(64) };
    const request = getOnboardingChecklist(signal, options);
    options.scopeKey = "b".repeat(64);
    resolve(new Response(JSON.stringify(checklist)));
    await expect(request).resolves.toEqual(checklist);
    expect(fetchMock).toHaveBeenCalledWith("/api/onboarding/checklist", {
      credentials: "same-origin",
      signal,
      headers: { "X-Backoffice-Scope": "a".repeat(64) },
    });
  });

  it("captures tour intent before waiting and preserves JSON and credentials", async () => {
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
    const request = recordOnboardingTour("brand", "completed", options);
    options.scopeKey = "b".repeat(64);
    resolve(new Response("{}"));
    await request;
    expect(fetchMock).toHaveBeenCalledWith("/api/onboarding/tours/brand", {
      method: "POST",
      credentials: "same-origin",
      signal: options.signal,
      headers: {
        "content-type": "application/json",
        "X-Backoffice-Scope": "a".repeat(64),
      },
      body: '{"status":"completed"}',
    });
  });

  it("preserves legacy error messages/prototype with code/status, no POST replay", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "backoffice_context_changed",
            error: "Fixture scope",
          }),
          { status: 409 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const error = await recordOnboardingTour("catalog", "skipped", {
      scopeKey: "a".repeat(64),
    }).catch((failure) => failure);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(OnboardingRequestError);
    expect(error).toMatchObject({
      message: "onboarding-tour-update-failed",
      code: "backoffice_context_changed",
      status: 409,
    });
    expect(isBackofficeContextChanged(error)).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("retains checklist error details even when response is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })),
    );
    await expect(getOnboardingChecklist()).rejects.toMatchObject({
      message: "onboarding-checklist-failed",
      status: 503,
      code: undefined,
    });
  });

  it("rejects malformed scope before any checklist or tour request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      getOnboardingChecklist(undefined, { scopeKey: "invalid" }),
    ).rejects.toBeInstanceOf(BackofficeScopeRequestError);
    await expect(
      recordOnboardingTour("brand", "completed", { scopeKey: "invalid" }),
    ).rejects.toBeInstanceOf(BackofficeScopeRequestError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
