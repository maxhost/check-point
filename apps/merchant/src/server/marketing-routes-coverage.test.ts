import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { MARKETING_ROUTE_NAMES } from "./marketing-route-names";

/**
 * A route file that is born WITHOUT a guard while the suite stays green is the shape of
 * spec 0046 (a locked door beside an open wall) and of the MIME sweep. This derives the
 * expected `METHOD /path` set from the FILESYSTEM and demands it equals the declared
 * one; `marketing-routes.test.ts` then demands its `HANDLERS` table covers exactly that
 * declared set.
 *
 * PROXY, and labelled as such: it pins that every handler is LISTED, never that its
 * guard works. Both spellings are read, because the four action routes use
 * `export const POST =` and the rest `export async function` — a sweep blind to either
 * would see zero handlers in four files and stay green. A floor is asserted so an empty
 * walk cannot pass by seeing nothing.
 *
 * It bit for real on 2026-09-16: adding `audience-preview` and `campaigns/[id]/results`
 * turned it red naming both, before either was wired into the guard table.
 */
describe("every handler under api/marketing/** is declared", () => {
  it("the filesystem and MARKETING_ROUTE_NAMES agree exactly", () => {
    const root = join(import.meta.dirname, "../app/api/marketing");
    const files = readdirSync(root, { recursive: true, encoding: "utf8" })
      .filter((f) => basename(f) === "route.ts")
      .sort();
    expect(files.length).toBeGreaterThanOrEqual(8);

    const expected = new Set<string>();
    for (const file of files) {
      const source = readFileSync(join(root, file), "utf8");
      const url = ["/api/marketing", ...dirname(file).split(sep)]
        .filter((s) => s && s !== ".")
        .map((s) => s.replace(/^\[(.+)\]$/, ":$1"))
        .join("/");
      const methods = new Set<string>();
      for (const m of source.matchAll(
        /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g,
      ))
        methods.add(m[1]);
      for (const m of source.matchAll(
        /export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*=/g,
      ))
        methods.add(m[1]);
      expect(methods.size, `${file} sin handler`).toBeGreaterThan(0);
      for (const method of methods) expected.add(`${method} ${url}`);
    }

    expect([...MARKETING_ROUTE_NAMES].sort()).toEqual([...expected].sort());
  });
});
