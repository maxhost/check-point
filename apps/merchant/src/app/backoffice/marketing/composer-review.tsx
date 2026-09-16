"use client";

import type { AudiencePreview } from "../../../server/marketing/audience-preview";
import {
  summarizeComposer,
  BUSINESS_QUOTA,
} from "../../../server/marketing/composer-summary";
import { COUPON_LABEL_MAX, draftCoupon } from "./composer-draft";
import type { BlockProps } from "./composer-blocks";

/** Blocks 4 and 5 of the composer (spec 0065: beneficio, límites y revisión). */

function FieldError({ message }: { message?: string }) {
  return message ? <p className="field-error">{message}</p> : null;
}

/**
 * The coupon, as ONE decision: the checkbox writes the three fields together and clears
 * them together, because a label without a cap reaches the counter with nothing to stop
 * it and a cost without a label reaches the results with nothing to name.
 * `couponProductId` is offered as an optional pick over the catalog: it is informative
 * (ADR 0002), never required, and it does not touch stock nor any balance.
 */
export function CouponBlock({
  draft,
  onChange,
  errors,
  products,
}: BlockProps & { products: { id: string; name: string }[] }) {
  return (
    <section className="rule-builder">
      <h2>4 · Beneficio</h2>
      <label className="weekday-toggle">
        <input
          type="checkbox"
          checked={draft.withCoupon}
          onChange={(event) =>
            onChange({ ...draft, withCoupon: event.target.checked })
          }
        />
        Sumar un cupón
      </label>
      {!draft.withCoupon && (
        <p className="field-help">
          Sin cupón: el cliente ve tu local y tu mensaje, y nada más.
        </p>
      )}
      {draft.withCoupon && (
        <div className="rule-effect">
          <label htmlFor="coupon-label">Etiqueta del cupón</label>
          <input
            id="coupon-label"
            maxLength={COUPON_LABEL_MAX}
            value={draft.couponLabel}
            placeholder="2x1 en picadas"
            onChange={(event) =>
              onChange({ ...draft, couponLabel: event.target.value })
            }
          />
          <FieldError message={errors.couponLabel} />
          <label htmlFor="coupon-cost">Costo estimado por canje</label>
          <input
            id="coupon-cost"
            type="number"
            min={0}
            step="0.01"
            value={draft.couponCost}
            onChange={(event) =>
              onChange({ ...draft, couponCost: event.target.value })
            }
          />
          <FieldError message={errors.couponCost} />
          <label htmlFor="coupon-cap">Tope de canjes</label>
          <input
            id="coupon-cap"
            type="number"
            min={1}
            value={draft.couponMaxRedemptions}
            onChange={(event) =>
              onChange({
                ...draft,
                couponMaxRedemptions: event.target.value,
              })
            }
          />
          <FieldError message={errors.couponMaxRedemptions} />
          <label htmlFor="coupon-product">Producto (opcional)</label>
          <select
            id="coupon-product"
            value={draft.couponProductId}
            onChange={(event) =>
              onChange({ ...draft, couponProductId: event.target.value })
            }
          >
            <option value="">Sin producto</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
          <p className="field-help">
            El producto es informativo: no descuenta stock ni cambia el saldo.
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * Block 5. The two numbers come from `summarizeComposer` — pure and with its own table
 * of cases — so what this block does is RENDER them, never compute them.
 *
 * The holdout note is not decoration either: a tenth of the audience will not see the
 * campaign, and the owner has to know that before activating rather than discover it in
 * the results as «turnos retenidos».
 */
export function ReviewBlock({
  draft,
  onChange,
  errors,
  preview,
  remainingQuota,
  currencyCode,
}: BlockProps & {
  preview: AudiencePreview | null;
  remainingQuota: number;
  currencyCode: string;
}) {
  const summary = summarizeComposer({
    reachable: preview?.reachable ?? 0,
    remainingQuota,
    ...draftCoupon(draft),
  });
  return (
    <section className="rule-builder">
      <h2>5 · Límites y revisión</h2>
      <div className="rule-line">
        <label htmlFor="starts-at">Desde</label>
        <input
          id="starts-at"
          type="date"
          value={draft.startsAt}
          onChange={(event) =>
            onChange({ ...draft, startsAt: event.target.value })
          }
        />
        <label htmlFor="ends-at">Hasta (opcional)</label>
        <input
          id="ends-at"
          type="date"
          value={draft.endsAt}
          onChange={(event) =>
            onChange({ ...draft, endsAt: event.target.value })
          }
        />
      </div>
      <FieldError message={errors.startsAt} />
      <FieldError message={errors.endsAt} />
      <p className="campaign-context">
        <span>
          Audiencia alcanzable por Wallet:{" "}
          <strong>{preview?.reachable ?? 0} personas</strong>
        </span>
        <span>
          Turnos que va a ocupar: <strong>{summary.turns}</strong> (te quedan{" "}
          {remainingQuota} de {BUSINESS_QUOTA} turnos simultáneos)
        </span>
        <span>
          Costo máximo:{" "}
          <strong>
            {summary.maxCost === null
              ? "sin cupón, sin costo"
              : `${currencyCode} ${summary.maxCost}`}
          </strong>
        </span>
      </p>
      <p className="field-help">
        Un 10 % al azar no lo va a ver: así medimos si funciona.
      </p>
    </section>
  );
}
