import express from 'express';
import { deleteExpenseRequest } from '../controllers/deleteExpense.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.delete('/:id', protect, deleteExpenseRequest);

export default router;