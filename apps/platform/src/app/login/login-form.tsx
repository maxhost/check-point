"use client";

import { useState } from "react";
import { Alert, Button, Card, TextField } from "../../ui";

export function LoginForm({ error }: { error: string | null }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [message, setMessage] = useState<string | null>(error);

  async function submit() {
    setState("sending");
    setMessage(null);
    const response = await fetch("/api/auth/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (response.ok) {
      setState("sent");
      return;
    }
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    setMessage(body?.message ?? "No pudimos pedir el enlace.");
    setState("idle");
  }

  return (
    <Card className="grid gap-4">
      {message && <Alert kind="error" title={message} />}
      {state === "sent" ? (
        <Alert
          kind="success"
          title="Si el correo tiene acceso, te llegó un enlace."
        >
          Vence en 15 minutos.
        </Alert>
      ) : (
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <TextField
            label="Correo"
            type="email"
            autoComplete="email"
            value={email}
            onChange={setEmail}
            isRequired
          />
          <Button type="submit" isLoading={state === "sending"} fullWidth>
            Enviarme el enlace
          </Button>
        </form>
      )}
    </Card>
  );
}
