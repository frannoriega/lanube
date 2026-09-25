import { describe, expect, it } from "vitest";
import {
  shouldFlagForReview,
  shouldRetireSlug,
  shouldStampPublishedAt,
} from "./publishing";

describe("shouldStampPublishedAt", () => {
  it("stamps the first time a post goes live", () => {
    expect(shouldStampPublishedAt("PUBLISHED", null)).toBe(true);
  });

  it("does NOT restamp when a paused post is restored", () => {
    // The milestone-12 D9 regression: PAUSED -> PUBLISHED satisfied the old
    // "status changed to PUBLISHED" rule and moved an old article to the top of /news.
    expect(shouldStampPublishedAt("PUBLISHED", BigInt(1_600_000_000_000))).toBe(
      false,
    );
  });

  it("does NOT restamp when a rejected post that was once live is republished", () => {
    expect(shouldStampPublishedAt("PUBLISHED", BigInt(1_600_000_000_000))).toBe(
      false,
    );
  });

  it("stamps a never-published post approved out of review", () => {
    expect(shouldStampPublishedAt("PUBLISHED", null)).toBe(true);
  });

  it("is false for every non-published target status", () => {
    for (const status of ["DRAFT", "PENDING_REVIEW", "REJECTED", "PAUSED"]) {
      expect(shouldStampPublishedAt(status, null)).toBe(false);
      expect(shouldStampPublishedAt(status, BigInt(1_600_000_000_000))).toBe(
        false,
      );
    }
  });
});

describe("shouldRetireSlug", () => {
  it("retires the old slug when a published post is renamed", () => {
    expect(shouldRetireSlug("nuevo", "viejo", BigInt(1_600_000_000_000))).toBe(
      true,
    );
  });

  it("does not retire anything when the slug is unchanged", () => {
    expect(shouldRetireSlug("igual", "igual", BigInt(1_600_000_000_000))).toBe(
      false,
    );
  });

  it("does not retire a draft's slug — it was never in circulation", () => {
    expect(shouldRetireSlug("nuevo", "viejo", null)).toBe(false);
  });

  it("treats a numeric publishedAt the same as a bigint one", () => {
    expect(shouldRetireSlug("nuevo", "viejo", 1_600_000_000_000)).toBe(true);
  });
});

describe("shouldFlagForReview", () => {
  it("flags a plain author amending their own live post", () => {
    expect(shouldFlagForReview("PUBLISHED", "PUBLISHED", false)).toBe(true);
  });

  it("does not flag an admin's edit — their edit is the review", () => {
    expect(shouldFlagForReview("PUBLISHED", "PUBLISHED", true)).toBe(false);
  });

  it("does not flag a normal first publication out of review", () => {
    // This path is gated by assertAuthorTransition instead: a plain author cannot
    // reach PUBLISHED from PENDING_REVIEW at all.
    expect(shouldFlagForReview("PUBLISHED", "PENDING_REVIEW", false)).toBe(
      false,
    );
    expect(shouldFlagForReview("PUBLISHED", "DRAFT", false)).toBe(false);
  });

  it("does not flag an author taking their post back to a draft", () => {
    expect(shouldFlagForReview("DRAFT", "PUBLISHED", false)).toBe(false);
    expect(shouldFlagForReview("PENDING_REVIEW", "PUBLISHED", false)).toBe(
      false,
    );
  });

  it("does not flag reviving a paused post", () => {
    // PAUSED -> PUBLISHED still needs news:approve, so a plain author never gets here.
    expect(shouldFlagForReview("PUBLISHED", "PAUSED", false)).toBe(false);
  });
});
