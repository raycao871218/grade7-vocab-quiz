import fs from "node:fs/promises";
import path from "node:path";
import { createPool, normalizeEnglish } from "./db.mjs";

const DEFAULT_LIST_SLUG = "grade7-upper-renjiao";
const DEFAULT_LIST_TITLE = "人教版七年级上学期完整词汇";
const DEFAULT_DESCRIPTION = "七年级上学期 Vocabulary A-Z 完整词汇，按教材页码导入。";

function readEnvFile(raw) {
  return Object.fromEntries(
    raw
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

function cleanLine(line) {
  return line.trim().replace(/\s+/g, " ");
}

function isNoiseLine(line) {
  const text = cleanLine(line);
  return (
    !text ||
    /^[A-Z]$/.test(text) ||
    /^\d+$/.test(text) ||
    /^Vocabulary A-Z/.test(text) ||
    /^Vocabulary A–Z/.test(text) ||
    /^注：/.test(text)
  );
}

function sliceUpperTerm(raw) {
  const secondBookMarker = "\n\nA\na few ";
  const markerIndex = raw.indexOf(secondBookMarker);
  return markerIndex > 0 ? raw.slice(0, markerIndex) : raw;
}

function collectEntries(raw) {
  const entries = [];
  let buffer = [];

  for (const line of raw.split(/\r?\n/)) {
    if (isNoiseLine(line)) continue;
    buffer.push(cleanLine(line));
    if (/p\.\d+\s*$/.test(line)) {
      entries.push(buffer.join(" "));
      buffer = [];
    }
  }

  return entries;
}

function removeIpa(text) {
  return text.replace(/\s*\/[^/]*[ˈˌəɒɔɪʊɑæɛθðʃʒŋː;][^/]*\//g, " ");
}

function stripPartOfSpeech(text) {
  return text
    .replace(/\b(?:n|v|adj|adv|prep|pron|conj|interj|modal)\.\s*/gi, "")
    .replace(/\s*&\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findMeaningIndex(text) {
  const match = text.match(/[（(]?[\u3400-\u9fff]/);
  return match ? match.index : -1;
}

function parseEntry(entry) {
  const page = entry.match(/p\.(\d+)\s*$/)?.[1] ?? "";
  const withoutPage = entry.replace(/\s*p\.\d+\s*$/, "").trim();
  const meaningIndex = findMeaningIndex(withoutPage);
  if (meaningIndex < 0) return null;

  let englishPart = withoutPage.slice(0, meaningIndex).trim();
  let meaning = withoutPage.slice(meaningIndex).trim();

  englishPart = removeIpa(englishPart)
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const partOfSpeechIndex = englishPart.search(/\b(?:n|v|adj|adv|prep|pron|conj|interj|modal)\.?\b|&/i);
  const english = (partOfSpeechIndex >= 0 ? englishPart.slice(0, partOfSpeechIndex) : englishPart)
    .replace(/[.;,，；、]+$/, "")
    .trim();

  meaning = stripPartOfSpeech(meaning);

  if (!english || !meaning) return null;
  return {
    english,
    meaning,
    page,
    raw: entry
  };
}

function parseVocabulary(raw) {
  const upperTerm = sliceUpperTerm(raw);
  const rows = collectEntries(upperTerm).map(parseEntry).filter(Boolean);
  const uniqueRows = new Map();

  for (const row of rows) {
    const key = normalizeEnglish(row.english);
    if (!uniqueRows.has(key)) uniqueRows.set(key, row);
  }

  return [...uniqueRows.values()];
}

const envFile = await fs.readFile(".env", "utf-8").catch(() => "");
const env = { ...readEnvFile(envFile), ...process.env };
const sourcePath = env.GRADE7_TERM_SOURCE_PATH ?? process.argv[2];

if (!sourcePath) {
  throw new Error("Missing source path. Set GRADE7_TERM_SOURCE_PATH or pass a text file path.");
}

const listSlug = env.GRADE7_TERM_LIST_SLUG ?? DEFAULT_LIST_SLUG;
const listTitle = env.GRADE7_TERM_LIST_TITLE ?? DEFAULT_LIST_TITLE;
const description = env.GRADE7_TERM_DESCRIPTION ?? DEFAULT_DESCRIPTION;
const gradeLevel = Number(env.GRADE7_TERM_GRADE_LEVEL ?? 7);
const semester = env.GRADE7_TERM_SEMESTER ?? "上学期";
const sourceLabel = env.GRADE7_TERM_SOURCE_LABEL ?? "用户提供的七年级上学期词表";
const raw = await fs.readFile(path.resolve(sourcePath), "utf-8");
const words = parseVocabulary(raw);

if (words.length === 0) {
  throw new Error("No vocabulary entries found in source text.");
}

const pool = createPool();
const client = await pool.connect();

try {
  await client.query("BEGIN");
  const listResult = await client.query(
    `
      INSERT INTO vocab_lists (slug, title, description, grade_level, semester, source_label)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (slug) DO UPDATE
        SET title = EXCLUDED.title,
            description = EXCLUDED.description,
            grade_level = EXCLUDED.grade_level,
            semester = EXCLUDED.semester,
            source_label = EXCLUDED.source_label,
            updated_at = now()
      RETURNING id
    `,
    [listSlug, listTitle, description, gradeLevel, semester, sourceLabel]
  );
  const listId = listResult.rows[0].id;

  for (const [index, item] of words.entries()) {
    const normalizedEnglish = normalizeEnglish(item.english);
    const wordResult = await client.query(
      `
        INSERT INTO vocab_words (english, normalized_english)
        VALUES ($1, $2)
        ON CONFLICT (normalized_english) DO UPDATE
          SET english = EXCLUDED.english,
              updated_at = now()
        RETURNING id
      `,
      [item.english, normalizedEnglish]
    );
    const wordId = wordResult.rows[0].id;

    await client.query(
      `
        INSERT INTO vocab_list_items (list_id, word_id, display_order, is_bonus, notes)
        VALUES ($1, $2, $3, false, $4)
        ON CONFLICT (list_id, word_id) DO UPDATE
          SET display_order = EXCLUDED.display_order,
              is_bonus = false,
              notes = EXCLUDED.notes,
              updated_at = now()
      `,
      [listId, wordId, index + 1, `page:${item.page}; semester:${semester}`]
    );

    await client.query(
      `
        INSERT INTO vocab_meanings (word_id, language_code, meaning, sense_order)
        VALUES ($1, 'zh-CN', $2, 1)
        ON CONFLICT (word_id, language_code, sense_order) DO UPDATE
          SET meaning = EXCLUDED.meaning,
              updated_at = now()
      `,
      [wordId, item.meaning]
    );
  }

  await client.query("COMMIT");
  console.log(`Imported ${words.length} unique words into ${listSlug} (${gradeLevel}年级${semester}).`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
