import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withDbTransaction } from "@mi-pasaporte/db";
import {
  permisosIntegrationEnabled,
  limpiarNegocios,
} from "../permissions-integration-support";
import { listStaffLocationTimeline } from "../staff-location-timeline";
import { setLocationStatus } from "../locations/store";
import { staffPeopleWorld, peopleApi } from "./integration-support";
const run = permisosIntegrationEnabled ? describe : describe.skip;

run(
  "0236 preserves independent staff assignment timelines",
  { timeout: 60000 },
  () => {
    let world: Awaited<ReturnType<typeof staffPeopleWorld>>;
    beforeAll(async () => {
      world = await staffPeopleWorld();
    });
    afterAll(async () => limpiarNegocios([world.business.id], world.users));
    async function create() {
      const result = await peopleApi.create(world.cookie, {
        name: randomUUID(),
        access: { enabled: false },
        locationIds: [world.locations[0]],
        fromMonth: "2026-01",
      });
      expect(result.status).toBe(201);
      return (await result.json()).person;
    }
    async function timeline(id: string) {
      return withDbTransaction((tx) =>
        listStaffLocationTimeline(tx, world.business.id, id),
      );
    }

    it("keeps prior and future frontiers/IDs, normalizes duplicate UUIDs and no-ops the same set", async () => {
      const p = await create();
      const initial = (await timeline(p.id))[0];
      const future = await peopleApi.locations(world.cookie, p.id, {
        expectedRevision: p.revision,
        fromMonth: "2026-05",
        locationIds: [world.locations[1]],
      });
      expect(future.status).toBe(200);
      const f = (await future.json()).person;
      const march = await peopleApi.locations(world.cookie, p.id, {
        expectedRevision: f.revision,
        fromMonth: "2026-03",
        locationIds: [
          world.locations[1],
          world.locations[0],
          world.locations[0].toUpperCase(),
        ],
      });
      expect(march.status).toBe(200);
      const m = (await march.json()).person;
      const rows = await timeline(p.id);
      expect(
        rows.map((r) => [r.fromMonth, r.untilMonth, r.locationIds]),
      ).toEqual([
        ["2026-01-01", "2026-03-01", [world.locations[0]]],
        ["2026-03-01", "2026-05-01", [world.locations[0], world.locations[1]]],
        ["2026-05-01", null, [world.locations[1]]],
      ]);
      expect(rows[0].id).toBe(initial.id);
      const repeated = await peopleApi.locations(world.cookie, p.id, {
        expectedRevision: m.revision,
        fromMonth: "2026-03",
        locationIds: [world.locations[1].toUpperCase(), world.locations[0]],
      });
      expect(repeated.status).toBe(200);
      expect((await repeated.json()).person.revision).toBe(m.revision);
      expect(await timeline(p.id)).toEqual(rows);
      const feb = (
        await (await peopleApi.list(world.cookie, "2026-02")).json()
      ).people.find((row: { id: string }) => row.id === p.id);
      expect(feb.locationIds).toEqual([world.locations[0]]);
    });
    it("serializes stale edits and rejects empty/foreign/new archived assignments while retaining an assigned archived local", async () => {
      const p = await create();
      const body = {
        expectedRevision: p.revision,
        fromMonth: "2026-03",
        locationIds: [world.locations[1]],
      };
      const concurrent = await Promise.all([
        peopleApi.locations(world.cookie, p.id, body),
        peopleApi.locations(world.cookie, p.id, {
          ...body,
          locationIds: [world.locations[2]],
        }),
      ]);
      expect(concurrent.map((r) => r.status).sort()).toEqual([200, 409]);
      expect((await timeline(p.id)).length).toBe(2);
      const current = (
        await (await peopleApi.list(world.cookie, "2026-03")).json()
      ).people.find((row: { id: string }) => row.id === p.id);
      expect(
        (
          await peopleApi.locations(world.cookie, p.id, {
            expectedRevision: current.revision,
            fromMonth: "2026-03",
            locationIds: [],
          })
        ).status,
      ).toBe(422);
      expect(
        (
          await peopleApi.locations(world.cookie, p.id, {
            expectedRevision: current.revision,
            fromMonth: "2026-03",
            locationIds: [randomUUID()],
          })
        ).status,
      ).toBe(404);
      await setLocationStatus(world.business, world.locations[0], "archived");
      const newArchived = await peopleApi.locations(world.cookie, p.id, {
        expectedRevision: current.revision,
        fromMonth: "2026-03",
        locationIds: [world.locations[0]],
      });
      expect(newArchived.status).toBe(409);
      const retained = await peopleApi.locations(world.cookie, p.id, {
        expectedRevision: current.revision,
        fromMonth: "2026-01",
        locationIds: [world.locations[0], world.locations[1]],
      });
      expect(retained.status).toBe(200);
    });
  },
);
