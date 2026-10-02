import { describe, expect, it } from "vitest";
import { planVerify } from "./verify";

/** Spec 0133 / ADR 0113: que gates extra corren segun lo que cambio. Las reglas de
 * `planVerify` son la unica logica con decisiones de `pnpm verify`; el resto orquesta. */
describe("planVerify", () => {
  it("solo docs: ni e2e ni Neon, y docsOnly (spec 0135)", () => {
    expect(planVerify(["docs/x.md"])).toEqual({
      docsOnly: true,
      e2e: false,
      neon: { mode: "none", merchant: [], consumer: [] },
      reasons: ["solo docs: solo format:check"],
    });
  });

  // Spec 0135: un push solo de docs corre solo `format:check`.
  it.each([
    [["docs/specs/0135-x.md", "docs/INDEX.md", "AGENTS.md"]],
    [["CLAUDE.md", "README.md"]],
    [["docs/estado/claude.md"]],
  ])("%j → docsOnly", (files) => {
    expect(planVerify(files).docsOnly).toBe(true);
  });

  // ORACULO DE M2 (spec 0135): un `.ts` junto a docs ya no es solo docs.
  it.each([
    [["docs/specs/0135-x.md", "tools/check-numbers.ts"]],
    [["AGENTS.md", "apps/merchant/README.md"]],
    [["docs/x.md", "package.json"]],
    [[]],
  ])("%j → NO docsOnly", (files) => {
    expect(planVerify(files).docsOnly).toBe(false);
  });

  it("una pantalla (composer.tsx): e2e, sin Neon", () => {
    const file = "apps/merchant/src/app/backoffice/marketing/composer.tsx";
    const plan = planVerify([file]);
    expect(plan.e2e).toBe(true);
    // Esta bajo apps/merchant/src: `vitest related` decide (medido: 0 suites), no la regla.
    expect(plan.neon.mode).toBe("related");
    expect(plan.reasons).toContain(`e2e: ${file}`);
  });

  it("una ruta de app/api: related merchant, sin e2e", () => {
    const file = "apps/merchant/src/app/api/x/route.ts";
    expect(planVerify([file])).toMatchObject({
      e2e: false,
      neon: { mode: "related", merchant: [file], consumer: [] },
    });
  });

  it("servidor de merchant: related merchant, sin e2e", () => {
    const file = "apps/merchant/src/server/marketing/template-store.ts";
    expect(planVerify([file])).toMatchObject({
      e2e: false,
      neon: { mode: "related", merchant: [file], consumer: [] },
    });
  });

  it("packages/domain: related en las dos apps", () => {
    const file = "packages/domain/src/x.ts";
    expect(planVerify([file])).toMatchObject({
      e2e: false,
      neon: { mode: "related", merchant: [file], consumer: [file] },
    });
  });

  it("servidor de consumer: related consumer", () => {
    const file = "apps/consumer/src/server/x.ts";
    expect(planVerify([file]).neon).toEqual({
      mode: "related",
      merchant: [],
      consumer: [file],
    });
  });

  it("packages/db: Neon completo + e2e", () => {
    const plan = planVerify(["packages/db/src/schema/x.ts"]);
    expect(plan.e2e).toBe(true);
    expect(plan.neon.mode).toBe("full");
    expect(plan.reasons).toContain("neon full: packages/db/src/schema/x.ts");
  });

  it("full gana sobre related aunque haya servidor en la lista", () => {
    const plan = planVerify([
      "apps/merchant/src/server/x.ts",
      "packages/db/drizzle/0099_x.sql",
    ]);
    expect(plan.neon).toEqual({ mode: "full", merchant: [], consumer: [] });
  });

  it.each([
    "apps/merchant/drizzle/extra.sql",
    "packages/db/drizzle.config.ts",
    "apps/consumer/vitest.config.ts",
    "vitest.workspace.ts",
    "package.json",
    "apps/merchant/package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tools/neon-test.sh",
  ])("%s → Neon completo", (file) => {
    expect(planVerify([file])).toMatchObject({
      e2e: true,
      neon: { mode: "full" },
    });
  });

  it("CSS global: e2e", () => {
    const file = "apps/merchant/src/app/globals.css";
    const plan = planVerify([file]);
    expect(plan.e2e).toBe(true);
    expect(plan.neon.mode).toBe("none");
  });

  it.each([
    "tests/e2e/x.spec.ts",
    "playwright.config.ts",
    "apps/consumer/public/logo.png",
    "apps/public/src/app/page.tsx",
  ])("%s → e2e sin Neon", (file) => {
    expect(planVerify([file])).toMatchObject({
      e2e: true,
      neon: { mode: "none" },
    });
  });

  it.each([
    "tools/verify.ts",
    "docs/specs/0133-x.md",
    "apps/platform/src/server/x.ts",
    "apps/merchant/src/server/x.json",
  ])("%s → nada extra", (file) => {
    expect(planVerify([file])).toMatchObject({
      e2e: false,
      neon: { mode: "none" },
    });
  });
});
