import { describe, expect, it } from "vitest";
import {
  shouldRetireSlug,
  shouldSoftDelete,
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

describe("shouldSoftDelete", () => {
  it("soft-deletes a post that was ever published", () => {
    expect(shouldSoftDelete(BigInt(1_600_000_000_000))).toBe(true);
    expect(shouldSoftDelete(1_600_000_000_000)).toBe(true);
  });

  it("hard-deletes a post that never went live", () => {
    expect(shouldSoftDelete(null)).toBe(false);
  });
});
