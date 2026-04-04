-- Drop reservation functions (depend on timestamptz column types)
DROP FUNCTION IF EXISTS get_user_next_reservations(text, resource_types, integer, integer);
DROP FUNCTION IF EXISTS get_unavailable_slots(resource_types, timestamptz, timestamptz, text);
DROP FUNCTION IF EXISTS approve_reservation(text);
DROP FUNCTION IF EXISTS create_reservation(text, reservable_types, text, resource_types, event_types, text, timestamptz, timestamptz, boolean, text, timestamptz);
DROP FUNCTION IF EXISTS insert_into_ledger(text, timestamptz, timestamptz, reservable_types, text, text, event_types, text, integer, reservation_statuses);

-- Sessions & auth
ALTER TABLE "sessions" ALTER COLUMN "expires" DROP DEFAULT;
ALTER TABLE "sessions" ALTER COLUMN "expires" TYPE BIGINT USING (EXTRACT(EPOCH FROM "expires") * 1000)::bigint;

ALTER TABLE "users" ALTER COLUMN "email_verified" TYPE BIGINT USING (CASE WHEN "email_verified" IS NULL THEN NULL ELSE (EXTRACT(EPOCH FROM "email_verified") * 1000)::bigint END);

ALTER TABLE "verification_tokens" ALTER COLUMN "expires" TYPE BIGINT USING (EXTRACT(EPOCH FROM "expires") * 1000)::bigint;

-- Registered users
ALTER TABLE "registered_users" ALTER COLUMN "created_at" DROP DEFAULT;
ALTER TABLE "registered_users" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "registered_users" ALTER COLUMN "created_at" TYPE BIGINT USING (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint;
ALTER TABLE "registered_users" ALTER COLUMN "updated_at" TYPE BIGINT USING (EXTRACT(EPOCH FROM "updated_at") * 1000)::bigint;
ALTER TABLE "registered_users" ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);
ALTER TABLE "registered_users" ALTER COLUMN "updated_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

