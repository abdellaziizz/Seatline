import express from "express";
import validate from "../middlewares/validate.js";
import authController from "../controllers/authController.js";
import orderController from "../controllers/orderController.js";
const router = express.Router();
router.use(authController.protect);
router.post("/", orderController.postOrder);
router.get("/", orderController.getOrder);
export default router;
