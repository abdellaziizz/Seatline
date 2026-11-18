import express from "express";
import validate from "../middlewares/validate.js";
import paginationSchema from "../schemas/paginationSchema.js";
import getEventSeats from "../controllers/seatController.js";
import { createEventSchema } from "../schemas/eventSchema.js";
import {
  getEvents,
  getEventById,
  createEvent,
} from "../controllers/eventController.js";
import { eventIdParamsSchema } from "../schemas/eventSchema.js";
import requireOrganiser from "../middlewares/requireOrganiser.js";
import authController from "../controllers/authController.js";
const router = express.Router();
router.get("/", validate(paginationSchema), getEvents());
router.post(
  "/",
  authController.protect,
  requireOrganiser,
  validate(createEventSchema),
  createEvent,
);
router.delete("/");
router.patch("/");

router.get("/:id", validate(eventIdParamsSchema), getEventById);
router.get("/:id/seats", validate(eventIdParamsSchema), getEventSeats);
export default router;
