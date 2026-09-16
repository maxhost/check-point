import { afterAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "./counter-integration-support";
import { breakLocation } from "./marketing-integration-support";
import { readPlacement, readTurns } from "./marketing-read-support";
import {
  type World,
  WORLD_DAY as DAY,
  WORLD_NOW as NOW,
  dropWorlds,
  seedWorld,
  tickWorld,
} from "./marketing-world-support";
import type { TickSummary } from "./marketing/tick";

/**
 * The two ends of a door's life, which the rest of the phase-A suites do NOT pin: how a
 * door LEAVES the pass, and how a door that can never be used stays OUT of the queue.
 *
 * Both tests exist because the review of phase A found their invariants declared in a
 * docblock and pinned by nothing (`docs/TASKS.md`, dimension 1, findings R2 and R3). The
 * mutation each one answers to is named in its own docblock: a test whose docblock does
 * not say WHICH edit turns it red is a claim, not an oracle (`CLAUDE.md`).
 */

const NS = "marketing_tick_test_lifecycle";
const worlds: World[] = [];

// 120_000 como el resto del modulo, y no es decorativo: el `hookTimeout` por defecto de
// vitest es 10 s y `dropWorlds` hace varios deletes por mundo. Medido al cerrar la B2: con
// dos suites de integracion nuevas peleando por la misma rama Neon, este teardown se paso
// de los 10 s en 2 de 3 corridas y marco el ARCHIVO como failed con sus tests en verde
// («1 failed | 161 passed» con «1169 passed» abajo). Un rojo que no es de ninguna asercion.
afterAll(async () => {
  await dropWorlds(worlds);
}, 120_000);

describe.skipIf(!integrationEnabled)("marketing lifecycle", () => {
  /**
   * R2 — `loadPlacementConsumerIds` (`placement-store.ts`) unions the consumers with a
   * live turn AND the consumers already holding a row in `consumer.pass_placement`. The
   * second half is what takes a door OUT of the pass: once the turn expires the consumer
   * has no live turn left to be found by, so without the union the applier never visits
   * them again and the door stays in the pass FOREVER.
   *
   * Mutation that turns this red: delete `union select consumer_id from
   * consumer.pass_placement` from `loadPlacementConsumerIds`. Measured: the row survives
   * with `slotKind: 'turn'` and the `turnId` of the already-expired turn.
   */
  it("takes the door OUT of the pass when the turn expires", async () => {
    const built = await seedWorld({ label: "Lifecycle expiry", people: 1 });
    worlds.push(built);

    await tickWorld(built, NS);
    expect(await readPlacement(built.consumerIds[0])).toHaveLength(1);

    // Six days later the 5-day window is closed: step 2 turns the turn `done`.
    await tickWorld(built, NS, { now: new Date(NOW.getTime() + 6 * DAY) });

    const turns = await readTurns(built.seed.business.id);
    expect(turns.map((turn) => turn.status)).toEqual(["done"]);
    expect(await readPlacement(built.consumerIds[0])).toEqual([]);
  }, 180_000);

  /**
   * R3 — `loadUsableCampaignLocations` (`audience-store.ts`) filters BOTH on
   * `status = 'active'` and on having coordinates, and both halves belong to the ENQUEUE
   * filter rather than only to the cancel step. A door that is archived would otherwise
   * be queued by step 1 and cancelled by step 3 on the SAME run, forever: a cancelled
   * turn does not hold the partial unique, so the next run inserts it again.
   *
   * The «no coordinates» half already had a case (`doorNoCoords` in `marketing-tick`);
   * the «archived» half had none. Mutation that turns this red: drop
   * `eq(locations.status, "active")`. Measured: `enqueued: 1, cancelled: 1` on BOTH runs.
   */
  it("does not queue-and-cancel an ARCHIVED door on every run", async () => {
    const built = await seedWorld({ label: "Lifecycle archived", people: 1 });
    worlds.push(built);
    await breakLocation(built.doorId, "archive");

    const first = (await tickWorld(built, NS)) as TickSummary;
    const second = (await tickWorld(built, NS, {
      now: new Date(NOW.getTime() + 60_000),
    })) as TickSummary;

    expect([
      first.enqueued,
      first.cancelled,
      second.enqueued,
      second.cancelled,
    ]).toEqual([0, 0, 0, 0]);
    expect(await readTurns(built.seed.business.id)).toEqual([]);
  }, 180_000);
});
