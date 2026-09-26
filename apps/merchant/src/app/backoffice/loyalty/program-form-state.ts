import type { Kind, LoyaltyVm } from "./use-loyalty-program";
export type StepId =
  | "modality"
  | "units"
  | "basics"
  | "design"
  | "terms"
  | "rewards"
  | "review";
export const stepLabels: Record<StepId, string> = {
  modality: "Modalidad",
  units: "Unidades",
  basics: "Sello y objetivo",
  design: "Diseño",
  terms: "Términos",
  rewards: "Premios",
  review: "Revisión",
};
export function stepsFor(kind: Kind, create: boolean): StepId[] {
  const core: StepId[] =
    kind === "points"
      ? ["units", "terms", "rewards", "review"]
      : ["basics", "design", "terms", "rewards", "review"];
  return create ? ["modality", ...core] : core;
}
export function parseMoney(value: string): number {
  const normalized = value.trim().replace(",", ".");
  return /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)
    ? Number(normalized)
    : NaN;
}
export function errorsFor(step: StepId, vm: LoyaltyVm): Record<string, string> {
  const errors: Record<string, string> = {};
  const required = (key: string, value: string) => {
    if (!value.trim()) errors[key] = "Completá este nombre";
  };
  const positive = (key: string, value: number) => {
    if (!Number.isInteger(value) || value <= 0)
      errors[key] = "Ingresá un entero mayor que 0";
  };
  if (step === "units") {
    required("singular", vm.singular);
    required("plural", vm.plural);
  }
  if (step === "basics") {
    required("stampName", vm.stampName);
    if (!Number.isInteger(vm.target) || vm.target < 2 || vm.target > 50)
      errors.target = "Elegí un entero entre 2 y 50";
  }
  if (step === "terms") {
    if (!vm.terms.trim())
      errors.terms = "Agregá al menos una cláusula de términos";
    positive("grant", vm.earn.grant);
    if (vm.earn.effectiveMode(vm.kind) === "per_amount") {
      const amount = parseMoney(vm.earn.blockAmount);
      if (!Number.isFinite(amount) || amount <= 0 || amount > 9999999999.99)
        errors.blockAmount = "Ingresá un monto mayor que 0";
    }
  }
  if (step === "rewards") {
    if (
      vm.earn.rewards.length < 1 ||
      vm.earn.rewards.length > 20 ||
      (vm.kind === "stamps" && vm.earn.rewards.length !== 1)
    )
      errors.rewards = "Agregá al menos un premio";
    vm.earn.rewards.forEach((reward, i) => {
      if (reward.type === "catalog_product" && !reward.productId)
        errors[`product-${i}`] = "Elegí un producto";
      if (reward.type === "custom" && !reward.label.trim())
        errors[`label-${i}`] = "Escribí el nombre del premio";
      if (
        reward.type === "discount" &&
        (!Number.isInteger(reward.discountPercent) ||
          reward.discountPercent < 1 ||
          reward.discountPercent > 100)
      )
        errors[`discount-${i}`] = "Elegí un porcentaje entre 1 y 100";
      if (vm.kind === "points") positive(`cost-${i}`, reward.pointsCost);
    });
  }
  return errors;
}
export function firstInvalidStep(vm: LoyaltyVm) {
  return stepsFor(vm.kind, !vm.program).find(
    (step) => Object.keys(errorsFor(step, vm)).length > 0,
  );
}
