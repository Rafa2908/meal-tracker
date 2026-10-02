import "dotenv/config";
import { Pool, types } from "pg";

// OID 1700 = NUMERIC; pg returns it as a string by default to avoid
// precision loss, but our macro columns are small enough to use as numbers.
types.setTypeParser(1700, (value) => parseFloat(value));

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
