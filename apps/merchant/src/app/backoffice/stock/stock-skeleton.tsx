import { Skeleton, SkeletonScreen } from "../../components/ui";
import { Text } from "../../../ui";

export function StockLogSkeleton() {
  return (
    <SkeletonScreen
      label="Cargando registro de stock"
      className="overflow-hidden rounded-lg border border-border bg-surface"
    >
      <div className="grid grid-cols-3 gap-4 border-b border-border bg-surface-subtle px-4 py-3 md:px-6">
        <Text variant="label">Fecha de creación</Text>
        <div className="col-span-2">
          <Text variant="label">Resumen</Text>
        </div>
      </div>
      {[0, 1, 2, 3, 4].map((row) => (
        <div
          key={row}
          className="grid grid-cols-3 gap-4 border-b border-border px-4 py-4 last:border-b-0 md:px-6"
        >
          <Skeleton className="block h-6 w-full max-w-40" />
          <div className="col-span-2 grid min-w-0 gap-1">
            <Skeleton className="block h-6 w-full max-w-64" />
            <Skeleton className="block h-6 w-full max-w-48" />
          </div>
        </div>
      ))}
    </SkeletonScreen>
  );
}
