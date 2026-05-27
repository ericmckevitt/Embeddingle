import { getVocabStore } from "@/lib/vocab";

type IndexStore = {
  byPrefix1: Map<string, string[]>;
  byPrefix2: Map<string, string[]>;
  byPrefix3: Map<string, string[]>;
};

let indexCache: IndexStore | null = null;

function addToIndex(index: Map<string, string[]>, key: string, word: string): void {
  const existing = index.get(key);
  if (existing) {
    existing.push(word);
  } else {
    index.set(key, [word]);
  }
}

function buildIndex(): IndexStore {
  const { words } = getVocabStore();
  const byPrefix1 = new Map<string, string[]>();
  const byPrefix2 = new Map<string, string[]>();
  const byPrefix3 = new Map<string, string[]>();

  for (const word of words) {
    addToIndex(byPrefix1, word.slice(0, 1), word);
    addToIndex(byPrefix2, word.slice(0, 2), word);
    addToIndex(byPrefix3, word.slice(0, 3), word);
  }

  return { byPrefix1, byPrefix2, byPrefix3 };
}

function getIndex(): IndexStore {
  if (!indexCache) {
    indexCache = buildIndex();
  }
  return indexCache;
}

function isSubsequence(query: string, word: string): boolean {
  let q = 0;
  for (let i = 0; i < word.length && q < query.length; i += 1) {
    if (word[i] === query[q]) {
      q += 1;
    }
  }
  return q === query.length;
}

function fuzzyScore(query: string, word: string): number {
  if (word === query) {
    return 10000;
  }
  if (word.startsWith(query)) {
    return 9000 - (word.length - query.length);
  }

  const includesIndex = word.indexOf(query);
  if (includesIndex >= 0) {
    return 7000 - includesIndex - (word.length - query.length);
  }

  if (isSubsequence(query, word)) {
    return 5000 - (word.length - query.length);
  }

  return -1;
}

function candidatePool(query: string): string[] {
  const index = getIndex();
  const { words } = getVocabStore();

  if (query.length >= 3) {
    return index.byPrefix3.get(query.slice(0, 3)) ?? words;
  }
  if (query.length === 2) {
    return index.byPrefix2.get(query) ?? words;
  }
  if (query.length === 1) {
    return index.byPrefix1.get(query) ?? words;
  }
  return [];
}

export function searchVocabulary(query: string, limit = 12): string[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  const pool = candidatePool(normalized);
  const scored: Array<{ word: string; score: number }> = [];

  for (const word of pool) {
    const score = fuzzyScore(normalized, word);
    if (score >= 0) {
      scored.push({ word, score });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (a.word.length !== b.word.length) {
      return a.word.length - b.word.length;
    }
    return a.word.localeCompare(b.word);
  });

  return scored.slice(0, Math.max(1, Math.min(50, limit))).map((entry) => entry.word);
}
