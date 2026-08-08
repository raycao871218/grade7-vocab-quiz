import fs from "node:fs";
import { Pool } from "pg";

function readEnvFile() {
  if (!fs.existsSync(".env")) return {};

  return Object.fromEntries(
    fs
      .readFileSync(".env", "utf-8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        if (separator < 0) return [line, ""];
        return [line.slice(0, separator), line.slice(separator + 1)];
      })
  );
}

export function getDatabaseConfig() {
  const fileEnv = readEnvFile();
  const env = { ...fileEnv, ...process.env };

  if (env.DATABASE_URL) {
    return {
      connectionString: env.DATABASE_URL
    };
  }

  return {
    host: env.DB_HOST,
    port: Number(env.DB_PORT ?? 5432),
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD
  };
}

export function createPool() {
  return new Pool(getDatabaseConfig());
}

export function normalizeEnglish(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function makeBlank(word) {
  return word
    .split(" ")
    .map((part) => "_".repeat(Math.max(part.length, 4)))
    .join(" ");
}

export function makeBlankedSentence(word, sentence) {
  return sentence.replace(new RegExp(escapeRegExp(word), "i"), makeBlank(word));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
