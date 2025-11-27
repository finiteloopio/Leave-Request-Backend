import express from "express";
// Import all three controller functions
import {
  applyForExpense,
  getExpenseHistory,
  getExpenseReceipt,
} from "../controllers/expense.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/apply", protect, applyForExpense);
router.get("/history", protect, getExpenseHistory);

// --- NEW: Route to get a specific receipt by its ID ---
// The ':requestId' part is a dynamic parameter that will hold the ID of the request
router.get("/:requestId/receipt", protect, getExpenseReceipt);

export default router;
