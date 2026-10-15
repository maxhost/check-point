import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@mi-pasaporte/db";
import {
  memberships,
  sessions,
  staffPersons,
  users,
} from "@mi-pasaporte/db/schema";
import { and, eq } from "drizzle-orm";
import {
  permisosIntegrationEnabled,
  limpiarNegocios,
  cookieDe,
} from "../permissions-integration-support";
import { seedMember } from "../counter-integration-support";
import { verifyPin } from "../staff-pin";
import { createStaff } from "../staff-create";
import { renameStaff } from "../staff-rename";
import { setStaffStatus } from "../staff";
import { staffPeopleWorld, peopleApi } from "./integration-support";
const run = permisosIntegrationEnabled ? describe : describe.skip;

run(
  "0231 people without access and transactional grants",
  { timeout: 60000 },
  () => {
    let world: Awaited<ReturnType<typeof staffPeopleWorld>>,
      other: Awaited<ReturnType<typeof staffPeopleWorld>>;
    beforeAll(async () => {
      world = await staffPeopleWorld();
      other = await staffPeopleWorld();
    });
    afterAll(async () => {
      await limpiarNegocios(
        [world.business.id, other.business.id],
        [...world.users, ...other.users],
      );
    });
    async function person() {
      const name = `Cocinero ${randomUUID()}`;
      const response = await peopleApi.create(world.cookie, {
        name,
        access: { enabled: false },
        locationIds: [world.locations[0]],
        fromMonth: "2026-02",
      });
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body).not.toHaveProperty("pin");
      return body.person;
    }
    it("no-access identity creates no auth, membership or PIN; list and rename expose only core fields", async () => {
      const p = await person();
      expect(p.access).toEqual({
        state: "none",
        userId: null,
        identifier: null,
        permissions: [],
      });
      expect(p.locationIds).toEqual([world.locations[0]]);
      expect(
        await getDb()
          .select({ id: users.id })
          .from(users)
          .where(eq(users.name, p.name)),
      ).toEqual([]);
      const listed = await peopleApi.list(world.cookie);
      expect(listed.status).toBe(200);
      expect((await listed.json()).people).toContainEqual(p);
      const response = await peopleApi.rename(world.cookie, p.id, {
        name: "Cocinero corregido",
        expectedRevision: p.revision,
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(Object.keys(body.person).sort()).toEqual([
        "access",
        "id",
        "locationIds",
        "locationsConfigured",
        "name",
        "revision",
      ]);
      expect(body.person.access.state).toBe("none");
    });
    it("grant/revoke/reactivate keeps person identity and assignment, hashes temporary PIN, and removes live sessions", async () => {
      const p = await person();
      const invalid = await peopleApi.access(world.cookie, p.id, {
        expectedRevision: p.revision,
        enabled: true,
        permissions: [],
      });
      expect(invalid.status).toBe(400);
      const granted = await peopleApi.access(world.cookie, p.id, {
        expectedRevision: p.revision,
        enabled: true,
        permissions: ["counter"],
      });
      expect(granted.status).toBe(200);
      const g = await granted.json(),
        userId = g.person.access.userId;
      world.users.push(userId);
      expect(g.person.id).toBe(p.id);
      expect(g.person.access.state).toBe("active");
      expect(g.pin).toMatch(/^\d{6}$/);
      const [member] = await getDb()
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.businessId, world.business.id),
            eq(memberships.userId, userId),
          ),
        );
      expect(member.pinHash).not.toBe(g.pin);
      expect(await verifyPin(member.pinHash!, g.pin)).toBe(true);
      await cookieDe(userId);
      expect(
        (
          await getDb()
            .select()
            .from(sessions)
            .where(eq(sessions.userId, userId))
        ).length,
      ).toBeGreaterThan(0);
      const revoked = await peopleApi.access(world.cookie, p.id, {
        expectedRevision: g.person.revision,
        enabled: false,
      });
      expect(revoked.status).toBe(200);
      const r = await revoked.json();
      expect(r).not.toHaveProperty("pin");
      expect(r.person).toMatchObject({
        id: p.id,
        access: { state: "disabled", userId },
        locationIds: p.locationIds,
      });
      expect(
        await getDb()
          .select()
          .from(sessions)
          .where(eq(sessions.userId, userId)),
      ).toEqual([]);
      const active = await peopleApi.access(world.cookie, p.id, {
        expectedRevision: r.person.revision,
        enabled: true,
        permissions: ["catalog"],
      });
      expect(active.status).toBe(200);
      expect((await active.json()).person.access).toMatchObject({
        state: "active",
        userId,
        permissions: ["catalog"],
      });
    });
    it("legacy create/rename/status synchronize the same person without inventing locations", async () => {
      const created = await createStaff(
        world.business,
        { name: "Legacy", permissions: ["counter"] },
        "owner",
      );
      world.users.push(created.staff.userId);
      const [p] = await getDb()
        .select()
        .from(staffPersons)
        .where(
          and(
            eq(staffPersons.businessId, world.business.id),
            eq(staffPersons.membershipUserId, created.staff.userId),
          ),
        );
      expect(p.name).toBe("Legacy");
      await renameStaff(world.business, created.staff.userId, {
        name: "Legacy editado",
      });
      await setStaffStatus(
        world.business,
        "owner",
        created.staff.userId,
        "disabled",
      );
      const list = await peopleApi.list(world.cookie);
      const row = (await list.json()).people.find(
        (x: { id: string }) => x.id === p.id,
      );
      expect(row).toMatchObject({
        name: "Legacy editado",
        access: { state: "disabled", userId: created.staff.userId },
        locationsConfigured: false,
        locationIds: [],
      });
      expect(created.staff).not.toHaveProperty("personId");
    });
    it("staff guard, tenant/revision and administrator restrictions survive the new route", async () => {
      const p = await person();
      const ordinary = await seedMember({
        businessId: world.business.id,
        permissions: ["counter"],
      });
      const admin = await seedMember({
        businessId: world.business.id,
        permissions: ["staff"],
      });
      world.users.push(ordinary, admin);
      expect((await peopleApi.list(await cookieDe(ordinary))).status).toBe(403);
      const denied = await peopleApi.access(await cookieDe(admin), p.id, {
        expectedRevision: p.revision,
        enabled: true,
        permissions: ["staff"],
      });
      expect(denied.status).toBe(403);
      expect(
        (
          await peopleApi.rename(other.cookie, p.id, {
            expectedRevision: p.revision,
            name: "Ajeno",
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await peopleApi.rename(world.cookie, p.id, {
            expectedRevision: 999,
            name: "Viejo",
          })
        ).status,
      ).toBe(409);
      const failedName = `No huérfano ${randomUUID()}`;
      const rejected = await peopleApi.create(world.cookie, {
        name: failedName,
        access: { enabled: true, permissions: ["counter"] },
        fromMonth: "2026-02",
        locationIds: [randomUUID()],
      });
      expect(rejected.status).toBe(404);
      expect(
        await getDb()
          .select({ id: users.id })
          .from(users)
          .where(eq(users.name, failedName)),
      ).toEqual([]);
      expect(
        await getDb()
          .select({ id: staffPersons.id })
          .from(staffPersons)
          .where(eq(staffPersons.name, failedName)),
      ).toEqual([]);
      const [none] = await getDb()
        .select({ count: staffPersons.id })
        .from(staffPersons)
        .where(eq(staffPersons.name, "Ajeno"));
      expect(none).toBeUndefined();
    });
  },
);
