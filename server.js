// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session"; // ✅ for passport-azure-ad
import passport from "./config/azureAuth.js"; // ✅ import your passport config
import db from "./db.js"; // PostgreSQL connection

// --- Route Imports ---
import authRoutes from "./routes/auth.routes.js";
import balanceRoutes from "./routes/balance.routes.js";
import holidayRoutes from "./routes/holiday.routes.js";
import leaveRoutes from "./routes/leave.routes.js";
import userRoutes from "./routes/user.routes.js";
import wfhRoutes from "./routes/wfh.routes.js";
import expenseRoutes from "./routes/expense.routes.js";
import deleteLeaveRoutes from "./routes/deleteLeave.routes.js";
import cancelLeaveRoutes from "./routes/cancelLeave.routes.js";
import deleteWFHRoutes from './routes/deleteWFH.routes.js';
import deleteExpenseRoutes from './routes/deleteExpense.routes.js';


// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// --- Middleware ---
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3007",
    "http://localhost:5173",
  ],
  optionsSuccessStatus: 200,
  credentials: true,
  allowedHeaders:
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ✅ Add session middleware (required by passport-azure-ad)
app.use(
  session({
    secret: process.env.JWT_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: true,
  })
);

// ✅ Initialize passport
app.use(passport.initialize());
app.use(passport.session());

// --- Database Connection Check ---
const checkDbConnection = async () => {
  try {
    await db.query("SELECT NOW()");
    console.log("✅ Successfully connected to PostgreSQL database!");
  } catch (error) {
    console.error("❌ Error connecting to PostgreSQL database:", error);
  }
};
checkDbConnection();

// --- Root Route ---
app.get("/", (req, res) => res.send("✅ HR Backend is running!"));

// --- Modular API Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/balances", balanceRoutes);
app.use("/api/holidays", holidayRoutes);
app.use("/api/leave/delete", deleteLeaveRoutes);
// Add these with your other routes
app.use('/api/wfh/delete', deleteWFHRoutes);
app.use('/api/expenses/delete', deleteExpenseRoutes);
app.use("/api/leave/cancel", cancelLeaveRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/users", userRoutes);
app.use("/api/wfh", wfhRoutes);
app.use("/api/expenses", expenseRoutes);


// --- Server Startup ---
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`📍 Routes available:`);
  console.log(`   POST http://localhost:${PORT}/api/leave/submit`);
  console.log(`   GET  http://localhost:${PORT}/api/leave/history`);
  console.log(`   🌐 Microsoft Login -> http://localhost:${PORT}/api/auth/login/microsoft`);
});
