import {
  API_OWNER_CODES,
  DEFAULT_MESSAGES,
  type ApiOwnerFailure,
} from "@mi-pasaporte/domain/server/business-status";

/** Shared owner-email decision for member APIs and the authorized modules seed. */
export function memberEmailFailure(
  role: string,
  emailVerified: unknown,
  message: string = DEFAULT_MESSAGES.emailNotVerified,
): ApiOwnerFailure | null {
  return role === "owner" && emailVerified !== true
    ? { status: 403, code: API_OWNER_CODES.emailNotVerified, message }
    : null;
}
