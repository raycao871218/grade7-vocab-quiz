import fs from "node:fs/promises";
import path from "node:path";
import { createPool, makeBlankedSentence, normalizeEnglish } from "./db.mjs";

const LIST_SLUG = "grade7-renjiao-placement";
const LIST_TITLE = "新版人教版七年级英语摸底词汇";

const exampleSentences = {
  greet: "Teachers greet students at the school gate every morning.",
  conversation: "A good conversation helps new classmates become friends.",
  spell: "Can you spell your name for the teacher?",
  need: "You need a pencil for this English test.",
  thing: "Put every thing back in your schoolbag.",
  fun: "The English club is fun after school.",
  yard: "The children play in the yard after lunch.",
  count: "Please count the books on the desk.",
  "make friends": "It is easy to make friends when you are kind.",
  "get to know": "We get to know each other on the first school day.",
  "full name": "Write your full name at the top of the paper.",
  grade: "My sister is in Grade Seven this year.",
  classmate: "My classmate sits next to me in English class.",
  country: "China is a beautiful country with a long history.",
  same: "We are in the same class.",
  hobby: "Reading is my favourite hobby.",
  information: "The poster gives useful information about the club.",
  family: "My family eats dinner together every evening.",
  grandparent: "My grandparent tells me stories about the past.",
  different: "The twins have different hobbies.",
  mean: "What does this word mean in English?",
  together: "We study together in the library.",
  activity: "The school activity starts at three o'clock.",
  building: "The science lab is in the tall building.",
  "across from": "The library is across from the playground.",
  centre: "There is a garden in the centre of our school.",
  office: "The teachers' office is near the classroom.",
  important: "It is important to listen carefully in class.",
  notice: "Did you notice the new poster on the wall?",
  change: "The weather can change quickly in spring.",
  delicious: "The noodles in this restaurant are delicious.",
  similar: "These two schoolbags look similar.",
  subject: "English is my favourite subject.",
  geography: "We learn about rivers and mountains in geography.",
  history: "History helps us learn about old stories and people.",
  useful: "A dictionary is useful when you read English.",
  boring: "The long film is boring for me.",
  exciting: "The basketball game is exciting.",
  reason: "Tell me the reason why you like this club.",
  remember: "Please remember to bring your homework tomorrow.",
  club: "I want to join the music club.",
  join: "Many students join the sports team.",
  choose: "You can choose one book from the shelf.",
  ability: "She has the ability to sing well.",
  interested: "I am interested in nature and animals.",
  nature: "We should protect nature and keep it clean.",
  "make use of": "Good students make use of every minute.",
  routine: "My morning routine starts at six thirty.",
  "get up": "I get up early on school days.",
  homework: "He finishes his homework before dinner.",
  weekend: "We visit our grandparents at the weekend.",
  celebrate: "We celebrate my birthday with a small party.",
  surprise: "The birthday cake is a big surprise.",
  sale: "The shop has a sale on schoolbags today.",
  price: "The price of this dictionary is low.",
  meaningful: "Helping others is meaningful.",
  animal: "The panda is my favourite animal.",
  dangerous: "It is dangerous to cross the road too fast.",
  save: "We can save water by turning off the tap.",
  danger: "Some wild animals are in danger.",
  "in danger": "Many animals are in danger because forests are smaller.",
  forest: "Many birds live in the forest.",
  "cut down": "People should not cut down too many trees.",
  friendly: "Our new teacher is friendly to everyone.",
  rule: "Every student should follow the school rule.",
  follow: "Please follow the rules in the library.",
  arrive: "We arrive at school before eight.",
  "on time": "Good students hand in homework on time.",
  uniform: "We wear a school uniform from Monday to Friday.",
  polite: "It is polite to say thank you.",
  respect: "We should respect our parents and teachers.",
  "have to": "I have to finish my homework before playing.",
  advice: "My teacher gives me helpful advice.",
  understand: "I understand the story after reading it twice.",
  fit: "Running every day helps me keep fit.",
  "hardly ever": "He hardly ever eats junk food.",
  once: "I clean my room once a week.",
  twice: "She practises the piano twice a week.",
  practise: "We practise speaking English in pairs.",
  seldom: "My brother seldom watches TV on school nights.",
  progress: "You can make progress if you practise every day.",
  team: "Our team wins the football match.",
  lose: "Do not lose your key again.",
  teenager: "A teenager should learn to manage time.",
  habit: "Reading before bed is a good habit.",
  balanced: "A balanced diet keeps us healthy.",
  enough: "Drink enough water when the weather is hot.",
  "right now": "I am doing my homework right now.",
  moment: "Please wait a moment.",
  message: "I send a message to my friend.",
  happen: "What will happen in the next part of the story?",
  "time zone": "Beijing and London are in different time zones.",
  "take part in": "I want to take part in the school trip.",
  affect: "Bad weather can affect our plans.",
  temperature: "The temperature is high in summer.",
  experience: "The school trip is a wonderful experience.",
  through: "We walk through the park after school.",
  trip: "Our class has a trip to the museum.",
  "once upon a time": "Once upon a time, a little girl lived near a forest.",
  promise: "I promise to finish the work today.",
  culture: "Food is an important part of culture.",
  however: "It is raining; however, we still go to school.",
  "mobile phone": "You should not use a mobile phone in class.",
  "focus on": "Please focus on your homework.",
  encourage: "Parents encourage children to try new things.",
  customer: "The customer buys a cup of tea.",
  improve: "Reading every day can improve your English.",
  result: "Hard work brings a good result.",
  passenger: "Every passenger should wear a seat belt.",
  explain: "The teacher can explain the question clearly.",
  although: "Although it is cold, we play football outside.",
  "because of": "The game stops because of the heavy rain.",
  waste: "Do not waste food at lunch.",
  process: "Learning a language is a long process.",
  record: "Please record your answers in the notebook.",
  skill: "Writing is an important English skill.",
  realize: "I realize that practice is important.",
  pretend: "The children pretend to be teachers.",
  truth: "Always tell the truth.",
  wise: "It is wise to plan your day."
};

