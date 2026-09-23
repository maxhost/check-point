import { Skeleton, SkeletonScreen } from "../../../components/ui";

export function BrandKitSkeleton() {
  return (
    <main className="merchant-shell">
      <div className="brand-kit">
        <SkeletonScreen
          className="brand-kit-skeleton"
          label="Cargando creador de afiches"
        >
          <div className="brand-kit-skeleton-header">
            <div>
              <Skeleton height={12} width={58} />
              <Skeleton height={34} width={300} />
              <Skeleton height={15} width={420} />
            </div>
            <Skeleton height={42} radius={99} width={42} />
          </div>
          <div className="brand-kit-skeleton-progress">
            <Skeleton height={13} width={90} />
            <div>
              <Skeleton height={6} width="100%" />
              <Skeleton height={6} width="100%" />
            </div>
          </div>
          <div className="brand-kit-body">
            <Skeleton height={12} width={64} />
            <Skeleton height={24} width={210} />
            <Skeleton height={14} width="68%" />
            <div className="brand-kit-skeleton-templates">
              {["one", "two", "three", "four"].map((key) => (
                <div key={key}>
                  <Skeleton height={145} radius={14} width="100%" />
                  <Skeleton height={16} width="62%" />
                  <Skeleton height={12} width="44%" />
                </div>
              ))}
            </div>
          </div>
        </SkeletonScreen>
      </div>
    </main>
  );
}
