// Responsible for start and stop a temporary PostgreSQL instance.
//1.start postgres 18 container
//2.create pg.pool
//3.configure max at least 10
//4.return that container and pool with closing after testing
import { postgresSqlContainer } from "@testcontainers/postgresql";
import { Pool } from "pg";

const startTestDatabase = async () => {
  let container;
  let connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    container = await new postgresSqlContainer("postgres:18-alpine")
      .withDatabase("seatline_test")
      .withUsername("seatline")
      .withPassword("seatline_test_password")
      .start();
    connectionString = container.getConnectionUri();
  }
  process.env.NODE_ENV = "test";
  process.env.ENV_FILE = "/dev/null"; // never read the developer's config.env in tests
  process.env.JWT_SECRET ??= "test-secret-not-for-production-0123456789";
  process.env.JWT_EXPIRES_IN ??= "15m";
  if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  }
  const pool = new Pool({ connectionString, max: 20 });
  try {
    pool.query("SELECT now()");
    return { container, pool };
  } catch (err) {
    await pool.end();
    await container.stop();
    throw err;
  }
};
const shutDown = async ({ container, pool }) => {
  await container?.stop;
  await pool?.end();
};
export { startTestDatabase, shutDown };
