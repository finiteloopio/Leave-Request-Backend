import express from "express";
// Import all the controller functions
import {
  getTeamRequests,
  approveRequest,
  rejectRequest,
  getTeamRequestHistory,
  cancelApprovedRequest,
} from "../controllers/manager.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { isManager } from "../middleware/role.middleware.js";

const router = express.Router();
router.use(protect, isManager);

// --- Existing Routes ---
router.get("/team-requests", getTeamRequests);
router.put("/requests/:requestId/approve", approveRequest);
router.put("/requests/:requestId/reject", rejectRequest);
router.put('/requests/:requestId/cancel', cancelApprovedRequest);


// --- NEW Routes ---
// GET /api/manager/team-requests/history
router.get("/team-requests/history", getTeamRequestHistory);

// PUT /api/manager/requests/:requestId/cancel

export default router;
