import { otpMessage, type OtpChannel, type OtpDeliveryInput } from "./core";

export class FakeOtpChannel implements OtpChannel {
  readonly deliveries: OtpDeliveryInput[] = [];
  async deliverOtp(input: OtpDeliveryInput) {
    this.deliveries.push({ ...input });
    return {
      provider: "clicksend" as const,
      providerMessageId: `fake-${this.deliveries.length}`,
      acceptedAt: new Date(),
    };
  }
}

export class ConsoleOtpChannel implements OtpChannel {
  async deliverOtp(input: OtpDeliveryInput) {
    // Deliberately contains neither phone nor code. Local operators inspect the fake channel in tests.
    console.info(
      `OTP development delivery prepared (${input.countryIso}/${input.locale}, ${otpMessage(input.locale, "******").length} chars)`,
    );
    return {
      provider: "clicksend" as const,
      providerMessageId: `console-${Date.now()}`,
      acceptedAt: new Date(),
    };
  }
}
