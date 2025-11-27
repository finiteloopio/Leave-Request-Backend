import pool from "../db.js";
import { createNotification } from "../services/notification.service.js";

// --- Get Pending Team Requests ---
// Fetches only requests with status = 'pending'
export const getTeamRequests = async (req, res) => {
  const managerId = req.user.id;
  try {
    const query = `
      SELECT 
        lr."RequestID", 
        lr."RequestType", 
        lr."StartDate", 
        lr."EndDate", 
        lr."Description", 
        lr."Status", 
        lr."TotalDays", 
        lr."Amount",
        (lr."Document" IS NOT NULL) as "HasDocument",
        emp."FirstName" AS "EmployeeName"
      FROM "LeaveRequest" lr
      JOIN "Employee" emp ON lr."EmployeeID" = emp."EmployeeID"
      WHERE lr."ManagerID" = $1 AND lr."Status" = 'pending'
      ORDER BY lr."CreatedAt" ASC;
    `;
    const result = await pool.query(query, [managerId]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching team requests:", error);
    res
      .status(500)
      .json({ message: "Server error while fetching team requests." });
  }
};

// --- Update Request Status (Helper for Approve/Reject) ---
const updateRequestStatus = async (req, res, newStatus) => {
  const { requestId } = req.params;
  const managerId = req.user.id;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const requestResult = await client.query(
      'SELECT * FROM "LeaveRequest" WHERE "RequestID" = $1 AND "ManagerID" = $2 AND "Status" = \'pending\'',
      [requestId, managerId]
    );

    if (requestResult.rows.length === 0) {
      throw new Error(
        "Request not found, already actioned, or you are not authorized."
      );
    }
    const request = requestResult.rows[0];

    // --- Balance Deduction Logic ---
    if (newStatus === "approved") {
      let balanceColumn;
      if (request.RequestType === "wfh") {
        balanceColumn = '"WFHBalance"';
      } else if (request.RequestType === "leave") {
        const leaveTypeResult = await client.query(
          'SELECT "TypeName" FROM "LeaveType" WHERE "LeaveTypeID" = $1',
          [request.LeaveTypeID]
        );
        const leaveTypeName = leaveTypeResult.rows[0].TypeName;

        const columnMap = {
          Casual: '"EarnedLeave"',
          Sick: '"SickLeave"',
          Personal: '"PersonalLeave"',
          Earned: '"EarnedLeave"',
        };
        balanceColumn = columnMap[leaveTypeName];

        if (!balanceColumn) {
          throw new Error(
            `Invalid leave type name for balance deduction: ${leaveTypeName}`
          );
        }
      }

      if (balanceColumn) {
        const daysToDeduct = parseInt(request.TotalDays, 10);
        const balanceCheckQuery = `SELECT ${balanceColumn} as "balance" FROM "Employee" WHERE "EmployeeID" = $1`;
        const balanceResult = await client.query(balanceCheckQuery, [
          request.EmployeeID,
        ]);
        const availableBalance = balanceResult.rows[0].balance;

        if (daysToDeduct > availableBalance) {
          throw new Error(
            `Insufficient ${request.RequestType} balance. Employee only has ${availableBalance} days.`
          );
        }

        const updateBalanceQuery = `
          UPDATE "Employee" 
          SET ${balanceColumn} = ${balanceColumn} - $1 
          WHERE "EmployeeID" = $2;
        `;
        await client.query(updateBalanceQuery, [
          daysToDeduct,
          request.EmployeeID,
        ]);
      }
    }
    // --- End of Balance Deduction Logic ---

    await client.query(
      'UPDATE "LeaveRequest" SET "Status" = $1, "UpdatedAt" = CURRENT_TIMESTAMP WHERE "RequestID" = $2',
      [newStatus, requestId]
    );

    const managerName = (
      await client.query(
        'SELECT "FirstName" FROM "Employee" WHERE "EmployeeID" = $1',
        [managerId]
      )
    ).rows[0].FirstName;
    const message = `Your ${request.RequestType} request has been ${newStatus} by ${managerName}.`;
    await createNotification(client, request.EmployeeID, message, requestId);

    await client.query("COMMIT");
    res.status(200).json({ message: `Request successfully ${newStatus}.` });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(`Error while trying to ${newStatus} request:`, error);
    res.status(500).json({
      message: error.message || `Server error while ${newStatus} request.`,
    });
  } finally {
    client.release();
  }
};

