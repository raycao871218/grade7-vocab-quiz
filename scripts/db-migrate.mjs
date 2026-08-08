import fs from "node:fs/promises";
import { createPool } from "./db.mjs";

const pool = createPool();

try {
  const schema = await fs.readFile(new URL("../db/schema.sql", import.meta.url), "utf-8");
  await pool.query(schema);
  console.log("Database schema is ready.");
} finally {
  await pool.end();
}
