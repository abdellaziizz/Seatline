import { z } from "zod";
orderSchema = z.object({
  body: z.object({
    holdId: z.string().uuid(),
    paymentMethod: z.enum(["pending", "succeeded", "failed", "refunded"]),
  }),
  headers: z.object({
    "idempotency-key": z
      .string()
      .min(8, "Idempotency-Key must be at least 8 characters")
      .max(200, "Idempotency-Key must not exceed 200 characters"),
  }),
});
export default orderSchema;
