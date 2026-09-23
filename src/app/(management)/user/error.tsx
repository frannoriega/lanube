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
      homeHref={"/user/dashboard"}
      homeLabel={"Ir al panel"}
    />
  );
}
