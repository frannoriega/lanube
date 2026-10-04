import { OAuthConsentForm } from "@/components/organisms/oauth/consent-form";
import { auth } from "@/lib/auth";
import { validateAuthorizationRequest } from "@/lib/oauth/authorize";
import { SCOPE_DESCRIPTIONS } from "@/lib/oauth/config";
import { publicOrigin } from "@/lib/oauth/origin";
import { redirectUriDisplayHost } from "@/lib/oauth/redirect-uri";
import { redirectIfPoliciesPending } from "@/lib/policies/page-gate";
import { signInUrl } from "@/lib/signin/callback-url";
import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Conectar un asistente | La Nube",
  robots: { index: false },
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | null {
  return (Array.isArray(v) ? v[0] : v) ?? null;
}

/**
 * Pantalla de consentimiento OAuth del conector MCP (milestone 20): «Claude quiere acceder a
 * tu cuenta de La Nube». Es el `authorization_endpoint` que publica la metadata.
 *
 * El middleware ya la cubre (ingreso con `callbackUrl`, baneo, gate de políticas, perfil
 * completo), y acá se repiten los chequeos con la sesión fresca, como en los layouts de
 * `/user` y `/admin`: la cookie del JWT puede estar atrasada.
 *
 * El pedido se valida con `validateAuthorizationRequest()`: si `client_id` o `redirect_uri`
 * no cierran, el error se muestra acá y **no se redirige** (evita un open redirect); los demás
 * errores vuelven al cliente. El consentimiento se pide **siempre**, aunque ya exista un grant
 * con los mismos permisos (decisión del milestone: no saltearlo en la primera versión).
 */
export default async function OAuthAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = await searchParams;
  const params = {
    response_type: first(raw.response_type),
    client_id: first(raw.client_id),
    redirect_uri: first(raw.redirect_uri),
    code_challenge: first(raw.code_challenge),
    code_challenge_method: first(raw.code_challenge_method),
    scope: first(raw.scope),
    state: first(raw.state),
    resource: first(raw.resource),
  };

  const session = await auth();
  if (!session?.user?.email) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null) as [string, string][],
    ).toString();
    redirect(signInUrl(`/oauth/authorize?${query}`));
  }
  if (session.banned) redirect("/banned");
  await redirectIfPoliciesPending(session);
  if (!session.userId) redirect("/auth/signup");

  const origin = publicOrigin(await headers());
  const result = await validateAuthorizationRequest(params, origin);
  if (result.kind === "redirect") redirect(result.redirectTo);

  if (result.kind === "fatal") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <ShieldAlert className="size-6 text-destructive" aria-hidden />
          <h1 className="text-2xl font-bold tracking-tight text-la-nube-ink dark:text-white">
            No pudimos conectar la aplicación
          </h1>
        </div>
        <p className="text-muted-foreground">{result.message}</p>
      </div>
    );
  }

  const capabilities = result.scopes.flatMap((s) => SCOPE_DESCRIPTIONS[s]);
  return (
    <OAuthConsentForm
      clientName={result.client.name}
      clientHost={redirectUriDisplayHost(result.redirectUri)}
      accountEmail={session.user.displayEmail ?? session.user.email ?? ""}
      capabilities={capabilities}
      request={params}
    />
  );
}
