/**
 * Prisma types for use in client components.
 * These are plain TypeScript types that don't require the Prisma client.
 * 
 * IMPORTANT: Keep these in sync with prisma/models/enums.prisma
 */

export enum UserRole {
  USER = "USER",
  ADMIN = "ADMIN",
}

export enum ResourceType {
  MEETING = "MEETING",
  AUDITORIUM = "AUDITORIUM",
  COWORKING = "COWORKING",
  LAB = "LAB",
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

export enum ReservationStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
}
