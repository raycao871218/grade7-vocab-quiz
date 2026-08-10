CREATE TABLE IF NOT EXISTS vocab_lists (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vocab_words (
  id BIGSERIAL PRIMARY KEY,
  english TEXT NOT NULL,
  normalized_english TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vocab_list_items (
  list_id BIGINT NOT NULL REFERENCES vocab_lists(id) ON DELETE CASCADE,
  word_id BIGINT NOT NULL REFERENCES vocab_words(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL,
  is_bonus BOOLEAN NOT NULL DEFAULT false,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, word_id),
  UNIQUE (list_id, display_order)
);

CREATE TABLE IF NOT EXISTS vocab_meanings (
  id BIGSERIAL PRIMARY KEY,
  word_id BIGINT NOT NULL REFERENCES vocab_words(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL DEFAULT 'zh-CN',
  meaning TEXT NOT NULL,
  sense_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (word_id, language_code, sense_order)
);

CREATE TABLE IF NOT EXISTS vocab_examples (
  id BIGSERIAL PRIMARY KEY,
  word_id BIGINT NOT NULL REFERENCES vocab_words(id) ON DELETE CASCADE,
  sentence TEXT NOT NULL,
  blanked_sentence TEXT NOT NULL,
  language_code TEXT NOT NULL DEFAULT 'en',
  difficulty TEXT NOT NULL DEFAULT 'hard',
  source TEXT NOT NULL DEFAULT 'seed',
  is_primary BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT vocab_examples_difficulty_check CHECK (difficulty IN ('easy', 'medium', 'hard'))
);

CREATE INDEX IF NOT EXISTS vocab_list_items_list_order_idx
  ON vocab_list_items (list_id, display_order);

CREATE INDEX IF NOT EXISTS vocab_meanings_word_idx
  ON vocab_meanings (word_id, language_code, sense_order);

CREATE INDEX IF NOT EXISTS vocab_examples_word_idx
  ON vocab_examples (word_id, difficulty, is_primary);

CREATE TABLE IF NOT EXISTS app_users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS answer_records (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL REFERENCES app_users(username) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  difficulty TEXT,
  question_count INTEGER,
  word_display_order INTEGER NOT NULL,
  english TEXT NOT NULL,
  chinese TEXT NOT NULL,
  prompt TEXT NOT NULL DEFAULT '',
  user_answer TEXT NOT NULL,
  correct BOOLEAN NOT NULL,
  answer_duration_ms INTEGER,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT answer_records_mode_check CHECK (mode IN ('choice', 'typing', 'spelling')),
  CONSTRAINT answer_records_difficulty_check CHECK (difficulty IS NULL OR difficulty IN ('easy', 'medium', 'hard'))
);

ALTER TABLE answer_records
  ADD COLUMN IF NOT EXISTS answer_duration_ms INTEGER;

CREATE INDEX IF NOT EXISTS answer_records_username_answered_idx
  ON answer_records (username, answered_at DESC);

CREATE INDEX IF NOT EXISTS answer_records_username_correct_idx
  ON answer_records (username, correct, answered_at DESC);

CREATE TABLE IF NOT EXISTS reading_passages (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reading_submissions (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL REFERENCES app_users(username) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  passage_slug TEXT NOT NULL REFERENCES reading_passages(slug) ON DELETE RESTRICT,
  translation_text TEXT NOT NULL,
  duration_ms INTEGER,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reading_submissions_username_submitted_idx
  ON reading_submissions (username, submitted_at DESC);

CREATE INDEX IF NOT EXISTS reading_submissions_username_task_idx
  ON reading_submissions (username, task_id, submitted_at DESC);

INSERT INTO reading_passages (slug, title, source, body, notes)
VALUES (
  'north-wind-sun-original',
  'The North Wind & the Sun',
  'Library of Congress Aesop Fables',
  $$The North Wind and the Sun had a quarrel about which of them was the stronger. While they were disputing with much heat and bluster, a Traveler passed along the road wrapped in a cloak.

"Let us agree," said the Sun, "that he is the stronger who can strip that Traveler of his cloak."

"Very well," growled the North Wind, and at once sent a cold, howling blast against the Traveler.

With the first gust of wind the ends of the cloak whipped about the Traveler's body. But he immediately wrapped it closely around him, and the harder the Wind blew, the tighter he held it to him. The North Wind tore angrily at the cloak, but all his efforts were in vain.

Then the Sun began to shine. At first his beams were gentle, and in the pleasant warmth after the bitter cold of the North Wind, the Traveler unfastened his cloak and let it hang loosely from his shoulders. The Sun's rays grew warmer and warmer. The man took off his cap and mopped his brow. At last he became so heated that he pulled off his cloak, and, to escape the blazing sunshine, threw himself down in the welcome shade of a tree by the roadside.

Gentleness and kind persuasion win where force and bluster fail.$$,
  'Original public-domain Aesop version for Day 2 reading and translation.'
)
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title,
      source = EXCLUDED.source,
      body = EXCLUDED.body,
      notes = EXCLUDED.notes,
      updated_at = now();
