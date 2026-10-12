"use client";

import { useState } from "react";
import { Button, Form, Heading, Text, TextField } from "../../../../../../ui";
import {
  requestMerchantLogin,
  verifyMerchantLoginCode,
  WizardApiError,
} from "../_lib/onboarding-api";
import { InlineApiError } from "./wizard-shared";

export function AccountStep({
  onBack,
  onCodeSent,
}: {
  onBack: () => void;
  onCodeSent: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<WizardApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const normalized = email.trim().toLowerCase();
      await requestMerchantLogin(normalized);
      onCodeSent(normalized);
    } catch (caught) {
      setError(
        caught instanceof WizardApiError
          ? caught
          : new WizardApiError(
              "No pudimos enviar el código. Probá de nuevo.",
              503,
            ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Heading level={1} id="wizard-heading" tabIndex={-1} className="mb-3">
        Entra a tu cuenta
      </Heading>
      <Text variant="muted" className="mb-8">
        Te enviaremos un código para entrar.
      </Text>
      <Form onSubmit={submit}>
        <InlineApiError error={error} />
        <TextField
          label="Tu email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          inputMode="email"
          isRequired
          isDisabled={busy}
        />
        <Button type="submit" fullWidth isLoading={busy}>
          Enviarme código
        </Button>
      </Form>
      <Button
        variant="quiet"
        className="mt-5"
        onPress={onBack}
        isDisabled={busy}
      >
        Crear un negocio
      </Button>
    </>
  );
}

export function LoginCodeState({
  email,
  onUseAnotherEmail,
}: {
  email: string;
  onUseAnotherEmail: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<WizardApiError | null>(null);
  const [busy, setBusy] = useState<"verify" | "resend" | null>(null);
  const [resent, setResent] = useState(false);
  const blocked = error?.code === "too_many_failures";
  const valid = /^\d{6}$/.test(code);

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || blocked || !valid) return;
    setBusy("verify");
    setError(null);
    setResent(false);
    try {
      const { destination } = await verifyMerchantLoginCode(email, code);
      window.location.assign(destination);
    } catch (caught) {
      setError(
        caught instanceof WizardApiError
          ? caught
          : new WizardApiError(
              "No pudimos verificar el código. Probá de nuevo.",
              503,
            ),
      );
      setBusy(null);
    }
  }

  async function resend() {
    if (busy || blocked) return;
    setBusy("resend");
    setError(null);
    setResent(false);
    try {
      await requestMerchantLogin(email);
      setCode("");
      setResent(true);
    } catch (caught) {
      setError(
        caught instanceof WizardApiError
          ? caught
          : new WizardApiError(
              "No pudimos enviar el código. Probá de nuevo.",
              503,
            ),
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Heading
        level={1}
        id="wizard-heading"
        tabIndex={-1}
        className="mb-3 break-words"
      >
        Te mandamos un código a {email}
      </Heading>
      <Text variant="muted" className="mb-8">
        Revisá también la carpeta de spam. El código vence en 10 minutos.
      </Text>
      <Form onSubmit={verify}>
        <InlineApiError error={error} />
        {resent && (
          <p role="status" className="text-success">
            Te mandamos un código nuevo
          </p>
        )}
        <TextField
          label="Código de 6 números"
          name="code"
          value={code}
          onChange={setCode}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          pattern="\d{6}"
          isRequired
          isDisabled={Boolean(busy) || blocked}
        />
        <Button
          type="submit"
          fullWidth
          isDisabled={!valid || Boolean(busy) || blocked}
          isLoading={busy === "verify"}
        >
          Entrar
        </Button>
      </Form>
      <div className="mt-5 grid gap-3">
        {!blocked && (
          <Button
            variant="quiet"
            onPress={() => void resend()}
            isDisabled={Boolean(busy)}
            isLoading={busy === "resend"}
          >
            Reenviar código
          </Button>
        )}
        <Button
          variant="quiet"
          onPress={onUseAnotherEmail}
          isDisabled={Boolean(busy)}
        >
          Usar otro email
        </Button>
      </div>
    </>
  );
}
