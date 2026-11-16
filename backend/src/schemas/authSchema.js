import { z } from "zod";
const registerSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    name: z.string(),
    password: z.string().min(8).max(72),
    confirmPassword: z.string().min(8).max(72),
  }),
});
const loginSchema = z.object({
  body: z.object({
    password: z.string().min(1).max(72),
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  }),
});
export { registerSchema, loginSchema };
