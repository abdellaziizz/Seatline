import express from "express";
import validate from "../middlewares/validate.js";
import paginationSchema from "../schemas/paginationSchema.js";
import getEventSeats from "../controllers/seatController.js";
import {
  eventIdParamsSchema,
  createEventSchema,
  updateEventSchema,
} from "../schemas/eventSchema.js";
import {
  getEvents,
  getEventById,
  postEvent,
  deleteEvent,
  updateEvent,
} from "../controllers/eventController.js";
import { postHold } from "../controllers/holdController.js";
import { createHoldSchema } from "../schemas/holdSchema.js";
import authController from "../controllers/authController.js";
const router = express.Router();

const organiserOnly = [
  authController.protect,
  authController.requireRole("organiser"),
];

// public
router.get("/", validate(paginationSchema), getEvents);
router.get("/:id", validate(eventIdParamsSchema), getEventById);
router.get("/:id/seats", validate(eventIdParamsSchema), getEventSeats);

// organiser only (ownership is checked in SQL: organiser_id = req.user.id)
router.post("/", ...organiserOnly, validate(createEventSchema), postEvent);
router.patch(
  "/:id",
  ...organiserOnly,
  validate(updateEventSchema),
  updateEvent,
);
router.delete(
  "/:id",
  ...organiserOnly,
  validate(eventIdParamsSchema),
  deleteEvent,
);
// any logged-in user (NOT authController.login: that is the login handler)
router.post(
  "/:id/holds",
  authController.protect,
  validate(createHoldSchema),
  postHold,
);
export default router;
