import express from "express";
import {
  getMyBalances, // 👈 Import new function
  getTeamBalances,
  updateEmployeeBalance,
} from "../controllers/balance.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { isManager } from "../middleware/role.middleware.js";

const router = express.Router();

// --- NEW: Route for an employee to get their OWN balance ---
// @route   GET /api/balances/my-balance
router.get("/my-balance", protect, getMyBalances);

// --- Manager-Only Routes ---
// GET /api/balances/team
router.get("/team", protect, isManager, getTeamBalances);

// PUT /api/balances/employee/:employeeId
router.put("/employee/:employeeId", protect, isManager, updateEmployeeBalance);

export default router;
