import { pool } from "../config/database.js";

export const createMealFoodsTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS meal_foods(
        id SERIAL PRIMARY KEY,
        meal_id INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
        food_id INTEGER REFERENCES foods(id),
        my_food_id INTEGER REFERENCES my_foods(id),
        quantity_g NUMERIC(7,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CHECK (
          (food_id IS NOT NULL AND my_food_id IS NULL) OR
          (food_id IS NULL AND my_food_id IS NOT NULL)
        )
      )
      `);
  } catch (error) {
    console.error(error);
  }
};
