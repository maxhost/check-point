"use client";

import { CheckCircle } from "iconoir-react";
import { useState } from "react";
import { Form } from "react-aria-components";
import { Button, TextField } from "../../../../../../ui";
import {
  requestMerchantLogin,
  startMerchantAuth,
  WizardApiError,
} from "../_lib/onboarding-api";
import { InlineApiError, StepHeader } from "./wizard-shared";
import { QaLoginButtons } from "./qa-login-buttons";

export type AccountMode = "signup" | "login";

export function AccountStep({
  apiError,
  onError,
  onNewAccount,
  onMagicLink,
  mode,
  onModeChange,
}: {
  apiError: WizardApiError | null;
  onError: (error: WizardApiError | null) => void;
  onNewAccount: (verificationSent: boolean) => Promise<void>;
  onMagicLink: () => void;
  mode: AccountMode;
  onModeChange: (mode: AccountMode) => void;
}) {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalized)) {
      setFieldError("Escribe un email válido, por ejemplo nombre@negocio.com.");
      return;
    }
    setFieldError(undefined);
    onError(null);
    setIsSubmitting(true);
    try {
      if (mode === "login") {
        await requestMerchantLogin(normalized);
        onMagicLink();
        return;
      }
      const result = await startMerchantAuth(normalized);
      if (result.sent) onMagicLink();
      else await onNewAccount(result.verificationSent === true);
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
      <div
        className="merchant-account-switch"
        role="group"
        aria-label="Acceso para negocios"
      >
        <button
          type="button"
          aria-pressed={mode === "signup"}
          onClick={() => {
            setFieldError(undefined);
            onError(null);
            onModeChange("signup");
          }}
        >
          Crear cuenta
        </button>
        <button
          type="button"
          aria-pressed={mode === "login"}
          onClick={() => {
            setFieldError(undefined);
            onError(null);
            onModeChange("login");
          }}
        >
          Iniciar sesión
        </button>
      </div>
      {mode === "signup" ? (
        <StepHeader
          step={1}
          title="Crea tu cuenta"
          description="Solo necesitas tu email. No hay contraseñas ni planes para elegir ahora."
        />
      ) : (
        <header className="mb-8">
          <p className="merchant-onboarding-eyebrow mb-2 text-xs font-bold uppercase">
            Tu negocio en CheckPass
          </p>
          <h1
            id="wizard-heading"
            tabIndex={-1}
            className="text-2xl font-bold leading-tight outline-none sm:text-3xl"
          >
            Entra a tu cuenta
          </h1>
          <p className="mt-2 leading-6 text-content-muted">
            Te enviaremos un enlace seguro para entrar. No necesitas contraseña.
          </p>
        </header>
      )}
      <Form onSubmit={submit} className="grid gap-5">
        <InlineApiError error={apiError} />
        <TextField
          label={mode === "login" ? "Tu email" : "Email del propietario"}
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
          description={
            mode === "signup"
              ? "Si este email ya estaba registrado, te enviaremos un enlace de acceso en lugar de continuar con el alta."
              : "Usa el email con el que registraste tu negocio."
          }
        />
        <Button type="submit" fullWidth isLoading={isSubmitting}>
          {isSubmitting
            ? "Continuando…"
            : mode === "login"
              ? "Enviarme enlace de acceso"
              : "Continuar"}
        </Button>
      </Form>
      {mode === "login" ? <QaLoginButtons /> : null}
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
        Revisa tu correo
      </h1>
      <p className="mt-2 leading-6 text-content-muted">
        Si hay una cuenta con ese email, te enviamos un enlace de acceso que
        sirve una sola vez durante 15 minutos. Revisa también la carpeta de
        spam.
      </p>
      <Button variant="quiet" onPress={onUseAnotherEmail} className="mt-5">
        Usar otro email
      </Button>
    </section>
  );
}
