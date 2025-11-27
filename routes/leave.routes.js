import express from "express";
// Assuming your controller and middleware will also be ES Modules
import { applyForLeave, getLeaveTypes, getLeaveHistory, getLeaveBalance, getManagerPendingRequests, decideLeaveRequest, getManagerRequestHistory, cancelLeaveRequest } from "../controllers/leave.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// @route   POST /api/leave/apply
// @desc    Submit a new leave request
// Secure endpoints: must be authenticated
router.post("/apply", protect, applyForLeave);

// @route   GET /api/leave/types
// @desc    Get available leave types
router.get("/types", getLeaveTypes);

// @route   GET /api/leave/history
// @desc    Get leave history for current/selected employee
router.get("/history", protect, getLeaveHistory);

// @route   GET /api/leave/balance
router.get("/balance", protect, getLeaveBalance);

// Manager endpoints
router.get("/manager/pending", protect, getManagerPendingRequests);
router.post("/manager/requests/:id/decide", protect, decideLeaveRequest);
router.post("/manager/requests/cancel", protect, cancelLeaveRequest);
router.get("/manager/history", protect, getManagerRequestHistory);


// Use 'export default' to make the router the default export
export default router;
