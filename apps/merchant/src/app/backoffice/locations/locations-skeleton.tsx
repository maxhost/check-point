import { Skeleton, SkeletonScreen } from "../../components/ui";

export function LocationsSkeleton() {
  return (
    <main className="merchant-shell">
      <div className="backoffice-home">
        <SkeletonScreen className="locations-skeleton" label="Cargando locales">
          <div className="locations-skeleton-header">
            <div>
              <Skeleton height={12} width={66} />
              <Skeleton height={34} width={320} />
              <Skeleton height={15} width={360} />
            </div>
            <Skeleton height={42} radius={99} width={42} />
          </div>
          <Skeleton height={44} radius={12} width={92} />
          <div className="locations-toolbar">
            <div>
              <Skeleton height={18} width={112} />
              <Skeleton height={13} width={138} />
            </div>
            <Skeleton height={44} width={142} />
          </div>
          <Skeleton height={46} radius={12} width="100%" />
          <div className="locations-skeleton-list">
            <Skeleton height={20} width={150} />
            {["first", "second", "third"].map((key, index) => (
              <div className="location-card" key={key}>
                <Skeleton height={42} radius={13} width={42} />
                <div className="locations-skeleton-copy">
                  <Skeleton height={16} width={index === 1 ? "48%" : "35%"} />
                  <Skeleton height={12} width={index === 2 ? "76%" : "62%"} />
                  <Skeleton height={11} width={45} />
                </div>
                <div className="locations-skeleton-actions">
                  <Skeleton height={44} width={76} />
                  <Skeleton height={44} width={88} />
                </div>
              </div>
            ))}
          </div>
        </SkeletonScreen>
      </div>
    </main>
  );
}
