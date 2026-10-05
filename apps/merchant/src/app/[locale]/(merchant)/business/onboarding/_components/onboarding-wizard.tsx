"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Button, TextField } from "../../../../../../ui";
import { AccountStep, MagicLinkState } from "./account-step";
import { BusinessStep } from "./business-step";
import { InlineApiError, StepHeader } from "./wizard-shared";
import type {
  BusinessSummary,
  OnboardingPrefill,
  PlaceSelection,
  SignupBusiness,
} from "../_lib/contracts";
import {
  getOnboardingPrefill,
  getOnboardingState,
  requestVerificationEmail,
  signupMerchant,
  WizardApiError,
} from "../_lib/onboarding-api";
import { restoredStage } from "../_lib/onboarding-flow";

type Stage =
  | "loading"
  | "restore-error"
  | "business"
  | "email"
  | "complete"
  | "existing"
  | "login"
  | "magic-link";

export function OnboardingWizard() {
  const [stage, setStage] = useState<Stage>("loading");
  const [prefill, setPrefill] = useState<OnboardingPrefill | null>(null);
  const [businessInput, setBusinessInput] = useState<SignupBusiness | null>(
    null,
  );
  const [placeSelection, setPlaceSelection] = useState<PlaceSelection | null>(
    null,
  );
  const [business, setBusiness] = useState<BusinessSummary | null>(null);
  const [email, setEmail] = useState("");
  const [verificationSent, setVerificationSent] = useState(true);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<WizardApiError | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [businessKey, setBusinessKey] = useState(0);

  const restore = useCallback(async () => {
    setStage("loading");
    setError(null);
    try {
      const state = await getOnboardingState();
      if (restoredStage(state) === "panel") {
        window.location.assign("/backoffice");
        return;
      }
      setPrefill(await getOnboardingPrefill());
      setStage("business");
    } catch (caught) {
      setError(
        caught instanceof WizardApiError
          ? caught
          : new WizardApiError("No pudimos recuperar tu avance.", 503),
      );
      setStage("restore-error");
    }
  }, []);

  useEffect(() => {
    void restore();
  }, [restore]);
  useEffect(() => {
    if (stage !== "loading") document.getElementById("wizard-heading")?.focus();
  }, [stage]);

  async function submitEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessInput || busy) return;
    const normalized = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalized)) {
      setEmailError("Escribe un email válido, por ejemplo nombre@negocio.com.");
      return;
    }
    setBusy(true);
    setError(null);
    setEmailError(null);
    try {
      const result = await signupMerchant(normalized, businessInput);
      if ("sent" in result) {
        setBusinessInput(null);
        setPlaceSelection(null);
        setStage("existing");
      } else {
        setBusiness(result.business);
        setVerificationSent(result.verificationSent);
        setStage("complete");
      }
    } catch (caught) {
      const requestError =
        caught instanceof WizardApiError
          ? caught
          : new WizardApiError("No pudimos crear tu cuenta.", 503);
      if (requestError.code === "invalid_selection") {
        setBusinessInput(null);
        setPlaceSelection(null);
        setBusinessKey((key) => key + 1);
        setError(
          new WizardApiError(
            "La selección venció. Busca tu negocio de nuevo.",
            422,
          ),
        );
        setStage("business");
      } else if (requestError.code === "invalid_email") {
        setEmailError(requestError.message);
      } else if (requestError.code === "invalid_business") {
        setError(requestError);
        setStage("business");
      } else {
        setError(requestError);
      }
    } finally {
      setBusy(false);
    }
  }

  async function retryVerification() {
    setSending(true);
    try {
      const result = await requestVerificationEmail();
      setVerificationSent(result.sent || result.verified);
    } catch {
      setVerificationSent(false);
    } finally {
      setSending(false);
    }
  }

  if (stage === "loading")
    return (
      <WizardShell>
        <p role="status">Cargando tu avance…</p>
      </WizardShell>
    );
  if (stage === "restore-error")
    return (
      <WizardShell>
        <h1 id="wizard-heading" tabIndex={-1}>
          No pudimos recuperar tu avance
        </h1>
        <InlineApiError error={error} />
        <Button onPress={() => void restore()}>Reintentar</Button>
      </WizardShell>
    );

  return (
    <WizardShell>
      {stage === "business" && prefill && (
        <BusinessStep
          key={businessKey}
          prefill={prefill}
          apiError={error}
          initialSelection={placeSelection}
          initialBusiness={businessInput}
          onLogin={() => {
            setError(null);
            setStage("login");
          }}
          onComplete={(value, selection) => {
            setBusinessInput(value);
            setPlaceSelection(selection);
            setError(null);
            setStage("email");
          }}
        />
      )}
      {stage === "email" && businessInput && (
        <>
          <StepHeader
            step={2}
            title="¿Cuál es tu email?"
            description="Crearemos tu cuenta y tu negocio juntos. Te enviaremos un enlace para verificar el email."
          />
          <form
            className="grid gap-5"
            onSubmit={(event) => void submitEmail(event)}
          >
            <InlineApiError error={error} />
            <TextField
              label="Tu email"
              type="email"
              name="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              inputMode="email"
              isRequired
              isInvalid={Boolean(emailError)}
              errorMessage={emailError ?? undefined}
            />
            <Button type="submit" fullWidth isLoading={busy}>
              Crear mi cuenta
            </Button>
          </form>
          <button
            type="button"
            className="mt-5 font-bold text-primary underline"
            onClick={() => {
              setError(null);
              setStage("business");
            }}
          >
            Volver al negocio
          </button>
        </>
      )}
      {stage === "complete" && business && (
        <>
          <StepHeader
            step={3}
            title={`Tu negocio ${business.name} está listo`}
            description="Ya puedes entrar a tu panel y seguir configurándolo."
          />
          {!verificationSent && (
            <Alert
              kind="warning"
              title="No pudimos enviar el enlace de verificación"
              className="mb-6"
            >
              <p>
                Tu cuenta y tu negocio están creados. Reenvía el enlace para
                verificar tu email.
              </p>
              <Button
                variant="quiet"
                isLoading={sending}
                onPress={() => void retryVerification()}
              >
                Reenviar enlace
              </Button>
            </Alert>
          )}
          {verificationSent && (
            <Alert kind="info" title="Revisa tu email" className="mb-6">
              Te enviamos un enlace para verificar tu email.
            </Alert>
          )}
          <a href="/backoffice" className="onboarding-panel-link">
            Ir a mi panel
          </a>
        </>
      )}
      {stage === "existing" && (
        <section>
          <h1 id="wizard-heading" tabIndex={-1} className="text-2xl font-bold">
            Ya tienes cuenta
          </h1>
          <p className="mt-3 text-content-muted">
            Te mandamos un link para entrar. Revisa también la carpeta de spam.
          </p>
          <Button
            variant="quiet"
            className="mt-5"
            onPress={() => {
              setBusinessKey((key) => key + 1);
              setStage("business");
            }}
          >
            Crear otro negocio
          </Button>
        </section>
      )}
      {stage === "login" && (
        <AccountStep
          onBack={() => setStage("business")}
          onMagicLink={() => setStage("magic-link")}
        />
      )}
      {stage === "magic-link" && (
        <MagicLinkState onUseAnotherEmail={() => setStage("login")} />
      )}
    </WizardShell>
  );
}

function WizardShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="merchant-onboarding min-h-svh px-4 py-6 text-content sm:px-6 sm:py-10">
      <div className="merchant-onboarding-inner mx-auto w-full max-w-[var(--content-form)]">
        <header className="merchant-onboarding-brandbar">
          <div
            className="merchant-onboarding-brand"
            role="img"
            aria-label="CheckPass Club"
          >
            <span className="merchant-onboarding-mark" aria-hidden="true">
              c<span>.</span>
            </span>
            <span className="merchant-onboarding-wordmark" aria-hidden="true">
              checkpass<span>.</span>club
            </span>
          </div>
          <span className="merchant-onboarding-context">Para negocios</span>
        </header>
        <div className="merchant-onboarding-content">{children}</div>
      </div>
    </main>
  );
}
