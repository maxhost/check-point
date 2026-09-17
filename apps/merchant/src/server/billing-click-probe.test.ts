import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * EL ESTADO DE LOS COMPONENTES, INTERCEPTADO. `useState` se reemplaza por una versión que
 * (a) deja SEMBRAR el valor de cada hook por posición y (b) REGISTRA cada llamada al setter.
 * Con eso un componente cliente se puede invocar como función, caminar su árbol e INVOCAR un
 * `onClick`, sin jsdom y sin instalar nada.
 */
const hooks = vi.hoisted(() => ({
  seed: {} as Record<number, unknown>,
  calls: [] as Array<{ index: number; value: unknown }>,
  next: 0,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = hooks.next++;
      const value =
        index in hooks.seed
          ? hooks.seed[index]
          : typeof initial === "function"
            ? (initial as () => unknown)()
            : initial;
      return [
        value,
        (next: unknown) =>
          hooks.calls.push({
            index,
            value:
              typeof next === "function"
                ? (next as (previous: unknown) => unknown)(value)
                : next,
          }),
      ];
    },
  };
});

import { subscriptionOffers, type SubscriptionView } from "./billing";
import { SubscriptionConsole } from "../app/backoffice/subscription/subscription-console";
import { CancelDialog } from "../app/backoffice/subscription/cancel-dialog";

/**
 * Spec 0063, D7 — LO QUE PASA CUANDO EL OWNER APRIETA EL BOTÓN. Cero paquetes nuevos, cero
 * base, `environment: "node"`.
 *
 * POR QUÉ ESTE ARCHIVO EXISTE: la fase D2 declaró como límite que «lo único que cerraría el
 * `from: "subscription"` y el abrir del modal es simular el click». **Era falso**, y lo
 * falsificó un revisor independiente escribiendo esta sonda — el patrón de la spec 0057 por
 * cuarta vez en este repo. Las dos mutaciones que quedaban verdes con los 5 gates en verde:
 *
 *  - **R10**: la consola postea `{ interval }` SIN `from: "subscription"` → 38/38 VERDE. El
 *    docblock de al lado afirma «sin esto el que paga acá aterriza en la home del backoffice».
 *  - **R11**: `onClick={() => {}}` en el botón de bajar (no abre el modal) → 38/38 VERDE.
 *  - **R19**: el ALTA mandando `from: "subscription"` → 66/66 VERDE, porque el test
 *    transcribía el body A MANO y pinneaba la copia, no el código. **Esa sonda ya no está
 *    acá**: su sujeto era la pantalla del alta, que la spec 0067 §7 borró por decisión
 *    del owner (ADR 0070 §17). Es cobertura PERDIDA, no un test editado para poner verde un
 *    gate: cuando la UI de afuera reponga el alta, el cableado del `from:` vuelve a quedar
 *    sin oráculo y hay que reponerlo en la spec que la construya (spec 0067 §7-ter).
 *
 * POR QUÉ LOS TRES EN UN ARCHIVO: el `vi.mock("react")` es POR ARCHIVO. Separarlos obliga a
 * una segunda copia de la máquina de hooks, y dos copias divergen.
 *
 * LO QUE ESTA SONDA NO ES: un render. No hay DOM, no hay eventos, no hay hidratación — se
 * invoca el componente y se llama al handler. Lo que el HTML sí pinnea (que el botón exista y
 * no esté deshabilitado) vive en `billing-pages.neon.integration.test.ts`; lo que la DECISIÓN
 * pinnea, en `billing-offers.test.ts`. Acá va el CABLEADO del click, que es lo que ninguno de
 * los dos ve.
 */

type ProbeElement = { type: unknown; props: Record<string, unknown> };

function isElement(node: unknown): node is ProbeElement {
  return (
    typeof node === "object" &&
    node !== null &&
    "type" in node &&
    "props" in node
  );
}

/**
 * El árbol como lista plana. Desciende SOLO por `children` y NO invoca componentes: invocar
 * uno que use `useId`/`useRef` fuera de un renderer tira, y un `catch` ancho acá convertiría
 * «el botón no está» en un verde silencioso. Los componentes que hay que expandir se expanden
 * a mano con `expand`, que es explícito y ruidoso si falla.
 */
function collect(node: unknown, out: ProbeElement[] = []): ProbeElement[] {
  if (Array.isArray(node)) {
    for (const child of node) collect(child, out);
    return out;
  }
  if (!isElement(node)) return out;
  out.push(node);
  collect(node.props.children, out);
  return out;
}

function invoke<P>(
  component: (props: P) => unknown,
  props: P,
  seed: Record<number, unknown> = {},
): ProbeElement[] {
  hooks.seed = seed;
  hooks.calls = [];
  hooks.next = 0;
  return collect(component(props));
}

/** El subárbol de un componente SIN hooks (`PlanCard`), invocado a propósito. */
function expand(element: ProbeElement): ProbeElement[] {
  return collect((element.type as (props: unknown) => unknown)(element.props));
}

