// The schema as it existed before migrations were adopted (formerly modal/*.js).
// IF NOT EXISTS makes this a no-op on databases that already have these tables,
// such as the existing RDS instance, so it can be recorded as applied safely.
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS users(
      id SERIAL PRIMARY KEY,
      cognito_id VARCHAR(255) NOT NULL UNIQUE,
      first_name VARCHAR(50) NOT NULL,
      last_name VARCHAR(50) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS meal_types(
      id SERIAL PRIMARY KEY,
      name VARCHAR(20) NOT NULL UNIQUE,
      sort_order SMALLINT NOT NULL
    );

    INSERT INTO meal_types (name, sort_order) VALUES
      ('breakfast', 1),
      ('lunch', 2),
      ('dinner', 3),
      ('snack', 4)
    ON CONFLICT (name) DO NOTHING;

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
    );

    CREATE TABLE IF NOT EXISTS my_foods(
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      calories_per_100g NUMERIC(6,2) NOT NULL,
      protein_per_100g NUMERIC(6,2) NOT NULL,
      fat_per_100g NUMERIC(6,2) NOT NULL,
      carbs_per_100g NUMERIC(6,2) NOT NULL,
      fiber_per_100g NUMERIC(6,2) NOT NULL,
      image_url VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

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
    );

    CREATE TABLE IF NOT EXISTS meals(
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      meal_type_id INTEGER NOT NULL REFERENCES meal_types(id),
      logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

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
    );

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
    );
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS meal_foods, daily_progress, meals, goals,
                         my_foods, foods, meal_types, users;
  `);
};
