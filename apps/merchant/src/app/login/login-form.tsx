"use client";

import Link from "next/link";
import { useState } from "react";
import { merchantAuthClient } from "../../lib/auth-client";
import { Toast } from "../components/ui";

/**
 * The sign-in form. `initialError` is the reason the server already knows about
 * (e.g. a deactivated staff bounced back by the guard). It seeds the same `error`
 * slot the credential errors use, so a retry with a wrong password OVERWRITES the
 * stale notice instead of stacking on top of it.
 */
export function LoginForm({ initialError }: { initialError?: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [loading, setLoading] = useState(false);
  return (
    <main className="merchant-shell">
      <section className="panel login-panel">
        <p className="eyebrow">CheckPass Club · Negocios</p>
        <h1>Inicia sesión</h1>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <Toast message={error} kind="error" onDismiss={() => setError(null)} />
        <button
          className="button"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            setError(null);
            const result = await merchantAuthClient.signIn.email({
              email,
              password,
            });
            setLoading(false);
            if (result.error) {
              setError(result.error.message ?? "No pudimos iniciar sesión.");
              return;
            }
            window.location.assign("/backoffice");
          }}
        >
          {loading ? "Ingresando…" : "Ingresar"}
        </button>
        <p>
          <Link href="/forgot-password">¿Olvidaste tu contraseña?</Link>
        </p>
        <p>
          ¿Aún no tienes cuenta? <Link href="/onboarding">Crea tu negocio</Link>
          .
        </p>
      </section>
    </main>
  );
}
