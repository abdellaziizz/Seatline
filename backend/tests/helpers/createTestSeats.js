// Inserts `count` seats (seat_id 1..count) for an event and returns
// the array of seat ids: [1, 2, ..., count].
// Tests only need seat ids, so every seat is section "A", row "A".
const createTestSeats = async (pool, eventId, count = 10) => {
  // One query for all seats: generate_series makes the rows 1..count.
  const result = await pool.query(
    `INSERT INTO event_seats (event_id, seat_id, section, row, number, price_minor)
     SELECT $1, n, 'A', 'A', n, 10000
     FROM generate_series(1, $2::int) AS n
     RETURNING seat_id`,
    [eventId, count],
  );
  return result.rows.map((r) => r.seat_id).sort((a, b) => a - b);
};
export default createTestSeats;
