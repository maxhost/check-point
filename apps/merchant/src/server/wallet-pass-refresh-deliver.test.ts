import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The SILENT contract of a `pass_refresh` delivery (spec 0065, phase A3), pinned without
 * a database: `deliverClaimed` must close the row as `sent` and touch NOTHING else —
 * no `latest_message`/`message_updated_at`, no `last_push_at`, no campaign preemption.
 * The integration end-to-end of the lane is phase A5; this is the unit oracle for the
 * three guards, so the invariant has a test of its own and not just a docblock.
 *
 * `../db` is mocked (the module `push.ts` and `push-transports.ts` both resolve for
 * `getDb`), so every statement is recorded instead of executed. The mock factory imports
 * nothing (a value import of a barrel inside a mock factory deadlocks the suite —
 * `CLAUDE.md`).
 */

type Recorded = { text: string };
const executed: Recorded[] = [];
const accountUpdates: Record<string, unknown>[] = [];
let claimRows: Record<string, unknown>[] = [];

/** Renders a drizzle `sql` template to plain text (params become `?`) for assertions. */
function sqlText(query: unknown): string {
  const chunks = (query as { queryChunks?: unknown[] })?.queryChunks ?? [];
  return chunks
    .map((c) => {
      // A chunk can be a raw `null` (an interpolated null param), so guard before
      // reading `.value` — a throw here would be swallowed by `deliverClaimed`'s catch
      // and would look exactly like a delivery failure.
      const value = c === null ? undefined : (c as { value?: unknown }).value;
      return Array.isArray(value) ? value.join("") : "?";
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

vi.mock("./db", () => {
  const thenable = (rows: unknown[]) => {
    const chain: Record<string, unknown> = {};
    for (const m of [
      "from",
      "innerJoin",
      // `leftJoin`: the pass-placement reader of phase A4 outer-joins `campaign_turn`
      // (a utility door has no turn). Missing from this list the chain broke, the body
      // read threw, and `patchGoogle` swallowed it into an error string — the PATCH
      // simply never went out, with the row still closing as `sent`.
      "leftJoin",
      "where",
      "limit",
      "orderBy",
      "select",
    ])
      chain[m] = () => chain;
    chain.then = (onFulfilled: (v: unknown[]) => unknown) =>
      Promise.resolve(rows).then(onFulfilled);
    return chain;
  };
  return {
    getDb: () => ({
      execute: (query: unknown) => {
        const text = sqlText(query);
        executed.push({ text });
        // The claim is the only statement whose rows the code reads.
        if (
          text.startsWith(
            "UPDATE consumer.wallet_push_queue SET status = 'sending'",
          )
        )
          return Promise.resolve({ rows: claimRows });
        // `consumerHasReachableWallet` — say yes, so the control transactional takes the
        // wallet route (Apple + addMessage) instead of the Web Push fallback.
        if (text.includes("AS reachable"))
          return Promise.resolve({ rows: [{ reachable: true }] });
        return Promise.resolve({ rows: [] });
      },
      // One row that satisfies EVERY reader of this path: `appleTargets` (id/pushToken),
      // `googleSerial` (serialNumber), the `latest_message` lookup and the pass-placement
      // join of phase A4 (a door with its turn). Without a target the transport
      // assertions would pass vacuously — no call recorded is not the same as no
      // addMessage sent.
      select: () =>
        thenable([
          {
            id: "dev-1",
            pushToken: "tok-1",
            serialNumber: "serial-1",
            latestMessage: "Se acreditó 1 sello",
            locationId: "loc-1",
            latitude: "-34.6083000",
            longitude: "-58.3712000",
            relevantText: "Bar La Esquina: 2x1 en picadas",
            businessName: "Bar La Esquina",
            turnId: "turn-1",
            turnMessage: "2x1 en picadas",
          },
        ]),
      update: () => ({
        set: (values: Record<string, unknown>) => {
          accountUpdates.push(values);
          return { where: () => Promise.resolve([]) };
        },
      }),
      delete: () => ({ where: () => Promise.resolve([]) }),
    }),
  };
});

const { deliverRow } = await import("./wallet/push");
const { FakePushChannel } = await import("./wallet/push-channel");

const NOW = new Date("2026-09-15T12:00:00Z");

function claim(klass: string) {
  claimRows = [
    {
      consumer_id: "consumer-1",
      title: klass === "pass_refresh" ? "" : "La Gringa",
      body: klass === "pass_refresh" ? "" : "Se acreditó 1 sello",
      class: klass,
    },
  ];
}

beforeEach(() => {
  executed.length = 0;
  accountUpdates.length = 0;
});

describe("deliverClaimed for a pass_refresh row (spec 0065)", () => {
  it("closes the row as sent and writes NOTHING on the consumer account", async () => {
    claim("pass_refresh");
    const channel = new FakePushChannel();
    const delivered = await deliverRow("row-1", {
      channel,
      webPushChannel: null,
      now: NOW,
    });
    expect(delivered).toBe(true);
    expect(executed.some((e) => e.text.includes("status = 'sent'"))).toBe(true);
    // No latest_message / message_updated_at / last_push_at write at all.
    expect(accountUpdates).toEqual([]);
    // And no campaign preemption.
    expect(executed.some((e) => e.text.includes("class = 'campaign'"))).toBe(
      false,
    );
  });

  it("goes out as APNs + the silent Google PATCH, never an addMessage", async () => {
    claim("pass_refresh");
    const channel = new FakePushChannel();
    await deliverRow("row-1", { channel, webPushChannel: null, now: NOW });
    expect(channel.calls.map((c) => c.kind)).toEqual(["apple", "google-patch"]);
  });

  it("PATCHes the REAL body — the doors of pass_placement, never `{}` (phase A4)", async () => {
    claim("pass_refresh");
    const channel = new FakePushChannel();
    await deliverRow("row-1", { channel, webPushChannel: null, now: NOW });
    const patch = channel.calls.find((c) => c.kind === "google-patch");
    // An empty body is the silent failure of this lane: a PATCH that answers 200 and
    // changes nothing. The coordinates travel as NUMBERS (the column is `numeric`, which
    // the driver returns as a string, and a stringified coordinate never triggers).
    expect(patch).toEqual({
      kind: "google-patch",
      serialNumber: "serial-1",
      patch: {
        merchantLocations: [{ latitude: -34.6083, longitude: -58.3712 }],
        textModulesData: [
          {
            id: "latest",
            header: "Última novedad",
            body: "Se acreditó 1 sello",
          },
          {
            id: "turn-turn-1",
            header: "Cerca tuyo",
            body: "Bar La Esquina — 2x1 en picadas",
          },
        ],
      },
    });
  });

  it("CONTROL: a transactional does write the account and preempt campaigns", async () => {
    claim("transactional");
    const channel = new FakePushChannel();
    await deliverRow("row-2", { channel, webPushChannel: null, now: NOW });
    expect(accountUpdates).toHaveLength(2);
    expect(accountUpdates[0]).toMatchObject({
      latestMessage: "La Gringa: Se acreditó 1 sello",
      messageUpdatedAt: NOW,
    });
    expect(accountUpdates[1]).toEqual({ lastPushAt: NOW });
    expect(executed.some((e) => e.text.includes("class = 'campaign'"))).toBe(
      true,
    );
    // The contrast that makes the fake's `google-patch` load-bearing: a transactional
    // goes out as an `addMessage`, a refresh as a PATCH.
    expect(channel.calls.map((c) => c.kind)).toEqual(["apple", "google"]);
  });
});
