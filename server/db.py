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
