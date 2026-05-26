import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EmbeddingRow } from "@/lib/types";

type VocabStore = {
  words: string[];
  vectorsByWord: Map<string, number[]>;
};

let cache: VocabStore | null = null;

function loadEmbeddings(): VocabStore {
  const dataPath = join(process.cwd(), "data", "embeddings.jsonl");
  const raw = readFileSync(dataPath, "utf-8");
  const lines = raw.split("\n").filter(Boolean);

  const vectorsByWord = new Map<string, number[]>();
  const words: string[] = [];

  for (const line of lines) {
    const parsed = JSON.parse(line) as EmbeddingRow;
    const word = parsed.word.toLowerCase();
    vectorsByWord.set(word, parsed.embedding);
    words.push(word);
  }

  return { words, vectorsByWord };
}

export function getVocabStore(): VocabStore {
  if (!cache) {
    cache = loadEmbeddings();
  }
  return cache;
}

export function getVector(word: string): number[] | undefined {
  return getVocabStore().vectorsByWord.get(word.toLowerCase());
}

export function randomTargetWord(): string {
  const { words } = getVocabStore();
  return words[Math.floor(Math.random() * words.length)];
}
