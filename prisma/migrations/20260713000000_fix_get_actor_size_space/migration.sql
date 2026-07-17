-- ============================================================================
-- Fix get_actor_size() for EVENT reservables.
--
-- The 20260706000000_unify_space_resource migration renamed events.resource_id
-- -> events.space_id, moved capacity onto spaces, and dropped fungible_resources.
-- It rewrote every reservation SQL function EXCEPT get_actor_size(), whose EVENT
-- branch still joined `events.resource_id` / `fungible_resources`. As a result
-- ANY EVENT ledger operation (rebuild_reservation_ledger_forward, the cron
-- maintain_reservations, and the reschedule guard reservation_window_conflicts)
-- failed with: column e.resource_id does not exist.
--
-- An EVENT still occupies its space's full capacity, so read it from spaces.
-- ============================================================================
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
  ELSIF _type = 'EVENT' THEN
    SELECT COALESCE(s.capacity, 1) INTO size
    FROM events e
    JOIN spaces s ON s.id = e.space_id
    WHERE e.id = _id;
  ELSE
    size := 1;
  END IF;

  RETURN COALESCE(size, 1);
END;
$$ LANGUAGE plpgsql;
