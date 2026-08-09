import {
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

type PersistedQuizState = {
  section: AppSection;
  mode: QuizMode;
  spellingDifficulty: SpellingDifficulty;
  questionCount: number;
  queueIds: number[];
  index: number;
  sessionId: string;
  taskId?: string;
  records: Array<{ id: number; english: string; chinese: string; userAnswer: string; correct: boolean }>;
};

const USERNAME_KEY = "grade7-vocab-username";
const SECTION_KEY = "grade7-vocab-section";
const QUIZ_STATE_KEY = "grade7-vocab-quiz-state";

const sectionLabels: Record<AppSection, string> = {
  overview: "任务",
  wordbook: "单词本",
  spelling: "拼写自测",
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

const navSections: AppSection[] = ["overview", "wordbook", "review"];
const validSections: AppSection[] = ["overview", "wordbook", "review"];

function shuffleArray<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
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
  const [queue, setQueue] = useState<VocabItem[]>([]);
  const [index, setIndex] = useState(0);
  const [sessionId, setSessionId] = useState(createSessionId);
  const [activeTaskId, setActiveTaskId] = useState<string | undefined>();
  const [selected, setSelected] = useState("");
  const [typed, setTyped] = useState("");
  const [feedback, setFeedback] = useState<"idle" | "right" | "wrong">("idle");
  const [records, setRecords] = useState<AnswerRecord[]>([]);
  const [savedRecords, setSavedRecords] = useState<SavedAnswerRecord[]>([]);
  const questionStartedAt = useRef<number | null>(null);

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
        const restoredQueue = persisted.queueIds
          .map((id) => data.words.find((item) => item.id === id))
          .filter((item): item is VocabItem => Boolean(item));
        if (restoredQueue.length === 0) return;

        setActiveSection(persisted.section);
        setMode(persisted.mode);
        setSpellingDifficulty(persisted.spellingDifficulty);
        setQuestionCount(persisted.questionCount);
        setQueue(restoredQueue);
        setIndex(Math.min(persisted.index, restoredQueue.length));
        setSessionId(persisted.sessionId);
        setActiveTaskId(persisted.taskId);
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
    if (!username) return;
    localStorage.setItem(USERNAME_KEY, username);
    setSavedRecords([]);
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
      records: serializeRecords(records)
    };
    localStorage.setItem(getQuizStateKey(username), JSON.stringify(persisted));
    localStorage.removeItem(QUIZ_STATE_KEY);
  }, [activeSection, activeTaskId, index, mode, questionCount, queue, records, sessionId, spellingDifficulty, username]);

  const current = queue[index];
  const correctCount = records.filter((record) => record.correct).length;
  const attemptedCount = records.length;
  const accuracy = attemptedCount === 0 ? 0 : Math.round((correctCount / attemptedCount) * 100);
  const progress = queue.length === 0 ? 0 : Math.min(100, Math.round((index / queue.length) * 100));
  const mistakes = records.filter((record) => !record.correct);
  const allWords = words;
  const day1InProgress = activeTaskId === "day1" && queue.length > 0 && index < queue.length;
  const day1ProgressText = day1InProgress ? `已做 ${Math.min(index, queue.length)} / ${queue.length} 题` : "中等难度 · 100 个高频词";
  const showQuizProgress = queue.length > 0 && activeSection !== "overview" && activeSection !== "review";
  const showTaskSection = activeSection === "overview" || (activeSection === "spelling" && queue.length === 0);

  useEffect(() => {
    questionStartedAt.current = current ? performance.now() : null;
  }, [current?.id, index, sessionId]);

  const choices = useMemo(() => {
    if (!current) return [];
    const wrongChoices = shuffleArray(allWords.filter((item) => item.id !== current.id))
      .slice(0, 3)
      .map((item) => item.chinese);
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
          ? "Day 1 今日任务"
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
    const recordsResponse = await fetch(`/api/users/${encodeURIComponent(nextUsername)}/records?limit=500`);
    if (recordsResponse.ok) {
      const data = (await recordsResponse.json()) as ReviewResponse;
      setSavedRecords(data.records);
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
    localStorage.removeItem(QUIZ_STATE_KEY);
    setUsername(nextUsername);
  }

  function logout() {
    if (username) localStorage.removeItem(getQuizStateKey(username));
    setUsername("");
    setLoginName("");
    setActiveSection("overview");
    setActiveTaskId(undefined);
    setQueue([]);
    setIndex(0);
    setRecords([]);
    setSavedRecords([]);
    localStorage.removeItem(USERNAME_KEY);
    localStorage.removeItem(QUIZ_STATE_KEY);
  }

  function openSection(section: AppSection) {
    setActiveSection(section);
    setSelected("");
    setTyped("");
    setFeedback("idle");
    if (section === "review") void refreshUserData();
  }

  function isNavActive(section: AppSection) {
    return activeSection === section || (section === "overview" && activeSection === "spelling");
  }

  function startQuiz(
    nextMode: QuizMode,
    options?: {
      difficulty?: SpellingDifficulty;
      count?: number;
      section?: AppSection;
      sessionId?: string;
      taskId?: string;
    }
  ) {
    const nextDifficulty = options?.difficulty ?? spellingDifficulty;
    const nextCount = Math.min(options?.count ?? questionCount, allWords.length);
    const nextSection = options?.section ?? (nextMode === "spelling" ? "spelling" : "wordbook");
    setActiveSection(nextSection);
    setMode(nextMode);
    setSpellingDifficulty(nextDifficulty);
    setQuestionCount(nextCount);
    setQueue(shuffleArray(allWords).slice(0, nextCount));
    setIndex(0);
    setSelected("");
    setTyped("");
    setFeedback("idle");
    setRecords([]);
    setSessionId(options?.sessionId ?? createSessionId());
    setActiveTaskId(options?.taskId);
  }

  function startDay1() {
    if (day1InProgress) {
      setActiveSection("spelling");
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
      section: "spelling",
      sessionId: `day1-${createSessionId()}`,
      taskId: "day1"
    });
  }

  function restart() {
    startQuiz(mode, { difficulty: spellingDifficulty, count: questionCount, section: activeSection });
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
    setQueue([]);
    setIndex(0);
    setRecords([]);
    setActiveTaskId(undefined);
    if (username) localStorage.removeItem(getQuizStateKey(username));
    localStorage.removeItem(QUIZ_STATE_KEY);
    openSection("overview");
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
            <div className="task-card">
              <div>
                <span className="task-day">Day 1</span>
                <h3>中等难度拼写自测</h3>
                <p>{day1ProgressText}</p>
              </div>
              <button className="primary-button" onClick={startDay1}>
                <Play aria-hidden="true" />
                {day1InProgress ? "继续 Day 1" : "开始 Day 1"}
              </button>
            </div>
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
            <div className="tool-grid">
              <button
                className="tool-card"
                onClick={() => startQuiz("typing", { difficulty: spellingDifficulty, count: allWords.length, section: "wordbook" })}
              >
                <Keyboard aria-hidden="true" />
                <strong>中译英</strong>
                <span>看中文，输入英文。简单难度会给一点提示。</span>
              </button>
              <button
                className="tool-card"
                onClick={() => startQuiz("choice", { difficulty: spellingDifficulty, count: allWords.length, section: "wordbook" })}
              >
                <Eye aria-hidden="true" />
                <strong>英译中</strong>
                <span>看英文，选择中文意思。</span>
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
              <span>高频词</span>
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
