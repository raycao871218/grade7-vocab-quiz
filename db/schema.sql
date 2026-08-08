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
