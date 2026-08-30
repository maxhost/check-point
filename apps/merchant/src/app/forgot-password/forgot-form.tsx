"use client";

import Link from "next/link";
import { useState } from "react";

type Step = "email" | "code";

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return { ok: response.ok, error: payload?.error ?? null };
}

export function ForgotForm() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendCode() {
    setLoading(true);
    setError(null);
    const result = await postJson("/api/merchant/recovery/request", { email });
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "No pudimos enviar el código.");
      return;
    }
    // Deliberately the same message whether or not the account exists.
    setNotice(
      "Si hay una cuenta con ese email, te enviamos un código de 6 dígitos. Vence en 10 minutos.",
    );
    setStep("code");
  }

  async function changePassword() {
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    setError(null);
    const result = await postJson("/api/merchant/recovery/reset", {
      email,
      otp,
      password,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "No pudimos cambiar la contraseña.");
      return;
    }
    window.location.assign("/login?reset=1");
  }

  return (
    <main className="merchant-shell">
      <section className="panel login-panel">
        <p className="eyebrow">CheckPass Club · Negocios</p>
        <h1>Recuperar contraseña</h1>

        {step === "email" ? (
          <>
            <p>Te enviamos un código de 6 dígitos al email de tu cuenta.</p>
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
          </>
        ) : (
          <>
            {notice && <p>{notice}</p>}
            <label>
              Código de 6 dígitos
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
              />
            </label>
            <label>
              Contraseña nueva
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label>
              Repetir contraseña
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </label>
          </>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button
          className="button"
          disabled={loading}
          onClick={step === "email" ? sendCode : changePassword}
        >
          {loading
            ? "Enviando…"
            : step === "email"
              ? "Enviarme un código"
              : "Cambiar contraseña"}
        </button>

        {step === "code" && (
          <p>
            ¿No te llegó?{" "}
            <button
              className="text-button"
              type="button"
              disabled={loading}
              onClick={() => {
                setError(null);
                setStep("email");
              }}
            >
              Volver a intentar
            </button>
          </p>
        )}

        <p>
          <Link href="/login">Volver a iniciar sesión</Link>
        </p>
      </section>
    </main>
  );
}
