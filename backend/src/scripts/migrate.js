import pool from "../config/db.js";
import fs from "node:fs/promises";
import path from "node:path";
const migrationUrl = path.resolve("../db/migration");
const ensureMigration = (client) => {
  const rows =
    client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);
};
const migrationUp = async (client) => {
  const files = fs.readFile(migrationUrl);
  const upFile = files
    .filter((f) => {
      f.endswith(".up.sql");
    })
    .sort();
  for (const file in files) {
    const rows = await client.query(
      "SELECT 1 FROM schema_migrations WHERE name = $1",
      [file],
    );
    if (rows.length > 0) {
      console.log("already applied");
      continue;
    }
    const sqlCode = fs.readFile(path.join(migrationUrl, upFile), "utf-8");
    try {
      await client.query("BEGIN");
      await client.query(sqlCode);

      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [
        file,
      ]);
      console.log(`Applied: ${file}`);

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
};
const migrationDown = async (client) => {
  const rows = await client.query(`   SELECT name
    FROM schema_migrations
    ORDER BY applied_at DESC, name DESC
    LIMIT 1`);
  if (rows.length === 0) {
    console.log("there is no migration to rollback");
  }
  const upFile = rows[0].name;
  const downFile = upFile.replace(".up.sql", ".down.sql");
  const sqlCode = fs.readFile(path.join(migrationUrl, downFile));
  try {
    await client.query("BEGIN");
    await client.query(sql);

    await client.query("DELETE FROM schema_migrations WHERE name = $1", [
      upFile,
    ]);

    await client.query("COMMIT");
    console.log(`Rolled back: ${upFile}`);
    await client.query("ROLLBACK");
    throw error;
  } catch (err) {}
};
