import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  subscriptionOffers,
  type SubscriptionOffers,
  type SubscriptionView,
} from "./billing";

/** Espía de las props que la CONSOLA le pasa al modal. Es la mitad del modal que un render
 * de carga no puede ver: el modal está cerrado hasta que alguien lo aprieta. */
const dialogProps = vi.hoisted(() => ({
  last: null as null | Record<string, unknown>,
}));

vi.mock("../app/backoffice/subscription/cancel-dialog", () => ({
  CancelDialog: (props: Record<string, unknown>) => {
    dialogProps.last = props;
    return null;
  },
}));

import { SubscriptionConsole } from "../app/backoffice/subscription/subscription-console";

/**
 * Spec 0063, D7 — LA TABLA DE ESTADOS DE LA UI como función pura, y el modal que esa tabla
 * manda abrir. Sin base y sin un solo mock de red.
 *
 * CORTE QUE EL ENCARGO NO PREVEÍA, RATIFICADO POR EL ORQUESTADOR: la whitelist manda el
 * oráculo del helper nuevo en `billing-view.test.ts` y AHÍ NO ENTRA — medido al hook, con el
 * bloque adentro da **370 líneas** contra el límite de 300 (`EXIT=2`). Sibling, que es el
 * patrón que la spec ya aplicó doce veces; `billing-view.test.ts` queda con el DTO y las dos
 * allow-lists de texto.
 * LO QUE NO PINNEA: el CABLEADO de la PÁGINA. Acá la DECISIÓN dice X, no que el owner VEA X
 * — eso es `billing-pages.neon.integration.test.ts`. Es el hueco de `choosePushPromptView`
 * (tarea 38), donde un revisor reintrodujo el bug en el LLAMADOR con los 5 gates verdes.
 */

/**
 * LA TABLA DE D7, FILA POR FILA. El docblock de `subscriptionOffers` dice «guardas en orden,
 * primer match gana, ES NORMATIVO»: ésta es la única cosa que hace verdadera esa frase.
 *
 * El resumen colapsa LAS SIETE salidas en un string para que cada fila de D7 quepa en una
 * línea Y para que nada quede sin aseverar: si la función empezara a ofrecer algo DE MÁS, el
 * string cambia y la fila se pone roja. Se compara contra un literal escrito a mano — nunca
 * contra otra llamada a la función, que sería el oráculo circular.
 */
function summary(offers: SubscriptionOffers): string {
  return [
    offers.upgrade ?? "-",
    offers.downgrade?.endpoint.replace("/api/billing/", "") ?? "-",
    offers.intervalUpgrade ? "anual" : "-",
    offers.resume ? "resume" : "-",
    offers.pendingDowngrade ?? "-",
    offers.paymentPending ? "cobro" : "-",
    offers.noPlan ? "sin-plan" : "-",
  ].join(" ");
}

const AT = "2026-12-01T00:00:00.000Z";

const view = (o: Partial<SubscriptionView> = {}): SubscriptionView => ({
  plan: "free",
  status: "active",
  interval: null,
  pendingPlan: null,
  pendingPlanAt: null,
  ...o,
});

