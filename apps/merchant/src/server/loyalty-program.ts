import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  businesses,
  loyaltyProgramEvents,
  loyaltyPrograms,
  loyaltyRewards,
  memberships,
} from "./schema";
import { type CloseInput, LoyaltyError } from "./loyalty-program/core";
import { validateProgramInput } from "./loyalty-program/validation";
import { resolveRewards } from "./loyalty-program/rewards";
import {
  STATE_CHANGED,
  isUniqueViolation,
  loadBusinessProducts,
  loadProgramRewards,
  updateWithEvent,
} from "./loyalty-program/persistence";
import { validateClosingWindow } from "./loyalty-program/time";
import { renderedTerms } from "./loyalty-program/terms";
import {
  cleanupStampPrefixNow,
  resolveStampChange,
} from "./loyalty-program/stamp";

export { LoyaltyError } from "./loyalty-program/core";
export type {
  LoyaltyKind,
  ProgramInput,
  CloseInput,
} from "./loyalty-program/core";
export {
  normalizeConfiguration,
  renderTermsText,
  validateCardDesign,
  validateProgramInput,
} from "./loyalty-program/validation";
export {
  formatBusinessDate,
  validateClosingWindow,
  zonedDateTimeToUtc,
} from "./loyalty-program/time";
export {
  cleanupExpiredLoyaltyAssets,
  createStampUpload,
  stampForPublicProgram,
} from "./loyalty-program/stamp";

