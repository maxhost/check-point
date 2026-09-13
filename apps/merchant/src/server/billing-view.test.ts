import { describe, expect, it } from "vitest";
import {
  planLabel,
  statusLabel,
  toSubscriptionView,
  type SubscriptionRow,
} from "./billing";

/**
 * Spec 0063, D7 — el DTO que llega al navegador y la allow-list de presentación.
 *
 * LO QUE ESTE ARCHIVO NO PINNEA, declarado en vez de disimulado:
 *
 *  - **El render del HTML**. La fase A lo dejó anotado como límite de INEXISTENCIA (la
 *    página no existía); desde la D2 existe y el render vive en
 *    `billing-pages.neon.integration.test.ts` — corte del orquestador, por NATURALEZA: este
 *    archivo es funciones puras sin un solo mock y el render exige `vi.mock("./auth-guards")`
 *    y base real. El límite NUNCA fue de herramienta: el `environment: "node"` del vitest de
 *    merchant alcanza para `renderToStaticMarkup` sin instalar nada.
 *
 *  - Por lo tanto lo de abajo pinnea la DECISIÓN («el DTO dice X», «la tabla de D7 ofrece
 *    X»), no el COMPORTAMIENTO («el usuario ve X»). El CABLEADO —que la PÁGINA le pase a la
 *    consola el DTO y no la fila— lo pinnea la INSPECCIÓN DE LAS PROPS del elemento en
 *    `billing-pages.neon.integration.test.ts`, y NO el render: `renderToStaticMarkup` no
 *    emite el payload RSC, así que el HTML nunca ve las props de un componente cliente
 *    (medido: la fila cruda dejaba 66/66 en verde). Es el hueco que `choosePushPromptView`
 *    dejó en la tarea 38, donde un revisor reintrodujo el bug en el LLAMADOR con los 5
 *    gates en verde.
 *
 * El conjunto de claves esperado está escrito A MANO acá y NO se importa de `view.ts`: con
 * una constante del módulo bajo prueba, agregar una clave a los dos lados dejaría el test
 * verde y el oráculo sería circular.
 */

/** Los tres campos internos que NUNCA pueden salir, con valores reconocibles a propósito:
 * si alguno viaja, se lo encuentra por substring en el JSON. */
const LEAKED_CUSTOMER = "cus_LEAK";
const LEAKED_SUBSCRIPTION = "sub_LEAK";
const DOWNGRADE_REQUESTED_AT = new Date("2026-08-07T04:05:06.000Z");

function rowWithSecrets(
  overrides: Partial<SubscriptionRow> = {},
): SubscriptionRow {
  return {
    businessId: "11111111-1111-1111-1111-111111111111",
    plan: "plus",
    interval: "month",
    status: "active",
    stripeCustomerId: LEAKED_CUSTOMER,
    stripeSubscriptionId: LEAKED_SUBSCRIPTION,
    pendingPlan: "free",
    pendingPlanAt: new Date("2026-12-01T00:00:00.000Z"),
    downgradeRequestedAt: DOWNGRADE_REQUESTED_AT,
    lastEventAt: new Date("2026-09-10T00:00:00.000Z"),
    ...overrides,
  };
}

describe("toSubscriptionView — allow-list POSITIVA de claves (spec 0063, D7)", () => {
  it("deja exactamente estas cinco claves, escritas a mano, y ninguna más", () => {
    expect(Object.keys(toSubscriptionView(rowWithSecrets())).sort()).toEqual([
      "interval",
      "pendingPlan",
      "pendingPlanAt",
      "plan",
      "status",
    ]);
  });

  it("las claves son las mismas aunque la fila venga con columnas de más", () => {
    // La fila real de `core.subscription` tiene columnas que el dominio no modela hoy; un
    // `select()` que se ensanche no puede arrastrarlas al navegador.
    const row = {
      ...rowWithSecrets(),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      stripePriceId: "price_SECRETO",
    } as unknown as SubscriptionRow;
    expect(Object.keys(toSubscriptionView(row)).sort()).toEqual([
      "interval",
      "pendingPlan",
      "pendingPlanAt",
      "plan",
      "status",
    ]);
  });

  it("ni los dos ids de Stripe ni `downgradeRequestedAt` aparecen en el JSON", () => {
    // El test de claves solo no alcanza: un valor puede viajar DENTRO de una clave
    // permitida. Por eso se busca por substring sobre el JSON completo.
    const json = JSON.stringify(toSubscriptionView(rowWithSecrets()));
    expect(json).not.toContain(LEAKED_CUSTOMER);
    expect(json).not.toContain(LEAKED_SUBSCRIPTION);
    expect(json).not.toContain("cus_");
    expect(json).not.toContain("sub_");
    expect(json).not.toContain(DOWNGRADE_REQUESTED_AT.toISOString());
    // Piso de la aserción: el JSON no está vacío ni es un objeto pelado, así que las
    // cuatro negativas de arriba no pasan por no haber mirado nada.
    expect(json).toContain("pendingPlanAt");
    expect(json.length).toBeGreaterThan(60);
  });

  it("copia los campos públicos tal cual, sin inventar ni normalizar", () => {
    expect(
      toSubscriptionView(
        rowWithSecrets({
          plan: "plus",
          status: "past_due",
          interval: "year",
          pendingPlan: null,
          pendingPlanAt: null,
        }),
      ),
    ).toEqual({
      plan: "plus",
      status: "past_due",
      interval: "year",
      pendingPlan: null,
      pendingPlanAt: null,
    });
  });
});

