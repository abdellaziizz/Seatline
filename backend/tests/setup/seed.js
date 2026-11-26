const ORGANISER_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "22222222-2222-4222-8222-222222222222";
const ORGANISER_EMAIL = "seed-organiser@seatline.local";

// seed().catch(() => {
//   process.exitCode = 1;
// });
function generateSeats() {
  const seats = [];
  let seatId = 1;

  const sections = [
    {
      name: "VIP",
      rows: 10,
      priceMinor: 50000,
    },
    {
      name: "Regular",
      rows: 25,
      priceMinor: 30000,
    },
    {
      name: "Economy",
      rows: 15,
      priceMinor: 15000,
    },
  ];

  for (const section of sections) {
    for (let i = 0; i < section.rows; i++) {
      const rowLabel = String.fromCharCode(65 + i);

      for (let number = 1; number <= 10; number++) {
        seats.push({
          seatId: seatId++,
          section: section.name,
          row: rowLabel,
          number,
          priceMinor: section.priceMinor,
        });
      }
    }
  }

  return seats;
}
const seedTestData = async (pool) => {
  //1.create test users
  const client = await pool.connect();
  //create developer organiser "user"
  try {
    await client.query("BEGIN");
    await client.query(
      ` 
        INSERT INTO users (
          id,
          email,
          password_hash,
          display_name,
          role
        )
        VALUES ($1, $2, $3, $4, 'organiser')
        ON CONFLICT (email) DO NOTHING
      `,
      [
        ORGANISER_ID,
        ORGANISER_EMAIL,
        "SEED_ONLY_NOT_A_REAL_PASSWORD_HASH",
        "SeatLine Seed Organiser",
      ],
    );
    const { rows: user } = await client.query(
      `SELECT id FROM users WHERE email = $1`,
      [ORGANISER_EMAIL],
    );
    const organiserId = user[0].id;
    const startsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    //2.create one event
    await client.query(
      `
         INSERT INTO events (
           id,
           organiser_id,
           name,
           description,
           venue_name,
           currency,
           status,
           starts_at,
           on_sale_at
         )
         VALUES (
           $1, $2, $3, $4, $5, 'EGP',
           'published', $6, NOW()
)
         ON CONFLICT (id) DO NOTHING
       `,
      [
        EVENT_ID,
        organiserId,
        "SeatLine Demo Concert",
        "Demo event for testing seat reservations.",
        "Cairo International Stadium",
        startsAt,
      ],
    );
    const event = await client.query(`SELECT * FROM events where id= $1`, [
      EVENT_ID,
    ]);
    //3.create seats
    const seats = generateSeats();
    const seatIds = seats.map((s) => s.seatId);
    const sections = seats.map((s) => s.section);
    const rows = seats.map((s) => s.row);
    const numbers = seats.map((s) => s.number);
    const prices = seats.map((s) => s.priceMinor);
    await client.query(
      `
        INSERT INTO event_seats (
          event_id,
          seat_id,
          section,
          row,
          number,
          price_minor
        )
        SELECT
          $1,
          s.seat_id,
          s.section,
          s.row_label,
          s.seat_number,
          s.price_minor
        FROM unnest(
          $2::integer[],
          $3::text[],
          $4::text[],
          $5::integer[],
          $6::integer[]
        ) AS s(
          seat_id,
          section,
          row_label,
          seat_number,
          price_minor
        )
        ON CONFLICT (event_id, seat_id) DO NOTHING
      `,
      [EVENT_ID, seatIds, sections, rows, numbers, prices],
    );

    await client.query("COMMIT");

    console.log("Seed completed successfully!");
    console.log(`Event ID: ${EVENT_ID}`);
    console.log(`Generated seats: ${seats.length}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Seed failed:", error);
    throw error;
  } finally {
    client.release();
  }
};
