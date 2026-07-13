import { SessionProvider } from "@/components/providers/session";
import { ServerTimeProvider } from "@/components/providers/server-time";
import { auth } from "@/lib/auth";
import { nowMs } from "@/lib/clock";
import type { Metadata } from "next";
import { connection } from "next/server";

// Private, session-gated pages: keep them out of search results.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * The management tree is always rendered per-request: `connection()` opts out of
 * prerendering so `nowMs()` reflects the real (or faked) server clock, and the
 * session is resolved here once and handed to the client provider.
 */
export default async function ManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const serverNowMs = nowMs();
  const session = await auth();

  return (
    <ServerTimeProvider serverNowMs={serverNowMs}>
      <SessionProvider session={session}>{children}</SessionProvider>
    </ServerTimeProvider>
  );
}
