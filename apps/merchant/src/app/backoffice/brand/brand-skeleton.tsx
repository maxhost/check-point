import { Skeleton, SkeletonScreen } from "../../components/ui";

export function BrandSkeleton({ error = null }: { error?: string | null }) {
  return (
    <main className="merchant-shell">
      <div className="brand-page">
        {error ? (
          <div className="staff-alert error" role="alert">
            {error}
          </div>
        ) : (
          <SkeletonScreen className="brand-skeleton" label="Cargando marca">
            <div className="brand-skeleton-header">
              <div>
                <Skeleton height={12} width={58} />
                <Skeleton height={34} width={280} />
                <Skeleton height={15} width={320} />
              </div>
              <Skeleton height={42} radius={99} width={42} />
            </div>
            <div className="brand-toolbar">
              <div>
                <Skeleton height={17} width={180} />
                <Skeleton height={13} width={260} />
              </div>
              <Skeleton height={44} width={142} />
            </div>
            <div className="brand-layout">
              <Skeleton
                className="brand-skeleton-preview"
                height={278}
                radius={22}
              />
              <div className="brand-editor">
                {["identity", "logo", "colors", "regional"].map((key) => (
                  <div className="brand-section" key={key}>
                    <div className="brand-section-head">
                      <Skeleton height={42} radius={13} width={42} />
                      <div>
                        <Skeleton height={18} width={145} />
                        <Skeleton height={13} width="72%" />
                      </div>
                    </div>
                    <Skeleton height={48} radius={10} width="100%" />
                  </div>
                ))}
              </div>
            </div>
          </SkeletonScreen>
        )}
      </div>
    </main>
  );
}
