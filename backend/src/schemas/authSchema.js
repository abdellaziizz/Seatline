import { z } from "zod";

const registerSchema = z.object({
  body: z
    .object({
      email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
      // matches users_display_name_len CHECK (1..100) in the DB
      name: z.string().trim().min(1).max(100),
      password: z.string().min(8).max(72),
      confirmPassword: z.string().min(8).max(72),
    })
    .refine((b) => b.password === b.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    }),
});
const loginSchema = z.object({
  body: z.object({
    password: z.string().min(1).max(72),
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  }),
});
export { registerSchema, loginSchema };
