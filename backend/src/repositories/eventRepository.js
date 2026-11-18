import { pool, withTransaction } from "../config/db.js";

const countEvents = async () => {
  // Same WHERE as findEvents, otherwise total/totalPages are wrong.
  // COUNT(*) is bigint -> pg returns it as a string, so convert it here.
  const result = await pool.query(
    "SELECT COUNT(*) AS count FROM events WHERE status = 'published'",
  );
  return Number(result.rows[0].count);
};
const findEvents = async (limit, offset) => {
  const result = await pool.query(
    `SELECT *
FROM events
WHERE status = 'published'
ORDER BY starts_at ASC, id ASC 
LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return result.rows;
};
const findEventsById = async (id) => {
  const result = await pool.query(
    `SELECT *
FROM events
WHERE id = $1`,
    [id],
  );
  return result.rows[0];
};
const updateEvent = async (title, eventId, organiserId) => {
  const result = await pool.query(
    `UPDATE events
SET
  title = $1,
  updated_at = NOW()
WHERE id = $2
  AND organiser_id = $3
RETURNING *;`,
    [title, eventId, organiserId],
  );
  return result.rows[0];
};
const deleteEvent = async (eventId, organiserId) => {
  const result = await pool.query(
    `DELETE FROM events
WHERE id = $1
  AND organiser_id = $2
RETURNING *;`,
    [eventId, organiserId],
  );
};
const createEvent = async (title, startsAt, organiserId) => {
  //1.creating the event
  return withTransaction(async (client) => {
    const eventResult = await client.query(
      `INSERT INTO events
   (title, starts_at, organiser_id)
   VALUES ($1, $2, $3)
   RETURNING id`,
      [title, startsAt, organiserId],
    );

    const event = eventResult.rows[0];
    //2.generating the seats
    const seats = [];
    for (let row = 1; row <= 10; row++) {
      for (let seat = 1; seat <= 10; seat++) {
        seat.push({ eventId: event.id, section: "A", row, seatNumber: seat });
      }
    }
    //Bulk insert seats using UNNSET
    await client.query(
      `INSERT INTO event_seats
       (event_id, section, row_number, seat_number)
       SELECT *
       FROM UNNEST(
         $1::uuid[],
         $2::text[],
         $3::integer[],
         $4::integer[]
       )`,
      [
        seats.map((s) => s.eventId),
        seats.map((s) => s.section),
        seats.map((s) => s.row),
        seats.map((s) => s.seatNumber),
      ],
    );
    return event;
  });
};
export {
  countEvents,
  findEvents,
  findEventsById,
  updateEvent,
  deleteEvent,
  createEvent,
};
