import { describe, expect, it, vi } from "vitest";

/**
 * Spec 0111 (revision): the reminder PLANNER runs at the top of `runPushWorker`, before
 * the drain. If its query throws, the pass must still drain what is due — otherwise one
 * failing candidates query parks every retry, campaign and `pass_refresh` until it heals.
 * The planner is doubled to throw; a due `pass_refresh` must still be sent.
 */

vi.mock("./wallet/reminder-store", () => ({
  planReminders: () => Promise.reject(new Error("planner query failed")),
}));

const selectResponses: unknown[][] = [];
const claimResponses: Record<string, unknown>[][] = [];
const queueUpdates: Record<string, unknown>[] = [];

vi.mock("./db", () => {
  // Renders a drizzle `sql` template to text so the CLAIM statement can be told apart
  // from the ones `deliverClaimed` runs afterwards (a chunk can be a raw `null`, so it
  // is guarded: a throw in here would be swallowed and look like a delivery failure).
  const sqlText = (query: unknown): string => {
    const chunks = (query as { queryChunks?: unknown[] })?.queryChunks ?? [];
    return chunks
      .map((c) => {
        const value = c === null ? undefined : (c as { value?: unknown }).value;
        return Array.isArray(value) ? value.join("") : "?";
      })
      .join("")
      .replace(/\s+/g, " ")
      .trim();
  };
  const thenable = (rows: unknown[]) => {
    const chain: Record<string, unknown> = {};
    for (const m of ["from", "innerJoin", "where", "limit", "orderBy"])
      chain[m] = () => chain;
    chain.then = (onFulfilled: (v: unknown[]) => unknown) =>
      Promise.resolve(rows).then(onFulfilled);
    return chain;
  };
  return {
    getDb: () => ({
      // Each caller in order: `selectDue`, then `lastPushAt`, then the transports.
      select: () => thenable(selectResponses.shift() ?? []),
      execute: (query: unknown) =>
        Promise.resolve({
          rows: sqlText(query).startsWith(
            "UPDATE consumer.wallet_push_queue SET status = 'sending'",
          )
            ? (claimResponses.shift() ?? [])
            : [],
        }),
      update: () => ({
        set: (values: Record<string, unknown>) => {
          queueUpdates.push(values);
          return { where: () => Promise.resolve([]) };
        },
      }),
      delete: () => ({ where: () => Promise.resolve([]) }),
    }),
  };
});

const { runPushWorker } = await import("./wallet/push-worker");
const { FakePushChannel } = await import("./wallet/push-channel");

const NOW = new Date("2026-09-15T12:00:00Z");
const EARLIER = new Date("2026-09-15T11:00:00Z");

describe("runPushWorker isolates the reminder planner", () => {
  it("drains the due rows even when planReminders throws", async () => {
    selectResponses.push(
      [
        {
          id: "row-ref",
          consumerId: "c1",
          klass: "pass_refresh",
          notBefore: EARLIER,
          createdAt: EARLIER,
        },
      ],
      [{ lastPushAt: null }],
    );
    claimResponses.push([
      { consumer_id: "c1", title: "", body: "", class: "pass_refresh" },
    ]);

    const summary = await runPushWorker({
      channel: new FakePushChannel(),
      webPushChannel: null,
      now: NOW,
      consumerIds: ["c1"],
    });

    expect(summary).toEqual({
      sent: 1,
      rescheduled: 0,
      skipped: 0,
      planned: 0,
    });
  });
});
