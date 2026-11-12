-- =============================================================================
-- Seatline: initial schema (migration 0001, UP)
-- Target: PostgreSQL 18
--
-- Ground rules this schema enforces:
--   * PostgreSQL is the ONLY source of truth for seats, holds, orders, tickets.
--     Redis never decides whether a seat can be sold.
--   * A seat can be sold at most once:  tickets UNIQUE (event_id, seat_id).
--   * Hold expiry is LAZY: an expired hold counts as "available" in every
--     query predicate, so correctness never depends on the sweeper.
--   * All money is stored in minor units (integer piastres/cents), never float.
--   * All timestamps are timestamptz and are compared against the DATABASE
--     clock (app_now()), never the Node.js clock.
-- =============================================================================

-- No BEGIN/COMMIT here: the runner wraps the file in one transaction
-- (Kysely Migrator does; with psql use --single-transaction / -1).

-- -----------------------------------------------------------------------------
-- 0. Extensions
-- -----------------------------------------------------------------------------
-- citext: case-insensitive email so "Ahmed@x.com" and "ahmed@x.com" collide.
CREATE EXTENSION IF NOT EXISTS citext;
-- uuidv7() is built into PostgreSQL 18 (time-ordered UUIDs, index-friendly).
-- No extension needed.

-- -----------------------------------------------------------------------------
-- 1. Enum types
--    (Adding a value later: ALTER TYPE ... ADD VALUE 'x'; in its own migration.)
-- -----------------------------------------------------------------------------
CREATE TYPE user_role      AS ENUM ('customer', 'organiser', 'admin');
CREATE TYPE event_status   AS ENUM ('draft', 'published', 'cancelled');
CREATE TYPE seat_status    AS ENUM ('available', 'held', 'sold');
CREATE TYPE hold_status    AS ENUM ('active', 'released', 'converted', 'expired');
CREATE TYPE order_status   AS ENUM ('pending', 'paid', 'failed', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

-- -----------------------------------------------------------------------------
-- 2. Helper functions
-- -----------------------------------------------------------------------------

-- 2a. Controllable clock.
--     Production: never set the GUC -> returns now() (transaction start time).
--     Tests:      SET seatline.fake_now = '2030-01-01 12:00:00+00';
--                 (or SET LOCAL inside a transaction) to time-travel.
--     Every expiry predicate in the app MUST use app_now(), not now() and
--     not a timestamp computed in Node.
CREATE FUNCTION app_now() RETURNS timestamptz
LANGUAGE sql STABLE PARALLEL SAFE
AS $$
  SELECT COALESCE(
           NULLIF(current_setting('seatline.fake_now', true), '')::timestamptz,
           now()
         );
$$;

-- 2b. Generic updated_at maintenance.
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. users
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id             uuid        PRIMARY KEY DEFAULT uuidv7(),
  email          citext      NOT NULL,
  password_hash  text        NOT NULL,           -- argon2id / bcrypt, never plain
  display_name   text        NOT NULL,
  role           user_role   NOT NULL DEFAULT 'customer',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT users_email_key       UNIQUE (email),
  CONSTRAINT users_email_format    CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT users_display_name_len CHECK (char_length(display_name) BETWEEN 1 AND 100)
);

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. events
--    organiser_id gives the ownership check: organisers manage only their events
--    (WHERE id = $1 AND organiser_id = $currentUser).
-- -----------------------------------------------------------------------------
CREATE TABLE events (
  id            uuid         PRIMARY KEY DEFAULT uuidv7(),
  organiser_id  uuid         NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  name          text         NOT NULL,
  description   text         NOT NULL DEFAULT '',
  venue_name    text         NOT NULL,
  currency      char(3)      NOT NULL DEFAULT 'EGP',
  status        event_status NOT NULL DEFAULT 'draft',
  starts_at     timestamptz  NOT NULL,
  on_sale_at    timestamptz  NOT NULL,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT events_name_len         CHECK (char_length(name) BETWEEN 1 AND 200),
  CONSTRAINT events_currency_format  CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT events_sale_before_start CHECK (on_sale_at < starts_at)
);

