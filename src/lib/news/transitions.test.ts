import { describe, expect, it } from "vitest";
import { isDomainError } from "@/lib/errors";
import {
  assertAuthorTransition,
  statusRequiresApprovalPermission,
} from "./transitions";

describe("statusRequiresApprovalPermission", () => {
  it("is true only for PUBLISHED and PAUSED", () => {
    expect(statusRequiresApprovalPermission("PUBLISHED")).toBe(true);
    expect(statusRequiresApprovalPermission("PAUSED")).toBe(true);
    expect(statusRequiresApprovalPermission("DRAFT")).toBe(false);
    expect(statusRequiresApprovalPermission("PENDING_REVIEW")).toBe(false);
    expect(statusRequiresApprovalPermission("REJECTED")).toBe(false);
  });
});

describe("assertAuthorTransition", () => {
  it("allows a plain author (news:manage only) to save a draft or submit for review", () => {
    expect(() => assertAuthorTransition("DRAFT", false)).not.toThrow();
    expect(() => assertAuthorTransition("PENDING_REVIEW", false)).not.toThrow();
  });

  it("blocks a plain author from publishing or pausing directly", () => {
    expect(() => assertAuthorTransition("PUBLISHED", false)).toThrow();
    expect(() => assertAuthorTransition("PAUSED", false)).toThrow();
  });

  it("throws a 403 DomainError, not a generic error", () => {
    try {
      assertAuthorTransition("PUBLISHED", false);
      expect.unreachable();
    } catch (err) {
      expect(isDomainError(err)).toBe(true);
      if (isDomainError(err)) expect(err.status).toBe(403);
    }
  });

  it("allows a privileged actor (news:approve) to publish or pause directly", () => {
    expect(() => assertAuthorTransition("PUBLISHED", true)).not.toThrow();
    expect(() => assertAuthorTransition("PAUSED", true)).not.toThrow();
  });
});
