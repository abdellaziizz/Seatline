// Inserts one user and returns its id (uuid string).
// Takes the pool as a parameter: never imports the app's pool.
const createTestUser = async (pool, { role = "customer" } = {}) => {
  const email = `test-${crypto.randomUUID()}@example.com`;
  const result = await pool.query(
    `INSERT INTO users (role, email, password_hash, display_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [role, email, "test-password-hash", "Test User"],
  );
  return result.rows[0].id;
};
export default createTestUser;
