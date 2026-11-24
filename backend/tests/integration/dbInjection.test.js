// Proves the dependency injection works: app code (repositories,
// withTransaction) talks to the Testcontainers database, NOT the .env one.
// Use the same beforeAll / afterAll pattern in holds.test.js.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestDatabase, stopTestDatabase } from "../setup/postgres.js";
import { getPool, withTransaction } from "../../src/config/db.js";
import { countEvents } from "../../src/repositories/eventRepository.js";

describe("database injection", () => {
  let db;

  beforeAll(async () => {
    db = await startTestDatabase();
  });

  afterAll(async () => {
    await stopTestDatabase(db);
  });

  it("getPool() returns the injected test pool", () => {
    expect(getPool()).toBe(db.pool);
  });

  it("withTransaction runs on the test database", async () => {
    const name = await withTransaction(async (client) => {
      const { rows } = await client.query("SELECT current_database() AS db");
      return rows[0].db;
    });
    expect(name).toBe("seatline_test");
  });

  it("repositories use the test database (fresh, migrated, empty)", async () => {
    // The dev database has a seeded event; the fresh test database has none.
    expect(await countEvents()).toBe(0);
  });
});
