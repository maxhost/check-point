import { EmailProviderError, type EmailChannel } from "./channel";
import { ConsoleEmailChannel } from "./console";
import { ResendEmailChannel } from "./resend";

/**
 * Resolves the active email channel from the environment (spec 0046 / ADR 0045).
 * Mirrors `otpChannelFromEnv` on the SMS side: swapping providers is a new adapter
 * plus a branch here, never a change to the better-auth callback that calls it.
 *
 * Missing credentials fail loudly with `EmailProviderError("...", "configuration")`
 * so an incomplete deploy surfaces as a 503 instead of silently dropping emails.
 */
export function emailChannelFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): EmailChannel {
  const provider = env.EMAIL_PROVIDER ?? "resend";
  if (provider === "resend")
    return new ResendEmailChannel({
      apiKey: env.RESEND_API_KEY ?? "",
      from: env.EMAIL_FROM ?? "",
    });
  // `console` never sends and would silently swallow production recovery emails.
  if (provider === "console" && env.NODE_ENV !== "production")
    return new ConsoleEmailChannel();
  throw new EmailProviderError(provider, "configuration");
}
