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

export enum EventType {
  MEETING = "MEETING",
  WORKSHOP = "WORKSHOP",
  CONFERENCE = "CONFERENCE",
  OTHER = "OTHER",
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

export enum FormFieldType {
  SHORT_TEXT = "SHORT_TEXT",
  LONG_TEXT = "LONG_TEXT",
  NUMBER = "NUMBER",
  SINGLE_SELECT = "SINGLE_SELECT",
  MULTI_SELECT = "MULTI_SELECT",
  DATE = "DATE",
  TIME = "TIME",
  PHONE = "PHONE",
  DNI = "DNI",
}
