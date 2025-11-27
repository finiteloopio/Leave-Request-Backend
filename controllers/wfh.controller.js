import pool from "../db.js";

// --- Apply for WFH ---
export const applyForWFH = async (req, res) => {
  const userId = req.user ? req.user.id : null;
  
  if (!userId) {
    return res.status(401).json({ message: "Authentication required. Please login first." });
  }

  const { approverId, startDate, endDate, reason } = req.body;

  if (!approverId || !startDate || !endDate || !reason) {
    return res.status(400).json({ message: "Please provide all required fields." });
  }

  try {
    // Calculate working days (holidays optional)
    let holidays = [];
    try {
      const holidaysResult = await pool.query("SELECT holiday_date FROM holidays");
      holidays = holidaysResult.rows.map((h) => h.holiday_date.toISOString().split("T")[0]);
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

    // Insert WFH request (no leavetypeid needed, it's NULL)
    const result = await pool.query(
      `INSERT INTO leaverequest (employeeid, managerid, leavetypeid, startdate, enddate, description, totaldays, requesttype, status)
       VALUES ($1, $2, NULL, $3, $4, $5, $6, 'WFH', 'PENDING') RETURNING *;`,
      [userId, approverId, startDate, endDate, reason, totalDays]
    );

    return res.status(201).json({
      success: true,
      message: "WFH request submitted successfully.",
      request: result.rows[0],
    });

  } catch (error) {
    console.error("Error applying for WFH:", error);
    res.status(500).json({
      message: "Server error while submitting WFH request.",
      error: error.message,
    });
  }
};

// --- Get WFH History ---
export const getWFHHistory = async (req, res) => {
  const userId = req.user ? req.user.id : null;
  
  if (!userId) {
    return res.status(401).json({ message: "Authentication required. Please login first." });
  }

  try {
    const historyQuery = `
      SELECT 
        lr.requestid,
        lr.startdate AS "StartDate",
        lr.enddate AS "EndDate",
        lr.description AS "Description",
        lr.status AS "Status",
        lr.totaldays AS "TotalDays",
        COALESCE(m.firstname || ' ' || m.lastname, '-') AS "ManagerName"
      FROM leaverequest lr
      LEFT JOIN employee m ON lr.managerid = m.employeeid
      WHERE lr.employeeid = $1 AND lr.requesttype = 'WFH'
      ORDER BY lr.requestid DESC;
    `;
    const result = await pool.query(historyQuery, [userId]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching WFH history:", error);
    res.status(500).json({ message: "Server error while fetching WFH history." });
  }
};