import { describe, expect, it } from "vitest";
import { summarizeRun, type Annotation, type Job, type Run } from "./ci-status";

/** Spec 0133 / ADR 0113: la CI de `main` no se espera, se consulta al empezar la sesion. */
describe("summarizeRun", () => {
  const base: Run = {
    id: 1,
    head_sha: "49c7c9e0123456789",
    status: "completed",
    conclusion: "success",
    html_url: "https://github.com/maxhost/check-point/actions/runs/1",
    display_title: "docs: mark spec 0132 implemented",
  };

  it("verde: sha, estado y link, sin pasos ni anotaciones", () => {
    expect(summarizeRun(base, [], [])).toEqual([
      "CI de main: VERDE",
      "  sha 49c7c9e — docs: mark spec 0132 implemented",
      "  https://github.com/maxhost/check-point/actions/runs/1",
    ]);
  });

  it("en curso: lo dice y no lista nada mas", () => {
    const lines = summarizeRun(
      { ...base, status: "in_progress", conclusion: null },
      [],
      [],
    );
    expect(lines[0]).toBe("CI de main: en curso (in_progress)");
    expect(lines).toHaveLength(3);
  });

  it("rojo: pasos fallidos y hasta 10 anotaciones, sin las notice, mensajes recortados", () => {
    const jobs: Job[] = [
      {
        id: 9,
        name: "verify",
        conclusion: "failure",
        steps: [
          { name: "Migrar la rama Neon de CI", conclusion: "success" },
          { name: "Unit + integracion Neon", conclusion: "failure" },
          { name: "Run pnpm build", conclusion: "skipped" },
        ],
      },
    ];
    const failure = (i: number, message = `fallo ${i}`): Annotation => ({
      path: `apps/merchant/src/server/s${i}.neon.integration.test.ts`,
      start_line: i,
      annotation_level: "failure",
      message,
    });
    const annotations: Annotation[] = [
      {
        path: ".github",
        start_line: 1,
        annotation_level: "notice",
        message: "The ubuntu-latest label will migrate",
      },
      failure(0, `AssertionError:\n  expected ${"x".repeat(300)}`),
      ...Array.from({ length: 11 }, (_, i) => failure(i + 1)),
    ];
    const lines = summarizeRun(
      { ...base, conclusion: "failure" },
      jobs,
      annotations,
    );
    expect(lines[0]).toBe("CI de main: ROJO (failure)");
    expect(lines).toContain("pasos fallidos:");
    expect(lines).toContain("  - verify › Unit + integracion Neon");
    expect(lines.join("\n")).not.toContain("Run pnpm build");
    expect(lines).toContain("anotaciones (10 de 12):");
    expect(lines.join("\n")).not.toContain("ubuntu-latest");
    const first = lines.find((l) => l.includes("s0.neon"));
    expect(first).toMatch(
      /^ {2}apps\/merchant\/src\/server\/s0\.neon\.integration\.test\.ts:0 \| AssertionError: expected x+…$/,
    );
    expect(first!.split(" | ")[1]).toHaveLength(160);
    expect(lines.join("\n")).toContain(
      "s9.neon.integration.test.ts:9 | fallo 9",
    );
    expect(lines.join("\n")).not.toContain("s10.neon");
  });
});
