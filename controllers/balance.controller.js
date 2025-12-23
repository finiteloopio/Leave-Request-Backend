import pool from "../db.js";

// --- Controller for an employee to get their OWN balances ---
export const getMyBalances = async (req, res) => {
  const userId = req.user.id;
  try {
    // THE FIX: Select balance columns from the "employee" table (lowercase), alias to match frontend expectations
    const query = `
      SELECT earnedleave as "EarnedLeave", sickleave as "SickLeave", personalleave as "PersonalLeave", vacationleave as "VacationLeave", 0 as "WFHBalance"
      FROM employee
      WHERE employeeid = $1;
    `;
    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Employee not found." });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching 'my balances':", error);
    res.status(500).json({ message: "Server error while fetching balances." });
  }
};

// --- (Manager functions remain the same) ---

// Controller for a manager to get the balances of their team members
export const getTeamBalances = async (req, res) => {
  const managerId = req.user.id;
  try {
    const query = `
      SELECT 
        "EmployeeID", "FirstName", "LastName", "Email",
        "EarnedLeave", "SickLeave", "PersonalLeave", "VacationLeave", "WFHBalance"
      FROM "Employee"
      WHERE "ManagerID" = $1
      ORDER BY "FirstName";
    `;
    const result = await pool.query(query, [managerId]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching team balances:", error);
    res
      .status(500)
      .json({ message: "Server error while fetching team balances." });
  }
};

// Controller for a manager to update an employee's balances
export const updateEmployeeBalance = async (req, res) => {
  const managerId = req.user.id;
  const { employeeId } = req.params;
  const { earnedLeave, sickLeave, personalLeave, vacationLeave, wfhBalance } =
    req.body;

  if (
    earnedLeave === undefined ||
    sickLeave === undefined ||
    personalLeave === undefined ||
    vacationLeave === undefined 
  ) {
    return res
      .status(400)
      .json({ message: "All balance fields are required." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const checkQuery =
      'SELECT "EmployeeID" FROM "Employee" WHERE "EmployeeID" = $1 AND "ManagerID" = $2';
    const checkResult = await client.query(checkQuery, [employeeId, managerId]);

    if (checkResult.rows.length === 0) {
      throw new Error(
        "You are not authorized to update this employee's balance."
      );
    }

    const updateQuery = `
      UPDATE "Employee"
      SET 
        "EarnedLeave" = $1,
        "SickLeave" = $2,
        "PersonalLeave" = $3,
        "VacationLeave" = $4,
        
      WHERE "EmployeeID" = $5;
    `;
    await client.query(updateQuery, [
      earnedLeave,
      sickLeave,
      personalLeave,
      wfhBalance,
      employeeId,
    ]);

    await client.query("COMMIT");
    res
      .status(200)
      .json({ message: "Employee balances updated successfully." });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating balance:", error);
    res.status(500).json({
      message: error.message || "Server error while updating balance.",
    });
  } finally {
    client.release();
  }
};
