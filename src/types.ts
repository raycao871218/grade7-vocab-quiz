export type VocabItem = {
  id: number;
  english: string;
  chinese: string;
  bonus: boolean;
};

export type QuizMode = "choice" | "typing" | "spelling";

export type AnswerRecord = {
  item: VocabItem;
  userAnswer: string;
  correct: boolean;
};
