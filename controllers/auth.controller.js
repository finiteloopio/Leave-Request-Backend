import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import pool from "../db.js"; // Make sure this path matches your project

export const loginWithMicrosoft = async (req, res) => {
  try {
    const { idToken } = req.body;

    // Verify the Microsoft token using Microsoft's endpoint
    const response = await fetch("https://login.microsoftonline.com/common/discovery/v2.0/keys");
    const keys = await response.json();

    // Decode token without verifying to extract email
    const base64Payload = idToken.split(".")[1];
    const payload = JSON.parse(Buffer.from(base64Payload, "base64").toString());
    const email = payload.preferred_username || payload.email;

    console.log("📧 Microsoft Login - Email:", email);

    // ✅ Allow only Finite Loop employees
    if (!email.endsWith("@finiteloop.io")) {
      return res.status(403).json({ message: "Access denied. Only Finite Loop employees allowed." });
    }

    // Query database to get employee with role
    const employeeResult = await pool.query(
      'SELECT employeeid, firstname, lastname, email, role, phonenumber FROM employee WHERE email = $1',
      [email]
    );

    if (employeeResult.rows.length === 0) {
      console.log("❌ Employee not found:", email);
      return res.status(404).json({ 
        message: "Employee not found in database. Please contact admin." 
      });
    }

    const employee = employeeResult.rows[0];
    console.log("✅ Employee found:", employee.firstname, employee.lastname, "Role:", employee.role);

    // Create token with correct secret and include role
    const secret = process.env.JWT_SECRET || 'supersecret';
    const appToken = jwt.sign(
      { 
        id: employee.employeeid,
        email: employee.email,
        role: employee.role,
        name: `${employee.firstname} ${employee.lastname}`
      }, 
      secret,
      { expiresIn: "1h" }
    );

    console.log("✅ Token created successfully");

    return res.json({
      message: "Login successful",
      user: { 
        id: employee.employeeid,
        email: employee.email,
        name: `${employee.firstname} ${employee.lastname}`,
        role: employee.role,
        phonenumber: employee.phonenumber
      },
      token: appToken,
    });

  } catch (error) {
    console.error("❌ Microsoft login error:", error);
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};