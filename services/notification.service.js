import pool from "../db.js";

/**
 * A reusable function to create a new notification within a database transaction.
 * @param {object} dbClient - The database client from an active transaction.
 * @param {number} employeeId - The ID of the user who will receive the notification.
 * @param {string} message - The content of the notification message.
 * @param {number|null} requestId - (Optional) The ID of the request this notification relates to.
 */
export const createNotification = async (
  dbClient,
  employeeId,
  message,
  requestId = null
) => {
  const newNotificationQuery = `
    INSERT INTO "Notifications" ("EmployeeID", "Message", "LinkToRequestID")
    VALUES ($1, $2, $3);
  `;
  // The query is now run on the provided client, not the global pool
  await dbClient.query(newNotificationQuery, [employeeId, message, requestId]);
  console.log(`Notification created for EmployeeID: ${employeeId}`);
  // By not having a try/catch, any error will automatically propagate up to the controller
};
