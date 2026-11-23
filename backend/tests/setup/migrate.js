import { pool } from "../config/db.js";
import fs from "node:fs/promises";
import path from "node:path";

// Resolve migration directory relative to this file
const migrationUrl = path.resolve(
  import.meta.dirname,
  "backend/src/db/migration",
);

const ensureMigration = async (client) => {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
       name TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`);
};
const runMigrationUp = async (client) => {
  const files = await fs.readdir(migrationUrl);

  //Get the up .sql file
  const upFile = files
    .filter((f) => {
      f.endsWith(".up.sql");
    })
    .sort();

  const { rows } = await client.query(
    "SELECT 1 FROM schema_migrations WHERE name = $1",
    [upFile],
  );
  // Skip already applied migrations
  if (rows.length > 0) {
    console.log(`Already applied: ${file}`);
    return;
  }

  const sqlCode = await fs.readFile(path.join(migrationUrl, upFile), "utf-8");

  try {
    await client.query("BEGIN");

    await client.query(sqlCode);

    await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [
      upFile,
    ]);

    await client.query("COMMIT");

    console.log(`Applied: ${upFile}`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
};
const runMigrationDown = async (client) => {
  //applying query to check whether there is migration to rollback or not
  const { rows } = client.query(`SELECT name
    FROM schema_migrations
    ORDER BY applied_at DESC, name DESC
    LIMIT 1`);
  if (rows.length === 0) {
    console.log("There is no migration to rollback");
    return;
  }
  const files = fs.readdir(migrationUrl);
  const downFile = (await files)
    .filter((f) => {
      f.endsWith(".down.sql");
    })
    .sort();
  const sqlCode = await fs.readFile(path.join(migrationUrl, downFile), "utf-8");
  try {
    client.query("BEGIN");
    client.query(sqlCode);
    await client.query("DELETE FROM schema_migrations WHERE name = $1", [
      upFile,
    ]);
    client.query("COMMIT");
    console.log("Rolled Back");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
};
const main = async () => {
  const client = await pool.connect();
  direction = process.argv[2];
  try {
    ensureMigration(client);
    if (direction === "up") await runMigrationUp(client);
    else {
      await runMigrationDown(client);
    }
  } finally {
    client.release();
    await pool.end();
  }
};
// async function main() {
//   const direction = process.argv[2];

//   if (!["up", "down"].includes(direction)) {
//     throw new Error("Use: node scripts/migrate.js up|down");
//   }

//   const client = await pool.connect();

//   try {
//     await ensureMigration(client);

//     if (direction === "up") {
//       await migrationUp(client);
//     } else {
//       await migrationDown(client);
//     }
//   }
// }

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exitCode = 1;
});
export { ensureMigration, runMigrationDown, runMigrationUp, main };
