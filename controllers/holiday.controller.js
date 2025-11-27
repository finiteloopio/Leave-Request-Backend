import db from "../db.js";

// THE FIX: Use 'export const' to create a named export
export const getAllHolidays = async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM holidays ORDER BY holiday_date ASC"
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching holidays:", error);
    res.status(500).json({ message: "Failed to retrieve holidays." });
  }
};

