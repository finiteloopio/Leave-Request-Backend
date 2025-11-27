import pool from "../db.js";

// --- Apply for Expense ---
export const applyForExpense = async (req, res) => {
  const userId = req.user ? req.user.id : null;
  
  if (!userId) {
    return res.status(401).json({ message: "Authentication required. Please login first." });
  }

  const { approverId, date, amount, reason, receiptData, receiptMimeType } = req.body;

  if (!approverId || !date || !amount || !reason) {
    return res.status(400).json({ message: "Please provide all required fields." });
  }

  try {
    // Convert base64 receipt to buffer (if provided)
    const documentBuffer = receiptData ? Buffer.from(receiptData, "base64") : null;

    // Insert expense request
    const result = await pool.query(
      `INSERT INTO leaverequest (employeeid, managerid, leavetypeid, startdate, description, document, amount, requesttype, status)
       VALUES ($1, $2, NULL, $3, $4, $5, $6, 'EXPENSE', 'PENDING') RETURNING *;`,
      [userId, approverId, date, reason, documentBuffer, amount]
    );

    return res.status(201).json({
      success: true,
      message: "Expense request submitted successfully.",
      request: result.rows[0],
    });

  } catch (error) {
    console.error("Error applying for expense:", error);
    res.status(500).json({
      message: "Server error while submitting expense request.",
      error: error.message,
    });
  }
};

// --- Get Expense History ---
export const getExpenseHistory = async (req, res) => {
  const userId = req.user ? req.user.id : null;
  
  if (!userId) {
    return res.status(401).json({ message: "Authentication required. Please login first." });
  }

  try {
    const historyQuery = `
      SELECT 
        lr.requestid AS "RequestID",
        lr.startdate AS "ExpenseDate",
        lr.amount AS "Amount",
        lr.description AS "Description",
        lr.status AS "Status",
        lr.document IS NOT NULL AS "Document",
        COALESCE(m.firstname || ' ' || m.lastname, '-') AS "ManagerName"
      FROM leaverequest lr
      LEFT JOIN employee m ON lr.managerid = m.employeeid
      WHERE lr.employeeid = $1 AND lr.requesttype = 'EXPENSE'
      ORDER BY lr.requestid DESC;
    `;
    const result = await pool.query(historyQuery, [userId]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching expense history:", error);
    res.status(500).json({ message: "Server error while fetching expense history." });
  }
};

// --- Get Expense Receipt ---
export const getExpenseReceipt = async (req, res) => {
  const { requestId } = req.params;
  const userId = req.user ? req.user.id : null;

  if (!userId) {
    return res.status(401).json({ message: "Authentication required." });
  }

  try {
    const receiptQuery = `
      SELECT document 
      FROM leaverequest 
      WHERE requestid = $1 AND employeeid = $2 AND requesttype = 'EXPENSE';
    `;
    const result = await pool.query(receiptQuery, [requestId, userId]);

    if (result.rows.length === 0 || !result.rows[0].document) {
      return res.status(404).json({ message: "Receipt not found." });
    }

    const receipt = result.rows[0];
    
    res.setHeader("Content-Type", "image/jpeg");
    res.send(receipt.document);
    
  } catch (error) {
    console.error("Error fetching expense receipt:", error);
    res.status(500).json({ message: "Server error while fetching receipt." });
  }
};