-- Bans
ALTER TABLE "bans" ALTER COLUMN "created_at" DROP DEFAULT;
ALTER TABLE "bans" ALTER COLUMN "start_time" TYPE BIGINT USING (EXTRACT(EPOCH FROM "start_time") * 1000)::bigint;
ALTER TABLE "bans" ALTER COLUMN "end_time" TYPE BIGINT USING (CASE WHEN "end_time" IS NULL THEN NULL ELSE (EXTRACT(EPOCH FROM "end_time") * 1000)::bigint END);
ALTER TABLE "bans" ALTER COLUMN "created_at" TYPE BIGINT USING (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint;
ALTER TABLE "bans" ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

-- Events
ALTER TABLE "events" ALTER COLUMN "created_at" DROP DEFAULT;
ALTER TABLE "events" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "events" ALTER COLUMN "start_time" TYPE BIGINT USING (EXTRACT(EPOCH FROM "start_time") * 1000)::bigint;
ALTER TABLE "events" ALTER COLUMN "end_time" TYPE BIGINT USING (EXTRACT(EPOCH FROM "end_time") * 1000)::bigint;
ALTER TABLE "events" ALTER COLUMN "created_at" TYPE BIGINT USING (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint;
ALTER TABLE "events" ALTER COLUMN "updated_at" TYPE BIGINT USING (EXTRACT(EPOCH FROM "updated_at") * 1000)::bigint;
ALTER TABLE "events" ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);
ALTER TABLE "events" ALTER COLUMN "updated_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

-- Incidents
ALTER TABLE "incidents" ALTER COLUMN "created_at" DROP DEFAULT;
ALTER TABLE "incidents" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "incidents" ALTER COLUMN "created_at" TYPE BIGINT USING (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint;
ALTER TABLE "incidents" ALTER COLUMN "updated_at" TYPE BIGINT USING (EXTRACT(EPOCH FROM "updated_at") * 1000)::bigint;
ALTER TABLE "incidents" ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);
ALTER TABLE "incidents" ALTER COLUMN "updated_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

-- Inventories & purchase orders
ALTER TABLE "inventories" ALTER COLUMN "created_at" DROP DEFAULT;
ALTER TABLE "inventories" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "inventories" ALTER COLUMN "created_at" TYPE BIGINT USING (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint;
ALTER TABLE "inventories" ALTER COLUMN "updated_at" TYPE BIGINT USING (EXTRACT(EPOCH FROM "updated_at") * 1000)::bigint;
ALTER TABLE "inventories" ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);
ALTER TABLE "inventories" ALTER COLUMN "updated_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

ALTER TABLE "purchase_orders" ALTER COLUMN "created_at" DROP DEFAULT;
ALTER TABLE "purchase_orders" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "purchase_orders" ALTER COLUMN "created_at" TYPE BIGINT USING (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint;
ALTER TABLE "purchase_orders" ALTER COLUMN "updated_at" TYPE BIGINT USING (EXTRACT(EPOCH FROM "updated_at") * 1000)::bigint;
ALTER TABLE "purchase_orders" ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);
ALTER TABLE "purchase_orders" ALTER COLUMN "updated_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

-- Organizations & teams
ALTER TABLE "organizations" ALTER COLUMN "created_at" DROP DEFAULT;
ALTER TABLE "organizations" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "organizations" ALTER COLUMN "created_at" TYPE BIGINT USING (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint;
ALTER TABLE "organizations" ALTER COLUMN "updated_at" TYPE BIGINT USING (EXTRACT(EPOCH FROM "updated_at") * 1000)::bigint;
ALTER TABLE "organizations" ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);
ALTER TABLE "organizations" ALTER COLUMN "updated_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

ALTER TABLE "teams" ALTER COLUMN "created_at" DROP DEFAULT;
ALTER TABLE "teams" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "teams" ALTER COLUMN "created_at" TYPE BIGINT USING (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint;
ALTER TABLE "teams" ALTER COLUMN "updated_at" TYPE BIGINT USING (EXTRACT(EPOCH FROM "updated_at") * 1000)::bigint;
ALTER TABLE "teams" ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);
ALTER TABLE "teams" ALTER COLUMN "updated_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

-- Proposals
ALTER TABLE "proposals" ALTER COLUMN "created_at" DROP DEFAULT;
ALTER TABLE "proposals" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "proposals" ALTER COLUMN "created_at" TYPE BIGINT USING (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint;
ALTER TABLE "proposals" ALTER COLUMN "updated_at" TYPE BIGINT USING (EXTRACT(EPOCH FROM "updated_at") * 1000)::bigint;
ALTER TABLE "proposals" ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);
ALTER TABLE "proposals" ALTER COLUMN "updated_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

ALTER TABLE "proposal_comments" ALTER COLUMN "created_at" DROP DEFAULT;
ALTER TABLE "proposal_comments" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "proposal_comments" ALTER COLUMN "created_at" TYPE BIGINT USING (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint;
ALTER TABLE "proposal_comments" ALTER COLUMN "updated_at" TYPE BIGINT USING (EXTRACT(EPOCH FROM "updated_at") * 1000)::bigint;
ALTER TABLE "proposal_comments" ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);
ALTER TABLE "proposal_comments" ALTER COLUMN "updated_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

-- Reservations stack
ALTER TABLE "reservations" ALTER COLUMN "created_at" DROP DEFAULT;
ALTER TABLE "reservations" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "reservations" ALTER COLUMN "start_time" TYPE BIGINT USING (EXTRACT(EPOCH FROM "start_time") * 1000)::bigint;
ALTER TABLE "reservations" ALTER COLUMN "end_time" TYPE BIGINT USING (EXTRACT(EPOCH FROM "end_time") * 1000)::bigint;
ALTER TABLE "reservations" ALTER COLUMN "recurrence_end" TYPE BIGINT USING (CASE WHEN "recurrence_end" IS NULL THEN NULL ELSE (EXTRACT(EPOCH FROM "recurrence_end") * 1000)::bigint END);
ALTER TABLE "reservations" ALTER COLUMN "created_at" TYPE BIGINT USING (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint;
ALTER TABLE "reservations" ALTER COLUMN "updated_at" TYPE BIGINT USING (EXTRACT(EPOCH FROM "updated_at") * 1000)::bigint;
ALTER TABLE "reservations" ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);
ALTER TABLE "reservations" ALTER COLUMN "updated_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

ALTER TABLE "reservation_exceptions" ALTER COLUMN "created_at" DROP DEFAULT;
ALTER TABLE "reservation_exceptions" ALTER COLUMN "exception_date" TYPE BIGINT USING (EXTRACT(EPOCH FROM "exception_date") * 1000)::bigint;
ALTER TABLE "reservation_exceptions" ALTER COLUMN "new_start_time" TYPE BIGINT USING (CASE WHEN "new_start_time" IS NULL THEN NULL ELSE (EXTRACT(EPOCH FROM "new_start_time") * 1000)::bigint END);
ALTER TABLE "reservation_exceptions" ALTER COLUMN "new_end_time" TYPE BIGINT USING (CASE WHEN "new_end_time" IS NULL THEN NULL ELSE (EXTRACT(EPOCH FROM "new_end_time") * 1000)::bigint END);
ALTER TABLE "reservation_exceptions" ALTER COLUMN "created_at" TYPE BIGINT USING (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint;
ALTER TABLE "reservation_exceptions" ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

ALTER TABLE "reservation_ledger" ALTER COLUMN "created_at" DROP DEFAULT;
ALTER TABLE "reservation_ledger" ALTER COLUMN "occurrence_start_time" TYPE BIGINT USING (EXTRACT(EPOCH FROM "occurrence_start_time") * 1000)::bigint;
ALTER TABLE "reservation_ledger" ALTER COLUMN "occurrence_end_time" TYPE BIGINT USING (EXTRACT(EPOCH FROM "occurrence_end_time") * 1000)::bigint;
ALTER TABLE "reservation_ledger" ALTER COLUMN "created_at" TYPE BIGINT USING (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint;
ALTER TABLE "reservation_ledger" ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

ALTER TABLE "check_ins" ALTER COLUMN "check_in_time" DROP DEFAULT;
ALTER TABLE "check_ins" ALTER COLUMN "created_at" DROP DEFAULT;
ALTER TABLE "check_ins" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "check_ins" ALTER COLUMN "check_in_time" TYPE BIGINT USING (EXTRACT(EPOCH FROM "check_in_time") * 1000)::bigint;
ALTER TABLE "check_ins" ALTER COLUMN "check_out_time" TYPE BIGINT USING (CASE WHEN "check_out_time" IS NULL THEN NULL ELSE (EXTRACT(EPOCH FROM "check_out_time") * 1000)::bigint END);
ALTER TABLE "check_ins" ALTER COLUMN "created_at" TYPE BIGINT USING (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint;
ALTER TABLE "check_ins" ALTER COLUMN "updated_at" TYPE BIGINT USING (EXTRACT(EPOCH FROM "updated_at") * 1000)::bigint;
ALTER TABLE "check_ins" ALTER COLUMN "check_in_time" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);
ALTER TABLE "check_ins" ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);
ALTER TABLE "check_ins" ALTER COLUMN "updated_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

-- Resources
ALTER TABLE "fungible_resources" ALTER COLUMN "created_at" DROP DEFAULT;
ALTER TABLE "fungible_resources" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "fungible_resources" ALTER COLUMN "created_at" TYPE BIGINT USING (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint;
ALTER TABLE "fungible_resources" ALTER COLUMN "updated_at" TYPE BIGINT USING (EXTRACT(EPOCH FROM "updated_at") * 1000)::bigint;
ALTER TABLE "fungible_resources" ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);
ALTER TABLE "fungible_resources" ALTER COLUMN "updated_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

ALTER TABLE "resources" ALTER COLUMN "created_at" DROP DEFAULT;
ALTER TABLE "resources" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "resources" ALTER COLUMN "created_at" TYPE BIGINT USING (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint;
ALTER TABLE "resources" ALTER COLUMN "updated_at" TYPE BIGINT USING (EXTRACT(EPOCH FROM "updated_at") * 1000)::bigint;
ALTER TABLE "resources" ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);
ALTER TABLE "resources" ALTER COLUMN "updated_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

-- Rate limits & password reset (camelCase columns)
ALTER TABLE "rate_limits" ALTER COLUMN "windowStart" DROP DEFAULT;
ALTER TABLE "rate_limits" ALTER COLUMN "createdAt" DROP DEFAULT;
ALTER TABLE "rate_limits" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "rate_limits" ALTER COLUMN "windowStart" TYPE BIGINT USING (EXTRACT(EPOCH FROM "windowStart") * 1000)::bigint;
ALTER TABLE "rate_limits" ALTER COLUMN "blockedUntil" TYPE BIGINT USING (CASE WHEN "blockedUntil" IS NULL THEN NULL ELSE (EXTRACT(EPOCH FROM "blockedUntil") * 1000)::bigint END);
ALTER TABLE "rate_limits" ALTER COLUMN "createdAt" TYPE BIGINT USING (EXTRACT(EPOCH FROM "createdAt") * 1000)::bigint;
ALTER TABLE "rate_limits" ALTER COLUMN "updatedAt" TYPE BIGINT USING (EXTRACT(EPOCH FROM "updatedAt") * 1000)::bigint;
ALTER TABLE "rate_limits" ALTER COLUMN "windowStart" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);
ALTER TABLE "rate_limits" ALTER COLUMN "createdAt" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);
ALTER TABLE "rate_limits" ALTER COLUMN "updatedAt" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

