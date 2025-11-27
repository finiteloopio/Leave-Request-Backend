import pool from '../db.js';
import bcrypt from 'bcryptjs';

export const getManagers = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT employeeid, firstname, lastname FROM employee WHERE role = 'Manager' ORDER BY firstname ASC"
    );
    res.json(result.rows);  // Return array directly
  } catch (error) {
    console.error('Error fetching managers:', error);
    res.status(500).json({ message: 'Server error while fetching managers' });
  }
};

export const createEmployee = async (req, res) => {
  const { employeeid, firstname, lastname, email, role = 'Employee', password } = req.body;

  if (!firstname || !lastname || !email) {
    return res.status(400).json({ success: false, message: 'firstname, lastname, and email are required' });
  }

  try {
    const existing = await pool.query(
      'SELECT employeeid, email FROM employee WHERE email = $1 OR employeeid = $2',
      [email, employeeid || null]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Employee with same email or id already exists' });
    }

    let hashedPassword = null;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password, salt);
    }

    const insertQuery = `
      INSERT INTO employee (employeeid, firstname, lastname, email, role, password)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING employeeid, firstname, lastname, email, role
    `;

    const values = [
      employeeid || null,
      firstname,
      lastname,
      email,
      role,
      hashedPassword,
    ];

    const result = await pool.query(insertQuery, values);

    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating employee:', error);
    return res.status(500).json({ success: false, message: 'Server error while creating employee' });
  }
};