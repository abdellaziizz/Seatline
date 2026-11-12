-- =============================================================================
-- Seatline: migration 0001, DOWN (drops everything 0001_init.up.sql created)
-- Destroys all data. Use only in dev/test.
-- =============================================================================
-- No BEGIN/COMMIT here: the runner wraps the file in one transaction
-- (Kysely Migrator does; with psql use --single-transaction / -1).

DROP VIEW  IF EXISTS event_seats_effective;

DROP TABLE IF EXISTS webhook_events;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS tickets;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS event_seats;
DROP TABLE IF EXISTS holds;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS users;

DROP FUNCTION IF EXISTS set_updated_at();
DROP FUNCTION IF EXISTS app_now();

DROP TYPE IF EXISTS payment_status;
DROP TYPE IF EXISTS order_status;
DROP TYPE IF EXISTS hold_status;
DROP TYPE IF EXISTS seat_status;
DROP TYPE IF EXISTS event_status;
DROP TYPE IF EXISTS user_role;

-- citext is left installed on purpose (other schemas may use it).

