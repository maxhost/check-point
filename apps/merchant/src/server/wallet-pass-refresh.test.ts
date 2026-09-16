import { describe, expect, it } from "vitest";
import { type QueueRow, planConsumerDrain } from "./wallet/push";
import { parseQueueClass } from "./wallet/push-worker";
import { planTransports } from "./wallet/push-transports";
import { buildPatchObjectRequest } from "./wallet/google";
import { FakePushChannel } from "./wallet/push-channel";

/**
 * The `pass_refresh` lane of spec 0065 (phase A3): the class must survive the queue
 * reader, send without spending the push budget, and reach Google as a silent PATCH.
 * All pure — no DB.
 */

const COOLDOWN = 3 * 60 * 1000;
const NOW = new Date(1_700_000_500_000);

function row(
  id: string,
  klass: QueueRow["klass"],
  offsetMin: number,
): QueueRow {
  const t = new Date(1_700_000_000_000 + offsetMin * 60_000);
  return { id, consumerId: "c1", klass, notBefore: t, createdAt: t };
}

describe("queue class mapping (push-worker)", () => {
  it("keeps pass_refresh as pass_refresh — it is NOT collapsed to transactional", () => {
    expect(parseQueueClass("pass_refresh")).toBe("pass_refresh");
  });

  it("maps the two pre-existing classes unchanged", () => {
    expect(parseQueueClass("transactional")).toBe("transactional");
    expect(parseQueueClass("campaign")).toBe("campaign");
  });

  it("THROWS on an unknown class instead of defaulting to transactional", () => {
    expect(() => parseQueueClass("proximity")).toThrow(/desconocida/);
    expect(() => parseQueueClass("")).toThrow(/desconocida/);
  });
});

describe("planConsumerDrain with pass_refresh (spec 0065)", () => {
  it("always sends, even with a push one second ago (skips the cooldown)", () => {
    const lastPush = new Date(NOW.getTime() - 1000);
    const actions = planConsumerDrain(
      [row("ref", "pass_refresh", 0)],
      lastPush,
      NOW,
      COOLDOWN,
    );
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ kind: "send", row: { id: "ref" } });
  });

  it("does NOT advance the clock: a campaign behind it still sends", () => {
    const actions = planConsumerDrain(
      [row("ref", "pass_refresh", 0), row("camp", "campaign", 0)],
      null,
      NOW,
      COOLDOWN,
    );
    const camp = actions.find((a) => a.row.id === "camp");
    // Were pass_refresh treated as transactional, this would be a `reschedule` to
    // now + cooldown — the campaign postponed by a silent refresh.
    expect(camp).toMatchObject({ kind: "send" });
  });

  it("does not postpone a campaign that is already past its cooldown either", () => {
    const old = new Date(NOW.getTime() - COOLDOWN - 1000);
    const actions = planConsumerDrain(
      [row("ref", "pass_refresh", 0), row("camp", "campaign", 0)],
      old,
      NOW,
      COOLDOWN,
    );
    expect(actions.map((a) => [a.row.id, a.kind])).toEqual([
      ["ref", "send"],
      ["camp", "send"],
    ]);
  });

  it("its position in the batch changes no other row's action", () => {
    const withRefresh = planConsumerDrain(
      [
        row("camp", "campaign", 0),
        row("ref", "pass_refresh", 0),
        row("txn", "transactional", 0),
      ],
      null,
      NOW,
      COOLDOWN,
    );
    const withoutRefresh = planConsumerDrain(
      [row("camp", "campaign", 0), row("txn", "transactional", 0)],
      null,
      NOW,
      COOLDOWN,
    );
    expect(withRefresh.filter((a) => a.row.id !== "ref")).toEqual(
      withoutRefresh,
    );
    // And the transactional still preempts the campaign.
    expect(withoutRefresh[1]).toMatchObject({
      kind: "reschedule",
      row: { id: "camp" },
      notBefore: new Date(NOW.getTime() + COOLDOWN),
    });
  });

  it("orders the three classes deterministically, whatever the input order", () => {
    const rows = [
      row("camp", "campaign", 0),
      row("ref-b", "pass_refresh", 0),
      row("ref-a", "pass_refresh", 0), // same timestamp as ref-b → id breaks the tie
      row("txn", "transactional", 0),
    ];
    const expected = ["txn", "ref-a", "ref-b", "camp"];
    expect(planConsumerDrain(rows, null, NOW, COOLDOWN).map((a) => a.row.id)) //
      .toEqual(expected);
    expect(
      planConsumerDrain([...rows].reverse(), null, NOW, COOLDOWN).map(
        (a) => a.row.id,
      ),
    ).toEqual(expected);
  });
});

describe("transport fan-out for pass_refresh (spec 0065)", () => {
  it("is Apple + the silent Google PATCH — no addMessage, no Web Push", () => {
    expect(planTransports("pass_refresh", false)).toEqual({
      apple: true,
      googlePatch: true,
      googleAddMessage: false,
      webPush: false,
    });
  });

  it("does not depend on wallet reachability", () => {
    expect(planTransports("pass_refresh", true)).toEqual(
      planTransports("pass_refresh", false),
    );
  });
});

describe("Google Loyalty Object PATCH request shape (spec 0065)", () => {
  it("targets the object itself, NOT the addMessage endpoint", () => {
    const req = buildPatchObjectRequest("3388000000012345678", "serial-xyz", {
      merchantLocations: [{ latitude: -31.4, longitude: -64.18 }],
    });
    expect(req.url).toBe(
      "https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/3388000000012345678.serial-xyz",
    );
    // `addMessage` always notifies; a refresh that hit it would ring the phone.
    expect(req.url).not.toContain("addMessage");
    expect(req.body).toEqual({
      merchantLocations: [{ latitude: -31.4, longitude: -64.18 }],
    });
    // No `message` key: a PATCH carries object fields, never a notice.
    expect(req.body).not.toHaveProperty("message");
  });
});

describe("the fake channel distinguishes a PATCH from an addMessage", () => {
  it("records google-patch for the PATCH and google for addMessage", async () => {
    const fake = new FakePushChannel();
    await fake.sendGoogle("serial-1", { header: "h", body: "b" });
    await fake.patchGoogleObject("serial-1", { merchantLocations: [] });
    expect(fake.calls.map((c) => c.kind)).toEqual(["google", "google-patch"]);
    expect(fake.calls[1]).toMatchObject({
      kind: "google-patch",
      serialNumber: "serial-1",
      patch: { merchantLocations: [] },
    });
  });
});
