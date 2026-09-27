import "dotenv/config";
import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export const testConnection = async () => {
  try {
    const test = await pool.query("SELECT NOW()");

    if (test.rowCount > 0) {
      console.log("DB Connected✅");
    }
  } catch (error) {
    console.error(error);
  }
};
