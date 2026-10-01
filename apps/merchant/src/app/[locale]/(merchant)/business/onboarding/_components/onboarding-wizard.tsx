"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, ApiError, Button } from "../../../../../../ui";
import { AccountStep, MagicLinkState, type AccountMode } from "./account-step";
import { BusinessStep } from "./business-step";
import { CompleteStep } from "./complete-step";
import { ProgramStep } from "./program-step";
import { gateCode } from "./wizard-shared";
import type {
  BusinessSummary,
  OnboardingPrefill,
  ProgramSummary,
} from "../_lib/contracts";
import {
  getOnboardingPrefill,
  getOnboardingState,
  requestVerificationEmail,
  WizardApiError,
} from "../_lib/onboarding-api";
import { restoredStage } from "../_lib/onboarding-flow";

type Stage =
  | "loading"
  | "restore-error"
  | "account"
  | "magic-link"
  | "business"
  | "program"
  | "complete";

type VerificationStatus = "sent" | "failed" | "sending" | null;

export function OnboardingWizard() {
  const [stage, setStage] = useState<Stage>("loading");
  const [prefill, setPrefill] = useState<OnboardingPrefill | null>(null);
  const [business, setBusiness] = useState<BusinessSummary | null>(null);
  const [program, setProgram] = useState<ProgramSummary | null>(null);
  const [currencyCode, setCurrencyCode] = useState<string | null>(null);
  const [error, setError] = useState<WizardApiError | null>(null);
  const [accountMode, setAccountMode] = useState<AccountMode>("signup");
  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus>(null);
  const hasShownInitialStage = useRef(false);

  const loadPrefill = useCallback(async () => {
    const result = await getOnboardingPrefill();
    setPrefill(result);
    return result;
  }, []);

  const restore = useCallback(async () => {
    setStage("loading");
    setError(null);
    try {
      const state = await getOnboardingState();
      const nextStage = restoredStage(state);
      if (state.authenticated) {
        setBusiness(state.business);
        setProgram(state.program);
      }
      if (nextStage === "business") {
        await loadPrefill();
      }
      setStage(nextStage);
    } catch (caught) {
      setError(
        caught instanceof WizardApiError
          ? caught
          : new WizardApiError("No pudimos recuperar tu avance.", 503),
      );
      setStage("restore-error");
    }
  }, [loadPrefill]);

  useEffect(() => {
    void restore();
  }, [restore]);

  useEffect(() => {
    if (stage === "loading") return;
    if (!hasShownInitialStage.current) {
      hasShownInitialStage.current = true;
      return;
    }
    document.getElementById("wizard-heading")?.focus();
  }, [stage]);

  function resetToAccount() {
    setError(null);
    setAccountMode("login");
    setStage("account");
  }

  async function retryVerification() {
    setVerificationStatus("sending");
    try {
      const result = await requestVerificationEmail();
      setVerificationStatus(
        result.verified ? null : result.sent ? "sent" : "failed",
      );
    } catch {
      setVerificationStatus("failed");
    }
  }

  const ownerCode = gateCode(error);
  if (ownerCode) {
    return (
      <WizardShell>
        <ApiError
          code={ownerCode}
          suspensionReason={error?.suspensionReason}
          onLogin={resetToAccount}
          onBack={() => void restore()}
          onHome={() => window.location.assign("/")}
          onContact={() =>
            window.location.assign("mailto:soporte@mipasaporte.app")
          }
          onEmailVerified={() => void restore()}
        />
      </WizardShell>
    );
  }

  if (stage === "loading") return <LoadingState />;

  if (stage === "restore-error") {
    return (
      <WizardShell>
        <section className="rounded-lg bg-surface p-6 shadow-sm sm:p-8">
          <h1
            id="wizard-heading"
            tabIndex={-1}
            className="text-2xl font-bold outline-none"
          >
            No pudimos recuperar tu avance
          </h1>
          <p className="mt-2 leading-6 text-content-muted">
            {error?.message ?? "Revisa tu conexión y vuelve a intentarlo."}
          </p>
          <Button onPress={() => void restore()} className="mt-5">
            Reintentar
          </Button>
        </section>
      </WizardShell>
    );
  }

  return (
    <WizardShell>
      {stage === "account" && (
        <AccountStep
          apiError={error}
          onError={setError}
          mode={accountMode}
          onModeChange={setAccountMode}
          onNewAccount={async (verificationSent) => {
            setVerificationStatus(verificationSent ? "sent" : "failed");
            await loadPrefill();
            setStage("business");
          }}
          onMagicLink={() => {
            setAccountMode("login");
            setStage("magic-link");
          }}
        />
      )}
      {stage === "magic-link" && (
        <MagicLinkState onUseAnotherEmail={resetToAccount} />
      )}
      {stage === "business" && prefill && (
        <>
          <VerificationNotice
            status={verificationStatus}
            onRetry={retryVerification}
          />
          <BusinessStep
            prefill={prefill}
            apiError={error}
            onError={setError}
            onComplete={(created, createdCurrencyCode) => {
              setBusiness(created);
              setCurrencyCode(createdCurrencyCode);
              setError(null);
              setStage("program");
            }}
            onAlreadyExists={() => void restore()}
          />
        </>
      )}
      {stage === "program" && (
        <>
          <VerificationNotice
            status={verificationStatus}
            onRetry={retryVerification}
          />
          <ProgramStep
            business={business}
            currencyCode={currencyCode}
            apiError={error}
            onError={setError}
            onComplete={(created) => {
              setProgram(created);
              setError(null);
              setStage("complete");
            }}
          />
        </>
      )}
      {stage === "complete" && business && program && (
        <CompleteStep business={business} onGateError={setError} />
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

function VerificationNotice({
  status,
  onRetry,
}: {
  status: VerificationStatus;
  onRetry: () => Promise<void>;
}) {
  if (!status) return null;
  return (
    <Alert
      kind={status === "sent" ? "info" : "warning"}
      title={
        status === "sent"
          ? "Revisa tu email"
          : "No pudimos enviar el enlace de verificación"
      }
      className="mb-6"
    >
      {status === "sent" ? (
        <p>
          Te enviamos un enlace para confirmar tu email. Puedes continuar con el
          alta mientras tanto.
        </p>
      ) : (
        <div className="grid gap-2">
          <p>
            Acabamos de crear tu cuenta con el email del paso anterior, pero no
            pudimos enviar el enlace de verificación. Puedes continuar con tu
            negocio y reintentar el envío aquí. Necesitarás verificar el email
            para obtener tu QR.
          </p>
          <Button
            variant="quiet"
            onPress={() => void onRetry()}
            isLoading={status === "sending"}
          >
            {status === "sending" ? "Enviando…" : "Reenviar enlace"}
          </Button>
        </div>
      )}
    </Alert>
  );
}

function LoadingState() {
  return (
    <WizardShell>
      <div role="status" className="grid gap-4" aria-label="Cargando tu avance">
        <div className="h-4 w-24 animate-pulse rounded-full bg-disabled motion-reduce:animate-none" />
        <div className="h-8 w-3/4 animate-pulse rounded-md bg-disabled motion-reduce:animate-none" />
        <div className="h-28 animate-pulse rounded-lg bg-disabled motion-reduce:animate-none" />
      </div>
    </WizardShell>
  );
}
