import getEventService from "../service/eventService.js";
import { findEventsById } from "../repositories/eventRepository.js";
import AppError from "../utils/appError.js";

const getEvents = async (req, res, next) => {
  // Express 5: req.query is read-only, so validate() puts the parsed
  // (coerced + defaulted) values in req.validated.query instead.
  const { page, limit } = req.validated.query;
  const result = await getEventService(page, limit);
  return res.status(200).json({ status: "success", data: result });
};

const getEventById = async (req, res, next) => {
  const event = await findEventsById(req.params.id);
  if (!event) return next(new AppError("Event not found", 404, "NOT_FOUND"));
  return res.status(200).json({ status: "success", data: event });
};

export { getEvents, getEventById };
