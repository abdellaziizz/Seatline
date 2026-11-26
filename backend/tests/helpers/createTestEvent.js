// Inserts one event and returns its id (uuid string).
//
// Defaults = "can be held right now": published, on sale since 1 hour ago,
// starts in 7 days. The times are computed by the DATABASE (now()), not by
// Node (new Date()), because findEventForHold compares with app_now() on the
// database clock. Mixing the two clocks can make a fresh event look
// "not on sale yet" by a few milliseconds.
//
// onSaleAt is optional: pass a Date only when a test needs a specific time.
const createTestEvent = async (
  pool,
  { organiserId, status = "published", onSaleAt = null } = {},
) => {
  const result = await pool.query(
    `INSERT INTO events
       (organiser_id, name, description, venue_name, currency, status,
        starts_at, on_sale_at)
     VALUES ($1, $2, $3, $4, $5, $6,
        now() + interval '7 days',
        COALESCE($7::timestamptz, now() - interval '1 hour'))
     RETURNING id`,
    [
      organiserId,
      "Test Event",
      "Event created for integration testing",
      "Test Venue",
      "EGP",
      status,
      onSaleAt,
    ],
  );
  return result.rows[0].id;
};
export default createTestEvent;
