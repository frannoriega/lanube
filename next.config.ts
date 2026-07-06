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

const nextConfig: NextConfig = {
  /* config options here */
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  images: { remotePatterns: imageRemotePatterns },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `
              script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com${__impeccableLiveDev};
              frame-src 'self' https://challenges.cloudflare.com;
              connect-src 'self' https://challenges.cloudflare.com${__impeccableLiveDev};
            `
              .replace(/\s{2,}/g, " ")
              .trim(),
          },
        ],
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
