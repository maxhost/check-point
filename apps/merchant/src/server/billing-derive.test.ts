import { describe, expect, it } from "vitest";
import { planFromSubscription, type SubscriptionWrite } from "./billing";
import {
  BASE_MONTHLY_PRICE,
  BASE_YEARLY_PRICE,
  CANCEL_AT_SECONDS,
  CANCEL_AT_YEAR,
  DELETED_EVENT,
  MONTHLY_PRICE,
  PERIOD_END_YEAR,
  PRICE_IDS,
  UPDATED_EVENT,
  YEARLY_PRICE,
  subscriptionFake,
  subscriptionRow,
} from "./billing-derive-support";

/**
 * Spec 0063, D5.d-f + spec 0189 §D5 / T6 — `planFromSubscription`. El principio del archivo
 * entero: el payload es un DISPARADOR, no una fuente de datos; `subscription` acá es siempre lo
 * que devuelve `subscriptions.retrieve(...)`.
 */

const derive = (args: {
  event?: { type: string; created: number };
  subscription?: ReturnType<typeof subscriptionFake>;
  row?: ReturnType<typeof subscriptionRow>;
}): SubscriptionWrite =>
  planFromSubscription({
    event: args.event ?? UPDATED_EVENT,
    subscription: args.subscription ?? subscriptionFake(),
    row: args.row ?? subscriptionRow(),
    priceIds: PRICE_IDS,
  });

const NO_PENDING = {
  pendingPlan: null,
  pendingPlanAt: null,
  clearDowngradeRequest: false,
} as const;

describe("planFromSubscription — los 8 status conocidos + uno inventado", () => {
  it.each<[string, SubscriptionWrite]>([
    [
      "active",
      { plan: "plus", interval: "month", status: "active", ...NO_PENDING },
    ],
    [
      "trialing",
      { plan: "plus", interval: "month", status: "trialing", ...NO_PENDING },
    ],
    // `past_due` | `incomplete` | `unpaid` | `paused`: el plan NO se toca (ADR 0059 — el
    // impago bloquea el acceso, no degrada). `plan` AUSENTE, no `null`.
    ["past_due", { status: "past_due", ...NO_PENDING }],
    ["unpaid", { status: "unpaid", ...NO_PENDING }],
    ["incomplete", { status: "incomplete", ...NO_PENDING }],
    ["paused", { status: "paused", ...NO_PENDING }],
    // Terminales sobre un plan PAGO → `none` (spec 0189: no hay plan gratis al que caer).
    [
      "canceled",
      {
        plan: "none",
        status: "canceled",
        pendingPlan: null,
        pendingPlanAt: null,
        clearDowngradeRequest: true,
      },
    ],
    [
      "incomplete_expired",
      {
        plan: "none",
        status: "incomplete_expired",
        pendingPlan: null,
        pendingPlanAt: null,
        clearDowngradeRequest: true,
      },
    ],
    // Desconocido: no otorga un plan pago (allow-list POSITIVA) y deja el motivo escrito.
    [
      "future_status",
      {
        status: "future_status",
        ignoredReason: "unknown_status",
        ...NO_PENDING,
      },
    ],
  ])("status %s", (status, expected) => {
    expect(derive({ subscription: subscriptionFake({ status }) })).toEqual(
      expected,
    );
  });
});

describe("planFromSubscription — eventos terminales (spec 0189 §D5)", () => {
  it.each([null, new Date("2026-09-01T00:00:00Z")])(
    "un `deleted` sobre un plan pago → `none` (downgrade_requested_at = %s: es auditoría, no decide)",
    (downgradeRequestedAt) => {
      // `cancel_at_period_end` sigue en `true` en un `deleted` («will … or DID cancel»).
      expect(
        derive({
          event: DELETED_EVENT,
          subscription: subscriptionFake({
            status: "canceled",
            cancel_at_period_end: true,
          }),
          row: subscriptionRow({ plan: "plus", downgradeRequestedAt }),
        }),
      ).toEqual({
        plan: "none",
        status: "canceled",
        pendingPlan: null,
        pendingPlanAt: null,
        clearDowngradeRequest: true,
      });
    },
  );

  it("una tarjeta rechazada EN LA PRUEBA no quita la prueba: `trial` sin `plan` [R2-7]", () => {
    expect(
      derive({
        subscription: subscriptionFake({ status: "incomplete_expired" }),
        row: subscriptionRow({ plan: "trial" }),
      }),
    ).toEqual({
      status: "incomplete_expired",
      pendingPlan: null,
      pendingPlanAt: null,
      clearDowngradeRequest: true,
    });
  });

  it("el mismo `incomplete_expired` sobre un plan PAGO → `none` (base y plus)", () => {
    for (const plan of ["base", "plus"]) {
      expect(
        derive({
          subscription: subscriptionFake({ status: "incomplete_expired" }),
          row: subscriptionRow({ plan }),
        }),
      ).toMatchObject({ plan: "none" });
    }
  });
});

