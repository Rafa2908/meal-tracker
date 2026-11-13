import "dotenv/config";
import { app } from "./app.js";
import { pool } from "./config/database.js";

const port = process.env.PORT ?? 5000;

// Crash at startup if the database is unreachable: a failed deploy with a
// clear log line beats an app that starts "healthy" and 500s every request.
// The schema itself is created by scripts/migrate.js, which runs first.
try {
  await pool.query("SELECT 1");
} catch (error) {
  console.error("Database unreachable at startup:", error.message);
  process.exit(1);
}

const server = app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

// Elastic Beanstalk sends SIGTERM on deploys. Finish in-flight requests,
// then close the pool so the RDS connections are released.
process.on("SIGTERM", () => {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
});