describe("subscriptionOffers — la tabla de D7 como función pura (spec 0063)", () => {
  it.each([
    // plan, status, interval, pendingPlan, pendingPlanAt, resumen
    ["free", "active", null, null, null, "Mejorar a Plus - - - - - -"],
    ["plus", "active", "month", null, null, "- cancel anual - - - -"],
    ["plus", "active", "year", null, null, "- cancel - - - - -"],
    ["plus", "active", null, null, null, "- cancel anual - - - -"],
    ["plus", "canceled", "month", null, null, "- cancel - - - - -"],
    ["plus", "incomplete_expired", "month", null, null, "- cancel - - - - -"],
    [
      "none",
      "canceled",
      null,
      null,
      null,
      "Volver a Plus settle-free - - - - sin-plan",
    ],
    ["plus", "active", "month", "free", AT, "- - - resume with_date - -"],
    ["plus", "active", "month", "free", null, "- - - resume without_date - -"],
    ["plus", "past_due", "month", null, null, "- - - - - cobro -"],
    ["plus", "unpaid", "month", null, null, "- - - - - cobro -"],
    ["plus", "past_due", "month", "free", AT, "- - - resume - cobro -"],
    ["plus", "active", "month", "", null, "- cancel anual - - - -"],
    ["enterprise", "active", null, null, null, "Mejorar a Plus - - - - - -"],
    ["none", "active", null, "free", AT, "- - - resume with_date - -"],
  ])(
    "plan=%s status=%s interval=%s pending=%s/%s → %s",
    (plan, status, interval, pendingPlan, pendingPlanAt, expected) => {
      expect(
        summary(
          subscriptionOffers(
            view({ plan, status, interval, pendingPlan, pendingPlanAt }),
          ),
        ),
      ).toBe(expected);
    },
  );

  it("`past_due` con baja programada: gana la guarda 1 y SOBREVIVE «Reanudar»", () => {
    // PRECEDENCIA DECLARADA, no la intuitiva: el cobro pendiente esconde el cambio de plan y
    // de intervalo (DoD), pero `resume` queda — esconderlo dejaría al owner ATRAPADO, que es
    // el motivo por el que la ruta existe. DECISIÓN DEL IMPLEMENTADOR DE LA D2, en la spec.
    const offers = subscriptionOffers(
      view({ plan: "plus", status: "unpaid", pendingPlan: "free" }),
    );
    expect([offers.paymentPending, offers.resume]).toEqual([true, true]);
    // Y lo que la guarda 1 SÍ esconde, que es lo que el DoD exige:
    expect([offers.upgrade, offers.downgrade, offers.intervalUpgrade]).toEqual([
      null,
      null,
      false,
    ]);
    // La guarda 1 gana: el texto de la baja programada es de la guarda 2 y no aparece.
    expect(offers.pendingDowngrade).toBeNull();
  });

  it("una baja programada sobre `none` gana a la guarda del estado `none`", () => {
    // Fila anti-degeneración del ORDEN: si las guardas 2 y 3 se invirtieran, este caso
    // pasaría a decir «sin plan» y ofrecería las dos salidas de D10 sobre una suscripción que
    // todavía está viva hasta el fin del periodo.
    const offers = subscriptionOffers(
      view({ plan: "none", pendingPlan: "free", pendingPlanAt: AT }),
    );
    expect([offers.noPlan, offers.pendingDowngrade]).toEqual([
      false,
      "with_date",
    ]);
  });

  it("«plus con la suscripción MUERTA» conserva la salida 2 de D10", () => {
    // LAS DOS SALIDAS de ese estado (spec, corrección del orquestador): D8 reconcilia, y el
    // BOTÓN de D10 sigue estando. Si esta fila perdiera el botón, `already_on_plan` sería un
    // callejón sin salida cuando Stripe no tiene nada que contar. El cableado de las dos
    // juntas está en `billing-pages.neon.integration.test.ts`.
    const offers = subscriptionOffers(
      view({ plan: "plus", status: "canceled", interval: "month" }),
    );
    expect(offers.downgrade).toEqual({
      label: "Bajar a Free",
      endpoint: "/api/billing/cancel",
    });
    // Y NO se ofrece cambiar el intervalo de una suscripción que ya no existe.
    expect(offers.intervalUpgrade).toBe(false);
  });

  it("el estado `none` ofrece sus DOS salidas, y la baja va por `settle-free`", () => {
    const offers = subscriptionOffers(view({ plan: "none", status: "active" }));
    expect(offers.upgrade).toBe("Volver a Plus");
    expect(offers.downgrade).toEqual({
      label: "Ajustarme y bajar a Free",
      endpoint: "/api/billing/settle-free",
    });
  });

  it("las etiquetas salen de la allow-list, nunca el string crudo", () => {
    const offers = subscriptionOffers(
      view({ plan: "enterprise", status: "future_status" }),
    );
    expect([offers.plan, offers.status]).toEqual([
      "Plan no disponible",
      "en revisión",
    ]);
  });
});

/**
 * EL MODAL DE CONDICIONES, EN SUS DOS MITADES — y las dos SIN base y SIN paquetes nuevos.
 *
 * POR QUÉ NO ALCANZA EL RENDER DE LA PÁGINA, medido y no supuesto: el modal está CERRADO en
 * la carga (`ConfirmDialog` devuelve `null` con `open=false`) y abrirlo exige un click, que
 * `renderToStaticMarkup` no hace. La primera versión del test de integración aseveraba «hoy
 * tienes 2» sobre el HTML de carga y salió ROJA por eso.
 *
 * INTENTADO ANTES DE DECLARAR UN LÍMITE (`CLAUDE.md`, y la trampa de la spec 0057, donde el
 * límite sobredimensionado viajó a dos docs): se cierran las dos mitades sin el click.
 *
 *  1. EL CABLEADO: se renderiza la CONSOLA con el módulo del modal doblado, y se asevera qué
 *     props le pasó. Ahí se ve que el texto sale del SERVIDOR y no de un segundo string.
 *  2. EL CONTENIDO: se renderiza el modal REAL con `open`, y se asevera el mensaje, el link y
 *     que «Confirmar» no está disponible.
 *
 * SIN ORÁCULO, declarado: que apretar el botón ponga `open` en true — una línea
 * (`setConfirming(true)`) que sólo cerraría simular el click. */
