"use client";

import { useState } from "react";
import {
  COUNTRIES,
  composeE164,
  dialByIso,
  flagEmoji,
  isValidCountryIso,
} from "../../../../lib/countries";
import { readableTextColor } from "../../../../lib/brand-color";
import { WalletButtons } from "../../wallet-cta";
import { isIosSafariBrowser } from "../../ios-install-hint";
import { PushPrompt } from "../../push-prompt";

type Screen =
  | { kind: "form" }
  | { kind: "done"; firstName: string }
  | { kind: "already_member" }
  | { kind: "unavailable" };

const label: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  color: "#444",
  marginBottom: 4,
  marginTop: 14,
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  fontSize: 16,
  border: "1px solid #ccc",
  borderRadius: 10,
  boxSizing: "border-box",
};

export function EnrollForm({
  programId,
  loc,
  businessName,
  defaultCountryIso,
  brandPrimaryColor,
  vapidPublicKey,
}: {
  programId: string;
  /** Origin local from the poster QR `?loc=` (ADR 0042); null for a global QR. */
  loc: string | null;
  businessName: string;
  defaultCountryIso: string;
  brandPrimaryColor: string;
  vapidPublicKey: string | null;
}) {
  const initialIso = isValidCountryIso(defaultCountryIso)
    ? defaultCountryIso
    : "EC";
  const [screen, setScreen] = useState<Screen>({ kind: "form" });
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [countryIso, setCountryIso] = useState(initialIso);
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setToast(null);
    try {
      const phoneE164 = composeE164(dialByIso(countryIso) ?? "", phone);
      const res = await fetch(`/api/public/enroll/${programId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          phoneE164,
          countryIso,
          ...(loc ? { loc } : {}),
        }),
      });
      if (res.status === 201) {
        setScreen({ kind: "done", firstName: firstName.trim() });
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
      };
      if (res.status === 409 && data.code === "already_member") {
        setScreen({ kind: "already_member" });
        return;
      }
      if (res.status === 404) {
        setScreen({ kind: "unavailable" });
        return;
      }
      setToast(data.error ?? "No pudimos completar el registro.");
    } catch {
      setToast("Hubo un problema de conexión. Intentá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (screen.kind === "done") {
    // Client-side detection selects the Wallet platform available on this device.
    const isIos =
      typeof navigator !== "undefined" &&
      /iphone|ipad|ipod/i.test(navigator.userAgent);
    return (
      <section>
        <h2 style={{ fontSize: 20 }}>¡Listo, {screen.firstName}! 🎉</h2>
        <p style={{ color: "#333", marginTop: 8 }}>
          Ya sos parte del programa de <strong>{businessName}</strong>.
        </p>
        {/* Spec 0050: installing from HERE made iOS take the enroll URL as the icon's
            start_url (this page links no manifest), so the icon reopened the signup form.
            The action now sends the consumer to `/wallet` (the POST already set the
            session cookie): there the hint lives and the manifest carries the token. */}
        <a
          href="/wallet"
          style={{
            display: "block",
            textAlign: "center",
            marginTop: 20,
            padding: "13px 14px",
            fontSize: 16,
            borderRadius: 10,
            background: brandPrimaryColor,
            color: readableTextColor(brandPrimaryColor),
            textDecoration: "none",
          }}
        >
          Ver mi tarjeta y código QR
        </a>
        {/* Web Push opt-in for Android/desktop (spec 0038), renders nothing when Web Push
            is off. iOS Safari short-circuits: `PushPrompt` would render back the hint. */}
        {isIosSafariBrowser() ? null : (
          <PushPrompt
            vapidPublicKey={vapidPublicKey}
            accentColor={brandPrimaryColor}
          />
        )}
        {/* The buttons hit the session-authorized endpoint directly. */}
        <div style={{ marginTop: 20 }}>
          <WalletButtons isIos={isIos} />
        </div>
      </section>
    );
  }

  if (screen.kind === "already_member") {
    return (
      <section>
        <h2 style={{ fontSize: 20 }}>Ya formás parte de este programa</h2>
        <p style={{ color: "#333", marginTop: 8 }}>
          Este teléfono ya está registrado en el programa de{" "}
          <strong>{businessName}</strong>.
        </p>
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem(
              "checkpass_recovery_input",
              JSON.stringify({ phone, countryIso }),
            );
            window.location.assign("/recover");
          }}
          style={{
            marginTop: 16,
            width: "100%",
            padding: "12px 14px",
            fontSize: 16,
            borderRadius: 10,
            border: "1px solid #ccc",
            background: brandPrimaryColor,
            color: readableTextColor(brandPrimaryColor),
            cursor: "pointer",
          }}
        >
          Recuperar mi tarjeta
        </button>
      </section>
    );
  }

  if (screen.kind === "unavailable") {
    return (
      <section>
        <h2 style={{ fontSize: 20 }}>Este programa no está disponible</h2>
        <p style={{ color: "#555", marginTop: 8 }}>
          Pedile al local un enlace actualizado para registrarte.
        </p>
      </section>
    );
  }

  return (
    <section>
      <p style={{ color: "#555", marginTop: 8, marginBottom: 24 }}>
        Sumate al programa de fidelidad. Solo necesitamos tu nombre y tu
        teléfono.
      </p>
      <form onSubmit={onSubmit}>
        <label style={label} htmlFor="firstName">
          Nombre
        </label>
        <input
          id="firstName"
          style={inputStyle}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          autoComplete="given-name"
          required
        />
        <label style={label} htmlFor="lastName">
          Apellido
        </label>
        <input
          id="lastName"
          style={inputStyle}
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          autoComplete="family-name"
          required
        />
        <label style={label} htmlFor="country">
          País
        </label>
        <select
          id="country"
          style={inputStyle}
          value={countryIso}
          onChange={(e) => setCountryIso(e.target.value)}
          required
        >
          {COUNTRIES.map((c) => (
            <option key={c.iso2} value={c.iso2}>
              {flagEmoji(c.iso2)} {c.name} (+{c.dial})
            </option>
          ))}
        </select>
        <label style={label} htmlFor="phone">
          Teléfono
        </label>
        <input
          id="phone"
          style={inputStyle}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="987654321"
          required
        />
        <p style={{ fontSize: 13, color: "#666", marginTop: 6 }}>
          Guardá tu teléfono: lo vas a necesitar para recuperar tu tarjeta si
          cambiás o perdés este dispositivo.
        </p>
        {toast ? (
          <p
            role="alert"
            style={{
              marginTop: 12,
              padding: "10px 12px",
              background: "#fdecea",
              border: "1px solid #f5c6cb",
              borderRadius: 10,
              color: "#a1352c",
              fontSize: 14,
            }}
          >
            {toast}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          style={{
            marginTop: 20,
            width: "100%",
            padding: "13px 14px",
            fontSize: 16,
            borderRadius: 10,
            border: "none",
            background: brandPrimaryColor,
            color: readableTextColor(brandPrimaryColor),
            opacity: submitting ? 0.6 : 1,
            cursor: submitting ? "default" : "pointer",
          }}
        >
          {submitting ? "Registrando…" : "Sumarme al programa"}
        </button>
      </form>
    </section>
  );
}
