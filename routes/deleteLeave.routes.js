



import express from 'express';
import { deleteLeaveRequest } from '../controllers/deleteLeave.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.delete('/:id', protect, deleteLeaveRequest);

export default router;