import {
  isGmailConsumerDomain,
  parseEmailIdentityForNormalization,
  stripDotsFromLocal,
} from "../identity";
import { isDomainGoogleHostedByMx } from "../mx-google-hosted";

let workspaceDomainsCache: Set<string> | undefined;

function googleWorkspaceDomainsFromEnv(): Set<string> {
  if (!workspaceDomainsCache) {
    const raw = process.env.GOOGLE_WORKSPACE_EMAIL_DOMAINS ?? "";
    workspaceDomainsCache = new Set(
      raw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );
  }
  return workspaceDomainsCache;
}

/** Test helper */
export function clearGoogleWorkspaceDomainsCacheForTests(): void {
  workspaceDomainsCache = undefined;
}

/**
 * Full server normalization: sync rules plus optional Workspace allowlist and MX-based
 * Google-hosted detection (see env vars in mx-google-hosted).
 */
export async function normalizeEmailForIdentityServer(
  raw: string,
): Promise<string> {
  const { localBase, domain } = parseEmailIdentityForNormalization(raw);
  let stripDots =
    isGmailConsumerDomain(domain) || googleWorkspaceDomainsFromEnv().has(domain);
  if (!stripDots) {
    stripDots = await isDomainGoogleHostedByMx(domain);
  }
  const local = stripDots ? stripDotsFromLocal(localBase) : localBase;
  return `${local}@${domain}`;
}