ALTER TABLE "password_reset_tokens" ALTER COLUMN "createdAt" DROP DEFAULT;
ALTER TABLE "password_reset_tokens" ALTER COLUMN "expiresAt" TYPE BIGINT USING (EXTRACT(EPOCH FROM "expiresAt") * 1000)::bigint;
ALTER TABLE "password_reset_tokens" ALTER COLUMN "usedAt" TYPE BIGINT USING (CASE WHEN "usedAt" IS NULL THEN NULL ELSE (EXTRACT(EPOCH FROM "usedAt") * 1000)::bigint END);
ALTER TABLE "password_reset_tokens" ALTER COLUMN "createdAt" TYPE BIGINT USING (EXTRACT(EPOCH FROM "createdAt") * 1000)::bigint;
ALTER TABLE "password_reset_tokens" ALTER COLUMN "createdAt" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

-- updated_at triggers (Prisma @updatedAt replacement)
CREATE OR REPLACE FUNCTION trg_set_updated_at_ms()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_set_rate_limits_updated_at_ms()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_registered_users_updated_at ON registered_users;
CREATE TRIGGER set_registered_users_updated_at
  BEFORE UPDATE ON registered_users
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at_ms();

DROP TRIGGER IF EXISTS set_events_updated_at ON events;
CREATE TRIGGER set_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at_ms();

