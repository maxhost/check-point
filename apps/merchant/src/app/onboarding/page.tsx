"use client";

import { Eye, EyeClosed } from "iconoir-react";
import { useState } from "react";
import {
  AddressAutofillField,
  type SelectedAddress,
} from "../components/address-autofill";
import { Toast } from "../components/ui";
import { merchantAuthClient } from "../../lib/auth-client";

type Step = "owner" | "plan" | "business";
type Plan = "free" | "plus-month" | "plus-year";
type Notice = { kind: "success" | "warning" | "error"; text: string } | null;

const steps: Step[] = ["owner", "plan", "business"];

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("owner");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [plan, setPlan] = useState<Plan>("free");
  const [businessName, setBusinessName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [address, setAddress] = useState<SelectedAddress | null>(null);
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
    setStep("plan");
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
      body: JSON.stringify({ name: businessName, locationName, address }),
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
    if (plan === "free") {
      window.location.assign("/backoffice?toast=ready");
      return;
    }
    const checkout = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        businessId: payload.businessId,
        interval: plan === "plus-year" ? "year" : "month",
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
              <h1>Crea tu cuenta de negocio</h1>
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
                {submitting ? "Creando cuenta…" : "Continuar al plan"}
              </button>
            </>
          )}
          {step === "plan" && (
            <>
              <h1>Elige tu plan</h1>
              <p>
                Free te permite crear un negocio, un local y tu programa de
                fidelización.
              </p>
              <PlanOption
                value="free"
                selected={plan}
                onChange={setPlan}
                title="Free · USD 0"
                text="1 local y programa de fidelización."
              />
              <PlanOption
                value="plus-month"
                selected={plan}
                onChange={setPlan}
                title="Plus · USD 20/mes"
                text="Campañas y herramientas avanzadas."
              />
              <PlanOption
                value="plus-year"
                selected={plan}
                onChange={setPlan}
                title="Plus · USD 200/año"
                text="Ahorra USD 40 por año."
              />
              <button className="button" onClick={() => setStep("business")}>
                Continuar
              </button>
            </>
          )}
          {step === "business" && (
            <>
              <h1>Configura tu negocio</h1>
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
                Nombre del primer local
                <input
                  value={locationName}
                  onChange={(event) => setLocationName(event.target.value)}
                />
              </label>
              <label>Dirección del local</label>
              <AddressAutofillField
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
                {submitting
                  ? "Guardando…"
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
