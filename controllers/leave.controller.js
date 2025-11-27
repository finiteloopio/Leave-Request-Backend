import pool from "../db.js";

// --- Apply for Leave (Refactored for New Schema) ---
export const applyForLeave = async (req, res) => {
  // Get user ID from authenticated token
  const userId = req.user ? req.user.id : null;
  
  if (!userId) {
    return res.status(401).json({ message: "Authentication required. Please login first." });
  }
  const { approverId, leaveTypeName, startDate, endDate, reason } = req.body;

  if (!approverId || !leaveTypeName || !startDate || !endDate) {
    return res
      .status(400)
      .json({ message: "Please provide all required fields." });
  }

  try {
    console.log("[applyForLeave] payload:", {
      userId,
      approverId,
      leaveTypeName,
      startDate,
      endDate,
    });

    // 1. Get the leavetypeid from the leavetype table (lowercase schema)
    let step = "lookup_leave_type";
    let leaveTypeResult;
    try {
      leaveTypeResult = await pool.query(
        'SELECT leavetypeid FROM leavetype WHERE typename = $1',
        [leaveTypeName]
      );
    } catch (err) {
      console.error("applyForLeave error at lookup_leave_type:", err);
      return res.status(500).json({ message: "DB error", step: "lookup_leave_type", error: err.message });
    }
    if (leaveTypeResult.rows.length === 0) {
      return res.status(400).json({ message: "Invalid leave type specified." });
    }
    const leaveTypeId = leaveTypeResult.rows[0].leavetypeid;

    // 2. Calculate working days (holidays optional)
    let holidays = [];
    try {
      step = "fetch_holidays";
      const holidaysResult = await pool.query(
        "SELECT holiday_date FROM holidays"
      );
      holidays = holidaysResult.rows.map(
        (h) => h.holiday_date.toISOString().split("T")[0]
      );
    } catch (_err) {
      // If holidays table doesn't exist, just ignore
      holidays = [];
    }
    let totalDays = 0;
    let currentDate = new Date(startDate);
    const lastDate = new Date(endDate);
    while (currentDate <= lastDate) {
      const dayOfWeek = currentDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const formattedCurrentDate = currentDate.toISOString().split("T")[0];
      const isHoliday = holidays.includes(formattedCurrentDate);
      if (!isWeekend && !isHoliday) {
        totalDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // 3. Insert request without deducting balance
    step = "insert_request";
    const result = await pool.query(
      `INSERT INTO leaverequest (employeeid, managerid, leavetypeid, startdate, enddate, description, totaldays, requesttype, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;`,
      [userId, approverId, leaveTypeId, startDate, endDate, reason, totalDays, 'LEAVE', 'PENDING']
    );

    return res.status(201).json({
      success: true,
      message: "Leave request submitted successfully.",
      request: result.rows[0],
    });

  } catch (error) {
    console.error("Error applying for leave (outer):", error);
    res.status(500).json({
      message: "Server error while submitting leave request.",
      error: error.message,
      detail: error.detail,
      code: error.code,
      constraint: error.constraint,
      step,
    });
  }
};

// --- Get Leave History ---
export const getLeaveHistory = async (req, res) => {
  const userId = req.user ? req.user.id : null;
  
  if (!userId) {
    return res.status(401).json({ message: "Authentication required. Please login first." });
  }
  try {
    const historyQuery = `
      SELECT 
        lr.requestid,
        lt.typename AS "LeaveType",
        lr.startdate AS "StartDate",
        lr.enddate AS "EndDate",
        lr.description AS "Description",
        lr.status AS "Status",
        lr.totaldays AS "TotalDays",
        COALESCE(m.firstname, '-') AS "ManagerName"
      FROM leaverequest lr
      LEFT JOIN employee m ON lr.managerid = m.employeeid
      JOIN leavetype lt ON lr.leavetypeid = lt.leavetypeid
      WHERE lr.employeeid = $1
      ORDER BY lr.requestid DESC;
    `;
    const result = await pool.query(historyQuery, [userId]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching leave history:", error);
    res.status(500).json({ message: "Server error while fetching leave history." });
  }
};

// --- Get Leave Types ---
export const getLeaveTypes = async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT leavetypeid, typename FROM leavetype ORDER BY typename ASC"
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Error fetching leave types:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve leave types." });
  }
};

// --- Get current leave balances for an employee ---
export const getLeaveBalance = async (req, res) => {
  const employeeId = req.user ? req.user.id : null;
  if (!employeeId) {
    return res.status(401).json({ success: false, message: "Authentication required. Please login first." });
  }
  try {
    // Return balances from employee table columns so it matches the numbers you maintain
    const q = `
      SELECT 1 as ord, 'Earned Leave'   as typename, earnedleave   as remaining FROM employee WHERE employeeid = $1
      UNION ALL
      SELECT 2, 'Personal Leave', personalleave FROM employee WHERE employeeid = $1
      UNION ALL
      SELECT 3, 'Sick Leave',    sickleave     FROM employee WHERE employeeid = $1
      UNION ALL
      SELECT 4, 'Vacation Leave', vacationleave FROM employee WHERE employeeid = $1
      ORDER BY ord`;
    const result = await pool.query(q, [employeeId]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching leave balance:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve leave balance.' });
  }
};

// --- Manager: Get pending team requests ---
export const getManagerPendingRequests = async (req, res) => {
  const managerId = req.user ? req.user.id : null;
  if (!managerId) {
    return res.status(401).json({ message: "Authentication required." });
  }
  try {
    const q = `
      SELECT lr.requestid, lr.employeeid, lr.leavetypeid, lt.typename,
             lr.startdate, lr.enddate, lr.description, lr.totaldays, lr.status,
             e.firstname || ' ' || e.lastname AS employeename
      FROM leaverequest lr
      JOIN employee e ON e.employeeid = lr.employeeid
      JOIN leavetype lt ON lt.leavetypeid = lr.leavetypeid
      WHERE lr.managerid = $1 AND lr.status = 'PENDING'
      ORDER BY lr.requestid DESC`;
    const r = await pool.query(q, [managerId]);
    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error('Error fetching manager pending requests:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch requests' });
  }
};

// --- Manager: Approve/Reject request ---
export const decideLeaveRequest = async (req, res) => {
  const managerId = req.user ? req.user.id : null;
  const requestId = parseInt(req.params.id, 10);
  const decision = (req.body.decision || '').toUpperCase();
  if (!managerId) return res.status(401).json({ message: 'Authentication required.' });
  if (!requestId || !['APPROVED','REJECTED'].includes(decision)) {
    return res.status(400).json({ message: 'Invalid request or decision.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Load request
    const rq = await client.query(
      `SELECT employeeid, leavetypeid, totaldays, status FROM leaverequest WHERE requestid = $1 AND managerid = $2 FOR UPDATE`,
      [requestId, managerId]
    );
    if (rq.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Request not found.' });
    }
    const reqRow = rq.rows[0];
    if (reqRow.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Request already decided.' });
    }

    // Update status
    await client.query(`UPDATE leaverequest SET status = $1, updatedat = NOW() WHERE requestid = $2`, [decision, requestId]);

    if (decision === 'APPROVED') {
      // Deduct balance from employee_leaves by type
      const updateResult = await client.query(
        `UPDATE employee_leaves
         SET remaining = remaining - $1, used = used + $1, updated_at = NOW()
         WHERE employeeid = $2 AND leavetypeid = $3 AND remaining >= $1`,
        [reqRow.totaldays, reqRow.employeeid, reqRow.leavetypeid]
      );

      if (updateResult.rowCount === 0) {
        throw new Error('Insufficient balance for selected leave type');
      }

      // Also reflect deduction in legacy employee columns for dashboard
      const typeNameRes = await client.query('SELECT typename FROM leavetype WHERE leavetypeid = $1', [reqRow.leavetypeid]);
      const typeName = (typeNameRes.rows[0]?.typename || '').toLowerCase();
      let columnName = null;
      if (typeName.includes('earned')) columnName = 'earnedleave';
      else if (typeName.includes('sick')) columnName = 'sickleave';
      else if (typeName.includes('personal')) columnName = 'personalleave';
      else if (typeName.includes('vacation')) columnName = 'vacationleave';
      if (columnName) {
        await client.query(
          `UPDATE employee SET ${columnName} = GREATEST(0, ${columnName} - $1) WHERE employeeid = $2`,
          [reqRow.totaldays, reqRow.employeeid]
        );
      }
    } else if (decision === 'REJECTED') {
      // No deduction occurred, so no refund needed
    }

    await client.query('COMMIT');
    res.json({ success: true, message: `Request ${decision.toLowerCase()}` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deciding request:', err);
    res.status(500).json({ success: false, message: 'Failed to update request' });
  } finally {
    client.release();
  }
};



// --- Manager: History of handled requests ---
export const getManagerRequestHistory = async (req, res) => {
  const managerId = req.user ? req.user.id : null;
  if (!managerId) return res.status(401).json({ message: 'Authentication required.' });
  try {
    const q = `
      SELECT lr.requestid, lr.status, lr.startdate, lr.enddate, lr.totaldays,
             lt.typename, e.firstname || ' ' || e.lastname AS employeename
      FROM leaverequest lr
      JOIN employee e ON e.employeeid = lr.employeeid
      JOIN leavetype lt ON lt.leavetypeid = lr.leavetypeid
      WHERE lr.managerid = $1 AND lr.status IN ('APPROVED','REJECTED')
      ORDER BY lr.requestid DESC`;
    const r = await pool.query(q, [managerId]);
    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error('Error fetching manager history:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch request history' });
  }

};

// --- Manager: Cancel approved request (back to pending) ---
export const cancelLeaveRequest = async (req, res) => {
  const managerId = req.user ? req.user.id : null;
  const { requestId } = req.body;
  if (!managerId) return res.status(401).json({ message: 'Authentication required.' });
  if (!requestId) return res.status(400).json({ message: 'Request ID required.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Load request
    const rq = await client.query(
      `SELECT employeeid, leavetypeid, totaldays, status FROM leaverequest WHERE requestid = $1 AND managerid = $2 FOR UPDATE`,
      [requestId, managerId]
    );
    if (rq.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Request not found.' });
    }
    const reqRow = rq.rows[0];
    if (reqRow.status !== 'APPROVED') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Only approved requests can be cancelled.' });
    }

    // Update status to REJECTED
    await client.query(`UPDATE leaverequest SET status = 'REJECTED', updatedat = NOW() WHERE requestid = $1`, [requestId]);

    // Refund balances
    await client.query(
      `UPDATE employee_leaves SET remaining = remaining + $1, used = GREATEST(0, used - $1), updated_at = NOW()
       WHERE employeeid = $2 AND leavetypeid = $3`,
      [reqRow.totaldays, reqRow.employeeid, reqRow.leavetypeid]
    );

    // Refund legacy employee columns
    const typeNameRes = await client.query('SELECT typename FROM leavetype WHERE leavetypeid = $1', [reqRow.leavetypeid]);
    const typeName = (typeNameRes.rows[0]?.typename || '').toLowerCase();
    let columnName = null;
    if (typeName.includes('earned')) columnName = 'earnedleave';
    else if (typeName.includes('sick')) columnName = 'sickleave';
    else if (typeName.includes('personal')) columnName = 'personalleave';
    else if (typeName.includes('vacation')) columnName = 'vacationleave';
    if (columnName) {
      await client.query(`UPDATE employee SET ${columnName} = ${columnName} + $1 WHERE employeeid = $2`, [reqRow.totaldays, reqRow.employeeid]);
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Request cancelled successfully.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error cancelling request:', err);
    res.status(500).json({ success: false, message: 'Failed to cancel request' });
  } finally {
    client.release();
  }
};
