import { pool } from "./config/db.js";
const createUser = async (email, passwordHash) => {
  const result = await pool.query(
    "INSERT INTO users(email, password_hash) VALUES ($1, $2) RETURNING id, email, role, created_at",
    [email, passwordHash],
  );
  return result.rows[0];
};
const findUserByEmail = async (email) => {
  const result = await pool.query(
    "SELECT id, email, password_hash, role, created_at FROM users WHERE email = $1",
    [email],
  );
};
export { createUser, findUserByEmail };
