// ========================================
// FILE: server/controllers/cancelLeave.controller.js
// ========================================

import db from '../db.js';

// Cancel Leave Request Controller
export const cancelLeaveRequest = async (req, res) => {
  const client = await db.connect();
  
  try {
    const { requestId } = req.body;
    const userId = req.user.id;

    // Start transaction
    await client.query('BEGIN');

    // Find the leave request
    const leaveRequestQuery = await client.query(
      `SELECT lr.*, lt.typename, u.username as employeename
       FROM leaverequests lr
       JOIN leavetypes lt ON lr.leavetypeid = lt.leavetypeid
       JOIN users u ON lr.userid = u.userid
       WHERE lr.requestid = $1`,
      [requestId]
    );

    if (leaveRequestQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    const leaveRequest = leaveRequestQuery.rows[0];

    // Check if leave request is approved
    if (leaveRequest.status !== 'approved') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Only approved leave requests can be cancelled'
      });
    }

    // Calculate leave days to refund
    const leaveDays = leaveRequest.totaldays;

    // Update leave request status to REJECTED
    await client.query(
      `UPDATE leaverequests 
       SET status = 'rejected', 
           updatedby = $1, 
           updatedat = NOW() 
       WHERE requestid = $2`,
      [userId, requestId]
    );

    // Refund leave balance
    await client.query(
      `UPDATE leavebalances 
       SET availableleaves = availableleaves + $1, 
           usedleaves = usedleaves - $2
       WHERE userid = $3 AND leavetypeid = $4`,
      [leaveDays, leaveDays, leaveRequest.userid, leaveRequest.leavetypeid]
    );

    // Get updated leave balance
    const updatedBalanceQuery = await client.query(
      `SELECT * FROM leavebalances 
       WHERE userid = $1 AND leavetypeid = $2`,
      [leaveRequest.userid, leaveRequest.leavetypeid]
    );

    // Commit transaction
    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Leave request cancelled and balance refunded successfully',
      data: {
        requestId: requestId,
        refundedDays: leaveDays,
        updatedBalance: updatedBalanceQuery.rows[0]
      }
    });

  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('Error cancelling leave request:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  } finally {
    client.release();
  }
};