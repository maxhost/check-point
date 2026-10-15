import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as CREATE_PERSON } from "../../app/api/staff/people/route";
import { PUT as SET_LOCATIONS } from "../../app/api/staff/people/[personId]/locations/route";
import { conCookie } from "../../server/permissions-integration-support";
import {
  api,
  callModuleRoute,
  dropModuleWorld,
  enableModules,
  moduleStaff,
  modulesIntegrationEnabled,
  seedModuleWorld,
  type ModuleWorld,
} from "../modules-integration-support";
import { SERVER_MODULES } from "../server-registry";
import { getCost } from "./server/queries";
import { secondLocation } from "./test-support";

const run = modulesIntegrationEnabled ? describe : describe.skip;
run(
  "0231 real Equipo HTTP to salary callback integration",
  { timeout: 90000 },
  () => {
    let world: ModuleWorld, second: string, staff: string, money: string;
    let person: { id: string; revision: number },
      cost: { id: string; revision: number };
    beforeAll(async () => {
      world = await seedModuleWorld("profitability-core-flow");
      await enableModules(world, ["profitability"]);
      second = await secondLocation(world);
      staff = await moduleStaff(world, ["staff"]);
      money = await moduleStaff(world, ["profitability"]);
    });
    afterAll(async () => {
      await dropModuleWorld(world);
    });
    const change = (fromMonth: string, locationIds: string[]) =>
      SET_LOCATIONS(
        conCookie(`/api/staff/people/${person.id}/locations`, "PUT", staff, {
          expectedRevision: person.revision,
          fromMonth,
          locationIds,
        }),
        { params: Promise.resolve({ personId: person.id }) },
      );

    it("staff without money access changes locales while OFF, preserving total and future salary", async () => {
      const response = await CREATE_PERSON(
        conCookie("/api/staff/people", "POST", staff, {
          name: "Personal sin login",
          access: { enabled: false },
          fromMonth: "2026-01",
          locationIds: [world.locationId],
        }),
      );
      expect(response.status).toBe(201);
      const created = await response.json();
      person = created.person;
      expect(created).not.toHaveProperty("pin");
      const salary = await callModuleRoute(
        "POST",
        "/api/modules/profitability/costs",
        money,
        {
          kind: "personnel",
          personId: person.id,
          label: "Costo total",
          monthlyTotal: "100.00",
          fromMonth: "2026-01",
          untilMonth: null,
        },
      );
      expect(salary.status).toBe(201);
      cost = (await salary.json()).cost;
      const raise = await callModuleRoute(
        "PUT",
        `/api/modules/profitability/costs/${cost.id}/period`,
        money,
        {
          expectedRevision: cost.revision,
          label: "Aumento futuro",
          monthlyTotal: "200.00",
          fromMonth: "2026-06",
          untilMonth: null,
        },
      );
      expect(raise.status).toBe(200);
      expect(
        (await api.setModule(world.cookie, "profitability", { enabled: false }))
          .status,
      ).toBe(200);
      const moved = await change("2026-03", [second, world.locationId]);
      expect(moved.status).toBe(200);
      const payload = await moved.json();
      person = payload.person;
      expect(JSON.stringify(payload)).not.toMatch(
        /monthly|currencyCode|minorUnit|allocations|Sueldo/,
      );
      expect(
        (await api.setModule(world.cookie, "profitability", { enabled: true }))
          .status,
      ).toBe(200);
      expect(
        (await getCost(world.businessId, cost.id, "2026-02")).periods[0]
          .allocations,
      ).toEqual([{ locationId: world.locationId, monthlyAmount: "100.00" }]);
      const june = await getCost(world.businessId, cost.id, "2026-06");
      expect(june.periods[0].monthlyTotal).toBe("200.00");
      expect(june.periods[0].allocations.map((a) => a.monthlyAmount)).toEqual([
        "100.00",
        "100.00",
      ]);
      const total = await (
        await callModuleRoute(
          "GET",
          "/api/modules/profitability/totals?month=2026-06",
          money,
        )
      ).json();
      expect(total.totals).toEqual([
        { currencyCode: "USD", minorUnit: 2, total: "200.00" },
      ]);
      expect(
        (
          await callModuleRoute(
            "GET",
            `/api/modules/profitability/costs/${cost.id}?month=2026-06`,
            staff,
          )
        ).status,
      ).toBe(403);
      expect(
        (await getCost(world.businessId, cost.id, "2026-06")).revision,
      ).toBe(june.revision);
    });

    it("sanitizes a downstream failure and rolls the real assignment and salary back together", async () => {
      const before = await getCost(world.businessId, cost.id, "2026-06");
      const original = SERVER_MODULES.profitability.staffLocationsChanged!;
      SERVER_MODULES.profitability.staffLocationsChanged = async (
        tx,
        event,
      ) => {
        await original(tx, event);
        throw new Error("private salary detail must never reach the caller");
      };
      try {
        const response = await change("2026-04", [second]);
        expect(response.status).toBe(503);
        const payload = await response.json();
        expect(payload.code).toBe("assignment_update_failed");
        expect(JSON.stringify(payload)).not.toMatch(
          /private|salary|monthly|100|200/,
        );
        expect(await getCost(world.businessId, cost.id, "2026-06")).toEqual(
          before,
        );
      } finally {
        SERVER_MODULES.profitability.staffLocationsChanged = original;
      }
    });
  },
);
