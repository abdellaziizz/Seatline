import { z } from "zod";

// events.id is uuid (uuidv7) in 0001_init.up.sql, not an integer.
const eventIdParamsSchema = z.object({
  params: z.object({ id: z.uuid() }),
});

// Upper bound on seats per event: one request must not be able to insert
// millions of rows (DoS). Adjust if you need bigger venues.
const MAX_SEATS_PER_EVENT = 5000;

// One section of the venue, e.g. { name: "VIP", rows: 10, seatsPerRow: 20, priceMinor: 50000 }
const sectionSchema = z.object({
  name: z.string().trim().min(1).max(50),
  rows: z.number().int().min(1).max(100),
  seatsPerRow: z.number().int().min(1).max(200),
  priceMinor: z.number().int().min(0), // event_seats_price_nonneg
});

// Field rules mirror the CHECK constraints on "events" in 0001_init.up.sql,
// so the client gets a clear 400 instead of a generic DB error.
const eventFields = {
  name: z.string().trim().min(1).max(200), // events_name_len
  description: z.string().trim().max(5000),
  venueName: z.string().trim().min(1).max(200),
  currency: z.string().regex(/^[A-Z]{3}$/), // events_currency_format
  startsAt: z.coerce.date(),
  onSaleAt: z.coerce.date(),
};

const createEventSchema = z.object({
  body: z
    .object({
      ...eventFields,
      description: eventFields.description.default(""),
      currency: eventFields.currency.default("EGP"),
      sections: z
        .array(sectionSchema)
        .min(1)
        .max(20)
        .refine(
          (secs) =>
            secs.reduce((sum, s) => sum + s.rows * s.seatsPerRow, 0) <=
            MAX_SEATS_PER_EVENT,
          { message: `An event can have at most ${MAX_SEATS_PER_EVENT} seats` },
        )
        .refine(
          (secs) => new Set(secs.map((s) => s.name)).size === secs.length,
          { message: "Section names must be unique" },
        ),
    })
    // events_sale_before_start
    .refine((b) => b.onSaleAt < b.startsAt, {
      message: "onSaleAt must be before startsAt",
      path: ["onSaleAt"],
    }),
});

// PATCH: every field optional, but at least one must be sent.
// status lets the organiser publish (draft -> published) or cancel.
const updateEventSchema = z.object({
  params: z.object({ id: z.uuid() }),
  body: z
    .object({
      ...eventFields,
      status: z.enum(["draft", "published", "cancelled"]),
    })
    .partial()
    .refine((b) => Object.keys(b).length > 0, {
      message: "Send at least one field to update",
    })
    // Only checkable here when both dates are sent. If only one is sent,
    // the DB CHECK events_sale_before_start still protects us (-> 422).
    .refine(
      (b) => !(b.onSaleAt && b.startsAt) || b.onSaleAt < b.startsAt,
      { message: "onSaleAt must be before startsAt", path: ["onSaleAt"] },
    ),
});

export { eventIdParamsSchema, createEventSchema, updateEventSchema };
