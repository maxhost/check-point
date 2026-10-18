import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  config: null as Record<string, (...args: never[]) => void> | null,
  destroy: vi.fn(),
  drive: vi.fn(),
  record: vi.fn().mockResolvedValue(undefined),
  active: vi.fn().mockReturnValue(true),
}));

vi.mock("driver.js", () => ({
  driver: (config: Record<string, (...args: never[]) => void>) => {
    mocks.config = config;
    return {
      destroy: mocks.destroy,
      drive: mocks.drive,
      isActive: mocks.active,
    };
  },
}));

import {
  startOnboardingTour,
  disposeOnboardingTour,
  type OnboardingTourOptions,
} from "./onboarding-tour";

// Persistence is injected; the separate helper suite verifies scope and transport.
const start = (options: OnboardingTourOptions) =>
  startOnboardingTour({
    ...options,
    persistProgress: (status) =>
      mocks.record(options.tourId, status).then(() => true),
  });

beforeEach(() => {
  mocks.config = null;
  vi.clearAllMocks();
  mocks.record.mockResolvedValue(undefined);
});

describe("driver del onboarding", () => {
  it("configura el enfoque automático de cada elemento resaltado", () => {
    start({ tourId: "staff", steps: [] });
    expect(mocks.config?.onHighlighted).toBeTypeOf("function");
  });

  it("registra completed al terminar el último paso", () => {
    start({ tourId: "catalog", steps: [] });

    mocks.config?.onDoneClick();

    expect(mocks.record).toHaveBeenCalledWith("catalog", "completed");
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });

  it("registra skipped al cerrar el recorrido", () => {
    start({ tourId: "brand", steps: [] });

    mocks.config?.onDestroyStarted();

    expect(mocks.record).toHaveBeenCalledWith("brand", "skipped");
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });

  it("una ayuda independiente no persiste progreso", () => {
    start({ tourId: "staff", steps: [], persist: false });
    mocks.config?.onDoneClick();
    expect(mocks.record).not.toHaveBeenCalled();
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });

  it("ofrece avanzar o saltar desde el primer paso cuando se solicita", () => {
    start({
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
  it("desmontar un tour no registra skipped y limpia el driver", () => {
    const tour = start({ tourId: "catalog", steps: [] });
    disposeOnboardingTour(tour);
    mocks.config?.onDestroyStarted();
    expect(mocks.record).not.toHaveBeenCalled();
    expect(mocks.destroy).toHaveBeenCalled();
  });
  it("un fallo de persistencia entrega el mismo estado para reintentar", async () => {
    mocks.record.mockRejectedValueOnce(new Error("offline"));
    const onSaved = vi.fn();
    const onSaveError = vi.fn();
    start({ tourId: "catalog", steps: [], onSaved, onSaveError });
    mocks.config?.onDoneClick();
    await vi.waitFor(() =>
      expect(onSaveError).toHaveBeenCalledWith("completed"),
    );
    expect(onSaved).not.toHaveBeenCalled();
  });
});

it("persistent tours fail closed without an injected intention", async () => {
  const onSaveError = vi.fn();
  startOnboardingTour({ tourId: "catalog", steps: [], onSaveError });
  mocks.config?.onDoneClick();
  await vi.waitFor(() => expect(onSaveError).toHaveBeenCalledWith("completed"));
  expect(mocks.record).not.toHaveBeenCalled();
});
it("a discarded intention produces neither saved nor operational failure UI", async () => {
  const onSaved = vi.fn(),
    onSaveError = vi.fn();
  startOnboardingTour({
    tourId: "catalog",
    steps: [],
    persistProgress: async () => false,
    onSaved,
    onSaveError,
  });
  mocks.config?.onDoneClick();
  await Promise.resolve();
  await Promise.resolve();
  expect(onSaved).not.toHaveBeenCalled();
  expect(onSaveError).not.toHaveBeenCalled();
});
