import { notFound } from "next/navigation";
import NextLink from "next/link";
import { Card, Heading, PageHeader, Text } from "../../../ui";
import { requireAdmin } from "../../../server/admin-guard";
import { auditFor, listBusinesses } from "../../../server/businesses";
import {
  STATUS_LABEL,
  formatDate,
  formatDateTime,
} from "../../../server/format";
import { AccessBadge } from "../../access-badge";
import { TrialForm } from "./trial-form";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ACTION_LABEL: Record<string, string> = {
  trial_add_days: "Sumó días",
  trial_set_date: "Fijó fecha",
};

/** Spec 0190 §D5 — la ficha: datos, mover la prueba y lo que el panel le cambio. */
export default async function BusinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const [business] = await listBusinesses(new Date(), id);
  if (!business) notFound();
  const audit = await auditFor(id);

  return (
    <>
      <NextLink href="/" className="text-sm text-content underline">
        ← Comercios
      </NextLink>
      <PageHeader
        title={business.name}
        description={`${business.slug} · ${business.ownerEmail ?? "sin dueño"}`}
      />
      <Card className="grid gap-3 sm:grid-cols-2">
        <Fact label="Alta" value={formatDate(business.createdAt)} />
        <Fact
          label="Estado"
          value={STATUS_LABEL[business.status] ?? business.status}
        />
        <Fact label="Plan" value={business.plan ?? "—"} />
        <div className="grid gap-1">
          <Text variant="small">Acceso</Text>
          <div>
            <AccessBadge access={business.access} />
          </div>
        </div>
        <Fact
          label="Fin de prueba"
          value={formatDateTime(business.trialEndsAt)}
        />
        <Fact
          label="Días que quedan"
          value={
            business.trialDaysLeft === null
              ? "—"
              : String(business.trialDaysLeft)
          }
        />
      </Card>
      <TrialForm
        businessId={business.id}
        paying={business.access === "subscribed"}
      />
      <Card className="grid gap-3">
        <Heading level={2}>Cambios desde el panel</Heading>
        {audit.length === 0 ? (
          <Text variant="muted">Todavía no hay cambios.</Text>
        ) : (
          <ul className="grid gap-2">
            {audit.map((entry) => (
              <li key={entry.id} className="text-sm">
                <strong>{formatDateTime(entry.createdAt)}</strong> ·{" "}
                {ACTION_LABEL[entry.action] ?? entry.action} ·{" "}
                {formatDate(entry.beforeTrialEndsAt)} →{" "}
                {formatDate(entry.afterTrialEndsAt)} · {entry.adminEmail}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <Text variant="small">{label}</Text>
      <Text variant="label">{value}</Text>
    </div>
  );
}
