import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, inArray, lte } from "drizzle-orm";
import { getDb } from "./db";
import {
  businesses,
  loyaltyPrograms,
  memberships,
  termsTemplates,
} from "./schema";
import { isIanaTimezone } from "./timezone";

export type LoyaltyKind = "points" | "stamps" | "tiers" | "cashback";
type SupportedKind = "points" | "stamps";
type ClauseInput = { templateId?: string; text?: string };
export type ProgramInput = {
  kind: LoyaltyKind;
  configuration: Record<string, unknown>;
  clauses: ClauseInput[];
};
export type CloseInput = {
  earningEndsAt?: unknown;
  redemptionEndsAt?: unknown;
};

const enabledKinds = new Set<SupportedKind>(["points", "stamps"]);
const isLoyaltyKind = (value: unknown): value is LoyaltyKind =>
  value === "points" ||
  value === "stamps" ||
  value === "tiers" ||
  value === "cashback";
const nonEmpty = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export class LoyaltyError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function datePartsAt(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<"year" | "month" | "day" | "hour" | "minute" | "second", number>;
}

/** Converts a browser datetime-local value in a business IANA zone into UTC. */
export function zonedDateTimeToUtc(value: unknown, timezone: string) {
  if (!isIanaTimezone(timezone) || typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    value,
  );
  if (!match) return null;
  const [, year, month, day, hour, minute, second = "0"] = match;
  const wanted = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };
  const nominalUtc = Date.UTC(
    wanted.year,
    wanted.month - 1,
    wanted.day,
    wanted.hour,
    wanted.minute,
    wanted.second,
  );
  let candidate = nominalUtc;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const actual = datePartsAt(new Date(candidate), timezone);
    candidate +=
      nominalUtc -
      Date.UTC(
        actual.year,
        actual.month - 1,
        actual.day,
        actual.hour,
        actual.minute,
        actual.second,
      );
  }
  const result = new Date(candidate);
  const resolved = datePartsAt(result, timezone);
  return Object.entries(wanted).every(
    ([key, expected]) => resolved[key as keyof typeof resolved] === expected,
  )
    ? result
    : null;
}

export function formatBusinessDate(value: Date | null, timezone: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-EC", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function validateProgramInput(value: unknown): ProgramInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LoyaltyError(422, "El programa debe ser un objeto válido.");
  }
  const input = value as Record<string, unknown>;
  if (
    !isLoyaltyKind(input.kind) ||
    !enabledKinds.has(input.kind as SupportedKind)
  ) {
    throw new LoyaltyError(422, "Esta modalidad todavía no está disponible.");
  }
  if (
    !input.configuration ||
    typeof input.configuration !== "object" ||
    Array.isArray(input.configuration)
  ) {
    throw new LoyaltyError(422, "La configuración no es válida.");
  }
  if (!Array.isArray(input.clauses) || input.clauses.length > 12) {
    throw new LoyaltyError(
      422,
      "Las cláusulas deben ser una lista de hasta 12 textos.",
    );
  }
  const clauses = input.clauses.map((clause) => {
    if (!clause || typeof clause !== "object" || Array.isArray(clause)) {
      throw new LoyaltyError(422, "Cada cláusula debe ser válida.");
    }
    const item = clause as Record<string, unknown>;
    const templateId = nonEmpty(item.templateId);
    const text = nonEmpty(item.text);
    if (!templateId && !text) {
      throw new LoyaltyError(
        422,
        "Cada cláusula debe tener texto o plantilla.",
      );
    }
    return { templateId: templateId ?? undefined, text: text ?? undefined };
  });
  if (!clauses.length) {
    throw new LoyaltyError(422, "Añade al menos una cláusula de términos.");
  }
  const configuration = input.configuration as Record<string, unknown>;
  if (input.kind === "points") {
    if (
      !nonEmpty(configuration.unitSingular) ||
      !nonEmpty(configuration.unitPlural)
    ) {
      throw new LoyaltyError(
        422,
        "Completa el nombre singular y plural de la unidad.",
      );
    }
  }
  if (input.kind === "stamps") {
    if (
      !nonEmpty(configuration.unitName) ||
      !Number.isInteger(configuration.target) ||
      Number(configuration.target) < 2 ||
      Number(configuration.target) > 50 ||
      (configuration.stampImageObjectKey !== undefined &&
        !nonEmpty(configuration.stampImageObjectKey))
    ) {
      throw new LoyaltyError(
        422,
        "Los sellos requieren nombre y un objetivo entero entre 2 y 50.",
      );
    }
  }
  return { kind: input.kind, configuration, clauses };
}

export async function ownerBusiness(userId: string) {
  const [business] = await getDb()
    .select({
      id: businesses.id,
      name: businesses.name,
      countryCode: businesses.countryCode,
      timezone: businesses.timezone,
    })
    .from(memberships)
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .where(and(eq(memberships.userId, userId), eq(memberships.role, "owner")))
    .orderBy(desc(businesses.createdAt))
    .limit(1);
  return business ?? null;
}

