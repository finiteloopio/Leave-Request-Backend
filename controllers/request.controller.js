import pool from "../db.js";
import { createNotification } from "../services/notification.service.js";

// Controller for an employee to cancel their OWN pending request
export const cancelMyRequest = async (req, res) => {
  const { requestId } = req.params;
  const userId = req.user.id;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Find the request and verify ownership and status
    const requestResult = await client.query(
      'SELECT * FROM "LeaveRequest" WHERE "RequestID" = $1 AND "EmployeeID" = $2',
      [requestId, userId]
    );

    if (requestResult.rows.length === 0) {
      throw new Error(
        "Request not found or you are not authorized to cancel it."
      );
    }
    if (requestResult.rows[0].Status !== "pending") {
      throw new Error("Only pending requests can be cancelled.");
    }

    // 2. Update the status to 'cancelled'
    await client.query(
      'UPDATE "LeaveRequest" SET "Status" = \'cancelled\' WHERE "RequestID" = $1',
      [requestId]
    );

    // 3. (Optional) Notify the manager that the request was withdrawn
    const managerId = requestResult.rows[0].ManagerID;
    const employeeName = (
      await client.query(
        'SELECT "FirstName" FROM "Employee" WHERE "EmployeeID" = $1',
        [userId]
      )
    ).rows[0].FirstName;
    await createNotification(
      client,
      managerId,
      `The request from ${employeeName} has been withdrawn by the employee.`,
      requestId
    );

    await client.query("COMMIT");
    res.status(200).json({ message: "Request successfully cancelled." });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error cancelling request:", error);
    res
      .status(500)
      .json({
        message: error.message || "Server error while cancelling request.",
      });
  } finally {
    client.release();
  }
};
