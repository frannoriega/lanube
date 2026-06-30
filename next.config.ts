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

const nextConfig: NextConfig = {
  /* config options here */
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  images: { remotePatterns: imageRemotePatterns },
  async redirects() {
    return [
      {
        source: "/admin/reservations/coworking",
        destination: "/admin/reservations?service=coworking",
        permanent: false,
      },
      {
        source: "/admin/reservations/lab",
        destination: "/admin/reservations?service=lab",
        permanent: false,
      },
      {
        source: "/admin/reservations/auditorium",
        destination: "/admin/reservations?service=auditorium",
        permanent: false,
      },
      {
        source: "/admin/reservations/meeting",
        destination: "/admin/reservations?service=meeting",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `
              script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com;
              frame-src 'self' https://challenges.cloudflare.com;
              connect-src 'self' https://challenges.cloudflare.com;
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
