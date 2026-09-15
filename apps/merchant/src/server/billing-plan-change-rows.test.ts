import { describe, expect, it } from "vitest";
import { decidePlanChange, type PlanChangeInput } from "./billing";

/**
 * Spec 0063, D4 — los casos NOMBRADOS, con la salida escrita LITERAL. Cada uno mató una
 * versión anterior de alguna regla, así que son el oráculo que de verdad pinnea; la matriz
 * completa del dominio vive en `billing-plan-change.test.ts` (archivo aparte por el límite
 * de 300 líneas del repo, no por otra razón).
 */

const base: PlanChangeInput = {
  currentPlan: "free",
  currentInterval: null,
  pendingPlan: null,
  status: "active",
  stripeSubscriptionId: null,
  activeLocations: 1,
  intent: { kind: "upgrade", interval: "month" },
};

/** Cada fila mató una versión anterior de alguna regla; la salida va literal. */
describe("decidePlanChange — las filas que mataron una regla (spec 0063)", () => {
  it("los 9 `free` de prod (active, sin id) pasan el gate de checkout", () => {
    expect(decidePlanChange(base)).toEqual({
      kind: "checkout",
      interval: "month",
    });
  });

  it("un status DESCONOCIDO con id bloquea el checkout: lo no muerto cuenta como vivo", () => {
    expect(
      decidePlanChange({
        ...base,
        currentPlan: "plus",
        status: "future_status",
        stripeSubscriptionId: "sub_x",
      }),
    ).toMatchObject({ kind: "blocked", code: "subscription_live" });
  });

  it("`incomplete_expired` sobre un negocio free NO bloquea un checkout nuevo", () => {
    expect(
      decidePlanChange({
        ...base,
        status: "incomplete_expired",
        stripeSubscriptionId: "sub_x",
      }),
    ).toEqual({ kind: "checkout", interval: "month" });
  });

  it("desde `none`, con 1 activo, bajar a free se salda SIN tocar Stripe", () => {
    expect(
      decidePlanChange({
        ...base,
        currentPlan: "none",
        intent: { kind: "downgrade" },
      }),
    ).toEqual({ kind: "settle_to_free" });
  });

  it("A1 (`plus` sin suscripción) con 1 activo también se salda local", () => {
    expect(
      decidePlanChange({
        ...base,
        currentPlan: "plus",
        intent: { kind: "downgrade" },
      }),
    ).toEqual({ kind: "settle_to_free" });
  });

  it("`plus` vivo con 1 activo programa la baja contra Stripe", () => {
    expect(
      decidePlanChange({
        ...base,
        currentPlan: "plus",
        stripeSubscriptionId: "sub_x",
        intent: { kind: "downgrade" },
      }),
    ).toEqual({ kind: "schedule_downgrade" });
  });

  it("`plus` con `interval` NULL (A1) puede pasar a anual", () => {
    expect(
      decidePlanChange({
        ...base,
        currentPlan: "plus",
        stripeSubscriptionId: "sub_x",
        intent: { kind: "change_interval", to: "year" },
      }),
    ).toEqual({ kind: "change_interval", to: "year" });
  });

  it("anual → mensual está fuera de alcance por diseño (D9, tarea 55)", () => {
    expect(
      decidePlanChange({
        ...base,
        currentPlan: "plus",
        currentInterval: "year",
        stripeSubscriptionId: "sub_x",
        intent: { kind: "change_interval", to: "month" },
      }),
    ).toMatchObject({
      kind: "blocked",
      code: "interval_downgrade_unsupported",
    });
  });

  it("PRECEDENCIA declarada: con 2 activos y plan free gana `downgrade_blocked`", () => {
    // La guarda 1 va ANTES que la 2. Es el orden DECLARADO, no el intuitivo (lo intuitivo
    // sería `already_on_plan`: el negocio ya está en free).
    expect(
      decidePlanChange({
        ...base,
        currentPlan: "free",
        activeLocations: 2,
        intent: { kind: "downgrade" },
      }),
    ).toMatchObject({
      kind: "blocked",
      code: "downgrade_blocked",
      archiveCount: 1,
    });
  });

  it("`archiveCount` sale del tope de free, no de un número inventado", () => {
    expect(
      decidePlanChange({
        ...base,
        currentPlan: "plus",
        stripeSubscriptionId: "sub_x",
        activeLocations: 3,
        intent: { kind: "downgrade" },
      }),
    ).toMatchObject({ code: "downgrade_blocked", archiveCount: 2 });
  });

  /**
   * HALLAZGO — CONTRADICCIÓN DENTRO DE LA SPEC, resuelta a favor de la lista de guardas.
   *
   * El §Plan de pruebas de la 0063 pide dos filas que la propia D4 no puede producir:
   * «`plus`/`canceled`/con id/upgrade → checkout» y «`plus`/`incomplete_expired`/upgrade →
   * checkout». Con las guardas declaradas, la 1 no dispara (la suscripción está MUERTA,
   * así que no hay `subscription_live`) pero la 2 sí: `currentPlan === 'plus'` →
   * `already_on_plan`. Los dos tests de abajo transcriben lo que la LISTA ORDENADA dice,
   * que es la fuente de verdad declarada en el contrato y en la propia D4.
   *
   * No es un callejón: D10 da la salida en dos pasos —`downgrade` sobre ese mismo estado
   * devuelve `settle_to_free` (limpia plan e id) y después `checkout` procede— y así lo
   * dice D10 literalmente («con el id limpio, `hasLiveSubscription` es falso»). Queda como
   * hallazgo para el orquestador: si el owner quiere el checkout en UN paso, cambia la
   * guarda 2, y eso es un cambio de contrato, no algo que se arregle acá.
   */
  it("HALLAZGO: `plus` + `canceled` + upgrade → `already_on_plan` (guarda 2), no checkout", () => {
    expect(
      decidePlanChange({
        ...base,
        currentPlan: "plus",
        status: "canceled",
        stripeSubscriptionId: "sub_x",
      }),
    ).toMatchObject({ kind: "blocked", code: "already_on_plan" });
  });

  it("HALLAZGO: `plus` + `incomplete_expired` + upgrade → `already_on_plan` (guarda 2)", () => {
    expect(
      decidePlanChange({
        ...base,
        currentPlan: "plus",
        status: "incomplete_expired",
        stripeSubscriptionId: "sub_x",
      }),
    ).toMatchObject({ kind: "blocked", code: "already_on_plan" });
  });
});
