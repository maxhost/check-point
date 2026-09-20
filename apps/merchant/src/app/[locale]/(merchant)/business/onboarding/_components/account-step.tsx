"use client";

import { CheckCircle } from "iconoir-react";
import { useState } from "react";
import { Form } from "react-aria-components";
import { Button, TextField } from "../../../../../../ui";
import { startMerchantAuth, WizardApiError } from "../_lib/onboarding-api";
import { InlineApiError, StepHeader } from "./wizard-shared";

export function AccountStep({
  apiError,
  onError,
  onNewAccount,
  onMagicLink,
}: {
  apiError: WizardApiError | null;
  onError: (error: WizardApiError | null) => void;
  onNewAccount: () => Promise<void>;
  onMagicLink: () => void;
}) {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalized)) {
      setFieldError("Escribí un email válido, por ejemplo nombre@negocio.com.");
      return;
    }
    setFieldError(undefined);
    onError(null);
    setIsSubmitting(true);
    try {
      const result = await startMerchantAuth(normalized);
      if (result.sent) onMagicLink();
      else await onNewAccount();
    } catch (caught) {
      const requestError =
        caught instanceof WizardApiError
          ? caught
          : new WizardApiError("No pudimos iniciar tu cuenta.", 503);
      if (requestError.code === "invalid_email")
        setFieldError(requestError.message);
      else onError(requestError);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <StepHeader
        step={1}
        title="Creá tu cuenta"
        description="Solo necesitás tu email. No hay contraseñas ni planes para elegir ahora."
      />
      <Form onSubmit={submit} className="grid gap-5">
        <InlineApiError error={apiError} />
        <TextField
          label="Email del propietario"
          name="email"
          type="email"
          placeholder="nombre@negocio.com"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          inputMode="email"
          isRequired
          isInvalid={Boolean(fieldError)}
          errorMessage={fieldError}
          description="Si ya tenés una cuenta, te enviaremos un enlace seguro para entrar."
        />
        <Button type="submit" fullWidth isLoading={isSubmitting}>
          {isSubmitting ? "Continuando…" : "Continuar"}
        </Button>
      </Form>
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
      <h1
        id="wizard-heading"
        tabIndex={-1}
        className="mt-5 text-2xl font-bold outline-none"
      >
        Revisá tu correo
      </h1>
      <p className="mt-2 leading-6 text-content-muted">
        Ya existe una cuenta con ese email. Te enviamos un enlace de acceso que
        sirve una sola vez durante 15 minutos.
      </p>
      <Button variant="quiet" onPress={onUseAnotherEmail} className="mt-5">
        Usar otro email
      </Button>
    </section>
  );
}
