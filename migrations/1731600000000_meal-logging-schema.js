// Schema decisions to settle before the meal-logging endpoints exist:
//  - meal_foods stores a macro snapshot, so editing a food never rewrites history
//  - meals.logged_date comes from the client (no server-side "today")
//  - every created_at / updated_at is TIMESTAMPTZ
//  - daily_progress (stored running totals) becomes the computed view daily_totals
//  - indexes for the per-user queries the API will run

const TIMESTAMP_COLUMNS = [
  ["users", "created_at"],
  ["foods", "created_at"],
  ["my_foods", "created_at"],
  ["goals", "created_at"],
  ["goals", "updated_at"],
  ["meals", "created_at"],
  ["meal_foods", "created_at"],
];

const SNAPSHOT_COLUMNS = [
  ["calories", "calories_per_100g"],
  ["protein_g", "protein_per_100g"],
  ["carbs_g", "carbs_per_100g"],
  ["fat_g", "fat_per_100g"],
  ["fiber_g", "fiber_per_100g"],
];

export const up = (pgm) => {
  // 1. Macro snapshot on each logged food. Added nullable, backfilled from the
  //    current food rows (a no-op on an empty table), then made NOT NULL.
  for (const [column] of SNAPSHOT_COLUMNS) {
    pgm.sql(`ALTER TABLE meal_foods ADD COLUMN ${column} NUMERIC(8,2)`);
  }

  const backfill = (table, fk) =>
    pgm.sql(`
      UPDATE meal_foods mf SET
        ${SNAPSHOT_COLUMNS.map(([col, src]) => `${col} = f.${src} * mf.quantity_g / 100`).join(",\n        ")}
      FROM ${table} f
      WHERE mf.${fk} = f.id
    `);
  backfill("foods", "food_id");
  backfill("my_foods", "my_food_id");

  for (const [column] of SNAPSHOT_COLUMNS) {
    pgm.sql(`ALTER TABLE meal_foods ALTER COLUMN ${column} SET NOT NULL`);
  }

  // 2. The client sends the date it means; the RDS server's UTC date is wrong
  //    for anyone outside UTC.
  pgm.sql("ALTER TABLE meals ALTER COLUMN logged_date DROP DEFAULT");

  // 3. Timestamps with a zone. Existing values were written in the server's
  //    zone, which is UTC on RDS.
  for (const [table, column] of TIMESTAMP_COLUMNS) {
    pgm.sql(`
      ALTER TABLE ${table}
        ALTER COLUMN ${column} TYPE TIMESTAMPTZ USING ${column} AT TIME ZONE 'UTC',
        ALTER COLUMN ${column} SET DEFAULT now()
    `);
  }

  // 4. Totals computed from the snapshots instead of stored and kept in sync.
  //    Nothing writes daily_progress yet, so no data is lost.
  pgm.sql("DROP TABLE IF EXISTS daily_progress");
  pgm.sql(`
    CREATE VIEW daily_totals AS
    SELECT m.user_id,
           m.logged_date      AS date,
           SUM(mf.calories)   AS total_calories,
           SUM(mf.protein_g)  AS total_protein_g,
           SUM(mf.carbs_g)    AS total_carbs_g,
           SUM(mf.fat_g)      AS total_fat_g,
           SUM(mf.fiber_g)    AS total_fiber_g
    FROM meals m
    JOIN meal_foods mf ON mf.meal_id = m.id
    GROUP BY m.user_id, m.logged_date
  `);

  // 5. Postgres doesn't index foreign keys on its own.
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS meals_user_date_idx ON meals (user_id, logged_date);
    CREATE INDEX IF NOT EXISTS meal_foods_meal_idx ON meal_foods (meal_id);
    CREATE INDEX IF NOT EXISTS my_foods_user_idx   ON my_foods (user_id, id);
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS meals_user_date_idx;
    DROP INDEX IF EXISTS meal_foods_meal_idx;
    DROP INDEX IF EXISTS my_foods_user_idx;
    DROP VIEW IF EXISTS daily_totals;

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

    ALTER TABLE meals ALTER COLUMN logged_date SET DEFAULT CURRENT_DATE;
  `);

  for (const [table, column] of TIMESTAMP_COLUMNS) {
    pgm.sql(`
      ALTER TABLE ${table}
        ALTER COLUMN ${column} TYPE TIMESTAMP USING ${column} AT TIME ZONE 'UTC',
        ALTER COLUMN ${column} SET DEFAULT CURRENT_TIMESTAMP
    `);
  }

  for (const [column] of SNAPSHOT_COLUMNS) {
    pgm.sql(`ALTER TABLE meal_foods DROP COLUMN ${column}`);
  }
};
