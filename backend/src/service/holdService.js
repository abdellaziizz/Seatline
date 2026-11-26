import { withTransaction } from "../config/db.js";
import AppError from "../utils/appError.js";
import * as holdRepo from "../repositories/holdRepository.js";

const createHold = async (eventId, userId, seatIds) => {
  // Sorted -> concurrent requests lock overlapping seats in the same order
  // (reduces deadlock risk).
  const sortedIds = [...seatIds].sort((a, b) => a - b);

  return withTransaction(async (client) => {
    const event = await holdRepo.findEventForHold(client, eventId);
    if (!event) throw new AppError("Event not found", 404, "NOT_FOUND");
    if (!event.on_sale) {
      throw new AppError("This event is not on sale", 409, "EVENT_NOT_ON_SALE");
    }

    const hold = await holdRepo.insertHold(client, eventId, userId);
    const heldSeatIds = await holdRepo.holdSeats(client, {
      eventId,
      seatIds: sortedIds,
      holdId: hold.id,
      userId,
      expiresAt: hold.expires_at,
    });

    // throwing here makes withTransaction run ROLLBACK.
    if (heldSeatIds.length !== sortedIds.length) {
      const unavailable = sortedIds.filter((id) => !heldSeatIds.includes(id));
      const err = new AppError(
        "Some seats are unavailable",
        409,
        "SEATS_UNAVAILABLE",
      );
      err.details = { unavailableSeatIds: unavailable };
      throw err;
    }

    return {
      holdId: hold.id,
      eventId: hold.event_id,
      seatIds: heldSeatIds,
      expiresAt: hold.expires_at,
    };
  });
};

const releaseHold = async (holdId, userId) => {
  return withTransaction(async (client) => {
    const hold = await holdRepo.markHoldReleased(client, holdId, userId);
    // Not found, not yours, already released/converted, or expired -> 404
    // (stop here: don't touch any seats).
    if (!hold) {
      throw new AppError("Hold not found or expired", 404, "HOLD_NOT_FOUND");
    }
    const releasedSeatIds = await holdRepo.releaseSeatsOfHold(client, holdId);
    return { holdId: hold.id, releasedSeatIds };
  });
};

export { createHold, releaseHold };
