import { pool } from "../config/database.js";

export const createMealTypesTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS meal_types(
        id SERIAL PRIMARY KEY,
        name VARCHAR(20) NOT NULL UNIQUE,
        sort_order SMALLINT NOT NULL
      )
      `);
  } catch (error) {
    console.error(error);
  }
};

export const seedMealTypesTable = async () => {
  try {
    await pool.query(`
      INSERT INTO meal_types (name, sort_order) VALUES
        ('breakfast', 1),
        ('lunch', 2),
        ('dinner', 3),
        ('snack', 4)
      ON CONFLICT (name) DO NOTHING
      `);
  } catch (error) {
    console.error(error);
  }
};
