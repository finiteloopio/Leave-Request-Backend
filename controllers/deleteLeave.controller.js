import pool from "../db.js";

// --- Delete Leave Request ---
export const deleteLeaveRequest = async (req, res) => {
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

    // Get the request details to refund the balance
    const requestQuery = await client.query(
      `SELECT employeeid, leavetypeid, totaldays, status 
       FROM leaverequest 
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

    // If request is PENDING, refund the balance
    if (request.status === 'PENDING') {
      // Refund to employee_leaves
      await client.query(
        `UPDATE employee_leaves 
         SET remaining = remaining + $1, used = GREATEST(0, used - $1), updated_at = NOW()
         WHERE employeeid = $2 AND leavetypeid = $3`,
        [request.totaldays, request.employeeid, request.leavetypeid]
      );

      // Refund to legacy employee columns
      const typeNameRes = await client.query(
        'SELECT typename FROM leavetype WHERE leavetypeid = $1',
        [request.leavetypeid]
      );
      const typeName = (typeNameRes.rows[0]?.typename || '').toLowerCase();
      let columnName = null;
      if (typeName.includes('earned')) columnName = 'earnedleave';
      else if (typeName.includes('sick')) columnName = 'sickleave';
      else if (typeName.includes('personal')) columnName = 'personalleave';
      else if (typeName.includes('vacation')) columnName = 'vacationleave';
      
      if (columnName) {
        await client.query(
          `UPDATE employee SET ${columnName} = ${columnName} + $1 WHERE employeeid = $2`,
          [request.totaldays, request.employeeid]
        );
      }
    }

    // Delete the request
    await client.query(
      'DELETE FROM leaverequest WHERE requestid = $1',
      [requestId]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: "Leave request deleted successfully." });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting leave request:', err);
    res.status(500).json({ success: false, message: 'Failed to delete request.' });
  } finally {
    client.release();
  }
};