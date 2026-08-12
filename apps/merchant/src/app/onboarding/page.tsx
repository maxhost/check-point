"use client";

import { Eye, EyeClosed } from "iconoir-react";
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

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("owner");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [plan, setPlan] = useState<Plan>("free");
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("month");
  const [businessName, setBusinessName] = useState("");
  const [countryCode, setCountryCode] = useState("EC");
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
    const response = await fetch("/api/onboarding/business", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: businessName,
        countryCode,
        locationName,
        address,
      }),
    });
    const payload = (await response.json()) as {
      businessId?: string;
      error?: string;
    };
    if (!response.ok || !payload.businessId) {
      setSubmitting(false);
      setNotice({
        kind: "error",
        text: payload.error ?? "No pudimos guardar tu negocio.",
      });
      return;
    }
    setBusinessId(payload.businessId);
    setSubmitting(false);
    setStep("plan");
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
        <div className="brand">Mi Pasaporte · Negocios</div>
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
            <>
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
              <button
                className="button"
                disabled={submitting}
                onClick={createAccount}
              >
                {submitting ? "Creando cuenta…" : "Continuar"}
              </button>
            </>
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
                    setCountryCode(event.target.value);
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
                Nombre del primer local
                <input
                  value={locationName}
                  onChange={(event) => setLocationName(event.target.value)}
                />
              </label>
              <label>Ubicación del local</label>
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
                {submitting ? "Guardando…" : "Continuar al plan"}
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
              <PlanOption
                value="free"
                selected={plan}
                onChange={setPlan}
                title="Free · USD 0"
                text="1 local y programa de fidelización."
              />
              <PlanOption
                value="plus"
                selected={plan}
                onChange={setPlan}
                title={
                  billingInterval === "year"
                    ? "Plus · USD 200/año"
                    : "Plus · USD 20/mes"
                }
                text={
                  billingInterval === "year"
                    ? "Ahorra USD 40 por año."
                    : "Campañas y herramientas avanzadas."
                }
              />
              <fieldset className="billing-cycle" disabled={plan !== "plus"}>
                <legend>Facturación de Plus</legend>
                <button
                  type="button"
                  className={billingInterval === "month" ? "active" : ""}
                  aria-pressed={billingInterval === "month"}
                  onClick={() => setBillingInterval("month")}
                >
                  Mensual · USD 20
                </button>
                <button
                  type="button"
                  className={billingInterval === "year" ? "active" : ""}
                  aria-pressed={billingInterval === "year"}
                  onClick={() => setBillingInterval("year")}
                >
                  Anual · USD 200
                </button>
              </fieldset>
              <button
                className="button"
                disabled={submitting}
                onClick={continueWithPlan}
              >
                {submitting
                  ? "Abriendo Stripe…"
                  : plan === "free"
                    ? "Abrir mi Backoffice"
                    : "Continuar a Stripe"}
              </button>
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

function PlanOption({
  value,
  selected,
  onChange,
  title,
  text,
}: {
  value: Plan;
  selected: Plan;
  onChange: (plan: Plan) => void;
  title: string;
  text: string;
}) {
  return (
    <button
      className={`plan ${selected === value ? "selected" : ""}`}
      onClick={() => onChange(value)}
    >
      <strong>{title}</strong>
      <span>{text}</span>
    </button>
  );
}
