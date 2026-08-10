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
  '你提供的版本',
  $$The North Wind and the Sun were having a quarrel. Each said, "I am stronger than the other."

Just then, they saw a traveler walking along the road. He was wearing a warm cloak.

"Let us agree," said the Sun, "that he is the stronger who can make the traveler take off his cloak."

The North Wind went first. He blew with all his might, but the harder he blew, the tighter the traveler wrapped his cloak around him. At last, the North Wind gave up.

Then the Sun shone warmly. Soon the traveler felt hot and took off his cloak.

"You are right," said the North Wind. "Gentleness is stronger than force."$$,
  ''
)
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title,
      source = EXCLUDED.source,
      body = EXCLUDED.body,
      notes = EXCLUDED.notes,
      updated_at = now();

INSERT INTO reading_passages (slug, title, source, body, notes)
VALUES (
  'peppa-pig-muddy-puddles',
  'Muddy Puddles',
  'Peppa Pig episode script provided by user',
  $$Narrator: It is raining today. So Peppa and George cannot play outside.
Peppa: Daddy, it's stopped raining.
Peppa: Can we go out to play?
Daddy Pig: All right, run along you two.
Narrator: Peppa loves jumping in muddy puddles.
Peppa: I love muddy puddles.
Mummy Pig: Peppa! If you jump in muddy puddles, you must wear your boots.
Peppa: Sorry, Mummy.
Narrator: George likes to jump in muddy puddles, too.
Peppa: George. If you jump in muddy puddles, you must wear your boots.
Narrator: Peppa likes to look after her little brother, George.
Peppa: George, let's find some more jumping puddles.
Narrator: Peppa and George are having a lot of fun.
Narrator: Peppa has found a little puddle.
Narrator: George has found a big puddle.
Peppa: Look, George. There's a really big puddle.
Narrator: George wants to jump into the you big puddle first.
Peppa: Stop, George.
Peppa: I must check if it's safe for you.
Peppa: Good. It is safe for you.
Peppa: Sorry, George. It's only mud.
Narrator: Peppa and George love jumping in muddy puddles.
Peppa: Come on, George.
Peppa: Let's go and show Daddy.
Daddy Pig: Goodness me.
Peppa: Daddy. Daddy.
Peppa: Guess what we've been doing.
Daddy Pig: Let me think...
Daddy Pig: Have you been watching television?
Peppa: No. No. Daddy.
Daddy Pig: Have you just had a bath?
Peppa: No. No.
Daddy Pig: I know. You've been jumping in muddy puddles.
Peppa: Yes. Yes. Daddy. We've been in muddy puddles.
Daddy Pig: Ho. Ho. And look at the mess you're in.
Peppa: Ooh...
Daddy Pig: Oh, well, it's only mud.
Daddy Pig: Let's clean up quickly before Mummy sees the mess.
Peppa: Daddy, when we've cleaned up, will and Mummy come and play, too?
Daddy Pig: Yes, we can all play in the garden.
Narrator: Peppa and George are wearing their boots.
Narrator: Mummy and Daddy are wearing their boots.
Narrator: Peppa loves jumping up and it Mr. down in muddy puddles.
Narrator: Everyone loves jumping up and down in muddy puddles.
Mummy Pig: Oh, Daddy Pig, look at the mess you're in.
Peppa: It's only mud.$$,
  $$muddy 泥泞的
puddle 水坑
muddy puddle 泥坑
all right 好吧
run along 走开
look after 照顾
a lot of 许多
have a lot of fun 玩得超级开心
check 检查
Goodness me. 天哪
come on 快点
have a bath 洗澡
Look at... 看...
mess 乱七八糟
clean up 清理干净
up and down 上上下下$$
)
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title,
      source = EXCLUDED.source,
      body = EXCLUDED.body,
      notes = EXCLUDED.notes,
      updated_at = now();
