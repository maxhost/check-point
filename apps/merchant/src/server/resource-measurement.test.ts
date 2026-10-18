import type { DbTransaction } from "@mi-pasaporte/db";
import type {
  ResourceMeasurementChange,
  ResourceMeasurementValidator,
} from "@mi-pasaporte/domain/resource-measurement";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
const { registry } = vi.hoisted(() => ({
  registry: {} as Record<
    string,
    {
      resourceMeasurementValidators?: {
        resourceType: string;
        validate: ResourceMeasurementValidator<DbTransaction>;
      }[];
    }
  >,
}));
vi.mock("../modules/server-registry", () => ({ SERVER_MODULES: registry }));
import { validateResourceMeasurementChange } from "./resource-measurement";
function context(
  active: string[] = [],
): ResourceMeasurementChange<DbTransaction> {
  const where = vi.fn(async (predicate) => {
    expect(new PgDialect().sqlToQuery(predicate).params).toEqual([
      "business-a",
      true,
    ]);
    return active.map((moduleId) => ({ moduleId }));
  });
  const tx = {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where })) })),
  } as unknown as DbTransaction;
  return {
    tx,
    businessId: "business-a",
    resourceType: "resource-x",
    resourceId: "item-a",
    oldMeasure: { kind: "unit", pricingUnit: "unit" },
    newMeasure: { kind: "unit", pricingUnit: "unit" },
  };
}
const error = {
  code: "measurement_basis_required" as const,
  message: "Define una base compatible.",
};
beforeEach(() => {
  for (const key of Object.keys(registry)) delete registry[key];
});
describe("resource measurement registry", () => {
  it("accepts absence of a provider", async () => {
    registry.alpha = {};
    expect(
      await validateResourceMeasurementChange(context(["alpha", "unknown"])),
    ).toBeNull();
  });
  it("filters disabled and unrelated providers, preserving exact context and tx even for unchanged measures", async () => {
    const disabled = vi.fn(),
      unrelated = vi.fn(),
      validate = vi.fn<ResourceMeasurementValidator<DbTransaction>>(
        async () => null,
      );
    registry.alpha = {
      resourceMeasurementValidators: [
        { resourceType: "resource-x", validate: disabled },
      ],
    };
    registry.beta = {
      resourceMeasurementValidators: [
        { resourceType: "other", validate: unrelated },
        { resourceType: "resource-x", validate },
      ],
    };
    const change = context(["beta"]);
    expect(await validateResourceMeasurementChange(change)).toBeNull();
    expect(disabled).not.toHaveBeenCalled();
    expect(unrelated).not.toHaveBeenCalled();
    expect(validate).toHaveBeenCalledExactlyOnceWith(change);
    expect(validate.mock.calls[0][0]).toBe(change);
  });
  it("returns the first error in module id then declaration order, independently of database order", async () => {
    const last = vi.fn();
    registry.zeta = {
      resourceMeasurementValidators: [
        { resourceType: "resource-x", validate: last },
      ],
    };
    const first = vi.fn(async () => null),
      second = vi.fn(async () => error);
    registry.alpha = {
      resourceMeasurementValidators: [
        { resourceType: "resource-x", validate: first },
        { resourceType: "resource-x", validate: second },
        { resourceType: "resource-x", validate: last },
      ],
    };
    expect(
      await validateResourceMeasurementChange(context(["zeta", "alpha"])),
    ).toBe(error);
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(last).not.toHaveBeenCalled();
  });
  it("propagates provider and transaction failures", async () => {
    const failure = new Error("provider unavailable");
    registry.alpha = {
      resourceMeasurementValidators: [
        {
          resourceType: "resource-x",
          validate: async () => {
            throw failure;
          },
        },
      ],
    };
    await expect(
      validateResourceMeasurementChange(context(["alpha"])),
    ).rejects.toBe(failure);
    const change = context();
    vi.mocked(change.tx.select).mockImplementation(() => {
      throw failure;
    });
    await expect(validateResourceMeasurementChange(change)).rejects.toBe(
      failure,
    );
  });
});
