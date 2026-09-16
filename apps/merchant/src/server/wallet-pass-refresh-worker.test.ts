import { describe, expect, it, vi } from "vitest";

/**
 * The WIRING of the class mapping (spec 0065, phase A3). `parseQueueClass` has its own
 * unit, but extracting it turned a behaviour ("the refresh reaches the planner as a
 * refresh") into a decision ("the mapping says refresh") and left the call site inside
 * `selectDue` — which needs a DB — without an oracle: restoring the old
 * `r.klass === "campaign" ? "campaign" : "transactional"` there keeps every pure unit
 * GREEN (`CLAUDE.md`, tarea 38: extraer no cierra la propiedad).
 *
 * This pins the call site through `runPushWorker` with `../db` mocked: a `pass_refresh`
 * plus a pending `campaign` for the same consumer must BOTH send. If the refresh is
 * collapsed to `transactional` it preempts, and the summary becomes 1 sent + 1
 * rescheduled — the exact regression the class exists to prevent.
 */

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

describe("runPushWorker keeps a pass_refresh out of the transactional lane", () => {
  it("sends the refresh AND the pending campaign (no preemption)", async () => {
    selectResponses.push(
      [
        {
          id: "row-ref",
          consumerId: "c1",
          klass: "pass_refresh",
          notBefore: EARLIER,
          createdAt: EARLIER,
        },
        {
          id: "row-camp",
          consumerId: "c1",
          klass: "campaign",
          notBefore: EARLIER,
          createdAt: EARLIER,
        },
      ],
      [{ lastPushAt: null }],
    );
    // One claim per send, in plan order: the refresh first, then the campaign.
    claimResponses.push(
      [{ consumer_id: "c1", title: "", body: "", class: "pass_refresh" }],
      [{ consumer_id: "c1", title: "t", body: "b", class: "campaign" }],
    );

    const summary = await runPushWorker({
      channel: new FakePushChannel(),
      webPushChannel: null,
      now: NOW,
      consumerIds: ["c1"],
    });

    expect(summary).toEqual({ sent: 2, rescheduled: 0, skipped: 0 });
    // The account writes are the CAMPAIGN's two — its `latest_message` and its
    // `last_push_at` — and NOTHING else: the refresh contributed none. `queueUpdates`
    // collects every `update().set()`, so a refresh collapsed to `transactional` would
    // add its own pair here (and would also have rescheduled the campaign, which the
    // summary above already rejects). ORQUESTADOR: the assertion this replaces was
    // `toEqual([])`, which read as «nothing was rescheduled» but also forbade the
    // campaign's own legitimate writes — it was red against correct code.
    expect(queueUpdates).toEqual([
      { latestMessage: "t: b", messageUpdatedAt: NOW, updatedAt: NOW },
      { lastPushAt: NOW },
    ]);
  });
});
