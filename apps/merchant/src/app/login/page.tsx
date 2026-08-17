"use client";

import Link from "next/link";
import { useState } from "react";
import { merchantAuthClient } from "../../lib/auth-client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
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
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
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
          ¿Aún no tienes cuenta? <Link href="/onboarding">Crea tu negocio</Link>
          .
        </p>
      </section>
    </main>
  );
}
