// Responsible for starting and stopping a temporary PostgreSQL instance,
// and for INJECTING its pool into the app (dependency injection).
//
// 1. start a postgres 18 container
// 2. create a pg.Pool for it (max 20: concurrency tests need many connections)
// 3. run the real migrations on it (reuses src/scripts/migrate.js)
// 4. setPool(pool): from now on ALL app code (repositories, withTransaction)
//    talks to this container, never to the .env database
// 5. stopTestDatabase(): undo the injection, close the pool, stop the container
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import pg from "pg";
import { setPool } from "../../src/config/db.js";
import { migrateTestDatabase } from "./migrate.js";

const startTestDatabase = async () => {
  const container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("seatline_test")
    .withUsername("seatline")
    .withPassword("seatline_test")
    .start();

  // One source of truth for host/port/user/password: the container itself.
  const pool = new pg.Pool({
    connectionString: container.getConnectionUri(),
    max: 20,
  });

  try {
    await pool.query("SELECT 1");
    await migrateTestDatabase(pool);
    // THE injection: the app now uses the container's pool.
    setPool(pool);
    return { container, pool };
  } catch (err) {
    await pool.end();
    await container.stop();
    throw err;
  }
};

const stopTestDatabase = async ({ container, pool } = {}) => {
  setPool(null); // undo the injection
  await pool?.end(); // close connections first...
  await container?.stop(); // ...then stop the database they point to
};

export { startTestDatabase, stopTestDatabase };
