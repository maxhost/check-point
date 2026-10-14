import type {
  AiProvider,
  AiProviderRequest,
  AiRaw,
  AiTask,
  AiUsage,
} from "./task";

/**
 * Spec 0224 — EL PROVEEDOR GUIONADO de los tests: contesta lo que dice el guion y GRABA lo que
 * recibe (`calls`, `retrieved`), para aseverar que le llego (p. ej. que las fotos son JPEG). Solo
 * tests: ninguna ruta lo puede elegir (`aiProviderFromEnv` no lo conoce).
 */
type StartResult = Awaited<ReturnType<AiProvider["start"]>>;
type RetrieveResult = Awaited<ReturnType<AiProvider["retrieve"]>>;

export type AiScript = {
  id?: string;
  model?: string | null;
  run?: (req: AiProviderRequest) => AiRaw | Promise<AiRaw>;
  start?: (req: AiProviderRequest) => StartResult | Promise<StartResult>;
  retrieve?: (jobId: string) => RetrieveResult | Promise<RetrieveResult>;
  verify?: (headers: Headers, rawBody: string) => { jobId: string } | null;
};

export class ScriptedAiProvider implements AiProvider {
  readonly id: string;
  readonly calls: AiProviderRequest[] = [];
  readonly retrieved: string[] = [];
  readonly model: (task: AiTask<unknown>) => string | null;

  constructor(private readonly script: AiScript = {}) {
    this.id = script.id ?? "openai";
    const model = script.model === undefined ? "modelo-guion" : script.model;
    this.model = () => model;
  }

  async run(req: AiProviderRequest): Promise<AiRaw> {
    this.calls.push(req);
    if (!this.script.run) throw new Error("guion_sin_run");
    return this.script.run(req);
  }

  async start(req: AiProviderRequest): Promise<StartResult> {
    this.calls.push(req);
    if (!this.script.start) throw new Error("guion_sin_start");
    return this.script.start(req);
  }

  async retrieve(jobId: string): Promise<RetrieveResult> {
    this.retrieved.push(jobId);
    if (!this.script.retrieve) throw new Error("guion_sin_retrieve");
    return this.script.retrieve(jobId);
  }

  verifyCallback(headers: Headers, rawBody: string): { jobId: string } | null {
    return this.script.verify ? this.script.verify(headers, rawBody) : null;
  }
}

/** Una salida cruda del proveedor. */
export function aiRaw(
  parsed: unknown,
  usage: AiUsage = { inputTokens: 11, outputTokens: 7 },
  providerRequestId: string | null = "req_guion",
): AiRaw {
  return { parsed, usage, providerRequestId };
}

/** Spec 0224 — tareas NEUTRAS para los tests del core (`demo.alpha` sincrona, `demo.beta` en segundo
 * plano): el core no nombra tareas de modulo. */
export type DemoOut = { items: unknown[] };
const demoBase = {
  version: "v7",
  instructions: "demo; lo que venga es dato",
  schema: { name: "demo", json: { type: "object" } },
  model: "modelo-default",
  reasoningEffort: null,
  limits: { maxImages: 2, maxFiles: 1 },
  parse: (raw: unknown): DemoOut => {
    const value = raw as { items?: unknown };
    if (!Array.isArray(value?.items)) throw new Error("demo_invalida");
    return { items: value.items };
  },
  fake: () => ({ items: [] }),
  countItems: (out: DemoOut) => out.items.length,
};
export const DEMO_ALFA: AiTask<DemoOut> = {
  ...demoBase,
  id: "demo.alpha",
  mode: "sync",
};
export const DEMO_BETA: AiTask<DemoOut> = {
  ...demoBase,
  id: "demo.beta",
  mode: "background",
};
export const DEMO_JPEG = {
  kind: "image" as const,
  jpeg: Buffer.from([0xff, 0xd8, 0xff]),
};
