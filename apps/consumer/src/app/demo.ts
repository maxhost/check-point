export const demoOrigin = process.env.NEXT_PUBLIC_QA_ORIGIN;
export const demoCheckinPath = "/check-in/demo-bar";
export const demoStorageKey = "mi-pasaporte-demo-reward";

export function checkinUrl(origin = demoOrigin): string | null {
  if (!origin) return null;
  try {
    const url = new URL(demoCheckinPath, origin);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export type DemoReward = { points: number; stamps: number };

export function saveDemoReward(storage: Storage): DemoReward {
  const reward = { points: 10, stamps: 2 };
  storage.setItem(demoStorageKey, JSON.stringify(reward));
  return reward;
}

export function readDemoReward(storage: Storage): DemoReward | null {
  const value = storage.getItem(demoStorageKey);
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "points" in parsed &&
      "stamps" in parsed
    ) {
      const reward = parsed as DemoReward;
      return typeof reward.points === "number" &&
        typeof reward.stamps === "number"
        ? reward
        : null;
    }
  } catch {
    /* fixture corrupto: tratar como vacío */
  }
  return null;
}
