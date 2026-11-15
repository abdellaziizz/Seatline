import express from "express";
const router = express.Router();
import authController from "../controllers/authController.js";
import validate from "../middlewares/validate.js";
import { registerSchema, loginSchema } from "../schemas/authSchema.js";
router.post(
  validate(registerSchema),
  "/api/auth/register",
  authController.register,
);
