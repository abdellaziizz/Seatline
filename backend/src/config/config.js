import dotenv from "dotenv";
import z from "zod";
dotenv.config({
  path: "/run/media/ahmedabdelaziz/Data/Coding/P4/SeatLine/Project/.env",
  quiet: true,
});
const envschema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  PORT: z.coerce.number().int().positive(),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters long"),
  JWT_EXPIRES_IN: z.string().min(1).default("1h"),
  // PostgreSQL
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive(),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),

  //Redis
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().int().positive(),
  REDIS_PASSWORD: z.string().optional(),
});
const parsedEnv = envschema.safeParse(process.env);
if (!parsedEnv.success) {
  console.error("Invalid environment variables:");
  for (const issue of parsedEnv.error.issues) {
    console.error(`- ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export default {
  nodeEnv: parsedEnv.data.NODE_ENV,
  port: parsedEnv.data.PORT || 3000,
  host: "127.0.0.1",
  env: parsedEnv.data.NODE_ENV,
  jwtSecret: parsedEnv.data.JWT_SECRET,
  jwtExpiresIn: parsedEnv.data.JWT_EXPIRES_IN,
  logLevel:
    process.env.LOG_LEVEL ||
    (process.env.NODE_ENV === "test" ? "silent" : "info"),

  db: {
    host: parsedEnv.data.DB_HOST,
    port: parsedEnv.data.DB_PORT,
    user: parsedEnv.data.DB_USER,
    password: parsedEnv.data.DB_PASSWORD,
    name: parsedEnv.data.DB_NAME,
  },

  redis: {
    host: parsedEnv.data.REDIS_HOST,
    port: parsedEnv.data.REDIS_PORT,
    password: parsedEnv.data.REDIS_PASSWORD || undefined,
  },
};
