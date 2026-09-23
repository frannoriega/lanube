"use client";

/**
 * Last-resort boundary: catches a throw in the ROOT layout itself, which `error.tsx`
 * cannot (it renders *inside* that layout). Because it replaces the whole document it
 * must render its own <html>/<body> and cannot rely on the app's fonts, providers or CSS
 * tokens — hence the inline styles. Keep it dependency-free for that reason.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          textAlign: "center",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          background: "#e2e8f0",
          color: "#424242",
        }}
      >
        <main style={{ maxWidth: "32rem" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>
            La Nube no está disponible en este momento
          </h1>
          <p style={{ marginBottom: "1.5rem", lineHeight: 1.6 }}>
            Ocurrió un error inesperado al cargar la aplicación. Reintentá en
            unos segundos.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              cursor: "pointer",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.625rem 1.25rem",
              fontSize: "1rem",
              background: "#2a6297",
              color: "#ffffff",
            }}
          >
            Reintentar
          </button>
          {error.digest && (
            <p style={{ marginTop: "1.5rem", fontSize: "0.75rem" }}>
              Código de referencia: <code>{error.digest}</code>
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
