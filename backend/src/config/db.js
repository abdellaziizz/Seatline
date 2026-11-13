import config from "./config.js";
import pg from "pg";
const pool = new pg.Pool({
  user: config.db.user,
  password: config.db.password,
  port: config.db.port || 5432,
  database: config.db.name,
  host: config.db.host,
});
const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};
export { pool, withTransaction };
