import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { ConsumerProgramSummary } from "../../../server/consumer/programs";
import { SettingsTab } from "./settings-tab";

/**
 * Spec 0065 fase D — EL INTERRUPTOR DE PROMOCIONES, ejercido de verdad: se invoca el
 * `onChange` REAL del `<input>` y se mira qué manda y qué estado mueve.
 *
 * ARCHIVO APARTE del render (`settings-tab.test.ts`) por una razón mecánica: acá se mockea
 * `useState`, y un `renderToStaticMarkup` con el dispatcher de React tocado no vale nada.
 *
 * Cómo se llega al handler sin renderer y sin jsdom: un componente de función es UNA
 * FUNCIÓN. `SettingsTab({programs})` devuelve el árbol de elementos; `MarketingSwitch` —que
 * no se exporta— es el único hijo cuyo `type` es una función, así que se lo llama a mano.
 * Con `useState` mockeado, los hooks corren fuera de un renderer. Cero paquetes nuevos.
 *
 * LÍMITE DECLARADO (intentado, no supuesto): esto NO prueba que React repinte el switch con
 * el estado nuevo — eso es el navegador. Lo que sí prueba, y es donde vive el bug, es a qué
 * valor se llamó a cada setter y qué cuerpo salió al servidor.
 */

const store = vi.hoisted(() => ({ states: [] as unknown[] }));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = store.states.length;
      store.states.push(initial);
      return [initial, (value: unknown) => (store.states[index] = value)];
    },
  };
});

const PROGRAM_ID = "11111111-1111-1111-1111-111111111111";

const program = {
  membershipId: "m-1",
  programId: PROGRAM_ID,
  businessName: "Café Uno",
  marketingOptOut: false,
} as ConsumerProgramSummary;

/** El primer elemento del árbol que cumple el predicado. */
function find(
  node: unknown,
  match: (element: ReactElement) => boolean,
): ReactElement | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = find(child, match);
      if (hit) return hit;
    }
    return null;
  }
  const element = node as ReactElement<{ children?: unknown }>;
  if (match(element)) return element;
  return find(element.props?.children, match);
}

/** El `onChange` del `<input>` del switch, con sus hooks ya montados en `store.states`
 * (0 = `on`, 1 = `busy`, 2 = `failed`, en el orden en que el componente los declara). */
function switchOnChange(): (event: unknown) => Promise<void> {
  const tab = SettingsTab({ programs: [program] }) as ReactElement;
  const child = find(tab, (element) => typeof element.type === "function");
  if (!child) throw new Error("no se encontró el MarketingSwitch en el árbol");
  const rendered = (child.type as (props: unknown) => ReactElement)(
    child.props,
  );
  const input = find(rendered, (element) => element.type === "input");
  if (!input) throw new Error("el switch no renderizó ningún <input>");
  return (input.props as { onChange: (event: unknown) => Promise<void> })
    .onChange;
}

describe("el interruptor de promociones (spec 0065, fase D)", () => {
  beforeEach(() => {
    store.states.length = 0;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("apagar manda `optOut: true` con SU `programId`, y mueve el switch en el acto", async () => {
    // LA INVERSIÓN ES EL BUG QUE ESTE CASO EXISTE PARA CAZAR: el switch dice «promociones
    // encendidas» y la columna guarda el APAGADO. Mandar `optOut: checked` apagaría a quien
    // quiso encender, con toda la suite en verde.
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await switchOnChange()({ target: { checked: false } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    expect(url).toBe("/api/public/consumer/marketing-opt-out");
    expect(JSON.parse(init.body)).toEqual({
      programId: PROGRAM_ID,
      optOut: true,
    });
    expect(store.states[0]).toBe(false);
  });

  it("encender manda `optOut: false`: el cuerpo no es el estado del switch", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await switchOnChange()({ target: { checked: true } });

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    expect(JSON.parse(init.body)).toMatchObject({ optOut: false });
  });

  it("si el servidor rechaza, el switch VUELVE a su lugar y se avisa", async () => {
    // Sin la reversión el consumidor queda mirando «apagado» con las promociones
    // encendidas en la base: la pantalla mentiría sobre su propio consentimiento.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 500 })),
    );

    await switchOnChange()({ target: { checked: false } });

    expect(store.states[0]).toBe(true);
    expect(store.states[2]).toBe(true);
  });

  it("si el `fetch` TIRA, pasa lo mismo: una caída de red no apaga promociones en silencio", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("sin red");
      }),
    );

    await switchOnChange()({ target: { checked: false } });

    expect(store.states[0]).toBe(true);
    expect(store.states[2]).toBe(true);
  });
});
