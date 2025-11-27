


import express from 'express';
import { getManagers, createEmployee } from '../controllers/user.controller.js';


const router = express.Router();

// for now, remove protect() to test freely
router.get('/managers', getManagers);

// create employee
router.post('/', createEmployee);

export default router;
