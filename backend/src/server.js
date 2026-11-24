import app from "./app.js";
import config from "../src/config/config.js";
import { logger } from "./log.js";
import { closePool } from "./config/db.js";
import errorHandler from "./controllers/errorHandler.js";
import Redisclient from "./config/redis.js";
const server = app.listen(config.port, config.host, () => {
  console.log(`app is listen on ${config.port}`);
});
const shutdown = (signal, code = 0) => {
  logger.info({ signal }, "Shutting down");
  server.close(async () => {
    await closePool().catch(() => {});
    await Redisclient.quit().catch(() => {});
    logger.info("All connections closed");

    process.exit(code);
  });
};
process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  shutdown("SIGINT");
});
process.on("unhandledRejection", (err) => {
  logger.fatal({ err }, "unhandledRejection");
  shutdown("unhandledRejection", 1);
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaughtException");
  shutdown("uncaughtException", 1);
});
