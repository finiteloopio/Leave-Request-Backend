import express from "express";
import { applyForWFH, getWFHHistory } from "../controllers/wfh.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// @route   POST /api/wfh/apply
// @desc    Submit a new Work From Home request
// @access  Private
router.post("/apply", protect, applyForWFH);

// @route   GET /api/wfh/history
// @desc    Get WFH request history
// @access  Private
router.get("/history", protect, getWFHHistory);

export default router;