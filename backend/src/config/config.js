import dotenv from "dotenv";
import z from "zod";
dotenv.config({ path: "backend/.env", quiet: true });
const envschema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  PORT: z.coerce.number().int().positive(),

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
  nodeEnv: env.NODE_ENV,
  port: env.PORT || 3000,
  host: "127.0.0.1",
  env: parsedEnv.data.NODE_ENV,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h",
  logLevel:
    process.env.LOG_LEVEL ||
    (process.env.NODE_ENV === "test" ? "silent" : "info"),

  db: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    name: env.DB_NAME,
  },

  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
  },
};
