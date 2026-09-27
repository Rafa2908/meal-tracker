import { pool } from "../config/database.js";

export const createMealsTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS meals(
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        meal_type_id INTEGER NOT NULL REFERENCES meal_types(id),
        logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
      `);
  } catch (error) {
    console.error(error);
  }
};
