import { pool } from "../config/database.js";

export const createGoalsTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS goals(
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        daily_calories INTEGER NOT NULL,
        daily_protein_g NUMERIC(6,2) NOT NULL,
        daily_carbs_g NUMERIC(6,2) NOT NULL,
        daily_fiber_g NUMERIC(6,2) NOT NULL,
        daily_fat_g NUMERIC(6,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
      `);
  } catch (error) {
    console.error(error);
  }
};
