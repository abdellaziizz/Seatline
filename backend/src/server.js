import app from "./app.js";
import config from "../src/config/config.js";
import logger from "./log.js";
const server = app.listen(config.port, config.host, () => {
  console.log(`app is listen on ${config.port}`);
});
const shutdown = (signal, code = 0) => {};