/** Un componente hijo, por nombre. Spec 0064: la tarjeta de alta salió de la consola a
 * `upgrade-card.tsx` (corte de tamaño), y `collect` NO invoca componentes — hay que expandirla.
 * El `expect` es parte del oráculo: si el hijo desaparece, el rojo dice cuál falta. */
function child(tree: ProbeElement[], name: string): ProbeElement {
  const found = tree.find(
    (el) => typeof el.type === "function" && el.type.name === name,
  );
  expect(found, `no hay ningún <${name}>`).toBeDefined();
  return found as ProbeElement;
}

/** El texto de un elemento, para encontrar un botón por su etiqueta. */
function label(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(label).join("");
  return isElement(node) ? label(node.props.children) : "";
}

function button(tree: ProbeElement[], text: string): ProbeElement {
  const found = tree.filter(
    (element) => element.type === "button" && label(element).includes(text),
  );
  // Que haya EXACTAMENTE uno es parte del oráculo: con dos, un click se dispararía sobre el
  // que no es y la fila mediría otra cosa.
  expect(found.map((element) => label(element))).toHaveLength(1);
  return found[0];
}

function click(element: ProbeElement): void {
  (element.props.onClick as () => void)();
}

/** Lo que el click dejó escrito, como semilla de la pasada siguiente. */
function stateAfterClick(): Record<number, unknown> {
  return Object.fromEntries(
    hooks.calls.map((call) => [call.index, call.value]),
  ) as Record<number, unknown>;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const fetchCalls: Array<{ url: string; body: unknown }> = [];
const assigned: string[] = [];

beforeEach(() => {
  fetchCalls.length = 0;
  assigned.length = 0;
  vi.stubGlobal("fetch", (url: unknown, init?: { body?: unknown }) => {
    fetchCalls.push({
      url: String(url),
      body: JSON.parse(String(init?.body ?? "null")) as unknown,
    });
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ url: "https://stripe.test/sesion" }),
    });
  });
  vi.stubGlobal("window", {
    location: { assign: (to: string) => assigned.push(to) },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const view = (overrides: Partial<SubscriptionView> = {}): SubscriptionView => ({
  plan: "free",
  status: "active",
  interval: null,
  pendingPlan: null,
  pendingPlanAt: null,
  ...overrides,
});

const consoleProps = (subscription: SubscriptionView) => ({
  subscription,
  offers: subscriptionOffers(subscription),
  facts: { renewalAt: null, lastPaidInvoice: null },
  activeLocations: 1,
  canCancel: true,
  downgradeBlock: null,
  stripeUnconfirmed: false,
  timezone: "America/Guayaquil",
  notice: null,
});

describe("el click en la consola de suscripción (spec 0063, D7)", () => {
  it('«Mejorar a Plus» postea el `from: "subscription"` que decide el aterrizaje', async () => {
    const tree = invoke(SubscriptionConsole, consoleProps(view()));
    click(button(expand(child(tree, "UpgradeCard")), "Mejorar a Plus"));
    await flush();

    expect(fetchCalls.map((call) => call.url)).toEqual([
      "/api/billing/checkout",
    ]);
    // EL BODY COMPLETO, no un `toMatchObject`: `from` es justo la clave que faltaba (R10) y
    // un match parcial la dejaría pasar.
    expect(fetchCalls[0].body).toEqual({
      interval: "month",
      from: "subscription",
    });
    // Y la sesión de Stripe se abre con la `url` que contestó la ruta, no con un `?done=`.
    expect(assigned).toEqual(["https://stripe.test/sesion"]);
  });

  it("el período elegido en el toggle es el que viaja en el body", () => {
    // `billingInterval` es el hook 0 de la consola. Sembrarlo en `year` prueba que el body
    // lee EL ESTADO y no una constante: sin esto, un `interval: "month"` hardcodeado pasaría
    // el test de arriba.
    const tree = invoke(SubscriptionConsole, consoleProps(view()), {
      0: "year",
    });
    click(button(expand(child(tree, "UpgradeCard")), "Mejorar a Plus"));

    expect(fetchCalls[0].body).toEqual({
      interval: "year",
      from: "subscription",
    });
  });

  it("apretar «Bajar a Free» ABRE el modal de condiciones", () => {
    const subscription = view({ plan: "plus", interval: "month" });
    const tree = invoke(SubscriptionConsole, consoleProps(subscription));
    // CONTROL que hace discriminar a la aserción de abajo: en la carga el modal está CERRADO
    // (es lo que impide que el HTML de `renderToStaticMarkup` vea su contenido).
    expect(
      tree.find((element) => element.type === CancelDialog)?.props.open,
    ).toBe(false);

    click(button(tree, "Bajar a Free"));
    // El click no re-renderiza nada por sí solo: se toma lo que escribió y se vuelve a
    // invocar la consola con ese estado, que es lo que React haría.
    const after = invoke(
      SubscriptionConsole,
      consoleProps(subscription),
      stateAfterClick(),
    );

    expect(
      after.find((element) => element.type === CancelDialog)?.props.open,
    ).toBe(true);
    // Y no salió ningún request: el botón abre el modal, no baja el plan.
    expect(fetchCalls).toEqual([]);
  });
});
