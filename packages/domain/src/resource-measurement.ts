import type { MeasureUnit } from "./measures";

/** Generic composition-provider seam; authorization and transaction ownership stay with caller. */
export type ResourceSaleMeasure = {
  kind: "unit" | "mass";
  pricingUnit: MeasureUnit;
};
export type ResourceMeasurementChange<Tx> = {
  tx: Tx;
  businessId: string;
  resourceType: string;
  resourceId: string;
  oldMeasure: ResourceSaleMeasure;
  newMeasure: ResourceSaleMeasure;
};
export type ResourceMeasurementValidator<Tx> = (
  change: ResourceMeasurementChange<Tx>,
) => Promise<null | { code: "measurement_basis_required"; message: string }>;
