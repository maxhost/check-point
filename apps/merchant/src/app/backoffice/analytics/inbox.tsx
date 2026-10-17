"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Xmark } from "iconoir-react";
import type { InboxCard } from "@mi-pasaporte/domain/analytics/types";
import { formatMoney } from "@mi-pasaporte/domain/analytics/date";
import { Alert, Button, Card, Heading, Link, Text } from "../../../ui";
import { panelRequest } from "../panel-request";
type Inbox = {
  state: "ready" | "preparing";
  preparedAt: string | null;
  cards: InboxCard[];
};
export function AnalyticsInbox() {
  const router = useRouter();
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const data = await panelRequest<Inbox>("/api/analytics/inbox");
        if (active) {
          setInbox(data);
          setError("");
          if (data.state === "preparing")
            timer = setTimeout(() => {
              void load();
            }, 3000);
        }
      } catch {
        if (active) setError("No pudimos leer tus avisos. Intenta otra vez.");
      }
    };
    void load();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [reload]);
  async function act(card: InboxCard, action: "accept" | "dismiss") {
    setPending(card.id);
    setError("");
    try {
      const result = await panelRequest<{ cards: InboxCard[] }>(
        `/api/analytics/inbox/${card.id}/${action}`,
        "POST",
      );
      setInbox((current) =>
        current ? { ...current, cards: result.cards } : null,
      );
      if (action === "accept" && card.action) router.push(card.action.href);
    } catch {
      setError("No pudimos guardar la acción. Intenta otra vez.");
    } finally {
      setPending(null);
    }
  }
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
          <Button variant="quiet" onPress={() => setReload((n) => n + 1)}>
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
          <Text variant="muted">
            Analíticas empieza a contar con tus ventas y gastos desde hoy.
          </Text>
        </Card>
      )}
      {inbox?.cards.map((card) => (
        <Card key={card.id} as="article" className="grid gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="grid gap-1">
              <Text variant="small">{card.sender}</Text>
              <Heading level={3}>{card.title}</Heading>
            </div>
            <Button
              variant="quiet"
              aria-label={`Descartar ${card.title}`}
              isDisabled={pending !== null || inbox.state === "preparing"}
              isLoading={pending === card.id}
              onPress={() => {
                void act(card, "dismiss");
              }}
            >
              <Xmark aria-hidden="true" className="size-5" />
            </Button>
          </div>
          <Text className="whitespace-pre-line">{card.body}</Text>
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
              <Button
                variant="secondary"
                isDisabled={pending !== null || inbox.state === "preparing"}
                onPress={() => {
                  void act(card, "accept");
                }}
              >
                {card.action.label}
              </Button>
            </div>
          )}
        </Card>
      ))}
    </section>
  );
}
