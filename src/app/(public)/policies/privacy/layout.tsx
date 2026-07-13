import type { Metadata } from "next";

// The page itself is a client component, so its metadata lives here.
export const metadata: Metadata = {
  title: "Política de Privacidad",
  description:
    "Política de privacidad de La Nube - Polo Tecnológico de Concepción del Uruguay: qué datos personales recolectamos, cómo los usamos y cuáles son tus derechos.",
  alternates: { canonical: "/policies/privacy" },
};

export default function PrivacyPolicyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
