import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearMxGoogleHostedCacheForTests } from "../mx-google-hosted";
import {
  clearGoogleWorkspaceDomainsCacheForTests,
  normalizeEmailForIdentityServer,
} from "./identity-server";

describe("normalizeEmailForIdentityServer", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GOOGLE_WORKSPACE_EMAIL_DOMAINS;
    delete process.env.ENABLE_MX_GOOGLE_HOSTED_DETECTION;
    clearGoogleWorkspaceDomainsCacheForTests();
    clearMxGoogleHostedCacheForTests();
  });

  afterEach(() => {
    process.env = originalEnv;
    clearGoogleWorkspaceDomainsCacheForTests();
    clearMxGoogleHostedCacheForTests();
  });

  it("strips dots for domains listed in GOOGLE_WORKSPACE_EMAIL_DOMAINS", async () => {
    process.env.GOOGLE_WORKSPACE_EMAIL_DOMAINS = "example.org, other.com";
    clearGoogleWorkspaceDomainsCacheForTests();
    await expect(
      normalizeEmailForIdentityServer("J.Doe@example.org"),
    ).resolves.toBe("jdoe@example.org");
  });

  it("does not strip dots for unknown domains when MX detection is off", async () => {
    await expect(
      normalizeEmailForIdentityServer("a.b@unknown-domain.test"),
    ).resolves.toBe("a.b@unknown-domain.test");
  });
});
