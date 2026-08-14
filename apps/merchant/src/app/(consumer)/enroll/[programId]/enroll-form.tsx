"use client";

import { useState } from "react";

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
  businessName,
}: {
  programId: string;
  businessName: string;
}) {
  const [screen, setScreen] = useState<Screen>({ kind: "form" });
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneE164, setPhoneE164] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setToast(null);
    try {
      const res = await fetch(`/api/public/enroll/${programId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstName, lastName, phoneE164 }),
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
    return (
      <section>
        <h2 style={{ fontSize: 20 }}>¡Listo, {screen.firstName}! 🎉</h2>
        <p style={{ color: "#333", marginTop: 8 }}>
          Ya sos parte del programa de <strong>{businessName}</strong>.
        </p>
        <p
          style={{
            marginTop: 16,
            padding: "12px 14px",
            background: "#fff8e1",
            border: "1px solid #ffe082",
            borderRadius: 10,
            color: "#5d4037",
            fontSize: 14,
          }}
        >
          Guardá tu teléfono: lo vas a necesitar para recuperar tu tarjeta si
          cambiás o perdés este dispositivo.
        </p>
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
          disabled
          title="Disponible próximamente"
          style={{
            marginTop: 16,
            width: "100%",
            padding: "12px 14px",
            fontSize: 16,
            borderRadius: 10,
            border: "1px solid #ccc",
            background: "#eee",
            color: "#999",
            cursor: "not-allowed",
          }}
        >
          Recuperar mi tarjeta (próximamente)
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
      <label style={label} htmlFor="phone">
        Teléfono
      </label>
      <input
        id="phone"
        style={inputStyle}
        value={phoneE164}
        onChange={(e) => setPhoneE164(e.target.value)}
        inputMode="tel"
        autoComplete="tel"
        placeholder="+593987654321"
        required
      />
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
          background: submitting ? "#7aa7ff" : "#2563eb",
          color: "#fff",
          cursor: submitting ? "default" : "pointer",
        }}
      >
        {submitting ? "Registrando…" : "Sumarme al programa"}
      </button>
    </form>
  );
}
