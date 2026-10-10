import { describe, expect, it } from "vitest";
import {
  checkoutTrialEnd,
  decidePlanChange,
  type PlanChangeInput,
} from "./billing";

/**
 * Spec 0189 §D6 / T5 — los casos NOMBRADOS, con la salida escrita LITERAL; la matriz completa
 * vive en `billing-plan-change.test.ts` (archivo aparte por el límite de 300 líneas).
 */

const NOW = new Date("2026-10-10T12:00:00.000Z");
const H48 = 48 * 3_600_000;
const TRIAL_END = new Date(NOW.getTime() + 60 * 86_400_000);

/** Un negocio en prueba, sin Stripe, con 1 local y nada fuera del base. */
const trial: PlanChangeInput = {
  currentPlan: "trial",
  currentInterval: null,
  pendingPlan: null,
  status: "active",
  stripeSubscriptionId: null,
  trialEndsAt: TRIAL_END,
  now: NOW,
  activeLocations: 1,
  activeCampaignsOutsideBase: 0,
  intent: { kind: "subscribe", plan: "base", interval: "month" },
};

/** Un negocio pagando plus mensual, con la prueba ya vencida. */
const plus: PlanChangeInput = {
  ...trial,
  currentPlan: "plus",
  currentInterval: "month",
  stripeSubscriptionId: "sub_x",
  trialEndsAt: new Date(NOW.getTime() - 1),
};

describe("checkoutTrialEnd — el `trial_end` del Checkout (ORÁCULO DE M5)", () => {
  it("a 48 h − 1 ms del fin de la prueba se cobra en el acto (`null`)", () => {
    expect(checkoutTrialEnd(new Date(NOW.getTime() + H48 - 1), NOW)).toBeNull();
  });

  it("a 48 h exactas la fecha va al Checkout", () => {
    const end = new Date(NOW.getTime() + H48);
    expect(checkoutTrialEnd(end, NOW)).toEqual(end);
  });

  it("con la prueba vencida o sin prueba, `null`", () => {
    expect(checkoutTrialEnd(new Date(NOW.getTime() - 1), NOW)).toBeNull();
    expect(checkoutTrialEnd(null, NOW)).toBeNull();
  });
});

describe("decidePlanChange — subscribe (checkout)", () => {
  it("en prueba, el primer cobro cae el día del fin de la prueba", () => {
    expect(decidePlanChange(trial)).toEqual({
      kind: "checkout",
      plan: "base",
      interval: "month",
      trialEnd: TRIAL_END,
    });
  });

  it("bloqueado (prueba vencida, sin Stripe) contrata con cobro en el acto", () => {
    expect(
      decidePlanChange({
        ...trial,
        currentPlan: "none",
        trialEndsAt: new Date(NOW.getTime() - 1),
        intent: { kind: "subscribe", plan: "plus", interval: "year" },
      }),
    ).toEqual({
      kind: "checkout",
      plan: "plus",
      interval: "year",
      trialEnd: null,
    });
  });

  it("un status DESCONOCIDO con id bloquea el checkout: lo no muerto cuenta como vivo", () => {
    expect(
      decidePlanChange({
        ...plus,
        status: "future_status",
        intent: trial.intent,
      }),
    ).toMatchObject({ kind: "blocked", code: "subscription_live" });
  });

  it("una suscripción `incomplete_expired` NO bloquea un checkout nuevo", () => {
    expect(
      decidePlanChange({
        ...trial,
        status: "incomplete_expired",
        stripeSubscriptionId: "sub_x",
      }),
    ).toMatchObject({ kind: "checkout" });
  });

  it("PRECEDENCIA: con 2 locales Y campañas fuera del base gana el bloqueo de LOCALES", () => {
    expect(
      decidePlanChange({
        ...trial,
        activeLocations: 2,
        activeCampaignsOutsideBase: 3,
      }),
    ).toEqual({
      kind: "blocked",
      code: "downgrade_blocked",
      message: "El plan Base admite 1 local activo; hoy tienes 2. Archiva 1.",
      archiveCount: 1,
    });
  });

  it("con campañas fuera del base no se contrata el base; el plus sí", () => {
    const input = { ...trial, activeCampaignsOutsideBase: 2 };
    expect(decidePlanChange(input)).toEqual({
      kind: "blocked",
      code: "downgrade_blocked_campaigns",
      message:
        "El plan Base solo incluye Bienvenida y Venta cruzada; hoy tienes 2 campañas activas fuera de eso. Desactiva 2.",
      deactivateCount: 2,
    });
    expect(
      decidePlanChange({
        ...input,
        intent: { kind: "subscribe", plan: "plus", interval: "month" },
      }),
    ).toMatchObject({ kind: "checkout", plan: "plus" });
  });

  it("3 locales caben en plus; 4 no", () => {
    const intent = {
      kind: "subscribe",
      plan: "plus",
      interval: "month",
    } as const;
    expect(
      decidePlanChange({ ...trial, activeLocations: 3, intent }),
    ).toMatchObject({ kind: "checkout" });
    expect(
      decidePlanChange({ ...trial, activeLocations: 4, intent }),
    ).toMatchObject({
      kind: "blocked",
      code: "downgrade_blocked",
      archiveCount: 1,
    });
  });
});

