import { describe, expect, it } from "vitest";

import { readBillingFacts } from "./billing";
import { PERIOD_END_YEAR } from "./billing-derive-support";
import {
  fakeStripe,
  stripeInvoice,
  stripeSubscription,
  type FakeStripe,
} from "./billing-stripe-fake";

/**
 * Spec 0064, A4 — `readBillingFacts`: la fecha de renovación y la última factura PAGADA.
 *
 * UNIT y no integración a propósito: la función no toca la base, sólo el gateway. Acá corre
 * SIEMPRE —sin `skipIf` y sin credenciales— y los casos peligrosos (Stripe tirando, una lista
 * desordenada, una lista vacía) se construyen a mano, que es justo lo que ninguna corrida
 * contra Stripe produce a pedido.
 */
const IDS = { stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" };

function withSubscription(fake: FakeStripe, items?: { priceId: string }[]) {
  fake.subscriptions.set(
    "sub_1",
    stripeSubscription({ id: "sub_1", items, customer: "cus_1" }),
  );
}

describe("readBillingFacts — la renovación (spec 0064, A4)", () => {
  it("sale de `items.data[0].current_period_end`, en unix SEGUNDOS", async () => {
    const fake = fakeStripe();
    withSubscription(fake);
    const facts = await readBillingFacts(fake.gateway, IDS);
    // El AÑO, no el timestamp: sin el `* 1000` la fecha cae en 1970 y el bug es VISUAL.
    expect(facts.renewalAt?.getUTCFullYear()).toBe(PERIOD_END_YEAR);
  });

  it("con `items.data` VACÍO devuelve `null` y NO tira", async () => {
    // `items` es un `ApiList` truncado y sin orden contractual: `data[0]` pelado sobre la
    // lista vacía tira `TypeError` y se lleva puesto el render de la página entera.
    const fake = fakeStripe();
    withSubscription(fake, []);
    await expect(readBillingFacts(fake.gateway, IDS)).resolves.toMatchObject({
      renewalAt: null,
    });
  });

  it("sin `stripeSubscriptionId` no llama a Stripe ni una vez", async () => {
    const fake = fakeStripe();
    const facts = await readBillingFacts(fake.gateway, {
      ...IDS,
      stripeSubscriptionId: null,
    });
    expect(facts.renewalAt).toBeNull();
    expect(fake.calls).toEqual(["invoices.list"]);
  });
});

describe("readBillingFacts — la última factura pagada (spec 0064, A4)", () => {
  const older = stripeInvoice({
    id: "in_vieja",
    created: 2000,
    amountPaid: 999,
  });
  const newer = stripeInvoice({
    id: "in_nueva",
    created: 3000,
    amountPaid: 1500,
    currency: "usd",
    hostedInvoiceUrl: "https://stripe.test/recibo",
  });

  it("elige la de `created` MÁXIMO, NO `data[0]`", async () => {
    // Que la lista venga ordenada descendente NO es contractual. Este archivo la manda al
    // revés a propósito: con `data[0]` el owner ve el importe de una factura vieja.
    const fake = fakeStripe();
    withSubscription(fake);
    fake.invoices = [older, newer];
    const facts = await readBillingFacts(fake.gateway, IDS);
    expect(facts.lastPaidInvoice).toEqual({
      amountPaid: 1500,
      currency: "usd",
      receiptUrl: "https://stripe.test/recibo",
    });
  });

  it("le pide a Stripe las PAGADAS de ese customer, no todas", async () => {
    // Sin `status: "paid"` la lista trae también las `open` y las `draft`, y la «última» sería
    // una factura que el merchant NO pagó — con su importe y su link.
    const fake = fakeStripe();
    withSubscription(fake);
    fake.invoices = [newer];
    await readBillingFacts(fake.gateway, IDS);
    expect(fake.invoiceParams[0]).toEqual({
      customer: "cus_1",
      status: "paid",
      limit: 10,
    });
  });

  it("con la lista VACÍA devuelve `null`, no un importe inventado", async () => {
    const fake = fakeStripe();
    withSubscription(fake);
    const facts = await readBillingFacts(fake.gateway, IDS);
    expect(facts.lastPaidInvoice).toBeNull();
  });

  it("sin `stripeCustomerId` no pide facturas", async () => {
    const fake = fakeStripe();
    withSubscription(fake);
    const facts = await readBillingFacts(fake.gateway, {
      ...IDS,
      stripeCustomerId: null,
    });
    expect(facts.lastPaidInvoice).toBeNull();
    expect(fake.calls).not.toContain("invoices.list");
  });

  it.each([
    ["los dos links", "https://stripe.test/hosted", "https://stripe.test/pdf"],
    ["sólo el PDF", null, "https://stripe.test/pdf"],
    ["ninguno", null, null],
  ])(
    "el recibo es `hosted_invoice_url` con fallback a `invoice_pdf` — %s",
    async (_caso, hosted, pdf) => {
      const fake = fakeStripe();
      withSubscription(fake);
      fake.invoices = [
        stripeInvoice({
          created: 10,
          hostedInvoiceUrl: hosted,
          invoicePdf: pdf,
        }),
      ];
      const facts = await readBillingFacts(fake.gateway, IDS);
      expect(facts.lastPaidInvoice?.receiptUrl).toBe(hosted ?? pdf);
    },
  );

  it("los dos campos AUSENTES (no `null`) también dan `null`", async () => {
    // El SDK los declara `?string | null`: hay que cubrir el `undefined` además del `null`, y
    // por eso el fallback es `??` y no `||`.
    const fake = fakeStripe();
    withSubscription(fake);
    fake.invoices = [stripeInvoice({ created: 10 })];
    const facts = await readBillingFacts(fake.gateway, IDS);
    expect(facts.lastPaidInvoice?.receiptUrl).toBeNull();
  });
});

/**
 * EL CONTRATO CENTRAL DE A4: ESTA FUNCIÓN NO PUEDE TIRAR NUNCA. Mismo contrato que
 * `reconcileOnOpen` — una pantalla de plan no se cae porque Stripe no conteste, y menos la que
 * es la única salida de un estado de cobro.
 *
 * Los tres casos, incluido el AISLAMIENTO entre las dos llamadas: que una falle no puede
 * borrar el dato que la otra sí trajo. Con un solo `try` alrededor de las dos, el primero de
 * estos tests pasa y el segundo se pone rojo.
 */
describe("readBillingFacts — no tira NUNCA (spec 0064, A4)", () => {
  it("si `subscriptions.retrieve` falla, la factura SIGUE viajando", async () => {
    const fake = fakeStripe();
    withSubscription(fake);
    fake.retrieveError = new Error("stripe caído");
    fake.invoices = [stripeInvoice({ created: 10, amountPaid: 700 })];
    const facts = await readBillingFacts(fake.gateway, IDS);
    expect(facts.renewalAt).toBeNull();
    expect(facts.lastPaidInvoice?.amountPaid).toBe(700);
  });

  it("si `invoices.list` falla, la renovación SIGUE viajando", async () => {
    const fake = fakeStripe();
    withSubscription(fake);
    fake.invoicesError = new Error("stripe caído");
    const facts = await readBillingFacts(fake.gateway, IDS);
    expect(facts.lastPaidInvoice).toBeNull();
    expect(facts.renewalAt?.getUTCFullYear()).toBe(PERIOD_END_YEAR);
  });

  it("con las DOS caídas devuelve los dos campos en `null`", async () => {
    const fake = fakeStripe();
    fake.retrieveError = new Error("stripe caído");
    fake.invoicesError = new Error("stripe caído");
    await expect(readBillingFacts(fake.gateway, IDS)).resolves.toEqual({
      renewalAt: null,
      lastPaidInvoice: null,
    });
  });
});
