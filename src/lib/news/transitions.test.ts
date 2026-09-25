import { describe, expect, it } from "vitest";
import { isDomainError } from "@/lib/errors";
import {
  assertAuthorTransition,
  assertCanRequestPendingAction,
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

describe("assertCanRequestPendingAction", () => {
  it("allows a fresh EDIT/PAUSE/DELETE request against a published post with nothing pending", () => {
    expect(() =>
      assertCanRequestPendingAction("PUBLISHED", null, "EDIT"),
    ).not.toThrow();
    expect(() =>
      assertCanRequestPendingAction("PUBLISHED", null, "PAUSE"),
    ).not.toThrow();
    expect(() =>
      assertCanRequestPendingAction("PUBLISHED", null, "DELETE"),
    ).not.toThrow();
  });

  it("refuses a request against a post that isn't published", () => {
    for (const status of ["DRAFT", "PENDING_REVIEW", "REJECTED", "PAUSED"]) {
      expect(() =>
        assertCanRequestPendingAction(status, null, "EDIT"),
      ).toThrow();
    }
  });

  it("allows re-requesting the same pending action (overwrites it)", () => {
    expect(() =>
      assertCanRequestPendingAction("PUBLISHED", "EDIT", "EDIT"),
    ).not.toThrow();
  });

  it("refuses a different request while one is already pending", () => {
    expect(() =>
      assertCanRequestPendingAction("PUBLISHED", "EDIT", "PAUSE"),
    ).toThrow();
    expect(() =>
      assertCanRequestPendingAction("PUBLISHED", "PAUSE", "DELETE"),
    ).toThrow();
  });

  it("throws a 409 DomainError", () => {
    try {
      assertCanRequestPendingAction("DRAFT", null, "EDIT");
      expect.unreachable();
    } catch (err) {
      expect(isDomainError(err)).toBe(true);
      if (isDomainError(err)) expect(err.status).toBe(409);
    }
  });
});
