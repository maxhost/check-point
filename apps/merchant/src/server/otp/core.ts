import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { countryByIso } from "../../lib/countries";
import { RECOVERY_COUNTRIES } from "../../lib/recovery-countries";

export { RECOVERY_COUNTRIES };

export type OtpLocale = "es" | "pt" | "en";
export type OtpPurpose = "recover_account";
export type OtpProvider = "clicksend" | "twilio";
export type OtpChallengeStatus =
  | "pending"
  | "verified"
  | "consumed"
  | "locked"
  | "expired"
  | "invalidated";

export type OtpDeliveryInput = {
  phoneE164: string;
  countryIso: string;
  code: string;
  locale: OtpLocale;
  purpose: OtpPurpose;
};

export type OtpDeliveryReceipt = {
  provider: OtpProvider;
  providerMessageId: string;
  acceptedAt: Date;
};

export interface OtpChannel {
  deliverOtp(input: OtpDeliveryInput): Promise<OtpDeliveryReceipt>;
}

export class OtpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class OtpProviderError extends Error {
  constructor(
    readonly provider: OtpProvider,
    readonly reason:
      | "configuration"
      | "timeout"
      | "rejected"
      | "invalid_response",
  ) {
    super(`OTP provider ${provider} failed: ${reason}`);
  }
}

export const OTP_TTL_SECONDS = 300;
export const OTP_RESEND_SECONDS = 60;
export const ONBOARDING_TTL_SECONDS = 900;

const ENGLISH = new Set([
  "AG",
  "BB",
  "BS",
  "BZ",
  "CA",
  "DM",
  "GD",
  "HT",
  "JM",
  "KN",
  "LC",
  "TT",
  "US",
  "VC",
]);
const E164 = /^\+[1-9]\d{1,14}$/;

export function localeForCountry(countryIso: string): OtpLocale {
  if (countryIso === "BR") return "pt";
  return ENGLISH.has(countryIso) ? "en" : "es";
}

export function validateRecoveryPhone(
  phoneValue: unknown,
  countryValue: unknown,
) {
  const phoneE164 = typeof phoneValue === "string" ? phoneValue.trim() : "";
  const countryIso =
    typeof countryValue === "string" ? countryValue.trim().toUpperCase() : "";
  const country = countryByIso(countryIso);
  if (
    !E164.test(phoneE164) ||
    !RECOVERY_COUNTRIES.has(countryIso) ||
    !country
  ) {
    throw new OtpError(
      400,
      "invalid_recovery_input",
      "Revisá el teléfono y el país.",
    );
  }
  if (!phoneE164.startsWith(`+${country.dial}`)) {
    throw new OtpError(
      400,
      "invalid_recovery_input",
      "Revisá el teléfono y el país.",
    );
  }
  return { phoneE164, countryIso, locale: localeForCountry(countryIso) };
}

export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function otpHash(
  code: string,
  secret: string,
  context = "legacy",
): string {
  if (!secret) throw new Error("OTP_HMAC_SECRET no está configurado.");
  return createHmac("sha256", secret)
    .update(`${context.length}:${context}:${code}`)
    .digest("hex");
}

export function verifyOtpHash(
  code: string,
  expected: string,
  secret: string,
  context = "legacy",
): boolean {
  const actual = Buffer.from(otpHash(code, secret, context), "hex");
  const stored = Buffer.from(expected, "hex");
  return actual.length === stored.length && timingSafeEqual(actual, stored);
}

function encryptionKey(secret: string): Buffer {
  const key = Buffer.from(secret, "base64");
  if (key.length !== 32)
    throw new Error("OTP_ENCRYPTION_KEY debe ser base64 de 32 bytes.");
  return key;
}

export function encryptOtp(
  code: string,
  secret: string,
  keyVersion = "v1",
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(code, "utf8"),
    cipher.final(),
  ]);
  return `${keyVersion}.${Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url")}`;
}

export function decryptOtp(payload: string, secret: string): string {
  const [version, encoded] = payload.split(".");
  if (version !== "v1" || !encoded) throw new Error("OTP ciphertext inválido.");
  const packed = Buffer.from(encoded, "base64url");
  if (packed.length < 29) throw new Error("OTP ciphertext inválido.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(secret),
    packed.subarray(0, 12),
  );
  decipher.setAuthTag(packed.subarray(12, 28));
  return Buffer.concat([
    decipher.update(packed.subarray(28)),
    decipher.final(),
  ]).toString("utf8");
}

export function otpContext(input: {
  challengeId: string;
  phoneE164: string;
  purpose: OtpPurpose;
}): string {
  return `${input.challengeId}|${input.phoneE164}|${input.purpose}`;
}

export type VerifyDecision =
  | {
      kind: "reject";
      status: OtpChallengeStatus;
      attempts: number;
      purge: boolean;
    }
  | { kind: "accept"; status: "verified"; attempts: number; purge: true };

/** Pure, exhaustive transition used by persistence adapters. */
export function decideOtpVerification(input: {
  status: OtpChallengeStatus;
  attempts: number;
  expiresAt: Date;
  now: Date;
  codeMatches: boolean;
}): VerifyDecision {
  if (input.status !== "pending")
    return {
      kind: "reject",
      status: input.status,
      attempts: input.attempts,
      purge: true,
    };
  if (input.expiresAt <= input.now)
    return {
      kind: "reject",
      status: "expired",
      attempts: input.attempts,
      purge: true,
    };
  if (input.codeMatches)
    return {
      kind: "accept",
      status: "verified",
      attempts: input.attempts,
      purge: true,
    };
  const attempts = Math.min(2, input.attempts + 1);
  return {
    kind: "reject",
    status: attempts >= 2 ? "locked" : "pending",
    attempts,
    purge: attempts >= 2,
  };
}

export function otpMessage(locale: OtpLocale, code: string): string {
  if (locale === "pt")
    return `Seu código do CheckPass Club é ${code}. Expira em 5 minutos. Não compartilhe.`;
  if (locale === "en")
    return `Your CheckPass Club code is ${code}. It expires in 5 minutes. Do not share it.`;
  return `Tu código de CheckPass Club es ${code}. Vence en 5 minutos. No lo compartas.`;
}
