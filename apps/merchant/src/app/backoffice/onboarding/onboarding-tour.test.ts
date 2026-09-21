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
});
