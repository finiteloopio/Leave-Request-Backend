import express from "express";
import { cancelMyRequest } from "../controllers/request.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// @route   PUT /api/requests/:requestId/cancel
// @desc    Allows an employee to cancel their own pending request
router.put("/:requestId/cancel", protect, cancelMyRequest);

export default router;
