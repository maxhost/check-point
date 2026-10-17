"use client";
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
    <section aria-labelledby="analytics-inbox-title" className="grid gap-4">
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
      {inbox?.cards.map((card) => (
        <Card key={card.id} as="article" className="grid min-w-0 gap-4">
          <div className="grid min-w-0 gap-1">
            <Text variant="small">
              {card.sender} ·{" "}
              {card.category === "informational"
                ? "Información"
                : card.category === "actionable"
                  ? "Operaciones"
                  : "Marketing"}
            </Text>
            <Heading level={3}>{card.title}</Heading>
          </div>
          <Text className="whitespace-pre-line break-words">{card.body}</Text>
          <Text variant="small">{card.period.label}</Text>
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
                isDisabled={pending !== null || inbox.state === "preparing"}
                isLoading={pending === card.id}
                onPress={() => {
                  if (decision.key === "snooze") {
                    beginSnooze(card);
                  } else void act(card, decision.key);
                }}
              >
                {decision.label}
              </Button>
            ))}
          </div>
        </Card>
      ))}
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
