import Link from "next/link";
import { Alert, Button } from "../../../ui";
import {
  MarketingConfirm,
  MarketingError,
  MarketingLoading,
  MarketingShell,
  MarketingToast,
} from "./marketing-ui";
import type { MarketingApiError } from "./marketing-api";
import type { Location, MarketingSettings } from "./marketing-types";
import type { CustomDraft } from "./custom-draft";
import { CustomFields, type AudiencePreview } from "./custom-fields";

export function ComposerView({
  effectiveId,
  currencyCode,
  isOwner,
  canReadLocations,
  canReadCatalog,
  locations,
  settings,
  draft,
  preview,
  previewError,
  error,
  fields,
  confirm,
  busy,
  createdId,
  notice,
  remainingQuota,
  load,
  change,
  review,
  save,
  setConfirm,
  setNotice,
}: {
  effectiveId?: string;
  currencyCode: string;
  isOwner: boolean;
  canReadLocations: boolean;
  canReadCatalog: boolean;
  locations: Location[] | null;
  settings: MarketingSettings | null;
  draft: CustomDraft | null;
  preview: AudiencePreview | null;
  previewError: string | null;
  error: MarketingApiError | null;
  fields: Record<string, string>;
  confirm: boolean;
  busy: boolean;
  createdId: string | null;
  notice: string | null;
  remainingQuota?: number;
  load: () => Promise<void>;
  change: (patch: Partial<CustomDraft>) => void;
  review: (activate: boolean) => void;
  save: (activate: boolean) => Promise<void>;
  setConfirm: (value: boolean) => void;
  setNotice: (value: string | null) => void;
}) {
  if (!settings && !error)
    return <MarketingLoading label="Cargando compositor…" />;
  return (
    <MarketingShell
      title={effectiveId ? "Editar campaña a medida" : "Crear campaña a medida"}
      description="Definí a quién llamar, qué mensaje mostrar y cuándo correr la campaña."
      closeHref={
        effectiveId
          ? `/backoffice/marketing/${effectiveId}`
          : "/backoffice/marketing"
      }
    >
      <MarketingToast
        message={notice}
        dismiss={() => setNotice(null)}
        kind="warning"
      />
      {error && (
        <MarketingError
          error={error}
          isOwner={isOwner}
          retry={() => void load()}
        />
      )}
      {!canReadLocations && !effectiveId && (
        <Alert kind="warning" title="Necesitás acceso a Locales">
          La campaña a medida requiere elegir locales. Pedile al propietario el
          permiso de Locales.
        </Alert>
      )}
      {!canReadLocations && effectiveId && (
        <Alert title="Locales conservados">
          Podés cambiar otros parámetros. Para ver o cambiar los locales
          necesitás el permiso de Locales.
        </Alert>
      )}
      {createdId && (
        <Alert kind="warning" title="Borrador guardado">
          <Link
            className="underline"
            href={`/backoffice/marketing/${createdId}`}
          >
            Consultar campaña y activarla
          </Link>
        </Alert>
      )}
      {draft && settings && (canReadLocations || Boolean(effectiveId)) && (
        <>
          <CustomFields
            draft={draft}
            change={change}
            errors={fields}
            locations={locations}
            preview={preview}
            previewError={previewError}
            timeZone={settings.timeZone}
            currencyCode={currencyCode}
            remainingQuota={remainingQuota}
            canReadCatalog={canReadCatalog}
          />
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              isLoading={busy}
              isDisabled={
                Boolean(createdId) ||
                error?.status === 401 ||
                error?.status === 403 ||
                Boolean(error?.uncertain)
              }
              onPress={() => review(false)}
            >
              {effectiveId ? "Guardar cambios" : "Guardar borrador"}
            </Button>
            {!effectiveId && (
              <Button
                variant="secondary"
                isDisabled={
                  busy ||
                  Boolean(createdId) ||
                  error?.status === 401 ||
                  error?.status === 403 ||
                  Boolean(error?.uncertain)
                }
                onPress={() => review(true)}
              >
                Guardar y activar
              </Button>
            )}
            <Link
              className="marketing-link"
              href={
                effectiveId
                  ? `/backoffice/marketing/${effectiveId}`
                  : "/backoffice/marketing"
              }
            >
              Cancelar
            </Link>
          </div>
        </>
      )}
      <MarketingConfirm
        open={confirm}
        busy={busy}
        title="¿Activar esta campaña?"
        confirmLabel="Guardar y activar"
        description={
          draft && settings
            ? `Audiencia: ${draft.dormantDays} días sin venir en ${draft.locationIds.length} locales.\nMensaje: ${draft.message}\nInicio: ${draft.startsAt}\nFin: ${draft.endsAt || "Sin fecha de fin"}${draft.coupon ? `\nCupón: ${draft.couponLabel} · tope ${draft.couponMaxRedemptions}` : ""}\nZona horaria: ${settings.timeZone}`
            : ""
        }
        onCancel={() => setConfirm(false)}
        onConfirm={() => void save(true)}
      />
    </MarketingShell>
  );
}
