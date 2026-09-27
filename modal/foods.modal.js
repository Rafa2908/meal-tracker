import { pool } from "../config/database.js";

export const createFoodsTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS foods(
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        calories_per_100g NUMERIC(6,2) NOT NULL,
        protein_per_100g NUMERIC(6,2) NOT NULL,
        fat_per_100g NUMERIC(6,2) NOT NULL,
        carbs_per_100g NUMERIC(6,2) NOT NULL,
        fiber_per_100g NUMERIC(6,2) NOT NULL,
        image_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
      `);
  } catch (error) {
    console.error(error);
  }
};
