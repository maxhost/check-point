"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Switch } from "react-aria-components";
import { Button } from "../../../ui";
import type { TemplateView } from "./marketing-types";
import { STATUS_LABELS } from "./campaign-labels";

const channelNames = { proximity: "Proximidad", push: "Push" };
const groupNames: Record<string, string> = {
  welcome: "Nuevos clientes",
  reactivation: "Reactivación",
  balance: "Saldo y premios",
};
const formatDate = (value: string, timeZone: string | null) =>
  new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(value));

export function TemplateRow({
  template,
  timeZone,
  isOwner,
  busy,
  onFinalize,
  onResume,
}: {
  template: TemplateView;
  timeZone: string | null;
  isOwner: boolean;
  busy: boolean;
  onFinalize: () => void;
  onResume: () => void;
}) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const live = template.live;
  const active = live?.status === "active";
  const paused = live?.status === "paused";
  const status = live
    ? active
      ? "Prendida"
      : paused
        ? "Pausada"
        : STATUS_LABELS[live.status]
    : "Apagada";
  const editorHref = `/backoffice/marketing/templates/${encodeURIComponent(template.key)}`;
  useEffect(() => {
    if (!opening) return;
    const timeout = window.setTimeout(() => setOpening(false), 10000);
    return () => window.clearTimeout(timeout);
  }, [opening]);
  const prefetchEditor = () => {
    if (!live) router.prefetch?.(editorHref);
  };

  return (
    <li
      className="border-b border-border py-5 last:border-0"
      onPointerEnter={prefetchEditor}
      onFocusCapture={prefetchEditor}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="text-lg font-bold">{template.title}</h3>
          <span
            role={opening ? "status" : undefined}
            className="rounded-full border border-border-strong px-2.5 py-0.5 text-sm font-semibold"
          >
            {opening ? "Abriendo editor…" : status}
          </span>
        </div>
        <Switch
          aria-label={`${opening ? "Abriendo configuración de" : active ? "Finalizar" : live ? "Campaña en curso" : "Abrir configuración de"} ${template.title}`}
          aria-busy={opening}
          isSelected={active}
          isDisabled={
            opening || busy || Boolean(live && !active) || (active && !isOwner)
          }
          onChange={(selected) => {
            if (selected && !live) {
              setOpening(true);
              router.push(editorHref);
            }
            if (!selected && active) onFinalize();
          }}
          className="inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-md outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-focus data-[disabled]:cursor-not-allowed"
        >
          {({ isSelected }) => (
            <span
              aria-hidden="true"
              className={`flex h-7 w-12 shrink-0 items-center rounded-full border border-border-strong p-0.5 transition-colors duration-[var(--duration-fast)] ${isSelected || opening ? "bg-primary" : "bg-disabled"}`}
            >
              <span
                className={`size-5 rounded-full bg-surface shadow-sm transition-transform duration-[var(--duration-fast)] ${isSelected || opening ? "translate-x-5" : "translate-x-0"}`}
              />
            </span>
          )}
        </Switch>
      </div>
      <p className="mt-2 text-sm leading-6 text-content-muted">
        {template.description}
      </p>
      <p className="mt-2 text-sm text-content-muted">
        {groupNames[template.group] ?? template.group} ·{" "}
        {template.welcome
          ? "Se entrega al instalar el pase"
          : template.channels
              .map((channel) => channelNames[channel])
              .join(" y ")}
      </p>
      {live && (
        <p className="mt-2 text-sm font-semibold">
          Finaliza:{" "}
          {live.endsAt ? formatDate(live.endsAt, timeZone) : "sin fecha de fin"}
        </p>
      )}
      {template.runs.length > 0 && (
        <div className="mt-3 text-sm">
          <p className="font-semibold">Corridas anteriores</p>
          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {template.runs.map((run) => (
              <li key={run.id}>
                <Link
                  className="underline underline-offset-2"
                  href={`/backoffice/marketing/${run.id}`}
                >
                  {run.activatedAt
                    ? formatDate(run.activatedAt, timeZone)
                    : "Sin fecha"}{" "}
                  · {STATUS_LABELS[run.status]}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {live && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            className="marketing-link"
            href={`/backoffice/marketing/${live.id}`}
          >
            Ver campaña
          </Link>
          {paused && (
            <Button variant="secondary" isDisabled={busy} onPress={onResume}>
              Reanudar
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
