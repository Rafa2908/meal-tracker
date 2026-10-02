import "dotenv/config";
import { Pool } from "pg";

const isTest = process.env.NODE_ENV === "test";

export const pool = new Pool({
  connectionString: isTest ? process.env.TEST_DB_URL : process.env.DATABASE_URL,
  ssl: isTest ? false : { rejectUnauthorized: false },
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
