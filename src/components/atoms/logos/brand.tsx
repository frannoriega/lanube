import { getBrand } from "@/config";
import type { LogoProps } from "@/config/types";

/**
 * Brand logo slot. Renders whatever logo the active `app.config.ts` provides,
 * so components never hardcode a specific brand's mark. Swap the logo in
 * app.config.ts to rebrand everywhere at once.
 */
export default function Brand(props: LogoProps) {
  const { logo: Logo } = getBrand();
  return <Logo {...props} />;
}
