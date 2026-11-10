import express from "express";
import pool from "../src/config/db.js";
import redisClient from "../src/config/redis.js";
import { httpLogger } from "./log.js";
import errorHandler from "./controllers/errorHandler.js";
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
app.all("/*splat", (req, res, next) => {
  next(
    new AppError(
      `Can't find ${req.originalUrl} on this server!`,
      404,
      "NOT_FOUND",
    ),
  );
});

app.use(errorHandler);

export default app;
