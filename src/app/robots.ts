import { siteUrl as BASE_URL } from "@/lib/constants/site";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/user/",
          "/auth/",
          "/api/",
          "/forms/response/", // token-based edit/cancel links — never index
          "/forms/*/submitted", // post-submission thank-you pages
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
