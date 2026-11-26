import express from "express";
import { getPool } from "../src/config/db.js";
import redisClient from "../src/config/redis.js";
import { httpLogger } from "./log.js";
import errorHandler from "./controllers/errorHandler.js";
import AppError from "./utils/appError.js";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import authRouter from "./routes/authRoute.js";
import eventRouter from "./routes/eventsRoute.js";
import holdRouter from "./routes/holdRoutes.js";
import orderRouter from "./routes/orderRoutes.js";
const app = express();

app.use(httpLogger);
app.use(express.json({ limit: "100kb" }));
app.use(helmet());
app.use(cookieParser());
app.get("/health", async (_req, res) => {
  const [postgres, redis] = await Promise.allSettled([
    getPool().query("SELECT 1"),

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
app.use("/api/auth", authRouter);
app.use("/api/events", eventRouter);
app.use("/api/holds", holdRouter);
app.use("/api/orders", orderRouter);

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
