import { createHash } from "node:crypto";
import type {
  AiInput,
  AiProvider,
  AiProviderRequest,
  AiRaw,
  AiTask,
} from "../task";

/**
 * Spec 0224 §4 — EL PROVEEDOR FALSO, unico y DETERMINISTA: devuelve la salida cruda que declara la
 * tarea (`task.fake`), que pasa por el mismo `parse` que la real. Para tests y local, sin clave y
 * sin costo. Existe SOLO con `AI_PROVIDER=fake` explicito (`config.ts`).
 */
export class FakeAiProvider implements AiProvider {
  readonly id = "fake";
  readonly model = (): string | null => null;

  async run(req: AiProviderRequest): Promise<AiRaw> {
    return fakeRaw(req.task, req.input);
  }

  async start(
    req: AiProviderRequest,
  ): Promise<{ kind: "completed"; raw: AiRaw }> {
    return { kind: "completed", raw: fakeRaw(req.task, req.input) };
  }

  async retrieve(): Promise<{ status: "failed"; code: string }> {
    return { status: "failed", code: "fake_has_no_jobs" };
  }

  verifyCallback(): null {
    return null;
  }
}

function fakeRaw(task: AiTask<unknown>, input: AiInput): AiRaw {
  const digest = createHash("sha256").update(task.id);
  if (input.context) digest.update(input.context);
  if (input.text) digest.update(input.text);
  for (const image of input.images ?? []) digest.update(image.jpeg);
  for (const file of input.files ?? []) digest.update(file.bytes);
  return {
    parsed: task.fake(input),
    usage: { inputTokens: 100, outputTokens: 50 },
    providerRequestId: `fake-${digest.digest("hex").slice(0, 8)}`,
  };
}
