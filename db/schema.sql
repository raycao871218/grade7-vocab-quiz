CREATE TABLE IF NOT EXISTS vocab_lists (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  grade_level INTEGER,
  semester TEXT NOT NULL DEFAULT '',
  source_label TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE vocab_lists
  ADD COLUMN IF NOT EXISTS grade_level INTEGER;

ALTER TABLE vocab_lists
  ADD COLUMN IF NOT EXISTS semester TEXT NOT NULL DEFAULT '';

ALTER TABLE vocab_lists
  ADD COLUMN IF NOT EXISTS source_label TEXT NOT NULL DEFAULT '';

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

CREATE TABLE IF NOT EXISTS task_evaluations (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL REFERENCES app_users(username) ON DELETE CASCADE,
  task_date DATE NOT NULL,
  task_id TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  evaluation_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (username, task_date, task_id)
);

CREATE INDEX IF NOT EXISTS task_evaluations_username_date_idx
  ON task_evaluations (username, task_date DESC, task_id);

INSERT INTO vocab_lists (slug, title, description, grade_level, semester, source_label)
VALUES
  ('reading-peppa', '小猪佩奇阅读生词', '从小猪佩奇阅读任务中补充的生词。', 7, '小猪佩奇', '小猪佩奇'),
  ('reading-aesop', '伊索寓言阅读生词', '从 The North Wind and the Sun 阅读任务中补充的生词。', 7, '伊索寓言', '伊索寓言')
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title,
      description = EXCLUDED.description,
      grade_level = EXCLUDED.grade_level,
      semester = EXCLUDED.semester,
      source_label = EXCLUDED.source_label,
      updated_at = now();

WITH reading_vocab (source_slug, source_label, english, meaning, source_order) AS (
  VALUES
    ('reading-peppa', '小猪佩奇', 'muddy', '泥泞的', 1),
    ('reading-peppa', '小猪佩奇', 'puddle', '水坑', 2),
    ('reading-peppa', '小猪佩奇', 'muddy puddle', '泥坑', 3),
    ('reading-peppa', '小猪佩奇', 'all right', '好吧', 4),
    ('reading-peppa', '小猪佩奇', 'run along', '去吧；去玩吧', 5),
    ('reading-peppa', '小猪佩奇', 'look after', '照顾', 6),
    ('reading-peppa', '小猪佩奇', 'a lot of', '许多', 7),
    ('reading-peppa', '小猪佩奇', 'have a lot of fun', '玩得很开心', 8),
    ('reading-peppa', '小猪佩奇', 'check', '检查', 9),
    ('reading-peppa', '小猪佩奇', 'Goodness me', '我的天哪；真是的', 10),
    ('reading-peppa', '小猪佩奇', 'come on', '快点', 11),
    ('reading-peppa', '小猪佩奇', 'have a bath', '洗澡', 12),
    ('reading-peppa', '小猪佩奇', 'look at', '看', 13),
    ('reading-peppa', '小猪佩奇', 'mess', '乱七八糟；脏乱', 14),
    ('reading-peppa', '小猪佩奇', 'clean up', '清理干净', 15),
    ('reading-peppa', '小猪佩奇', 'up and down', '上上下下', 16),
    ('reading-aesop', '伊索寓言', 'quarrel', '争吵', 1),
    ('reading-aesop', '伊索寓言', 'traveler', '旅行者；行人', 2),
    ('reading-aesop', '伊索寓言', 'cloak', '斗篷；披风', 3),
    ('reading-aesop', '伊索寓言', 'agree', '同意；约定', 4),
    ('reading-aesop', '伊索寓言', 'take off', '脱下', 5),
    ('reading-aesop', '伊索寓言', 'blew', '吹（blow 的过去式）', 6),
    ('reading-aesop', '伊索寓言', 'with all his might', '用尽全力', 7),
    ('reading-aesop', '伊索寓言', 'tighter', '更紧地', 8),
    ('reading-aesop', '伊索寓言', 'wrapped', '裹住；包住（wrap 的过去式）', 9),
    ('reading-aesop', '伊索寓言', 'gave up', '放弃（give up 的过去式）', 10),
    ('reading-aesop', '伊索寓言', 'shone', '照耀（shine 的过去式）', 11),
    ('reading-aesop', '伊索寓言', 'gentleness', '温和；温柔', 12),
    ('reading-aesop', '伊索寓言', 'force', '力量；武力', 13)
)
INSERT INTO vocab_words (english, normalized_english)
SELECT english, lower(english)
FROM reading_vocab
ON CONFLICT (normalized_english) DO UPDATE
  SET english = EXCLUDED.english,
      updated_at = now();

WITH reading_vocab (source_slug, source_label, english, meaning, source_order) AS (
  VALUES
    ('reading-peppa', '小猪佩奇', 'muddy', '泥泞的', 1),
    ('reading-peppa', '小猪佩奇', 'puddle', '水坑', 2),
    ('reading-peppa', '小猪佩奇', 'muddy puddle', '泥坑', 3),
    ('reading-peppa', '小猪佩奇', 'all right', '好吧', 4),
    ('reading-peppa', '小猪佩奇', 'run along', '去吧；去玩吧', 5),
    ('reading-peppa', '小猪佩奇', 'look after', '照顾', 6),
    ('reading-peppa', '小猪佩奇', 'a lot of', '许多', 7),
    ('reading-peppa', '小猪佩奇', 'have a lot of fun', '玩得很开心', 8),
    ('reading-peppa', '小猪佩奇', 'check', '检查', 9),
    ('reading-peppa', '小猪佩奇', 'Goodness me', '我的天哪；真是的', 10),
    ('reading-peppa', '小猪佩奇', 'come on', '快点', 11),
    ('reading-peppa', '小猪佩奇', 'have a bath', '洗澡', 12),
    ('reading-peppa', '小猪佩奇', 'look at', '看', 13),
    ('reading-peppa', '小猪佩奇', 'mess', '乱七八糟；脏乱', 14),
    ('reading-peppa', '小猪佩奇', 'clean up', '清理干净', 15),
    ('reading-peppa', '小猪佩奇', 'up and down', '上上下下', 16),
    ('reading-aesop', '伊索寓言', 'quarrel', '争吵', 1),
    ('reading-aesop', '伊索寓言', 'traveler', '旅行者；行人', 2),
    ('reading-aesop', '伊索寓言', 'cloak', '斗篷；披风', 3),
    ('reading-aesop', '伊索寓言', 'agree', '同意；约定', 4),
    ('reading-aesop', '伊索寓言', 'take off', '脱下', 5),
    ('reading-aesop', '伊索寓言', 'blew', '吹（blow 的过去式）', 6),
    ('reading-aesop', '伊索寓言', 'with all his might', '用尽全力', 7),
    ('reading-aesop', '伊索寓言', 'tighter', '更紧地', 8),
    ('reading-aesop', '伊索寓言', 'wrapped', '裹住；包住（wrap 的过去式）', 9),
    ('reading-aesop', '伊索寓言', 'gave up', '放弃（give up 的过去式）', 10),
    ('reading-aesop', '伊索寓言', 'shone', '照耀（shine 的过去式）', 11),
    ('reading-aesop', '伊索寓言', 'gentleness', '温和；温柔', 12),
    ('reading-aesop', '伊索寓言', 'force', '力量；武力', 13)
)
INSERT INTO vocab_meanings (word_id, language_code, meaning, sense_order)
SELECT w.id, 'zh-CN', reading_vocab.meaning, 1
FROM reading_vocab
JOIN vocab_words w ON w.normalized_english = lower(reading_vocab.english)
ON CONFLICT (word_id, language_code, sense_order) DO UPDATE
  SET meaning = EXCLUDED.meaning,
      updated_at = now();

WITH reading_vocab (source_slug, source_label, english, meaning, source_order) AS (
  VALUES
    ('reading-peppa', '小猪佩奇', 'muddy', '泥泞的', 1),
    ('reading-peppa', '小猪佩奇', 'puddle', '水坑', 2),
    ('reading-peppa', '小猪佩奇', 'muddy puddle', '泥坑', 3),
    ('reading-peppa', '小猪佩奇', 'all right', '好吧', 4),
    ('reading-peppa', '小猪佩奇', 'run along', '去吧；去玩吧', 5),
    ('reading-peppa', '小猪佩奇', 'look after', '照顾', 6),
    ('reading-peppa', '小猪佩奇', 'a lot of', '许多', 7),
    ('reading-peppa', '小猪佩奇', 'have a lot of fun', '玩得很开心', 8),
    ('reading-peppa', '小猪佩奇', 'check', '检查', 9),
    ('reading-peppa', '小猪佩奇', 'Goodness me', '我的天哪；真是的', 10),
    ('reading-peppa', '小猪佩奇', 'come on', '快点', 11),
    ('reading-peppa', '小猪佩奇', 'have a bath', '洗澡', 12),
    ('reading-peppa', '小猪佩奇', 'look at', '看', 13),
    ('reading-peppa', '小猪佩奇', 'mess', '乱七八糟；脏乱', 14),
    ('reading-peppa', '小猪佩奇', 'clean up', '清理干净', 15),
    ('reading-peppa', '小猪佩奇', 'up and down', '上上下下', 16),
    ('reading-aesop', '伊索寓言', 'quarrel', '争吵', 1),
    ('reading-aesop', '伊索寓言', 'traveler', '旅行者；行人', 2),
    ('reading-aesop', '伊索寓言', 'cloak', '斗篷；披风', 3),
    ('reading-aesop', '伊索寓言', 'agree', '同意；约定', 4),
    ('reading-aesop', '伊索寓言', 'take off', '脱下', 5),
    ('reading-aesop', '伊索寓言', 'blew', '吹（blow 的过去式）', 6),
    ('reading-aesop', '伊索寓言', 'with all his might', '用尽全力', 7),
    ('reading-aesop', '伊索寓言', 'tighter', '更紧地', 8),
    ('reading-aesop', '伊索寓言', 'wrapped', '裹住；包住（wrap 的过去式）', 9),
    ('reading-aesop', '伊索寓言', 'gave up', '放弃（give up 的过去式）', 10),
    ('reading-aesop', '伊索寓言', 'shone', '照耀（shine 的过去式）', 11),
    ('reading-aesop', '伊索寓言', 'gentleness', '温和；温柔', 12),
    ('reading-aesop', '伊索寓言', 'force', '力量；武力', 13)
)
INSERT INTO vocab_list_items (list_id, word_id, display_order, is_bonus, notes)
SELECT l.id, w.id, reading_vocab.source_order, false, format('semester:%s;source:%s', reading_vocab.source_label, reading_vocab.source_slug)
FROM reading_vocab
JOIN vocab_lists l ON l.slug = reading_vocab.source_slug
JOIN vocab_words w ON w.normalized_english = lower(reading_vocab.english)
ON CONFLICT (list_id, word_id) DO UPDATE
  SET notes = EXCLUDED.notes,
      updated_at = now();

WITH reading_vocab (source_slug, source_label, english, meaning, source_order) AS (
  VALUES
    ('reading-peppa', '小猪佩奇', 'muddy', '泥泞的', 1),
    ('reading-peppa', '小猪佩奇', 'puddle', '水坑', 2),
    ('reading-peppa', '小猪佩奇', 'muddy puddle', '泥坑', 3),
    ('reading-peppa', '小猪佩奇', 'all right', '好吧', 4),
    ('reading-peppa', '小猪佩奇', 'run along', '去吧；去玩吧', 5),
    ('reading-peppa', '小猪佩奇', 'look after', '照顾', 6),
    ('reading-peppa', '小猪佩奇', 'a lot of', '许多', 7),
    ('reading-peppa', '小猪佩奇', 'have a lot of fun', '玩得很开心', 8),
    ('reading-peppa', '小猪佩奇', 'check', '检查', 9),
    ('reading-peppa', '小猪佩奇', 'Goodness me', '我的天哪；真是的', 10),
    ('reading-peppa', '小猪佩奇', 'come on', '快点', 11),
    ('reading-peppa', '小猪佩奇', 'have a bath', '洗澡', 12),
    ('reading-peppa', '小猪佩奇', 'look at', '看', 13),
    ('reading-peppa', '小猪佩奇', 'mess', '乱七八糟；脏乱', 14),
    ('reading-peppa', '小猪佩奇', 'clean up', '清理干净', 15),
    ('reading-peppa', '小猪佩奇', 'up and down', '上上下下', 16),
    ('reading-aesop', '伊索寓言', 'quarrel', '争吵', 1),
    ('reading-aesop', '伊索寓言', 'traveler', '旅行者；行人', 2),
    ('reading-aesop', '伊索寓言', 'cloak', '斗篷；披风', 3),
    ('reading-aesop', '伊索寓言', 'agree', '同意；约定', 4),
    ('reading-aesop', '伊索寓言', 'take off', '脱下', 5),
    ('reading-aesop', '伊索寓言', 'blew', '吹（blow 的过去式）', 6),
    ('reading-aesop', '伊索寓言', 'with all his might', '用尽全力', 7),
    ('reading-aesop', '伊索寓言', 'tighter', '更紧地', 8),
    ('reading-aesop', '伊索寓言', 'wrapped', '裹住；包住（wrap 的过去式）', 9),
    ('reading-aesop', '伊索寓言', 'gave up', '放弃（give up 的过去式）', 10),
    ('reading-aesop', '伊索寓言', 'shone', '照耀（shine 的过去式）', 11),
    ('reading-aesop', '伊索寓言', 'gentleness', '温和；温柔', 12),
    ('reading-aesop', '伊索寓言', 'force', '力量；武力', 13)
),
missing_items AS (
  SELECT
    all_list.id AS list_id,
    w.id AS word_id,
    reading_vocab.source_slug,
    reading_vocab.source_label,
    row_number() OVER (ORDER BY reading_vocab.source_slug, reading_vocab.source_order, w.id) AS row_number
  FROM reading_vocab
  JOIN vocab_lists all_list ON all_list.slug = 'grade7-all-renjiao'
  JOIN vocab_words w ON w.normalized_english = lower(reading_vocab.english)
  WHERE NOT EXISTS (
    SELECT 1
    FROM vocab_list_items existing
    WHERE existing.list_id = all_list.id
      AND existing.word_id = w.id
  )
),
max_order AS (
  SELECT COALESCE(max(i.display_order), 0) AS value
  FROM vocab_list_items i
  JOIN vocab_lists l ON l.id = i.list_id
  WHERE l.slug = 'grade7-all-renjiao'
)
INSERT INTO vocab_list_items (list_id, word_id, display_order, is_bonus, notes)
SELECT
  missing_items.list_id,
  missing_items.word_id,
  max_order.value + missing_items.row_number,
  false,
  format('semester:%s;source:%s', missing_items.source_label, missing_items.source_slug)
FROM missing_items
CROSS JOIN max_order;

WITH missing_items AS (
  SELECT
    target_list.id AS list_id,
    source_item.word_id,
    row_number() OVER (PARTITION BY target_list.id ORDER BY source_list.slug, source_item.display_order, source_item.word_id) AS row_number
  FROM vocab_lists target_list
  JOIN vocab_lists source_list ON source_list.slug IN ('reading-peppa', 'reading-aesop')
  JOIN vocab_list_items source_item ON source_item.list_id = source_list.id
  WHERE target_list.slug = 'grade7-renjiao-placement'
    AND NOT EXISTS (
      SELECT 1
      FROM vocab_list_items existing
      WHERE existing.list_id = target_list.id
        AND existing.word_id = source_item.word_id
    )
),
max_order AS (
  SELECT target_list.id AS list_id, COALESCE(max(target_item.display_order), 0) AS value
  FROM vocab_lists target_list
  LEFT JOIN vocab_list_items target_item ON target_item.list_id = target_list.id
  WHERE target_list.slug = 'grade7-renjiao-placement'
  GROUP BY target_list.id
)
INSERT INTO vocab_list_items (list_id, word_id, display_order, is_bonus, notes)
SELECT
  missing_items.list_id,
  missing_items.word_id,
  max_order.value + missing_items.row_number,
  false,
  format('semester:%s;source:%s', source_list.semester, source_list.slug)
FROM missing_items
JOIN max_order ON max_order.list_id = missing_items.list_id
JOIN vocab_lists source_list ON source_list.slug IN ('reading-peppa', 'reading-aesop')
JOIN vocab_list_items source_item ON source_item.list_id = source_list.id
  AND source_item.word_id = missing_items.word_id;

UPDATE vocab_list_items all_item
SET notes = format('semester:%s;source:%s', source_list.semester, source_list.slug),
    updated_at = now()
FROM vocab_lists all_list
JOIN vocab_lists source_list ON source_list.slug IN ('reading-peppa', 'reading-aesop')
JOIN vocab_list_items source_item ON source_item.list_id = source_list.id
WHERE all_list.slug IN ('grade7-all-renjiao', 'grade7-renjiao-placement')
  AND all_item.list_id = all_list.id
  AND all_item.word_id = source_item.word_id;

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
  $$quarrel 争吵
traveler 旅行者；行人
cloak 斗篷；披风
agree 同意；约定
take off 脱下
blew blow 的过去式，吹
with all his might 用尽全力
tighter 更紧地
wrapped wrap 的过去式，裹住；包住
gave up give up 的过去式，放弃
shone shine 的过去式，照耀
gentleness 温和；温柔
force 力量；武力$$
)
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title,
      source = EXCLUDED.source,
      body = EXCLUDED.body,
      notes = EXCLUDED.notes,
      updated_at = now();

