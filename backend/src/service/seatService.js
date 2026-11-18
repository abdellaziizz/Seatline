import findSeatsByEventId from "../repositories/seatRepository.js";
import { findEventsById } from "../repositories/eventRepository.js";
import AppError from "../utils/appError.js";
const getEventSeatsService = async (eventId) => {
  const event = await findEventsById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404, "NOT_FOUND");
  }
  const seats = await findSeatsByEventId(eventId);
  return {
    eventId,
    seats,
  };
};
export default getEventSeatsService;