-- Public listing: published events ordered by start time, keyset-paginated
-- with (starts_at, id) as the cursor.
CREATE INDEX events_published_starts_at_idx
  ON events (starts_at, id)
  WHERE status = 'published';

-- Organiser dashboard: "my events".
CREATE INDEX events_organiser_id_idx ON events (organiser_id, starts_at);

CREATE TRIGGER events_set_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. holds
--    One row per POST /events/:id/holds call. Gives DELETE /holds/:id a real
--    resource, links seats held together, and lets checkout reference a hold.
--    The authoritative "is this seat held?" answer still lives on event_seats.
-- -----------------------------------------------------------------------------
CREATE TABLE holds (
  id          uuid        PRIMARY KEY DEFAULT uuidv7(),
  event_id    uuid        NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES users (id)  ON DELETE CASCADE,
  status      hold_status NOT NULL DEFAULT 'active',
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- Target for the composite FK from event_seats (same event + same user).
  CONSTRAINT holds_id_event_user_key UNIQUE (id, event_id, user_id)
);

CREATE INDEX holds_user_id_idx ON holds (user_id, created_at DESC);
CREATE INDEX holds_active_expires_idx ON holds (expires_at) WHERE status = 'active';

CREATE TRIGGER holds_set_updated_at
  BEFORE UPDATE ON holds
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 6. event_seats  (the hot table)
--    Composite PK (event_id, seat_id) is exactly what the atomic hold
--    UPDATE ... WHERE event_id = $e AND seat_id = ANY($ids) needs.
-- -----------------------------------------------------------------------------
CREATE TABLE event_seats (
  event_id     uuid        NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  seat_id      integer     NOT NULL,          -- unique within one event
  section      text        NOT NULL,
  row          text        NOT NULL,
  number       integer     NOT NULL,
  price_minor  integer     NOT NULL,
  status       seat_status NOT NULL DEFAULT 'available',
  hold_id      uuid,
  held_by      uuid,
  held_until   timestamptz,
  version      integer     NOT NULL DEFAULT 0,  -- for the optimistic-locking variant
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT event_seats_pkey PRIMARY KEY (event_id, seat_id),
  CONSTRAINT event_seats_position_key UNIQUE (event_id, section, row, number),

  CONSTRAINT event_seats_seat_id_positive CHECK (seat_id > 0),
  CONSTRAINT event_seats_number_positive  CHECK (number > 0),
  CONSTRAINT event_seats_price_nonneg     CHECK (price_minor >= 0),

  -- State machine integrity: the hold columns are all set iff status = 'held'.
  -- (A 'held' row with held_until in the past is an EXPIRED hold and is
  --  treated as available by every predicate; that is intentional.)
  CONSTRAINT event_seats_hold_fields_consistent CHECK (
    (status = 'held'
       AND hold_id IS NOT NULL AND held_by IS NOT NULL AND held_until IS NOT NULL)
    OR
    (status IN ('available', 'sold')
       AND hold_id IS NULL AND held_by IS NULL AND held_until IS NULL)
  ),

  -- A seat can only be held by a hold of the SAME event and the SAME user.
  -- (MATCH SIMPLE: not checked while the columns are NULL.)
  CONSTRAINT event_seats_hold_fk
    FOREIGN KEY (hold_id, event_id, held_by)
    REFERENCES holds (id, event_id, user_id)
    ON DELETE RESTRICT
) WITH (fillfactor = 85);  -- free space per page so status flips can be HOT updates

-- Expiry sweeper: find expired holds fast, oldest first.
CREATE INDEX event_seats_held_until_idx
  ON event_seats (held_until)
  WHERE status = 'held';

-- Release / checkout by hold: "all seats of hold X".
CREATE INDEX event_seats_hold_id_idx
  ON event_seats (hold_id)
  WHERE hold_id IS NOT NULL;