DROP TRIGGER IF EXISTS set_incidents_updated_at ON incidents;
CREATE TRIGGER set_incidents_updated_at
  BEFORE UPDATE ON incidents
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at_ms();

DROP TRIGGER IF EXISTS set_inventories_updated_at ON inventories;
CREATE TRIGGER set_inventories_updated_at
  BEFORE UPDATE ON inventories
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at_ms();

DROP TRIGGER IF EXISTS set_purchase_orders_updated_at ON purchase_orders;
CREATE TRIGGER set_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at_ms();

DROP TRIGGER IF EXISTS set_organizations_updated_at ON organizations;
CREATE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at_ms();

DROP TRIGGER IF EXISTS set_teams_updated_at ON teams;
CREATE TRIGGER set_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at_ms();

DROP TRIGGER IF EXISTS set_proposals_updated_at ON proposals;
CREATE TRIGGER set_proposals_updated_at
  BEFORE UPDATE ON proposals
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at_ms();

DROP TRIGGER IF EXISTS set_proposal_comments_updated_at ON proposal_comments;
CREATE TRIGGER set_proposal_comments_updated_at
  BEFORE UPDATE ON proposal_comments
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at_ms();

DROP TRIGGER IF EXISTS set_reservations_updated_at ON reservations;
CREATE TRIGGER set_reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at_ms();

