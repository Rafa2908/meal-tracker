import { pool } from "../config/database.js";

export const getMe = async (req, res) => {
  const { id } = req.user;

  try {
    const user = await pool.query(
      `
      SELECT first_name, last_name, email FROM users
      WHERE id=$1
      `,
      [id],
    );

    if (user.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json(user.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};
