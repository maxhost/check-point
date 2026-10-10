import NextLink from "next/link";
import { PageHeader, Text } from "../ui";
import { requireAdmin } from "../server/admin-guard";
import { listBusinesses } from "../server/businesses";
import { STATUS_LABEL, formatDate } from "../server/format";
import { AccessBadge } from "./access-badge";
import { SignOutButton } from "./sign-out-button";

export const dynamic = "force-dynamic";

/** Spec 0190 §D4 — los comercios: quien se registro, cuando, y cuando se bloquea. */
export default async function HomePage() {
  const { email } = await requireAdmin();
  const rows = await listBusinesses(new Date());
  return (
    <>
      <PageHeader
        title="Comercios"
        description={`${rows.length} registrados · ${email}`}
        actions={<SignOutButton />}
      />
      <ul className="grid gap-3 sm:hidden">
        {rows.map((row) => (
          <li key={row.id}>
            <NextLink
              href={`/comercios/${row.id}`}
              className="grid gap-2 rounded-lg border border-border bg-surface p-4"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="font-bold text-content underline underline-offset-2">
                  {row.name}
                </span>
                <AccessBadge access={row.access} />
              </span>
              <Text variant="small">{row.ownerEmail ?? "sin dueño"}</Text>
              <Text variant="small">
                Alta {formatDate(row.createdAt)} · Fin de prueba{" "}
                {formatDate(row.trialEndsAt)}
                {row.trialDaysLeft === null
                  ? ""
                  : ` · ${row.trialDaysLeft} días`}
              </Text>
            </NextLink>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-surface sm:block">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-surface-subtle text-content-muted">
            <tr>
              <th className="px-4 py-3 font-bold">Comercio</th>
              <th className="px-4 py-3 font-bold">Dueño</th>
              <th className="px-4 py-3 font-bold">Alta</th>
              <th className="px-4 py-3 font-bold">Estado</th>
              <th className="px-4 py-3 font-bold">Acceso</th>
              <th className="px-4 py-3 font-bold">Fin de prueba</th>
              <th className="px-4 py-3 text-right font-bold">Días</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <NextLink
                    href={`/comercios/${row.id}`}
                    className="font-bold text-content underline underline-offset-2"
                  >
                    {row.name}
                  </NextLink>
                  <Text variant="small">{row.slug}</Text>
                </td>
                <td className="px-4 py-3">{row.ownerEmail ?? "—"}</td>
                <td className="px-4 py-3">{formatDate(row.createdAt)}</td>
                <td className="px-4 py-3">
                  {STATUS_LABEL[row.status] ?? row.status}
                </td>
                <td className="px-4 py-3">
                  <AccessBadge access={row.access} />
                </td>
                <td className="px-4 py-3">{formatDate(row.trialEndsAt)}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {row.trialDaysLeft ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
