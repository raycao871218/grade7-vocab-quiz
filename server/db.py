from typing import Any

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from .config import get_database_kwargs


pool = ConnectionPool(kwargs=get_database_kwargs(), min_size=1, max_size=5, open=False)


def decode_db_text(value: str | bytes | memoryview | None) -> str:
    if value is None:
        return ""
    if isinstance(value, memoryview):
        value = value.tobytes()
    if isinstance(value, bytes):
        return value.decode("utf-8")
    return value


def parse_vocab_english(value: str | bytes | memoryview | None) -> tuple[str, str]:
    text = decode_db_text(value).strip()
    if " /" not in text:
        return text, ""

    word, raw_phonetic = text.rsplit(" /", 1)
    phonetic = raw_phonetic.strip()
    phonetic_body = phonetic[:-1].strip() if phonetic.endswith("/") else phonetic
    if not word.strip() or not phonetic_body or " " in phonetic_body or len(phonetic_body) > 40:
        return text, ""

    return word.strip(), f"/{phonetic_body}/"


def parse_vocab_origin(
    notes: str | bytes | memoryview | None,
    fallback_semester: str | bytes | memoryview | None = None,
) -> dict[str, str]:
    notes_text = decode_db_text(notes)
    fallback_semester_text = decode_db_text(fallback_semester)
    parts: dict[str, str] = {}
    for raw_part in notes_text.split(";"):
        key, separator, value = raw_part.strip().partition(":")
        if separator:
            parts[key.strip()] = value.strip()

    semester = parts.get("semester") or fallback_semester_text
    page = parts.get("page", "")
    source_slug = parts.get("source", "")
    semester_label = {"上学期": "七上", "下学期": "七下", "全年": "全年"}.get(semester, semester)
    origin_label = " · ".join(part for part in [semester_label, f"p.{page}" if page else ""] if part)

    return {
        "semester": semester,
        "page": page,
        "sourceListSlug": source_slug,
        "label": origin_label,
    }


def open_pool() -> None:
    pool.open(wait=True)


def close_pool() -> None:
    pool.close()


def fetch_vocab_words(list_slug: str) -> list[dict[str, Any]]:
    query = """
      SELECT
        i.display_order::int AS id,
        w.english,
        m.meaning AS chinese,
        i.is_bonus AS bonus,
        i.notes,
        l.semester,
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'sentence', e.sentence,
              'blankedSentence', e.blanked_sentence,
              'difficulty', e.difficulty,
              'isPrimary', e.is_primary
            )
            ORDER BY e.is_primary DESC, e.id
          ) FILTER (WHERE e.id IS NOT NULL),
          '[]'::jsonb
        ) AS examples
      FROM vocab_lists l
      JOIN vocab_list_items i ON i.list_id = l.id
      JOIN vocab_words w ON w.id = i.word_id
      LEFT JOIN vocab_meanings m
        ON m.word_id = w.id
       AND m.language_code = 'zh-CN'
       AND m.sense_order = 1
      LEFT JOIN vocab_examples e
        ON e.word_id = w.id
       AND e.difficulty = 'hard'
      WHERE l.slug = %s
      GROUP BY i.display_order, w.english, m.meaning, i.is_bonus, i.notes, l.semester
      ORDER BY i.display_order
    """

    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cursor:
            cursor.execute(query, (list_slug,))
            rows = cursor.fetchall()

    parsed_rows = []
    for row in rows:
        english, phonetic = parse_vocab_english(row["english"])
        parsed_rows.append({
            "id": row["id"],
            "english": english,
            "phonetic": phonetic,
            "chinese": row["chinese"] or "",
            "bonus": row["bonus"],
            "origin": parse_vocab_origin(row["notes"] or "", row["semester"]),
            "examples": row["examples"],
        })
    return parsed_rows


def normalize_username(username: str) -> str:
    return " ".join(username.strip().split())


def upsert_user(username: str) -> dict[str, Any]:
    normalized_username = normalize_username(username)
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                """
                INSERT INTO app_users (username)
                VALUES (%s)
                ON CONFLICT (username) DO UPDATE
                  SET last_seen_at = now()
                RETURNING username, created_at, last_seen_at
                """,
                (normalized_username,),
            )
            return dict(cursor.fetchone())


def insert_answer_record(record: dict[str, Any]) -> dict[str, Any]:
    username = normalize_username(record["username"])
    upsert_user(username)

    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                """
                INSERT INTO answer_records (
                  username,
                  session_id,
                  mode,
                  difficulty,
                  question_count,
                  word_display_order,
                  english,
                  chinese,
                  prompt,
                  user_answer,
                  correct,
                  answer_duration_ms
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING
                  id,
                  username,
                  session_id,
                  mode,
                  difficulty,
                  question_count,
                  word_display_order AS "wordId",
                  english,
                  chinese,
                  prompt,
                  user_answer AS "userAnswer",
                  correct,
                  answer_duration_ms AS "answerDurationMs",
                  answered_at AS "answeredAt"
                """,
                (
                    username,
                    record["session_id"],
                    record["mode"],
                    record.get("difficulty"),
                    record.get("question_count"),
                    record["word_display_order"],
                    record["english"],
                    record["chinese"],
                    record.get("prompt", ""),
                    record["user_answer"],
                    record["correct"],
                    record.get("answer_duration_ms"),
                ),
            )
            return dict(cursor.fetchone())


