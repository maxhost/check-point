import type { OtpChannel } from "./core";
import { OtpProviderError } from "./core";
import { ClickSendOtpChannel } from "./clicksend";
import { ConsoleOtpChannel } from "./fake";
import { TwilioOtpChannel } from "./twilio";

export function otpChannelFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): OtpChannel {
  const provider = env.OTP_PROVIDER ?? "clicksend";
  if (provider === "clicksend")
    return new ClickSendOtpChannel({
      username: env.CLICKSEND_USERNAME ?? "",
      apiKey: env.CLICKSEND_API_KEY ?? "",
      from: env.CLICKSEND_FROM,
    });
  if (provider === "twilio")
    return new TwilioOtpChannel({
      accountSid: env.TWILIO_ACCOUNT_SID ?? "",
      authToken: env.TWILIO_AUTH_TOKEN ?? "",
      from: env.TWILIO_FROM ?? "",
    });
  if (provider === "console" && env.NODE_ENV !== "production")
    return new ConsoleOtpChannel();
  throw new OtpProviderError(
    provider === "twilio" ? "twilio" : "clicksend",
    "configuration",
  );
}
