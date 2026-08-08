export type VocabItem = {
  id: number;
  english: string;
  chinese: string;
  bonus: boolean;
  examples?: VocabExample[];
};

export type QuizMode = "choice" | "typing" | "spelling";

export type SpellingDifficulty = "easy" | "medium" | "hard";

export type AppSection = "overview" | "wordbook" | "spelling" | "review";

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
