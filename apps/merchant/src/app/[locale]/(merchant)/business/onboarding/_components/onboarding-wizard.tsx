"use client";

import { CheckCircle, Download, QrCode, Whatsapp } from "iconoir-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Form, Link } from "react-aria-components";
import {
  Alert,
  ApiError,
  Button,
  NumberField,
  ProgressIndicator,
  SelectField,
  TextField,
  type OwnerGateErrorCode,
} from "../../../../../../ui";
import { AddressCombobox } from "./address-combobox";
import type {
  BusinessSummary,
  OnboardingPrefill,
  ProgramSummary,
  SelectedAddress,
} from "../_lib/contracts";
import {
  createBusiness,
  createProgram,
  getOnboardingPrefill,
  getOnboardingState,
  getQrImage,
  getQrPng,
  qrDownloadPath,
  startMerchantAuth,
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

type FieldErrors = Record<string, string | undefined>;

const steps = [
  { label: "Cuenta" },
  { label: "Negocio" },
  { label: "Programa" },
];

const currencySymbols: Record<string, string> = {
  ARS: "AR$",
  BRL: "R$",
  CLP: "CL$",
  COP: "CO$",
  USD: "US$",
  MXN: "MX$",
  PEN: "S/",
  PYG: "₲",
  UYU: "$U",
};

function currencyDescription(currencyCode: string) {
  return `Moneda: ${currencySymbols[currencyCode] ?? currencyCode}`;
}

function parseDecimal(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function formatMoney(value: number, currencyCode: string | null) {
  const amount = new Intl.NumberFormat("es", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  if (!currencyCode) return amount;
  return `${currencySymbols[currencyCode] ?? currencyCode} ${amount}`;
}

const gateCodes = new Set<OwnerGateErrorCode>([
  "unauthorized",
  "not_owner",
  "email_not_verified",
  "business_suspended",
  "business_closed",
]);

function gateCode(error: WizardApiError | null) {
  return error?.code && gateCodes.has(error.code as OwnerGateErrorCode)
    ? (error.code as OwnerGateErrorCode)
    : null;
}

export function OnboardingWizard() {
  const [stage, setStage] = useState<Stage>("loading");
  const [prefill, setPrefill] = useState<OnboardingPrefill | null>(null);
  const [business, setBusiness] = useState<BusinessSummary | null>(null);
  const [program, setProgram] = useState<ProgramSummary | null>(null);
  const [currencyCode, setCurrencyCode] = useState<string | null>(null);
  const [error, setError] = useState<WizardApiError | null>(null);
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
    setStage("account");
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
            {error?.message ?? "Revisá tu conexión y volvé a intentarlo."}
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
          onNewAccount={async () => {
            await loadPrefill();
            setStage("business");
          }}
          onMagicLink={() => setStage("magic-link")}
        />
      )}
      {stage === "magic-link" && (
        <MagicLinkState onUseAnotherEmail={resetToAccount} />
      )}
      {stage === "business" && prefill && (
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
      )}
      {stage === "program" && (
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
      )}
      {stage === "complete" && business && program && (
        <CompleteStep business={business} onGateError={setError} />
      )}
    </WizardShell>
  );
}

function WizardShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-svh bg-canvas px-4 py-6 text-content sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-[var(--content-form)]">
        {children}
      </div>
    </main>
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

function StepHeader({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <header className="mb-8 grid gap-5">
      <ProgressIndicator currentStep={step} steps={steps} />
      <div>
        <p className="mb-2 text-sm font-bold text-primary">CheckPass Club</p>
        <h1
          id="wizard-heading"
          tabIndex={-1}
          className="text-2xl font-bold leading-tight outline-none sm:text-3xl"
        >
          {title}
        </h1>
        <p className="mt-2 leading-6 text-content-muted">{description}</p>
      </div>
    </header>
  );
}

function InlineApiError({ error }: { error: WizardApiError | null }) {
  if (!error) return null;
  return (
    <Alert kind="error" title="No pudimos continuar">
      {error.message}
    </Alert>
  );
}

