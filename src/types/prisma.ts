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
  role: UserRole;
  createdAt: number;
  updatedAt: number;
};

export enum UserRole {
  USER = "USER",
  ADMIN = "ADMIN",
  SUPERADMIN = "SUPERADMIN",
}

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
  heroExtraKeyword: string | null;
  accentPresetKey: string | null;
  bannerText: string | null;
  bannerUrl: string | null;
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
