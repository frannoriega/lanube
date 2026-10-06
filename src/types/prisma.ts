/**
 * Prisma types for use in client components.
 * These are plain TypeScript types that don't require the Prisma client.
 *
 * IMPORTANT: Keep these in sync with prisma/models/enums.prisma
 */

export type RegisteredUser = {
  id: string;
  userId: string;
  name: string;
  lastName: string;
  dni: string;
  institution: string | null;
  reasonToJoin: string;
  /** Display name of the assigned role, or null on the base tier. */
  role: string | null;
  roleId: string | null;
  createdAt: number;
  updatedAt: number;
};

/**
 * Roles are rows in `roles` (milestone 9), not an enum — the `UserRole` enum that used to
 * live here was removed alongside the DB type. Client components take the role list from
 * the server (`listRoles()`); permission *names* stay code-defined in `@/lib/rbac`.
 */
export type RoleOption = {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
  isSuperadmin: boolean;
};

export enum IncidentStatus {
  OPEN = "OPEN",
  RESOLVED = "RESOLVED",
  CLOSED = "CLOSED",
}

export enum OrderStatus {
  PENDING = "PENDING",
  DONE = "DONE",
  CANCELLED = "CANCELLED",
}

export enum ProposalStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export enum ReservableType {
  USER = "USER",
  EVENT = "EVENT",
  ORGANIZATION = "ORGANIZATION",
  TEAM = "TEAM",
}

/**
 * Reservation/event types now live in the `reservation_types` DB table (managed by
 * superadmins). This mirrors that row for client components; `code` is what
 * events/reservations store in their `eventType` field.
 */
export type ReservationType = {
  id: string;
  code: string;
  name: string;
  displayOrder: number;
  createdAt: number;
  updatedAt: number;
};

export enum SpaceKind {
  SPACE = "SPACE",
  AMENITY = "AMENITY",
}

export enum EventStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  PAUSED = "PAUSED",
}

export enum ReservationStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
}

export enum ParticipantStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
}

export enum LandingThemeEffect {
  NONE = "NONE",
  EMOJI_SHOWER = "EMOJI_SHOWER",
}

export enum LandingThemeKeywordMode {
  APPEND = "APPEND",
  REPLACE = "REPLACE",
}

/** Mirrors the `LandingTheme` row for client components (see prisma/models/landing-themes.prisma). */
export type LandingTheme = {
  id: string;
  name: string;
  isEnabled: boolean;
  priority: number;
  recurring: boolean;
  startMonthDay: string | null;
  endMonthDay: string | null;
  startDate: number | null;
  endDate: number | null;
  entranceEffect: LandingThemeEffect;
  emojiList: string | null;
  particleCount: number | null;
  heroEyebrowOverride: string | null;
  heroKeywords: string | null;
  heroKeywordsMode: LandingThemeKeywordMode;
  accentPresetKey: string | null;
  bannerText: string | null;
  bannerUrl: string | null;
  createdAt: number;
  updatedAt: number;
};

export enum NewsPostStatus {
  DRAFT = "DRAFT",
  PENDING_REVIEW = "PENDING_REVIEW",
  PUBLISHED = "PUBLISHED",
  REJECTED = "REJECTED",
  PAUSED = "PAUSED",
}

export enum NewsPendingAction {
  EDIT = "EDIT",
  PAUSE = "PAUSE",
  DELETE = "DELETE",
}

/** Mirrors the `NewsPost` row for client components (see prisma/models/news.prisma). */
export type NewsPost = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  body: string;
  coverImageUrl: string | null;
  authorId: string | null;
  authorLabel: string;
  status: NewsPostStatus;
  pendingAction: NewsPendingAction | null;
  pendingTitle: string | null;
  pendingSlug: string | null;
  pendingSummary: string | null;
  pendingBody: string | null;
  pendingCoverImageUrl: string | null;
  pendingReason: string | null;
  pendingRequestedAt: number | null;
  isFeatured: boolean;
  featuredOrder: number;
  publishedAt: number | null;
  decisionReason: string | null;
  decidedAt: number | null;
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export enum FormFieldType {
  SHORT_TEXT = "SHORT_TEXT",
  LONG_TEXT = "LONG_TEXT",
  INTEGER = "INTEGER",
  FLOAT = "FLOAT",
  MONEY = "MONEY",
  SINGLE_SELECT = "SINGLE_SELECT",
  MULTI_SELECT = "MULTI_SELECT",
  DATE = "DATE",
  TIME = "TIME",
  PHONE = "PHONE",
  DNI = "DNI",
  FILE = "FILE",
  BOOLEAN = "BOOLEAN",
}
