from typing import Any

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from .config import get_database_kwargs


pool = ConnectionPool(kwargs=get_database_kwargs(), min_size=1, max_size=5, open=False)


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
      GROUP BY i.display_order, w.english, m.meaning, i.is_bonus
      ORDER BY i.display_order
    """

    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cursor:
            cursor.execute(query, (list_slug,))
            rows = cursor.fetchall()

    return [
        {
            "id": row["id"],
            "english": row["english"],
            "chinese": row["chinese"] or "",
            "bonus": row["bonus"],
            "examples": row["examples"],
        }
        for row in rows
    ]


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
                  correct
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                  answered_at AS "answeredAt"
                FROM answer_records
                WHERE username = %s
                ORDER BY answered_at DESC, id DESC
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
