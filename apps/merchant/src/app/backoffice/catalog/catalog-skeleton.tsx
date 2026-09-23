import { Skeleton, SkeletonScreen } from "../../components/ui";

/** El esqueleto de la pantalla de catalogo. Vive aparte de `catalog-page.tsx` desde la spec
 * 0092: el archivo estaba sobre el limite de tamaño del repo y habia que dividir, no
 * extender. Lo consumen `loading.tsx` y la propia pantalla mientras carga el `GET`. */
export function CatalogSkeleton() {
  return (
    <SkeletonScreen
      label="Cargando catálogo"
      className="brand-page catalog-page catalog-skeleton"
    >
      <div className="catalog-skeleton-head">
        <div>
          <Skeleton width={90} height={14} />
          <Skeleton width="min(430px, 80vw)" height={38} />
          <Skeleton width="min(520px, 85vw)" height={18} />
        </div>
        <Skeleton width={44} height={44} radius={22} />
      </div>
      <div className="catalog-overview">
        {[0, 1, 2].map((item) => (
          <div key={item}>
            <Skeleton width={42} height={28} />
            <Skeleton width={72} height={14} />
          </div>
        ))}
      </div>
      <Skeleton height={150} radius={20} />
      <div className="catalog-skeleton-cards">
        {[0, 1, 2].map((item) => (
          <Skeleton key={item} height={104} radius={18} />
        ))}
      </div>
    </SkeletonScreen>
  );
}