DROP TRIGGER IF EXISTS set_check_ins_updated_at ON check_ins;
CREATE TRIGGER set_check_ins_updated_at
  BEFORE UPDATE ON check_ins
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at_ms();

DROP TRIGGER IF EXISTS set_fungible_resources_updated_at ON fungible_resources;
CREATE TRIGGER set_fungible_resources_updated_at
  BEFORE UPDATE ON fungible_resources
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at_ms();

DROP TRIGGER IF EXISTS set_resources_updated_at ON resources;
CREATE TRIGGER set_resources_updated_at
  BEFORE UPDATE ON resources
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at_ms();

DROP TRIGGER IF EXISTS set_rate_limits_updated_at ON rate_limits;
CREATE TRIGGER set_rate_limits_updated_at
  BEFORE UPDATE ON rate_limits
  FOR EACH ROW EXECUTE FUNCTION trg_set_rate_limits_updated_at_ms();

-- Recreate functions (bigint epoch ms)
CREATE OR REPLACE FUNCTION get_actor_size(_type reservable_types, _id text)
RETURNS int AS $$
DECLARE
  size int := 1;
BEGIN
  IF _type = 'USER' THEN
    RETURN 1;
  ELSIF _type = 'TEAM' THEN
    SELECT COUNT(*) INTO size FROM team_members WHERE team_id = _id;
  ELSIF _type = 'ORGANIZATION' THEN
    SELECT COUNT(*) INTO size FROM org_memberships WHERE organization_id = _id;
  ELSE
    size := 1;
  END IF;

  RETURN COALESCE(size, 1);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION insert_into_ledger(
  _reservation_id text,
  _occurrence_start_ms bigint,
  _occurrence_end_ms bigint,
  _reservable_type reservable_types,
  _reservable_id text,
  _resource_id text,
  _event_type event_types,
  _reason text,
  _actor_size int,
  _status reservation_statuses
)
RETURNS void AS $$
DECLARE
  bucket_ms bigint;
  step_ms bigint := 900000;
