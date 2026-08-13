import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, lte } from "drizzle-orm";
import { getDb } from "./db";
import {
  businesses,
  loyaltyProgramEvents,
  loyaltyPrograms,
  memberships,
} from "./schema";
import {
  type CloseInput,
  type EventAction,
  LoyaltyError,
} from "./loyalty-program/core";
import { validateProgramInput } from "./loyalty-program/validation";
import { validateClosingWindow } from "./loyalty-program/time";
import { renderedTerms } from "./loyalty-program/terms";

export { LoyaltyError } from "./loyalty-program/core";
export type {
  LoyaltyKind,
  ProgramInput,
  CloseInput,
} from "./loyalty-program/core";
export {
  normalizeConfiguration,
  renderTermsText,
  validateProgramInput,
} from "./loyalty-program/validation";
export {
  formatBusinessDate,
  validateClosingWindow,
  zonedDateTimeToUtc,
} from "./loyalty-program/time";

type Db = ReturnType<typeof getDb>;
const STATE_CHANGED =
  "El programa cambió de estado; recarga e intenta de nuevo.";

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "23505"
  );
}

async function recordEvent(
  db: Db,
  event: {
    programId: string;
    businessId: string;
    actorId: string | null;
    action: EventAction;
    details?: Record<string, unknown>;
  },
) {
  await db.insert(loyaltyProgramEvents).values({
    programId: event.programId,
    businessId: event.businessId,
    actorId: event.actorId,
    action: event.action,
    details: event.details ?? {},
  });
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
  const db = getDb();
  const expired = await db
    .update(loyaltyPrograms)
    .set({ status: "inactive", updatedAt: new Date() })
    .where(
      and(
        eq(loyaltyPrograms.businessId, business.id),
        eq(loyaltyPrograms.status, "closing"),
        lte(loyaltyPrograms.redemptionEndsAt, new Date()),
      ),
    )
    .returning({ id: loyaltyPrograms.id });
  for (const row of expired) {
    await recordEvent(db, {
      programId: row.id,
      businessId: business.id,
      actorId: null,
      action: "expired",
    });
  }
  const [program] = await db
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
    const updated = await db
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
      )
      .returning({ id: loyaltyPrograms.id });
    if (!updated.length) throw new LoyaltyError(409, STATE_CHANGED);
    await recordEvent(db, {
      programId: program.id,
      businessId: business.id,
      actorId: userId,
      action: "edited",
      details: { termsHash: terms.hash },
    });
    return { programId: program.id, created: false };
  }
  const id = randomUUID();
  try {
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
  } catch (error) {
    if (isUniqueViolation(error))
      throw new LoyaltyError(
        409,
        "Ya existe un programa operativo para este negocio.",
      );
    throw error;
  }
  await recordEvent(db, {
    programId: id,
    businessId: business.id,
    actorId: userId,
    action: "created",
    details: { kind: input.kind },
  });
  return { programId: id, created: true };
}

export async function closeProgram(userId: string, input: CloseInput) {
  const context = await programForOwner(userId);
  if (!context?.program || context.program.status !== "active") {
    throw new LoyaltyError(409, "No hay un programa activo para cerrar.");
  }
  const { earningEndsAt, redemptionEndsAt } = validateClosingWindow(
    input,
    context.business.timezone,
    new Date(),
  );
  const db = getDb();
  const updated = await db
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
    )
    .returning({ id: loyaltyPrograms.id });
  if (!updated.length) throw new LoyaltyError(409, STATE_CHANGED);
  await recordEvent(db, {
    programId: context.program.id,
    businessId: context.business.id,
    actorId: userId,
    action: "closing_scheduled",
    details: {
      earningEndsAt: earningEndsAt.toISOString(),
      redemptionEndsAt: redemptionEndsAt.toISOString(),
    },
  });
}

/** Reverts a scheduled close back to active while redemption has not ended yet. */
export async function cancelClose(userId: string) {
  const context = await programForOwner(userId);
  if (!context?.program || context.program.status !== "closing") {
    throw new LoyaltyError(409, "No hay un cierre programado para cancelar.");
  }
  if (
    !context.program.redemptionEndsAt ||
    context.program.redemptionEndsAt <= new Date()
  ) {
    throw new LoyaltyError(
      409,
      "El periodo de canje ya terminó; no se puede cancelar.",
    );
  }
  const db = getDb();
  const updated = await db
    .update(loyaltyPrograms)
    .set({
      status: "active",
      earningEndsAt: null,
      redemptionEndsAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(loyaltyPrograms.id, context.program.id),
        eq(loyaltyPrograms.status, "closing"),
      ),
    )
    .returning({ id: loyaltyPrograms.id });
  if (!updated.length) throw new LoyaltyError(409, STATE_CHANGED);
  await recordEvent(db, {
    programId: context.program.id,
    businessId: context.business.id,
    actorId: userId,
    action: "closing_canceled",
  });
}

/** Idempotent job for Vercel Cron; reads also enforce expiry as a safety net. */
export async function expireClosingPrograms(now = new Date()) {
  const db = getDb();
  const expired = await db
    .update(loyaltyPrograms)
    .set({ status: "inactive", updatedAt: now })
    .where(
      and(
        eq(loyaltyPrograms.status, "closing"),
        lte(loyaltyPrograms.redemptionEndsAt, now),
      ),
    )
    .returning({
      id: loyaltyPrograms.id,
      businessId: loyaltyPrograms.businessId,
    });
  for (const row of expired) {
    await recordEvent(db, {
      programId: row.id,
      businessId: row.businessId,
      actorId: null,
      action: "expired",
    });
  }
  return expired.length;
}
