import { pool } from "../config/database.js";

export const createDailyProgressTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_progress(
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        total_calories INTEGER NOT NULL DEFAULT 0,
        total_protein_g NUMERIC(6,2) NOT NULL DEFAULT 0,
        total_carbs_g NUMERIC(6,2) NOT NULL DEFAULT 0,
        total_fiber_g NUMERIC(6,2) NOT NULL DEFAULT 0,
        total_fat_g NUMERIC(6,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, date)
      )
      `);
  } catch (error) {
    console.error(error);
  }
};
