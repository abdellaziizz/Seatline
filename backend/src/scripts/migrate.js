import { getPool, closePool } from "../config/db.js";
import fs from "node:fs/promises";
import path from "node:path";

// Resolve migration directory relative to this file
const migrationUrl = path.resolve(import.meta.dirname, "../db/migration");

const ensureMigration = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
};

const migrationUp = async (client) => {
  // Read all files inside the migration directory
  const files = await fs.readdir(migrationUrl);

  // Get only UP migration files
  const upFiles = files.filter((file) => file.endsWith(".up.sql")).sort();

  for (const file of upFiles) {
    const { rows } = await client.query(
      "SELECT 1 FROM schema_migrations WHERE name = $1",
      [file],
    );

    // Skip already applied migrations
    if (rows.length > 0) {
      console.log(`Already applied: ${file}`);
      continue;
    }

    const sqlCode = await fs.readFile(path.join(migrationUrl, file), "utf-8");

    try {
      await client.query("BEGIN");

      await client.query(sqlCode);

      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [
        file,
      ]);

      await client.query("COMMIT");

      console.log(`Applied: ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  }
};

const migrationDown = async (client) => {
  const { rows } = await client.query(`
    SELECT name
    FROM schema_migrations
    ORDER BY applied_at DESC, name DESC
    LIMIT 1
  `);

  if (rows.length === 0) {
    console.log("There is no migration to rollback");
    return;
  }

  const upFile = rows[0].name;
  const downFile = upFile.replace(".up.sql", ".down.sql");

  const sqlCode = await fs.readFile(path.join(migrationUrl, downFile), "utf-8");

  try {
    await client.query("BEGIN");

    await client.query(sqlCode);

    await client.query("DELETE FROM schema_migrations WHERE name = $1", [
      upFile,
    ]);

    await client.query("COMMIT");

    console.log(`Rolled back: ${upFile}`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
};

// Run all pending UP migrations against ANY pool you pass in.
// The test setup calls this with the Testcontainers pool (dependency injection),
// so tests reuse this exact code instead of a copy.
const migrateUp = async (pool) => {
  const client = await pool.connect();
  try {
    await ensureMigration(client);
    await migrationUp(client);
  } finally {
    client.release();
  }
};

async function main() {
  const direction = process.argv[2];

  if (!["up", "down"].includes(direction)) {
    throw new Error("Use: node scripts/migrate.js up|down");
  }

  const client = await getPool().connect();

  try {
    await ensureMigration(client);

    if (direction === "up") {
      await migrationUp(client);
    } else {
      await migrationDown(client);
    }
  } finally {
    client.release();
    await closePool();
  }
}

// Only run main() when this file is executed directly
// (`node backend/src/scripts/migrate.js up`), NOT when a test imports it.
// import.meta.main is true only for the entry file (Node 24+).
if (import.meta.main) {
  main().catch((err) => {
    console.error("Migration failed:", err);
    process.exitCode = 1;
  });
}

export { ensureMigration, migrationUp, migrationDown, migrateUp };
