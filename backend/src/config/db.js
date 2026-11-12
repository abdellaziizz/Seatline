import config from "./config.js";
import pg from "pg";
const pool = pg.Pool({
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  port: config.DB_PORT || 5432,
  database: config.DB_NAME,
  host: config.DB_HOST,
});
const withTransaction = async (fn) => {
  const client = pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    await client.release();
  }
};
export default { pool, withTransaction };
