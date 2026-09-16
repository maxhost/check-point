import { beforeEach, describe, expect, it, vi } from "vitest";
import { pushChannelFromEnv } from "./wallet/push-channel";

/**
 * The REAL push channel's two Google paths, which nothing else in the tree reaches.
 *
 * `PushChannel.patchGoogleObject` exists as a separate method — instead of reusing
 * `sendGoogle` with an empty message — precisely so a `pass_refresh` is a silent `PATCH`
 * and never an `addMessage`, which always rings the phone. Every other suite exercises
 * that through `FakePushChannel`, which records `{kind:'google-patch'}` by construction:
 * the fake can never tell us which Google endpoint the REAL channel calls.
 *
 * The review of phase A measured the consequence: swapping the `PATCH` for an
 * `addMessage` inside `RealPushChannel` left the whole suite green, `typecheck` at 0 and
 * `lint` at 0, because `patchGoogleLoyaltyObject` had exactly ONE caller in the tree and
 * no test ever referenced `pushChannelFromEnv` with the real channel selected. In
 * production (`WALLET_PUSH_CHANNEL=real`) that is a notification on every refresh.
 *
 * Mutation that turns this red: in `RealPushChannel.patchGoogleObject`, call
 * `postGoogleMessage(...)` instead of `patchGoogleLoyaltyObject(...)`.
 */

const patchGoogleLoyaltyObject = vi.fn();
const postGoogleMessage = vi.fn();

vi.mock("./wallet/google", () => ({
  patchGoogleLoyaltyObject: (...args: unknown[]) =>
    patchGoogleLoyaltyObject(...args),
  postGoogleMessage: (...args: unknown[]) => postGoogleMessage(...args),
}));

const GOOGLE = {
  saJson: '{"client_email":"x","private_key":"y"}',
  issuerId: "3388000000000000000",
};
const ENV = {
  WALLET_PUSH_CHANNEL: "real",
  GOOGLE_WALLET_SA_JSON: GOOGLE.saJson,
  GOOGLE_WALLET_ISSUER_ID: GOOGLE.issuerId,
};

describe("the REAL push channel's Google endpoints", () => {
  beforeEach(() => {
    patchGoogleLoyaltyObject.mockClear();
    postGoogleMessage.mockClear();
  });

  it("is the real channel under `WALLET_PUSH_CHANNEL=real`", () => {
    // Without this the two tests below would pass against the fake, asserting nothing.
    expect(pushChannelFromEnv(ENV).kind).toBe("apple-google");
    expect(pushChannelFromEnv({}).kind).toBe("fake");
  });

  it("patches the Loyalty Object for a refresh: no addMessage, no notification", async () => {
    const patch = { loyaltyPoints: { balance: { string: "2 sellos" } } };

    await pushChannelFromEnv(ENV).patchGoogleObject("serial-1", patch);

    expect(patchGoogleLoyaltyObject).toHaveBeenCalledWith(
      GOOGLE,
      "serial-1",
      patch,
    );
    expect(postGoogleMessage).not.toHaveBeenCalled();
  });

  it("still uses addMessage for a real notice: the two paths are distinct", async () => {
    // The other half of the discrimination: a test that only checked «addMessage was not
    // called» would also pass if the channel did nothing at all.
    const message = { header: "Novedad", body: "2x1 en picadas" };

    await pushChannelFromEnv(ENV).sendGoogle("serial-1", message);

    expect(postGoogleMessage).toHaveBeenCalledWith(GOOGLE, "serial-1", message);
    expect(patchGoogleLoyaltyObject).not.toHaveBeenCalled();
  });
});
