import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  config: null as Record<string, (...args: never[]) => void> | null,
  destroy: vi.fn(),
  drive: vi.fn(),
  record: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("driver.js", () => ({
  driver: (config: Record<string, (...args: never[]) => void>) => {
    mocks.config = config;
    return { destroy: mocks.destroy, drive: mocks.drive };
  },
}));

vi.mock("./onboarding-api", () => ({
  recordOnboardingTour: mocks.record,
}));

import { startOnboardingTour } from "./onboarding-tour";

beforeEach(() => {
  mocks.config = null;
  vi.clearAllMocks();
});

describe("driver del onboarding", () => {
  it("configura el enfoque automático de cada elemento resaltado", () => {
    startOnboardingTour({ tourId: "staff", steps: [] });
    expect(mocks.config?.onHighlighted).toBeTypeOf("function");
  });

  it("registra completed al terminar el último paso", () => {
    startOnboardingTour({ tourId: "catalog", steps: [] });

    mocks.config?.onDoneClick();

    expect(mocks.record).toHaveBeenCalledWith("catalog", "completed");
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });

  it("registra skipped al cerrar el recorrido", () => {
    startOnboardingTour({ tourId: "brand", steps: [] });

    mocks.config?.onDestroyStarted();

    expect(mocks.record).toHaveBeenCalledWith("brand", "skipped");
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });

  it("una ayuda independiente no persiste progreso", () => {
    startOnboardingTour({ tourId: "staff", steps: [], persist: false });
    mocks.config?.onDoneClick();
    expect(mocks.record).not.toHaveBeenCalled();
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });

  it("ofrece avanzar o saltar desde el primer paso cuando se solicita", () => {
    startOnboardingTour({
      tourId: "staff",
      steps: [{ element: "[data-tour='staff-add']", popover: {} }],
      showSkipOnFirstStep: true,
    });

    const firstStep = (
      mocks.config as unknown as {
        steps: Array<{ popover?: { showButtons?: string[] } }>;
      }
    )?.steps[0];
    expect(firstStep?.popover?.showButtons).toEqual(["next", "close"]);
  });
});
