import pool from "../db.js";

// --- Delete Expense Request ---
export const deleteExpenseRequest = async (req, res) => {
  const userId = req.user ? req.user.id : null;
  const requestId = parseInt(req.params.id, 10);

  if (!userId) {
    return res.status(401).json({ message: "Authentication required." });
  }

  if (!requestId) {
    return res.status(400).json({ message: "Invalid request ID." });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get the request details
    const requestQuery = await client.query(
      `SELECT employeeid, status 
       FROM expenserequest 
       WHERE requestid = $1 AND employeeid = $2`,
      [requestId, userId]
    );

    if (requestQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: "Request not found or you don't have permission to delete it." });
    }

    const request = requestQuery.rows[0];

    // Only allow deletion of PENDING or REJECTED requests
    if (request.status === 'APPROVED') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: "Cannot delete approved requests." });
    }

    // Delete the request
    await client.query(
      'DELETE FROM expenserequest WHERE requestid = $1',
      [requestId]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: "Expense request deleted successfully." });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting expense request:', err);
    res.status(500).json({ success: false, message: 'Failed to delete request.' });
  } finally {
    client.release();
  }
};