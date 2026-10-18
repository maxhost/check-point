"use client";
import { useState } from "react";
import { NavArrowDown, NavArrowUp } from "iconoir-react";
import { formatMoney } from "@mi-pasaporte/domain/analytics/date";
import {
  Alert,
  Button,
  Card,
  DateTimeField,
  Dialog,
  FormActions,
  Heading,
  Link,
  Text,
} from "../../../ui";
import { useAnalyticsInbox } from "./inbox-state";
export function AnalyticsInbox() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const {
    inbox,
    error,
    pending,
    refresh,
    act,
    snoozing,
    setSnoozing,
    reminder,
    setReminder,
    reminderError,
    setReminderError,
    reminderTimezone,
    localValue,
    saveReminder,
    beginSnooze,
  } = useAnalyticsInbox();
  return (
    <section
      aria-labelledby="analytics-inbox-title"
      className="grid min-w-0 grid-cols-1 gap-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading level={2} id="analytics-inbox-title">
          Hoy en tu negocio
        </Heading>
        <Link href="/backoffice/analytics">Ver Analíticas</Link>
      </div>
      {error && (
        <Alert kind="error" title={error}>
          <Button variant="quiet" onPress={refresh}>
            Volver a intentar
          </Button>
        </Alert>
      )}
      {!inbox && !error && <Text variant="muted">Preparando tus avisos…</Text>}
      {inbox?.state === "preparing" && (
        <Alert title="Preparando lo de hoy">
          Los avisos se actualizarán aquí en unos momentos.
        </Alert>
      )}
      {inbox?.cards.length === 0 && inbox.state === "ready" && (
        <Card>
          <Text>Hoy no tengo nada para avisarte.</Text>
        </Card>
      )}
      <div className="min-w-0 divide-y divide-border border-y border-border">
        {inbox?.cards.map((card) => {
          const expanded = expandedId === card.id;
          const panelId = `inbox-panel-${card.id}`;
          return (
            <article key={card.id} className="min-w-0">
              <Button
                variant="quiet"
                aria-expanded={expanded}
                aria-controls={panelId}
                aria-label={card.title}
                className="w-full min-w-0 justify-start rounded-none px-2 py-3 text-left"
                onPress={() => setExpandedId(expanded ? null : card.id)}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1 sm:grid sm:grid-cols-6 sm:items-center sm:gap-x-3">
                  <span className="flex min-w-0 justify-between gap-3 sm:contents">
                    <Text
                      as="span"
                      variant="small"
                      className="truncate sm:order-1 sm:col-span-1"
                    >
                      {card.sender}
                    </Text>
                    <Text
                      as="span"
                      variant="small"
                      className="shrink-0 sm:order-3 sm:col-span-2 sm:truncate sm:text-right"
                    >
                      {card.period.label}
                    </Text>
                  </span>
                  <span className="flex min-w-0 items-center gap-2 sm:order-2 sm:col-span-3">
                    <Text
                      as="span"
                      variant="label"
                      className="max-w-full shrink-0 truncate"
                    >
                      {card.title}
                    </Text>
                    <Text
                      as="span"
                      variant="small"
                      className="min-w-0 truncate"
                    >
                      {card.body.slice(0, 80)}…
                    </Text>
                  </span>
                </span>
                {expanded ? (
                  <NavArrowUp aria-hidden="true" className="size-5 shrink-0" />
                ) : (
                  <NavArrowDown
                    aria-hidden="true"
                    className="size-5 shrink-0"
                  />
                )}
              </Button>
              <div id={panelId} hidden={!expanded}>
                {expanded && (
                  <div className="grid gap-3 px-2 pb-4 pt-1">
                    <Text variant="small">
                      {card.category === "informational"
                        ? "Información"
                        : card.category === "actionable"
                          ? "Operaciones"
                          : "Marketing"}
                    </Text>
                    <Text className="whitespace-pre-line break-words">
                      {card.body}
                    </Text>
                    {(card.amountAtStake || card.quality === "estimated") && (
                      <div className="flex flex-wrap gap-3">
                        {card.amountAtStake && (
                          <Text variant="small">
                            Monto en juego:{" "}
                            {formatMoney(
                              card.amountAtStake.amountMinor,
                              card.amountAtStake.currencyCode,
                              card.amountAtStake.minorUnit,
                            )}
                          </Text>
                        )}
                        {card.quality === "estimated" && (
                          <Text variant="small">Estimado</Text>
                        )}
                      </div>
                    )}
                    {card.action && (
                      <div>
                        <Link variant="secondary" href={card.action.href}>
                          {card.action.label}
                        </Link>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {card.decisions.map((decision) => (
                        <Button
                          key={decision.key}
                          variant="quiet"
                          isDisabled={
                            pending !== null || inbox.state === "preparing"
                          }
                          isLoading={pending === card.id}
                          onPress={() => {
                            if (decision.key === "snooze") beginSnooze(card);
                            else void act(card, decision.key);
                          }}
                        >
                          {decision.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <Dialog
        isOpen={snoozing !== null}
        onOpenChange={(open) => {
          if (!open && pending === null) setSnoozing(null);
        }}
        title="Recordarme luego"
        isDismissable={pending === null}
        description={snoozing?.title}
      >
        {snoozing && inbox && (
          <div className="grid gap-5">
            <DateTimeField
              label="Fecha y hora"
              value={reminder}
              onChange={(value) => {
                setReminder(value);
                setReminderError("");
              }}
              min={localValue(new Date())}
              isDisabled={pending !== null}
              isRequired
              description={`Zona del comercio: ${reminderTimezone}. Hasta ${new Intl.DateTimeFormat("es-419", { dateStyle: "medium", timeStyle: "short", timeZone: reminderTimezone }).format(new Date(snoozing.expiresAt))}.`}
              errorMessage={reminderError}
            />
            <FormActions>
              <Button
                variant="secondary"
                isDisabled={pending !== null}
                onPress={() => setSnoozing(null)}
              >
                Cancelar
              </Button>
              <Button isLoading={pending !== null} onPress={saveReminder}>
                Guardar recordatorio
              </Button>
            </FormActions>
          </div>
        )}
      </Dialog>
    </section>
  );
}
