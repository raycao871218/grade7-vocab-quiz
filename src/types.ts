export type VocabItem = {
  id: number;
  english: string;
  chinese: string;
  bonus: boolean;
  examples?: VocabExample[];
};

export type QuizMode = "choice" | "typing" | "spelling";

export type SpellingDifficulty = "easy" | "medium" | "hard";

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