INSERT INTO reading_passages (slug, title, source, body, notes)
VALUES (
  'peppa-pig-mr-dinosaur-is-lost',
  'Mr. Dinosaur is Lost',
  'Peppa Pig episode 2 original script provided by user',
  $$Narrator: George’s favourite toy is Mr. Dinosaur.
George: Dinosaur!
Narrator: George loves Mr. Dinosaur.
George: Grrr!

Narrator: Sometimes, George likes to scare Peppa with Mr. Dinosaur.
George: Grrr!
Peppa: Eek! Too scary.

Narrator: At suppertime, Mr. Dinosaur sits next to George.
Mummy Pig: I beg your pardon.
Mummy Pig: Was that you George, or was it Mr. Dinosaur?
George: Dinosaur!

Narrator: At bath time, George shares his bath with Mr. Dinosaur.
George: Grrr!

Mummy Pig: Good night, Peppa.
Peppa: Good night, Mummy.
Mummy Pig: Good night, George.
Mummy Pig: And good night, Mr. Dinosaur.
George: Grrr!
Narrator: When George goes to bed, Mr. Dinosaur is tucked up with him.

Narrator: George’s favourite game is throwing Mr. Dinosaur up in the air...
George: Whee!
Narrator: ...and catching him when he falls back down.
George: Whee!

Narrator: Peppa and Daddy Pig are playing draughts.
Peppa: I win, Daddy.
Daddy Pig: Oh. Well done, Peppa.
George: Whaaaaaaaa!
Daddy Pig: George?
George: Whaaaaaaaa!
Mummy Pig: George, what’s the matter?
George: Dinosaur.
Daddy Pig: George, have you lost Mr. Dinosaur?
Narrator: George has lost Mr. Dinosaur.
Mummy Pig: Don’t worry, George. We’ll find Mr. Dinosaur.
Daddy Pig: It’s a job for a detective.
Peppa: Daddy, what is a detective?
Daddy Pig: A detective is a very important person who is good at finding things.
Peppa: Me! Me! I’m good at finding things.
Daddy Pig: All right. Peppa is the detective.
Peppa: George. I am the detective. I will help you find Mr. Dinosaur.
Mummy Pig: Maybe the detective should ask George some simple questions.
Peppa: George, where’s Mr. Dinosaur?
George: Whaaaaaaaa!
Narrator: George does not know where Mr. Dinosaur is.
Daddy Pig: The detective could try and guess where Mr. Dinosaur might be.
Peppa: I know. I know where he is.

Peppa: George always has Mr. Dinosaur with him in the bath.
Peppa: So Mr. Dinosaur is in the bath.
Narrator: Mr. Dinosaur is not in the bath.
Peppa: Oh. I know. I know where Mr. Dinosaur is.

Peppa: George always has Mr. Dinosaur in his bed at night.
Peppa: So that’s where he is.
Narrator: Mr. Dinosaur is not in George’s bed.
Peppa: Oh.
Mummy Pig: Maybe we should try the garden.
Peppa: Yes, the garden. I was going to say that.

Peppa: Where is Mr. Dinosaur?
Narrator: Mr. Dinosaur is very hard to find.
Peppa: Oh. Mr. Dinosaur isn’t anywhere.
Daddy Pig: George? You do love to throw Mr. Dinosaur in the air.
Daddy Pig: I wonder if this time you threw Mr. Dinosaur just a bit too high.
Peppa: There he is. There he is. I saw him first.
Daddy Pig: Well done, Peppa.
Daddy Pig: You really are a very good detective.
George: Dinosaur. Grrr!
Narrator: George is so happy to have Mr. Dinosaur back again.
George: Whee!
Daddy Pig: Maybe it isn’t a good idea to play with dinosaurs near trees.
George: Dinosaur!$$,
  $$eek 呀（表示害怕）
next to 挨着
tuck up 卷起
share 分享
play draughts 下跳棋
well done 干得好
What’s the matter? 怎么了？
Don’t worry. 别担心
detective 侦探
be good at doing sth. 擅长做某事
simple 简单的
wonder 想知道，感到疑惑$$
)
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title,
      source = EXCLUDED.source,
      body = EXCLUDED.body,
      notes = EXCLUDED.notes,
      updated_at = now();

