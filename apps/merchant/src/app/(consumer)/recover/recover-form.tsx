"use client";

import { useEffect, useMemo, useState } from "react";
import {
  COUNTRIES,
  composeE164,
  dialByIso,
  flagEmoji,
} from "../../../lib/countries";
import { RECOVERY_COUNTRIES } from "../../../lib/recovery-countries";
import { button, field } from "./recover-styles";

type Step = "phone" | "code" | "profile";

export function RecoverForm() {
  const countries = useMemo(
    () => COUNTRIES.filter((country) => RECOVERY_COUNTRIES.has(country.iso2)),
    [],
  );
  const [step, setStep] = useState<Step>("phone");
  const [countryIso, setCountryIso] = useState("EC");
  const [phone, setPhone] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [attempts, setAttempts] = useState(2);
  const [seconds, setSeconds] = useState(0);
  const [resent, setResent] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState("");
  const [resendRequestId, setResendRequestId] = useState("");

  useEffect(() => {
    const saved = sessionStorage.getItem("checkpass_recovery_input");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        phone?: unknown;
        countryIso?: unknown;
      };
      if (typeof parsed.phone === "string") setPhone(parsed.phone);
      if (
        typeof parsed.countryIso === "string" &&
        RECOVERY_COUNTRIES.has(parsed.countryIso)
      )
        setCountryIso(parsed.countryIso);
    } catch {
      // Ignore stale/malformed browser state and show the regular empty form.
    } finally {
      sessionStorage.removeItem("checkpass_recovery_input");
    }
  }, []);
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setInterval(
      () => setSeconds((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [seconds]);

  async function jsonPost(url: string, body: unknown) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
      challengeId?: string;
      next?: "wallet" | "profile";
    };
    if (!response.ok)
      throw Object.assign(
        new Error(data.error ?? "No pudimos completar la solicitud."),
        { code: data.code },
      );
    return data;
  }

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const stableRequestId = requestId || crypto.randomUUID();
      setRequestId(stableRequestId);
      const data = await jsonPost("/api/public/recovery/request", {
        phoneE164: composeE164(dialByIso(countryIso) ?? "", phone),
        countryIso,
        clientRequestId: stableRequestId,
      });
      setChallengeId(data.challengeId ?? "");
      setSeconds(60);
      setStep("code");
      setAttempts(2);
      setResent(false);
      setResendRequestId("");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (busy || attempts <= 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const data = await jsonPost("/api/public/recovery/verify", {
        challengeId,
        code,
      });
      if (data.next === "wallet") {
        window.location.assign("/wallet");
        return;
      }
      setStep("profile");
    } catch (error) {
      if ((error as { code?: string }).code === "invalid_or_expired_otp")
        setAttempts((value) => Math.max(0, value - 1));
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (busy || seconds > 0 || resent) return;
    setBusy(true);
    setMessage(null);
    try {
      const stableRequestId = resendRequestId || crypto.randomUUID();
      setResendRequestId(stableRequestId);
      await jsonPost("/api/public/recovery/resend", {
        challengeId,
        clientRequestId: stableRequestId,
      });
      setResent(true);
      setMessage("Te reenviamos el mismo código.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function profile(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await jsonPost("/api/public/recovery/profile", {
        firstName,
        lastName,
        countryIso,
      });
      window.location.assign("/wallet");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (step === "profile")
    return (
      <form onSubmit={profile}>
        <p>
          Tu teléfono quedó verificado. Completá tu perfil para crear la cuenta.
        </p>
        <label>
          Nombre
          <input
            style={field}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            required
          />
        </label>
        <label style={{ display: "block", marginTop: 12 }}>
          Apellido
          <input
            style={field}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
            required
          />
        </label>
        {message ? <p role="alert">{message}</p> : null}
        <button style={button} disabled={busy}>
          {busy ? "Guardando…" : "Continuar"}
        </button>
      </form>
    );

  if (step === "code")
    return (
      <form onSubmit={verify}>
        <p>
          Ingresá el código de 6 dígitos. Tenés {attempts} intento
          {attempts === 1 ? "" : "s"}.
        </p>
        <label>
          Código
          <input
            style={field}
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            required
          />
        </label>
        {message ? <p role="status">{message}</p> : null}
        <button style={button} disabled={busy || attempts <= 0}>
          {busy ? "Verificando…" : "Verificar"}
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={busy || seconds > 0 || resent}
          style={{
            ...button,
            background: "transparent",
            color: "#1d4ed8",
            border: "1px solid #bfdbfe",
          }}
        >
          {resent
            ? "Código reenviado"
            : seconds > 0
              ? `Reenviar en ${seconds}s`
              : "Reenviar código"}
        </button>
        {resent || attempts <= 0 ? (
          <p style={{ textAlign: "center", color: "#6b7280" }}>
            ¿No recibiste el SMS? Contacta con soporte.
          </p>
        ) : null}
      </form>
    );

  return (
    <form onSubmit={requestCode}>
      <p style={{ color: "#4b5563" }}>
        Te enviaremos un SMS para comprobar que el número es tuyo.
      </p>
      <label>
        País
        <select
          style={field}
          value={countryIso}
          onChange={(e) => setCountryIso(e.target.value)}
        >
          {countries.map((country) => (
            <option key={country.iso2} value={country.iso2}>
              {flagEmoji(country.iso2)} {country.name} (+{country.dial})
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: "block", marginTop: 12 }}>
        Teléfono
        <input
          style={field}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          autoComplete="tel-national"
          required
        />
      </label>
      {message ? <p role="alert">{message}</p> : null}
      <button style={button} disabled={busy}>
        {busy ? "Enviando…" : "Enviar código"}
      </button>
    </form>
  );
}