-- Seat-map query (GET /events/:id/seats ORDER BY section, row, number) is
-- served by event_seats_position_key above. Record its EXPLAIN in docs.

-- -----------------------------------------------------------------------------
-- 7. orders
--    Idempotent checkout: UNIQUE (user_id, idempotency_key).
--    request_hash lets you detect "same key, different body" -> 422.
--    hold_id UNIQUE: one hold can become at most one order.
-- -----------------------------------------------------------------------------
CREATE TABLE orders (
  id               uuid         PRIMARY KEY DEFAULT uuidv7(),
  user_id          uuid         NOT NULL REFERENCES users (id)  ON DELETE RESTRICT,
  event_id         uuid         NOT NULL REFERENCES events (id) ON DELETE RESTRICT,
  hold_id          uuid         REFERENCES holds (id) ON DELETE SET NULL,
  status           order_status NOT NULL DEFAULT 'pending',
  total_minor      integer      NOT NULL,
  currency         char(3)      NOT NULL,
  idempotency_key  text         NOT NULL,
  request_hash     text         NOT NULL,      -- e.g. sha256 of the canonical JSON body
  failure_reason   text,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now(),
  paid_at          timestamptz,

  CONSTRAINT orders_user_idempotency_key UNIQUE (user_id, idempotency_key),
  CONSTRAINT orders_hold_id_key          UNIQUE (hold_id),
  CONSTRAINT orders_total_nonneg         CHECK (total_minor >= 0),
  CONSTRAINT orders_idem_key_len         CHECK (char_length(idempotency_key) BETWEEN 8 AND 200),
  CONSTRAINT orders_paid_at_consistent   CHECK ((status = 'paid') = (paid_at IS NOT NULL))
);

CREATE INDEX orders_user_id_idx  ON orders (user_id, created_at DESC);
CREATE INDEX orders_event_id_idx ON orders (event_id);

CREATE TRIGGER orders_set_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 8. order_items  (price snapshot at purchase time)
-- -----------------------------------------------------------------------------
CREATE TABLE order_items (
  order_id     uuid    NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  event_id     uuid    NOT NULL,
  seat_id      integer NOT NULL,
  price_minor  integer NOT NULL,

  CONSTRAINT order_items_pkey PRIMARY KEY (order_id, seat_id),
  CONSTRAINT order_items_seat_fk
    FOREIGN KEY (event_id, seat_id) REFERENCES event_seats (event_id, seat_id)
    ON DELETE RESTRICT,
  CONSTRAINT order_items_price_nonneg CHECK (price_minor >= 0)
);

CREATE INDEX order_items_event_seat_idx ON order_items (event_id, seat_id);

-- -----------------------------------------------------------------------------
-- 9. tickets  -- THE LAST LINE OF DEFENCE
--    Even if every application check is wrong, the database refuses a second
--    ticket for the same seat. Your "remove this constraint and the
--    concurrency test fails" demo targets tickets_event_seat_key by name.
-- -----------------------------------------------------------------------------
CREATE TABLE tickets (
  id         uuid        PRIMARY KEY DEFAULT uuidv7(),
  order_id   uuid        NOT NULL REFERENCES orders (id) ON DELETE RESTRICT,
  user_id    uuid        NOT NULL REFERENCES users (id)  ON DELETE RESTRICT,
  event_id   uuid        NOT NULL,
  seat_id    integer     NOT NULL,
  code       text        NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  issued_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tickets_event_seat_key UNIQUE (event_id, seat_id),
  CONSTRAINT tickets_code_key       UNIQUE (code),
  CONSTRAINT tickets_seat_fk
    FOREIGN KEY (event_id, seat_id) REFERENCES event_seats (event_id, seat_id)
    ON DELETE RESTRICT
);

CREATE INDEX tickets_order_id_idx ON tickets (order_id);
CREATE INDEX tickets_user_id_idx  ON tickets (user_id, issued_at DESC);