BEGIN
  IF _occurrence_end_ms <= _occurrence_start_ms THEN
    RETURN;
  END IF;

  FOR bucket_ms IN
    SELECT gs FROM generate_series(
      _occurrence_start_ms,
      _occurrence_end_ms - 1,
      step_ms
    ) AS gs
    WHERE gs < _occurrence_end_ms
  LOOP
    INSERT INTO reservation_ledger (
      id, reservation_id, occurrence_start_time, occurrence_end_time,
      reservable_type, reservable_id, resource_id, event_type,
      reason, actor_size, status
    )
    VALUES (
      nextval('reservation_ledger_id_seq'), _reservation_id, bucket_ms, bucket_ms + step_ms,
      _reservable_type, _reservable_id, _resource_id,
      _event_type, _reason, _actor_size, _status
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_reservation(
  _reservation_id text,
  _reservable_type reservable_types,
  _reservable_id text,
  _resource_type resource_types,
  _event_type event_types,
  _reason text,
  _start_ms bigint,
  _end_ms bigint,
  _is_recurring boolean DEFAULT false,
  _rrule text DEFAULT NULL,
  _recurrence_end_ms bigint DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  actor_size int;
  chosen_resource text;
  cap int;
  exclusive boolean;
  overlap int;
  occ_ms bigint;
  duration_ms bigint;
  recurrence_cap_ms bigint;
  year_cap_ms bigint;
  step_interval interval;
  now_ms bigint;
BEGIN
  now_ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
  duration_ms := _end_ms - _start_ms;
  IF duration_ms <= 0 THEN
    RAISE EXCEPTION 'Invalid reservation window';
  END IF;

  year_cap_ms := 365::bigint * 86400000;

  SELECT get_actor_size(_reservable_type, _reservable_id)
  INTO actor_size;

  FOR chosen_resource, cap, exclusive IN
    SELECT
      r.id,
      COALESCE(fr.capacity, 1) AS capacity,
      COALESCE(fr.is_exclusive, true) AS is_exclusive
    FROM resources r
    LEFT JOIN fungible_resources fr ON fr.id = r.fungible_resource_id
    WHERE r.type = _resource_type
    ORDER BY r.id
  LOOP
    IF exclusive THEN
      SELECT COUNT(*) INTO overlap
      FROM reservation_ledger l
      WHERE l.resource_id = chosen_resource
        AND l.status = 'APPROVED'
        AND l.occurrence_start_time < _end_ms
        AND l.occurrence_end_time > _start_ms;

      IF overlap = 0 THEN
        EXIT;
      END IF;

    ELSE
      SELECT COALESCE(SUM(l.actor_size), 0)
        INTO overlap
      FROM reservation_ledger l
      WHERE l.resource_id = chosen_resource
        AND l.status = 'APPROVED'
        AND l.occurrence_start_time < _end_ms
        AND l.occurrence_end_time > _start_ms;

      IF (overlap + actor_size) <= cap THEN
        EXIT;
      END IF;
    END IF;
  END LOOP;

  IF chosen_resource IS NULL THEN
    RAISE EXCEPTION 'No available % resource for the given time window', _resource_type;
  END IF;

  IF NOT _is_recurring THEN
    INSERT INTO reservations (
      id, reservable_type, reservable_id, resource_id,
      event_type, reason, start_time, end_time,
      is_recurring, rrule, recurrence_end, status,
      created_at, updated_at
    )
    VALUES (
      _reservation_id, _reservable_type, _reservable_id, chosen_resource,
      _event_type, _reason, _start_ms, _end_ms,
      false, NULL, NULL, 'PENDING',
      now_ms, now_ms
    );

    PERFORM insert_into_ledger(_reservation_id, _start_ms, _end_ms, _reservable_type, _reservable_id, chosen_resource, _event_type, _reason, actor_size, 'PENDING');

    RETURN;
  END IF;

  INSERT INTO reservations (
    id, reservable_type, reservable_id, resource_id,
    event_type, reason, start_time, end_time,
    is_recurring, rrule, recurrence_end, status,
    created_at, updated_at
  )
  VALUES (
    _reservation_id, _reservable_type, _reservable_id, chosen_resource,
    _event_type, _reason, _start_ms, _end_ms,
    true, _rrule, _recurrence_end_ms, 'PENDING',
    now_ms, now_ms
  );

  IF _rrule ILIKE '%DAILY%' THEN
    step_interval := interval '1 day';
  ELSIF _rrule ILIKE '%WEEKLY%' THEN
    step_interval := interval '1 week';
  ELSIF _rrule ILIKE '%MONTHLY%' THEN
    step_interval := interval '1 month';
  ELSIF _rrule ILIKE '%YEARLY%' THEN
    step_interval := interval '1 year';
  ELSE
    step_interval := interval '1 day';
  END IF;

  recurrence_cap_ms := LEAST(
    COALESCE(_recurrence_end_ms, _start_ms + year_cap_ms),
    _start_ms + year_cap_ms
  );

  occ_ms := _start_ms;
  WHILE occ_ms <= recurrence_cap_ms LOOP
    SELECT COUNT(*) INTO overlap
    FROM reservation_ledger l
    WHERE l.resource_id = chosen_resource
      AND l.status = 'APPROVED'
      AND l.occurrence_start_time < (occ_ms + duration_ms)
      AND l.occurrence_end_time > occ_ms;

    IF exclusive AND overlap > 0 THEN
      RAISE EXCEPTION 'Conflict on %', occ_ms;
    ELSIF NOT exclusive AND (overlap + actor_size) > cap THEN
      RAISE EXCEPTION 'Capacity exceeded on %', occ_ms;
    END IF;

    PERFORM insert_into_ledger(_reservation_id, occ_ms, occ_ms + duration_ms, _reservable_type, _reservable_id, chosen_resource, _event_type, _reason, actor_size, 'PENDING');

    EXIT WHEN occ_ms >= recurrence_cap_ms;
    occ_ms := (EXTRACT(EPOCH FROM (to_timestamp(occ_ms / 1000.0) + step_interval)) * 1000)::bigint;
    IF occ_ms <= _start_ms THEN
      EXIT;
    END IF;
  END LOOP;

END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION approve_reservation(_reservation_id text)
RETURNS TABLE(approved_id text, auto_rejected_ids text) AS $$
DECLARE
  res RECORD;
  cap int;
  exclusive boolean;
  used int;
  overlap RECORD;
  rejected_ids text[];
  now_ms bigint;
BEGIN
  now_ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
  rejected_ids := ARRAY[]::text[];

  SELECT r.id AS reservation_id,
         r.resource_id,
         r.start_time,
         r.end_time,
         COALESCE(fr.capacity, 1) AS capacity,
         COALESCE(fr.is_exclusive, true) AS is_exclusive
  INTO res
  FROM reservations r
  LEFT JOIN fungible_resources fr ON fr.id = (
    SELECT fungible_resource_id FROM resources WHERE id = r.resource_id
  )
  WHERE r.id = _reservation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation % not found', _reservation_id;
  END IF;

  cap := res.capacity;
  exclusive := res.is_exclusive;

  UPDATE reservations
    SET status = 'APPROVED', updated_at = now_ms
    WHERE id = _reservation_id;

  UPDATE reservation_ledger
    SET status = 'APPROVED'
    WHERE reservation_id = _reservation_id;

  FOR overlap IN
    SELECT rl.reservation_id,
           SUM(rl.actor_size) AS total_size
    FROM reservation_ledger rl
    WHERE rl.resource_id = res.resource_id
      AND rl.status = 'PENDING'
      AND rl.occurrence_start_time < res.end_time
      AND rl.occurrence_end_time > res.start_time
    GROUP BY rl.reservation_id
  LOOP
    IF exclusive THEN
      UPDATE reservations SET status = 'REJECTED', updated_at = now_ms
        WHERE id = overlap.reservation_id;
      UPDATE reservation_ledger SET status = 'REJECTED'
        WHERE reservation_id = overlap.reservation_id;
      rejected_ids := array_append(rejected_ids, overlap.reservation_id);
    ELSE
      SELECT COALESCE(SUM(actor_size), 0)
      INTO used
      FROM reservation_ledger
      WHERE resource_id = res.resource_id
        AND status = 'APPROVED'
        AND occurrence_start_time < res.end_time
        AND occurrence_end_time > res.start_time;

      IF (used + overlap.total_size) > cap THEN
        UPDATE reservations
          SET status = 'REJECTED', updated_at = now_ms
          WHERE id = overlap.reservation_id;

        UPDATE reservation_ledger
          SET status = 'REJECTED'
          WHERE reservation_id = overlap.reservation_id;
        rejected_ids := array_append(rejected_ids, overlap.reservation_id);
      END IF;
    END IF;
  END LOOP;

  RETURN QUERY SELECT _reservation_id, array_to_string(rejected_ids, ',');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_unavailable_slots(
  _resource_type resource_types,
  _from_ms bigint,
  _to_ms bigint,
  _exclude_user_id text DEFAULT NULL
)
RETURNS TABLE (
  resource_id text,
  start_time bigint,
  end_time bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH ledger_data AS (
    SELECT
      r.id AS resource_id,
      COALESCE(fr.capacity, 1) AS capacity,
      COALESCE(fr.is_exclusive, true) AS is_exclusive,
      l.occurrence_start_time,
      l.occurrence_end_time,
      SUM(l.actor_size) OVER (
        PARTITION BY r.id
        ORDER BY l.occurrence_start_time
        RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
      ) AS total_used
    FROM reservation_ledger l
    JOIN resources r ON r.id = l.resource_id
    LEFT JOIN fungible_resources fr ON fr.id = r.fungible_resource_id
    WHERE r.type = _resource_type
      AND l.status = 'APPROVED'
      AND l.occurrence_start_time < _to_ms
      AND l.occurrence_end_time > _from_ms
      AND (_exclude_user_id IS NULL OR l.reservable_id != _exclude_user_id)
  )
  SELECT DISTINCT
    l.resource_id,
    occurrence_start_time AS start_time,
    occurrence_end_time AS end_time
  FROM ledger_data l
  WHERE
    (is_exclusive = true)
    OR (total_used >= capacity)
  ORDER BY start_time;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_user_next_reservations(
  _user_id text,
  _resource_type resource_types,
  _limit int DEFAULT 10,
  _offset int DEFAULT 0
)
RETURNS TABLE (
  id text,
  reservation_id text,
  occurrence_start_time bigint,
  occurrence_end_time bigint,
  reservable_type reservable_types,
  reservable_id text,
  resource_id text,
  event_type event_types,
  reason text,
  actor_size int,
  status reservation_statuses,
  created_at bigint
) AS $$
DECLARE
  now_ms bigint;
BEGIN
  now_ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;

  RETURN QUERY
  WITH expanded_reservations AS (
    SELECT
      r.id::text AS id,
      r.id::text AS reservation_id,
      r.start_time AS occurrence_start_time,
      r.end_time AS occurrence_end_time,
      r.reservable_type,
      r.reservable_id,
      r.resource_id,
      r.event_type,
      r.reason,
      get_actor_size(r.reservable_type, r.reservable_id) AS actor_size,
      r.status,
      r.created_at
    FROM reservations r
    JOIN resources res ON res.id = r.resource_id
    WHERE r.reservable_type = 'USER'
      AND (_resource_type IS NULL OR res.type = _resource_type)
      AND r.reservable_id = _user_id
      AND r.is_recurring = false
      AND r.start_time >= now_ms

    UNION ALL

    SELECT
      (r.id || '_' || (EXTRACT(EPOCH FROM occ_start) * 1000)::bigint::text) AS id,
      r.id::text AS reservation_id,
      (EXTRACT(EPOCH FROM occ_start) * 1000)::bigint AS occurrence_start_time,
      (EXTRACT(EPOCH FROM occ_start) * 1000)::bigint + (r.end_time - r.start_time) AS occurrence_end_time,
      r.reservable_type,
      r.reservable_id,
      r.resource_id,
      r.event_type,
      r.reason,
      get_actor_size(r.reservable_type, r.reservable_id) AS actor_size,
      r.status,
      r.created_at
    FROM reservations r
    CROSS JOIN LATERAL generate_series(
      to_timestamp(r.start_time / 1000.0),
      LEAST(
        CASE
          WHEN r.recurrence_end IS NULL THEN to_timestamp(r.start_time / 1000.0) + interval '1 year'
          ELSE to_timestamp(r.recurrence_end / 1000.0)
        END,
        to_timestamp(r.start_time / 1000.0) + interval '1 year'
      ),
      CASE
        WHEN r.rrule ILIKE '%DAILY%' THEN interval '1 day'
        WHEN r.rrule ILIKE '%WEEKLY%' THEN interval '1 week'
        WHEN r.rrule ILIKE '%MONTHLY%' THEN interval '1 month'
        WHEN r.rrule ILIKE '%YEARLY%' THEN interval '1 year'
        ELSE interval '1 day'
      END
    ) AS occ_start
    JOIN resources res ON res.id = r.resource_id
    WHERE r.reservable_type = 'USER'
      AND (_resource_type IS NULL OR res.type = _resource_type)
      AND r.reservable_id = _user_id
      AND r.is_recurring = true
      AND (EXTRACT(EPOCH FROM occ_start) * 1000)::bigint >= now_ms
      AND occ_start <= LEAST(
        CASE
          WHEN r.recurrence_end IS NULL THEN to_timestamp(r.start_time / 1000.0) + interval '1 year'
          ELSE to_timestamp(r.recurrence_end / 1000.0)
        END,
        to_timestamp(r.start_time / 1000.0) + interval '1 year'
      )
  )
  SELECT
    er.id,
    er.reservation_id,
    er.occurrence_start_time,
    er.occurrence_end_time,
    er.reservable_type,
    er.reservable_id,
    er.resource_id,
    er.event_type,
    er.reason,
    er.actor_size,
    er.status,
    er.created_at
  FROM expanded_reservations er
  ORDER BY er.occurrence_start_time ASC
  LIMIT _limit
  OFFSET _offset;
END;
$$ LANGUAGE plpgsql;
