import { Check, Eye, Keyboard, ListChecks, RotateCcw, Shuffle, Trophy, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AnswerRecord, QuizMode, SpellingDifficulty, VocabItem } from "./types";

type VocabResponse = {
  sourcePath: string;
  words: VocabItem[];
  error?: string;
};

const modeLabels: Record<QuizMode, string> = {
  choice: "英译中",
  typing: "中译英",
  spelling: "拼写自测"
};

const modeHints: Record<QuizMode, string> = {
  choice: "看英文，选择正确中文。",
  typing: "看中文，输入英文。",
  spelling: "按难度拼出英文。"
};

const difficultyLabels: Record<SpellingDifficulty, string> = {
  easy: "简单",
  medium: "中等",
  hard: "困难"
};

const difficultyHints: Record<SpellingDifficulty, string> = {
  easy: "显示中文和首尾字母提示。",
  medium: "只显示中文。",
  hard: "只显示全英文填空句。"
};

function shuffleArray<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
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

export default function App() {
  const [words, setWords] = useState<VocabItem[]>([]);
  const [sourcePath, setSourcePath] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<QuizMode>("choice");
  const [spellingDifficulty, setSpellingDifficulty] = useState<SpellingDifficulty>("easy");
  const [includeBonus, setIncludeBonus] = useState(false);
  const [queue, setQueue] = useState<VocabItem[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [typed, setTyped] = useState("");
  const [feedback, setFeedback] = useState<"idle" | "right" | "wrong">("idle");
  const [records, setRecords] = useState<AnswerRecord[]>([]);

  useEffect(() => {
    fetch("/api/vocab")
      .then(async (response) => {
        const data = (await response.json()) as VocabResponse;
        if (!response.ok || data.error) throw new Error(data.error ?? "读取词表失败");
        setWords(data.words);
        setSourcePath(data.sourcePath);
        setQueue(shuffleArray(data.words.filter((item) => !item.bonus)));
      })
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : "读取词表失败");
      });
  }, []);

  const activeWords = useMemo(
    () => words.filter((item) => includeBonus || !item.bonus),
    [includeBonus, words]
  );

  const current = queue[index];
  const correctCount = records.filter((record) => record.correct).length;
  const attemptedCount = records.length;
  const accuracy = attemptedCount === 0 ? 0 : Math.round((correctCount / attemptedCount) * 100);
  const progress = queue.length === 0 ? 0 : Math.min(100, Math.round((index / queue.length) * 100));
  const mistakes = records.filter((record) => !record.correct);

  const choices = useMemo(() => {
    if (!current) return [];
    const wrongChoices = shuffleArray(activeWords.filter((item) => item.id !== current.id))
      .slice(0, 3)
      .map((item) => item.chinese);
    return shuffleArray([current.chinese, ...wrongChoices]);
  }, [activeWords, current]);

  function restart(nextMode = mode) {
    const nextWords = words.filter((item) => includeBonus || !item.bonus);
    setMode(nextMode);
    setQueue(shuffleArray(nextWords));
    setIndex(0);
    setSelected("");
    setTyped("");
    setFeedback("idle");
    setRecords([]);
  }

  function resetWithBonus(nextIncludeBonus: boolean) {
    const nextWords = words.filter((item) => nextIncludeBonus || !item.bonus);
    setIncludeBonus(nextIncludeBonus);
    setQueue(shuffleArray(nextWords));
    setIndex(0);
    setSelected("");
    setTyped("");
    setFeedback("idle");
    setRecords([]);
  }

  function changeSpellingDifficulty(nextDifficulty: SpellingDifficulty) {
    setSpellingDifficulty(nextDifficulty);
    setSelected("");
    setTyped("");
    setFeedback("idle");
  }

  function submitAnswer(answer: string) {
    if (!current || feedback !== "idle") return;

    const expected = mode === "choice" ? current.chinese : current.english;
    const correct =
      mode === "choice"
        ? answer === expected
        : normalizeAnswer(answer) === normalizeAnswer(expected);

    setRecords((previous) => [...previous, { item: current, userAnswer: answer, correct }]);
    setFeedback(correct ? "right" : "wrong");
  }

  function nextQuestion() {
    setSelected("");
    setTyped("");
    setFeedback("idle");
    setIndex((previous) => previous + 1);
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

  if (!current && words.length === 0) {
    return (
      <main className="app app-centered">
        <section className="loading-panel">
          <ListChecks aria-hidden="true" />
          <h1>正在加载词表</h1>
        </section>
      </main>
    );
  }

  if (!current) {
    return (
      <main className="app">
        <section className="finish-panel">
          <Trophy aria-hidden="true" />
          <h1>本轮完成</h1>
          <p>
            答对 {correctCount} / {attemptedCount}，正确率 {accuracy}%。
          </p>
          <button className="primary-button" onClick={() => restart()}>
            <RotateCcw aria-hidden="true" />
            再来一轮
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
            {sourcePath || "VOCAB_SOURCE_PATH"}
          </p>
        </div>

        <div className="mode-grid" aria-label="练习模式">
          {(["choice", "typing", "spelling"] as QuizMode[]).map((item) => (
            <button
              className={mode === item ? "mode-button active" : "mode-button"}
              key={item}
              onClick={() => restart(item)}
              title={modeHints[item]}
            >
              {item === "choice" && <Eye aria-hidden="true" />}
              {item !== "choice" && <Keyboard aria-hidden="true" />}
              {modeLabels[item]}
            </button>
          ))}
        </div>

        {mode === "spelling" && (
          <div className="difficulty-panel">
            <p>拼写难度</p>
            <div className="difficulty-grid" aria-label="拼写自测难度">
              {(["easy", "medium", "hard"] as SpellingDifficulty[]).map((item) => (
                <button
                  className={spellingDifficulty === item ? "difficulty-button active" : "difficulty-button"}
                  key={item}
                  onClick={() => changeSpellingDifficulty(item)}
                  title={difficultyHints[item]}
                >
                  {difficultyLabels[item]}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="toggle-row">
          <input
            checked={includeBonus}
            onChange={(event) => {
              resetWithBonus(event.target.checked);
            }}
            type="checkbox"
          />
          包含 20 个加测词
        </label>

        <div className="stats">
          <div>
            <strong>{attemptedCount}</strong>
            <span>已答</span>
          </div>
          <div>
            <strong>{correctCount}</strong>
            <span>答对</span>
          </div>
          <div>
            <strong>{accuracy}%</strong>
            <span>正确率</span>
          </div>
        </div>

        <div className="progress-track" aria-label={`进度 ${progress}%`}>
          <div style={{ width: `${progress}%` }} />
        </div>

        <button className="ghost-button" onClick={() => restart()}>
          <Shuffle aria-hidden="true" />
          重新洗牌
        </button>
      </aside>

      <section className="quiz-panel">
        <div className="quiz-topline">
          <span>
            第 {index + 1} / {queue.length} 题
          </span>
          <span>{current.bonus ? "加测词" : "核心词"}</span>
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
            {mode === "spelling" && spellingDifficulty === "easy" && (
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
      </section>
    </main>
  );
}
