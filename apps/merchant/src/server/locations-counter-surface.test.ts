import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// `CounterConsole` calls `useRouter` at the top of its body; without a router context a
// static render would throw before reaching any branch. The branch under test never
// navigates, so a no-op router is faithful here.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));

const hook = vi.hoisted(() => ({ call: 0 }));

// Reaching the `LocationGate` branch needs `stage !== "idle"`, and `stage` is the SECOND
// `useState` of `CounterConsole` (right after `locationId`). Rather than declaring the
// branch untestable, script that one call per render; every other `useState` keeps
// React's real behaviour. ~15 lines, no new package — the spec 0057 lesson, applied.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: ((initial: unknown) => {
      hook.call += 1;
      if (hook.call === 2) return ["scanning", () => {}];
      return actual.useState(initial as never);
    }) as unknown as typeof actual.useState,
  };
});

import { LocationGate } from "../app/backoffice/counter/stages";
import { CounterConsole } from "../app/backoffice/counter/counter-console";

const twoLocations = [
  { id: "loc-activo-1", name: "Sucursal Centro" },
  { id: "loc-activo-2", name: "Sucursal Sur" },
];

const consoleHtml = (props: {
  locations: { id: string; name: string }[];
  preselectedLocationId?: string;
}) =>
  renderToStaticMarkup(
    createElement(CounterConsole, {
      currencyCode: "USD",
      operatorName: "Ana",
      history: [],
      ...props,
    }),
  );

const GATE = "¿En qué local estás?";

/**
 * Spec 0061 — the counter surface with more than one location. This path has NEVER run in
 * production (the 11 businesses have exactly one location), so it is exercised instead of
 * assumed.
 *
 * Declared limit: `counter-console.tsx` is outside this spec's allowed scope, so the
 * `?location=` preselect rule is pinned through the RENDERED outcome, not extracted into
 * a pure decision. Every case below forces `stage = "scanning"`, so «no gate» means the
 * console moved on — never that it was still on the idle home screen.
 */
describe("counter LocationGate (spec 0061)", () => {
  beforeEach(() => {
    hook.call = 0;
  });

  it("offers exactly the locations it is handed, one button each", () => {
    const html = renderToStaticMarkup(
      createElement(LocationGate, {
        locations: twoLocations,
        onPick: () => {},
      }),
    );
    expect(html).toContain(GATE);
    expect(html).toContain("Sucursal Centro");
    expect(html).toContain("Sucursal Sur");
    expect(html.match(/<button/g) ?? []).toHaveLength(2);
  });

  it("renders nothing for a location it was not handed (an archived one)", () => {
    const html = renderToStaticMarkup(
      createElement(LocationGate, {
        locations: [twoLocations[0]],
        onPick: () => {},
      }),
    );
    expect(html).toContain("Sucursal Centro");
    expect(html).not.toContain("Sucursal Sur");
    expect(html.match(/<button/g) ?? []).toHaveLength(1);
  });

  it("with two locations and a STALE `?location=`, the console asks instead of assuming", () => {
    // The bookmark case of the spec: the staff saved `?location=<uuid now archived>`.
    // The page no longer lists it, so no preselect matches and the gate must open.
    const html = consoleHtml({
      locations: twoLocations,
      preselectedLocationId: "loc-archivado-9",
    });
    expect(html).toContain(GATE);
    expect(html).toContain("Sucursal Centro");
  });

  it("a VALID `?location=` skips the gate — so the gate above is the stale id, not a broken render", () => {
    const html = consoleHtml({
      locations: twoLocations,
      preselectedLocationId: "loc-activo-2",
    });
    expect(html).not.toContain(GATE);
  });

  it("a single location skips the gate entirely", () => {
    const html = consoleHtml({ locations: [twoLocations[0]] });
    expect(html).not.toContain(GATE);
  });

  it("two locations and no `?location=` at all opens the gate", () => {
    expect(consoleHtml({ locations: twoLocations })).toContain(GATE);
  });
});
