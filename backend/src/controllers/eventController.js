import getEventService from "../service/eventService.js";
import * as eventRepo from "../repositories/eventRepository.js";
import AppError from "../utils/appError.js";

const getEvents = async (req, res, next) => {
  // Express 5: req.query is read-only, so validate() puts the parsed
  // (coerced + defaulted) values in req.validated.query instead.
  const { page, limit } = req.validated.query;
  const result = await getEventService(page, limit);
  return res.status(200).json({ status: "success", data: result });
};

const getEventById = async (req, res, next) => {
  const event = await eventRepo.findEventsById(req.params.id);
  if (!event) return next(new AppError("Event not found", 404, "NOT_FOUND"));
  return res.status(200).json({ status: "success", data: event });
};

const postEvent = async (req, res, next) => {
  // organiserId comes from the verified token (req.user), never from the body.
  // If the insert fails it throws, and the error handler deals with it.
  const event = await eventRepo.createEvent({
    ...req.validated.body,
    organiserId: req.user.id,
  });
  return res.status(201).json({ status: "success", data: event });
};

const updateEvent = async (req, res, next) => {
  const event = await eventRepo.updateEvent(
    req.params.id,
    req.user.id,
    req.validated.body,
  );
  // Not found OR not the owner -> same 404 (don't reveal that it exists).
  if (!event) return next(new AppError("Event not found", 404, "NOT_FOUND"));
  return res.status(200).json({ status: "success", data: event });
};

const deleteEvent = async (req, res, next) => {
  const deleted = await eventRepo.deleteEvent(req.params.id, req.user.id);
  if (!deleted) {
    return next(new AppError("Event not found", 404, "NOT_FOUND"));
  }
  // 204 = No Content: the response must not have a body.
  return res.status(204).end();
};

export { getEvents, getEventById, postEvent, deleteEvent, updateEvent };
