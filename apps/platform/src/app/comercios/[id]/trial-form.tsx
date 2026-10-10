"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Heading,
  NumberField,
  Text,
  TextField,
} from "../../../ui";

type Change =
  | { mode: "add_days"; days: number }
  | { mode: "set_date"; date: string; confirmBlock?: boolean };

/** Spec 0190 §D5 — sumar dias o fijar la fecha; ante `would_block` pide confirmar. */
export function TrialForm({
  businessId,
  paying,
}: {
  businessId: string;
  paying: boolean;
}) {
  const router = useRouter();
  const [days, setDays] = useState(30);
  const [date, setDate] = useState("");
  const [pending, setPending] = useState<Change | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  async function send(change: Change) {
    setBusy(true);
    setResult(null);
    const response = await fetch(`/api/businesses/${businessId}/trial`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(change),
    });
    const body = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
    } | null;
    setBusy(false);
    if (response.ok) {
      setPending(null);
      setResult({
        kind: "success",
        text: "Listo, la prueba quedó actualizada.",
      });
      router.refresh();
      return;
    }
    if (body?.code === "would_block" && change.mode === "set_date") {
      setPending({ ...change, confirmBlock: true });
      return;
    }
    setResult({
      kind: "error",
      text: body?.message ?? "No se pudo guardar.",
    });
  }

  if (paying) {
    return (
      <Card>
        <Alert kind="info" title="Este comercio ya paga">
          Su prueba se mueve en Stripe, no desde el panel.
        </Alert>
      </Card>
    );
  }

  return (
    <Card className="grid gap-5">
      <Heading level={2}>Mover la prueba</Heading>
      {result && <Alert kind={result.kind} title={result.text} />}
      {pending && pending.mode === "set_date" && (
        <Alert kind="warning" title="Con esa fecha el comercio queda bloqueado">
          <div className="mt-3 flex flex-wrap gap-3">
            <Button
              variant="danger"
              isLoading={busy}
              onPress={() => void send(pending)}
            >
              Bloquear igual
            </Button>
            <Button variant="secondary" onPress={() => setPending(null)}>
              Cancelar
            </Button>
          </div>
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <NumberField
          label="Sumar días"
          description="Desde el fin actual, o desde hoy si ya venció."
          minValue={1}
          maxValue={365}
          value={days}
          onChange={setDays}
        />
        <Button
          isLoading={busy}
          isDisabled={!Number.isInteger(days) || days < 1 || days > 365}
          onPress={() => void send({ mode: "add_days", days })}
        >
          Sumar
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <TextField
          label="Fijar fecha de fin"
          description="AAAA-MM-DD, vence ese día a las 23:59 de Ecuador."
          placeholder="2027-01-31"
          value={date}
          onChange={setDate}
        />
        <Button
          variant="secondary"
          isLoading={busy}
          isDisabled={!/^\d{4}-\d{2}-\d{2}$/.test(date)}
          onPress={() => void send({ mode: "set_date", date })}
        >
          Fijar
        </Button>
      </div>
      <Text variant="small">
        Panel, mostrador y POS vuelven en el acto; las campañas pausadas, en el
        barrido diario.
      </Text>
    </Card>
  );
}
