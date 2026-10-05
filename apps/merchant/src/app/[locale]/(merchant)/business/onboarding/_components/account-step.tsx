"use client";

import { CheckCircle } from "iconoir-react";
import { useState } from "react";
import { Form } from "react-aria-components";
import { Button, TextField } from "../../../../../../ui";
import { requestMerchantLogin, WizardApiError } from "../_lib/onboarding-api";
import { InlineApiError } from "./wizard-shared";
import { QaLoginButtons } from "./qa-login-buttons";

export function AccountStep({
  onBack,
  onMagicLink,
}: {
  onBack: () => void;
  onMagicLink: () => void;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<WizardApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestMerchantLogin(email.trim().toLowerCase());
      onMagicLink();
    } catch (caught) {
      setError(
        caught instanceof WizardApiError
          ? caught
          : new WizardApiError("No pudimos enviar el enlace.", 503),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 id="wizard-heading" tabIndex={-1} className="mb-3 text-2xl font-bold">
        Entra a tu cuenta
      </h1>
      <p className="mb-8 text-content-muted">
        Te enviaremos un enlace seguro para entrar.
      </p>
      <Form onSubmit={submit} className="grid gap-5">
        <InlineApiError error={error} />
        <TextField
          label="Tu email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          isRequired
        />
        <Button type="submit" fullWidth isLoading={busy}>
          Enviarme enlace de acceso
        </Button>
      </Form>
      <button
        type="button"
        className="mt-5 font-bold text-primary underline"
        onClick={onBack}
      >
        Crear un negocio
      </button>
      <QaLoginButtons />
    </>
  );
}

export function MagicLinkState({
  onUseAnotherEmail,
}: {
  onUseAnotherEmail: () => void;
}) {
  return (
    <section className="rounded-lg bg-surface p-6 shadow-sm sm:p-8">
      <CheckCircle className="size-10 text-success" aria-hidden="true" />
      <h1 id="wizard-heading" tabIndex={-1} className="mt-5 text-2xl font-bold">
        Revisa tu correo
      </h1>
      <p className="mt-2 leading-6 text-content-muted">
        Te enviamos un enlace para entrar. Revisa también la carpeta de spam.
      </p>
      <Button variant="quiet" onPress={onUseAnotherEmail} className="mt-5">
        Usar otro email
      </Button>
    </section>
  );
}
