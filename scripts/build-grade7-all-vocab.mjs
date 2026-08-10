import { createPool } from "./db.mjs";

const COMBINED_SLUG = "grade7-all-renjiao";
const SOURCE_SLUGS = ["grade7-upper-renjiao", "grade7-lower-renjiao"];

const pool = createPool();
const client = await pool.connect();

try {
  await client.query("BEGIN");

  const missing = await client.query(
    `
      SELECT source.slug
      FROM unnest($1::text[]) AS source(slug)
      LEFT JOIN vocab_lists l ON l.slug = source.slug
      WHERE l.id IS NULL
    `,
    [SOURCE_SLUGS]
  );

  if (missing.rows.length > 0) {
    throw new Error(`Missing source vocab list(s): ${missing.rows.map((row) => row.slug).join(", ")}`);
  }

  const listResult = await client.query(
    `
      INSERT INTO vocab_lists (slug, title, description, grade_level, semester, source_label)
      VALUES ($1, $2, $3, 7, $4, $5)
      ON CONFLICT (slug) DO UPDATE
        SET title = EXCLUDED.title,
            description = EXCLUDED.description,
            grade_level = EXCLUDED.grade_level,
            semester = EXCLUDED.semester,
            source_label = EXCLUDED.source_label,
            updated_at = now()
      RETURNING id
    `,
    [
      COMBINED_SLUG,
      "人教版七年级全年完整词汇",
      "七年级上学期和下学期 Vocabulary A-Z 合并词表。",
      "全年",
      "七年级上学期 + 下学期合并词表"
    ]
  );
  const combinedListId = listResult.rows[0].id;

  await client.query("DELETE FROM vocab_list_items WHERE list_id = $1", [combinedListId]);

  const insertResult = await client.query(
    `
      WITH source_items AS (
        SELECT
          w.id AS word_id,
          w.normalized_english,
          l.semester,
          l.slug AS source_slug,
          i.display_order AS source_order,
          i.notes AS source_notes,
          CASE l.slug
            WHEN 'grade7-upper-renjiao' THEN 1
            WHEN 'grade7-lower-renjiao' THEN 2
            ELSE 99
          END AS source_rank
        FROM vocab_lists l
        JOIN vocab_list_items i ON i.list_id = l.id
        JOIN vocab_words w ON w.id = i.word_id
        WHERE l.slug = ANY ($1::text[])
      ),
      deduped AS (
        SELECT DISTINCT ON (normalized_english)
          word_id,
          semester,
          source_slug,
          source_order,
          source_notes,
          source_rank
        FROM source_items
        ORDER BY normalized_english, source_rank, source_order
      ),
      ordered AS (
        SELECT
          word_id,
          row_number() OVER (ORDER BY source_rank, source_order, word_id) AS display_order,
          format('source:%s; %s', source_slug, source_notes) AS notes
        FROM deduped
      )
      INSERT INTO vocab_list_items (list_id, word_id, display_order, is_bonus, notes)
      SELECT $2, word_id, display_order, false, notes
      FROM ordered
      ORDER BY display_order
      RETURNING word_id
    `,
    [SOURCE_SLUGS, combinedListId]
  );

  await client.query("COMMIT");
  console.log(`Built ${COMBINED_SLUG} with ${insertResult.rowCount} words.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
