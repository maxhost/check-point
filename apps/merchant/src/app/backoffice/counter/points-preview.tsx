import { previewUnits, unitLabel } from "./types";

/** Read-only estimate. The grant response remains authoritative. */
export function PointsPreview({
  accrual,
  kind,
  total,
}: {
  accrual: {
    mode: string | null;
    grant: number | null;
    blockAmount: number | null;
  };
  kind: string;
  total: number;
}) {
  const units = previewUnits(accrual, total);
  return (
    <p className="counter-points-preview">
      Esta venta otorga <strong>{units}</strong> {unitLabel(kind, units)}
    </p>
  );
}
