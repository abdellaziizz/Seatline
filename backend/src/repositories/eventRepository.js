import { pool } from "../config/db.js";
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
export { countEvents, findEvents, findEventsById };
