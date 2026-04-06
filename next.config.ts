import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
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
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `
              script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com;
              frame-src 'self' https://challenges.cloudflare.com;
              connect-src 'self' https://challenges.cloudflare.com;
            `.replace(/\s{2,}/g, ' ').trim()
          }
        ],
      },
    ]
  }
};

const withMDX = createMDX({
  // Add markdown plugins here, as desired
  extension: /\.(md|mdx)$/,
});

// Merge MDX config with Next.js config
export default withMDX(nextConfig);
