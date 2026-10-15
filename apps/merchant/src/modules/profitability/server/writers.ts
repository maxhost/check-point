import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { withDbTransaction } from "@mi-pasaporte/db";
import { profitabilityFixedCosts as costs } from "@mi-pasaporte/db/schema";
import { listStaffLocationTimeline } from "../../../server/staff-location-timeline";
import { ModuleError } from "../../errors";
import {
  databaseAmount,
  identifier,
  interval,
  label,
  minorUnitFor,
  month,
  parseAmount,
  rejectManual,
  revision,
} from "../arithmetic";
import {
  containsMonth,
  overlaps,
  replaceInterval,
  salaryPeriods,
  type Period,
} from "../intervals";
import {
  loadPeriods,
  lockBusiness,
  lockCost,
  lockLocations,
  lockPerson,
  savePeriods,
  type Cost,
} from "./repository";
import { costDTO } from "./dto";

const KINDS = ["rent", "gas", "electricity", "water", "other", "personnel"];
const invalidBody = () =>
  new ModuleError(400, "invalid_body", "El cuerpo no es válido.");

function checkEnd(cost: Cost, fromMonth: string, untilMonth: string | null) {
  if (
    cost.endMonth !== null &&
    (fromMonth >= cost.endMonth ||
      untilMonth === null ||
      untilMonth > cost.endMonth)
  )
    throw new ModuleError(
      409,
      "cost_ended",
      "La vigencia supera la baja del costo.",
    );
}

export async function createCost(
  businessId: string,
  body: Record<string, unknown>,
) {
  rejectManual(body);
  const kind = typeof body.kind === "string" ? body.kind : "";
  if (!KINDS.includes(kind)) throw invalidBody();
  const personId =
    kind === "personnel" ? identifier(body.personId, "person") : null;
  if ((personId && "locationId" in body) || (!personId && "personId" in body))
    throw invalidBody();
  const range = interval(body);
  const name = label(body.label);
  return withDbTransaction(async (tx) => {
    const business = await lockBusiness(tx, businessId);
    if (personId) {
      await lockPerson(tx, businessId, personId);
      const [existing] = await tx
        .select({ id: costs.id })
        .from(costs)
        .where(
          and(eq(costs.businessId, businessId), eq(costs.personId, personId)),
        );
      if (existing)
        throw new ModuleError(
          409,
          "salary_already_exists",
          "El integrante ya tiene un sueldo configurado.",
        );
    }
    const minorUnit = minorUnitFor(business.currencyCode);
    const total = parseAmount(body.monthlyTotal, minorUnit);
    const initial: Period = {
      id: randomUUID(),
      ...range,
      label: name,
      monthlyTotal: databaseAmount(total),
      currencyCode: business.currencyCode,
      minorUnit,
      distribution: personId ? "equal" : "single",
      staffLocationPeriodId: null,
      allocations: [],
    };
    let values: Period[];
    if (personId)
      values = salaryPeriods(
        [initial],
        await listStaffLocationTimeline(tx, businessId, personId),
      );
    else {
      const locationId = identifier(body.locationId, "location");
      initial.allocations = [
        { locationId, monthlyAmount: databaseAmount(total) },
      ];
      values = [initial];
    }
    await lockLocations(
      tx,
      businessId,
      values.flatMap((p) => p.allocations.map((a) => a.locationId)),
    );
    const [cost] = await tx
      .insert(costs)
      .values({ businessId, kind, personId })
      .returning();
    await savePeriods(tx, businessId, cost.id, [], values);
    return costDTO(cost, values);
  });
}

export async function editCost(
  businessId: string,
  rawId: unknown,
  body: Record<string, unknown>,
) {
  rejectManual(body);
  if ("personId" in body || "kind" in body) throw invalidBody();
  const costId = identifier(rawId, "cost");
  const expected = revision(body.expectedRevision);
  const range = interval(body);
  const name = label(body.label);
  return withDbTransaction(async (tx) => {
    const business = await lockBusiness(tx, businessId);
    const cost = await lockCost(tx, businessId, costId);
    if (cost.revision !== expected)
      throw new ModuleError(
        409,
        "revision_conflict",
        "Los datos cambiaron. Vuelve a cargarlos.",
      );
    checkEnd(cost, range.fromMonth, range.untilMonth);
    const before = await loadPeriods(tx, businessId, costId);
    const affected = before.filter((p) => overlaps(p, range));
    const source = before.find((p) => containsMonth(p, range.fromMonth));
    const currencyCode = source?.currencyCode ?? business.currencyCode;
    const minorUnit = source?.minorUnit ?? minorUnitFor(currencyCode);
    if (
      affected.some(
        (p) => p.currencyCode !== currencyCode || p.minorUnit !== minorUnit,
      )
    )
      throw new ModuleError(
        422,
        "invalid_period",
        "Edita por separado las vigencias de monedas distintas.",
      );
    const total = parseAmount(body.monthlyTotal, minorUnit);
    const replacement: Period = {
      id: randomUUID(),
      ...range,
      label: name,
      monthlyTotal: databaseAmount(total),
      currencyCode,
      minorUnit,
      distribution: cost.personId ? "equal" : "single",
      staffLocationPeriodId: null,
      allocations: [],
    };
    if (!cost.personId)
      replacement.allocations = [
        {
          locationId: identifier(body.locationId, "location"),
          monthlyAmount: databaseAmount(total),
        },
      ];
    else if ("locationId" in body) throw invalidBody();
    let after = replaceInterval(before, replacement);
    if (cost.personId)
      after = salaryPeriods(
        after,
        await listStaffLocationTimeline(tx, businessId, cost.personId),
      );
    // Existing archived assignments can be corrected; a new target must be active.
    const permitted = new Set(
      affected.flatMap((p) => p.allocations.map((a) => a.locationId)),
    );
    const changed = after.filter((p) => overlaps(p, range));
    await lockLocations(
      tx,
      businessId,
      changed.flatMap((p) => p.allocations.map((a) => a.locationId)),
      permitted,
    );
    await savePeriods(tx, businessId, costId, before, after);
    const [updated] = await tx
      .update(costs)
      .set({ revision: cost.revision + 1, updatedAt: new Date() })
      .where(and(eq(costs.businessId, businessId), eq(costs.id, costId)))
      .returning();
    return costDTO(updated, after);
  });
}

export async function stopCost(
  businessId: string,
  rawId: unknown,
  body: Record<string, unknown>,
) {
  const costId = identifier(rawId, "cost");
  const expected = revision(body.expectedRevision);
  const endMonth = month(body.endMonth);
  return withDbTransaction(async (tx) => {
    await lockBusiness(tx, businessId);
    const cost = await lockCost(tx, businessId, costId);
    if (cost.revision !== expected)
      throw new ModuleError(
        409,
        "revision_conflict",
        "Los datos cambiaron. Vuelve a cargarlos.",
      );
    const values = await loadPeriods(tx, businessId, costId);
    if (cost.endMonth === endMonth) return costDTO(cost, values);
    if (cost.endMonth !== null)
      throw new ModuleError(
        409,
        "cost_ended",
        "El costo ya tiene una baja registrada.",
      );
    const [updated] = await tx
      .update(costs)
      .set({ endMonth, revision: cost.revision + 1, updatedAt: new Date() })
      .where(and(eq(costs.businessId, businessId), eq(costs.id, costId)))
      .returning();
    return costDTO(updated, values);
  });
}
