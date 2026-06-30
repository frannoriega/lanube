"use client";

import { CopyField } from "@/components/molecules/copy-field";
import { useEffect, useState } from "react";

/** Public inscription link for a form slug, with a copy-to-clipboard control. */
export function CopyFormUrl({
  slug,
  variant = "box",
}: {
  slug: string;
  variant?: "box" | "button";
}) {
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}/forms/${slug}`;

  return (
    <CopyField
      value={url}
      variant={variant}
      label="Link de inscripción"
      buttonLabel="Copiar link"
      successMessage="Link copiado"
      mono
    />
  );
}