function parseRows(markdown, heading, nextHeading, bonus = false) {
  const start = markdown.indexOf(heading);
  if (start < 0) return [];
  const end = nextHeading ? markdown.indexOf(nextHeading, start + heading.length) : -1;
  const block = markdown.slice(start, end > start ? end : undefined);
  const rows = [];

  for (const line of block.split(/\r?\n/)) {
    const match = line.match(/^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/);
    if (!match) continue;
    rows.push({
      order: Number(match[1]),
      english: match[2].trim(),
      chinese: match[3].trim(),
      bonus
    });
  }

  return rows;
}

function parseMarkdownVocab(markdown) {
  const core = parseRows(markdown, "## 完整表", "## 加测", false);
  const bonus = parseRows(markdown, "## 加测", undefined, true);
  return [...core, ...bonus];
}

function readEnvFile() {
  return Object.fromEntries(
    (awaitableEnv ?? "")
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

const awaitableEnv = await fs.readFile(".env", "utf-8").catch(() => "");
const env = { ...readEnvFile(), ...process.env };
const sourcePath = env.VOCAB_SOURCE_PATH;

if (!sourcePath) {
  throw new Error("Missing VOCAB_SOURCE_PATH in .env or environment.");
}

const markdown = await fs.readFile(path.resolve(sourcePath), "utf-8");
const words = parseMarkdownVocab(markdown);

if (words.length === 0) {
  throw new Error("No vocabulary rows found in source markdown.");
}

const pool = createPool();
const client = await pool.connect();

try {
  await client.query("BEGIN");
  const listResult = await client.query(
    `
      INSERT INTO vocab_lists (slug, title, description)
      VALUES ($1, $2, $3)
      ON CONFLICT (slug) DO UPDATE
        SET title = EXCLUDED.title,
            description = EXCLUDED.description,
            updated_at = now()
      RETURNING id
    `,
    [LIST_SLUG, LIST_TITLE, "七年级核心 100 个词 + 加测 20 个词，来自本地摸底词表。"]
  );
  const listId = listResult.rows[0].id;

  for (const item of words) {
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
        INSERT INTO vocab_list_items (list_id, word_id, display_order, is_bonus)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (list_id, word_id) DO UPDATE
          SET display_order = EXCLUDED.display_order,
              is_bonus = EXCLUDED.is_bonus,
              updated_at = now()
      `,
      [listId, wordId, item.order, item.bonus]
    );

    await client.query(
      `
        INSERT INTO vocab_meanings (word_id, language_code, meaning, sense_order)
        VALUES ($1, 'zh-CN', $2, 1)
        ON CONFLICT (word_id, language_code, sense_order) DO UPDATE
          SET meaning = EXCLUDED.meaning,
              updated_at = now()
      `,
      [wordId, item.chinese]
    );

    const sentence = exampleSentences[normalizedEnglish];
    if (sentence) {
      await client.query(
        `
          DELETE FROM vocab_examples
          WHERE word_id = $1
            AND source = 'seed'
            AND difficulty = 'hard'
        `,
        [wordId]
      );
      await client.query(
        `
          INSERT INTO vocab_examples
            (word_id, sentence, blanked_sentence, language_code, difficulty, source, is_primary)
          VALUES ($1, $2, $3, 'en', 'hard', 'seed', true)
        `,
        [wordId, sentence, makeBlankedSentence(item.english, sentence)]
      );
    }
  }

  await client.query("COMMIT");
  console.log(`Seeded ${words.length} words into ${LIST_SLUG}.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
