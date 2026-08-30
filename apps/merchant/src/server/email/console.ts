import { randomUUID } from "node:crypto";
import type { EmailChannel } from "./channel";

export type SentEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  at: Date;
};

/**
 * In-memory capture of emails "sent" by the console channel. Dev/test only — lets an
 * integration test read the OTP that better-auth generated inside `sendVerificationOTP`.
 * Never populated when `NODE_ENV === "production"` (and the channel is not even selectable
 * there — see `emailChannelFromEnv`).
 */
export const consoleEmailOutbox: SentEmail[] = [];

/** Dev/test email channel: does not send. In prod it never runs (provider blocks it). */
export class ConsoleEmailChannel implements EmailChannel {
  async sendEmail(input: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }) {
    if (process.env.NODE_ENV !== "production") {
      // Dev/test: the full body (incl. the code) is acceptable so the developer or the
      // integration test can complete the flow without a real inbox.
      consoleEmailOutbox.push({
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        at: new Date(),
      });
      console.info("email_console", {
        to: input.to,
        subject: input.subject,
        text: input.text,
      });
    } else {
      // Defensive: metadata only, never the body/code.
      console.info("email_console", { to: input.to, subject: input.subject });
    }
    return {
      provider: "console",
      providerMessageId: `console-${randomUUID()}`,
    };
  }
}
