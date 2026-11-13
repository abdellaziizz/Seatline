import Redis from "ioredis";
import config from "./config.js";
const Redisclient = new Redis({
  host: config.redis.host,
  port: Number(config.redis.port),
  password: config.redis.password,
});
Redisclient.on("error", (err) => {
  console.error("Redis Error ", err);
});
export default Redisclient;