export const approveRequest = (req, res) => {
  updateRequestStatus(req, res, "approved");
};

export const rejectRequest = (req, res) => {
  updateRequestStatus(req, res, "rejected");
};

// --- Get Team Request History ---
// Fetches only requests that are NOT pending
export const getTeamRequestHistory = async (req, res) => {
  const managerId = req.user.id;
  try {
    const query = `
      SELECT 
        lr."RequestID", 
        lr."RequestType", 
        lr."StartDate", 
        lr."EndDate", 
        lr."Status",
        lr."Amount",
        lr."Description",
        lr."TotalDays",
        (lr."Document" IS NOT NULL) as "HasDocument",
        emp."FirstName" AS "EmployeeName"
      FROM "LeaveRequest" lr
      JOIN "Employee" emp ON lr."EmployeeID" = emp."EmployeeID"
      WHERE lr."ManagerID" = $1 AND lr."Status" != 'pending' 
      ORDER BY lr."UpdatedAt" DESC;
    `;
    const result = await pool.query(query, [managerId]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching team request history:", error);
    res.status(500).json({ message: "Server error while fetching history." });
  }
};

// --- Manager Cancels an Approved Request ---
export const cancelApprovedRequest = async (req, res) => {
  const { requestId } = req.params;
  const managerId = req.user.id;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const requestResult = await client.query(
      'SELECT * FROM "LeaveRequest" WHERE "RequestID" = $1 AND "ManagerID" = $2 AND "Status" = \'approved\'',
      [requestId, managerId]
    );

    if (requestResult.rows.length === 0) {
      throw new Error(
        "Request not found, not approved, or you are not authorized."
      );
    }
    const request = requestResult.rows[0];

    // --- Balance Refund Logic ---
    let balanceColumn;
    if (request.RequestType === "wfh") {
      balanceColumn = '"WFHBalance"';
    } else if (request.RequestType === "leave") {
      const leaveTypeResult = await client.query(
        'SELECT "TypeName" FROM "LeaveType" WHERE "LeaveTypeID" = $1',
        [request.LeaveTypeID]
      );
      const leaveTypeName = leaveTypeResult.rows[0].TypeName;

      const columnMap = {
        Casual: '"EarnedLeave"',
        Sick: '"SickLeave"',
        Personal: '"PersonalLeave"',
        Earned: '"EarnedLeave"',
      };
      balanceColumn = columnMap[leaveTypeName];

      if (!balanceColumn) {
        throw new Error(
          `Invalid leave type name for balance refund: ${leaveTypeName}`
        );
      }
    }

    if (balanceColumn) {
      const daysToRefund = parseInt(request.TotalDays, 10);
      const updateBalanceQuery = `
        UPDATE "Employee" 
        SET ${balanceColumn} = ${balanceColumn} + $1 
        WHERE "EmployeeID" = $2;
      `;
      await client.query(updateBalanceQuery, [
        daysToRefund,
        request.EmployeeID,
      ]);
    }
    // --- End of Balance Refund Logic ---

    await client.query(
      'UPDATE "LeaveRequest" SET "Status" = \'cancelled\', "UpdatedAt" = CURRENT_TIMESTAMP WHERE "RequestID" = $1',
      [requestId]
    );

    const managerName = (
      await client.query(
        'SELECT "FirstName" FROM "Employee" WHERE "EmployeeID" = $1',
        [managerId]
      )
    ).rows[0].FirstName;
    const message = `Your previously approved ${request.RequestType} request has been cancelled by ${managerName}.`;
    await createNotification(client, request.EmployeeID, message, requestId);

    await client.query("COMMIT");
    res
      .status(200)
      .json({ message: "Approved request successfully cancelled." });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error cancelling approved request:", error);
    res.status(500).json({
      message: error.message || "Server error while cancelling request.",
    });
  } finally {
    client.release();
  }
};
