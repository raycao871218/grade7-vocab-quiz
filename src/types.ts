export type VocabItem = {
  id: number;
  english: string;
  chinese: string;
  bonus: boolean;
  origin?: VocabOrigin;
  examples?: VocabExample[];
};

export type VocabOrigin = {
  semester: string;
  page: string;
  sourceListSlug: string;
  label: string;
};

export type QuizMode = "choice" | "typing" | "spelling";

export type SpellingDifficulty = "easy" | "medium" | "hard";

export type AppSection = "overview" | "taskDetail" | "peppa" | "wordbook" | "spelling" | "reading" | "review";

export type VocabExample = {
  sentence: string;
  blankedSentence: string;
  difficulty: SpellingDifficulty;
  isPrimary: boolean;
};

export type AnswerRecord = {
  item: VocabItem;
  userAnswer: string;
  correct: boolean;
};

export type SavedAnswerRecord = {
  id: number;
  username: string;
  session_id: string;
  mode: QuizMode;
  difficulty: SpellingDifficulty | null;
  question_count: number | null;
  wordId: number;
  english: string;
  chinese: string;
  prompt: string;
  userAnswer: string;
  correct: boolean;
  answerDurationMs: number | null;
  answeredAt: string;
};

export type UserSummary = {
  totalAnswers: number;
  correctAnswers: number;
  checkInDays: number;
  lastAnsweredAt: string | null;
  accuracy: number;
  nextDay: number;
};

export type ReadingPassage = {
  slug: string;
  title: string;
  source: string;
  body: string;
  notes: string;
};

export type ReadingPassageSummary = {
  slug: string;
  title: string;
  source: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ReadingSubmission = {
  id: number;
  username: string;
  taskId: string;
  passageSlug: string;
  translationText: string;
  durationMs: number | null;
  submittedAt: string;
};
