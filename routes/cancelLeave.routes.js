// ========================================
// FILE: server/routes/cancelLeave.routes.js
// ========================================

import express from 'express';
import { cancelLeaveRequest } from '../controllers/cancelLeave.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// POST /api/leave/cancel
router.post('/', protect, cancelLeaveRequest);

export default router;