describe("decidePlanChange — change_plan", () => {
  it("subir de base a plus cobra la diferencia en el acto", () => {
    expect(
      decidePlanChange({
        ...plus,
        currentPlan: "base",
        intent: { kind: "change_plan", to: "plus" },
      }),
    ).toEqual({ kind: "change_plan", to: "plus", proration: "always_invoice" });
  });

  it("bajar de plus a base rige desde la próxima factura", () => {
    expect(
      decidePlanChange({
        ...plus,
        intent: { kind: "change_plan", to: "base" },
      }),
    ).toEqual({ kind: "change_plan", to: "base", proration: "none" });
  });

  it("bajar a base con locales de más → `downgrade_blocked`", () => {
    expect(
      decidePlanChange({
        ...plus,
        activeLocations: 3,
        activeCampaignsOutsideBase: 1,
        intent: { kind: "change_plan", to: "base" },
      }),
    ).toMatchObject({ code: "downgrade_blocked", archiveCount: 2 });
  });

  it("sin suscripción viva no se cambia de plan: se contrata", () => {
    expect(
      decidePlanChange({
        ...trial,
        intent: { kind: "change_plan", to: "plus" },
      }),
    ).toMatchObject({ kind: "blocked", code: "plan_needs_subscription" });
  });

  it("con la cancelación programada, primero se reanuda", () => {
    expect(
      decidePlanChange({
        ...plus,
        pendingPlan: "none",
        intent: { kind: "change_plan", to: "base" },
      }),
    ).toEqual({
      kind: "blocked",
      code: "cancel_scheduled",
      message: "Reanuda tu suscripción para cambiar de plan.",
    });
  });

  it("ya en ese plan → `already_on_plan`, con la etiqueta del plan", () => {
    expect(
      decidePlanChange({
        ...plus,
        intent: { kind: "change_plan", to: "plus" },
      }),
    ).toEqual({
      kind: "blocked",
      code: "already_on_plan",
      message: "Ya estás en el plan Plus.",
    });
  });
});

describe("decidePlanChange — change_interval, cancel y resume", () => {
  it("un plan pago con `interval` NULL puede pasar a anual", () => {
    expect(
      decidePlanChange({
        ...plus,
        currentInterval: null,
        intent: { kind: "change_interval", to: "year" },
      }),
    ).toEqual({ kind: "change_interval", to: "year" });
  });

  it("anual → mensual está fuera de alcance (tarea 55)", () => {
    expect(
      decidePlanChange({
        ...plus,
        currentInterval: "year",
        intent: { kind: "change_interval", to: "month" },
      }),
    ).toMatchObject({ code: "interval_downgrade_unsupported" });
  });

  it("cancelar programa la baja al fin del periodo; dos veces no", () => {
    expect(decidePlanChange({ ...plus, intent: { kind: "cancel" } })).toEqual({
      kind: "schedule_cancel",
    });
    expect(
      decidePlanChange({
        ...plus,
        pendingPlan: "none",
        intent: { kind: "cancel" },
      }),
    ).toMatchObject({ code: "cancel_scheduled" });
    expect(
      decidePlanChange({ ...trial, intent: { kind: "cancel" } }),
    ).toMatchObject({ code: "no_subscription" });
  });

  it("reanudar exige suscripción viva Y cancelación programada", () => {
    expect(
      decidePlanChange({
        ...plus,
        pendingPlan: "none",
        intent: { kind: "resume" },
      }),
    ).toEqual({ kind: "resume" });
    expect(
      decidePlanChange({ ...plus, intent: { kind: "resume" } }),
    ).toMatchObject({ code: "nothing_to_resume" });
    // Un `pending_plan` VACÍO no es una cancelación programada ([R1-N8]).
    expect(
      decidePlanChange({
        ...plus,
        pendingPlan: "",
        intent: { kind: "resume" },
      }),
    ).toMatchObject({ code: "nothing_to_resume" });
    expect(
      decidePlanChange({
        ...plus,
        status: "canceled",
        pendingPlan: "none",
        intent: { kind: "resume" },
      }),
    ).toMatchObject({ code: "nothing_to_resume" });
  });
});
