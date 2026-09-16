"use client";

import type { AudiencePreview } from "../../../server/marketing/audience-preview";
import type { LocationDTO } from "../../../server/locations";
import { MESSAGE_MAX, type ComposerDraft } from "./composer-draft";

/**
 * Blocks 1 to 3 of the composer (spec 0065: audiencia, canal, mensaje). Presentational:
 * they receive the draft and hand back the next one. Keeping them out of `composer.tsx`
 * is the size budget, not taste — the component that owns the state, the fetching and
 * the two submits does not fit in one file with the markup.
 */

export type BlockProps = {
  draft: ComposerDraft;
  onChange: (draft: ComposerDraft) => void;
  errors: Record<string, string>;
};

function FieldError({ message }: { message?: string }) {
  return message ? <p className="field-error">{message}</p> : null;
}

/**
 * «Clientes de [locales] que no vienen hace [N] días», with the counts underneath.
 *
 * A chosen door that the tick CANNOT use — archived, or without coordinates — is marked
 * here and not at `activate`: the route answers 409 `no_usable_location`, and finding
 * that out after composing the whole campaign is finding out too late. `usableLocationIds`
 * comes from the preview, which resolves it against the database.
 */
export function AudienceBlock({
  draft,
  onChange,
  errors,
  locations,
  preview,
}: BlockProps & {
  locations: LocationDTO[];
  preview: AudiencePreview | null;
}) {
  function toggle(id: string, on: boolean) {
    onChange({
      ...draft,
      locationIds: on
        ? [...draft.locationIds, id]
        : draft.locationIds.filter((other) => other !== id),
    });
  }
  return (
    <section className="rule-builder">
      <h2>1 · Audiencia</h2>
      <div className="rule-line">
        <span>Clientes que no vienen hace</span>
        <input
          type="number"
          min={7}
          max={365}
          value={draft.dormantDays}
          aria-label="Días sin venir"
          onChange={(event) =>
            onChange({ ...draft, dormantDays: Number(event.target.value) })
          }
        />
        <span>días, y pasan por estos locales:</span>
      </div>
      <FieldError message={errors.dormantDays} />
      <div className="weekday-list">
        {locations.map((location) => {
          const chosen = draft.locationIds.includes(location.id);
          const unusable =
            chosen &&
            preview !== null &&
            !preview.usableLocationIds.includes(location.id);
          return (
            <div className="weekday-row" key={location.id}>
              <label className="weekday-toggle">
                <input
                  type="checkbox"
                  checked={chosen}
                  onChange={(event) =>
                    toggle(location.id, event.target.checked)
                  }
                />
                {location.name}
              </label>
              {unusable && (
                <p className="field-help">
                  Este local no tiene ubicación en el mapa: no va a colocar
                  ningún turno. Corregí su dirección en Locales.
                </p>
              )}
            </div>
          );
        })}
        {locations.length === 0 && (
          <p className="counter-hint">
            No tenés locales activos. Creá uno en Locales antes de activar.
          </p>
        )}
      </div>
      <FieldError message={errors.locationIds} />
      <p className="campaign-context">
        {preview === null ? (
          <span>Calculando la audiencia…</span>
        ) : (
          <>
            <strong>Hoy son {preview.total} personas</strong>
            <span>
              {preview.reachable} alcanzables por Wallet · {preview.noLocation}{" "}
              sin local atribuible · {preview.cooldown} en cooldown ·{" "}
              {preview.optOut} con promociones apagadas
            </span>
          </>
        )}
      </p>
    </section>
  );
}

/** Block 2 is fixed text: the channel is not a choice in this campaign type. It is a
 * block and not a footnote because the owner has to understand that nothing is SENT —
 * the queue decides who gets a turn and when. */
export function ChannelBlock() {
  return (
    <section className="rule-builder">
      <h2>2 · Canal</h2>
      <p className="rule-line">
        Se les muestra tu local en su Wallet cuando pasen a ~100 m, en turnos de
        5 días. No hay envío: la cola decide cuándo le toca a cada uno. Cada
        cliente tiene como máximo 5 comercios activos y nunca dos en la misma
        cuadra.
      </p>
    </section>
  );
}

/** Block 3: the message, with the static preview of the iOS lock screen line and the
 * note about Android — where the notification is generic and the text only shows up
 * inside the pass. Promising the same thing on both platforms would be a lie the QA
 * would catch on the first walk. */
export function MessageBlock({ draft, onChange, errors }: BlockProps) {
  return (
    <section className="rule-builder">
      <h2>3 · Mensaje</h2>
      <label htmlFor="campaign-message">
        Lo que ve el cliente al pasar cerca
      </label>
      <textarea
        id="campaign-message"
        maxLength={MESSAGE_MAX}
        rows={2}
        value={draft.message}
        placeholder="2x1 en picadas hasta el domingo"
        onChange={(event) =>
          onChange({ ...draft, message: event.target.value })
        }
      />
      <p className="field-help">
        {draft.message.length} de {MESSAGE_MAX} caracteres.
      </p>
      <FieldError message={errors.message} />
      <p className="campaign-context">
        <strong>Así se ve en la pantalla bloqueada de un iPhone</strong>
        <span>
          {draft.message.trim() === ""
            ? "Tu local — tu mensaje acá"
            : draft.message.trim()}
        </span>
      </p>
      <p className="field-help">
        En Android el aviso es genérico y tu mensaje se ve al abrir el pase.
      </p>
    </section>
  );
}
