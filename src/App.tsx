import {
  ArrowLeft,
  BookOpen,
  Check,
  Eye,
  History,
  Keyboard,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Play,
  RotateCcw,
  Shuffle,
  Trophy,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type {
  AnswerRecord,
  AppSection,
  QuizMode,
  ReadingPassage,
  ReadingPassageSummary,
  ReadingSubmission,
  SavedAnswerRecord,
  SpellingDifficulty,
  VocabItem
} from "./types";

type VocabResponse = {
  sourcePath: string;
  words: VocabItem[];
  error?: string;
};

type ReviewResponse = {
  records: SavedAnswerRecord[];
};

type ReadingPassageResponse = {
  passage: ReadingPassage;
};

type ReadingPassagesResponse = {
  passages: ReadingPassageSummary[];
};

type ReadingSubmissionsResponse = {
  submissions: ReadingSubmission[];
};

type PersistedQuizState = {
  section: AppSection;
  mode: QuizMode;
  spellingDifficulty: SpellingDifficulty;
  questionCount: number;
  queueIds: number[];
  index: number;
  sessionId: string;
  taskId?: string;
  dayId?: string;
  records: Array<{ id: number; english: string; chinese: string; userAnswer: string; correct: boolean }>;
};

const USERNAME_KEY = "grade7-vocab-username";
const SECTION_KEY = "grade7-vocab-section";
const QUIZ_STATE_KEY = "grade7-vocab-quiz-state";
const ACTIVE_DAY_KEY = "grade7-vocab-active-day";

const sectionLabels: Record<AppSection, string> = {
  overview: "任务",
  taskDetail: "任务详情",
  peppa: "小猪佩奇",
  wordbook: "单词本",
  spelling: "拼写自测",
  reading: "阅读任务",
  review: "Review"
};

const modeLabels: Record<QuizMode, string> = {
  choice: "英译中",
  typing: "中译英",
  spelling: "拼写自测"
};

const difficultyLabels: Record<SpellingDifficulty, string> = {
  easy: "简单",
  medium: "中等",
  hard: "困难"
};

const navSections: AppSection[] = ["overview", "peppa", "wordbook", "review"];
const validSections: AppSection[] = ["overview", "taskDetail", "peppa", "wordbook", "spelling", "reading", "review"];
const READING_STATE_KEY = "grade7-vocab-reading-state";
const ACTIVE_READING_TASK_KEY = "grade7-vocab-active-reading-task";
const DAY2_CHOICE_COUNT = 30;
const DAY2_REVIEW_WORD_COUNT = 21;
const DAY2_NEW_WORD_COUNT = 9;
const DAY3_CHOICE_COUNT = 30;
const DAY3_REVIEW_WORD_COUNT = 21;
const DAY3_NEW_WORD_COUNT = 9;
type TaskItemType = "quiz" | "script-reading" | "translation";

type DailyTaskItem = {
  id: string;
  type: TaskItemType;
  label: string;
  title: string;
  description: string;
  passageSlug?: string;
  responseMode?: "complete" | "translation";
  mode?: QuizMode;
  difficulty?: SpellingDifficulty;
  count?: number;
  sessionPrefix?: string;
  source?: "allWords" | "yesterdayAnswers" | "day2ChoiceAnswers";
};

type DailyTask = {
  id: string;
  label: string;
  title: string;
  description: string;
  unlockAt?: string;
  items: DailyTaskItem[];
};

const dailyTasks: DailyTask[] = [
  {
    id: "day1",
    label: "Day 1",
    title: "中等难度拼写自测",
    description: "100 个高频词，中等难度。做完后可以在 Review 里看本轮记录。",
    items: [
      {
        id: "day1-spelling",
        type: "quiz",
        label: "第一项",
        title: "拼写自测 100 个",
        description: "看中文，拼写英文。",
        mode: "spelling",
        difficulty: "medium",
        count: 100,
        sessionPrefix: "day1-",
        source: "allWords"
      }
    ]
  },
  {
    id: "day2",
    label: "Day 2",
    title: "阅读 + 翻译 + 昨日词复习",
    description: "先熟读剧本，再翻译短文，最后用昨天做过的词完成英译中选择题。",
    items: [
      {
        id: "day2-muddy-read",
        type: "script-reading",
        label: "第一项",
        title: "熟读 Muddy Puddles",
        description: "把小猪佩奇第一集剧本读顺，重点看句子里的常用表达。",
        passageSlug: "peppa-pig-muddy-puddles",
        responseMode: "complete"
      },
      {
        id: "day2-north-translate",
        type: "translation",
        label: "第二项",
        title: "翻译 The North Wind and the Sun",
        description: "通读原版文章，并用自己的话翻译成中文。",
        passageSlug: "north-wind-sun-original",
        responseMode: "translation"
      },
      {
        id: "day2-yesterday-choice",
        type: "quiz",
        label: "第三项",
        title: "英译中选择题 30 个",
        description: "21 个昨天词加 9 个新词，复习刚见过的词，也顺手扩一点新词。",
        mode: "choice",
        difficulty: "medium",
        count: DAY2_CHOICE_COUNT,
        sessionPrefix: "day2-yesterday-choice-",
        source: "yesterdayAnswers"
      }
    ]
  },
  {
    id: "day3",
    label: "Day 3",
    title: "熟读 + Day2 单词复习",
    description: "继续熟读 Muddy Puddles 和 The North Wind and the Sun，再复习 Day2 的选择题词。",
    unlockAt: "2026-08-11T06:00:00+08:00",
    items: [
      {
        id: "day3-muddy-read",
        type: "script-reading",
        label: "第一项",
        title: "继续熟读 Muddy Puddles",
        description: "把第一集剧本继续读顺，重点留意熟悉句子的表达。",
        passageSlug: "peppa-pig-muddy-puddles",
        responseMode: "complete"
      },
      {
        id: "day3-north-read",
        type: "script-reading",
        label: "第二项",
        title: "熟读 The North Wind and the Sun",
        description: "不需要翻译，目标是把文章读熟。",
        passageSlug: "north-wind-sun-original",
        responseMode: "complete"
      },
      {
        id: "day3-day2-choice",
        type: "quiz",
        label: "第三项",
        title: "英译中选择题 30 个",
        description: "21 个来自 Day2 选择题，9 个额外新词。",
        mode: "choice",
        difficulty: "medium",
        count: DAY3_CHOICE_COUNT,
        sessionPrefix: "day3-day2-choice-",
        source: "day2ChoiceAnswers"
      }
    ]
  }
] as const satisfies DailyTask[];

type ReadingTask = DailyTaskItem & { passageSlug: string; responseMode: "complete" | "translation" };
const readingTasks = dailyTasks.flatMap((task) =>
  task.items.filter((item): item is ReadingTask => Boolean(item.passageSlug && item.responseMode))
);
const PEPPA_TASK_PREFIX = "peppa-episode-";

function shuffleArray<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function getWordKey(item: VocabItem): string {
  return normalizeAnswer(item.english);
}

function uniqueWords(items: VocabItem[]): VocabItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getWordKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function createSessionId(): string {
  if ("randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeMask(word: string): string {
  return word
    .split(" ")
    .map((part) => {
      if (part.length <= 2) return `${part[0] ?? ""}${"_".repeat(Math.max(part.length - 1, 0))}`;
      return `${part[0]}${"_".repeat(part.length - 2)}${part[part.length - 1]}`;
    })
    .join(" ");
}

function makeClozeSentence(item: VocabItem): string {
  const primaryExample =
    item.examples?.find((example) => example.difficulty === "hard" && example.isPrimary) ??
    item.examples?.find((example) => example.difficulty === "hard") ??
    item.examples?.[0];

  return primaryExample?.blankedSentence ?? "Read the sentence and write the missing word.";
}

function makePrompt(mode: QuizMode, difficulty: SpellingDifficulty, item: VocabItem): string {
  if (mode === "choice") return item.english;
  if (mode === "typing") return item.chinese;
  if (difficulty === "hard") return makeClozeSentence(item);
  if (difficulty === "easy") return `${item.chinese} / ${makeMask(item.english)}`;
  return item.chinese;
}

function serializeRecords(records: AnswerRecord[]) {
  return records.map((record) => ({
    id: record.item.id,
    english: record.item.english,
    chinese: record.item.chinese,
    userAnswer: record.userAnswer,
    correct: record.correct
  }));
}

function getQuizStateKey(currentUsername: string): string {
  return `${QUIZ_STATE_KEY}:${currentUsername}`;
}

function getReadingStateKey(currentUsername: string, taskId: string): string {
  return `${READING_STATE_KEY}:${currentUsername}:${taskId}`;
}

function getActiveReadingTaskKey(currentUsername: string): string {
  return `${ACTIVE_READING_TASK_KEY}:${currentUsername}`;
}

function getActiveDayKey(currentUsername: string): string {
  return `${ACTIVE_DAY_KEY}:${currentUsername}`;
}

function findDailyTask(dayId: string | undefined): DailyTask | undefined {
  return dailyTasks.find((task) => task.id === dayId);
}

function findReadingTask(taskId: string | undefined): ReadingTask | undefined {
  return readingTasks.find((task) => task.id === taskId);
}

function toLocalDateKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getYesterdayDateKey(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return toLocalDateKey(yesterday);
}

function getLatestRecordsBySessionPrefix(records: SavedAnswerRecord[], prefix: string): SavedAnswerRecord[] {
  const groups = new Map<string, SavedAnswerRecord[]>();
  records
    .filter((record) => record.session_id.startsWith(prefix))
    .forEach((record) => {
      const group = groups.get(record.session_id) ?? [];
      group.push(record);
      groups.set(record.session_id, group);
    });

  return Array.from(groups.values())
    .sort((left, right) => {
      const leftLatest = Math.max(...left.map((record) => new Date(record.answeredAt).getTime()));
      const rightLatest = Math.max(...right.map((record) => new Date(record.answeredAt).getTime()));
      return rightLatest - leftLatest;
    })[0] ?? [];
}

function formatUnlockTime(unlockAt: string): string {
  return new Date(unlockAt).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function formatAnswerDuration(durationMs: number | null): string {
  if (durationMs === null) return "未记录用时";
  if (durationMs < 1000) return "用时不到 1 秒";
  const seconds = durationMs / 1000;
  if (seconds < 60) return `用时 ${seconds.toFixed(seconds < 10 ? 1 : 0)} 秒`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `用时 ${minutes} 分 ${remainingSeconds} 秒`;
}

function getInitialSection(): AppSection {
  const saved = localStorage.getItem(SECTION_KEY) as AppSection | null;
  return saved && validSections.includes(saved) ? saved : "overview";
}

export default function App() {
  const [words, setWords] = useState<VocabItem[]>([]);
  const [sourcePath, setSourcePath] = useState("");
  const [error, setError] = useState("");
  const [username, setUsername] = useState(() => localStorage.getItem(USERNAME_KEY) ?? "");
  const [loginName, setLoginName] = useState(() => localStorage.getItem(USERNAME_KEY) ?? "");
  const [activeSection, setActiveSection] = useState<AppSection>(getInitialSection);
  const [mode, setMode] = useState<QuizMode>("spelling");
  const [spellingDifficulty, setSpellingDifficulty] = useState<SpellingDifficulty>("medium");
  const [questionCount, setQuestionCount] = useState(30);
  const [wordbookQuestionCount, setWordbookQuestionCount] = useState(30);
  const [queue, setQueue] = useState<VocabItem[]>([]);
  const [index, setIndex] = useState(0);
  const [sessionId, setSessionId] = useState(createSessionId);
  const [activeTaskId, setActiveTaskId] = useState<string | undefined>();
  const [activeDayId, setActiveDayId] = useState<string | undefined>(() => localStorage.getItem(ACTIVE_DAY_KEY) ?? undefined);
  const [selected, setSelected] = useState("");
  const [typed, setTyped] = useState("");
  const [feedback, setFeedback] = useState<"idle" | "right" | "wrong">("idle");
  const [records, setRecords] = useState<AnswerRecord[]>([]);
  const [savedRecords, setSavedRecords] = useState<SavedAnswerRecord[]>([]);
  const [readingPassageSlug, setReadingPassageSlug] = useState("");
  const [readingPassage, setReadingPassage] = useState<ReadingPassage | null>(null);
  const [readingError, setReadingError] = useState("");
  const [peppaEpisodes, setPeppaEpisodes] = useState<ReadingPassageSummary[]>([]);
  const [peppaError, setPeppaError] = useState("");
  const [translationText, setTranslationText] = useState("");
  const [readingSubmissions, setReadingSubmissions] = useState<ReadingSubmission[]>([]);
  const [readingSubmitted, setReadingSubmitted] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const questionStartedAt = useRef<number | null>(null);
  const readingStartedAt = useRef<number | null>(null);

  useEffect(() => {
    fetch("/api/vocab")
      .then(async (response) => {
        const data = (await response.json()) as VocabResponse;
        if (!response.ok || data.error) throw new Error(data.error ?? "读取词表失败");
        setWords(data.words);
        setSourcePath(data.sourcePath);

        const rawQuizState = username ? localStorage.getItem(getQuizStateKey(username)) : null;
        if (!rawQuizState) return;

        const persisted = JSON.parse(rawQuizState) as PersistedQuizState;
        const restoredQueue = uniqueWords(
          persisted.queueIds
            .map((id) => data.words.find((item) => item.id === id))
            .filter((item): item is VocabItem => Boolean(item))
        );
        if (restoredQueue.length === 0) return;

        setActiveSection(persisted.section);
        setMode(persisted.mode);
        setSpellingDifficulty(persisted.spellingDifficulty);
        setQuestionCount(persisted.questionCount);
        setQueue(restoredQueue);
        setIndex(Math.min(persisted.index, restoredQueue.length));
        setSessionId(persisted.sessionId);
        setActiveTaskId(persisted.taskId);
        setActiveDayId(persisted.dayId);
        setRecords(
          persisted.records
            .map((record) => {
              const item = data.words.find((word) => word.id === record.id);
              return item ? { item, userAnswer: record.userAnswer, correct: record.correct } : null;
            })
            .filter((record): record is AnswerRecord => Boolean(record))
        );
      })
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : "读取词表失败");
      });
  }, []);

  useEffect(() => {
    localStorage.setItem(SECTION_KEY, activeSection);
  }, [activeSection]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!username) {
      if (activeDayId) localStorage.setItem(ACTIVE_DAY_KEY, activeDayId);
      return;
    }
    if (activeDayId) {
      localStorage.setItem(getActiveDayKey(username), activeDayId);
      localStorage.setItem(ACTIVE_DAY_KEY, activeDayId);
    }
  }, [activeDayId, username]);

  useEffect(() => {
    if (!username) return;
    localStorage.setItem(USERNAME_KEY, username);
    setActiveDayId((currentDayId) => currentDayId ?? localStorage.getItem(getActiveDayKey(username)) ?? undefined);
    setSavedRecords([]);
    setReadingSubmissions([]);
    void refreshUserData(username);
  }, [username]);

  useEffect(() => {
    if (!username || queue.length === 0) return;
    const persisted: PersistedQuizState = {
      section: activeSection,
      mode,
      spellingDifficulty,
      questionCount,
      queueIds: queue.map((item) => item.id),
      index,
      sessionId,
      taskId: activeTaskId,
      dayId: activeDayId,
      records: serializeRecords(records)
    };
    localStorage.setItem(getQuizStateKey(username), JSON.stringify(persisted));
    localStorage.removeItem(QUIZ_STATE_KEY);
  }, [activeDayId, activeSection, activeTaskId, index, mode, questionCount, queue, records, sessionId, spellingDifficulty, username]);

  const current = queue[index];
  const correctCount = records.filter((record) => record.correct).length;
  const attemptedCount = records.length;
  const accuracy = attemptedCount === 0 ? 0 : Math.round((correctCount / attemptedCount) * 100);
  const progress = queue.length === 0 ? 0 : Math.min(100, Math.round((index / queue.length) * 100));
  const mistakes = records.filter((record) => !record.correct);
  const allWords = useMemo(() => uniqueWords(words), [words]);
  const activeDailyTask = findDailyTask(activeDayId) ?? dailyTasks[0];
  const day1InProgress = activeTaskId === "day1-spelling" && queue.length > 0 && index < queue.length;
  const day2QuizInProgress = activeTaskId === "day2-yesterday-choice" && queue.length > 0 && index < queue.length;
  const day3QuizInProgress = activeTaskId === "day3-day2-choice" && queue.length > 0 && index < queue.length;
  const day1ProgressText = day1InProgress ? `已做 ${Math.min(index, queue.length)} / ${queue.length} 题` : "1 个小任务 · 100 题";
  const showQuizProgress = queue.length > 0 && activeSection !== "overview" && activeSection !== "review";
  const showTaskSection = activeSection === "overview" || (activeSection === "spelling" && queue.length === 0);
  const peppaEpisodeTasks = useMemo(
    () =>
      peppaEpisodes.map(
        (episode, episodeIndex): ReadingTask => ({
          id: `${PEPPA_TASK_PREFIX}${episode.slug}`,
          type: "script-reading",
          label: `第 ${episodeIndex + 1} 集`,
          title: episode.title,
          description: "读剧本，重点看句子里的常用表达。",
          passageSlug: episode.slug,
          responseMode: "complete"
        })
      ),
    [peppaEpisodes]
  );
  const activeReadingTask = findReadingTask(activeTaskId) ?? peppaEpisodeTasks.find((task) => task.id === activeTaskId);
  const isPeppaModuleActive = Boolean(activeTaskId?.startsWith(PEPPA_TASK_PREFIX));
  const activeReadingSubmission = activeReadingTask
    ? readingSubmissions.find((submission) => submission.taskId === activeReadingTask.id)
    : undefined;
  const yesterdayDateKey = getYesterdayDateKey();
  const yesterdayAnsweredWords = useMemo(() => {
    const seen = new Set<number>();
    return savedRecords
      .filter((record) => toLocalDateKey(record.answeredAt) === yesterdayDateKey)
      .sort((a, b) => new Date(a.answeredAt).getTime() - new Date(b.answeredAt).getTime())
      .map((record) => allWords.find((item) => item.id === record.wordId))
      .filter((item): item is VocabItem => Boolean(item))
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
  }, [allWords, savedRecords, yesterdayDateKey]);
  const day2ChoiceWords = useMemo(() => {
    const yesterdayIds = new Set(yesterdayAnsweredWords.map((item) => item.id));
    const reviewWords = shuffleArray(yesterdayAnsweredWords).slice(0, DAY2_REVIEW_WORD_COUNT);
    const newWords = shuffleArray(allWords.filter((item) => !yesterdayIds.has(item.id))).slice(0, DAY2_NEW_WORD_COUNT);
    const fallbackWords =
      reviewWords.length + newWords.length >= DAY2_CHOICE_COUNT
        ? []
        : shuffleArray(allWords.filter((item) => !reviewWords.some((reviewWord) => reviewWord.id === item.id) && !newWords.some((newWord) => newWord.id === item.id))).slice(
            0,
            DAY2_CHOICE_COUNT - reviewWords.length - newWords.length
          );

    return uniqueWords([...reviewWords, ...newWords, ...fallbackWords]).slice(0, DAY2_CHOICE_COUNT);
  }, [allWords, yesterdayAnsweredWords]);
  const day2ReviewWordCount = day2ChoiceWords.filter((item) => yesterdayAnsweredWords.some((word) => word.id === item.id)).length;
  const day2NewWordCount = day2ChoiceWords.length - day2ReviewWordCount;
  const day2CompletedChoiceWords = useMemo(() => {
    const seen = new Set<number>();
    return getLatestRecordsBySessionPrefix(savedRecords, "day2-yesterday-choice-")
      .sort((a, b) => a.id - b.id)
      .map((record) => allWords.find((item) => item.id === record.wordId))
      .filter((item): item is VocabItem => Boolean(item))
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
  }, [allWords, savedRecords]);
  const day3ChoiceWords = useMemo(() => {
    const day2Ids = new Set(day2CompletedChoiceWords.map((item) => item.id));
    const reviewWords = shuffleArray(day2CompletedChoiceWords).slice(0, DAY3_REVIEW_WORD_COUNT);
    const newWords = shuffleArray(allWords.filter((item) => !day2Ids.has(item.id))).slice(0, DAY3_NEW_WORD_COUNT);
    const fallbackWords =
      reviewWords.length + newWords.length >= DAY3_CHOICE_COUNT
        ? []
        : shuffleArray(allWords.filter((item) => !reviewWords.some((reviewWord) => reviewWord.id === item.id) && !newWords.some((newWord) => newWord.id === item.id))).slice(
            0,
            DAY3_CHOICE_COUNT - reviewWords.length - newWords.length
          );

    return uniqueWords([...reviewWords, ...newWords, ...fallbackWords]).slice(0, DAY3_CHOICE_COUNT);
  }, [allWords, day2CompletedChoiceWords]);
  const day3ReviewWordCount = day3ChoiceWords.filter((item) => day2CompletedChoiceWords.some((word) => word.id === item.id)).length;
  const day3NewWordCount = day3ChoiceWords.length - day3ReviewWordCount;
  const wordbookCountOptions = useMemo(() => {
    const options = [10, 20, 30, 50, 100, allWords.length].filter((count) => count > 0 && count <= allWords.length);
    return [...new Set(options)].sort((a, b) => a - b);
  }, [allWords.length]);
  const activeWordbookQuestionCount = Math.min(wordbookQuestionCount, allWords.length);
  const readingReturnSection: AppSection = isPeppaModuleActive ? "peppa" : "taskDetail";
  const readingReturnLabel = isPeppaModuleActive ? "返回剧集" : "返回任务详情";

  useEffect(() => {
    questionStartedAt.current = current ? performance.now() : null;
  }, [current?.id, index, sessionId]);

  useEffect(() => {
    if (!readingPassageSlug) return;
    setReadingError("");
    fetch(`/api/reading-passages/${encodeURIComponent(readingPassageSlug)}`)
      .then(async (response) => {
        const data = (await response.json()) as ReadingPassageResponse;
        if (!response.ok) throw new Error("阅读文章没有加载成功");
        setReadingPassage(data.passage);
      })
      .catch((caught) => {
        setReadingError(caught instanceof Error ? caught.message : "阅读文章没有加载成功");
      });
  }, [activeTaskId, readingPassageSlug]);

  useEffect(() => {
    if (activeSection !== "peppa" || peppaEpisodes.length > 0) return;
    setPeppaError("");
    fetch("/api/reading-passages?collection=peppa")
      .then(async (response) => {
        const data = (await response.json()) as ReadingPassagesResponse;
        if (!response.ok) throw new Error("小猪佩奇剧集没有加载成功");
        setPeppaEpisodes(data.passages);
      })
      .catch((caught) => {
        setPeppaError(caught instanceof Error ? caught.message : "小猪佩奇剧集没有加载成功");
      });
  }, [activeSection, peppaEpisodes.length]);

  useEffect(() => {
    if (!username || activeSection !== "reading" || activeReadingTask?.responseMode !== "translation") return;
    localStorage.setItem(getReadingStateKey(username, activeReadingTask.id), translationText);
  }, [activeReadingTask, activeSection, translationText, username]);

  useEffect(() => {
    if (!username || activeSection !== "reading") return;
    const savedTaskId = localStorage.getItem(getActiveReadingTaskKey(username));
    const savedPeppaTask = peppaEpisodeTasks.find((item) => item.id === savedTaskId);
    const task = activeReadingTask ?? findReadingTask(savedTaskId ?? undefined) ?? savedPeppaTask ?? readingTasks[0];
    const latestSubmission = readingSubmissions.find((submission) => submission.taskId === task.id);

    setActiveTaskId(task.id);
    setReadingPassageSlug((currentSlug) => currentSlug || task.passageSlug);
    setTranslationText((currentText) => {
      if (task.responseMode === "complete") return "";
      return currentText || localStorage.getItem(getReadingStateKey(username, task.id)) || latestSubmission?.translationText || "";
    });
    setReadingSubmitted(Boolean(latestSubmission));
    if (readingStartedAt.current === null) readingStartedAt.current = performance.now();
  }, [activeReadingTask, activeSection, activeTaskId, peppaEpisodeTasks, readingSubmissions, username]);

  const choices = useMemo(() => {
    if (!current) return [];
    const wrongChoices = shuffleArray(allWords.filter((item) => getWordKey(item) !== getWordKey(current)))
      .map((item) => item.chinese)
      .filter((choice, choiceIndex, list) => choice !== current.chinese && list.indexOf(choice) === choiceIndex)
      .slice(0, 3);
    return shuffleArray([current.chinese, ...wrongChoices]);
  }, [allWords, current]);

  const reviewSessions = useMemo(() => {
    const groups = new Map<string, SavedAnswerRecord[]>();
    savedRecords.forEach((record) => {
      const group = groups.get(record.session_id) ?? [];
      group.push(record);
      groups.set(record.session_id, group);
    });

    return Array.from(groups.entries())
      .map(([reviewSessionId, sessionRecords]) => {
        const orderedRecords = [...sessionRecords].sort((a, b) => a.id - b.id);
        const latest = sessionRecords.reduce((currentLatest, record) =>
          new Date(record.answeredAt).getTime() > new Date(currentLatest.answeredAt).getTime() ? record : currentLatest
        );
        const first = orderedRecords[0];
        const correct = orderedRecords.filter((record) => record.correct).length;
        const total = orderedRecords.length;
        const accuracy = total === 0 ? 0 : Math.round((correct / total) * 100);
        const title = reviewSessionId.startsWith("day1-")
          ? "Day 1 拼写自测"
          : reviewSessionId.startsWith("day2-yesterday-choice-")
            ? "Day 2 英译中选择题"
            : reviewSessionId.startsWith("day3-day2-choice-")
              ? "Day 3 英译中选择题"
              : `${modeLabels[first.mode]}${first.difficulty ? ` · ${difficultyLabels[first.difficulty]}` : ""}`;

        return {
          id: reviewSessionId,
          title,
          subtitle: `${total} 题 · 答对 ${correct} 题 · ${accuracy}%`,
          answeredAt: latest.answeredAt,
          records: orderedRecords
        };
      })
      .sort((a, b) => new Date(b.answeredAt).getTime() - new Date(a.answeredAt).getTime());
  }, [savedRecords]);

  async function refreshUserData(nextUsername = username) {
    if (!nextUsername) return;
    const [recordsResponse, readingResponse] = await Promise.all([
      fetch(`/api/users/${encodeURIComponent(nextUsername)}/records?limit=500`),
      fetch(`/api/users/${encodeURIComponent(nextUsername)}/reading-submissions?limit=100`)
    ]);
    if (recordsResponse.ok) {
      const data = (await recordsResponse.json()) as ReviewResponse;
      setSavedRecords(data.records);
    }
    if (readingResponse.ok) {
      const data = (await readingResponse.json()) as ReadingSubmissionsResponse;
      setReadingSubmissions(data.submissions);
    }
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextUsername = loginName.trim();
    if (!nextUsername) return;
    await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: nextUsername })
    });
    setActiveSection("overview");
    setQueue([]);
    setIndex(0);
    setSelected("");
    setTyped("");
    setFeedback("idle");
    setRecords([]);
    setSavedRecords([]);
    setActiveTaskId(undefined);
    setActiveDayId(undefined);
    setReadingPassageSlug("");
    setReadingPassage(null);
    setTranslationText("");
    setReadingSubmitted(false);
    localStorage.removeItem(QUIZ_STATE_KEY);
    localStorage.removeItem(ACTIVE_DAY_KEY);
    setUsername(nextUsername);
  }

  function logout() {
    if (username) localStorage.removeItem(getQuizStateKey(username));
    if (username) localStorage.removeItem(getActiveDayKey(username));
    setUsername("");
    setLoginName("");
    setActiveSection("overview");
    setActiveTaskId(undefined);
    setActiveDayId(undefined);
    setQueue([]);
    setIndex(0);
    setRecords([]);
    setSavedRecords([]);
    setReadingSubmissions([]);
    setReadingPassageSlug("");
    setReadingPassage(null);
    setTranslationText("");
    setReadingSubmitted(false);
    localStorage.removeItem(USERNAME_KEY);
    localStorage.removeItem(QUIZ_STATE_KEY);
    localStorage.removeItem(ACTIVE_DAY_KEY);
  }

  function openSection(section: AppSection) {
    if (section === "wordbook" && activeSection === "wordbook" && queue.length > 0) {
      stopQuiz("wordbook");
      return;
    }
    setActiveSection(section);
    if (section === "peppa") setActiveDayId(undefined);
    setSelected("");
    setTyped("");
    setFeedback("idle");
    if (section === "review") void refreshUserData();
  }

  function isNavActive(section: AppSection) {
    return (
      activeSection === section ||
      (section === "overview" && (activeSection === "taskDetail" || activeSection === "spelling" || (activeSection === "reading" && activeDayId))) ||
      (section === "peppa" && activeSection === "reading" && isPeppaModuleActive)
    );
  }

  function getQuizTaskRecords(task: DailyTaskItem): SavedAnswerRecord[] {
    if (!task.sessionPrefix) return [];
    return getLatestRecordsBySessionPrefix(savedRecords, task.sessionPrefix);
  }

  function isTaskItemComplete(task: DailyTaskItem): boolean {
    if (task.type === "quiz") return getQuizTaskRecords(task).length >= (task.count ?? 0);
    return readingSubmissions.some((item) => item.taskId === task.id);
  }

  function isDailyTaskLocked(task: DailyTask): boolean {
    return Boolean(task.unlockAt && now < new Date(task.unlockAt).getTime());
  }

  function isDailyTaskComplete(task: DailyTask): boolean {
    return task.items.length > 0 && task.items.every((item) => isTaskItemComplete(item));
  }

  function getDailyTaskProgressText(task: DailyTask): string {
    if (isDailyTaskLocked(task) && task.unlockAt) return `${formatUnlockTime(task.unlockAt)} 开放`;
    if (task.items.length === 0) return "任务内容待录入";
    const completed = task.items.filter((item) => isTaskItemComplete(item)).length;
    return `${completed} / ${task.items.length} 项完成`;
  }

  function getTaskItemProgressText(task: DailyTaskItem): string {
    if (task.type === "quiz" && task.id === "day1-spelling" && day1InProgress) {
      return `进行中 · 已做 ${Math.min(index, queue.length)} / ${queue.length} 题`;
    }
    if (task.type === "quiz" && task.id === "day2-yesterday-choice" && day2QuizInProgress) {
      return `进行中 · 已做 ${Math.min(index, queue.length)} / ${queue.length} 题`;
    }
    if (task.type === "quiz" && task.id === "day3-day2-choice" && day3QuizInProgress) {
      return `进行中 · 已做 ${Math.min(index, queue.length)} / ${queue.length} 题`;
    }
    if (task.type === "quiz") {
      const recordsForTask = getQuizTaskRecords(task);
      if (recordsForTask.length >= (task.count ?? 0)) {
        const latest = recordsForTask.reduce((currentLatest, record) =>
          new Date(record.answeredAt).getTime() > new Date(currentLatest.answeredAt).getTime() ? record : currentLatest
        );
        const correct = recordsForTask.filter((record) => record.correct).length;
        return `已完成 · 答对 ${correct} / ${recordsForTask.length} · ${new Date(latest.answeredAt).toLocaleString()}`;
      }
      if (task.source === "yesterdayAnswers") {
        return day2ChoiceWords.length > 0
          ? `${task.description} 本轮会抽 ${day2ReviewWordCount} 个昨天词、${day2NewWordCount} 个新词。昨天可选 ${yesterdayAnsweredWords.length} 个。`
          : `昨天还没有可用答题词。`;
      }
      if (task.source === "day2ChoiceAnswers") {
        return day3ChoiceWords.length > 0
          ? `${task.description} 本轮会抽 ${day3ReviewWordCount} 个 Day2 词、${day3NewWordCount} 个新词。Day2 可选 ${day2CompletedChoiceWords.length} 个。`
          : "还没有可用的 Day2 选择题词。";
      }
      return task.description;
    }

    const submission = readingSubmissions.find((item) => item.taskId === task.id);
    if (!submission) return task.description;
    const submittedAt = new Date(submission.submittedAt).toLocaleString();
    return task.responseMode === "translation" ? `已提交翻译 · ${submittedAt}` : `已读完 · ${submittedAt}`;
  }

  function getTaskItemButtonText(task: DailyTaskItem): string {
    if (task.type === "quiz" && task.id === "day1-spelling") return day1InProgress ? "继续" : isTaskItemComplete(task) ? "再做一次" : "开始";
    if (task.type === "quiz" && task.id === "day2-yesterday-choice") {
      if (day2QuizInProgress) return "继续";
      return isTaskItemComplete(task) ? "再做一次" : "开始";
    }
    if (task.type === "quiz" && task.id === "day3-day2-choice") {
      if (day3QuizInProgress) return "继续";
      return isTaskItemComplete(task) ? "再做一次" : "开始";
    }
    if (task.type === "script-reading") return isTaskItemComplete(task) ? "再读一遍" : "开始熟读";
    if (task.type === "translation") return isTaskItemComplete(task) ? "查看翻译" : "开始翻译";
    return "开始";
  }

  function openDailyTask(task: DailyTask) {
    if (isDailyTaskLocked(task) || task.items.length === 0) return;
    setActiveSection("taskDetail");
    setActiveDayId(task.id);
    setQueue([]);
    setIndex(0);
    setSelected("");
    setTyped("");
    setFeedback("idle");
    if (username) localStorage.setItem(getActiveDayKey(username), task.id);
  }

  function startQuiz(
    nextMode: QuizMode,
    options?: {
      difficulty?: SpellingDifficulty;
      count?: number;
      section?: AppSection;
      sessionId?: string;
      taskId?: string;
      dayId?: string;
      sourceWords?: VocabItem[];
    }
  ) {
    const nextDifficulty = options?.difficulty ?? spellingDifficulty;
    const sourceWords = uniqueWords(options?.sourceWords ?? allWords);
    const nextCount = Math.min(options?.count ?? questionCount, sourceWords.length);
    const nextSection = options?.section ?? (nextMode === "spelling" ? "spelling" : "wordbook");
    setActiveSection(nextSection);
    setMode(nextMode);
    setSpellingDifficulty(nextDifficulty);
    setQuestionCount(nextCount);
    setQueue(shuffleArray(sourceWords).slice(0, nextCount));
    setIndex(0);
    setSelected("");
    setTyped("");
    setFeedback("idle");
    setRecords([]);
    setSessionId(options?.sessionId ?? createSessionId());
    setActiveTaskId(options?.taskId);
    if (options?.dayId) setActiveDayId(options.dayId);
  }

  function startDay1() {
    if (day1InProgress) {
      setActiveSection("taskDetail");
      setActiveDayId("day1");
      setMode("spelling");
      setSpellingDifficulty("medium");
      setQuestionCount(100);
      setSelected("");
      setTyped("");
      setFeedback("idle");
      return;
    }

    startQuiz("spelling", {
      difficulty: "medium",
      count: 100,
      section: "taskDetail",
      sessionId: `day1-${createSessionId()}`,
      taskId: "day1-spelling",
      dayId: "day1"
    });
  }

  function startYesterdayChoiceTask() {
    if (day2QuizInProgress) {
      setActiveSection("taskDetail");
      setActiveDayId("day2");
      setMode("choice");
      setSpellingDifficulty("medium");
      setQuestionCount(Math.min(DAY2_CHOICE_COUNT, queue.length || day2ChoiceWords.length));
      setSelected("");
      setTyped("");
      setFeedback("idle");
      return;
    }

    if (day2ChoiceWords.length === 0) return;
    startQuiz("choice", {
      difficulty: "medium",
      count: DAY2_CHOICE_COUNT,
      section: "taskDetail",
      sessionId: `day2-yesterday-choice-${createSessionId()}`,
      taskId: "day2-yesterday-choice",
      dayId: "day2",
      sourceWords: day2ChoiceWords
    });
  }

  function startDay3ChoiceTask() {
    if (day3QuizInProgress) {
      setActiveSection("taskDetail");
      setActiveDayId("day3");
      setMode("choice");
      setSpellingDifficulty("medium");
      setQuestionCount(Math.min(DAY3_CHOICE_COUNT, queue.length || day3ChoiceWords.length));
      setSelected("");
      setTyped("");
      setFeedback("idle");
      return;
    }

    if (day3ChoiceWords.length === 0) return;
    startQuiz("choice", {
      difficulty: "medium",
      count: DAY3_CHOICE_COUNT,
      section: "taskDetail",
      sessionId: `day3-day2-choice-${createSessionId()}`,
      taskId: "day3-day2-choice",
      dayId: "day3",
      sourceWords: day3ChoiceWords
    });
  }

  function startTaskItem(task: DailyTaskItem) {
    if (task.id === "day1-spelling") {
      startDay1();
      return;
    }
    if (task.id === "day2-yesterday-choice") {
      startYesterdayChoiceTask();
      return;
    }
    if (task.id === "day3-day2-choice") {
      startDay3ChoiceTask();
      return;
    }
    if (task.passageSlug && task.responseMode) {
      startReadingTask(task as ReadingTask);
    }
  }

  function startPeppaEpisode(episode: ReadingPassageSummary, episodeIndex: number) {
    startReadingTask(
      {
        id: `${PEPPA_TASK_PREFIX}${episode.slug}`,
        type: "script-reading",
        label: `第 ${episodeIndex + 1} 集`,
        title: episode.title,
        description: "读剧本，重点看句子里的常用表达。",
        passageSlug: episode.slug,
        responseMode: "complete"
      },
      "peppa"
    );
  }

  function startReadingTask(task: ReadingTask, returnSection?: AppSection) {
    setActiveSection("reading");
    setActiveTaskId(task.id);
    setActiveDayId(returnSection === "peppa" ? undefined : task.id.startsWith("day2-") ? "day2" : activeDayId);
    setReadingPassageSlug(task.passageSlug);
    setReadingPassage((currentPassage) => (currentPassage?.slug === task.passageSlug ? currentPassage : null));
    setReadingError("");
    const latestSubmission = readingSubmissions.find((submission) => submission.taskId === task.id);
    setReadingSubmitted(Boolean(latestSubmission));
    setQueue([]);
    setIndex(0);
    setSelected("");
    setTyped("");
    setFeedback("idle");
    if (username) localStorage.setItem(getActiveReadingTaskKey(username), task.id);
    const savedTranslation = username ? localStorage.getItem(getReadingStateKey(username, task.id)) : null;
    setTranslationText(task.responseMode === "translation" ? savedTranslation ?? latestSubmission?.translationText ?? "" : "");
    readingStartedAt.current = performance.now();
  }

  async function submitReadingTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!username || activeReadingTask?.responseMode !== "translation" || !readingPassageSlug || translationText.trim().length === 0) return;
    const durationMs =
      readingStartedAt.current === null ? null : Math.max(0, Math.round(performance.now() - readingStartedAt.current));
    const response = await fetch("/api/reading-submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        task_id: activeReadingTask.id,
        passage_slug: readingPassageSlug,
        translation_text: translationText.trim(),
        duration_ms: durationMs
      })
    });
    if (!response.ok) {
      setReadingError("提交没有成功，请再试一次。");
      return;
    }
    if (username) localStorage.removeItem(getReadingStateKey(username, activeReadingTask.id));
    setReadingSubmitted(true);
    await refreshUserData(username);
  }

  async function completeReadingTask() {
    if (!username || !activeReadingTask || !readingPassageSlug) return;
    const durationMs =
      readingStartedAt.current === null ? null : Math.max(0, Math.round(performance.now() - readingStartedAt.current));
    const response = await fetch("/api/reading-submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        task_id: activeReadingTask.id,
        passage_slug: readingPassageSlug,
        translation_text: "已完成阅读",
        duration_ms: durationMs
      })
    });
    if (!response.ok) {
      setReadingError("提交没有成功，请再试一次。");
      return;
    }
    setReadingSubmitted(true);
    await refreshUserData(username);
  }

  function restart() {
    if (activeTaskId === "day1-spelling") {
      startDay1();
      return;
    }
    if (activeTaskId === "day2-yesterday-choice") {
      startYesterdayChoiceTask();
      return;
    }
    if (activeTaskId === "day3-day2-choice") {
      startDay3ChoiceTask();
      return;
    }
    startQuiz(mode, { difficulty: spellingDifficulty, count: questionCount, section: activeSection });
  }

  function stopQuiz(nextSection: AppSection = activeSection === "wordbook" ? "wordbook" : "overview") {
    setQueue([]);
    setIndex(0);
    setSelected("");
    setTyped("");
    setFeedback("idle");
    setRecords([]);
    setActiveTaskId(undefined);
    if (username) localStorage.removeItem(getQuizStateKey(username));
    localStorage.removeItem(QUIZ_STATE_KEY);
    setActiveSection(nextSection);
  }

  function saveAnswer(answer: string, correct: boolean, item: VocabItem, answerDurationMs: number | null) {
    if (!username) return;
    void fetch("/api/answers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        session_id: sessionId,
        mode,
        difficulty: spellingDifficulty,
        question_count: questionCount,
        word_display_order: item.id,
        english: item.english,
        chinese: item.chinese,
        prompt: makePrompt(mode, spellingDifficulty, item),
        user_answer: answer,
        correct,
        answer_duration_ms: answerDurationMs
      })
    }).then(() => refreshUserData());
  }

  function submitAnswer(answer: string) {
    if (!current || feedback !== "idle") return;

    const expected = mode === "choice" ? current.chinese : current.english;
    const correct =
      mode === "choice"
        ? answer === expected
        : normalizeAnswer(answer) === normalizeAnswer(expected);
    const answerDurationMs =
      questionStartedAt.current === null ? null : Math.max(0, Math.round(performance.now() - questionStartedAt.current));

    setRecords((previous) => [...previous, { item: current, userAnswer: answer, correct }]);
    setFeedback(correct ? "right" : "wrong");
    saveAnswer(answer, correct, current, answerDurationMs);
  }

  function nextQuestion() {
    setSelected("");
    setTyped("");
    setFeedback("idle");
    setIndex((previous) => previous + 1);
  }

  function clearFinishedQuiz() {
    stopQuiz(activeDayId ? "taskDetail" : "overview");
  }

  if (!username) {
    return (
      <main className="app app-centered">
        <form className="login-panel" onSubmit={login}>
          <ListChecks aria-hidden="true" />
          <h1>七年级英语词汇摸底</h1>
          <p>写上你的名字，就可以开始练单词啦。</p>
          <input
            autoFocus
            maxLength={60}
            onChange={(event) => setLoginName(event.target.value)}
            placeholder="用户名"
            value={loginName}
          />
          <button className="primary-button" disabled={loginName.trim().length === 0}>
            <Check aria-hidden="true" />
            进入
          </button>
        </form>
      </main>
    );
  }

  if (error) {
    return (
      <main className="app app-centered">
        <section className="error-panel">
          <X aria-hidden="true" />
          <h1>词表没有读到</h1>
          <p>{error}</p>
          <p>请检查 `.env` 里的数据库连接信息和 `VOCAB_LIST_SLUG` 是否正确。</p>
        </section>
      </main>
    );
  }

  if (words.length === 0) {
    return (
      <main className="app app-centered">
        <section className="loading-panel">
          <ListChecks aria-hidden="true" />
          <h1>正在加载词表</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="app">
      <aside className="side-panel">
        <div>
          <p className="eyebrow">Grade 7 Vocabulary</p>
          <h1>七年级英语词汇摸底</h1>
          <p className="source-path" title={sourcePath}>
            {sourcePath}
          </p>
        </div>

        <div className="user-row">
          <span>{username}</span>
          <button onClick={logout} title="退出登录">
            <LogOut aria-hidden="true" />
          </button>
        </div>

        <div className="mode-grid nav-grid" aria-label="功能栏">
          {navSections.map((section) => (
            <button
              className={isNavActive(section) ? "mode-button active" : "mode-button"}
              key={section}
              onClick={() => openSection(section)}
            >
              {section === "overview" && <LayoutDashboard aria-hidden="true" />}
              {section === "peppa" && <BookOpen aria-hidden="true" />}
              {section === "wordbook" && <BookOpen aria-hidden="true" />}
              {section === "review" && <History aria-hidden="true" />}
              {sectionLabels[section]}
            </button>
          ))}
        </div>

        {showQuizProgress && (
          <>
            <div className="progress-track" aria-label={`进度 ${progress}%`}>
              <div style={{ width: `${progress}%` }} />
            </div>
            <button className="ghost-button" onClick={restart}>
              <Shuffle aria-hidden="true" />
              重新开始本练习
            </button>
            {activeSection === "wordbook" && (
              <button className="ghost-button" onClick={() => stopQuiz("wordbook")}>
                <ArrowLeft aria-hidden="true" />
                返回单词本
              </button>
            )}
            {activeSection === "taskDetail" && (
              <button className="ghost-button" onClick={() => stopQuiz("taskDetail")}>
                <ArrowLeft aria-hidden="true" />
                返回任务详情
              </button>
            )}
          </>
        )}
      </aside>

      <section className="quiz-panel">
        {showTaskSection && (
          <section className="dashboard">
            <div className="section-heading">
              <p className="prompt-label">任务</p>
              <h2>今日任务</h2>
            </div>
            {dailyTasks.map((task) => {
              const locked = isDailyTaskLocked(task);
              const unavailable = locked || task.items.length === 0;
              return (
                <div className={locked ? "task-card locked" : "task-card"} key={task.id}>
                  <div>
                    <span className="task-day">{task.label}</span>
                    <h3>{task.title}</h3>
                    <p>{task.id === "day1" ? day1ProgressText : getDailyTaskProgressText(task)}</p>
                    <p>{task.description}</p>
                  </div>
                  <button className="primary-button" disabled={unavailable} onClick={() => openDailyTask(task)}>
                    <Play aria-hidden="true" />
                    {locked ? "未开放" : task.items.length === 0 ? "待录入" : isDailyTaskComplete(task) ? "查看任务" : "进入任务"}
                  </button>
                </div>
              );
            })}
          </section>
        )}

        {activeSection === "taskDetail" && queue.length === 0 && activeDailyTask && (
          <section className="dashboard task-detail-dashboard">
            <button className="ghost-button light compact-button" onClick={() => setActiveSection("overview")}>
              <ArrowLeft aria-hidden="true" />
              返回任务
            </button>
            <div className="section-heading">
              <p className="prompt-label">{activeDailyTask.label}</p>
              <h2>{activeDailyTask.title}</h2>
              <p>{activeDailyTask.description}</p>
            </div>
            <div className="task-item-list">
              {activeDailyTask.items.map((task) => {
                const complete = isTaskItemComplete(task);
                const disabled =
                  (task.id === "day2-yesterday-choice" && day2ChoiceWords.length === 0 && !day2QuizInProgress) ||
                  (task.id === "day3-day2-choice" && day3ChoiceWords.length === 0 && !day3QuizInProgress);
                return (
                  <div className={complete ? "task-item-card complete" : "task-item-card"} key={task.id}>
                    <div className="task-item-main">
                      <span className="task-day">{task.label}</span>
                      <h3>{task.title}</h3>
                      <p>{getTaskItemProgressText(task)}</p>
                    </div>
                    <div className="task-item-actions">
                      <span className={complete ? "status-pill complete" : "status-pill"}>{complete ? "已完成" : "未完成"}</span>
                      <button className="primary-button" disabled={disabled} onClick={() => startTaskItem(task)}>
                        {task.type === "quiz" ? <Eye aria-hidden="true" /> : <BookOpen aria-hidden="true" />}
                        {getTaskItemButtonText(task)}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="task-finish-panel">
              <button className="primary-button" disabled={!isDailyTaskComplete(activeDailyTask)} onClick={() => setActiveSection("overview")}>
                <Check aria-hidden="true" />
                {isDailyTaskComplete(activeDailyTask) ? `${activeDailyTask.label} 完成` : "完成全部小任务后打勾"}
              </button>
            </div>
          </section>
        )}

        {activeSection === "peppa" && (
          <section className="dashboard peppa-dashboard">
            <div className="section-heading">
              <p className="prompt-label">小猪佩奇</p>
              <h2>剧集列表</h2>
              <p>选一集进去读剧本。后面你继续录入新剧本，这里会按剧集列出来。</p>
            </div>
            {peppaError && <p className="inline-error">{peppaError}</p>}
            {peppaEpisodes.length === 0 && !peppaError && (
              <section className="loading-panel">
                <ListChecks aria-hidden="true" />
                <h1>正在加载剧集</h1>
              </section>
            )}
            {peppaEpisodes.length > 0 && (
              <div className="episode-list">
                {peppaEpisodes.map((episode, episodeIndex) => {
                  const taskId = `${PEPPA_TASK_PREFIX}${episode.slug}`;
                  const submission = readingSubmissions.find((item) => item.taskId === taskId);
                  return (
                    <button className="episode-card" key={episode.slug} onClick={() => startPeppaEpisode(episode, episodeIndex)}>
                      <span className="task-day">第 {episodeIndex + 1} 集</span>
                      <strong>{episode.title}</strong>
                      <small>{submission ? `已读过 · ${new Date(submission.submittedAt).toLocaleString()}` : "未完成"}</small>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeSection === "reading" && (
          <section className="dashboard reading-dashboard">
            <button className="ghost-button light compact-button" onClick={() => setActiveSection(readingReturnSection)}>
              <ArrowLeft aria-hidden="true" />
              {readingReturnLabel}
            </button>
            <div className="section-heading">
              <p className="prompt-label">{activeReadingTask?.label ?? "阅读任务"}</p>
              <h2>
                {activeReadingTask?.type === "script-reading"
                  ? "剧本阅读"
                  : activeReadingTask?.responseMode === "complete"
                    ? "通读文章"
                    : "通读并翻译"}
              </h2>
              <p>
                {activeReadingTask?.type === "script-reading"
                  ? "把剧本读顺，能连起来读下来就先算完成。这里不需要写翻译。"
                  : "先读原文，再用自己的办法翻译成中文。翻译不用漂亮，但要写出每句话的大意。"}
              </p>
            </div>
            {readingError && <p className="inline-error">{readingError}</p>}
            {!readingPassage && !readingError && (
              <section className="loading-panel">
                <ListChecks aria-hidden="true" />
                <h1>正在加载文章</h1>
              </section>
            )}
            {readingPassage && (
              <>
                <article className="reading-passage">
                  <p className="prompt-label">{readingPassage.source}</p>
                  <h3>{readingPassage.title}</h3>
                  {readingPassage.body.split("\n\n").map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  {readingPassage.notes && (
                    <div className="reading-notes">
                      <h4>重点词组</h4>
                      {readingPassage.notes.split("\n").map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </div>
                  )}
                </article>
                {activeReadingTask?.responseMode === "translation" && (
                  <form className="translation-form" onSubmit={submitReadingTask}>
                    <label htmlFor="translation-text">我的中文翻译</label>
                    <textarea
                      id="translation-text"
                      onChange={(event) => setTranslationText(event.target.value)}
                      placeholder="把文章翻译成中文，可以先按自己的理解写。"
                      value={translationText}
                    />
                    <div className="translation-actions">
                      <button className="primary-button" disabled={translationText.trim().length === 0}>
                        <Check aria-hidden="true" />
                        提交翻译
                      </button>
                      {readingSubmitted && <span>已提交，后面可以继续修改再提交。</span>}
                      {readingSubmitted && (
                        <button className="ghost-button light" type="button" onClick={() => setActiveSection(readingReturnSection)}>
                          {isPeppaModuleActive ? "回到剧集" : "回到 Day 2"}
                        </button>
                      )}
                    </div>
                  </form>
                )}
                {activeReadingTask?.responseMode === "complete" && (
                  <div className="reading-actions">
                    <button className="primary-button" disabled={readingSubmitted} onClick={completeReadingTask}>
                      <Check aria-hidden="true" />
                      {readingSubmitted ? "已读完" : "我读完了"}
                    </button>
                    {activeReadingSubmission && <span>完成时间：{new Date(activeReadingSubmission.submittedAt).toLocaleString()}</span>}
                    {readingSubmitted && (
                      <button className="ghost-button light" onClick={() => setActiveSection(readingReturnSection)}>
                        {isPeppaModuleActive ? "回到剧集" : "回到 Day 2"}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {activeSection === "wordbook" && queue.length === 0 && (
          <section className="dashboard">
            <div className="section-heading">
              <p className="prompt-label">单词本</p>
              <h2>选择难度和方向</h2>
              <p>全部词汇统一归类为高频词，不再区分加测词。</p>
            </div>
            <div className="difficulty-panel light-panel">
              <p>难度</p>
              <div className="difficulty-grid" aria-label="单词本难度">
                {(["easy", "medium", "hard"] as SpellingDifficulty[]).map((item) => (
                  <button
                    className={spellingDifficulty === item ? "difficulty-button active" : "difficulty-button"}
                    key={item}
                    onClick={() => setSpellingDifficulty(item)}
                  >
                    {difficultyLabels[item]}
                  </button>
                ))}
              </div>
            </div>
            <div className="difficulty-panel light-panel">
              <p>题数</p>
              <div className="count-grid" aria-label="单词本题数">
                {wordbookCountOptions.map((count) => (
                  <button
                    className={activeWordbookQuestionCount === count ? "difficulty-button active" : "difficulty-button"}
                    key={count}
                    onClick={() => setWordbookQuestionCount(count)}
                  >
                    {count === allWords.length ? `全部 ${count}` : `${count} 题`}
                  </button>
                ))}
              </div>
            </div>
            <div className="tool-grid">
              <button
                className="tool-card"
                onClick={() => startQuiz("typing", { difficulty: spellingDifficulty, count: activeWordbookQuestionCount, section: "wordbook" })}
              >
                <Keyboard aria-hidden="true" />
                <strong>中译英</strong>
                <span>看中文，输入英文。本轮 {activeWordbookQuestionCount} 题。</span>
              </button>
              <button
                className="tool-card"
                onClick={() => startQuiz("choice", { difficulty: spellingDifficulty, count: activeWordbookQuestionCount, section: "wordbook" })}
              >
                <Eye aria-hidden="true" />
                <strong>英译中</strong>
                <span>看英文，选择中文意思。本轮 {activeWordbookQuestionCount} 题。</span>
              </button>
            </div>
          </section>
        )}

        {activeSection === "review" && (
          <section className="dashboard">
            <div className="section-heading">
              <p className="prompt-label">Review</p>
              <h2>答题记录</h2>
            </div>
            <button className="ghost-button light" onClick={() => refreshUserData()}>
              <RotateCcw aria-hidden="true" />
              刷新记录
            </button>
            <div className="review-list">
              {savedRecords.length === 0 && <p>还没有答题记录。</p>}
              {reviewSessions.map((reviewSession, sessionIndex) => (
                <details className="review-session" key={reviewSession.id} open={sessionIndex === 0}>
                  <summary>
                    <div>
                      <strong>{reviewSession.title}</strong>
                      <span>{new Date(reviewSession.answeredAt).toLocaleString()}</span>
                    </div>
                    <div>
                      <strong>{reviewSession.subtitle}</strong>
                      <span>点开看本轮详情</span>
                    </div>
                  </summary>
                  <div className="session-records">
                    {reviewSession.records.map((record) => (
                      <div className={record.correct ? "review-row right" : "review-row wrong"} key={record.id}>
                        <div>
                          <strong>{record.english}</strong>
                          <span>{record.chinese}</span>
                        </div>
                        <div>
                          <span>{record.userAnswer}</span>
                          <small>{record.correct ? "答对了" : "需要再记一下"}</small>
                          <small>{formatAnswerDuration(record.answerDurationMs)}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}

        {queue.length > 0 && activeSection !== "overview" && activeSection !== "review" && !current && (
          <section className="finish-panel">
            <Trophy aria-hidden="true" />
            <h1>本轮完成</h1>
            <p>
              答对 {correctCount} / {attemptedCount}，正确率 {accuracy}%。
            </p>
            <button className="primary-button" onClick={restart}>
              <RotateCcw aria-hidden="true" />
              再来一轮
            </button>
            <button className="ghost-button light" onClick={clearFinishedQuiz}>
              回到任务
            </button>
            {mistakes.length > 0 && (
              <div className="mistake-list">
                <h2>错题回顾</h2>
                {mistakes.map((record, mistakeIndex) => (
                  <div className="mistake-row" key={`${record.item.id}-${mistakeIndex}`}>
                    <span>{record.item.english}</span>
                    <span>{record.item.chinese}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {current && activeSection !== "overview" && activeSection !== "review" && (
          <>
            <div className="quiz-topline">
              <span>
                第 {index + 1} / {queue.length} 题
              </span>
              <span>{current.origin?.label || "高频词"}</span>
            </div>

            {mode === "choice" && (
              <>
                <p className="prompt-label">请选择中文意思</p>
                <h2 className="prompt-word">{current.english}</h2>
                <div className="choice-grid">
                  {choices.map((choice) => (
                    <button
                      className={
                        feedback !== "idle" && choice === current.chinese
                          ? "choice-button correct"
                          : selected === choice
                            ? "choice-button selected"
                            : "choice-button"
                      }
                      key={choice}
                      onClick={() => {
                        setSelected(choice);
                        submitAnswer(choice);
                      }}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              </>
            )}

            {mode !== "choice" && (
              <form
                className="typing-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitAnswer(typed);
                }}
              >
                <p className="prompt-label">
                  {mode === "typing"
                    ? "请写出英文"
                    : spellingDifficulty === "hard"
                      ? "请根据英文句子填空"
                      : spellingDifficulty === "medium"
                        ? "请根据中文拼写英文"
                        : "请根据中文和提示拼写英文"}
                </p>
                {mode !== "spelling" || spellingDifficulty !== "hard" ? (
                  <h2 className="prompt-word chinese">{current.chinese}</h2>
                ) : (
                  <p className="cloze-sentence">{makeClozeSentence(current)}</p>
                )}
                {(mode === "spelling" || mode === "typing") && spellingDifficulty === "easy" && (
                  <p className="spelling-mask">{makeMask(current.english)}</p>
                )}
                <input
                  autoFocus
                  autoCapitalize="none"
                  autoComplete="off"
                  disabled={feedback !== "idle"}
                  onChange={(event) => setTyped(event.target.value)}
                  placeholder={mode === "spelling" && spellingDifficulty === "hard" ? "填入空缺的英文" : "输入英文"}
                  value={typed}
                />
                <button className="primary-button" disabled={feedback !== "idle" || typed.trim().length === 0}>
                  <Check aria-hidden="true" />
                  提交
                </button>
              </form>
            )}

            {feedback !== "idle" && (
              <div className={feedback === "right" ? "feedback right" : "feedback wrong"}>
                {feedback === "right" ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}
                <div>
                  <strong>{feedback === "right" ? "答对了" : "再记一下"}</strong>
                  <span>
                    {current.english} = {current.chinese}
                  </span>
                </div>
                <button className="primary-button" onClick={nextQuestion}>
                  下一题
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
