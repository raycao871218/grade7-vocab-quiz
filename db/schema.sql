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
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT answer_records_mode_check CHECK (mode IN ('choice', 'typing', 'spelling')),
  CONSTRAINT answer_records_difficulty_check CHECK (difficulty IS NULL OR difficulty IN ('easy', 'medium', 'hard'))
);

CREATE INDEX IF NOT EXISTS answer_records_username_answered_idx
  ON answer_records (username, answered_at DESC);

CREATE INDEX IF NOT EXISTS answer_records_username_correct_idx
  ON answer_records (username, correct, answered_at DESC);
