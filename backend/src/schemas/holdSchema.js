import { z } from "zod";

// Max seats in one hold: stops one user from holding the whole venue.
const MAX_SEATS_PER_HOLD = 10;

const createHoldSchema = z.object({
  params: z.object({ id: z.uuid() }), // event id
  body: z.object({
    seatIds: z
      .array(z.number().int().positive())
      .min(1)
      .max(MAX_SEATS_PER_HOLD)
      // [5, 5] would update 1 row but "request" 2 -> false 409. Reject it.
      .refine((ids) => new Set(ids).size === ids.length, {
        message: "seatIds must not contain duplicates",
      }),
  }),
});

const holdIdParamsSchema = z.object({
  params: z.object({ id: z.uuid() }), // hold id
});

export { createHoldSchema, holdIdParamsSchema };
