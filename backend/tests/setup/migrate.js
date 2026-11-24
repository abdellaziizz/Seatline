// Don't copy the migration runner: reuse the real one.
// migrateUp(pool) runs every pending *.up.sql file against the pool we pass
// in (here: the Testcontainers pool), using the same code as `npm run db:migrate`.
import { migrateUp } from "../../src/scripts/migrate.js";

const migrateTestDatabase = async (pool) => {
  await migrateUp(pool);
};

export { migrateTestDatabase };
