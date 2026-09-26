export type BrandTask =
  | "change-name"
  | "change-logo"
  | "remove-logo"
  | "change-colors"
  | "change-timezone"
  | "change-currency";
export type BrandPhase =
  | "name"
  | "logo"
  | "crop"
  | "remove"
  | "primary"
  | "complementary"
  | "accent"
  | "timezone"
  | "currency"
  | "preview"
  | "save"
  | "success";
export type BrandTourSession = {
  instance: number;
  task: BrandTask;
  phase: BrandPhase;
};
export type BrandTourEvent = {
  type: "next" | "cropping" | "selected" | "removed" | "saved" | "cancel-crop";
};
export const brandTaskPhases: Record<BrandTask, BrandPhase[]> = {
  "change-name": ["name", "preview", "save", "success"],
  "change-logo": ["logo", "preview", "save", "success"],
  "remove-logo": ["remove", "preview", "save", "success"],
  "change-colors": [
    "primary",
    "complementary",
    "accent",
    "preview",
    "save",
    "success",
  ],
  "change-timezone": ["timezone", "save", "success"],
  "change-currency": ["currency", "save", "success"],
};
export function transitionBrandTour(
  session: BrandTourSession,
  event: BrandTourEvent,
): BrandTourSession | null {
  const { phase, task } = session;
  if (event.type === "cancel-crop" && task === "change-logo") return null;
  if (event.type === "cropping" && task === "change-logo" && phase === "logo")
    return { ...session, phase: "crop" };
  if (
    event.type === "selected" &&
    task === "change-logo" &&
    ["logo", "crop"].includes(phase)
  )
    return { ...session, phase: "preview" };
  if (event.type === "removed" && task === "remove-logo" && phase === "remove")
    return { ...session, phase: "preview" };
  if (event.type === "saved" && phase === "save")
    return { ...session, phase: "success" };
  if (
    event.type !== "next" ||
    ["logo", "crop", "remove", "save", "success"].includes(phase)
  )
    return session;
  const phases = brandTaskPhases[task];
  return { ...session, phase: phases[phases.indexOf(phase) + 1] };
}
