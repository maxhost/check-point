import type { BillingFactsView } from "../../../server/billing/facts";
import { formatAmount, formatDate } from "./subscription-format";

/** Missing Stripe facts are omitted; a scheduled downgrade has no next payment. */
export function SubscriptionFacts({
  facts,
  pendingDowngrade,
  timezone,
}: {
  facts: BillingFactsView;
  pendingDowngrade: "with_date" | "without_date" | null;
  timezone: string;
}) {
  const showRenewal = facts.renewalAt !== null && pendingDowngrade === null;
  if (!showRenewal && facts.lastPaidInvoice === null) return null;
  return (
    <dl className="mt-5 divide-y divide-border border-t border-border">
      {showRenewal && (
        <div className="py-4">
          <dt className="text-sm font-semibold text-content-muted">
            Próximo pago
          </dt>
          <dd className="mt-1 text-base text-content">
            Tu próximo pago es el {formatDate(facts.renewalAt, timezone)}.
          </dd>
        </div>
      )}
      {facts.lastPaidInvoice !== null && (
        <div className="py-4">
          <dt className="text-sm font-semibold text-content-muted">
            Último cobro
          </dt>
          <dd className="mt-1 flex flex-wrap items-baseline gap-x-2 text-base text-content">
            {formatAmount(
              facts.lastPaidInvoice.amountPaid,
              facts.lastPaidInvoice.currency,
            )}
            {facts.lastPaidInvoice.receiptUrl !== null && (
              <a
                className="font-semibold text-primary underline underline-offset-2"
                href={facts.lastPaidInvoice.receiptUrl}
                target="_blank"
                rel="noreferrer"
              >
                Ver el recibo ↗
              </a>
            )}
          </dd>
        </div>
      )}
    </dl>
  );
}
