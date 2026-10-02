/**
 * `pnpm ci:status` — el estado de la CI del ultimo `main` (spec 0133 / ADR 0113).
 *
 * La CI de GitHub corre todo en cada push a `main` y NO se espera: se consulta al empezar cada
 * sesion. Si el ultimo `main` esta rojo, eso es lo primero que se arregla.
 *
 * Usa la API publica de GitHub, sin token. Es INFORMATIVO, no un gate: si la red falla, lo dice
 * y sale 0.
 *
 * Autocontenido a proposito (Node 24 corre `.ts` quitando los tipos), igual que
 * `tools/google-wallet-callback.ts`.
 */

import { pathToFileURL } from "node:url";

const REPO = "https://api.github.com/repos/maxhost/check-point";
const MAX_ANNOTATIONS = 10;
const MAX_MESSAGE = 160;

export type Run = {
  id: number;
  head_sha: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  display_title?: string;
};
export type Job = {
  id: number;
  name: string;
  conclusion: string | null;
  steps?: Array<{ name: string; conclusion: string | null }>;
};
export type Annotation = {
  path: string;
  start_line: number;
  annotation_level: string;
  message: string;
};

const oneLine = (text: string) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > MAX_MESSAGE
    ? `${flat.slice(0, MAX_MESSAGE - 1)}…`
    : flat;
};

/** PURO: las lineas a imprimir para un run, sus jobs y las anotaciones de los jobs fallidos. */
export function summarizeRun(
  run: Run,
  jobs: Job[],
  annotations: Annotation[],
): string[] {
  const state =
    run.status === "completed"
      ? run.conclusion === "success"
        ? "VERDE"
        : `ROJO (${run.conclusion ?? "sin conclusion"})`
      : `en curso (${run.status})`;
  const lines = [
    `CI de main: ${state}`,
    `  sha ${run.head_sha.slice(0, 7)}${run.display_title ? ` — ${oneLine(run.display_title)}` : ""}`,
    `  ${run.html_url}`,
  ];
  if (run.status !== "completed" || run.conclusion === "success") return lines;

  const failedSteps = jobs.flatMap((job) =>
    (job.steps ?? [])
      .filter((step) => step.conclusion === "failure")
      .map((step) => `${job.name} › ${step.name}`),
  );
  if (failedSteps.length > 0) {
    lines.push("pasos fallidos:");
    for (const step of failedSteps) lines.push(`  - ${step}`);
  }
  // Las `notice` (avisos del runner) no explican un rojo.
  const relevant = annotations.filter((a) => a.annotation_level !== "notice");
  if (relevant.length > 0) {
    lines.push(
      `anotaciones (${Math.min(relevant.length, MAX_ANNOTATIONS)} de ${relevant.length}):`,
    );
    for (const a of relevant.slice(0, MAX_ANNOTATIONS)) {
      lines.push(`  ${a.path}:${a.start_line} | ${oneLine(a.message)}`);
    }
  }
  return lines;
}

async function get<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: "application/vnd.github+json" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} en ${url}`);
  return (await response.json()) as T;
}

async function main(): Promise<number> {
  try {
    const { workflow_runs: runs } = await get<{ workflow_runs: Run[] }>(
      `${REPO}/actions/workflows/ci.yml/runs?branch=main&per_page=1`,
    );
    const run: Run | undefined = runs[0];
    if (!run) {
      console.log("CI de main: no hay runs");
      return 0;
    }
    const { jobs } = await get<{ jobs: Job[] }>(
      `${REPO}/actions/runs/${run.id}/jobs`,
    );
    const failedJobs = jobs.filter((job) => job.conclusion === "failure");
    const annotations = (
      await Promise.all(
        failedJobs.map((job) =>
          get<Annotation[]>(`${REPO}/check-runs/${job.id}/annotations`),
        ),
      )
    ).flat();
    for (const line of summarizeRun(run, jobs, annotations)) console.log(line);
  } catch (error) {
    console.log(
      `ci:status: no se pudo consultar GitHub (${error instanceof Error ? error.message : String(error)}). Es informativo: sigo.`,
    );
  }
  return 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = await main();
}
