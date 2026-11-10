import Redis from "ioredis";
const Redisclient = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
});
Redisclient.on("error", (err) => {
  console.error("Redis Error ", err);
});
export default Redisclient;
