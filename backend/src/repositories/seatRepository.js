import { getPool } from "../config/db.js";
// Seat map for one event.
// Reads from the event_seats_effective view (see 0001_init.up.sql, section 12):
//  - an expired hold is already shown as 'available' (lazy expiry, uses app_now())
//  - 'sold' seats stay 'sold'
//  - held_by / hold_id are never exposed to clients
const findSeatsByEventId = async (eventId) => {
  const result = await getPool().query(
    `SELECT
       seat_id,
       section,
       row,
       number,
       price_minor,
       status
     FROM event_seats_effective
     WHERE event_id = $1
     ORDER BY section, row, number`,
    [eventId],
  );
  return result.rows;
};
export default findSeatsByEventId;
