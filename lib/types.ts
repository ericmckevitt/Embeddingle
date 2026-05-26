export type EmbeddingRow = {
  word: string;
  embedding: number[];
};

export type GuessResult = {
  guess: string;
  score: number;
  rank: number;
  isExact: boolean;
  attemptsUsed: number;
};

export type Session = {
  id: string;
  targetWord: string;
  targetVector: number[];
  sortedSimilarities: number[];
  guesses: GuessResult[];
  createdAt: number;
};
