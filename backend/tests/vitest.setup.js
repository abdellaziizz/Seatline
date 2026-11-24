// Runs before EVERY test file, before any app module is imported
// (configured in vitest.config.js -> setupFiles).
//
// config.js validates the environment with Zod and calls process.exit(1) if
// something is missing. In tests we don't load .env, so we provide safe values
// here. The DB_* values are placeholders on purpose: the app never uses them,
// because each test file injects the Testcontainers pool with setPool().
// If a test forgets to inject, getPool() would try "db-not-injected" and fail
// loudly instead of silently touching the dev database.
process.env.NODE_ENV = "test";
process.env.PORT ??= "3999"; // never listened on: tests use supertest/services
process.env.JWT_SECRET ??= "test-secret-not-for-production-0123456789";
process.env.JWT_EXPIRES_IN ??= "15m";

process.env.DB_HOST = "db-not-injected.invalid";
process.env.DB_PORT = "5432";
process.env.DB_USER = "not-used";
process.env.DB_PASSWORD = "not-used";
process.env.DB_NAME = "not-used";

process.env.REDIS_HOST ??= "127.0.0.1";
process.env.REDIS_PORT ??= "6379";
