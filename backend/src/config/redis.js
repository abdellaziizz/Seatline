import Redis from "ioredis";
import config from "./config.js";
const Redisclient = new Redis({
  host: config.redisHost,
  port: Number(config.redisPort),
  password: config.redisPassword,
});
Redisclient.on("error", (err) => {
  console.error("Redis Error ", err);
});
export default Redisclient;
