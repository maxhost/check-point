"use client";

import { Eye, EyeClosed, NavArrowLeft, NavArrowRight } from "iconoir-react";
import { useState } from "react";
import {
  AddressAutofillField,
  type SelectedAddress,
} from "../components/address-autofill";
import { Toast } from "../components/ui";
import { merchantAuthClient } from "../../lib/auth-client";

type Step = "owner" | "business" | "plan";
type Plan = "free" | "plus";
type BillingInterval = "month" | "year";
type Notice = { kind: "success" | "warning" | "error"; text: string } | null;

const steps: Step[] = ["owner", "business", "plan"];
const countries = [
  ["AR", "Argentina"],
  ["BR", "Brasil"],
  ["CL", "Chile"],
  ["CO", "Colombia"],
  ["EC", "Ecuador"],
  ["UY", "Uruguay"],
  ["PY", "Paraguay"],
  ["PE", "Perú"],
] as const;
const timezones = [
  "America/Argentina/Buenos_Aires",
  "America/Argentina/Bariloche",
  "America/Sao_Paulo",
  "America/Santiago",
  "America/Bogota",
  "America/Guayaquil",
  "Pacific/Galapagos",
  "America/Montevideo",
  "America/Asuncion",
  "America/Lima",
] as const;
const defaultTimezoneByCountry: Record<string, (typeof timezones)[number]> = {
  AR: "America/Argentina/Buenos_Aires",
  BR: "America/Sao_Paulo",
  CL: "America/Santiago",
  CO: "America/Bogota",
  EC: "America/Guayaquil",
  UY: "America/Montevideo",
  PY: "America/Asuncion",
  PE: "America/Lima",
};

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("owner");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [plan, setPlan] = useState<Plan>("plus");
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("month");
  const [businessName, setBusinessName] = useState("");
  const [countryCode, setCountryCode] = useState("EC");
  const [timezone, setTimezone] = useState("America/Guayaquil");
  const [locationName, setLocationName] = useState("");
  const [address, setAddress] = useState<SelectedAddress | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [submitting, setSubmitting] = useState(false);

  async function createAccount() {
    if (!fullName.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
      setNotice({ kind: "error", text: "Completa nombre y un email válido." });
      return;
    }
    if (password.length < 8 || password !== confirmPassword) {
      setNotice({
        kind: "error",
        text: "La contraseña debe tener al menos 8 caracteres y coincidir.",
      });
      return;
    }
    setSubmitting(true);
    const result = await merchantAuthClient.signUp.email({
      name: fullName.trim(),
      email,
      password,
    });
    setSubmitting(false);
    if (result.error) {
      setNotice({
        kind: "error",
        text: result.error.message ?? "No pudimos crear tu cuenta.",
      });
      return;
    }
    setStep("business");
  }

  async function createBusiness() {
    if (!businessName.trim() || !locationName.trim() || !address) {
      setNotice({
        kind: "error",
        text: "Completa el negocio, el local y selecciona una dirección válida.",
      });
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/onboarding/business", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: businessName,
          countryCode,
          timezone,
          locationName,
          address,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        businessId?: string;
        error?: string;
      } | null;
      if (!response.ok || !payload?.businessId) {
        setNotice({
          kind: "error",
          text: payload?.error ?? "No pudimos guardar tu negocio.",
        });
        return;
      }
      setBusinessId(payload.businessId);
      setStep("plan");
    } catch {
      setSubmitting(false);
      setNotice({
        kind: "error",
        text: "No pudimos conectar para guardar tu negocio. Intenta otra vez.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function continueWithPlan() {
    if (!businessId) {
      setNotice({
        kind: "error",
        text: "Primero necesitamos guardar los datos de tu negocio.",
      });
      setStep("business");
      return;
    }
    if (plan === "free") {
      window.location.assign("/backoffice?toast=ready");
      return;
    }
    setSubmitting(true);
    const checkout = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        businessId,
        interval: billingInterval,
      }),
    });
    const checkoutPayload = (await checkout.json()) as {
      url?: string;
      error?: string;
    };
    setSubmitting(false);
    if (!checkout.ok || !checkoutPayload.url) {
      setNotice({
        kind: "error",
        text: checkoutPayload.error ?? "No pudimos abrir Stripe Checkout.",
      });
      return;
    }
    window.location.assign(checkoutPayload.url);
  }

  const current = steps.indexOf(step);
  return (
    <main className="merchant-shell">
      <div className="wizard">
        <div className="brand">CheckPass Club · Negocios</div>
        <div className="progress" aria-label="Progreso">
          {steps.map((item, index) => (
            <i className={index <= current ? "active" : ""} key={item} />
          ))}
        </div>
        <Toast
          message={notice?.text ?? null}
          kind={notice?.kind}
          onDismiss={() => setNotice(null)}
        />
        <section className="panel">
          {step === "owner" && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void createAccount();
              }}
            >
              <h1>Tus datos como owner</h1>
              <p>
                Estos datos son tuyos como owner. Podrás crear tu negocio
                después.
              </p>
              <label>
                Nombre completo
                <input
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <PasswordField
                label="Contraseña"
                value={password}
                show={showPassword}
                onShow={setShowPassword}
                onChange={setPassword}
              />
              <PasswordField
                label="Confirmar contraseña"
                value={confirmPassword}
                show={showPassword}
                onShow={setShowPassword}
                onChange={setConfirmPassword}
              />
              <button type="submit" className="button" disabled={submitting}>
                {submitting ? "Creando cuenta…" : "Continuar"}
              </button>
            </form>
          )}
          {step === "business" && (
            <>
              <h1>Tu negocio y primer local</h1>
              <p>
                El logo es opcional y podrás añadirlo cuando R2 esté
                configurado.
              </p>
              <label>
                Nombre del negocio
                <input
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                />
              </label>
              <label>
                País
                <select
                  value={countryCode}
                  onChange={(event) => {
                    const nextCountry = event.target.value;
                    setCountryCode(nextCountry);
                    setTimezone(defaultTimezoneByCountry[nextCountry]);
                    setAddress(null);
                  }}
                >
                  {countries.map(([code, country]) => (
                    <option key={code} value={code}>
                      {country}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Zona horaria del negocio
                <select
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                >
                  {timezones.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Nombre del primer local
                <input
                  value={locationName}
                  onChange={(event) => setLocationName(event.target.value)}
                />
              </label>
              <label>Dirección del local</label>
              <AddressAutofillField
                countryCode={countryCode}
                onSelect={(selected) => {
                  setAddress(selected);
                  setNotice({ kind: "success", text: "Dirección verificada." });
                }}
              />
              {address && <p className="selected-address">✓ {address.label}</p>}
              <button
                className="button"
                disabled={submitting}
                onClick={createBusiness}
              >
                {submitting ? "Guardando…" : "Continuar"}
              </button>
            </>
          )}
          {step === "plan" && (
            <>
              <h1>Elige tu plan</h1>
              <p>
                Podrás cambiarlo más adelante. Plus activa campañas y
                herramientas avanzadas.
              </p>
              <div className="plan-carousel" aria-label="Selector de planes">
                <div className="plan-carousel-controls">
                  <button
                    className="plan-carousel-arrow"
                    type="button"
                    disabled={plan === "free"}
                    onClick={() => setPlan("free")}
                    aria-label="Ver plan Free"
                  >
                    <NavArrowLeft aria-hidden="true" />
                  </button>
                  <button
                    className="plan-carousel-arrow"
                    type="button"
                    disabled={plan === "plus"}
                    onClick={() => setPlan("plus")}
                    aria-label="Ver plan Plus"
                  >
                    <NavArrowRight aria-hidden="true" />
                  </button>
                </div>
                <PlanCard
                  plan={plan}
                  billingInterval={billingInterval}
                  onBillingInterval={setBillingInterval}
                  onContinue={continueWithPlan}
                  submitting={submitting}
                />
              </div>
              <p className="plan-carousel-status" aria-live="polite">
                Plan {plan === "plus" ? "Plus" : "Free"} ·{" "}
                {plan === "plus" ? "2" : "1"} de 2
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function PasswordField({
  label,
  value,
  show,
  onShow,
  onChange,
}: {
  label: string;
  value: string;
  show: boolean;
  onShow: (value: boolean) => void;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <span className="password-field">
        <input
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          onClick={() => onShow(!show)}
          aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {show ? <EyeClosed aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      </span>
    </label>
  );
}

function PlanCard({
  plan,
  billingInterval,
  onBillingInterval,
  onContinue,
  submitting,
}: {
  plan: Plan;
  billingInterval: BillingInterval;
  onBillingInterval: (interval: BillingInterval) => void;
  onContinue: () => void;
  submitting: boolean;
}) {
  const isPlus = plan === "plus";
  return (
    <article
      className="plan-card"
      aria-label={`Plan ${isPlus ? "Plus" : "Free"}`}
    >
      <p className="plan-card-eyebrow">
        {isPlus ? "Para hacer crecer tu negocio" : "Para empezar"}
      </p>
      <h2>{isPlus ? "Plus" : "Free"}</h2>
      <p className="plan-card-price">
        {isPlus ? (billingInterval === "year" ? "USD 200" : "USD 20") : "USD 0"}
        {isPlus && (
          <small> / {billingInterval === "year" ? "año" : "mes"}</small>
        )}
      </p>
      {isPlus ? (
        <>
          <div className="billing-toggle" aria-label="Período de facturación">
            <button
              type="button"
              className={billingInterval === "month" ? "active" : ""}
              aria-pressed={billingInterval === "month"}
              onClick={() => onBillingInterval("month")}
            >
              Mensual
            </button>
            <button
              type="button"
              className={billingInterval === "year" ? "active" : ""}
              aria-pressed={billingInterval === "year"}
              onClick={() => onBillingInterval("year")}
            >
              Anual <span>Ahorra USD 40</span>
            </button>
          </div>
          <ul className="plan-card-features">
            <li>Todo lo incluido en Free</li>
            <li>Campañas y beneficios avanzados</li>
            <li>Analíticas para hacer crecer el negocio</li>
          </ul>
        </>
      ) : (
        <ul className="plan-card-features">
          <li>1 local</li>
          <li>Programa de fidelización</li>
          <li>Analíticas básicas</li>
        </ul>
      )}
      <button className="button" disabled={submitting} onClick={onContinue}>
        {submitting
          ? "Abriendo Stripe…"
          : isPlus
            ? "Continuar a Stripe"
            : "Abrir mi Backoffice"}
      </button>
    </article>
  );
}
