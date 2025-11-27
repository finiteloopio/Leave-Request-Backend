import express from 'express';
import { deleteWFHRequest } from '../controllers/deleteWFH.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.delete('/:id', protect, deleteWFHRequest);

export default router;