function AccountStep({
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

function MagicLinkState({
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

function BusinessStep({
  prefill,
  apiError,
  onError,
  onComplete,
  onAlreadyExists,
}: {
  prefill: OnboardingPrefill;
  apiError: WizardApiError | null;
  onError: (error: WizardApiError | null) => void;
  onComplete: (business: BusinessSummary, currencyCode: string) => void;
  onAlreadyExists: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [country, setCountry] = useState(
    prefill.suggestedCountryCode ?? prefill.countries[0]?.code ?? "",
  );
  const [address, setAddress] = useState<SelectedAddress | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectAddress = useCallback((value: SelectedAddress | null) => {
    setAddress(value);
    if (value) setErrors((current) => ({ ...current, address: undefined }));
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    if (!name.trim()) nextErrors.name = "Escribí el nombre de tu negocio.";
    if (!category) nextErrors.category = "Seleccioná una categoría.";
    if (!country) nextErrors.country = "Seleccioná un país.";
    if (!address) nextErrors.address = "Elegí una dirección de la lista.";
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean) || !category || !address)
      return;

    setIsSubmitting(true);
    onError(null);
    try {
      const created = await createBusiness({
        name: name.trim(),
        categoryGcid: category,
        countryCode: country,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locationName: "Principal",
        address,
      });
      const selectedCountry = prefill.countries.find(
        (item) => item.code === country,
      );
      onComplete(created, selectedCountry?.currencyCode ?? "USD");
    } catch (caught) {
      const requestError =
        caught instanceof WizardApiError
          ? caught
          : new WizardApiError("No pudimos guardar tu negocio.", 503);
      if (requestError.status === 409) onAlreadyExists();
      else onError(requestError);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <StepHeader
        step={2}
        title="Contanos sobre tu negocio"
        description="Usamos estos datos para crear tu comercio y su primer local. Podés cambiarlos después."
      />
      <Form onSubmit={submit} className="grid gap-5">
        <InlineApiError error={apiError} />
        <TextField
          label="Nombre del negocio"
          name="businessName"
          placeholder="Ej.: Café del Barrio"
          value={name}
          onChange={setName}
          autoComplete="organization"
          isRequired
          isInvalid={Boolean(errors.name)}
          errorMessage={errors.name}
          description="El identificador público se generará automáticamente."
        />
        <SelectField
          label="Categoría"
          selectedKey={category}
          onSelectionChange={(key) => {
            if (key !== null) setCategory(String(key));
            setErrors((current) => ({ ...current, category: undefined }));
          }}
          options={prefill.categories.map((item) => ({
            id: item.gcid,
            label: item.displayName,
          }))}
          placeholder="Elegí la categoría"
          isRequired
          isInvalid={Boolean(errors.category)}
          errorMessage={errors.category}
        />
        <SelectField
          label="País"
          selectedKey={country}
          onSelectionChange={(key) => {
            if (key !== null) setCountry(String(key));
            setErrors((current) => ({ ...current, country: undefined }));
          }}
          options={prefill.countries.map((item) => ({
            id: item.code,
            label: item.name,
            description: currencyDescription(item.currencyCode),
          }))}
          placeholder="Elegí el país"
          isRequired
          isInvalid={Boolean(errors.country)}
          errorMessage={errors.country}
        />
        <AddressCombobox
          countryCode={country}
          bias={prefill.bias}
          onSelect={selectAddress}
          errorMessage={errors.address}
        />
        <Button type="submit" fullWidth isLoading={isSubmitting}>
          {isSubmitting ? "Guardando negocio…" : "Crear negocio y continuar"}
        </Button>
      </Form>
    </>
  );
}

function ProgramStep({
  business,
  currencyCode,
  apiError,
  onError,
  onComplete,
}: {
  business: BusinessSummary | null;
  currencyCode: string | null;
  apiError: WizardApiError | null;
  onError: (error: WizardApiError | null) => void;
  onComplete: (program: ProgramSummary) => void;
}) {
  const [target, setTarget] = useState(8);
  const [reward, setReward] = useState("");
  const [rewardCost, setRewardCost] = useState("");
  const [purchaseValue, setPurchaseValue] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const parsedRewardCost = parseDecimal(rewardCost);
  const parsedPurchaseValue = parseDecimal(purchaseValue);
  const estimatedRevenue =
    parsedPurchaseValue !== null && parsedPurchaseValue > 0
      ? parsedPurchaseValue * target
      : null;
  const revenueAfterReward =
    estimatedRevenue !== null && parsedRewardCost !== null
      ? estimatedRevenue - parsedRewardCost
      : null;
  const rewardShare =
    estimatedRevenue !== null &&
    estimatedRevenue > 0 &&
    parsedRewardCost !== null
      ? (parsedRewardCost / estimatedRevenue) * 100
      : null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    if (!Number.isInteger(target) || target < 2 || target > 50) {
      nextErrors.target = "Elegí un número entero entre 2 y 50.";
    }
    if (!reward.trim())
      nextErrors.reward = "Escribí el premio que recibirá el cliente.";
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setIsSubmitting(true);
    onError(null);
    try {
      onComplete(await createProgram(target, reward));
    } catch (caught) {
      onError(
        caught instanceof WizardApiError
          ? caught
          : new WizardApiError("No pudimos crear tu programa.", 503),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <StepHeader
        step={3}
        title="Creá tu programa de sellos"
        description={`Un sello por compra en ${business?.name ?? "tu negocio"}. Solo falta elegir la meta y el premio.`}
      />
      <Form onSubmit={submit} className="grid gap-5">
        <InlineApiError error={apiError} />
        <NumberField
          label="Sellos para ganar"
          description="Podés elegir entre 2 y 50. Recomendamos una meta fácil de entender."
          minValue={2}
          maxValue={50}
          value={target}
          onChange={setTarget}
          isRequired
          isInvalid={Boolean(errors.target)}
          errorMessage={errors.target}
        />
        <TextField
          label="Premio"
          name="reward"
          value={reward}
          onChange={setReward}
          placeholder="Por ejemplo: Café gratis"
          isRequired
          isInvalid={Boolean(errors.reward)}
          errorMessage={errors.reward}
        />
        <section
          aria-labelledby="program-impact-title"
          className="grid gap-4 rounded-lg border border-border bg-surface-subtle p-4 sm:p-5"
        >
          <div>
            <h2 id="program-impact-title" className="text-lg font-bold">
              Calculá el impacto del premio
            </h2>
            <p className="mt-1 text-sm leading-5 text-content-muted">
              Es una estimación opcional. No modifica las reglas del programa.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Costo unitario del premio"
              name="rewardCost"
              value={rewardCost}
              onChange={setRewardCost}
              inputMode="decimal"
              autoComplete="off"
              placeholder="Ej.: 0,50"
            />
            <TextField
              label="Valor promedio por compra"
              name="purchaseValue"
              value={purchaseValue}
              onChange={setPurchaseValue}
              inputMode="decimal"
              autoComplete="off"
              placeholder="Ej.: 2,00"
            />
          </div>
          {estimatedRevenue !== null && parsedRewardCost !== null && (
            <div className="grid gap-3" aria-live="polite">
              <div className="grid gap-3 sm:grid-cols-2">
                <ImpactValue
                  label="Gasto para alcanzar la meta"
                  value={formatMoney(estimatedRevenue, currencyCode)}
                />
                <ImpactValue
                  label="Facturación menos premio"
                  value={formatMoney(revenueAfterReward ?? 0, currencyCode)}
                />
              </div>
              {rewardShare !== null && (
                <div className="rounded-md bg-accent p-3 text-sm font-bold leading-5 text-on-accent">
                  El premio equivale al {rewardShare.toFixed(1)}% de la
                  facturación estimada de cada ciclo de {target} sellos.
                </div>
              )}
            </div>
          )}
        </section>
        <div className="rounded-md bg-primary-soft p-4 text-sm leading-5 text-content">
          CheckPass configura automáticamente las reglas, un sello por compra y
          el sello visual inicial.
        </div>
        <Button type="submit" fullWidth isLoading={isSubmitting}>
          {isSubmitting ? "Activando programa…" : "Activar programa"}
        </Button>
      </Form>
    </>
  );
}

function ImpactValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-primary p-4 text-on-primary shadow-sm">
      <span className="block text-sm font-semibold leading-5 text-on-primary">
        {label}
      </span>
      <span className="mt-1 block text-xl font-bold text-on-primary">
        {value}
      </span>
    </div>
  );
}

function CompleteStep({
  business,
  onGateError,
}: {
  business: BusinessSummary;
  onGateError: (error: WizardApiError) => void;
}) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [error, setError] = useState<WizardApiError | null>(null);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [showWhatsappFallback, setShowWhatsappFallback] = useState(false);

  const loadQr = useCallback(async () => {
    setError(null);
    setVerificationRequired(false);
    try {
      const blob = await getQrImage();
      setQrUrl(URL.createObjectURL(blob));
    } catch (caught) {
      const requestError =
        caught instanceof WizardApiError
          ? caught
          : new WizardApiError("No pudimos preparar tu QR.", 503);
      if (requestError.code === "email_not_verified") {
        setVerificationRequired(true);
      } else if (gateCode(requestError)) {
        onGateError(requestError);
      } else {
        setError(requestError);
      }
    }
  }, [onGateError]);

  useEffect(() => {
    void loadQr();
  }, [loadQr]);

  useEffect(
    () => () => {
      if (qrUrl) URL.revokeObjectURL(qrUrl);
    },
    [qrUrl],
  );

  const heading = verificationRequired
    ? "Verificá tu email para obtener el QR"
    : qrUrl
      ? "Tu QR está listo"
      : "Preparando tu QR";

  async function shareQr() {
    setIsSharing(true);
    setShareMessage(null);
    setShowWhatsappFallback(false);
    try {
      const blob = await getQrPng();
      const file = new File([blob], `qr-${business.slug}.png`, {
        type: "image/png",
      });
      if (
        navigator.share &&
        (!navigator.canShare || navigator.canShare({ files: [file] }))
      ) {
        await navigator.share({
          title: `QR de ${business.name}`,
          text: `QR para sumarse al programa de ${business.name}.`,
          files: [file],
        });
        setShareMessage("QR compartido.");
        return;
      }

      downloadBlob(blob, file.name);
      setShowWhatsappFallback(true);
      setShareMessage(
        "Descargamos el QR. Abrí WhatsApp y adjuntalo al mensaje.",
      );
    } catch (caught) {
      if ((caught as { name?: string }).name !== "AbortError") {
        setShareMessage("No pudimos compartir el QR. Probá descargarlo.");
      }
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <section className="text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-full bg-success-soft text-success">
        <CheckCircle className="size-8" aria-hidden="true" />
      </div>
      <p className="mt-5 text-sm font-bold text-primary">Programa activo</p>
      <h1
        id="wizard-heading"
        tabIndex={-1}
        className="mt-2 text-3xl font-bold leading-tight outline-none"
      >
        {heading}
      </h1>
      <p className="mx-auto mt-3 max-w-md leading-6 text-content-muted">
        {verificationRequired
          ? "Tu programa ya está activo. Falta confirmar tu email para habilitar el QR."
          : `Mostralo en ${business.name} para que tus clientes se sumen al programa.`}
      </p>
      {verificationRequired ? (
        <div className="mt-7 grid gap-3 text-left">
          <ApiError
            code="email_not_verified"
            onEmailVerified={() => void loadQr()}
          />
          <Button variant="quiet" onPress={() => void loadQr()} fullWidth>
            Ya verifiqué mi email
          </Button>
        </div>
      ) : (
        <div className="mx-auto mt-7 grid aspect-square w-full max-w-72 place-items-center rounded-lg border border-border bg-surface p-5 shadow-sm">
          {qrUrl ? (
            // The blob is returned by the contracted same-origin QR endpoint.
            <img
              src={qrUrl}
              alt={`QR de enrolamiento de ${business.name}`}
              className="size-full"
            />
          ) : error ? (
            <div className="grid gap-3 text-center">
              <QrCode
                className="mx-auto size-10 text-content-muted"
                aria-hidden="true"
              />
              <p className="text-sm text-danger">{error.message}</p>
            </div>
          ) : (
            <p role="status" className="text-sm text-content-muted">
              Generando QR…
            </p>
          )}
        </div>
      )}
      {qrUrl && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href={qrDownloadPath}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 font-bold text-on-primary outline-none transition-colors data-hovered:bg-primary-hover data-pressed:bg-primary-pressed data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-focus"
          >
            <Download className="size-5" aria-hidden="true" />
            Descargar PNG
          </Link>
          <Button
            variant="secondary"
            fullWidth
            isLoading={isSharing}
            onPress={() => void shareQr()}
          >
            <Whatsapp className="size-5" aria-hidden="true" />
            {isSharing ? "Preparando…" : "Compartir QR"}
          </Button>
        </div>
      )}
      {shareMessage && (
        <p role="status" className="mt-3 text-sm text-content-muted">
          {shareMessage}
        </p>
      )}
      {showWhatsappFallback && (
        <Link
          href={`https://wa.me/?text=${encodeURIComponent(`Te envío el QR del programa de ${business.name}. Adjuntá el PNG que acaba de descargarse.`)}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 font-bold text-primary outline-none data-hovered:bg-primary-soft data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-focus"
        >
          <Whatsapp className="size-5" aria-hidden="true" />
          Abrir WhatsApp
        </Link>
      )}
      <p className="mt-5 text-sm text-content-muted">
        Identificador público:{" "}
        <strong className="text-content">@{business.slug}</strong>
      </p>
      <div className="mt-8 rounded-lg border border-border bg-surface-subtle p-5 text-left">
        <h2 className="text-lg font-bold text-content">Tu cuenta está lista</h2>
        <p className="mt-2 text-sm leading-5 text-content-muted">
          Desde tu cuenta podrás acceder a funciones avanzadas para personalizar
          tu marca, tu programa y mucho más.
        </p>
        <Button fullWidth isDisabled className="mt-4">
          Ir a mi cuenta
        </Button>
        <p className="mt-2 text-center text-xs text-content-muted">
          Disponible próximamente.
        </p>
      </div>
    </section>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
