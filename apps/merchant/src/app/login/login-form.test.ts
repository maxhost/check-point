import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The only import that would reach the network/browser. The form's markup — which is
// what this file pins — does not depend on it.
vi.mock("../../lib/auth-client", () => ({
  merchantAuthClient: { signIn: { email: vi.fn() } },
}));

import { LoginForm } from "./login-form";

const STAFF_DISABLED_COPY = "Miembro del staff desactivado";

function markupOf(initialError?: string | null): string {
  return renderToStaticMarkup(createElement(LoginForm, { initialError }));
}

// DoD #1 of spec 0057, and the owner's literal request: the rejection is SEEN, not just
// decided. `login-notice.test.ts` pins the decision; this pins that it reaches the DOM.
describe("login form renders the notice it is handed (ADR 0055)", () => {
  it("shows the copy, announced to assistive tech", () => {
    const html = markupOf(STAFF_DISABLED_COPY);
    expect(html).toContain(STAFF_DISABLED_COPY);
    expect(html).toContain('role="alert"');
  });

  // Two ways to say "nothing to announce": an explicit null, and the prop simply
  // absent. `initialError ?? null` covers both; both are pinned so a narrowing of
  // that expression cannot pass unnoticed.
  it.each([
    ["an explicit null", null],
    ["the prop left out entirely", undefined],
  ])("shows no alert at all on a plain /login — %s", (_name, initialError) => {
    const html = markupOf(initialError);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain(STAFF_DISABLED_COPY);
    // The form itself still rendered — guards against a vacuous pass above.
    expect(html).toContain("Contraseña");
  });
});