describe("planFromSubscription — price, pausa e intervalo", () => {
  it("`pause_collection` no nulo con status `active` NO otorga `plus`", () => {
    // El cobro pausado no cambia el `status` («will be unchanged», Subscriptions.d.ts),
    // así que sin este guard un negocio pausado seguiría contando como Plus.
    expect(
      derive({
        subscription: subscriptionFake({
          status: "active",
          pause_collection: { behavior: "void", resumes_at: null },
        }),
      }),
    ).toEqual({ status: "active", ...NO_PENDING });
  });

  it("un price que no es ninguno de los nuestros deja el plan sin tocar", () => {
    expect(
      derive({
        subscription: subscriptionFake({ items: [{ priceId: "price_otro" }] }),
      }),
    ).toEqual({
      status: "active",
      ignoredReason: "unknown_price",
      ...NO_PENDING,
    });
  });

  it("un evento TERMINAL con un price ajeno escribe el plan IGUAL (precedencia)", () => {
    // D5.d enumera «price desconocido → el plan NO se toca + `ignored_reason`» pero no
    // declara qué gana cuando el evento además es terminal. La precedencia elegida, ahora
    // comentada en `derive.ts`: lo terminal GANA, porque un `deleted` dice que la
    // suscripción se terminó y eso no depende del price. El contraste es el test de arriba:
    // el MISMO price ajeno, sin evento terminal, deja el plan sin tocar con `unknown_price`.
    expect(
      derive({
        event: DELETED_EVENT,
        subscription: subscriptionFake({ items: [{ priceId: "price_otro" }] }),
        row: subscriptionRow({ plan: "plus" }),
      }),
    ).toEqual({
      plan: "none",
      status: "active",
      pendingPlan: null,
      pendingPlanAt: null,
      clearDowngradeRequest: true,
    });
  });

  it("los CUATRO precios → plan + intervalo del que matcheó (spec 0189 §D5)", () => {
    const cases: Array<[string, string, string]> = [
      [BASE_MONTHLY_PRICE, "base", "month"],
      [BASE_YEARLY_PRICE, "base", "year"],
      [MONTHLY_PRICE, "plus", "month"],
      [YEARLY_PRICE, "plus", "year"],
    ];
    for (const [priceId, plan, interval] of cases) {
      expect(
        derive({
          subscription: subscriptionFake({ items: [{ priceId }] }),
          row: subscriptionRow({ plan: "trial" }),
        }),
        priceId,
      ).toEqual({ plan, interval, status: "active", ...NO_PENDING });
    }
  });

  it("el intervalo sale del price que MATCHEÓ, no de `data[0]`", () => {
    expect(
      derive({
        subscription: subscriptionFake({
          items: [{ priceId: "price_otro" }, { priceId: YEARLY_PRICE }],
        }),
      }),
    ).toMatchObject({ plan: "plus", interval: "year" });
    expect(
      derive({
        subscription: subscriptionFake({
          items: [{ priceId: "price_otro" }, { priceId: MONTHLY_PRICE }],
        }),
      }),
    ).toMatchObject({ plan: "plus", interval: "month" });
  });
});

describe("planFromSubscription — jerarquía de `pending_plan` (D5.f)", () => {
  it("un `deleted` con `cancel_at_period_end: true` deja `pending_plan` en NULL", () => {
    // Rama 1, INCONDICIONAL. Sin ella la fila quedaba `plan='none'` Y `pending_plan='none'`:
    // la UI diciendo «tu suscripción termina el …» con la suscripción ya terminada.
    expect(
      derive({
        event: DELETED_EVENT,
        subscription: subscriptionFake({
          status: "canceled",
          cancel_at_period_end: true,
        }),
        row: subscriptionRow({
          downgradeRequestedAt: new Date("2026-09-01T00:00:00Z"),
        }),
      }),
    ).toMatchObject({ pendingPlan: null, pendingPlanAt: null });
  });

  it("`cancel_at` seteado con `cancel_at_period_end: false` programa la baja igual", () => {
    // `cancel_at` es INDEPENDIENTE de `cancel_at_period_end` y se setea desde el dashboard.
    const write = derive({
      subscription: subscriptionFake({
        cancel_at: CANCEL_AT_SECONDS,
        cancel_at_period_end: false,
      }),
    });
    expect(write).toMatchObject({ plan: "plus", pendingPlan: "none" });
    expect(write.pendingPlanAt?.getUTCFullYear()).toBe(CANCEL_AT_YEAR);
  });

  it("con `cancel_at_period_end` la fecha sale del periodo, en SEGUNDOS unix", () => {
    const write = derive({
      subscription: subscriptionFake({ cancel_at_period_end: true }),
    });
    expect(write).toMatchObject({ pendingPlan: "none" });
    // La aserción del AÑO es la que caza el bug de 1970 (`new Date(x)` sin `* 1000`).
    expect(write.pendingPlanAt?.getUTCFullYear()).toBe(PERIOD_END_YEAR);
  });

  it("`items.data` vacío NO tira: `pending_plan` puesto y la fecha en null", () => {
    const write = derive({
      subscription: subscriptionFake({ items: [], cancel_at_period_end: true }),
    });
    expect(write).toEqual({
      status: "active",
      ignoredReason: "unknown_price",
      pendingPlan: "none",
      pendingPlanAt: null,
      clearDowngradeRequest: false,
    });
  });

  it("sin baja programada, `pending_plan` queda en NULL", () => {
    expect(derive({})).toMatchObject({
      pendingPlan: null,
      pendingPlanAt: null,
      clearDowngradeRequest: false,
    });
  });
});
