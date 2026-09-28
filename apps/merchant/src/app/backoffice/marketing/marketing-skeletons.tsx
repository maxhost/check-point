"use client";
import { Skeleton, SkeletonScreen } from "../../components/ui";
import { MarketingPanel } from "./marketing-ui";

function SkeletonHeader({ editor = false }: { editor?: boolean }) {
  return (
    <div className="module-topline">
      <div className="min-w-0 flex-1">
        <Skeleton height={12} width={95} />
        <div className="mt-3 flex min-w-0 flex-col gap-2">
          <Skeleton height={34} width={editor ? 310 : 175} />
          {editor && (
            <span className="sm:hidden">
              <Skeleton height={34} width={180} />
            </span>
          )}
        </div>
        <div className="mt-3 flex min-w-0 flex-col gap-2">
          <Skeleton height={18} width={editor ? 510 : 630} />
          <span className="sm:hidden">
            <Skeleton height={18} width={editor ? 225 : 170} />
          </span>
        </div>
      </div>
      <Skeleton height={42} width={42} radius="50%" />
    </div>
  );
}

function TemplateRowSkeleton({
  withDetails = false,
}: {
  withDetails?: boolean;
}) {
  return (
    <li className="border-b border-border py-5 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Skeleton height={23} width={170} />
          <Skeleton height={25} width={78} radius={999} />
        </div>
        <Skeleton height={28} width={48} radius={999} />
      </div>
      <div className="mt-3 grid gap-2">
        <Skeleton height={16} width="90%" />
        <Skeleton height={16} width="62%" />
      </div>
      <div className="mt-3">
        <Skeleton height={16} width={220} />
      </div>
      {withDetails && (
        <div className="mt-3 grid gap-3">
          <Skeleton height={16} width={145} />
          <Skeleton height={44} width={145} />
        </div>
      )}
    </li>
  );
}

function SkeletonFormGroup({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="grid gap-3">
      <span className="font-bold">{label}</span>
      {children}
    </div>
  );
}

export function MarketingCatalogSkeleton() {
  return (
    <main className="merchant-shell">
      <SkeletonScreen
        label="Cargando campañas…"
        className="brand-page marketing-page"
      >
        <SkeletonHeader />
        <MarketingPanel
          title="Campañas listas para usar"
          description="Cada fila muestra si la campaña está prendida y cuándo termina."
        >
          <ul>
            <TemplateRowSkeleton />
            <TemplateRowSkeleton />
            <TemplateRowSkeleton withDetails />
            <TemplateRowSkeleton />
            <TemplateRowSkeleton />
          </ul>
        </MarketingPanel>
        <MarketingPanel title="Campañas a medida">
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton height={122} width="100%" />
            <Skeleton height={122} width="100%" />
          </div>
        </MarketingPanel>
        <MarketingPanel title="Horario de push">
          <Skeleton height={44} width={220} />
        </MarketingPanel>
      </SkeletonScreen>
    </main>
  );
}

export function MarketingTemplateSkeleton() {
  return (
    <main className="merchant-shell">
      <SkeletonScreen
        label="Cargando editor de campaña…"
        className="brand-page marketing-page"
      >
        <SkeletonHeader editor />
        <MarketingPanel title="Configuración">
          <div className="grid max-w-3xl gap-6">
            <Skeleton height={16} width="75%" />
            <SkeletonFormGroup label="¿Por dónde llega?">
              <div className="grid gap-2 sm:grid-cols-3">
                <Skeleton height={60} width="100%" />
                <Skeleton height={60} width="100%" />
                <Skeleton height={60} width="100%" />
              </div>
            </SkeletonFormGroup>
            <SkeletonFormGroup label="Días sin venir">
              <div className="flex flex-wrap gap-3">
                <Skeleton height={48} width={90} />
                <Skeleton height={48} width={90} />
                <Skeleton height={48} width={90} />
              </div>
            </SkeletonFormGroup>
            <div className="grid gap-3 rounded-md border border-border bg-info-soft p-4">
              <span className="font-bold">Alcance de la campaña</span>
              <Skeleton height={16} width="90%" />
              <Skeleton height={16} width="70%" />
            </div>
            <SkeletonFormGroup label="Mensaje que verá el cliente">
              <Skeleton height={155} width="100%" />
              <Skeleton height={16} width={185} />
            </SkeletonFormGroup>
            <div className="grid gap-5 sm:grid-cols-2">
              <SkeletonFormGroup label="Inicio">
                <Skeleton height={48} width="100%" />
                <Skeleton height={16} width="75%" />
              </SkeletonFormGroup>
              <SkeletonFormGroup label="Fin">
                <Skeleton height={48} width="100%" />
                <Skeleton height={16} width="75%" />
              </SkeletonFormGroup>
            </div>
            <fieldset className="grid gap-4 rounded-md border border-border p-4">
              <legend className="px-1 font-bold">Locales incluidos</legend>
              <Skeleton height={16} width="85%" />
              <Skeleton height={44} width="75%" />
              <Skeleton height={44} width="75%" />
            </fieldset>
            <div className="grid gap-3 rounded-md border border-border p-4">
              <span className="font-bold">Agregar cupón</span>
              <Skeleton height={16} width="90%" />
              <Skeleton height={16} width="65%" />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Skeleton height={44} width={190} />
              <Skeleton height={44} width={170} />
            </div>
          </div>
        </MarketingPanel>
      </SkeletonScreen>
    </main>
  );
}
