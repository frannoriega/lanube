import { describe, expect, it } from "vitest";
import { isDomainError } from "@/lib/errors";
import {
  assertAuthorTransition,
  isAmendInPlace,
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

describe("isAmendInPlace", () => {
  it("is true only when a published post stays published", () => {
    expect(isAmendInPlace("PUBLISHED", "PUBLISHED")).toBe(true);
    expect(isAmendInPlace("PUBLISHED", "DRAFT")).toBe(false);
    expect(isAmendInPlace("PUBLISHED", "PAUSED")).toBe(false);
    expect(isAmendInPlace("PAUSED", "PUBLISHED")).toBe(false);
  });

  it("is false on create, where there is no existing status", () => {
    expect(isAmendInPlace("PUBLISHED", undefined)).toBe(false);
  });
});

describe("assertAuthorTransition with an existing status", () => {
  it("lets a plain author amend their own already-published post", () => {
    // milestone-12 D20: before this, the author's only options were a 403 or taking
    // the live article off the site.
    expect(() =>
      assertAuthorTransition("PUBLISHED", false, "PUBLISHED"),
    ).not.toThrow();
  });

  it("still refuses a plain author publishing something not yet live", () => {
    for (const from of ["DRAFT", "PENDING_REVIEW", "REJECTED", "PAUSED"]) {
      let thrown: unknown;
      try {
        assertAuthorTransition("PUBLISHED", false, from);
      } catch (err) {
        thrown = err;
      }
      expect(isDomainError(thrown)).toBe(true);
    }
  });

  it("still refuses a plain author pausing a live post", () => {
    let thrown: unknown;
    try {
      assertAuthorTransition("PAUSED", false, "PUBLISHED");
    } catch (err) {
      thrown = err;
    }
    expect(isDomainError(thrown)).toBe(true);
  });

  it("is unchanged for an author who can publish directly", () => {
    expect(() =>
      assertAuthorTransition("PUBLISHED", true, "DRAFT"),
    ).not.toThrow();
  });
});
