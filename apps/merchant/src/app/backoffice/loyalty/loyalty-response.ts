import type { Context, Template } from "./loyalty-types";
const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const strings = (value: Record<string, unknown>, keys: string[]) =>
  keys.every((key) => typeof value[key] === "string");
export function isContext(value: unknown): value is Context {
  if (
    !record(value) ||
    !record(value.business) ||
    !strings(value.business, [
      "name",
      "countryCode",
      "currencyCode",
      "timezone",
      "brandPrimaryColor",
      "brandComplementaryColor",
      "brandAccentColor",
    ])
  )
    return false;
  const program = value.program;
  if (program === null) return true;
  if (
    !record(program) ||
    !record(program.configuration) ||
    !strings(program, ["id", "termsMarkdown", "activatedAt"]) ||
    !["points", "stamps"].includes(String(program.kind)) ||
    !["active", "closing", "inactive"].includes(String(program.status)) ||
    typeof program.redeemAllowInsufficient !== "boolean" ||
    !Array.isArray(program.rewards)
  )
    return false;
  if (
    program.kind === "points"
      ? !strings(program.configuration, ["unitSingular", "unitPlural"])
      : !Number.isInteger(program.configuration.target)
  )
    return false;
  if (
    program.accrual !== null &&
    (!record(program.accrual) ||
      !["per_amount", "per_purchase"].includes(String(program.accrual.mode)) ||
      typeof program.accrual.grant !== "number")
  )
    return false;
  return program.rewards.every(
    (reward) =>
      record(reward) &&
      ["catalog_product", "custom", "discount"].includes(String(reward.type)) &&
      typeof reward.label === "string",
  );
}
export function areTemplates(
  value: unknown,
): value is { templates: Template[] } {
  return (
    record(value) &&
    Array.isArray(value.templates) &&
    value.templates.every(
      (template) =>
        record(template) &&
        strings(template, ["id", "title", "templateMarkdown"]),
    )
  );
}
