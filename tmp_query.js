import db from './db.js';

async function run() {
  try {
    const userId = 2; // Nithya
    const q = `
      SELECT 
        lr.requestid,
        lt.typename AS "LeaveType",
        lr.startdate AS "StartDate",
        lr.enddate AS "EndDate",
        lr.description AS "Description",
        lr.status AS "Status",
        lr.totaldays AS "TotalDays",
        m.firstname AS "ManagerName"
      FROM leaverequest lr
      JOIN employee m ON lr.managerid = m.employeeid
      JOIN leavetype lt ON lr.leavetypeid = lt.leavetypeid
      WHERE lr.employeeid = $1
      ORDER BY lr.requestid DESC;
    `;
    const r = await db.query(q, [userId]);
    console.log('rows:', r.rows.length);
    console.log(r.rows.slice(0, 5));
  } catch (e) {
    console.error('QUERY ERROR:', e);
  } finally {
    process.exit(0);
  }
}

run();
