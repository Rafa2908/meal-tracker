import { pool } from "../config/database.js";

// Elastic Beanstalk polls this. Checking the database means a lost RDS
// connection shows up as an unhealthy instance instead of a quiet 500 stream.
export const getHealthStatus = async (req, res) => {
  try {
    await pool.query("SELECT 1");
    return res.status(200).json({ status: "OK" });
  } catch {
    return res.status(503).json({ status: "DB_UNAVAILABLE" });
  }
};
