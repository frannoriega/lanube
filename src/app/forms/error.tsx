"use client";

import { ErrorBoundaryScreen } from "@/components/organisms/error-boundary-screen";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorBoundaryScreen
      error={error}
      reset={reset}
      homeHref={"/"}
      homeLabel={"Ir al inicio"}
      title={"No pudimos mostrar el formulario"}
      description={
        "Puede ser un problema momentáneo. Reintentá; si el problema sigue, escribinos y te inscribimos nosotros."
      }
    />
  );
}
