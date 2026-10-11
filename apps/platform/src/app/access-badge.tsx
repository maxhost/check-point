import { ACCESS_LABEL } from "../server/format";

export function AccessBadge({ access }: { access: keyof typeof ACCESS_LABEL }) {
  const tone =
    access === "blocked"
      ? "bg-danger-soft"
      : access === "trial"
        ? "bg-warning-soft"
        : "bg-success-soft";
  return (
    <span className={`rounded-full px-2.5 py-1 font-bold text-content ${tone}`}>
      {ACCESS_LABEL[access]}
    </span>
  );
}
