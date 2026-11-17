import { pool } from "./config/db.js";
const createUser = async (email, passwordHash, name) => {
  const result = await pool.query(
    "INSERT INTO users(email, password_hash,display_name) VALUES ($1, $2) RETURNING id, email, role, created_at",
    [email, passwordHash, name],
  );
  return result.rows[0];
};
const findUserByEmail = async (email) => {
  const result = await pool.query(
    "SELECT id, email, role, created_at FROM users WHERE email = $1",
    [email],
  );
  return result.rows[0];
};
const findUserById = async (id) => {
  const result = await pool.query(
    "SELECT id, email, role, created_at FROM users WHERE id = $1",
    [id],
  );
  return result.rows[0];
};
export { createUser, findUserByEmail, findUserById };