-- -----------------------------------------------------------------------------
-- 10. payments  (fake provider)
-- -----------------------------------------------------------------------------
CREATE TABLE payments (
  id                   uuid           PRIMARY KEY DEFAULT uuidv7(),
  order_id             uuid           NOT NULL REFERENCES orders (id) ON DELETE RESTRICT,
  provider             text           NOT NULL DEFAULT 'fakepay',
  provider_payment_id  text,                     -- set when provider accepts the intent
  status               payment_status NOT NULL DEFAULT 'pending',
  amount_minor         integer        NOT NULL,
  currency             char(3)        NOT NULL,
  created_at           timestamptz    NOT NULL DEFAULT now(),
  updated_at           timestamptz    NOT NULL DEFAULT now(),

  CONSTRAINT payments_provider_payment_key UNIQUE (provider, provider_payment_id),
  CONSTRAINT payments_amount_nonneg CHECK (amount_minor >= 0)
);

-- At most one successful payment per order (no double charge recorded).
CREATE UNIQUE INDEX payments_one_success_per_order
  ON payments (order_id)
  WHERE status = 'succeeded';

CREATE INDEX payments_order_id_idx ON payments (order_id);

CREATE TRIGGER payments_set_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 11. webhook_events  (signed callbacks from the fake provider)
--     Only store callbacks whose signature verified. UNIQUE provider_event_id
--     makes webhook processing idempotent: a replayed callback hits
--     ON CONFLICT DO NOTHING and is acknowledged without side effects.
-- -----------------------------------------------------------------------------
CREATE TABLE webhook_events (
  id                 uuid        PRIMARY KEY DEFAULT uuidv7(),
  provider           text        NOT NULL DEFAULT 'fakepay',
  provider_event_id  text        NOT NULL,
  event_type         text        NOT NULL,
  payload            jsonb       NOT NULL,
  received_at        timestamptz NOT NULL DEFAULT now(),
  processed_at       timestamptz,

  CONSTRAINT webhook_events_provider_event_key UNIQUE (provider, provider_event_id)
);

CREATE INDEX webhook_events_unprocessed_idx
  ON webhook_events (received_at)
  WHERE processed_at IS NULL;

-- -----------------------------------------------------------------------------
-- 12. Read model: effective seat status (lazy expiry for READS too)
--     The seat map must never show an expired hold as "held". Query this view
--     (or copy its CASE into your Kysely query) for GET /events/:id/seats.
-- -----------------------------------------------------------------------------
CREATE VIEW event_seats_effective AS
SELECT
  s.event_id,
  s.seat_id,
  s.section,
  s.row,
  s.number,
  s.price_minor,
  CASE
    WHEN s.status = 'held' AND s.held_until <= app_now() THEN 'available'::seat_status
    ELSE s.status
  END AS status,
  CASE WHEN s.status = 'held' AND s.held_until > app_now() THEN s.held_until END AS held_until,
  s.version
FROM event_seats s;

COMMENT ON VIEW event_seats_effective IS
  'Seat map with lazy expiry applied. Never exposes held_by/hold_id to clients.';

-- -----------------------------------------------------------------------------
-- 13. Documentation in the catalogue (shows up in psql \d+ and DB GUIs)
-- -----------------------------------------------------------------------------
COMMENT ON TABLE  event_seats IS 'Source of truth for seat state. Redis must never guard this.';
COMMENT ON COLUMN event_seats.held_until IS 'Hold is valid only while held_until > app_now(). Expired holds count as available.';
COMMENT ON COLUMN event_seats.version IS 'Incremented on every state change; used by the optimistic-locking variant and as a fencing token.';
COMMENT ON TABLE  tickets IS 'tickets_event_seat_key is the last-line defence against double selling.';
COMMENT ON COLUMN orders.idempotency_key IS 'Client-supplied Idempotency-Key header, unique per user.';
COMMENT ON FUNCTION app_now() IS 'Database clock. Override in tests with SET seatline.fake_now.';

