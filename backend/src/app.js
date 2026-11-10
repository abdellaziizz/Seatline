import express from "express";
import pool from "../src/config/db.js";
import redisClient from "../src/config/redis.js";
import { httpLogger } from "./log.js";
const app = express();
app.use(httpLogger);
app.get("/health", async (_req, res) => {
  const [postgres, redis] = await Promise.allSettled([
    pool.query("SELECT 1"),

    redisClient.ping(),
  ]);
  const dbHealth = postgres.status === "fulfilled";
  const redisHealth = redis.status === "fulfilled" && redis.value === "PONG";
  const allHealthy = dbHealth && redisHealth;
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? "success" : "error",
    services: {
      postgres: dbHealth ? "ok" : "unreachable",
      redis: redisHealth ? "ok" : "unreachable",
    },
  });
});
export default app;
