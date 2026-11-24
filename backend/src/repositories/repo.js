import { getPool } from "../config/db.js";
const createUser = async (email, passwordHash, name) => {
  const result = await getPool().query(
    "INSERT INTO users(email, password_hash,display_name) VALUES ($1, $2,$3) RETURNING id, email, role, created_at",
    [email, passwordHash, name],
  );
  return result.rows[0];
};
const findUserByEmail = async (email) => {
  const result = await getPool().query(
    // password_hash is needed to verify the password at login.
    // The controller must remove it before sending the user to the client.
    "SELECT id, email, password_hash, role, created_at FROM users WHERE email = $1",
    [email],
  );
  return result.rows[0];
};
const findUserById = async (id) => {
  const result = await getPool().query(
    "SELECT id, email, role, created_at FROM users WHERE id = $1",
    [id],
  );
  return result.rows[0];
};
export { createUser, findUserByEmail, findUserById };
