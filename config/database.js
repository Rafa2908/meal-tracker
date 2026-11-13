import "dotenv/config";
import fs from "fs";
import path from "path";
import { Pool, types } from "pg";

// OID 1700 = NUMERIC; pg returns it as a string by default to avoid
// precision loss, but our macro columns are small enough to use as numbers.
types.setTypeParser(1700, (value) => parseFloat(value));

// OID 1082 = DATE; keep it as the "YYYY-MM-DD" string. The default turns it
// into a JS Date at local midnight, which shifts the day in other time zones.
types.setTypeParser(1082, (value) => value);

const isTest = process.env.NODE_ENV === "test";

// Verify the RDS server certificate against the AWS bundle instead of
// accepting any certificate. The Dockerfile downloads it to /app/certs;
// locally, download it to ./certs or point RDS_CA_PATH at your copy.
const ssl = isTest
  ? false
  : {
      ca: fs.readFileSync(
        process.env.RDS_CA_PATH ??
          path.resolve("certs", "rds-global-bundle.pem"),
        "utf8",
      ),
    };

// Shared by the app pool and scripts/migrate.js
export const dbConfig = {
  connectionString: isTest ? process.env.TEST_DB_URL : process.env.DATABASE_URL,
  ssl,
};

export const pool = new Pool(dbConfig);
