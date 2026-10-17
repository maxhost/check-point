import { AiInputError, AiUnavailableError } from "../../server/ai/errors";
import { readAiImages } from "../../server/ai/image-input";
import { runAiTask } from "../../server/ai/service";
import type { AiImage, AiProvider } from "../../server/ai/task";
import { ModuleError } from "../errors";
import {
  EXPENSE_ENTRY_PHOTO_TASK,
  EXPENSE_ENTRY_TEXT_TASK,
  EXPENSE_PHOTO_INPUT,
  type RawExpenseDraft,
} from "./ai-tasks";
import type { ExpenseConcept, ExpenseContext, ExpenseDraft } from "./types";
import { getContext, listConcepts } from "./server/queries";
import {
  invalidExpense,
  normalizeConceptName,
  parseLocation,
  validAmount,
  validCategory,
  validDay,
} from "./server/validation";
const label = (raw: unknown, max = 120) =>
  typeof raw === "string" &&
  raw.trim() &&
  raw.trim().length <= max &&
  !raw.includes("\u0000")
    ? raw.trim()
    : null;
export function normalizeDraft(
  raw: RawExpenseDraft,
  concepts: ExpenseConcept[],
  context: ExpenseContext,
  locationId: string | null,
): ExpenseDraft {
  const unparsed = raw.unparsed
    .map((v) => label(v, 500))
    .filter((v): v is string => v !== null);
  const lines: ExpenseDraft["lines"] = [];
  for (const value of raw.lines) {
    const line =
      value && typeof value === "object"
        ? (value as Record<string, unknown>)
        : {};
    const sourceText = label(line.sourceText, 500) ?? "";
    if (lines.length >= 30) {
      if (sourceText) unparsed.push(sourceText);
      continue;
    }
    const category = validCategory(line.category) ? line.category : null;
    const conceptName = label(line.conceptName);
    const match = concepts.find(
      (c) =>
        c.category === category &&
        (c.id === line.conceptId ||
          (line.conceptId === null &&
            conceptName &&
            c.normalizedName === normalizeConceptName(conceptName))),
    );
    const paidOn = validDay(line.paidOn) ? line.paidOn : null;
    const amountMinor = validAmount(line.amountMinor) ? line.amountMinor : null;
    const local =
      typeof line.locationId === "string" &&
      context.locations.some((l) => l.id === line.locationId)
        ? line.locationId
        : locationId;
    lines.push({
      paidOn,
      amountMinor,
      category,
      conceptId: match?.id ?? null,
      conceptName: match?.name ?? conceptName,
      name: label(line.name),
      isFixed: typeof line.isFixed === "boolean" ? line.isFixed : null,
      locationId: local,
      sourceText,
    });
    if (
      (!paidOn || !amountMinor) &&
      sourceText &&
      !unparsed.includes(sourceText)
    )
      unparsed.push(sourceText);
  }
  return { lines, unparsed };
}
export async function buildDraft(
  businessId: string,
  userId: string,
  body: Record<string, unknown>,
  provider?: AiProvider,
) {
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 2000)
    throw new ModuleError(
      422,
      "invalid_text",
      "El texto tiene que tener entre 1 y 2000 caracteres.",
    );
  return runDraft(
    businessId,
    userId,
    { text, images: [], locationId: parseLocation(body.locationId) },
    provider,
  );
}
export async function buildPhotoDraft(
  businessId: string,
  userId: string,
  request: Request,
  provider?: AiProvider,
) {
  let form: FormData;
  try {
    form = await request.clone().formData();
  } catch {
    throw new ModuleError(422, "invalid_photos", "No pudimos abrir las fotos.");
  }
  const selected = form.get("locationId");
  const locationId = parseLocation(selected === "business" ? null : selected);
  let images: AiImage[];
  try {
    images = await readAiImages(request, EXPENSE_PHOTO_INPUT);
  } catch (error) {
    if (error instanceof AiInputError)
      throw new ModuleError(error.status, error.code, error.message);
    throw error;
  }
  return runDraft(
    businessId,
    userId,
    { text: "", images, locationId },
    provider,
  );
}
async function runDraft(
  businessId: string,
  userId: string,
  source: { text: string; images: AiImage[]; locationId: string | null },
  provider?: AiProvider,
) {
  const context = await getContext(businessId, source.locationId);
  if (
    source.locationId !== null &&
    !context.locations.some((l) => l.id === source.locationId)
  )
    invalidExpense();
  const concepts = await listConcepts(businessId);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: context.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  try {
    const result = await runAiTask(
      source.images.length ? EXPENSE_ENTRY_PHOTO_TASK : EXPENSE_ENTRY_TEXT_TASK,
      {
        text: source.text,
        images: source.images,
        context: JSON.stringify({
          today,
          currencyCode: context.currencyCode,
          minorUnit: context.minorUnit,
          timeZone: context.timeZone,
          locationId: source.locationId,
          locations: context.locations,
          concepts,
        }),
      },
      { businessId, userId },
      { provider },
    );
    return {
      draft: normalizeDraft(
        result.output,
        concepts,
        context,
        source.locationId,
      ),
    };
  } catch (error) {
    if (error instanceof AiUnavailableError)
      throw new ModuleError(
        503,
        "draft_unavailable",
        "No pudimos analizar el gasto. Intenta de nuevo o completa los datos a mano.",
      );
    throw error;
  }
}
