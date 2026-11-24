import config from "./config.js";
import pg from "pg";

// Dependency injection point for the database pool.

let pool = null;

const createDefaultPool = () =>
  new pg.Pool({
    user: config.db.user,
    password: config.db.password,
    port: config.db.port || 5432,
    database: config.db.name,
    host: config.db.host,
  });

// Lazy: the default pool is only created when something actually needs it.
// So in tests (where setPool runs first) a pool pointing at .env is never made.
const getPool = () => {
  if (!pool) pool = createDefaultPool();
  return pool;
};

// Inject a pool (tests). Pass null to go back to "create default on demand".
const setPool = (newPool) => {
  pool = newPool;
};

// Close the current pool (server shutdown, end of scripts).
const closePool = async () => {
  if (!pool) return;
  const p = pool;
  pool = null;
  await p.end();
};

const withTransaction = async (fn) => {
  const client = await getPool().connect();
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

export { getPool, setPool, closePool, withTransaction };
