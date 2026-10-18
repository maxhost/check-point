/** Spec0238 A2b: request-owned JOIN results; wrappers retain access decisions. */
import { randomUUID } from "node:crypto";
import { cache } from "react";
import { headers } from "next/headers";
import type { BackofficeSelectionMode } from "../backoffice-context-contract";
import type { BusinessBilling } from "./billing-gate";
import { getMerchantAuth } from "./auth";
import {
  readBackofficeMembership,
  readBackofficeMembershipOnly,
  type BackofficeMembershipRow,
  type BackofficeMembershipRead,
} from "./backoffice-membership";

type NativeSession = Awaited<
  ReturnType<ReturnType<typeof getMerchantAuth>["api"]["getSession"]>
>;
type PageRow = Pick<
  BackofficeMembershipRow,
  | "id"
  | "name"
  | "currencyCode"
  | "timezone"
  | "businessStatus"
  | "suspensionReason"
  | "role"
  | "permissions"
  | "pinMustChange"
> & { status: string };
type OwnerRow = Pick<
  BackofficeMembershipRow,
  "id" | "slug" | "countryCode" | "currencyCode" | "suspensionReason"
> & { status: string };
type MembershipByMode = {
  page: PageRow | null;
  "active-owner": OwnerRow | null;
  "active-member":
    | (OwnerRow &
        Pick<BackofficeMembershipRow, "role" | "permissions" | "pinMustChange">)
    | null;
};
export type BackofficeSelection =
  | { state: "joined"; data: BackofficeMembershipRead }
  | {
      state: "recovered";
      member: BackofficeMembershipRow | null;
      error: unknown;
    };
function memberOf(selection: BackofficeSelection) {
  return selection.state === "joined"
    ? (selection.data?.member ?? null)
    : selection.member;
}
function project<M extends BackofficeSelectionMode>(
  mode: M,
  row: BackofficeMembershipRow | null,
): MembershipByMode[M] {
  if (!row) return null;
  if (mode === "page") {
    const {
      id,
      name,
      currencyCode,
      timezone,
      businessStatus,
      suspensionReason,
      role,
      permissions,
      pinMustChange,
    } = row;
    return {
      id,
      name,
      currencyCode,
      timezone,
      businessStatus,
      suspensionReason,
      role,
      permissions,
      pinMustChange,
      status: row.membershipStatus,
    } as MembershipByMode[M];
  }
  const { id, slug, countryCode, currencyCode, suspensionReason } = row;
  const owner = {
    id,
    slug,
    countryCode,
    currencyCode,
    suspensionReason,
    status: row.businessStatus,
  };
  return (
    mode === "active-owner"
      ? owner
      : {
          ...owner,
          role: row.role,
          permissions: row.permissions,
          pinMustChange: row.pinMustChange,
        }
  ) as MembershipByMode[M];
}
export type BackofficeDataContext = {
  readonly now: Date;
  readonly bootId: string;
  readSession(): Promise<NativeSession>;
  /** Internal, server-only full row, including nullable subscription/plan for A2c. */
  readSelection(mode: BackofficeSelectionMode): Promise<BackofficeSelection>;
  readMembership<M extends BackofficeSelectionMode>(
    mode: M,
  ): Promise<MembershipByMode[M]>;
  readBilling(
    businessId: string,
    mode: BackofficeSelectionMode,
  ): Promise<BusinessBilling>;
};
function createContext(requestHeaders: Headers): BackofficeDataContext {
  const now = new Date();
  let session: Promise<NativeSession> | undefined;
  const selections = new Map<
    BackofficeSelectionMode,
    Promise<BackofficeSelection>
  >();
  const members = new Map<
    BackofficeSelectionMode,
    Promise<MembershipByMode[BackofficeSelectionMode]>
  >();
  const billings = new Map<
    BackofficeSelectionMode,
    Map<string, Promise<BusinessBilling>>
  >();
  const readSession = () =>
    (session ??= Promise.resolve().then(() =>
      getMerchantAuth().api.getSession({ headers: requestHeaders }),
    ));
  const readSelection = (mode: BackofficeSelectionMode) => {
    let pending = selections.get(mode);
    if (!pending) {
      pending = readSession().then(
        async (identity): Promise<BackofficeSelection> => {
          if (!identity) return { state: "joined", data: null };
          try {
            return {
              state: "joined",
              data: await readBackofficeMembership(identity.user.id, mode, now),
            };
          } catch (error) {
            const member = await readBackofficeMembershipOnly(
              identity.user.id,
              mode,
            );
            return { state: "recovered", member, error };
          }
        },
      );
      selections.set(mode, pending);
    }
    return pending;
  };
  return {
    now,
    bootId: randomUUID(),
    readSession,
    readSelection,
    readMembership<M extends BackofficeSelectionMode>(
      mode: M,
    ): Promise<MembershipByMode[M]> {
      let pending = members.get(mode);
      if (!pending) {
        pending = readSelection(mode).then((result) =>
          project(mode, memberOf(result)),
        );
        members.set(mode, pending);
      }
      return pending as Promise<MembershipByMode[M]>;
    },
    readBilling(businessId, mode) {
      let byBusiness = billings.get(mode);
      if (!byBusiness) {
        byBusiness = new Map();
        billings.set(mode, byBusiness);
      }
      let pending = byBusiness.get(businessId);
      if (!pending) {
        pending = readSelection(mode).then((selection) => {
          if (selection.state === "recovered") throw selection.error;
          if (!selection.data || selection.data.member.id !== businessId)
            throw new Error(
              "Billing business does not match selected membership",
            );
          return selection.data.billing;
        });
        byBusiness.set(businessId, pending);
      }
      return pending;
    },
  };
}
/** React supplies render isolation; never use it as a handler cache. */
export const getBackofficeRenderContext = cache(
  async (): Promise<BackofficeDataContext> => createContext(await headers()),
);
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
