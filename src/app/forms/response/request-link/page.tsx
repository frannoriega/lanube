import { FormMessageCard } from "@/components/organisms/forms/form-page";
import { EditLinkRequestForm } from "@/components/organisms/forms/edit-link-request-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pedir un enlace nuevo",
  robots: { index: false },
};

/**
 * «Pedir un enlace nuevo» para gestionar una inscripción (milestone 25, S5). Segmento estático
 * al lado de `[token]`: Next lo prioriza, y ningún token (43 caracteres base64url) puede llamarse
 * así.
 */
export default function RequestEditLinkPage() {
  return (
    <FormMessageCard>
      <EditLinkRequestForm />
    </FormMessageCard>
  );
}