const consoleProps = (o: Partial<Record<string, unknown>> = {}) => ({
  subscription: view({ plan: "plus", interval: "month" }),
  offers: subscriptionOffers(view({ plan: "plus", interval: "month" })),
  activeLocations: 3,
  canCancel: false,
  downgradeBlock: {
    message:
      "Para volver a Free necesitas 1 local activo; hoy tienes 3. Archiva 2.",
    archiveCount: 2,
  },
  stripeUnconfirmed: false,
  timezone: "America/Guayaquil",
  notice: null,
  ...o,
});

describe("el modal de la baja (spec 0063, D7 / ADR 0058 §8)", () => {
  it("la consola le pasa el mensaje DEL SERVIDOR, no un segundo texto propio", () => {
    dialogProps.last = null;
    renderToStaticMarkup(
      createElement(SubscriptionConsole, consoleProps() as never),
    );
    expect(dialogProps.last).toMatchObject({
      title: "Bajar a Free",
      block: {
        message:
          "Para volver a Free necesitas 1 local activo; hoy tienes 3. Archiva 2.",
        archiveCount: 2,
      },
    });
  });

  it("con `canCancel` en true el modal NO recibe bloqueo: «Confirmar» procede", () => {
    dialogProps.last = null;
    renderToStaticMarkup(
      createElement(
        SubscriptionConsole,
        consoleProps({ canCancel: true, activeLocations: 1 }) as never,
      ),
    );
    expect(dialogProps.last).toMatchObject({ block: null });
  });

  it("sin `downgradeBlock`, el modal recibe el texto genérico y no un «archiva N» falso", () => {
    // MUTACIÓN S11: sacar el fallback dejaba 68/68 VERDE. Con `canCancel === false` y sin
    // bloqueo por locales (`already_on_plan`), no se ofrece «Confirmar» ni un conteo falso.
    dialogProps.last = null;
    renderToStaticMarkup(
      createElement(
        SubscriptionConsole,
        consoleProps({ downgradeBlock: null }) as never,
      ),
    );
    expect(dialogProps.last).toMatchObject({
      block: { message: "Esta baja no está disponible para tu plan actual." },
    });
  });

  it("el modal REAL dice qué archivar, linkea a Locales y no ofrece «Confirmar»", async () => {
    const { CancelDialog } = await vi.importActual<
      typeof import("../app/backoffice/subscription/cancel-dialog")
    >("../app/backoffice/subscription/cancel-dialog");
    const html = renderToStaticMarkup(
      createElement(CancelDialog, {
        open: true,
        title: "Bajar a Free",
        block: {
          message:
            "Para volver a Free necesitas 1 local activo; hoy tienes 3. Archiva 2.",
          archiveCount: 2,
        },
        busy: false,
        onCancel: () => {},
        onConfirm: () => {},
      }),
    );
    expect(html).toContain("hoy tienes 3");
    expect(html).toContain("Archiva 2");
    expect(html).toContain('href="/backoffice/locations"');
    // «Confirmar» EXISTE pero NO está disponible: el owner tiene que poder leer qué va a
    // confirmar. El `disabled` va en el botón de confirmar, no en el de volver.
    expect(html).toContain(
      '<button class="button danger" type="button" disabled="">Confirmar</button>',
    );
  });

  it("sin bloqueo, «Confirmar» está disponible", async () => {
    const { CancelDialog } = await vi.importActual<
      typeof import("../app/backoffice/subscription/cancel-dialog")
    >("../app/backoffice/subscription/cancel-dialog");
    const html = renderToStaticMarkup(
      createElement(CancelDialog, {
        open: true,
        title: "Bajar a Free",
        block: null,
        busy: false,
        onCancel: () => {},
        onConfirm: () => {},
      }),
    );
    // Control que hace discriminar al test de arriba: mismo componente, sin `disabled`.
    expect(html).toContain(
      '<button class="button danger" type="button">Confirmar</button>',
    );
    expect(html).not.toContain("/backoffice/locations");
  });
});