describe("toSubscriptionView — `pendingPlanAt` viaja como string ISO [R2-M4]", () => {
  it("es un string, no un `Date`", () => {
    // El test de claves NO ve esta diferencia —las claves son las mismas— y es la consola
    // la que lo formatea: un `Date` cruzando el límite server→client de Next se serializa
    // distinto según el camino.
    const view = toSubscriptionView(
      rowWithSecrets({ pendingPlanAt: new Date("2026-12-01T00:00:00.000Z") }),
    );
    expect(typeof view.pendingPlanAt).toBe("string");
    expect(view.pendingPlanAt).not.toBeInstanceOf(Date);
    expect(view.pendingPlanAt).toBe("2026-12-01T00:00:00.000Z");
  });

  it('`null` sigue siendo `null`, no la cadena "null" ni la época', () => {
    // El caso GARANTIZADO entre el 200 de `cancel` y el paso 4 de D6: baja programada sin
    // fecha. La UI lo dice sin fecha, así que el DTO no puede fabricarle una.
    expect(
      toSubscriptionView(
        rowWithSecrets({ pendingPlan: "free", pendingPlanAt: null }),
      ),
    ).toMatchObject({ pendingPlan: "free", pendingPlanAt: null });
  });
});

describe("planLabel — allow-list de presentación del PLAN (spec 0063, D7)", () => {
  it.each([
    ["free", "Free"],
    ["plus", "Plus"],
    ["none", "Sin plan"],
  ])("%s → «%s»", (plan, expected) => {
    expect(planLabel(plan)).toBe(expected);
  });

  it("`none` NUNCA dice «Free»: es justo lo que el estado existe para no hacer", () => {
    // Hoy la home hace `plan === "plus" ? "Plus" : "Free"` (`backoffice/page.tsx:62`), o
    // sea que `none` se mostraría como «Plan Free» — el ADR 0058 §12 dice que `none` NO es
    // ninguna de las suscripciones que existen, y mostrarlo como Free es mentirle al owner
    // sobre su plan.
    const label = planLabel("none");
    expect(label).toBe("Sin plan");
    expect(label.toLowerCase()).not.toContain("free");
  });

  it.each([["enterprise"], ["PLUS"], [""], ["plan'; drop table"]])(
    "un plan desconocido (%s) sale por el texto genérico, nunca crudo",
    (plan) => {
      const label = planLabel(plan);
      expect(label).toBe("Plan no disponible");
      if (plan !== "") expect(label).not.toContain(plan);
    },
  );
});

describe("statusLabel — allow-list de presentación del STATUS (spec 0063, D7)", () => {
  it("`canceled` NO dice «confirmando pago»", () => {
    // El caso que motivó la allow-list: hoy la home hace
    // `status === "active" ? "activo" : "confirmando pago"`, así que un `free` con
    // `status='canceled'` diría «confirmando pago» PARA SIEMPRE.
    const label = statusLabel("canceled");
    expect(label).toBe("cancelada");
    expect(label).not.toContain("confirmando");
  });

  it.each([
    ["active", "activo"],
    ["trialing", "en prueba"],
    ["incomplete", "confirmando pago"],
    ["incomplete_expired", "sin confirmar el pago"],
    ["past_due", "con un cobro pendiente"],
    ["unpaid", "con un cobro pendiente"],
    ["paused", "en pausa"],
    ["canceled", "cancelada"],
  ])(
    "los 8 status conocidos tienen texto propio: %s → «%s»",
    (status, expected) => {
      expect(statusLabel(status)).toBe(expected);
    },
  );

  it.each([["future_status"], ["UNKNOWN"], [""], ["<script>x</script>"]])(
    "un status desconocido (%s) sale por el texto genérico, nunca crudo",
    (status) => {
      // `Subscription.Status` termina en `| OtherString` (`Subscriptions.d.ts:473`) y el
      // endpoint de prod está pineado en `2020-08-27`: lo desconocido llega de verdad.
      const label = statusLabel(status);
      expect(label).toBe("en revisión");
      if (status !== "") expect(label).not.toContain(status);
    },
  );

  it("el status CRUDO de la columna nunca es la salida (D5.e lo guarda sin colapsar)", () => {
    // Barrido chico sobre los 8 conocidos + 2 inventados: ninguna etiqueta es igual al
    // string que vino de Stripe. Es lo que impide que la traducción degenere en un
    // passthrough sin que nadie lo note.
    const raw = [
      "active",
      "trialing",
      "past_due",
      "unpaid",
      "incomplete",
      "incomplete_expired",
      "canceled",
      "paused",
      "future_status",
      "quantum_paused",
    ];
    const passthrough = raw.filter((status) => statusLabel(status) === status);
    expect(passthrough).toEqual([]);
    expect(raw.length).toBeGreaterThan(9);
  });
});
