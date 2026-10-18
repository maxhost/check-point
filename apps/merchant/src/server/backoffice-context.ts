/** Spec0238 A2a: request-owned data promises; wrappers retain all access decisions. */
import { randomUUID } from "node:crypto";
import { cache } from "react";
import { headers } from "next/headers";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { businesses, memberships } from "@mi-pasaporte/db/schema";
import type { BackofficeSelectionMode } from "../backoffice-context-contract";
import { getMerchantAuth } from "./auth";
import { ownerContext, membershipContext } from "./staff";
import { readBusinessBilling, type BusinessBilling } from "./billing-gate";

type NativeSession = Awaited<
  ReturnType<ReturnType<typeof getMerchantAuth>["api"]["getSession"]>
>;

/** A2a preserves the existing projection/query. A2b separately introduces the nullable JOIN. */
async function pageMembership(userId: string) {
  const [row] = await getDb()
    .select({
      id: businesses.id,
      name: businesses.name,
      currencyCode: businesses.currencyCode,
      timezone: businesses.timezone,
      businessStatus: businesses.status,
      suspensionReason: businesses.suspensionReason,
      role: memberships.role,
      status: memberships.status,
      permissions: memberships.permissions,
      pinMustChange: memberships.pinMustChange,
    })
    .from(memberships)
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(businesses.createdAt))
    .limit(1);
  return row ?? null;
}
type MembershipByMode = {
  page: Awaited<ReturnType<typeof pageMembership>>;
  "active-member": Awaited<ReturnType<typeof membershipContext>>;
  "active-owner": Awaited<ReturnType<typeof ownerContext>>;
};
export type BackofficeDataContext = {
  readonly now: Date;
  readonly bootId: string;
  readSession(): Promise<NativeSession>;
  readMembership<M extends BackofficeSelectionMode>(
    mode: M,
  ): Promise<MembershipByMode[M]>;
  readBilling(businessId: string): Promise<BusinessBilling>;
};
function createContext(requestHeaders: Headers): BackofficeDataContext {
  const now = new Date();
  let session: Promise<NativeSession> | undefined;
  const memberReads = new Map<
    BackofficeSelectionMode,
    Promise<MembershipByMode[BackofficeSelectionMode]>
  >();
  const billingReads = new Map<string, Promise<BusinessBilling>>();
  const readSession = () =>
    (session ??= Promise.resolve().then(() =>
      getMerchantAuth().api.getSession({ headers: requestHeaders }),
    ));
  return {
    now,
    bootId: randomUUID(),
    readSession,
    readMembership<M extends BackofficeSelectionMode>(
      mode: M,
    ): Promise<MembershipByMode[M]> {
      let pending = memberReads.get(mode);
      if (!pending) {
        pending = readSession().then<MembershipByMode[BackofficeSelectionMode]>(
          (identity) => {
            if (!identity) return null;
            if (mode === "page") return pageMembership(identity.user.id);
            if (mode === "active-owner") return ownerContext(identity.user.id);
            return membershipContext(identity.user.id);
          },
        );
        memberReads.set(mode, pending);
      }
      // The typed mode owns the corresponding reader and key; values never cross modes.
      return pending as Promise<MembershipByMode[M]>;
    },
    readBilling(businessId) {
      let pending = billingReads.get(businessId);
      if (!pending) {
        pending = Promise.resolve().then(() =>
          readBusinessBilling(businessId, now),
        );
        billingReads.set(businessId, pending);
      }
      return pending;
    },
  };
}
/** React supplies render isolation. This stable no-argument cache is never used for handlers. */
export const getBackofficeRenderContext = cache(
  async (): Promise<BackofficeDataContext> => createContext(await headers()),
);

/** Only object identity is shared: another Request, even with identical cookie, revalidates. */
const requestContexts = new WeakMap<Request, BackofficeDataContext>();
export function getBackofficeRequestContext(
  request: Request,
): BackofficeDataContext {
  let context = requestContexts.get(request);
  if (!context) {
    context = createContext(request.headers);
    requestContexts.set(request, context);
  }
  return context;
}
