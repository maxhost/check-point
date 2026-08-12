"use client";

export default function GlobalError({
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <html lang="es">
      <body>
        <main style={{ fontFamily: "Arial, sans-serif", padding: 24 }}>
          <h1>Algo salió mal</h1>
          <p>Recarga la página o inténtalo nuevamente.</p>
          <button onClick={reset}>Reintentar</button>
        </main>
      </body>
    </html>
  );
}
