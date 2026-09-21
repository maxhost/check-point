export type OnboardingItem = {
  id: string;
  anchor: string;
  position: number;
  required: boolean;
  done: boolean;
  title: string;
  body: string;
};

export type OnboardingChecklist = {
  locale: string;
  items: OnboardingItem[];
};

export type OnboardingTourId = "staff" | "catalog" | "program" | "brand";
export type OnboardingTourStatus = "completed" | "skipped";

function isItem(value: unknown): value is OnboardingItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.anchor === "string" &&
    typeof item.position === "number" &&
    typeof item.required === "boolean" &&
    typeof item.done === "boolean" &&
    typeof item.title === "string" &&
    typeof item.body === "string"
  );
}

export function parseChecklist(value: unknown): OnboardingChecklist | null {
  if (!value || typeof value !== "object") return null;
  const checklist = value as Record<string, unknown>;
  if (typeof checklist.locale !== "string" || !Array.isArray(checklist.items))
    return null;
  if (!checklist.items.every(isItem)) return null;
  return { locale: checklist.locale, items: checklist.items };
}

export async function getOnboardingChecklist(signal?: AbortSignal) {
  const response = await fetch("/api/onboarding/checklist", {
    credentials: "same-origin",
    signal,
  });
  if (!response.ok) throw new Error("onboarding-checklist-failed");
  const checklist = parseChecklist(await response.json());
  if (!checklist) throw new Error("onboarding-checklist-invalid-response");
  return checklist;
}

export async function recordOnboardingTour(
  tourId: OnboardingTourId,
  status: OnboardingTourStatus,
) {
  const response = await fetch(`/api/onboarding/tours/${tourId}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw new Error("onboarding-tour-update-failed");
}
