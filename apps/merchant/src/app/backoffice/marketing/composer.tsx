"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ModuleHeader, Toast } from "../../components/ui";
import { ConfirmDialog } from "../../components/confirm-dialog";
import type { AudiencePreview } from "../../../server/marketing/audience-preview";
import type { LocationDTO } from "../../../server/locations";
import { AudienceBlock, ChannelBlock, MessageBlock } from "./composer-blocks";
import { CouponBlock, ReviewBlock } from "./composer-review";
import {
  draftBody,
  draftFromCampaign,
  emptyDraft,
  todayISO,
  type ComposerDraft,
} from "./composer-draft";
import type { Campaign } from "../../../server/marketing/campaign-store";

const JSON_HEADERS = { "content-type": "application/json" };

type ApiError = {
  error?: string;
  code?: string;
  fields?: Record<string, string>;
};

/**
 * The composer (spec 0065): one page that reads like a sentence, five closed blocks, no
 * free text outside the name, the message and the coupon's label.
 *
 * `initialPreview` is computed by the PAGE, server-side, over the default audience. It
 * is not test scaffolding: without it the first paint shows «calculando» and the owner
 * watches the numbers they came for arrive a beat late. The live refresh while they
 * change days or doors is the `useEffect` below.
 *
 * `createdId` is what stops a second press from creating a second campaign. «Activar» is
 * two calls — create, then activate — and if the second one fails (402 `plan_not_allowed`
 * is the expected one) the campaign EXISTS as a draft. Saying so and linking to it is
 * the honest answer; retrying then activates the draft that is already there.
 *
 * With `campaign` set it is the EDIT screen instead (`draft`/`paused` only, which the
 * page resolves): same five blocks, a `PATCH`, and NO «Activar» — activating stays on the
 * detail screen, where the four transitions live together.
 */
export function CampaignComposer({
  locations,
  products,
  remainingQuota,
  currencyCode,
  initialPreview,
  campaign,
}: {
  locations: LocationDTO[];
  products: { id: string; name: string }[];
  remainingQuota: number;
  currencyCode: string;
  initialPreview: AudiencePreview | null;
  campaign?: Campaign;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ComposerDraft>(() =>
    campaign
      ? draftFromCampaign(campaign)
      : emptyDraft(
          todayISO(),
          locations.map((location) => location.id),
        ),
  );
  const [preview, setPreview] = useState<AudiencePreview | null>(
    initialPreview,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // «confirmacion + respuesta del servidor; sin exito optimista» (spec 0065): activating
  // puts the campaign in front of real people, so it asks first, and nothing on screen
  // moves until the server answers.
  const [confirming, setConfirming] = useState(false);

  const chosenDoors = draft.locationIds.join(",");
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      dormantDays: String(draft.dormantDays),
      locationIds: chosenDoors,
    });
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/marketing/audience-preview?${params.toString()}`,
            { signal: controller.signal },
          );
          const payload = (await res.json()) as {
            preview?: AudiencePreview;
          };
          // A 400 over `dormantDays` out of range is NOT an error toast: the owner is
          // mid-typing. The counts go blank and the block says «calculando», which is
          // what an unanswerable audience looks like.
          setPreview(res.ok ? (payload.preview ?? null) : null);
        } catch {
          /* aborted or offline: the previous counts stay on screen */
        }
      })();
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [draft.dormantDays, chosenDoors]);

  async function send(url: string, method: string, body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: JSON_HEADERS,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload = (await res.json().catch(() => null)) as
      | (ApiError & { campaign?: { id: string } })
      | null;
    if (!res.ok) {
      setErrors(payload?.fields ?? {});
      throw new Error(payload?.error ?? "No pudimos guardar la campaña.");
    }
    setErrors({});
    return payload?.campaign?.id ?? null;
  }

  async function create(): Promise<string> {
    if (createdId !== null) return createdId;
    const id = await send("/api/marketing/campaigns", "POST", draftBody(draft));
    if (id === null) throw new Error("No pudimos guardar la campaña.");
    setCreatedId(id);
    return id;
  }

  async function save(activate: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (campaign) {
        await send(
          `/api/marketing/campaigns/${campaign.id}`,
          "PATCH",
          draftBody(draft),
        );
        router.push(`/backoffice/marketing/${campaign.id}`);
        return;
      }
      const id = await create();
      if (activate)
        await send(`/api/marketing/campaigns/${id}/activate`, "POST");
      router.push(`/backoffice/marketing/${id}`);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos guardar la campaña.",
      );
      setBusy(false);
    }
  }

  return (
    <main className="merchant-shell">
      <div className="backoffice-home">
        <ModuleHeader
          eyebrow={campaign ? "Editar campaña" : "Nueva campaña"}
          title={campaign ? campaign.name : "Armá tu campaña de proximidad"}
          closeHref={
            campaign
              ? `/backoffice/marketing/${campaign.id}`
              : "/backoffice/marketing"
          }
        />
        <Toast message={error} kind="error" onDismiss={() => setError(null)} />
        {error !== null && createdId !== null && (
          <p className="field-help">
            La campaña quedó guardada como borrador.{" "}
            <Link href={`/backoffice/marketing/${createdId}`}>Verla</Link>
          </p>
        )}
        <section className="rule-builder">
          <label htmlFor="campaign-name">Nombre de la campaña</label>
          <input
            id="campaign-name"
            maxLength={80}
            value={draft.name}
            placeholder="Dormidos de septiembre"
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
          />
          {errors.name && <p className="field-error">{errors.name}</p>}
        </section>
        <AudienceBlock
          draft={draft}
          onChange={setDraft}
          errors={errors}
          locations={locations}
          preview={preview}
        />
        <ChannelBlock />
        <MessageBlock draft={draft} onChange={setDraft} errors={errors} />
        <CouponBlock
          draft={draft}
          onChange={setDraft}
          errors={errors}
          products={products}
        />
        <ReviewBlock
          draft={draft}
          onChange={setDraft}
          errors={errors}
          preview={preview}
          remainingQuota={remainingQuota}
          currencyCode={currencyCode}
        />
        <div className="composer-actions">
          <button
            className="small-button"
            disabled={busy}
            onClick={() => void save(false)}
          >
            {campaign ? "Guardar cambios" : "Guardar borrador"}
          </button>
          {!campaign && (
            <button
              className="button"
              disabled={busy}
              onClick={() => setConfirming(true)}
            >
              Activar
            </button>
          )}
        </div>
        <ConfirmDialog
          open={confirming}
          title="¿Activar esta campaña?"
          description="Tu local va a empezar a aparecer en el Wallet de la audiencia elegida cuando pase cerca. Un 10 % al azar no lo va a ver: así medimos si funciona."
          confirmLabel="Activar"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            void save(true);
          }}
        />
      </div>
    </main>
  );
}
