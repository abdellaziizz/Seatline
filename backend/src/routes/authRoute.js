import express from "express";
const router = express.Router();
import authController from "../controllers/authController.js";
import validate from "../middlewares/validate.js";
import { registerSchema, loginSchema } from "../schemas/authSchema.js";
router.post(
  "/register",
  validate(registerSchema),

  authController.register,
);
router.post("/login", validate(loginSchema), authController.login);
export default router;