INSERT INTO reading_passages (slug, title, source, body, notes)
VALUES (
  'peppa-pig-best-friend',
  'Best Friend',
  'Peppa Pig episode 3 script pending from user',
  $$Best Friend script text is pending. The original script will be added after it is provided.$$,
  $$best friend 最好的朋友
friend 朋友
play 玩
together 一起
share 分享$$
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
Narrator: George wants to jump into the big puddle first.
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
Peppa: Yes. Yes. Daddy. We've been jumping in muddy puddles.
Daddy Pig: Ho. Ho. And look at the mess you're in.
Peppa: Ooh...
Daddy Pig: Oh, well, it's only mud.
Daddy Pig: Let's clean up quickly before Mummy sees the mess.
Peppa: Daddy, when we've cleaned up, will you and Mummy come and play, too?
Daddy Pig: Yes, we can all play in the garden.
Narrator: Peppa and George are wearing their boots.
Narrator: Mummy and Daddy are wearing their boots.
Narrator: Peppa loves jumping up and down in muddy puddles.
Narrator: Everyone loves jumping up and down in muddy puddles.
Mummy Pig: Oh, Daddy Pig, look at the mess you're in.
Peppa: It's only mud.$$,
  $$muddy 泥泞的
puddle 水坑
muddy puddle 泥坑
all right 好吧
run along 去吧 / 去玩吧
look after 照顾
a lot of 许多
have a lot of fun 玩得超级开心
check 检查
Goodness me. 我的天哪 / 真是的
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
