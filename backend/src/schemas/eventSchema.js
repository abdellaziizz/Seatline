import { z } from "zod";

// events.id is uuid (uuidv7) in 0001_init.up.sql, not an integer.
const eventIdParamsSchema = z.object({
  params: z.object({ id: z.uuid() }),
});

export { eventIdParamsSchema };
