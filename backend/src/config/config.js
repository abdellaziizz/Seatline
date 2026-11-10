import dotenv from "dotenv";
dotenv.config({ path: "../.env", quiet: true });
export default {
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || "127.0.0.1",
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h",
  logLevel:
    process.env.LOG_LEVEL ||
    (process.env.NODE_ENV === "test" ? "silent" : "info"),
};
