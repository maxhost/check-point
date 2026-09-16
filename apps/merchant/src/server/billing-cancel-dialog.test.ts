import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { subscriptionOffers, type SubscriptionView } from "./billing";

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
 * Spec 0064, fase B — EL MODAL DE LA BAJA, SACADO DE `billing-offers.test.ts`.
 *
 * CORTE DE TAMAÑO HECHO ANTES DE AGREGAR: ese archivo estaba en 299/300 al hook y esta fase le
 * suma props al modal (`renewalAt`, `timezone`) más los dos casos del aviso nuevo. Sibling, que
 * es el patrón que esta spec ya aplicó doce veces; `billing-offers.test.ts` queda sólo con la
 * tabla pura de D7 y sus dos allow-lists de texto.
 */

const view = (o: Partial<SubscriptionView> = {}): SubscriptionView => ({
  plan: "free",
  status: "active",
  interval: null,
  pendingPlan: null,
  pendingPlanAt: null,
  ...o,
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
    code: "downgrade_blocked",
  },
  facts: { renewalAt: null, lastPaidInvoice: null },
  stripeUnconfirmed: false,
  timezone: "America/Guayaquil",
  notice: null,
  ...o,
});

/** El 1 de diciembre de 2026, a mediodía UTC, es el mismo día calendario en Guayaquil
 * (UTC−5) que en UTC: la fecha conveniente de abajo no depende de en qué borde del día caiga
 * el reloj del que corre el test. */
const RENEWAL = "2026-12-01T12:00:00.000Z";

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
        code: "downgrade_blocked",
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
          code: "downgrade_blocked",
        },
        busy: false,
        renewalAt: null,
        timezone: "America/Guayaquil",
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

  it("el bloqueo por CAMPAÑAS linkea a Campañas, no a Locales (spec 0065, fase D)", async () => {
    // El discriminante es el `code`, no el texto: con dos bloqueos y un solo link, el
    // owner con campañas activas terminaba en Locales, donde no hay nada que hacer.
    const { CancelDialog } = await vi.importActual<
      typeof import("../app/backoffice/subscription/cancel-dialog")
    >("../app/backoffice/subscription/cancel-dialog");
    const html = renderToStaticMarkup(
      createElement(CancelDialog, {
        open: true,
        title: "Bajar a Free",
        block: {
          message:
            "Para volver a Free no puedes tener campañas activas; hoy tienes 2. Desactiva 2.",
          code: "downgrade_blocked_campaigns",
        },
        busy: false,
        renewalAt: null,
        timezone: "America/Guayaquil",
        onCancel: () => {},
        onConfirm: () => {},
      }),
    );
    expect(html).toContain("hoy tienes 2");
    expect(html).toContain('href="/backoffice/marketing"');
    expect(html).not.toContain("/backoffice/locations");
    expect(html).toContain(
      '<button class="button danger" type="button" disabled="">Confirmar</button>',
    );
  });

  it("un bloqueo SIN `code` muestra el mensaje y NINGÚN link", async () => {
    // Es el fallback de la consola (`already_on_plan`): no hay pantalla a donde mandar, y
    // un link inventado llevaría al owner a buscar algo que no existe.
    const { CancelDialog } = await vi.importActual<
      typeof import("../app/backoffice/subscription/cancel-dialog")
    >("../app/backoffice/subscription/cancel-dialog");
    const html = renderToStaticMarkup(
      createElement(CancelDialog, {
        open: true,
        title: "Bajar a Free",
        block: {
          message: "Esta baja no está disponible para tu plan actual.",
          code: null,
        },
        busy: false,
        renewalAt: null,
        timezone: "America/Guayaquil",
        onCancel: () => {},
        onConfirm: () => {},
      }),
    );
    expect(html).toContain("Esta baja no está disponible para tu plan actual.");
    expect(html).not.toContain("<a ");
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
        renewalAt: null,
        timezone: "America/Guayaquil",
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

/**
 * Spec 0064 / ADR 0063 — EL AVISO DE CUÁNDO CONVIENE BAJAR, que vive EN ESTE MODAL (respuesta
 * 3 del owner: no como cartel permanente, sino en el momento en que el merchant está por
 * perder plata).
 *
 * LOS DOS CASOS SON EL ÍTEM DEL DoD, y el segundo es el que importa: sin `renewalAt` el aviso
 * se OMITE y no se inventa una fecha. Es un caso REAL, no defensivo — `readBillingFacts`
 * devuelve `null` ante cualquier fallo de Stripe y ante un negocio sin suscripción, así que la
 * rama sin fecha se recorre en producción. La forma en que esto se rompe no es ruidosa: un
 * `new Date(null)` da el epoch y el modal diría «conviene dar de baja el 30 de diciembre de
 * 1969» con toda la suite en verde.
 */
describe("el aviso de cuándo conviene bajar (spec 0064, ADR 0063)", () => {
  const realDialog = async () =>
    (
      await vi.importActual<
        typeof import("../app/backoffice/subscription/cancel-dialog")
      >("../app/backoffice/subscription/cancel-dialog")
    ).CancelDialog;

  const render = async (renewalAt: string | null) =>
    renderToStaticMarkup(
      createElement(await realDialog(), {
        open: true,
        title: "Bajar a Free",
        block: null,
        busy: false,
        renewalAt,
        timezone: "America/Guayaquil",
        onCancel: () => {},
        onConfirm: () => {},
      }),
    );

  it("con fecha de renovación dice que es inmediata, sin devolución, y da la fecha conveniente", async () => {
    const html = await render(RENEWAL);
    // Las dos condiciones que el owner tiene que leer ANTES de confirmar (ADR 0063).
    expect(html).toContain("La baja es inmediata");
    expect(html).toContain("no se devuelve el tiempo que ya pagaste");
    // Hasta cuándo pagó: la renovación misma.
    expect(html).toContain("1 de diciembre de 2026");
    // Y la fecha CONVENIENTE = renovación − 2 días. El literal va escrito a mano y no
    // calculado con la misma resta que el código, que sería el oráculo circular.
    expect(html).toContain("29 de noviembre de 2026");
  });

  it("SIN fecha de renovación omite el aviso entero y no inventa ninguna fecha", async () => {
    const html = await render(null);
    // Sigue diciendo lo que la baja hace…
    expect(html).toContain("La baja es inmediata");
    // …y NO dice ni «ya pagaste hasta» ni «conviene».
    expect(html).not.toContain("Ya pagaste hasta");
    expect(html).not.toContain("conviene");
    // PISO DE LA ASERCIÓN, y el que caza el bug real: un `new Date(null)` formatea el epoch.
    expect(html).not.toContain("1969");
    expect(html).not.toContain("1970");
    expect(html).not.toContain("Invalid Date");
  });
});
