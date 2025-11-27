import express from "express";
import {
  getNotificationsForUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
    getUnreadNotificationCount,
} from "../controllers/notification.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// All notification routes are protected and require a valid login token
router.use(protect);

router.get('/unread-count', getUnreadNotificationCount);

// GET /api/notifications - Fetches all notifications for the user
router.get("/", getNotificationsForUser);

// PUT /api/notifications/read-all - Marks all notifications as read
router.put("/read-all", markAllNotificationsAsRead);

// PUT /api/notifications/:notificationId/read - Marks a single notification as read
router.put("/:notificationId/read", markNotificationAsRead);

export default router;
