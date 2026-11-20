export const HOLD_INTERVAL = "5 minutes";

// Can seats of this event be held right now? (all on the DATABASE clock)
// Returns undefined if the event does not exist.
const findEventForHold = async (client, eventId) => {
  const result = await client.query(
    `SELECT id,
            status = 'published'
              AND on_sale_at <= app_now()
              AND starts_at  >  app_now() AS on_sale
     FROM events
     WHERE id = $1`,
    [eventId],
  );
  return result.rows[0];
};

const insertHold = async (client, eventId, userId) => {
  const result = await client.query(
    `INSERT INTO holds (event_id, user_id, expires_at)
     VALUES ($1, $2, app_now() + $3::interval)
     RETURNING id, event_id, expires_at`,
    [eventId, userId, HOLD_INTERVAL],
  );
  return result.rows[0];
};

// The atomic conditional UPDATE from the spec.
// A seat is taken only if it is available OR its hold has expired
const holdSeats = async (
  client,
  { eventId, seatIds, holdId, userId, expiresAt },
) => {
  const result = await client.query(
    `UPDATE event_seats
     SET status     = 'held',
         hold_id    = $3,
         held_by    = $4,
         held_until = $5,
         version    = version + 1
     WHERE event_id = $1
       AND seat_id = ANY($2::integer[])
       AND (
         status = 'available'
         OR (status = 'held' AND held_until <= app_now())
       )
     RETURNING seat_id`,
    [eventId, seatIds, holdId, userId, expiresAt],
  );
  return result.rows.map((r) => r.seat_id);
};

// Only an ACTIVE, NOT EXPIRED hold owned by this user can be released.
const markHoldReleased = async (client, holdId, userId) => {
  const result = await client.query(
    `UPDATE holds
     SET status = 'released'
     WHERE id = $1
       AND user_id = $2
       AND status = 'active'
       AND expires_at > app_now()
     RETURNING id`,
    [holdId, userId],
  );
  return result.rows[0];
};

// WHERE hold_id = $1: if another user already took a seat after this hold
// expired, that seat now has a different hold_id and is NOT touched.
const releaseSeatsOfHold = async (client, holdId) => {
  const result = await client.query(
    `UPDATE event_seats
     SET status     = 'available',
         hold_id    = NULL,
         held_by    = NULL,
         held_until = NULL,
         version    = version + 1
     WHERE hold_id = $1
       AND status = 'held'
     RETURNING seat_id`,
    [holdId],
  );
  return result.rows.map((r) => r.seat_id);
};

export {
  findEventForHold,
  insertHold,
  holdSeats,
  markHoldReleased,
  releaseSeatsOfHold,
};
