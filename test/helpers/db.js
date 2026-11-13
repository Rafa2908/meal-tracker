// The schema comes from the migrations (`npm test` runs them first via the
// pretest script), so tests run against the same tables production uses.
import { pool } from "../../config/database.js";

// Ids are predictable after RESTART IDENTITY: admin = 1, user = 2, other = 3.
export const USER_IDS = { admin: 1, user: 2, other: 3 };

export const resetDatabase = async () => {
  await pool.query(`
    TRUNCATE users, foods, my_foods, meals, meal_foods, goals
    RESTART IDENTITY CASCADE
  `);
};

export const seedUsers = () =>
  pool.query(`
    INSERT INTO users (cognito_id, first_name, last_name, email) VALUES
      ('admin-sub', 'Admin', 'Test', 'admin@test.com'),
      ('user-sub',  'User',  'Test', 'user@test.com'),
      ('other-sub', 'Other', 'Test', 'other@test.com')
  `);
