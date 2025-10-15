-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "incident_statuses" AS ENUM ('OPEN', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "order_statuses" AS ENUM ('PENDING', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "proposal_statuses" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "reservable_types" AS ENUM ('USER', 'EVENT', 'ORGANIZATION', 'TEAM');

-- CreateEnum
CREATE TYPE "event_types" AS ENUM ('MEETING', 'WORKSHOP', 'CONFERENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "reservation_statuses" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "resource_types" AS ENUM ('MEETING', 'AUDITORIUM', 'COWORKING', 'LAB');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "email_verified" TIMESTAMP(3),
    "image" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registered_users" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "institution" TEXT,
    "reason_to_join" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registered_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "bans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_events" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participants" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "incident_statuses" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_followups" (
    "id" TEXT NOT NULL,
    "incident_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incident_followups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_users" (
    "id" TEXT NOT NULL,
    "incident_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "check_in_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventories" (
    "id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "min_stock" INTEGER NOT NULL,
    "current_stock" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "status" "order_statuses" NOT NULL DEFAULT 'PENDING',
    "due_date" TIMESTAMP(3) NOT NULL,
    "receipt" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "inventory_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" TEXT NOT NULL,
    "proposer_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "proposal_statuses" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_comments" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_likes" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_comment_likes" (
    "id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_comment_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "reservable_type" "reservable_types" NOT NULL,
    "reservable_id" TEXT NOT NULL,
    "resource_id" TEXT,
    "event_type" "event_types" NOT NULL,
    "reason" TEXT NOT NULL,
    "denied_reason" TEXT,
    "status" "reservation_statuses" NOT NULL DEFAULT 'PENDING',
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "rrule" TEXT,
    "recurrence_end" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_exceptions" (
    "id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "exception_date" TIMESTAMP(3) NOT NULL,
    "is_cancelled" BOOLEAN NOT NULL DEFAULT false,
    "new_start_time" TIMESTAMP(3),
    "new_end_time" TIMESTAMP(3),
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_ins" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reservation_id" TEXT,
    "check_in_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "check_out_time" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fungible_resources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "resource_types" NOT NULL,
    "capacity" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fungible_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fungible_resource_id" TEXT,
    "serial_number" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "registered_users_user_id_key" ON "registered_users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "registered_users_dni_key" ON "registered_users"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE INDEX "bans_user_id_idx" ON "bans"("user_id");

-- CreateIndex
CREATE INDEX "bans_start_time_idx" ON "bans"("start_time");

-- CreateIndex
CREATE INDEX "bans_end_time_idx" ON "bans"("end_time");

-- CreateIndex
CREATE INDEX "events_start_time_idx" ON "events"("start_time");

-- CreateIndex
CREATE INDEX "user_events_event_id_idx" ON "user_events"("event_id");

-- CreateIndex
CREATE INDEX "user_events_user_id_idx" ON "user_events"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_events_event_id_user_id_key" ON "user_events"("event_id", "user_id");

-- CreateIndex
CREATE INDEX "participants_event_id_idx" ON "participants"("event_id");

-- CreateIndex
CREATE INDEX "incidents_status_idx" ON "incidents"("status");

-- CreateIndex
CREATE INDEX "incident_followups_incident_id_idx" ON "incident_followups"("incident_id");

-- CreateIndex
CREATE INDEX "incident_users_incident_id_idx" ON "incident_users"("incident_id");

-- CreateIndex
CREATE INDEX "incident_users_user_id_idx" ON "incident_users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "incident_users_incident_id_user_id_key" ON "incident_users"("incident_id", "user_id");

-- CreateIndex
CREATE INDEX "inventories_created_by_idx" ON "inventories"("created_by");

-- CreateIndex
CREATE INDEX "purchase_orders_created_by_idx" ON "purchase_orders"("created_by");

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_inventory_id_idx" ON "order_items"("inventory_id");

-- CreateIndex
CREATE INDEX "organizations_parent_id_idx" ON "organizations"("parent_id");

-- CreateIndex
CREATE INDEX "org_memberships_user_id_idx" ON "org_memberships"("user_id");

-- CreateIndex
CREATE INDEX "org_memberships_organization_id_idx" ON "org_memberships"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_memberships_user_id_organization_id_key" ON "org_memberships"("user_id", "organization_id");

-- CreateIndex
CREATE INDEX "teams_organization_id_idx" ON "teams"("organization_id");

-- CreateIndex
CREATE INDEX "team_members_user_id_idx" ON "team_members"("user_id");

-- CreateIndex
CREATE INDEX "team_members_team_id_idx" ON "team_members"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_user_id_team_id_key" ON "team_members"("user_id", "team_id");

-- CreateIndex
CREATE INDEX "proposals_proposer_id_idx" ON "proposals"("proposer_id");

-- CreateIndex
CREATE INDEX "proposals_status_idx" ON "proposals"("status");

-- CreateIndex
CREATE INDEX "proposal_comments_proposal_id_idx" ON "proposal_comments"("proposal_id");

-- CreateIndex
CREATE INDEX "proposal_comments_user_id_idx" ON "proposal_comments"("user_id");

-- CreateIndex
CREATE INDEX "proposal_likes_proposal_id_idx" ON "proposal_likes"("proposal_id");

-- CreateIndex
CREATE INDEX "proposal_likes_user_id_idx" ON "proposal_likes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_likes_proposal_id_user_id_key" ON "proposal_likes"("proposal_id", "user_id");

-- CreateIndex
CREATE INDEX "proposal_comment_likes_comment_id_idx" ON "proposal_comment_likes"("comment_id");

-- CreateIndex
CREATE INDEX "proposal_comment_likes_user_id_idx" ON "proposal_comment_likes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_comment_likes_comment_id_user_id_key" ON "proposal_comment_likes"("comment_id", "user_id");

-- CreateIndex
CREATE INDEX "reservations_reservable_type_reservable_id_idx" ON "reservations"("reservable_type", "reservable_id");

-- CreateIndex
CREATE INDEX "reservations_resource_id_idx" ON "reservations"("resource_id");

-- CreateIndex
CREATE INDEX "reservations_status_idx" ON "reservations"("status");

-- CreateIndex
CREATE INDEX "reservations_start_time_end_time_idx" ON "reservations"("start_time", "end_time");

-- CreateIndex
CREATE INDEX "reservation_exceptions_reservation_id_idx" ON "reservation_exceptions"("reservation_id");

-- CreateIndex
CREATE INDEX "reservation_exceptions_exception_date_idx" ON "reservation_exceptions"("exception_date");

-- CreateIndex
CREATE INDEX "check_ins_user_id_idx" ON "check_ins"("user_id");

-- CreateIndex
CREATE INDEX "check_ins_check_in_time_idx" ON "check_ins"("check_in_time");

-- CreateIndex
CREATE UNIQUE INDEX "resources_serial_number_key" ON "resources"("serial_number");

-- CreateIndex
CREATE INDEX "resources_fungible_resource_id_idx" ON "resources"("fungible_resource_id");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registered_users" ADD CONSTRAINT "registered_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bans" ADD CONSTRAINT "bans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "registered_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_events" ADD CONSTRAINT "user_events_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_events" ADD CONSTRAINT "user_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "registered_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_followups" ADD CONSTRAINT "incident_followups_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_users" ADD CONSTRAINT "incident_users_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_users" ADD CONSTRAINT "incident_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "registered_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_users" ADD CONSTRAINT "incident_users_check_in_id_fkey" FOREIGN KEY ("check_in_id") REFERENCES "check_ins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "registered_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "registered_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "inventories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "registered_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "registered_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_proposer_id_fkey" FOREIGN KEY ("proposer_id") REFERENCES "registered_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_comments" ADD CONSTRAINT "proposal_comments_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_comments" ADD CONSTRAINT "proposal_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "registered_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_likes" ADD CONSTRAINT "proposal_likes_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_likes" ADD CONSTRAINT "proposal_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "registered_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_comment_likes" ADD CONSTRAINT "proposal_comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "proposal_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_comment_likes" ADD CONSTRAINT "proposal_comment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "registered_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_reservable_id_fkey" FOREIGN KEY ("reservable_id") REFERENCES "registered_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_exceptions" ADD CONSTRAINT "reservation_exceptions_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "registered_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_fungible_resource_id_fkey" FOREIGN KEY ("fungible_resource_id") REFERENCES "fungible_resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
