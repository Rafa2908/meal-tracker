// Applies every pending migration in ./migrations, then exits.
// Uses TEST_DB_URL when NODE_ENV=test, otherwise DATABASE_URL (see config/database.js).
// Runs in the container before the server starts, and before Jest via `pretest`.
import { runner } from "node-pg-migrate";
import { dbConfig } from "../config/database.js";

const quiet = process.env.NODE_ENV === "test";

try {
  const applied = await runner({
    databaseUrl: dbConfig,
    dir: "migrations",
    direction: "up",
    migrationsTable: "pgmigrations",
    log: quiet ? () => {} : console.log,
  });

  if (!quiet || applied.length > 0) {
    console.log(`Migrations applied: ${applied.length}`);
  }
} catch (error) {
  console.error("Migration failed:", error.message);
  process.exit(1);
}
