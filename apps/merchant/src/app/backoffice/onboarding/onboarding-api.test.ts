import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getOnboardingChecklist,
  parseChecklist,
  recordOnboardingTour,
} from "./onboarding-api";

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
});
