// import express from 'express';
// // Assuming your auth.controller.js is also using ES Module exports
// import { loginWithGoogle, loginWithEmailPassword } from '../controllers/auth.controller.js';

// const router = express.Router();

// // @route   POST /api/auth/google
// // @desc    Authenticate user with Google
// router.post('/google', loginWithGoogle);

// // @route   POST /api/auth/login
// // @desc    Authenticate user with email/password
// router.post('/login', loginWithEmailPassword);

// // THE FIX: Use 'export default' to make the router the default export
// export default router;


// routes/auth.routes.js
import express from "express";
import { loginWithMicrosoft } from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/login/microsoft", loginWithMicrosoft);

export default router;