export async function programForOwner(userId: string) {
  const business = await ownerBusiness(userId);
  if (!business) return null;
  await getDb()
    .update(loyaltyPrograms)
    .set({ status: "inactive", updatedAt: new Date() })
    .where(
      and(
        eq(loyaltyPrograms.businessId, business.id),
        eq(loyaltyPrograms.status, "closing"),
        lte(loyaltyPrograms.redemptionEndsAt, new Date()),
      ),
    );
  const [program] = await getDb()
    .select()
    .from(loyaltyPrograms)
    .where(
      and(
        eq(loyaltyPrograms.businessId, business.id),
        inArray(loyaltyPrograms.status, ["active", "closing"]),
      ),
    )
    .orderBy(desc(loyaltyPrograms.createdAt))
    .limit(1);
  return { business, program: program ?? null };
}

export function renderTermsText(
  text: string,
  variables: Record<string, string>,
  allowedVariables: readonly string[],
) {
  return text.replace(/{{([a-z_]+)}}/g, (_, key: string) => {
    if (!allowedVariables.includes(key) || !variables[key]) {
      throw new LoyaltyError(422, `La variable {{${key}}} no está permitida.`);
    }
    return variables[key];
  });
}

async function renderedTerms(
  input: ProgramInput,
  business: Awaited<ReturnType<typeof ownerBusiness>>,
) {
  if (!business)
    throw new LoyaltyError(403, "No tienes un negocio como owner.");
  const ids = input.clauses.flatMap((clause) =>
    clause.templateId ? [clause.templateId] : [],
  );
  const templates = ids.length
    ? await getDb()
        .select()
        .from(termsTemplates)
        .where(
          and(
            eq(termsTemplates.status, "published"),
            inArray(termsTemplates.id, ids),
          ),
        )
    : [];
  const variables = {
    business_legal_name: business.name,
    program_name:
      input.kind === "points"
        ? String(input.configuration.unitPlural)
        : String(input.configuration.unitName),
    program_kind: input.kind,
    country_code: business.countryCode,
  };
  const markdown = input.clauses
    .map((clause) => {
      const template = clause.templateId
        ? templates.find((item) => item.id === clause.templateId)
        : null;
      if (clause.templateId && !template) {
        throw new LoyaltyError(
          422,
          "La plantilla seleccionada no está disponible.",
        );
      }
      const text = clause.text ?? template?.templateMarkdown;
      if (!text) throw new LoyaltyError(422, "Cada cláusula debe tener texto.");
      return renderTermsText(
        text,
        variables,
        Array.isArray(template?.variablesAllowlist)
          ? template.variablesAllowlist.filter(
              (item): item is string => typeof item === "string",
            )
          : [],
      );
    })
    .join("\n\n");
  return {
    markdown,
    hash: createHash("sha256").update(markdown).digest("hex"),
  };
}

export async function saveProgram(userId: string, rawInput: unknown) {
  const input = validateProgramInput(rawInput);
  const context = await programForOwner(userId);
  if (!context) throw new LoyaltyError(403, "No tienes un negocio como owner.");
  const { business, program } = context;
  if (program?.status === "closing") {
    throw new LoyaltyError(
      409,
      "El programa está en cierre y no puede editarse.",
    );
  }
  if (program && program.kind !== input.kind) {
    throw new LoyaltyError(
      409,
      "Cierra el programa actual antes de cambiar su modalidad.",
    );
  }
  const terms = await renderedTerms(input, business);
  const db = getDb();
  if (program) {
    await db
      .update(loyaltyPrograms)
      .set({
        configuration: input.configuration,
        termsMarkdown: terms.markdown,
        termsHash: terms.hash,
        termsUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(loyaltyPrograms.id, program.id),
          eq(loyaltyPrograms.status, "active"),
        ),
      );
    return { programId: program.id, created: false };
  }
  const id = randomUUID();
  await db.insert(loyaltyPrograms).values({
    id,
    businessId: business.id,
    kind: input.kind,
    configuration: input.configuration,
    status: "active",
    termsMarkdown: terms.markdown,
    termsHash: terms.hash,
    createdBy: userId,
  });
  return { programId: id, created: true };
}

export async function closeProgram(userId: string, input: CloseInput) {
  const context = await programForOwner(userId);
  if (!context?.program || context.program.status !== "active") {
    throw new LoyaltyError(409, "No hay un programa activo para cerrar.");
  }
  const earningEndsAt = zonedDateTimeToUtc(
    input.earningEndsAt,
    context.business.timezone,
  );
  const redemptionEndsAt = zonedDateTimeToUtc(
    input.redemptionEndsAt,
    context.business.timezone,
  );
  if (
    !earningEndsAt ||
    !redemptionEndsAt ||
    earningEndsAt <= new Date() ||
    earningEndsAt >= redemptionEndsAt
  ) {
    throw new LoyaltyError(
      422,
      "Indica una ventana futura válida en la zona horaria del negocio.",
    );
  }
  await getDb()
    .update(loyaltyPrograms)
    .set({
      status: "closing",
      earningEndsAt,
      redemptionEndsAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(loyaltyPrograms.id, context.program.id),
        eq(loyaltyPrograms.status, "active"),
      ),
    );
}

/** Idempotent job for Vercel Cron; reads also enforce expiry as a safety net. */
export async function expireClosingPrograms(now = new Date()) {
  await getDb()
    .update(loyaltyPrograms)
    .set({ status: "inactive", updatedAt: now })
    .where(
      and(
        eq(loyaltyPrograms.status, "closing"),
        lte(loyaltyPrograms.redemptionEndsAt, now),
      ),
    );
}
