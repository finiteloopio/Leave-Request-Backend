import express from "express";
import { getAllHolidays } from "../controllers/holiday.controller.js";

const router = express.Router();

// @route   GET /api/holidays
// @desc    Get all holidays
router.get("/", getAllHolidays);

// Use 'export default' to make the router the default export
export default router;
