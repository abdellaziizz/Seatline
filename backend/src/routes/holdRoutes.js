import express from "express";
import validate from "../middlewares/validate.js";
import authController from "../controllers/authController.js";
import { deleteHold } from "../controllers/holdController.js";
import { holdIdParamsSchema } from "../schemas/holdSchema.js";
const router = express.Router();

// mounted at /api/holds in app.js -> DELETE /api/holds/:id
router.delete(
  "/:id",
  authController.protect,
  validate(holdIdParamsSchema),
  deleteHold,
);

export default router;