export async function ownerBusiness(userId: string) {
  const [business] = await getDb()
    .select({
      id: businesses.id,
      name: businesses.name,
      countryCode: businesses.countryCode,
      currencyCode: businesses.currencyCode,
      timezone: businesses.timezone,
      brandPrimaryColor: businesses.brandPrimaryColor,
      brandComplementaryColor: businesses.brandComplementaryColor,
      brandAccentColor: businesses.brandAccentColor,
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
  // Self-heal expiry on read as a safety net for a late cron; atomic with audit.
  await updateWithEvent(db, {
    set: sql`status = 'inactive', updated_at = now()`,
    where: sql`business_id = ${business.id} AND status = 'closing' AND redemption_ends_at <= now()`,
    actorId: null,
    action: "expired",
  });
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
  const rewards = program ? await loadProgramRewards(program.id) : [];
  return { business, program: program ?? null, rewards };
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
  // Resolve catalog_product rewards against the owner's real products (ownership +
  // name snapshot); a productId from another business is rejected here with a 422.
  const rewards = resolveRewards(
    input.rewards,
    await loadBusinessProducts(business.id),
  );
  const terms = await renderedTerms(input, business);
  const db = getDb();
  const id = program ? program.id : randomUUID();
  const accrualSet = sql`, accrual_mode = ${input.accrual.mode}, accrual_grant = ${input.accrual.grant}, accrual_block_amount = ${input.accrual.blockAmount}`;
  // R2 work (process + upload) happens before the DB write, mirroring brand; the
  // caller rolls back the new prefix if the guarded write does not land.
  const stamp = await resolveStampChange({
    businessId: business.id,
    programId: id,
    currentKey: program?.stampImageObjectKey ?? null,
    action: input.stampAction,
    uploadId: input.stampUploadId,
  });
  try {
    if (program) {
      const stampSet = stamp
        ? sql`, stamp_image_object_key = ${stamp.objectKey}, stamp_image_version = stamp_image_version + 1`
        : sql``;
      const cardSet = input.cardDesign
        ? sql`, card_background_color = ${input.cardDesign.backgroundColor}, card_background_color_2 = ${input.cardDesign.backgroundColor2}, card_background_gradient_angle = ${input.cardDesign.gradientAngle}, card_border_color = ${input.cardDesign.borderColor}`
        : sql``;
      // The reward rewrite (delete-all + re-insert) rides the same guarded CTE as the
      // config/status update and its event, so it is atomic and skips entirely if the
      // `status = 'active'` guard matches 0 rows (a losing edit never wipes rewards).
      const matched = await updateWithEvent(db, {
        set: sql`configuration = ${JSON.stringify(input.configuration)}::jsonb, terms_markdown = ${terms.markdown}, terms_hash = ${terms.hash}, terms_updated_at = now(), updated_at = now()${stampSet}${cardSet}${accrualSet}`,
        where: sql`id = ${program.id} AND status = 'active'`,
        actorId: userId,
        action: "edited",
        details: { termsHash: terms.hash, stampAction: input.stampAction },
        rewards,
      });
      if (!matched) throw new LoyaltyError(409, STATE_CHANGED);
    } else {
      // One transaction: a unique-index clash rolls back the event and rewards too.
      await db.batch([
        db.insert(loyaltyPrograms).values({
          id,
          businessId: business.id,
          kind: input.kind,
          configuration: input.configuration,
          status: "active",
          termsMarkdown: terms.markdown,
          termsHash: terms.hash,
          createdBy: userId,
          stampImageObjectKey: stamp?.objectKey ?? null,
          stampImageVersion: stamp?.objectKey ? 1 : 0,
          cardBackgroundColor: input.cardDesign?.backgroundColor ?? null,
          cardBackgroundColor2: input.cardDesign?.backgroundColor2 ?? null,
          cardBackgroundGradientAngle: input.cardDesign?.gradientAngle ?? null,
          cardBorderColor: input.cardDesign?.borderColor ?? null,
          accrualMode: input.accrual.mode,
          accrualGrant: input.accrual.grant,
          accrualBlockAmount: input.accrual.blockAmount,
        }),
        db.insert(loyaltyProgramEvents).values({
          programId: id,
          businessId: business.id,
          actorId: userId,
          action: "created",
          details: { kind: input.kind },
        }),
        db.insert(loyaltyRewards).values(
          rewards.map((r) => ({
            programId: id,
            businessId: business.id,
            rewardType: r.type,
            label: r.label,
            productId: r.productId,
            discountPercent: r.discountPercent,
            pointsCost: r.pointsCost,
            position: r.position,
          })),
        ),
      ]);
    }
  } catch (error) {
    if (stamp?.rollback)
      await cleanupStampPrefixNow(business.id, stamp.rollback);
    if (!program && isUniqueViolation(error))
      throw new LoyaltyError(
        409,
        "Ya existe un programa operativo para este negocio.",
      );
    throw error;
  }
  if (stamp?.previous) await cleanupStampPrefixNow(business.id, stamp.previous);
  return { programId: id, created: !program };
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
  const matched = await updateWithEvent(getDb(), {
    set: sql`status = 'closing', earning_ends_at = ${earningEndsAt.toISOString()}::timestamptz, redemption_ends_at = ${redemptionEndsAt.toISOString()}::timestamptz, updated_at = now()`,
    where: sql`id = ${context.program.id} AND status = 'active'`,
    actorId: userId,
    action: "closing_scheduled",
    details: {
      earningEndsAt: earningEndsAt.toISOString(),
      redemptionEndsAt: redemptionEndsAt.toISOString(),
    },
  });
  if (!matched) throw new LoyaltyError(409, STATE_CHANGED);
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
  // The `redemption_ends_at > now()` guard makes the revert race-safe, not just
  // the JS check above (which only shapes the error message).
  const matched = await updateWithEvent(getDb(), {
    set: sql`status = 'active', earning_ends_at = NULL, redemption_ends_at = NULL, updated_at = now()`,
    where: sql`id = ${context.program.id} AND status = 'closing' AND redemption_ends_at > now()`,
    actorId: userId,
    action: "closing_canceled",
  });
  if (!matched) throw new LoyaltyError(409, STATE_CHANGED);
}

/** Idempotent job for Vercel Cron; reads also enforce expiry as a safety net. */
export async function expireClosingPrograms(now = new Date()) {
  return updateWithEvent(getDb(), {
    set: sql`status = 'inactive', updated_at = ${now.toISOString()}::timestamptz`,
    where: sql`status = 'closing' AND redemption_ends_at <= ${now.toISOString()}::timestamptz`,
    actorId: null,
    action: "expired",
  });
}
