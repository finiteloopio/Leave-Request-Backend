import pool from "../db.js";

// Controller to get all notifications for the currently logged-in user
export const getNotificationsForUser = async (req, res) => {
  const userId = req.user.id;
  try {
    // THE KEY CHANGE: This query now joins the "LeaveRequest" table to get more details
    const notificationsQuery = `
      SELECT
        n."NotificationID",
        n."Message",
        n."IsRead",
        n."LinkToRequestID",
        n."CreatedAt",
        lr."RequestType",
        lr."StartDate",
        lr."EndDate",
        lr."Description",
        lr."Amount",
        lr."Status" as "RequestStatus"
      FROM "Notifications" n
      LEFT JOIN "LeaveRequest" lr ON n."LinkToRequestID" = lr."RequestID"
      WHERE n."EmployeeID" = $1
      ORDER BY n."CreatedAt" DESC;
    `;
    const result = await pool.query(notificationsQuery, [userId]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res
      .status(500)
      .json({ message: "Server error while fetching notifications." });
  }
};

// Controller to mark a single notification as read
export const markNotificationAsRead = async (req, res) => {
  const { notificationId } = req.params;
  const userId = req.user.id;
  try {
    const updateQuery = `
      UPDATE "Notifications"
      SET "IsRead" = true
      WHERE "NotificationID" = $1 AND "EmployeeID" = $2
      RETURNING *;
    `;
    const result = await pool.query(updateQuery, [notificationId, userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({
        message:
          "Notification not found or you are not authorized to update it.",
      });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res
      .status(500)
      .json({ message: "Server error while updating notification." });
  }
};

// Controller to mark all of a user's notifications as read
export const markAllNotificationsAsRead = async (req, res) => {
  const userId = req.user.id;
  try {
    const updateQuery = `
      UPDATE "Notifications"
      SET "IsRead" = true
      WHERE "EmployeeID" = $1;
    `;
    await pool.query(updateQuery, [userId]);
    res.status(200).json({ message: "All notifications marked as read." });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res
      .status(500)
      .json({ message: "Server error while updating notifications." });
  }
};

export const getUnreadNotificationCount = async (req, res) => {
  const userId = req.user.id;
  try {
    const countQuery = `
      SELECT COUNT(*) FROM "Notifications"
      WHERE "EmployeeID" = $1 AND "IsRead" = false;
    `;
    const result = await pool.query(countQuery, [userId]);
    // The result from COUNT(*) is in a 'count' property
    const count = parseInt(result.rows[0].count, 10);
    res.status(200).json({ count });
  } catch (error) {
    console.error("Error fetching unread notification count:", error);
    res
      .status(500)
      .json({ message: "Server error while fetching notification count." });
  }
};
