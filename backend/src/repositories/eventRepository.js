//BETTER TO SEPERATE THE QUERIES in seperated functions and then use them in the transactions

import { withParser } from "zod/v4/core";
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
// WHITELIST: request field (camelCase) -> DB column.
// Only these columns can ever be updated, and the column names come from
// this object, never from the request body, so no SQL injection via keys.
const UPDATABLE_COLUMNS = {
  name: "name",
  description: "description",
  venueName: "venue_name",
  startsAt: "starts_at",
  onSaleAt: "on_sale_at",
  status: "status",
};

const updateEvent = async (eventId, organiserId, fields) => {
  const setParts = [];
  const values = [];
  for (const [key, column] of Object.entries(UPDATABLE_COLUMNS)) {
    if (fields[key] !== undefined) {
      values.push(fields[key]);
      setParts.push(`${column} = $${values.length}`);
    }
  }
  if (setParts.length === 0) return undefined;

  values.push(eventId, organiserId);
  // updated_at is set by the events_set_updated_at trigger.
  // organiser_id in the WHERE = ownership check (not owner -> 0 rows -> 404).
  const result = await pool.query(
    `UPDATE events
SET ${setParts.join(", ")}
WHERE id = $${values.length - 1}
  AND organiser_id = $${values.length}
RETURNING *`,
    values,
  );
  return result.rows[0];
};

const deleteEvent = async (eventId, organiserId) => {
  const result = await pool.query(
    `DELETE FROM events
WHERE id = $1
  AND organiser_id = $2
RETURNING id`,
    [eventId, organiserId],
  );
  return result.rows[0];
};

// 0 -> "A", 25 -> "Z", 26 -> "AA", 27 -> "AB" ... (event_seats.row is text)
const rowLabel = (index) => {
  let label = "";
  let n = index;
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
};

const createEvent = async ({
  organiserId,
  name,
  description,
  venueName,
  currency,
  startsAt,
  onSaleAt,
  sections,
}) => {
  // Event + all its seats in ONE transaction: either both exist or neither.
  return withTransaction(async (client) => {
    //1.creating the event
    const eventResult = await client.query(
      `INSERT INTO events
   (organiser_id, name, description, venue_name, currency, starts_at, on_sale_at)
   VALUES ($1, $2, $3, $4, $5, $6, $7)
   RETURNING *`,
      [organiserId, name, description, venueName, currency, startsAt, onSaleAt],
    );
    const event = eventResult.rows[0];

    //2.generating the seats from the layout sent by the organiser
    // seat_id is NOT NULL with no default -> we number seats 1..N per event.
    const seats = [];
    let seatId = 1;
    for (const section of sections) {
      for (let r = 0; r < section.rows; r++) {
        for (let number = 1; number <= section.seatsPerRow; number++) {
          seats.push({
            seatId: seatId++,
            section: section.name,
            row: rowLabel(r),
            number,
            priceMinor: section.priceMinor,
          });
        }
      }
    }

    //3.Bulk insert seats using UNNEST (one query instead of N inserts)
    await client.query(
      `INSERT INTO event_seats
       (event_id, seat_id, section, row, number, price_minor)
       SELECT $1, s.seat_id, s.section, s.row, s.number, s.price_minor
       FROM UNNEST(
         $2::integer[],
         $3::text[],
         $4::text[],
         $5::integer[],
         $6::integer[]
       ) AS s(seat_id, section, row, number, price_minor)`,
      [
        event.id,
        seats.map((s) => s.seatId),
        seats.map((s) => s.section),
        seats.map((s) => s.row),
        seats.map((s) => s.number),
        seats.map((s) => s.priceMinor),
      ],
    );
    return { ...event, seatCount: seats.length };
  });
};
// Hold queries moved to repositories/holdRepository.js
export {
  countEvents,
  findEvents,
  findEventsById,
  updateEvent,
  deleteEvent,
  createEvent,
};
