import type {
  BackofficeInitialContext,
  BackofficeModulesSeed,
  SessionBilling,
} from "../backoffice-context-contract";
import {
  getBackofficeRenderContext,
  type BackofficeDataContext,
} from "./backoffice-context";
import { requireBackofficeSession } from "./auth-guards";
import { backofficeScopeKey } from "./backoffice-scope";
import { memberEmailFailure } from "./member-email-gate";
import { businessStatusFailure } from "@mi-pasaporte/domain/server/business-status";
import { trialDaysLeft } from "@mi-pasaporte/domain/server/billing-access";
import { pinChangeFailure } from "./pin-change-gate";
import { listModulesWithCategory } from "../modules/activation";

async function selectedPage(context: BackofficeDataContext) {
  const [session, selection] = await Promise.all([
    context.readSession(),
    context.readSelection("page"),
  ]);
  const member =
    selection.state === "joined"
      ? (selection.data?.member ?? null)
      : selection.member;
  if (!session || !member)
    throw new Error(
      "Backoffice initial context requires an authenticated membership",
    );
  return { session, member, selection };
}
function scopeOf(
  session: NonNullable<
    Awaited<ReturnType<BackofficeDataContext["readSession"]>>
  >,
  businessId: string,
) {
  return backofficeScopeKey(
    { sessionId: session.session.id, userId: session.user.id, businessId },
    process.env.BETTER_AUTH_SECRET,
  );
}
export async function publicBackofficeBilling(
  context: BackofficeDataContext,
  businessId: string,
): Promise<SessionBilling> {
  const { access, trialEndsAt } = await context.readBilling(businessId, "page");
  return {
    access,
    trialEndsAt: trialEndsAt?.toISOString() ?? null,
    trialDaysLeft: trialDaysLeft(access, trialEndsAt, context.now),
  };
}
/** Authorized core never starts or waits for the independently streamed modules read. */
export async function readBackofficeInitialCore(): Promise<BackofficeInitialContext> {
  const guarded = await requireBackofficeSession({ allowBlocked: true });
  const context = await getBackofficeRenderContext();
  const { session, member } = await selectedPage(context);
  if (guarded.userId !== session.user.id || guarded.business.id !== member.id)
    throw new Error("Backoffice guard and initial context disagree");
  const { id, name, status, timezone, currencyCode } = guarded.business;
  return {
    version: 1,
    bootId: context.bootId,
    scopeKey: scopeOf(session, member.id),
    userId: guarded.userId,
    emailVerified: guarded.emailVerified === true,
    business: { id, name, status, timezone, currencyCode },
    membership: {
      role: guarded.membership.role,
      status: guarded.membership.status,
      permissions: [...guarded.membership.permissions],
    },
    billing: await publicBackofficeBilling(context, member.id),
  };
}
export async function readBackofficeInitialModules(
  bootId: string,
  scopeKey: string,
): Promise<BackofficeModulesSeed> {
  const envelope = { bootId, scopeKey };
  try {
    const context = await getBackofficeRenderContext();
    const { session, member } = await selectedPage(context);
    if (context.bootId !== bootId || scopeOf(session, member.id) !== scopeKey)
      return { ...envelope, result: { state: "unavailable" } };
    if (
      member.membershipStatus !== "active" ||
      memberEmailFailure(member.role, session.user.emailVerified) ||
      businessStatusFailure(
        member.businessStatus,
        member.suspensionReason,
        member.role === "owner",
      )
    )
      return { ...envelope, result: { state: "restricted" } };
    const billing = await context.readBilling(member.id, "page");
    if (billing.failure || pinChangeFailure(member))
      return { ...envelope, result: { state: "restricted" } };
    return {
      ...envelope,
      result: {
        state: "ready",
        modules: await listModulesWithCategory(member.id, member.categoryGcid),
      },
    };
  } catch (error) {
    console.error("backoffice_modules_unavailable", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return { ...envelope, result: { state: "unavailable" } };
  }
}
/** Private page presentation, never part of the serialized initial context/session reporter. */
export async function readBackofficePagePlan(): Promise<{
  plan: string;
  status: string;
}> {
  const context = await getBackofficeRenderContext(),
    selection = await context.readSelection("page");
  if (selection.state === "recovered") throw selection.error;
  if (!selection.data)
    throw new Error("Backoffice page plan requires selected membership");
  return {
    plan: selection.data.subscription?.plan ?? "none",
    status: selection.data.subscription?.status ?? "active",
  };
}
