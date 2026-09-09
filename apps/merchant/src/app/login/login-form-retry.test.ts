import { describe, expect, it, vi } from "vitest";

/**
 * DoD #5 of spec 0057: a retry with a bad password must OVERWRITE the
 * «Miembro del staff desactivado» notice, not stack under it or lose to it.
 *
 * ─── THIS IS A PROXY. Read before trusting it. ───────────────────────────────
 * It does not render React: it stubs `useState` with a hand-rolled state cell,
 * calls `LoginForm(props)` as a plain function, walks the returned element tree to
 * the `<button>`, and invokes its `onClick` by hand.
 *
 *  - What it DOES pin (the load-bearing part, and it is the property the DoD
 *    states): the sign-in handler writes the credential error into the SAME state
 *    slot that `initialError` seeds. That is the whole mechanism by which the retry
 *    wins — mutation (h) of the spec flips exactly this and turns this file red
 *    while all five gates stay green.
 *  - What it does NOT pin (decorative here): React's real re-render, its batching,
 *    hook ordering under Strict Mode, and anything about the browser. The stubbed
 *    `useState` models "same index → same cell across renders" and nothing more.
 *
 * The render itself is pinned elsewhere, for real, by `login-form.test.ts`
 * (`renderToStaticMarkup`). This file only covers the transition between renders.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** One cell per `useState` call, in call order — React's contract, in miniature. */
let cells: unknown[] = [];
let cursor = 0;

function resetHooks(): void {
  cells = [];
  cursor = 0;
}

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const stub: Record<string, unknown> = { ...actual };

  // Every OTHER hook fails BY NAME. Outside a real render React's dispatcher is null,
  // so the honest version of this crash is `TypeError: Cannot read properties of null
  // (reading 'useEffect')` — which reads as "the test is broken" and sends the next
  // person to debug the harness. Two very different things land here and both deserve
  // a legible message:
  //   · a legitimate new hook (`useId`, `useRouter`, …) → model it below, or move the
  //     assertion to `login-form.test.ts` if a real render is what you need;
  //   · the tarea-38 bug shape — the notice being cleared from inside an effect, which
  //     `renderToStaticMarkup` CANNOT see because SSR skips effects by design. That is
  //     mutation (i) of spec 0057, and this file is the only thing that notices.
  for (const name of Object.keys(actual)) {
    if (!name.startsWith("use") || name === "useState") continue;
    stub[name] = () => {
      throw new Error(
        `hook no modelado por el stub: ${name}(). login-form-retry.test.ts invoca ` +
          `LoginForm() como funcion pura y solo modela useState. Si el hook es ` +
          `legitimo, modelalo aca; si borra o pisa el aviso (p.ej. un useEffect que ` +
          `resetea el error), es el bug de la tarea 38 y el rojo es correcto.`,
      );
    };
  }

  stub.useState = (initial: unknown) => {
    const index = cursor++;
    if (index === cells.length) cells.push(initial);
    // NOTE: no functional updates. `setError(prev => …)` would store the function
    // itself and the assertions would compare a function against a string — noisy,
    // not silent. Nobody uses that form today; model it here if that changes.
    return [cells[index], (next: unknown) => void (cells[index] = next)];
  };
  return stub;
});

/** What `signIn.email` resolves to when the user retries with a bad password. */
const signInResult = { error: { message: "Invalid email or password" } };

vi.mock("../../lib/auth-client", () => ({
  merchantAuthClient: { signIn: { email: async () => signInResult } },
}));

import { LoginForm } from "./login-form";
import { Toast } from "../components/ui";

const STAFF_DISABLED_COPY = "Miembro del staff desactivado";
const CREDENTIALS_ERROR = "Invalid email or password";

type Element = {
  type?: unknown;
  props?: {
    children?: unknown;
    message?: unknown;
    onClick?: unknown;
  };
};

function walk(node: unknown, hit: (el: Element) => boolean): Element | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = walk(child, hit);
      if (found) return found;
    }
    return null;
  }
  if (!node || typeof node !== "object") return null;
  const element = node as Element;
  if (hit(element)) return element;
  return walk(element.props?.children, hit);
}

/** Renders the form (hook cells survive across calls, as in a real re-render). */
function render(initialError?: string | null): {
  notice: unknown;
  click: () => Promise<void>;
} {
  cursor = 0;
  const tree = LoginForm({ initialError }) as unknown;
  const toast = walk(tree, (el) => el.type === Toast);
  const button = walk(tree, (el) => el.type === "button");
  const onClick = button?.props?.onClick;
  if (typeof onClick !== "function") throw new Error("no submit button found");
  return {
    notice: toast?.props?.message ?? null,
    click: onClick as () => Promise<void>,
  };
}

describe("a retry overwrites the server-sent notice (DoD #5, spec 0057)", () => {
  it("the credential error takes the slot the notice was seeded into", async () => {
    resetHooks();

    // 1. Arrives bounced by the guard: the notice is on screen.
    const first = render(STAFF_DISABLED_COPY);
    expect(first.notice).toBe(STAFF_DISABLED_COPY);

    // 2. Retries and gets the password wrong.
    await first.click();

    // 3. The notice is gone; better-auth's generic message is what he reads.
    const second = render(STAFF_DISABLED_COPY);
    expect(second.notice).toBe(CREDENTIALS_ERROR);
    expect(second.notice).not.toBe(STAFF_DISABLED_COPY);
  });
});
