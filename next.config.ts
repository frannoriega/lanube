import createMDX from "@next/mdx";
import type { NextConfig } from "next";

// Remote hosts allowed for next/image. Vercel Blob is the current provider; a future
// custom/S3-compatible host (e.g. on Coolify) can be whitelisted via STORAGE_PUBLIC_HOST.
const imageRemotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] =
  [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }];
if (process.env.STORAGE_PUBLIC_HOST) {
  imageRemotePatterns.push({
    protocol: "https",
    hostname: process.env.STORAGE_PUBLIC_HOST,
  });
}

// Dev-only allowance so impeccable live mode can load.
const __impeccableLiveDev =
  process.env.NODE_ENV === "development" ? " http://localhost:8400" : "";

// 'unsafe-eval' is needed by the dev bundler, never by the built app (milestone 10, F3.1).
const __devEval =
  process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";

// Image hosts must be allowed in the CSP too, not just next/image's remotePatterns —
// they are independent mechanisms and only the former actually blocks a load.
const __imageHosts = [
  "https://*.public.blob.vercel-storage.com",
  process.env.STORAGE_PUBLIC_HOST
    ? `https://${process.env.STORAGE_PUBLIC_HOST}`
    : "",
]
  .filter(Boolean)
  .join(" ");

/**
 * Content-Security-Policy.
 *
 * ⚠️ `'unsafe-inline'` is still present in `script-src` and is the single biggest
 * remaining gap: it permits exactly the injected script the header exists to stop.
 * Removing it requires a middleware-generated nonce, which is deliberately NOT part of
 * this change — a wrong nonce blanks the entire app and `npm run build` will not catch
 * it, so it ships on its own after a preview walkthrough of every route group. See
 * docs/milestones/milestones-10-frontend-audit-hardening.md (slice C step 5).
 *
 * Everything below is the part that can land safely today.
 */
const contentSecurityPolicy = [
  // No default-src meant every directive not listed was simply unrestricted.
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${__devEval} https://challenges.cloudflare.com${__impeccableLiveDev}`,
  // Inline styles are unavoidable: Tailwind/Next inject them, as do the theme tokens.
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${__imageHosts}`,
  "font-src 'self' data:",
  `connect-src 'self' https://challenges.cloudflare.com${__impeccableLiveDev}`,
  "frame-src 'self' https://challenges.cloudflare.com",
  // Cheapest high-value directive there is: without it an injected <base href> re-targets
  // every relative URL on the page, form posts included.
  "base-uri 'self'",
  "form-action 'self'",
  // Clickjacking: the modern replacement for X-Frame-Options (which is also sent below
  // for older browsers).
  "frame-ancestors 'none'",
  "object-src 'none'",
]
  .join("; ")
  .trim();

const nextConfig: NextConfig = {
  /* config options here */
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  // La pantalla de aceptación de políticas (milestone 19) lee el texto fuente de dos versiones
  // con `fs` para mostrar el diff "Ver qué cambió". Sin esto, el bundle serverless de Vercel no
  // incluye los .mdx (solo los incluye compilados, vía import) y el diff fallaría en producción.
  outputFileTracingIncludes: {
    "/policies/accept": ["./src/assets/policies/**/*.mdx"],
  },
  images: { remotePatterns: imageRemotePatterns },
  async redirects() {
    return [
      // "Servicios" was renamed to "Espacios"; keep the old URL working.
      { source: "/services", destination: "/spaces", permanent: true },
      // Public routes are English; "/noticias" was the original Noticias path and is
      // already out in the wild (shared article links carry the dated sub-path).
      { source: "/noticias", destination: "/news", permanent: true },
      {
        source: "/noticias/:path*",
        destination: "/news/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        // La CSP global va a todas las rutas MENOS al proxy de archivos de participantes, que
        // pone la suya (`sandbox` para todo lo que no es PDF). Los headers de este archivo pisan
        // los de la respuesta de la ruta, así que con `/:path*` la `sandbox` nunca llegaba al
        // navegador (milestone 25: hallado al verificar S1 contra la app).
        source: "/((?!api/admin/events/[^/]+/participants/file$).*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
        ],
      },
      {
        source: "/:path*",
        headers: [
          // Belt-and-braces with frame-ancestors, for browsers that predate CSP2.
          { key: "X-Frame-Options", value: "DENY" },
          // Stops MIME sniffing turning an uploaded file into executable script.
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          // 2 years + preload, the values the preload list requires. Browsers ignore
          // this over plain HTTP, so it is inert in local dev.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      {
        // The participant's editToken is IN THE PATH here, so the default
        // strict-origin-when-cross-origin would still leak it to any host the page links
        // out to. Send no referrer at all from these URLs.
        source: "/forms/response/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

const withMDX = createMDX({
  // Add markdown plugins here, as desired
  extension: /\.(md|mdx)$/,
});

// Merge MDX config with Next.js config
export default withMDX(nextConfig);
