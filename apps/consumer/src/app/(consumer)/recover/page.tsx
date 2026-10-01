import { RecoverForm } from "./recover-form";

export default function RecoverPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f5f4",
        padding: "32px 16px",
      }}
    >
      <section
        style={{
          maxWidth: 440,
          margin: "0 auto",
          background: "white",
          borderRadius: 18,
          padding: 24,
          boxShadow: "0 8px 30px rgba(0,0,0,.08)",
        }}
      >
        <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>
          CheckPass Club
        </p>
        <h1 style={{ fontSize: 26, margin: "6px 0 8px" }}>
          Recuperá tu tarjeta
        </h1>
        <RecoverForm />
      </section>
    </main>
  );
}