def fetch_answer_records(username: str, limit: int = 200) -> list[dict[str, Any]]:
    normalized_username = normalize_username(username)
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                """
                SELECT
                  id,
                  username,
                  session_id,
                  mode,
                  difficulty,
                  question_count,
                  word_display_order AS "wordId",
                  english,
                  chinese,
                  prompt,
                  user_answer AS "userAnswer",
                  correct,
                  answer_duration_ms AS "answerDurationMs",
                  answered_at AS "answeredAt"
                FROM answer_records
                WHERE username = %s
                ORDER BY answered_at DESC, id DESC
                LIMIT %s
                """,
                (normalized_username, limit),
            )
            return [dict(row) for row in cursor.fetchall()]


def fetch_reading_passage(slug: str) -> dict[str, Any] | None:
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                """
                SELECT slug, title, source, body, notes
                FROM reading_passages
                WHERE slug = %s
                """,
                (slug,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return {
                "slug": decode_db_text(row["slug"]),
                "title": decode_db_text(row["title"]),
                "source": decode_db_text(row["source"]),
                "body": decode_db_text(row["body"]),
                "notes": decode_db_text(row["notes"]),
            }


def fetch_reading_passage_summaries(collection: str | None = None) -> list[dict[str, Any]]:
    conditions = []
    params: list[Any] = []
    if collection == "peppa":
        conditions.append("(slug LIKE %s OR source ILIKE %s)")
        params.extend(["peppa-%", "%peppa%"])

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    query = f"""
      SELECT slug, title, source, notes, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM reading_passages
      {where_clause}
      ORDER BY created_at, id
    """

    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cursor:
            cursor.execute(query, params)
            rows = cursor.fetchall()

    return [
        {
            "slug": decode_db_text(row["slug"]),
            "title": decode_db_text(row["title"]),
            "source": decode_db_text(row["source"]),
            "notes": decode_db_text(row["notes"]),
            "createdAt": row["createdAt"],
            "updatedAt": row["updatedAt"],
        }
        for row in rows
    ]


def insert_reading_submission(submission: dict[str, Any]) -> dict[str, Any]:
    username = normalize_username(submission["username"])
    upsert_user(username)

    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                """
                INSERT INTO reading_submissions (
                  username,
                  task_id,
                  passage_slug,
                  translation_text,
                  duration_ms
                )
                VALUES (%s, %s, %s, %s, %s)
                RETURNING
                  id,
                  username,
                  task_id AS "taskId",
                  passage_slug AS "passageSlug",
                  translation_text AS "translationText",
                  duration_ms AS "durationMs",
                  submitted_at AS "submittedAt"
                """,
                (
                    username,
                    submission["task_id"],
                    submission["passage_slug"],
                    submission["translation_text"],
                    submission.get("duration_ms"),
                ),
            )
            return dict(cursor.fetchone())


def fetch_reading_submissions(username: str, limit: int = 100) -> list[dict[str, Any]]:
    normalized_username = normalize_username(username)
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                """
                SELECT
                  id,
                  username,
                  task_id AS "taskId",
                  passage_slug AS "passageSlug",
                  translation_text AS "translationText",
                  duration_ms AS "durationMs",
                  submitted_at AS "submittedAt"
                FROM reading_submissions
                WHERE username = %s
                ORDER BY submitted_at DESC, id DESC
                LIMIT %s
                """,
                (normalized_username, limit),
            )
            return [dict(row) for row in cursor.fetchall()]


def fetch_user_summary(username: str) -> dict[str, Any]:
    normalized_username = normalize_username(username)
    upsert_user(normalized_username)
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                """
                WITH per_day AS (
                  SELECT DISTINCT answered_at::date AS day
                  FROM answer_records
                  WHERE username = %s
                ),
                streak AS (
                  SELECT count(*)::int AS days
                  FROM per_day
                  WHERE day >= CURRENT_DATE - interval '30 days'
                )
                SELECT
                  count(r.id)::int AS "totalAnswers",
                  count(r.id) FILTER (WHERE r.correct)::int AS "correctAnswers",
                  coalesce((SELECT days FROM streak), 0)::int AS "checkInDays",
                  max(r.answered_at) AS "lastAnsweredAt"
                FROM answer_records r
                WHERE r.username = %s
                """,
                (normalized_username, normalized_username),
            )
            row = dict(cursor.fetchone())

    total = row["totalAnswers"] or 0
    correct = row["correctAnswers"] or 0
    return {
        **row,
        "accuracy": 0 if total == 0 else round(correct / total * 100),
        "nextDay": min((row["checkInDays"] or 0) + 1, 1),
    }
