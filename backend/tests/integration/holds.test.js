//1.Start Testcontainer, create pool, run migrations, initialize service.
//2.Reset database and seed fresh test data.
//3.Test 1: Attempt to hold multiple seats when one is unavailable.
//4.Test 2: Expire a hold manually and attempt a new hold.
//5.Test 3: 200 attempts against 10 seats.
//6.Close pool and stop PostgreSQL container.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import resetDatabase from "../setup/resetDatabase.js";
import { startTestDatabase, stopTestDatabase } from "../setup/postgres.js";
import { createHold } from "../../src/service/holdService.js";
import createTestEvent from "../helpers/createTestEvent.js";
import createTestSeats from "../helpers/createTestSeats.js";
import createTestUser from "../helpers/createTestUser.js";

const NUMBER_OF_SEATS = 10;

// Keep the WHOLE object from startTestDatabase(): stopTestDatabase needs
// both the pool (to close it) and the container (to stop it).
let testDatabase;
let pool;
let organiserId;
let eventId;
let seatIds; // [1, 2, ..., 10]

// Read one seat straight from the database (the source of truth).
const getSeat = async (seatId) => {
  const { rows } = await pool.query(
    `SELECT seat_id, status, held_by, held_until
     FROM event_seats
     WHERE event_id = $1 AND seat_id = $2`,
    [eventId, seatId],
  );
  return rows[0];
};

beforeAll(async () => {
  testDatabase = await startTestDatabase();
  pool = testDatabase.pool;
});

afterAll(async () => {
  await stopTestDatabase(testDatabase);
});

beforeEach(async () => {
  // Fresh data for every test, so tests never depend on each other.
  await resetDatabase(pool);
  organiserId = await createTestUser(pool, { role: "organiser" });
  eventId = await createTestEvent(pool, { organiserId });
  seatIds = await createTestSeats(pool, eventId, NUMBER_OF_SEATS);
});

//1.describe: create group test related to something
//2.it: define one test
//3.expect: check whether the result is correct or not
describe("createHold", () => {
  //TEST 1
  it("all-or-nothing: Should reject the entire request if one seat is unavailable", async () => {
    const user1 = await createTestUser(pool);
    const user2 = await createTestUser(pool);

    // user1 takes seat 2. createHold expects an ARRAY of seat ids.
    await createHold(eventId, user1, [2]);

    // user2 asks for 1, 2, 3 -> seat 2 is taken -> whole request must fail.
    let holdError;
    try {
      await createHold(eventId, user2, [1, 2, 3]);
    } catch (err) {
      holdError = err;
    }
    expect(holdError).toBeDefined();
    expect(holdError).toMatchObject({ code: "SEATS_UNAVAILABLE" });
    expect(holdError.statusCode).toBe(409);
    expect(holdError.details).toEqual({ unavailableSeatIds: [2] });

    // ROLLBACK check: seats 1 and 3 must still be free (seat_id is integer).
    const seatResult = await pool.query(
      `SELECT seat_id, status, held_by
       FROM event_seats
       WHERE event_id = $1
         AND seat_id = ANY($2::integer[])`,
      [eventId, [1, 3]],
    );
    expect(seatResult.rows).toHaveLength(2);
    for (const seat of seatResult.rows) {
      expect(seat.status).toBe("available");
      expect(seat.held_by).toBeNull();
    }

    // ROLLBACK check: no hold row left behind for user2.
    const holdResult = await pool.query(
      `SELECT id FROM holds WHERE user_id = $1 AND event_id = $2`,
      [user2, eventId],
    );
    expect(holdResult.rows).toHaveLength(0);
  });

  // TEST 2
  it("Expiry with no sweeper: Should allow another user to claim an expired seat without a sweeper", async () => {
    const user1 = await createTestUser(pool);
    const user2 = await createTestUser(pool);
    const seatId = 1;

    const hold1 = await createHold(eventId, user1, [seatId]);

    // Simulate "5 minutes passed": move user1's hold into the past.
    // Both places store the expiry, so update both.
    await pool.query(
      `UPDATE event_seats
       SET held_until = now() - interval '1 minute'
       WHERE event_id = $1 AND seat_id = $2 AND held_by = $3`,
      [eventId, seatId, user1],
    );
    await pool.query(
      `UPDATE holds SET expires_at = now() - interval '1 minute'
       WHERE id = $1`,
      [hold1.holdId],
    );

    // Now user2 tries to claim the SAME seat. No sweeper has run.
    const result = await createHold(eventId, user2, [seatId]);
    expect(result.seatIds).toEqual([seatId]);

    const seat = await getSeat(seatId);
    expect(seat.status).toBe("held");
    expect(seat.held_by).toBe(user2);
    expect(seat.held_until).not.toBeNull();
    expect(seat.held_until.getTime()).toBeGreaterThan(Date.now());
  });

  // TEST 3
  it("should allow exactly 10 successful holds from 200 concurrent users", async () => {
    const numberOfUsers = 200;

    // Arrow function WITHOUT braces returns the promise automatically.
    const users = await Promise.all(
      Array.from({ length: numberOfUsers }, () => createTestUser(pool)),
    );

    // Every user tries ONE seat; 20 users compete for each of the 10 seats.
    const results = await Promise.allSettled(
      users.map((userId, index) => {
        const seatId = seatIds[index % NUMBER_OF_SEATS];
        return createHold(eventId, userId, [seatId]);
      }),
    );

    const successes = results.filter((r) => r.status === "fulfilled");
    const failures = results.filter((r) => r.status === "rejected");

    // ASSERT: Exactly 10 users should succeed
    expect(successes).toHaveLength(NUMBER_OF_SEATS);

    // ASSERT: The remaining 190 requests should fail
    expect(failures).toHaveLength(numberOfUsers - NUMBER_OF_SEATS);

    // ASSERT: Every failure must be SEATS_UNAVAILABLE.
    // Unexpected errors (deadlock, pool timeout, bug) must fail the test too.
    const unexpectedErrors = failures
      .filter((r) => r.reason?.code !== "SEATS_UNAVAILABLE")
      .map((r) => r.reason?.code ?? String(r.reason));
    expect(unexpectedErrors).toEqual([]);

    // ASSERT: Verify the actual database state
    const databaseResult = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'held')::int AS held_count,
         COUNT(DISTINCT held_by) FILTER (WHERE status = 'held')::int AS distinct_users
       FROM event_seats
       WHERE event_id = $1`,
      [eventId],
    );
    const { held_count, distinct_users } = databaseResult.rows[0];
    expect(held_count).toBe(NUMBER_OF_SEATS);
    // Each held seat must belong to a different user
    expect(distinct_users).toBe(NUMBER_OF_SEATS);

    // Only the 10 winners have a hold row (losers were rolled back).
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM holds WHERE event_id = $1`,
      [eventId],
    );
    expect(rows[0].n).toBe(NUMBER_OF_SEATS);
  });
});
