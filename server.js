import dotenv from "dotenv";
import { app } from "./app.js";
import { testConnection } from "./config/database.js";
import { initializeDatabase } from "./modal/index.js";

dotenv.config();

const port = process.env.PORT;

await testConnection();

await initializeDatabase();

app.listen(port, () => {
  console.log(`App listening on: http://localhost:${port}`);
});
